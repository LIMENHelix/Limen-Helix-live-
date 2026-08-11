/**
 * brain-v2/bind/factory.js — one binder mechanism, many domains.
 *
 * WHY THIS EXISTS. `bind/energy.js` was written by hand, and the honest reading of it is
 * that roughly nine tenths is mechanism — read a snapshot, read a recorded row, pick the
 * declared field, assemble a spec — and one tenth is the part that is actually about
 * energy. Copying that file nineteen times would copy nineteen chances for the mechanism
 * to drift apart domain by domain, and every past defect in this project that took a
 * session to find was a place where two copies of one idea disagreed.
 *
 * So the mechanism lives here once and each domain declares only what is true of itself.
 *
 * ENERGY IS THE COMPATIBILITY REFERENCE. `bind/energy.js` now calls this factory, and
 * `test/domains.js` asserts its `spec()` is byte-identical to the hand-written manifest
 * it replaced. A factory that quietly changed the one domain with a real fixture behind
 * it would invalidate every measurement already quoted against that fixture.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS REFUSES, AND WHY REFUSAL IS THE POINT
 *
 * A relationship naming a channel the domain does not declare is not a typo to be
 * tolerated — it is a claim about two things observing one latent where one of them does
 * not exist. Divergence would skip it forever and report silence, which reads as
 * agreement. The same holds for a finding that tests a channel nobody declared: it can
 * never fire, and a rule that can never fire is indistinguishable from a rule that never
 * found anything.
 *
 * Both throw at construction. It is deliberately impossible to declare a relationship
 * between channels that do not exist, which is the structural half of "do not fabricate
 * relationships" — the other half is judgement, and no code enforces that.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FORMS = require('./diagnosis-forms.js');   // the reviewed interpreter for declarative diagnoses

/**
 * Pull the declared field out of a live snapshot source.
 *
 * `field` is the honest part of a channel declaration: 'recent7d' where the raw count
 * saturates (a news query returns a full page, so `value` is pinned at 100 forever) and
 * 'value' where the number is a real quantity that moves.
 */
function pickLive(src, field) {
  if (!src) return null;
  if (field === 'recent7d') {
    return (src.rss && typeof src.rss.recent7d === 'number') ? src.rss.recent7d : null;
  }
  return (typeof src.value === 'number' && isFinite(src.value)) ? src.value : null;
}

/**
 * The numeric carriers handlers/feed-record.js actually writes per source. A channel must
 * name which one holds its value; validating against this list turns a typo into a throw
 * instead of a channel that silently reads `undefined` forever.
 *
 *   v   the source's own `value`            r7  rss.recent7d      r1  rss.recent24h
 *   s   stress          a  activity         q   quality
 *   hc  headline count  ma  median age (days)
 */
var RECORDED_FIELDS = ['v', 'r7', 'r1', 's', 'a', 'q', 'hc', 'ma'];

function validate(spec) {
  if (!spec || !spec.domain) throw new Error('binder: a domain needs a name');
  if (!Array.isArray(spec.channels) || !spec.channels.length) {
    throw new Error('binder ' + spec.domain + ': a domain with no declared channels cannot observe anything');
  }

  var seen = Object.create(null);
  spec.channels.forEach(function (c) {
    if (!c.key) throw new Error('binder ' + spec.domain + ': every channel needs a key');
    if (!c.name) throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' needs the source name it is read by');
    if (seen[c.key]) throw new Error('binder ' + spec.domain + ': duplicate channel key ' + c.key);
    seen[c.key] = true;
    /* CADENCE IS MANDATORY. core/channel.js grows uncertainty in units of the channel's
       own period and abstains when it cannot infer one; a channel with no declared
       cadence has no prior to abstain to, so the horizon it produces means nothing. */
    if (typeof c.cadenceMs !== 'number' || !(c.cadenceMs > 0)) {
      throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' must declare its own cadence');
    }
    if (!c.units) throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' must declare units — an unlabelled number cannot be compared to anything');
    if (!c.source) throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' must declare where the number comes from (R1)');
    /**
     * RECORDED FIELD IS MANDATORY AND EXPLICIT, and the reason is a defect this file
     * shipped with. The first version read `s.v` for EVERY channel, including ones
     * declared `field: 'recent7d'` — correct for the energy fixture, which predates the
     * recorder storing `r7`, and silently wrong for every domain recorded after it. A
     * probe of `{v:1, r7:9}` on a recent7d channel returned 1.
     *
     * The fix is not to infer it from `field`. `field` says which value the LIVE snapshot
     * carries; `recordedField` says which key the RECORDER wrote. They coincide for new
     * data and deliberately do not for energy, whose fixture only ever carried `v`. Two
     * different questions, so two declarations, and neither is guessed from the other.
     */
    if (!c.recordedField) {
      throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' must declare `recordedField` — ' +
        'which key handlers/feed-record.js wrote its value under. Inferring it from `field` is what ' +
        'made every recent7d channel silently read the saturated `v` instead of `r7`.');
    }
    if (RECORDED_FIELDS.indexOf(c.recordedField) < 0) {
      throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' declares recordedField "' +
        c.recordedField + '", which the recorder never writes. Legal: ' + RECORDED_FIELDS.join(', '));
    }
    /**
     * A LEGACY FALLBACK IS A SECOND QUANTITY, AND THE DECLARATION HAS TO SAY SO.
     *
     * `recordedFieldLegacy` exists for a channel that spans two recorder eras: `r7` after
     * 2026-08-01 and only `v` before it. Those are not the same measurement wearing
     * different names. `r7` counts articles in the last seven days; `v` is the raw page
     * count, which saturates at 100 and stops moving. Reading one where the other is
     * expected is the "two instruments under one channel key" error, and the only thing
     * that keeps it visible is being forced to name the other instrument's units.
     *
     * So declaring a fallback without `legacyUnits` throws. It is deliberately impossible
     * to add an era boundary silently.
     */
    if (c.recordedFieldLegacy !== undefined) {
      if (RECORDED_FIELDS.indexOf(c.recordedFieldLegacy) < 0) {
        throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' declares recordedFieldLegacy "' +
          c.recordedFieldLegacy + '", which the recorder never writes. Legal: ' + RECORDED_FIELDS.join(', '));
      }
      if (c.recordedFieldLegacy === c.recordedField) {
        throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' declares the same key as both ' +
          'current and legacy recorded field. A fallback to itself is not a fallback.');
      }
      if (!c.legacyUnits) {
        throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' declares a legacy recorded field ' +
          'but no `legacyUnits`. The fallback is a DIFFERENT QUANTITY from `units`, and a history that ' +
          'spans both must be able to say so. Naming it is what keeps the era boundary visible.');
      }
    } else if (c.legacyUnits !== undefined) {
      throw new Error('binder ' + spec.domain + ': channel ' + c.key + ' declares legacyUnits with no ' +
        'recordedFieldLegacy to describe.');
    }
  });

  (spec.relationships || []).forEach(function (r) {
    ['a', 'b'].forEach(function (side) {
      if (!seen[r[side]]) {
        throw new Error('binder ' + spec.domain + ': relationship "' + r.latent + '" names channel "' +
          r[side] + '", which this domain does not declare. A relationship to a channel that ' +
          'does not exist can never be compared, and divergence would report its silence as agreement.');
      }
    });
    if (!r.latent) throw new Error('binder ' + spec.domain + ': every relationship must name the latent both channels observe');
  });

  /**
   * FINDINGS ARE DECLARATIVE ENTRIES, NOT FUNCTIONS.
   *
   * They used to be `test: function (v, s, d) {...}` stored beside the declaration. bind/
   * diagnosis-forms.js now owns the arithmetic and bind/diagnosis-registry.js owns the
   * definitions, so what arrives here is data naming one of ten reviewed forms. The checks
   * that used to live in this loop — an id, and requirements that name real channels — are
   * still enforced, by that validator, alongside the ones only a bounded grammar can make:
   * a known form, the right operand count, and a threshold that was actually reviewed.
   *
   * The `requires`-names-a-real-channel rule is unchanged in meaning and still throws for
   * the same reason: a rule that can never fire is indistinguishable from one that never
   * found anything.
   */
  (spec.findings || []).forEach(function (f) {
    FORMS.validate(spec.domain, f, seen);
  });

  return seen;
}

/**
 * Build a binder from a domain declaration.
 *
 * Returns the same shape `bind/energy.js` has always exported, so every existing caller
 * keeps working and a domain can be swapped in without any consumer knowing which
 * mechanism produced it.
 */
function createBinder(spec) {
  validate(spec);

  var CHANNELS = spec.channels;
  var REL = spec.relationships || [];

  /**
   * COMPILE the declarative entries into what core/brain.js calls.
   *
   * The closure is built by reviewed code (diagnosis-forms.compile) from data that never
   * carried behaviour. Compilation happens HERE, at construction, and not lazily at
   * evaluation, because core/brain.js wraps every test in a try/catch that turns a throw
   * into "did not fire" — a malformed entry discovered there would report as a calm domain.
   * Built at construction, it refuses to build the binder at all.
   *
   * THE RUNTIME SHAPE IS DELIBERATELY THE OLD ONE: id, requires, basis, test, in that order
   * and nothing else. `spec()` returns this same array, it is serialised into stored brain
   * specs, and test/domains.js hashes it as the compatibility guarantee for the one domain
   * with a real fixture. This migration changed how a diagnosis is WRITTEN, not what any
   * domain declares, so the serialised declaration must not move. Copying the entry's form,
   * operands and thresholds onto the runtime object would change that payload everywhere
   * without changing a single decision.
   *
   * The declarative fields are not lost by this: they live in bind/diagnosis-registry.js,
   * which is where a reader should look for them. If the published spec ever should carry
   * the form, that is a real change to what the system says about itself and belongs in a
   * review with a hash change attached, not as a side effect of a refactor.
   */
  var FINDINGS = (spec.findings || []).map(function (f) {
    var runtime = { id: f.id };
    if (f.requires !== undefined) runtime.requires = f.requires;
    if (f.basis !== undefined) runtime.basis = f.basis;
    runtime.test = FORMS.compile(spec.domain, f);
    return runtime;
  });

  /** Readings for one cycle from a live /api/domain-snapshot domain object. */
  function readLive(domainObj) {
    var byName = {};
    (domainObj && domainObj.sources || []).forEach(function (s) { byName[s.name] = s; });
    var out = {};
    CHANNELS.forEach(function (c) {
      var src = byName[c.name];
      var v = pickLive(src, c.field);
      if (v === null) return;
      var r = { value: v };
      /* SOURCE-SUPPLIED OBSERVATION IDENTITY. The only field core/channel.js will count
         evidence from; absent when the source did not supply one, and absent must stay
         absent rather than be filled from our own clock. */
      if (src && src.sourceUpdatedAt !== undefined && src.sourceUpdatedAt !== null && src.sourceUpdatedAt !== '') {
        r.observationId = String(src.sourceUpdatedAt);
      }
      out[c.key] = r;
    });
    return out;
  }

  /**
   * Readings from one row recorded by handlers/feed-record.js.
   *
   * `su` is the source's own observation key. Rows recorded before the recorder kept it
   * carry none, and those genuinely cannot say whether the source published — null there
   * means "cannot tell", never "no new data".
   *
   * ── THREE SEPARATE FACTS, and collapsing any two of them is the error this comment
   * exists to prevent ────────────────────────────────────────────────────────────────
   *
   *   observationId  the SOURCE'S identity for the observation (`su`). Says WHICH
   *                  observation. Same token means the same observation.
   *   (reference time) WHEN the observation refers to. Derived downstream from the
   *                  identity against a declared reference interval; not a field here.
   *   recordedAt     WHEN WE RECEIVED IT — `row.t`, stamped by handlers/feed-record.js at
   *                  write time. OUR clock, deliberately, because receipt ORDER is a fact
   *                  about the recorder and only the recorder can be its authority.
   *
   * `recordedAt` IS NOT EVIDENCE OF ANYTHING THE SOURCE DID. It cannot say a source
   * published something new; that is `observationId`'s job and the two must never stand in
   * for each other. Its one purpose is ordering: when one identity carries two different
   * values, receipt order is what distinguishes a REVISION from a simultaneous
   * contradiction. Measured 2026-08-09: Alpha Vantage restates its session close under an
   * unchanged identity about two hours later, so without this the two are indistinguishable
   * and both have to abstain.
   *
   * TAKEN FROM THE ROW, never from a clock read here and never from the caller. A row is
   * the thing that was received, so it carries its own receipt time; synthesising one at
   * read time would order rows by when they were REPLAYED, which is array order wearing a
   * timestamp. A row with no usable `t` gets no `recordedAt` and downstream must treat that
   * as "cannot order", not as "first" or "last".
   */
  function readRecorderRow(row) {
    var byName = {};
    (row && row.src || []).forEach(function (s) { byName[s.n] = s; });
    var recordedAt = (row && typeof row.t === 'number' && isFinite(row.t)) ? row.t : null;
    var out = {};
    CHANNELS.forEach(function (c) {
      var s = byName[c.name];
      if (!s) return;
      /**
       * THE DECLARED KEY, not a universal `v` and not a guess from `field`, and where a
       * channel spans two recorder eras, the CURRENT key in preference to the legacy one.
       *
       * The recorder began storing `r7` (rss.recent7d) on 2026-08-01. Rows written before
       * that date carry only `v`, the raw article count, which saturates at the Google News
       * page size: measured in production 2026-08-11, nine of energy's eleven news channels
       * sat at exactly 100 while their live `recent7d` ranged from 0 to 29. A channel that
       * declares `field: 'recent7d'` live and reads `v` when replayed is therefore not
       * reading a stale number, it is reading a DIFFERENT QUANTITY, and the two disagree by
       * 52 to 100 on those same channels.
       *
       * So a channel may declare both: `recordedField` for the current era and
       * `recordedFieldLegacy` for rows that predate it. The current key wins whenever the
       * row actually carries it.
       *
       * PRESENCE IS `typeof number`, NOT TRUTHINESS, and this is the whole defect in one
       * line. `s.r7 || s.v` reads a recorded `r7` of 0 as absent and silently substitutes
       * the saturated legacy count. Zero articles in seven days is a real and meaningful
       * reading — energy's `gridRel` published exactly that in production on 2026-08-11
       * while its `v` said 100 — and a fallback that cannot tell "none" from "not recorded"
       * inverts the quietest signal the channel has.
       *
       * WHICH KEY WAS USED IS REPORTED, because the two eras are different quantities and a
       * history that silently mixes them is the "two instruments under one channel key"
       * error this codebase has made before. Downstream can see the boundary; it is not
       * hidden inside a number.
       */
      var raw = s[c.recordedField];
      var usedField = c.recordedField;
      var v = (typeof raw === 'number' && isFinite(raw)) ? raw : null;
      if (v === null && c.recordedFieldLegacy) {
        var legacyRaw = s[c.recordedFieldLegacy];
        if (typeof legacyRaw === 'number' && isFinite(legacyRaw)) {
          v = legacyRaw;
          usedField = c.recordedFieldLegacy;
        }
      }
      if (v === null) return;
      var r = { value: v, recordedFieldUsed: usedField };
      if (s.su !== undefined && s.su !== null && s.su !== '') r.observationId = s.su;
      /* Attached per reading rather than once per tick, because a reading is what travels
         downstream; the tick's time is not carried on the thing that gets compared. */
      if (recordedAt !== null) r.recordedAt = recordedAt;
      out[c.key] = r;
    });
    return out;
  }

  return {
    domain: spec.domain,
    CHANNELS: CHANNELS,
    RELATIONSHIPS: REL,
    FINDINGS: FINDINGS,
    SIGMA: spec.sigma,
    readLive: readLive,
    readRecorderRow: readRecorderRow,
    spec: function () {
      return {
        domain: spec.domain,
        version: spec.version,
        levelsPerSensor: spec.levelsPerSensor,
        channels: CHANNELS,
        findings: FINDINGS,
        relationships: REL,
        /* R7: null says nothing consumes this domain's output yet, out loud. */
        efferent: spec.efferent === undefined ? null : spec.efferent
      };
    }
  };
}

module.exports = { createBinder: createBinder, pickLive: pickLive, validate: validate,
                   RECORDED_FIELDS: RECORDED_FIELDS };
