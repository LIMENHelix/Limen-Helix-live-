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
    /* Serialized state VALUE size per domain, and its total, from each domain's last cycle.
       Null where that cycle failed or has not run, so an absent domain cannot read as zero.

       NOT BANDWIDTH. This is the UTF-8 length of the value handed to SET. The REST transport
       re-encodes it and adds an envelope, so the wire figure is larger and is not measured
       anywhere yet. It tracks RELATIVE hot-state growth, which is what the batch-2 gate
       turns on; it is not a billing number and must not be doubled into one. */
    var totalStateValueBytes = 0, measured = 0;
    for (var i = 0; i < installed.length; i++) {
      var p = installed[i];
      var desc = REG.descriptorFor(p);
      var cyc = await STORE.readCycle(desc.snapshot);
      if (cyc && typeof cyc.stateValueBytes === 'number') { totalStateValueBytes += cyc.stateValueBytes; measured++; }
      out[p] = cyc ? {
        domain: cyc.domain, ok: cyc.ok, error: cyc.error,
        startedAt: cyc.startedAt, finishedAt: cyc.finishedAt,
        rowsAvailable: cyc.rowsAvailable, rowsApplied: cyc.rowsApplied, ticks: cyc.ticks,
        /**
         * CURSOR BEFORE AND AFTER, because continuity is a two-ended claim and this
         * projection carried only one end.
         *
         * The runtime has always recorded `cursorBefore` (lib/brain-shadow-runtime.js), and
         * `?history=` returns stored records unfiltered so it was readable there, but the
         * SUMMARY read is the surface an operator actually looks at and it dropped the
         * field. "Did the cursor stay continuous?" is answered by comparing this cycle's
         * `cursorBefore` against the previous cycle's `cursorAfter`, and with only the
         * latter projected the summary could not answer it at all. Same allow-list defect
         * as compaction and calibration below, found the same way.
         *
         * Null on a cold start is MEANINGFUL, not missing: it is the precondition the
         * cold-start prefix skip is guarded on.
         */
        cursorBefore: cyc.cursorBefore === undefined ? null : cyc.cursorBefore,
        cursorAfter: cyc.cursorAfter, restored: cyc.restored,
        provenance: cyc.provenance, predictions: cyc.predictions,
        abstentions: (cyc.abstentions || []).length,
        actuation: cyc.actuation,
        /* Separates installed from sensed/state-emitting/prediction-grading on real rows. */
        domainFunction: cyc.domainFunction || null,
        stateValueBytes: typeof cyc.stateValueBytes === 'number' ? cyc.stateValueBytes : null,
        /**
         * COMPACTION AND CALIBRATION, because this projection is an ALLOW-LIST and the two
         * fields the compaction work exists to evidence were not on it.
         *
         * Measured 2026-08-08: the 21:27:32Z cycle retired 314 records into archive sequence 1
         * and took energy from 4,090,236 to 3,722,988 bytes, and the health read reported none
         * of it. The stored report carried it the whole time; the only surface anyone looks at
         * dropped it, so "did compaction run in production?" was unanswerable from the endpoint
         * whose job is to answer it. That is the same failure shape as a domain executing
         * hourly while the health read calls it absent.
         *
         * Null rather than omitted when a cycle predates the field, so an old report reads as
         * "not recorded" instead of "did not compact".
         */
        compaction: cyc.compaction || null,
        calibration: cyc.calibration || null,
        /**
         * COLD-START PREFIX SKIP, on the allow-list for the same reason compaction is. Batch 4
         * installs two domains whose entire justification is that this policy fires, so an
         * endpoint that could not report whether it fired would leave the one operator-visible
         * surface unable to answer the only new question the batch raises.
         *
         * Null covers three different situations and deliberately does not distinguish them
         * here, because the stored report does: the policy did not run (restored cycle, or the
         * domain never opted in), or the cycle predates the field. `applied:false` with a `why`
         * is a RAN-AND-DECLINED result and is not the same as null.
         */
        coldStartSkip: cyc.coldStartSkip || null,
        /* On the allow-list because it reports a MUTATION of restored learning state. The
           first post-deploy cycle per domain closes prospective checks stranded by the
           colliding-id defect; if that number were invisible, an open-count drop would look
           like loss rather than repair. */
        prospectiveRepair: cyc.prospectiveRepair || null,
        /**
         * RELATIONSHIP COMPARABILITY, on the allow-list for the same reason compaction,
         * calibration, the cold-start skip and cursorBefore are: this projection drops
         * anything not named here, and a field the runtime records but the operator read
         * cannot show is a measurement nobody can act on.
         *
         * Null distinguishes "this domain declares no relationships" — eighteen of twenty —
         * from a domain whose pairs were evaluated. It reports comparability ONLY. A pair
         * reading `eligible:true` has cleared the comparability gate and nothing else; no
         * pathway is active and the evidence gate is separate and still shut.
         */
        relationshipEvidence: cyc.relationshipEvidence || null
      } : null;
    }
    return send(res, 200, {
      ok: true,
      runtime: RUNTIME.RUNTIME_VERSION,
      namespace: STORE.PREFIX,
      note: 'shadow only: no outward actuation, no production brain state, no site consumer. ' +
            'Installed names execution; domainFunction reports what the cycle actually sensed, emitted and graded. ' +
            'Neither activates a relationship.',
      installed: installed,
      installedCount: installed.length,
      /* TOTAL, NOT BOUND. This field was called `boundCount` and was `DOMAINS.length`, which
         is the size of the canonical roster and would keep reading 20 after a binder stopped
         loading or a fixture became unreadable. Binding is a per-domain classification the
         registry computes by opening every fixture, and this endpoint does not do that: it
         reads cycle reports. So it reports the roster size, under the name of the thing it
         actually knows. */
      totalDomains: REG.DOMAINS.length,
      /* Named `measuredDomains` rather than left implicit: a total over 3 of 7 domains and a
         total over 7 of 7 are different numbers and must not look alike. */
      stateValueBytesTotal: totalStateValueBytes,
      stateValueBytesMeasuredDomains: measured,
      cycles: out
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: (e && e.message) || String(e) });
  }
};
