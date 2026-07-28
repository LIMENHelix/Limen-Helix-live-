/**
 * handlers/brain-weights-cron.js — server-side weight persistence. THE MISSING HOP.
 *
 * GET /api/brain-weights-cron        → advance + persist every domain's modulator
 * GET /api/brain-weights-cron?dry=1  → compute and report, write nothing
 *
 * WHY THIS EXISTS (2026-07-28). Every other stage of the regulation loop is server-side and
 * self-sustaining. This one was not: `brainwts:<domain>` was only ever written by
 * domain-brain-base.js:_persistDomainPlasticity, which runs in a BROWSER TAB. So learning
 * persisted only while somebody had the site open. Measured before this existed: the newest
 * weight snapshot was 9 hours old, the rest 15, and NOT ONE had been written since the credit
 * gate was corrected earlier the same day. The loop could not close on its own, and the reason
 * was not the maths, it was that nothing on a schedule ever wrote the result down.
 *
 * WHAT IT ADVANCES, AND WHAT IT DELIBERATELY DOES NOT.
 * It advances the MODULATOR — the part that carries the external learning signal — because that
 * is the part driven by the resolver, which is server-side truth. It does NOT touch the K-layer
 * weights: those are updated by `tick`/`applyModulator` against the live per-cycle domain
 * signals a browser brain computes, and this process does not have them. Layers are carried
 * through from the stored snapshot verbatim. Inventing layer dynamics here to make the snapshot
 * look richer would be exactly the fabrication the rest of this system refuses.
 *
 * IT CANNOT REINTRODUCE THE BAD REWARD. Credit comes from the same two gates the brains use:
 *   - eligibility: limen-k4-selfconsistency.credit() is passed `domain` and fails closed, so
 *     only finance and energy can ever reach tier 4.
 *   - skill: reward is withheld unless the resolver reports skill > 0, and the magnitude is the
 *     normalized skill score (hit - base)/(1 - base), so a flat series that scores 1.0 by calling
 *     "stable" forever earns nothing. That is the defect this system spent a day removing; it is
 *     not going to be re-opened by a cron.
 *
 * `readModulator` only advances when resolvedCount EXCEEDS the stored lastResolvedSamples, so
 * running this every 15 minutes does not manufacture learning events. Ticks with no new resolved
 * outcome are no-ops that simply restamp. Everything stays mode:'shadow'.
 *
 * SECURITY: writes are gated on BRAIN_WEIGHTS_TOKEN being configured — the same operator opt-in
 * that gates the POST path, because durable learning is meant to be one switch. Unset means
 * compute-and-report, never a silent write. GET is open; it stores calibration state only, and
 * nothing here acts, spends, files, or contacts anyone.
 */

var db = require('../lib/limen-db');
var resolver = require('../lib/feed-resolver');
var DOMAIN_NAMES = require('../lib/domain-names');
var P = require('../assets/js/limen-plasticity.js');
var K4 = require('../assets/js/limen-k4-selfconsistency.js');

var TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || '';
var HIST_CAP = 200;
var FCAP = 720, RCAP = 2160;
var MIN_RESOLVED = 5;             // matches GP_MIN_EXT in the brains: below this, abstain

var DOMAINS = ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'health', 'industry', 'infrastructure',
  'intelligence', 'law', 'population', 'religion', 'research', 'supplyChain', 'technology'];

/**
 * The SAME credit derivation the two brains use, kept in one shape here so the server and the
 * browser cannot drift into rewarding different things. Returns null to abstain.
 */
function creditFromResolve(out) {
  if (!out) return null;
  var hit = (typeof out.externalHitRate === 'number') ? out.externalHitRate : null;
  var base = (typeof out.alwaysStableRate === 'number') ? out.alwaysStableRate : null;
  var skill = (typeof out.skill === 'number') ? out.skill : null;
  if (hit === null || base === null || skill === null || !(skill > 0)) return null;
  var head = 1 - base;
  if (!(head > 1e-9)) return null;
  return Math.round(Math.max(0, Math.min(1, (hit - base) / head)) * 10000) / 10000;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('content-type', 'application/json');
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var dry = !!q.dry;
  var canWrite = !!TOKEN && !dry;

  var out = [], wrote = 0, advanced = 0, abstained = 0, errors = 0;

  for (var i = 0; i < DOMAINS.length; i++) {
    var dom = DOMAINS[i];
    try {
      var storeKey = DOMAIN_NAMES.toRuntime(dom);

      // 1. External outcome, from the recorder — server-side truth, independent of any weights.
      var forecasts = (await db.lrange('forecasthist:' + storeKey, 0, FCAP - 1)) || [];
      var recorder = (await db.lrange('feedhist:' + storeKey, 0, RCAP)) || [];
      var resolved = resolver.resolve(forecasts, recorder, { now: Date.now(), model: resolver.FORECAST_MODEL });

      // 2. Credit, through both gates.
      var credit = creditFromResolve(resolved);
      var extOutcome = (credit !== null && (resolved.resolvedCount || 0) >= MIN_RESOLVED) ? { hit: credit } : null;
      var k4 = K4.credit({ domain: storeKey, externalOutcome: extOutcome });

      // 3. Hydrate the stored modulator, advance it, carry the layers through untouched.
      var prev = await db.get('brainwts:' + storeKey);
      var mod = P.createModulator();
      if (prev) P.hydrateModulator(mod, prev);
      var before = mod.events;
      var read = P.readModulator(mod, k4, resolved.resolvedCount || 0);
      var didAdvance = mod.events > before;

      var snapshot = {
        version: P.version, t: Date.now(), mode: 'shadow',
        isReward: !!read.isReward, creditSource: read.creditSource || 'none',
        modulator: { baseline: mod.baseline, lastResolvedSamples: mod.lastResolvedSamples,
          lastCredit: mod.lastCredit, events: mod.events },
        // Layers are the browser's to update; preserved exactly as stored, never synthesised.
        layers: (prev && prev.layers) || {},
        meta: { domain: dom, storeKey: storeKey, source: 'server-cron', rpe: read.rpe,
          resolvedCount: resolved.resolvedCount || 0, skill: resolved.skill,
          hitRate: resolved.externalHitRate, baseline: resolved.alwaysStableRate,
          forecastModel: resolved.model, layersFrom: (prev && prev.layers) ? 'stored' : 'none' }
      };

      if (canWrite) {
        await db.set('brainwts:' + storeKey, snapshot);
        if (didAdvance) {                                  // history records LEARNING events only,
          await db.lpush('brainwts:hist:' + storeKey, snapshot);   // not every idempotent restamp
          await db.ltrim('brainwts:hist:' + storeKey, 0, HIST_CAP - 1);
        }
        wrote++;
      }
      if (didAdvance) advanced++;
      if (extOutcome === null) abstained++;

      out.push({ domain: dom, storeKey: storeKey, resolved: resolved.resolvedCount || 0,
        skill: resolved.skill, credit: credit, tier: k4.tier, isReward: !!k4.isReward,
        creditSource: k4.creditSource, rpe: read.rpe, advanced: didAdvance, events: mod.events });
    } catch (e) {
      errors++;
      out.push({ domain: dom, error: e.message });
    }
  }

  return res.status(200).json({
    ok: true, mode: dry ? 'dry-run' : (canWrite ? 'write' : 'compute-only'),
    reason: canWrite ? undefined : (dry ? 'dry=1' : 'BRAIN_WEIGHTS_TOKEN not set — computed, not written'),
    domains: DOMAINS.length, wrote: wrote, advanced: advanced, abstained: abstained, errors: errors,
    forecastModel: resolver.FORECAST_MODEL, results: out, backend: db.getBackend()
  });
};
