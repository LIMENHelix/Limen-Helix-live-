/**
 * api/capital-engine.js — Finance Domain · Capital Engine (CONSOLIDATED router)
 *
 * ONE Vercel function, many actions (footprint-conscious: replaces what would
 * otherwise be 4–5 separate /api files). Drive everything via ?action=.
 *
 *   GET  /api/capital-engine?action=streams    → data contract + live connector readiness
 *   GET  /api/capital-engine?action=status     → AI orchestrator + budget + connector readiness
 *   GET  /api/capital-engine?action=route      → proposed capital routes (read-only; never moves money)
 *   POST /api/capital-engine?action=orchestrate → run a budget-gated AI pass that PROPOSES
 *                                                 stream priorities (returns text only)
 *
 * Hard safety rules:
 *   - This endpoint NEVER moves money. No Stripe transfer/charge call lives here.
 *   - Anything with signoffRequired=true stays a PROPOSAL until a human signs.
 *   - AI calls are gated by api/lib/ai-orchestrator budget counters.
 */
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '..', 'assets', 'data', 'capital-engine.json');

// raw-body reader (Stripe signature needs the exact bytes). Falls back to a
// re-stringified parsed body if the platform already consumed the stream.
function _readRaw(req) {
  return new Promise(function (resolve) {
    if (typeof req.body === 'string') return resolve(req.body);
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return resolve(JSON.stringify(req.body));
    let data = '';
    try {
      req.on('data', function (c) { data += c; });
      req.on('end', function () { resolve(data); });
      req.on('error', function () { resolve(data); });
    } catch (e) { resolve(''); }
  });
}
function _findStream(contract, id) { return (contract.streams || []).find(function (s) { return s.id === id; }) || null; }

function _readContract() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return null; }
}

// connector readiness: which env keys are actually present (booleans only, never the value)
function _connectorReadiness(contract) {
  const out = [];
  const connectors = (contract && contract.connectors) || [];
  for (let i = 0; i < connectors.length; i++) {
    const c = connectors[i];
    const req = c.envKeys || [];          // REQUIRED to function
    const opt = c.optionalKeys || [];     // optional enhancements (e.g. Stripe webhook, Amazon PA-API)
    const has = function (k) { return !!process.env[k]; };
    // 'mcp'/'manual'/'attach'/'live' connectors have no env keys — readiness is N/A
    let live;
    if (c.status === 'mcp') live = 'mcp-auth';
    else if (req.length === 0) live = c.status || 'manual';
    else if (!req.every(has)) live = 'needs-key';
    else if (opt.length && !opt.every(has)) live = 'partial';   // functional, enhancement pending
    else live = 'key-present';
    const missing = req.concat(opt).filter(function (k) { return !has(k); });
    out.push({ id: c.id, name: c.name, type: c.type, tier: c.tier, signoffRequired: !!c.signoffRequired, readiness: live, missing: missing });
  }
  return out;
}

function _aiStatus() {
  try {
    const orch = require('./lib/ai-orchestrator');
    return orch.status();
  } catch (e) {
    // orchestrator present but env may be missing; report providers directly
    return {
      providers: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai: !!(process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY),
        grok: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY)
      },
      budget: null,
      error: String(e && e.message || e)
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const action = (req.query && req.query.action) || 'streams';
  const contract = _readContract();
  if (!contract) return res.status(500).json({ ok: false, error: 'capital-engine.json not readable' });

  // ── STREAMS: full contract + connector readiness merged in ──────────
  if (action === 'streams') {
    return res.status(200).json({
      ok: true,
      domain: contract.domain,
      streams: contract.streams,
      connectors: _connectorReadiness(contract),
      capitalRouting: contract.capitalRouting,
      approvalQueue: contract.approvalQueue,
      ai: _aiStatus(),
      meta: contract._meta
    });
  }

  // ── STATUS: AI + budget + connector readiness only (light) ──────────
  if (action === 'status') {
    return res.status(200).json({
      ok: true,
      ai: _aiStatus(),
      connectors: _connectorReadiness(contract),
      aiOrchestration: contract.aiOrchestration
    });
  }

  // ── ROUTE: proposed capital routes — READ ONLY, never executes ──────
  if (action === 'route') {
    return res.status(200).json({
      ok: true,
      policy: contract.capitalRouting.policy,
      proposedRoutes: contract.capitalRouting.proposedRoutes,
      notice: 'Proposals only. Execution requires human sign-off (see approvalQueue / FINANCE_PORTAL_SIGNOFF.md).'
    });
  }

  // ── ORCHESTRATE: budget-gated AI pass that PROPOSES priorities ──────
  if (action === 'orchestrate') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'orchestrate requires POST' });
    let orch;
    try { orch = require('./lib/ai-orchestrator'); }
    catch (e) { return res.status(500).json({ ok: false, error: 'ai-orchestrator unavailable: ' + e.message }); }

    const liveContext = {
      streams: contract.streams.map(function (s) { return { id: s.id, tier: s.tier, status: s.status, phase: s.phase, signoffRequired: s.signoffRequired }; }),
      connectors: _connectorReadiness(contract)
    };
    const system = 'You are the Finance Domain capital-allocation kernel for LIMEN Helix. '
      + 'You PROPOSE which revenue streams to activate next to maximise return-per-dollar, given which connectors are key-ready. '
      + 'You never authorise money movement; anything signoffRequired stays a proposal. Be concise and ranked.';
    const prompt = 'Given this live state, rank the next 5 streams to activate (free/key-ready first) and the single human action each needs.\n\n'
      + JSON.stringify(liveContext, null, 2);

    const result = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 2048 });
    if (!result.ok) return res.status(200).json({ ok: false, error: result.error, budget: result.budget || null });
    return res.status(200).json({ ok: true, provider: result.provider, model: result.model, proposal: result.text, tokens: { in: result.tokensIn, out: result.tokensOut } });
  }

  // ── LEDGER: self-audit P&L + finance health + lendable surplus ──────
  if (action === 'ledger') {
    const ledger = require('../lib/finance-ledger');
    const autonomic = require('../lib/finance-autonomic');
    return res.status(200).json({ ok: true, summary: await ledger.summary(), health: await autonomic.health(), approvals: await autonomic.approvals(20), events: await ledger.events(50) });
  }

  // ── QUEUE: content queue + published log (operator view) ───────────
  if (action === 'queue') {
    const ops = require('../lib/stream-ops');
    return res.status(200).json({ ok: true, queue: await ops.queue(50), published: await ops.published(50) });
  }

  // ── PRODUCE: AI-generate content for one stream (budget-gated) ──────
  if (action === 'produce') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'produce requires POST' });
    const ops = require('../lib/stream-ops');
    const id = (req.query && req.query.stream) || (req.body && req.body.stream);
    const s = _findStream(contract, id);
    if (!s) return res.status(400).json({ ok: false, error: 'unknown stream: ' + id });
    return res.status(200).json(await ops.produce(s, { name: 'LIMEN Helix' }));
  }

  // ── PUBLISH: dispatch a queued artifact if its token exists ─────────
  if (action === 'publish') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'publish requires POST' });
    const ops = require('../lib/stream-ops');
    const id = (req.query && req.query.artifact) || (req.body && req.body.artifact);
    const q = await ops.queue(500);
    const art = q.find(function (a) { return a.id === id; });
    if (!art) return res.status(400).json({ ok: false, error: 'unknown artifact: ' + id });
    return res.status(200).json(await ops.publish(art));
  }

  // ── CHECKOUT: create a Stripe payment link (ACCEPT income) ─────────
  if (action === 'checkout') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'checkout requires POST' });
    const stripe = require('../lib/stripe-rail');
    const b = req.body || {};
    return res.status(200).json(await stripe.createPaymentLink({ name: b.name, amount: Number(b.amount), streamId: b.stream, currency: b.currency }));
  }

  // ── STRIPE WEBHOOK: verify + record income to ledger ───────────────
  if (action === 'stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'webhook requires POST' });
    const stripe = require('../lib/stripe-rail');
    const raw = await _readRaw(req);
    const sig = req.headers['stripe-signature'];
    const result = await stripe.recordWebhook(raw, sig);
    return res.status(result.ok ? 200 : 400).json(result);
  }

  // ── TICK: run one autonomic cycle (audit → heal → build) ───────────
  // GET allowed so Vercel cron can fire it; tick proposes only, never moves money.
  if (action === 'tick') {
    const autonomic = require('../lib/finance-autonomic');
    const cap = req.query && req.query.cap ? parseInt(req.query.cap, 10) : 3;
    return res.status(200).json({ ok: true, report: await autonomic.tick({ buildCap: cap }) });
  }

  // ── ARTICLES: published owned-site journal (public read) ───────────
  if (action === 'articles') {
    const db = require('./lib/limen-db');
    const list = await db.lrange('site:articles', 0, 100);
    return res.status(200).json({ ok: true, articles: list });
  }

  // ── SUBSCRIBE: email capture for the journal (monetization funnel) ──
  if (action === 'subscribe') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'subscribe requires POST' });
    const db = require('./lib/limen-db');
    const email = ((req.body && req.body.email) || (req.query && req.query.email) || '').toString().trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'invalid email' });
    await db.lpush('site:subscribers', { email: email, ts: new Date().toISOString() });
    await db.ltrim('site:subscribers', 0, 99999);
    return res.status(200).json({ ok: true, subscribed: true });
  }

  // ── PACKAGE-PATENT: filed patent draft → marketplace listing + targets ──
  if (action === 'package-patent') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'package-patent requires POST' });
    const pp = require('../lib/patent-packager');
    const b = req.body || {};
    return res.status(200).json(await pp.packageListing({ id: b.id, title: b.title, patentText: b.patentText, domain: b.domain }));
  }

  // ── PATENT-LISTINGS: packaged listings + status (operator view) ────
  if (action === 'patent-listings') {
    const pp = require('../lib/patent-packager');
    return res.status(200).json({ ok: true, listings: await pp.listings(100) });
  }

  // ── APPLICATION AUDITOR (master-brain): multi-AI audit / rewrite / approve / submit ──
  if (action === 'audit-application') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'audit-application requires POST' });
    const aud = require('../lib/application-auditor');
    const b = req.body || {};
    return res.status(200).json(await aud.audit({ id: b.id, title: b.title, funder: b.funder, text: b.text }));
  }
  if (action === 'rewrite-application') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'rewrite-application requires POST' });
    const aud = require('../lib/application-auditor');
    const b = req.body || {};
    return res.status(200).json(await aud.rewrite({ funder: b.funder, program: b.program, fixes: b.fixes, text: b.text }));
  }
  if (action === 'applications') {
    const aud = require('../lib/application-auditor');
    return res.status(200).json({ ok: true, applications: await aud.list(50) });
  }
  if (action === 'application-approve') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'approve requires POST' });
    const aud = require('../lib/application-auditor');
    const b = req.body || {};
    return res.status(200).json(await aud.setStatus(b.id, 'approved', { approvedBy: b.signer || 'operator' }));
  }
  if (action === 'application-submit') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'submit requires POST' });
    const aud = require('../lib/application-auditor');
    const b = req.body || {};
    const r = await aud.setStatus(b.id, 'submitted', { channel: b.channel || 'manual' });
    // Honest: federal grants must be filed by a registered AOR on Research.gov/Grants.gov (no API).
    r.notice = 'Marked submitted. Federal grants must be filed by your registered AOR on Research.gov — system cannot auto-file. Patent/marketplace outreach can be auto-sent via Gmail.';
    return res.status(200).json(r);
  }

  return res.status(400).json({ ok: false, error: 'unknown action: ' + action, valid: ['streams', 'status', 'route', 'orchestrate', 'ledger', 'queue', 'produce', 'publish', 'checkout', 'stripe-webhook', 'tick', 'articles', 'subscribe', 'package-patent', 'patent-listings', 'audit-application', 'rewrite-application', 'applications', 'application-approve', 'application-submit'] });
};
