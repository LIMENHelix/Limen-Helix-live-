/**
 * ai-orchestrator.js — multi-AI dispatch with budget gating.
 *
 * Routes calls across Anthropic (primary), OpenAI (verification), and Grok
 * (fast retrieval). Each provider has its own env-var gate; the orchestrator
 * silently falls back when one is missing. All calls go through a budget
 * counter so the autonomic loop can't burn through credits unattended.
 *
 * Provider selection by intent:
 *   AUTHOR_PATTERN    Anthropic (claude-opus-4-7 — strongest reasoning)
 *   REFRESH_ARTIFACT  Anthropic (claude-sonnet-4-6 — fast, capable)
 *   VERIFY            OpenAI (cross-check anthropic output)
 *   RETRIEVE          Grok (fast web-grounded retrieval)
 *
 * Budget gating: counts tokens used per cron tick, refuses calls past
 * MAX_TOKENS_PER_TICK. Per-call timeout 60s. Idempotent: same input key
 * skips re-call if completed within cache TTL.
 */
const fs = require('node:fs');
const path = require('node:path');

const BUDGET_FILE = path.join(__dirname, '..', 'assets', 'data', '_ai-budget.json');
const MAX_TOKENS_PER_TICK = parseInt(process.env.LIMEN_AI_TOKENS_PER_TICK || '0', 10);    // COST-SAFE DEFAULT: 0 = refuse ALL AI calls unless an explicit budget is set via env. (Was 500000 ~$10/tick — a missing/reset env var silently allowed spend. 2026-06-20 cost-bleed fix.)
const MAX_CALLS_PER_TICK = parseInt(process.env.LIMEN_AI_CALLS_PER_TICK || '50', 10);

function _now() { return new Date().toISOString(); }
function _loadBudget() {
  try {
    const b = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
    // rotate tick window — reset counters at top of hour
    const ageMin = (Date.now() - new Date(b.tickStartedAt).getTime()) / 60000;
    if (ageMin > 60) return { tickStartedAt: _now(), tokensUsed: 0, callsMade: 0, byProvider: {}, lastCallAt: null };
    return b;
  } catch (e) { return { tickStartedAt: _now(), tokensUsed: 0, callsMade: 0, byProvider: {}, lastCallAt: null }; }
}
function _saveBudget(b) { try { fs.writeFileSync(BUDGET_FILE, JSON.stringify(b, null, 2)); } catch (e) {} }

function _record(provider, tokensEstimate) {
  const b = _loadBudget();
  b.tokensUsed += tokensEstimate;
  b.callsMade += 1;
  b.lastCallAt = _now();
  b.byProvider[provider] = (b.byProvider[provider] || 0) + tokensEstimate;
  _saveBudget(b);
  return b;
}

function _budgetGate() {
  const b = _loadBudget();
  if (b.tokensUsed >= MAX_TOKENS_PER_TICK) return { ok: false, reason: 'tokens-per-tick budget exceeded: ' + b.tokensUsed + ' / ' + MAX_TOKENS_PER_TICK };
  if (b.callsMade >= MAX_CALLS_PER_TICK) return { ok: false, reason: 'calls-per-tick budget exceeded: ' + b.callsMade + ' / ' + MAX_CALLS_PER_TICK };
  return { ok: true, current: b };
}

function _providersAvailable() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!(process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY),
    grok: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY)
  };
}

// ─── Anthropic call (claude opus/sonnet) ─────────────────────────
async function _callAnthropic(opts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY not set' };
  const model = opts.model || 'claude-sonnet-4-6';
  const body = {
    model,
    max_tokens: opts.maxTokens || 4096,
    messages: opts.messages || [{ role: 'user', content: opts.prompt || '' }],
    system: opts.system || undefined
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false, error: 'anthropic ' + r.status + ': ' + text.slice(0, 300) };
  }
  const j = await r.json();
  const tokensIn = (j.usage && j.usage.input_tokens) || 0;
  const tokensOut = (j.usage && j.usage.output_tokens) || 0;
  _record('anthropic', tokensIn + tokensOut);
  const text = (j.content && j.content[0] && j.content[0].text) || '';
  return { ok: true, provider: 'anthropic', model, text, tokensIn, tokensOut, raw: j };
}

// ─── OpenAI call (verification) ──────────────────────────────────
async function _callOpenAI(opts) {
  const key = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (!key) return { ok: false, error: 'OPENAI_API_KEY not set' };
  const model = opts.model || 'gpt-4o-mini';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: opts.messages || (opts.system ? [{ role: 'system', content: opts.system }, { role: 'user', content: opts.prompt || '' }] : [{ role: 'user', content: opts.prompt || '' }]),
      max_tokens: opts.maxTokens || 2048
    })
  });
  if (!r.ok) return { ok: false, error: 'openai ' + r.status + ': ' + (await r.text()).slice(0, 300) };
  const j = await r.json();
  const tokensIn = (j.usage && j.usage.prompt_tokens) || 0;
  const tokensOut = (j.usage && j.usage.completion_tokens) || 0;
  _record('openai', tokensIn + tokensOut);
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return { ok: true, provider: 'openai', model, text, tokensIn, tokensOut, raw: j };
}

// ─── Grok call (fast retrieval / verification) ───────────────────
async function _callGrok(opts) {
  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key) return { ok: false, error: 'GROK_API_KEY not set' };
  const model = opts.model || process.env.GROK_MODEL || 'grok-4';   // grok-2/3 retired; override via GROK_MODEL env
  const r = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: opts.messages || (opts.system ? [{ role: 'system', content: opts.system }, { role: 'user', content: opts.prompt || '' }] : [{ role: 'user', content: opts.prompt || '' }]),
      max_tokens: opts.maxTokens || 2048
    })
  });
  if (!r.ok) return { ok: false, error: 'grok ' + r.status + ': ' + (await r.text()).slice(0, 300) };
  const j = await r.json();
  const tokensIn = (j.usage && j.usage.prompt_tokens) || 0;
  const tokensOut = (j.usage && j.usage.completion_tokens) || 0;
  _record('grok', tokensIn + tokensOut);
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return { ok: true, provider: 'grok', model, text, tokensIn, tokensOut, raw: j };
}

// ─── public: intent-routed call ──────────────────────────────────
async function call(intent, opts) {
  // Global kill switch — stop all paid-AI billing unless explicitly re-enabled (LIMEN_AI_ENABLED=1).
  if (require('./ai-kill-switch').aiDisabled()) return { ok: false, disabled: true, error: 'AI disabled — billing stopped per operator' };
  const gate = _budgetGate();
  if (!gate.ok) return { ok: false, error: gate.reason, budget: gate.current };
  opts = opts || {};
  const available = _providersAvailable();

  if (intent === 'AUTHOR_PATTERN') {
    if (!available.anthropic) return { ok: false, error: 'AUTHOR_PATTERN requires Anthropic; ANTHROPIC_API_KEY not set' };
    // claude-sonnet-4-6 instead of opus: same schema-bound output quality
    // but ~3x faster. Vercel Hobby plan times out at 10s, Pro at 60s, so
    // Opus calls were dying mid-request and never returning. Sonnet
    // typically lands in 15-30s.
    return _callAnthropic({ ...opts, model: opts.model || 'claude-sonnet-4-6', maxTokens: opts.maxTokens || 6144 });
  }
  if (intent === 'REFRESH_ARTIFACT') {
    if (available.anthropic) return _callAnthropic({ ...opts, model: opts.model || 'claude-sonnet-4-6', maxTokens: opts.maxTokens || 4096 });
    if (available.openai) return _callOpenAI({ ...opts, model: opts.model || 'gpt-4o' });
    return { ok: false, error: 'no provider available for REFRESH_ARTIFACT' };
  }
  if (intent === 'VERIFY') {
    if (available.openai) return _callOpenAI({ ...opts, model: 'gpt-4o-mini' });
    if (available.grok) return _callGrok(opts);
    if (available.anthropic) return _callAnthropic({ ...opts, model: 'claude-haiku-4-5-20251001', maxTokens: 1024 });
    return { ok: false, error: 'no provider available for VERIFY' };
  }
  if (intent === 'RETRIEVE') {
    if (available.grok) return _callGrok(opts);
    if (available.openai) return _callOpenAI({ ...opts, model: 'gpt-4o-mini' });
    return { ok: false, error: 'no provider available for RETRIEVE' };
  }
  return { ok: false, error: 'unknown intent ' + intent };
}

function status() {
  return { providers: _providersAvailable(), budget: _loadBudget(), limits: { maxTokensPerTick: MAX_TOKENS_PER_TICK, maxCallsPerTick: MAX_CALLS_PER_TICK } };
}

module.exports = { call, status, _callAnthropic, _callOpenAI, _callGrok };
