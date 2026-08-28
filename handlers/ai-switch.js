/**
 * handlers/ai-switch.js — /api/ai-switch — the operator's visible on/off for autonomous AI spend.
 *
 * Master-gated. Reads and flips the RUNTIME pause flag (lib/ai-kill-switch: ai:spend:paused in
 * Redis) with NO redeploy. The env var LIMEN_AI_ENABLED remains the hard outer boundary — this
 * switch can only PAUSE spend the env already allows; it can never spend past the env kill switch.
 *
 *   GET  /api/ai-switch?key=<master>              -> current state (env + runtime + effective)
 *   POST /api/ai-switch?key=<master>  { paused }  -> set the runtime pause, return new state
 */
var gate = require('../lib/admin-gate');
var ks = require('../lib/ai-kill-switch');

function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

async function state() {
  var envEnabled = !ks.aiDisabled();                       // LIMEN_AI_ENABLED === '1'
  var tokensPerTick = parseInt(process.env.LIMEN_AI_TOKENS_PER_TICK || '0', 10);
  var runtimePaused = await ks.spendPausedRuntime();
  var blocked = await ks.spendDisabled();                  // true => no autonomous spend right now
  return {
    envEnabled: envEnabled,                                // the hard boundary (needs redeploy to change)
    tokensPerTick: tokensPerTick,
    runtimePaused: runtimePaused,                          // the soft switch (instant, this endpoint)
    spending: !blocked,                                    // effective: is autonomous AI spend live right now
    reason: !envEnabled ? 'env-disabled' : (runtimePaused ? 'operator-paused' : (tokensPerTick <= 0 ? 'budget-zero' : 'live'))
  };
}

module.exports = async function handler(req, res) {
  var pass = gate.reqKey(req);
  if (!gate.isMaster(pass)) return gate.deny(res);
  var method = (req.method || 'GET').toUpperCase();

  if (method === 'POST') {
    var body = await readBody(req);
    if (typeof body.paused === 'undefined') return j(res, 400, { ok: false, error: 'body needs { paused: true|false }' });
    var paused = !!body.paused;
    try {
      await ks.setSpendPaused(paused);
      var s = await state();
      return j(res, 200, { ok: true, changed: true, state: s,
        note: paused ? 'Autonomous AI spend PAUSED (runtime, no redeploy). Resume any time.'
                     : (s.envEnabled ? 'Autonomous AI spend RESUMED (bounded by LIMEN_AI_TOKENS_PER_TICK).'
                                     : 'Runtime pause cleared, but env kill switch (LIMEN_AI_ENABLED) still holds spend OFF.') });
    } catch (error) {
      return j(res, 503, { ok: false, changed: false, error: 'AI runtime interlock unavailable; paid dispatch remains fail-closed.' });
    }
  }

  return j(res, 200, { ok: true, state: await state() });
};
