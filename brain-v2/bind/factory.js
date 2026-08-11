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
   */
  function readRecorderRow(row) {
    var byName = {};
    (row && row.src || []).forEach(function (s) { byName[s.n] = s; });
    var out = {};
    CHANNELS.forEach(function (c) {
      var s = byName[c.name];
      if (!s) return;
      /**
       * THE DECLARED KEY, not a universal `v` and not a guess from `field`.
       *
       * Energy declares `recordedField: 'v'` on all eighteen channels, including its
       * thirteen recent7d ones, and that is a DELIBERATE legacy declaration rather than a
       * default: the recorder only began storing `r7` on 2026-08-01 and the energy
       * fixture predates it, so 0 of its 6516 source entries carry `r7` and 5682 carry
       * `v`. Reading `r7` there would drop those thirteen channels to nothing and change
       * every number the scorecard quotes.
       *
       * A domain recorded after that date declares `recordedField: 'r7'` and gets the
       * un-saturated count. Because the choice is written down per channel, the two cases
       * are distinguishable instead of one silently masquerading as the other.
       */
      var raw = s[c.recordedField];
      var v = (typeof raw === 'number' && isFinite(raw)) ? raw : null;
      if (v === null) return;
      var r = { value: v };
      if (s.su !== undefined && s.su !== null && s.su !== '') r.observationId = s.su;
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
