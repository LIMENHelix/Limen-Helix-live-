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

  (spec.findings || []).forEach(function (f) {
    if (!f.id) throw new Error('binder ' + spec.domain + ': every finding needs an id');
    (f.requires || []).forEach(function (k) {
      if (!seen[k]) {
        throw new Error('binder ' + spec.domain + ': finding ' + f.id + ' requires channel "' + k +
          '", which this domain does not declare. It could never fire, and a rule that cannot ' +
          'fire is indistinguishable from one that found nothing.');
      }
    });
    if (typeof f.test !== 'function') throw new Error('binder ' + spec.domain + ': finding ' + f.id + ' needs a test');
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
  var FINDINGS = spec.findings || [];

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
       * `v` FOR EVERY CHANNEL, INCLUDING recent7d ONES — matching the hand-written
       * energy binder exactly, and NOT quietly "improved" while refactoring.
       *
       * There is a real asymmetry here and it is being reported rather than fixed:
       * readLive() honours `field: 'recent7d'`, while this path reads `v` for
       * everything. Branching on the field here looks like the obvious correction and
       * would have been a silent disaster — the recorder only began storing `r7` on
       * 2026-08-01 and the energy fixture predates it, so of 6516 recorded source
       * entries exactly 0 carry `r7` and 5682 carry `v`. The "fix" would have dropped
       * all thirteen news-derived channels to nothing and changed every number the
       * scorecard quotes against this fixture.
       *
       * Whether replay should follow `field` is a real question with a real answer, and
       * the answer needs a fixture recorded after `r7` existed. Until then this path
       * stays byte-compatible with what produced the measurements on record.
       */
      var v = (typeof s.v === 'number' && isFinite(s.v)) ? s.v : null;
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

module.exports = { createBinder: createBinder, pickLive: pickLive, validate: validate };
