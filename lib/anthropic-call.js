/**
 * lib/anthropic-call.js — the ONLY way a handler should call Anthropic.
 *
 * Before this file, 12 handlers held ANTHROPIC_API_KEY and called the API directly; 8 of them
 * checked no budget at all. A meter you can walk around is not a meter, so every paid call
 * now goes through here: reserve budget, call, settle with real usage.
 *
 *   const r = await callAnthropic({ body: {...}, label: 'domain-agent' });
 *   if (r.refused) return { ok:false, error: r.reason };   // over budget — a normal stop
 *   if (!r.ok) return { ok:false, error: r.detail };       // upstream error
 *   r.text  // first text block
 *
 * ESTIMATION AND CORRECTION. Exact input tokens are not known before the call, so the
 * reservation uses a chars/4 approximation. That is deliberately rough: `settle` replaces it
 * with `usage` from the response, so the ledger converges on the truth even though the gate
 * runs on an estimate. Output is reserved at the full `max_tokens` — the worst case — so a
 * long completion can never overshoot the budget.
 */
var meter = require('./spend-meter');
var killSwitch = require('./ai-kill-switch');

var ENDPOINT = 'https://api.anthropic.com/v1/messages';
var VERSION = '2023-06-01';

// ~4 characters per token is the usual English rough ratio. Only used for the pre-call
// reservation; the post-call settle uses the API's own count.
function estimateInputTokens(body) {
  var chars = 0;
  try {
    if (body.system) chars += (typeof body.system === 'string' ? body.system : JSON.stringify(body.system)).length;
    if (Array.isArray(body.messages)) chars += JSON.stringify(body.messages).length;
    if (Array.isArray(body.tools)) chars += JSON.stringify(body.tools).length;
  } catch (e) { chars = 4000; }
  return Math.ceil(chars / 4);
}

function firstText(json) {
  if (!json || !Array.isArray(json.content)) return '';
  for (var i = 0; i < json.content.length; i++) {
    var b = json.content[i];
    if (b && b.type === 'text' && b.text) return b.text;
  }
  return '';
}

/**
 * @param {object} o
 * @param {object} o.body      the /v1/messages request body (must carry model + max_tokens)
 * @param {string} [o.label]   what is spending, for the ledger
 * @param {number} [o.timeoutMs]
 * @param {string} [o.apiKey]  defaults to ANTHROPIC_API_KEY
 */
async function callAnthropic(o) {
  o = o || {};
  var body = o.body || {};
  var apiKey = o.apiKey || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return { ok: false, detail: 'ANTHROPIC_API_KEY is unset.' };

  // The kill switch is the hard outer boundary, checked BEFORE the budget: an operator pause
  // must stop spend even when budget remains. spendDisabled() is the combined gate the rest of
  // this repo uses (env boundary + the operator's instant Redis pause) — aiDisabled() alone
  // would miss the runtime pause.
  try {
    if (await killSwitch.spendDisabled()) {
      return { ok: false, disabled: true, detail: 'AI spend is disabled or paused by the operator.' };
    }
  } catch (e) {
    return { ok: false, disabled: true, detail: 'Could not read the AI kill switch; refusing to spend.' };
  }

  var model = body.model || 'unknown';
  var maxTokens = parseInt(body.max_tokens, 10) || 1024;

  var rsv = await meter.reserve({
    kind: 'ai', model: model,
    inputTokens: estimateInputTokens(body),
    outputTokens: maxTokens,           // reserve the ceiling, settle the actual
    label: o.label || 'anthropic'
  });
  if (!rsv.ok) return { ok: false, refused: true, reason: rsv.reason, budget: rsv };

  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, o.timeoutMs || 45000);
  var json = null, status = 0, err = null;
  try {
    var r = await fetch(ENDPOINT, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': VERSION },
      body: JSON.stringify(body)
    });
    clearTimeout(tid);
    status = r.status;
    json = await r.json().catch(function () { return null; });
  } catch (e) {
    clearTimeout(tid);
    err = e && e.message ? e.message : String(e);
  }

  // Settle whatever actually happened. A failed call still settles — at zero when the request
  // never produced usage — so a crash or a 4xx cannot leave the reservation holding budget.
  var usage = (json && json.usage) || null;
  try {
    await meter.settle(rsv.id, usage
      ? {
          model: model,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          cacheWriteTokens: usage.cache_creation_input_tokens || 0
        }
      : { costUsd: 0 });
  } catch (e) {}

  if (err) return { ok: false, detail: err };
  if (status !== 200) return { ok: false, status: status, detail: json || ('HTTP ' + status) };
  return { ok: true, status: status, json: json, text: firstText(json), usage: usage };
}

/**
 * Lower-friction pair for handlers that already own their fetch and response handling.
 * Converting those to callAnthropic() would mean restructuring live code for no behavioural
 * gain, so they keep their fetch and bracket it instead:
 *
 *   const g = await guard(body, 'hook-studio');
 *   if (!g.ok) return { ok:false, detail:g.reason, refused:true };
 *   ...existing fetch, using g.body...
 *   await close(g, json);
 *
 * Same gate, same ledger, minimal diff.
 */
async function guard(body, label) {
  body = body || {};
  try {
    if (await killSwitch.spendDisabled()) {
      return { ok: false, reason: 'AI spend is disabled or paused by the operator.', body: body };
    }
  } catch (e) {
    return { ok: false, reason: 'Could not read the AI kill switch; refusing to spend.', body: body };
  }
  var rsv = await meter.reserve({
    kind: 'ai',
    model: body.model || 'unknown',
    inputTokens: estimateInputTokens(body),
    outputTokens: parseInt(body.max_tokens, 10) || 1024,
    label: label || 'anthropic'
  });
  if (!rsv.ok) return { ok: false, reason: rsv.reason, budget: rsv, body: body };
  return { ok: true, id: rsv.id, body: body, model: body.model || 'unknown' };
}

/** Settle a guard() reservation with the response's real usage. Safe to call on failure. */
async function close(g, json) {
  if (!g || !g.id) return { ok: true };
  var u = (json && json.usage) || null;
  try {
    return await meter.settle(g.id, u
      ? {
          model: g.model,
          inputTokens: u.input_tokens || 0,
          outputTokens: u.output_tokens || 0,
          cacheReadTokens: u.cache_read_input_tokens || 0,
          cacheWriteTokens: u.cache_creation_input_tokens || 0
        }
      : { costUsd: 0 });
  } catch (e) { return { ok: false }; }
}

module.exports = { callAnthropic: callAnthropic, guard: guard, close: close, ENDPOINT: ENDPOINT, VERSION: VERSION };
