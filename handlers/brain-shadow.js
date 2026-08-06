/**
 * handlers/brain-shadow.js — the shadow runtime's only HTTP surface.
 *
 *   GET /api/brain-shadow                 operator health read: cycle state per domain
 *   GET /api/brain-shadow?history=energy  operator read: recent cycle reports for a domain
 *   GET /api/brain-shadow?run=1           CRON ONLY: executes a cycle
 *
 * OPERATOR READS AND EXECUTION ARE SEPARATE POWERS. `BRAIN_SHADOW_TOKEN` grants reads and
 * nothing else. Execution requires `Authorization: Bearer $CRON_SECRET`. An operator token
 * cannot make this endpoint write, and neither credential has a query-string form.
 *
 * THIS ENDPOINT IS ITSELF A READER OF SHADOW STATE — the only one, and a new one added by
 * this PR. The guarantee is NOT "nothing reads shadow results", which this file would
 * falsify on its own; it is that no PRE-EXISTING site surface, UI page or decision path
 * reads them, and that the one reader that exists is token-gated and operator-facing.
 *
 * WHY GATE A READ AT ALL. Shadow output is unvalidated brain state by definition — it
 * exists precisely because nobody has decided it is trustworthy. Serving it unauthed would
 * invite exactly the consumer this runtime must not have, and a page reading it would
 * become the authority the design says it must not be.
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
   * TWO CREDENTIALS FOR TWO DIFFERENT POWERS, and they are not interchangeable:
   *
   *   CRON_SECRET         authorises EXECUTION (the only writing path)
   *   BRAIN_SHADOW_TOKEN  authorises OPERATOR READS of shadow state
   *
   * CRON AUTH FAILS CLOSED. An earlier version fell back to trusting `x-vercel-cron` or
   * `x-vercel-signature` when CRON_SECRET was unset. Those are request headers: anything
   * that can reach this URL can set them, so the fallback made the write path
   * authenticated by a string the caller chooses. Vercel's documented pattern is a
   * non-empty CRON_SECRET and an exact `Authorization: Bearer <secret>` match, and that is
   * now the only accepted form. With CRON_SECRET unset, execution is refused outright.
   *
   * NO TOKEN IN A QUERY STRING, either. Query strings are logged by proxies, CDNs and
   * analytics, so `?token=` leaks the credential into places nobody audits. Headers only.
   * The cron path in vercel.json carries no secret for the same reason.
   */
  var cronSecret = process.env.CRON_SECRET || '';
  var isCron = !!(cronSecret && req.headers &&
    req.headers['authorization'] === 'Bearer ' + cronSecret);

  if (!isCron) {
    if (!TOKEN) {
      return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
    }
    var tok = req.headers['x-brain-token'] ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok || tok !== TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' });
  }

  try {
    /**
     * THE ONLY WRITING PATH, and it requires cron authentication. An operator holding
     * BRAIN_SHADOW_TOKEN can READ shadow state and cannot make the runtime write: a GET
     * that mutates because of a query parameter is a read endpoint in name only, and
     * `?run=1` on an operator credential was exactly that.
     *
     * Idempotent for SEQUENTIAL duplicates: a later call finds no rows past the stored
     * cursor. Concurrent calls are not serialised — there is no lock — which is why the
     * trigger is one hourly cron.
     */
    if (isCron && q.run === '1') {
      var only = q.domain ? [q.domain] : null;
      var result = await RUNTIME.runDomains(only, {});
      return send(res, result.ok ? 200 : 207, result);
    }
    if (q.run !== undefined && !isCron) {
      return send(res, 403, {
        ok: false,
        error: 'execution requires cron authentication (Authorization: Bearer $CRON_SECRET); ' +
               'BRAIN_SHADOW_TOKEN grants read access only'
      });
    }

    if (q.history) {
      var d = REG.descriptorFor(q.history);
      if (!d) return send(res, 400, { ok: false, error: 'unknown domain "' + q.history + '"' });
      return send(res, 200, {
        ok: true, domain: d.snapshot,
        history: await STORE.readHistory(d.snapshot, parseInt(q.n, 10) || 24)
      });
    }

    /* DEFAULT: health across every INSTALLED domain, read-only. Reports what the last cycle
       did, including its abstentions and its actuation counters, so "is it acting?" is
       answerable without reading the code.

       THE SET COMES FROM THE REGISTRY, through the runtime that executes it. This loop must
       never iterate a list of its own: a handler with its own copy reports on the domains it
       remembers rather than the domains that ran, and the first symptom is a newly installed
       domain that is silently absent from the only surface anyone reads. */
    var out = {};
    var installed = RUNTIME.INSTALLED_DOMAINS;
    /* Bytes persisted per domain, and their total. This is the number that decides whether
       the next batch is affordable: every cycle reads the whole state and writes it back,
       and Upstash bills bandwidth. Reported as measured bytes from the last cycle, null
       where that cycle failed or has not run, so an absent domain cannot read as zero. */
    var totalStateBytes = 0, measured = 0;
    for (var i = 0; i < installed.length; i++) {
      var p = installed[i];
      var desc = REG.descriptorFor(p);
      var cyc = await STORE.readCycle(desc.snapshot);
      if (cyc && typeof cyc.stateBytes === 'number') { totalStateBytes += cyc.stateBytes; measured++; }
      out[p] = cyc ? {
        domain: cyc.domain, ok: cyc.ok, error: cyc.error,
        startedAt: cyc.startedAt, finishedAt: cyc.finishedAt,
        rowsAvailable: cyc.rowsAvailable, rowsApplied: cyc.rowsApplied, ticks: cyc.ticks,
        cursorAfter: cyc.cursorAfter, restored: cyc.restored,
        provenance: cyc.provenance, predictions: cyc.predictions,
        abstentions: (cyc.abstentions || []).length,
        actuation: cyc.actuation,
        stateBytes: typeof cyc.stateBytes === 'number' ? cyc.stateBytes : null
      } : null;
    }
    return send(res, 200, {
      ok: true,
      runtime: RUNTIME.RUNTIME_VERSION,
      namespace: STORE.PREFIX,
      note: 'shadow only: no outward actuation, no production brain state, no site consumer. ' +
            'Installed means executing in shadow; it activates no relationship and evidences nothing.',
      installed: installed,
      installedCount: installed.length,
      boundCount: REG.DOMAINS.length,
      /* Named `measuredDomains` rather than left implicit: a total over 3 of 7 domains and a
         total over 7 of 7 are different numbers and must not look alike. */
      stateBytesTotal: totalStateBytes,
      stateBytesMeasuredDomains: measured,
      cycles: out
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: (e && e.message) || String(e) });
  }
};
