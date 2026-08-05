/**
 * handlers/brain-shadow.js — the shadow runtime's only HTTP surface.
 *
 *   GET /api/brain-shadow                 protected health read: cycle state per domain
 *   GET /api/brain-shadow?history=energy  protected: recent cycle reports for one domain
 *   GET /api/brain-shadow?run=1           the cron trigger; runs the canaries
 *
 * READ-ONLY AND PROTECTED. The health views never write, and every route requires
 * BRAIN_SHADOW_TOKEN via `x-brain-token` (or `?token=`). There is NO committed fallback:
 * with the variable unset the endpoint fails closed with 503 rather than serving shadow
 * internals to anyone who guesses the path. Cron requests carry the same token.
 *
 * WHY GATE A READ AT ALL. The shadow output is unvalidated brain state by definition — it
 * exists precisely because nobody has decided it is trustworthy. Publishing it unauthed
 * would create the consumer this runtime is supposed not to have, and a page reading it
 * would become the authority the design says it must not be.
 */

'use strict';

var RUNTIME = require('../lib/brain-shadow-runtime');
var STORE = require('../lib/brain-shadow-store');
var REG = require('../brain-v2/bind/registry.js');

var TOKEN = process.env.BRAIN_SHADOW_TOKEN || '';   // no committed fallback: fails closed

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  var url = new URL(req.url, 'http://localhost');
  var q = Object.fromEntries(url.searchParams);

  /**
   * TWO CALLERS, TWO CREDENTIALS, and the cron one follows the convention already used by
   * autopilot and cron-repair-held rather than inventing a second scheme: prefer
   * CRON_SECRET when it is set (spoof-proof, Vercel attaches it), and fall back to the
   * Vercel cron headers only when it is not. An operator reading the health view uses
   * BRAIN_SHADOW_TOKEN, which a cron cannot send because a cron cannot set headers.
   *
   * The token is NOT put in the cron path. A secret in vercel.json is a committed secret.
   */
  var isCron = !!(req.headers && (process.env.CRON_SECRET
    ? (req.headers['authorization'] === 'Bearer ' + process.env.CRON_SECRET)
    : (req.headers['x-vercel-cron'] || req.headers['x-vercel-signature'])));

  if (!isCron) {
    if (!TOKEN) {
      return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
    }
    var tok = req.headers['x-brain-token'] || q.token ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (tok !== TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  try {
    /**
     * THE ONLY WRITING ROUTE, and it writes only through the confined store. It is
     * idempotent by cursor: a second call in the same hour finds no rows after `lastRowT`
     * and applies nothing, so a duplicate or replayed trigger cannot double-count an
     * observation.
     */
    if (q.run || (isCron && !q.history)) {
      var only = q.domain ? [q.domain] : null;
      var result = await RUNTIME.runDomains(only, {});
      return send(res, result.ok ? 200 : 207, result);
    }

    if (q.history) {
      var d = REG.descriptorFor(q.history);
      if (!d) return send(res, 400, { ok: false, error: 'unknown domain "' + q.history + '"' });
      return send(res, 200, {
        ok: true, domain: d.snapshot,
        history: await STORE.readHistory(d.snapshot, parseInt(q.n, 10) || 24)
      });
    }

    /* DEFAULT: health across the canaries, read-only. Reports what the last cycle did,
       including its abstentions and its actuation counters, so "is it acting?" is
       answerable without reading the code. */
    var out = {};
    for (var i = 0; i < RUNTIME.CANARY_DOMAINS.length; i++) {
      var p = RUNTIME.CANARY_DOMAINS[i];
      var desc = REG.descriptorFor(p);
      var cyc = await STORE.readCycle(desc.snapshot);
      out[p] = cyc ? {
        domain: cyc.domain, ok: cyc.ok, error: cyc.error,
        startedAt: cyc.startedAt, finishedAt: cyc.finishedAt,
        rowsAvailable: cyc.rowsAvailable, rowsApplied: cyc.rowsApplied, ticks: cyc.ticks,
        cursorAfter: cyc.cursorAfter, restored: cyc.restored,
        provenance: cyc.provenance, predictions: cyc.predictions,
        abstentions: (cyc.abstentions || []).length,
        actuation: cyc.actuation
      } : null;
    }
    return send(res, 200, {
      ok: true,
      runtime: RUNTIME.RUNTIME_VERSION,
      namespace: STORE.PREFIX,
      note: 'shadow only: no actuation, no production brain state, no site consumer',
      canaries: RUNTIME.CANARY_DOMAINS,
      cycles: out
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: (e && e.message) || String(e) });
  }
};
