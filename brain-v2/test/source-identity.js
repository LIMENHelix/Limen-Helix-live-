/**
 * brain-v2/test/source-identity.js — the recording chain, SPEC row 10's blocker.
 *
 *   node brain-v2/test/source-identity.js
 *
 * WHAT THIS TESTS AND WHY IT IS NOT A UNIT TEST. Row 10 needs a divergence claim to
 * accumulate INDEPENDENT OBSERVATIONS rather than repeated polls. Whether it can is not a
 * property of divergence.js; it is a property of a five-step chain, and the chain was
 * broken in two places at once:
 *
 *   domain-snapshot   sets `sourceUpdatedAt` from the upstream record's own key
 *   feed-record       DROPPED IT — computed `ua` from `updated`/`fetchedAt` instead,
 *                     which are both Date.now() and are therefore our clock
 *   fixture           so every recorded row was a poll with no way to tell a fresh
 *                     observation from a re-read of a cached one
 *   bind/energy       had nothing to surface
 *   kernel/loop       rebuilt each reading as `{ value }` at the barrier, discarding any
 *                     identity an adapter did supply, one step before its only consumer
 *
 * Testing any single link passes while the chain stays broken, which is how this survived
 * a full session of work on row 10. So every assertion below runs the WHOLE path, from a
 * synthetic snapshot payload to the number divergence.js counts evidence from.
 *
 * NO LIVE FETCHES. The snapshot payloads here are constructed in-file, in the shape
 * handlers/domain-snapshot.js emits. That is deliberate and is also the only option: the
 * live path needs a deploy, a cron trigger, and an hour to elapse before it writes a
 * single row. What this proves is that the apparatus is correct; only recording over time
 * can produce the fixture row 10 actually needs.
 */

'use strict';

var fs = require('fs');
var FR = require('../../handlers/feed-record.js');
var BIND = require('../bind/energy.js');
var C = require('../core/channel.js');
var LOOP = require('../kernel/loop.js');
var D = require('../core/divergence.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var T0 = 1e12, HOUR = 3600000;

/** A source object in the shape handlers/domain-snapshot.js emits. */
function snapSource(name, value, sourceUpdatedAt, now) {
  var o = {
    name: name, channel: 'value', live: true, value: value,
    /* BOTH are Date.now() in the real snapshot. Reproduced faithfully, because the whole
       point is that these must NOT be mistaken for the source's own key. */
    updated: now, fetchedAt: now
  };
  if (sourceUpdatedAt !== undefined) o.sourceUpdatedAt = sourceUpdatedAt;
  return o;
}

console.log('');
console.log('=== SOURCE-SUPPLIED OBSERVATION IDENTITY: THE RECORDING CHAIN ===');
console.log('');

// ── S1: the recorder keeps the source's key, and invents nothing ─────────────
(function () {
  console.log('S1: the recorder preserves sourceUpdatedAt and fabricates nothing');
  var withId = FR._compactSource(snapSource('FRED Crude Oil', 79.2, '2026-07-30', T0), T0 + 500);
  assert('a source-supplied key is recorded', withId.su === '2026-07-30', String(withId.su));
  assert('and the value survives alongside it', withId.v === 79.2, String(withId.v));

  var noId = FR._compactSource(snapSource('Solar Industry News', 100, undefined, T0), T0 + 500);
  assert('a source with no key records NO key rather than a substitute',
    noId.su === undefined, String(noId.su));
  assert('but is still recorded — no identity is not a reason to drop a reading',
    noId.v === 100, String(noId.v));

  /* THE FIELD THAT LOOKS LIKE IDENTITY AND IS NOT. `ua` is derived from `updated`, which
     is our own Date.now(). It advances on every poll whether or not the source published
     anything, so counting evidence from it counts the scheduler. */
  assert('ua is still recorded as staleness', typeof noId.ua === 'number', String(noId.ua));
  assert('but ua moves with OUR clock while the source key does not', (function () {
    var a = FR._compactSource(snapSource('X', 1, '2026-07-30', T0), T0 + 1000);
    var b = FR._compactSource(snapSource('X', 1, '2026-07-30', T0), T0 + 9000);
    return a.ua !== b.ua && a.su === b.su;
  })(), 'ua differs across polls, su does not');

  var empty = FR._compactSource(snapSource('X', 1, '', T0), T0);
  assert('an empty key is treated as absent, not as the identity ""', empty.su === undefined);
})();

// ── S2: coverage is measured, not assumed ────────────────────────────────────
(function () {
  console.log('S2: identity coverage is measured per row');
  var row = FR._compactRow(T0, {
    stress: 0.4, activity: 0.5, confidence: 0.6, liveCount: 3,
    sources: [
      snapSource('FRED Crude Oil', 79.2, '2026-07-30', T0),
      snapSource('EIA Petroleum', 81.0, '2026-07-29', T0),
      snapSource('Solar Industry News', 100, undefined, T0)
    ]
  });
  var cov = FR._identityCoverage(row);
  assert('coverage counts the sources that carried a key', cov.withSourceIdentity === 2, JSON.stringify(cov));
  assert('against the total recorded', cov.sources === 3, JSON.stringify(cov));
})();

// ── S3: the brain side reads it back ─────────────────────────────────────────
(function () {
  console.log('S3: a recorded row surfaces identity to the channel layer');
  var row = FR._compactRow(T0, {
    stress: 0.4, sources: [
      snapSource('FRED Crude Oil', 79.2, '2026-07-30', T0),
      snapSource('Solar Industry News', 100, undefined, T0)
    ]
  });
  var readings = BIND.readRecorderRow(row);
  assert('the identified channel carries observationId',
    readings.fredCrude && readings.fredCrude.observationId === '2026-07-30',
    JSON.stringify(readings.fredCrude));
  assert('the unidentified one carries none, rather than a placeholder',
    readings.solar && readings.solar.observationId === undefined,
    JSON.stringify(readings.solar));

  /* And the channel layer turns it into the one field a consumer may count from. */
  var ch = C.createChannel({ key: 'fredCrude', cadenceMs: 24 * HOUR });
  var out = C.step(ch, readings.fredCrude, T0);
  assert('channel.sourceIdentity() resolves it', out.sourceIdentity === 'oid:2026-07-30', String(out.sourceIdentity));
  var ch2 = C.createChannel({ key: 'solar', cadenceMs: 24 * HOUR });
  assert('and stays null when the source gave nothing — null means CANNOT TELL',
    C.step(ch2, readings.solar, T0).sourceIdentity === null);
})();

// ── S4: THE BREAK THAT MATTERED. Identity must survive the loop's barrier ────
(function () {
  console.log('S4: identity survives the kernel barrier, which used to discard it');
  var loop = LOOP.create({ domain: 'energy', brainSpec: BIND.spec(), horizonMs: 6 * HOUR });
  var rep = loop && LOOP.tick(loop, {
    fredCrude: { value: 79.2, eventTime: T0, observationId: '2026-07-30' },
    solar: { value: 100, eventTime: T0 }
  }, T0);

  var ch = loop.brain.channels.filter(function (c) { return c.key === 'fredCrude'; })[0];
  assert('the channel received the adapter-supplied key through the whole loop',
    ch.lastSourceIdentity === 'oid:2026-07-30', String(ch.lastSourceIdentity));

  /* The barrier must SEE the identity, not have it bolted on afterwards: it travels
     inside the packet payload and is therefore inside the provenance hash. */
  var obs = (rep.steps.filter(function (s) { return s.step === 'barrier'; })[0]) || {};
  assert('and it was admitted, not rejected', obs.admitted >= 2, JSON.stringify(obs.admitted));

  var un = loop.brain.channels.filter(function (c) { return c.key === 'solar'; })[0];
  assert('a channel whose source gave no key reports null, never a synthesised one',
    un.lastSourceIdentity === null, String(un.lastSourceIdentity));
})();

// ── S5: THE PAYOFF. Independent observations, not repeated polls ─────────────
(function () {
  console.log('S5: the ledger counts observations, and a re-poll is not one');
  /**
   * THE REAL SHAPE, which a first version of this test got wrong. It polled one
   * unchanged value ten times and expected `updates` to reach 10; it reaches 6, because
   * a channel whose value never moves is correctly declared DEAD at the seventh identical
   * sample and stops being observed at all. That is the system behaving properly, not a
   * defect, and a test that expected otherwise was asserting against the requirement.
   *
   * The case row 10 actually cares about is a DAILY source polled HOURLY: constant
   * within a day, so the channel stays alive on the day-to-day movement, while every
   * intra-day poll is a re-read of a value the source has not republished. Three days,
   * five polls each: fifteen polls, three observations.
   */
  var ch = C.createChannel({ key: 'k', cadenceMs: 24 * HOUR });
  var ids = [];
  for (var d = 0; d < 3; d++) {
    for (var h = 0; h < 5; h++) {
      var out = C.step(ch, { value: 79 + d, observationId: '2026-07-' + (28 + d) },
                       T0 + (d * 24 + h) * HOUR);
      if (out.sourceIdentity) ids.push(out.sourceIdentity);
    }
  }
  var distinct = ids.filter(function (v, i, a) { return a.indexOf(v) === i; });
  assert('fifteen polls advance `updates` fifteen times — it counts the scheduler',
    ch.updates === 15, String(ch.updates));
  assert('but they carry only THREE distinct source identities, one per publication',
    distinct.length === 3, JSON.stringify(distinct));
  /* Not `=== 'live'`: liveness samples are decimated to the channel's own cadence, so a
     daily channel watched for three days has three samples and correctly reports
     `unknown` rather than claiming a verdict from too little. What matters here is that
     it never went DEAD, so every poll reached observe(). */
  assert('the channel never went dead, so every poll reached observe()',
    C.liveness(ch) !== 'dead' && ch.updates === 15, C.liveness(ch) + ' updates=' + ch.updates);

  /* And divergence.js consumes exactly this. Two sensors sharing an identity have made
     one joint observation, however many times they were polled — which is the property
     `persistent` resolution depends on, since "we waited long enough" is meaningless if
     the waiting was measured in polls. */
  function sensor(k, z, oid) {
    return { key: k, fusable: true, precision: 1, state: 'measured',
             sourceIdentity: oid === null ? null : 'oid:' + oid,
             cadenceMs: HOUR, cadence: { state: 'measured', cadenceMs: HOUR },
             departure: { z: z, mean: 0.5, sd: 0.1, n: 24 } };
  }
  var rel = [D.relate('a', 'b', 'crude oil price level', 'agree', 'test')];
  var ledger = D.createLedger();
  for (var p = 0; p < 8; p++) {
    D.observe(ledger, [sensor('a', -1.8, 'D1'), sensor('b', 2.4, 'D1')], rel, T0 + p * HOUR);
  }
  var keys = Object.keys(ledger.open);
  assert('a divergence opens exactly once across eight polls', keys.length === 1, JSON.stringify(keys));
  var claim = ledger.open[keys[0]];
  assert('and records ONE observation, because the source key never moved',
    claim.observations === 1, claim.observations + ' observations from 8 polls');

  /**
   * Now let the source actually publish. Five new keys, then keep polling: the claim
   * accumulates one observation per publication and resolves on its own derived horizon.
   *
   * An earlier version asserted the claim was STILL OPEN here and read `undefined` when
   * it was not. It had not failed — it had done its job. Resolution is the outcome worth
   * asserting, and asserting "still open" would have made a correct resolution look like
   * a defect.
   */
  var resolution = null;
  for (var q = 0; q < 6; q++) {
    var r2 = D.observe(ledger, [sensor('a', -1.8, 'D' + (q + 2)), sensor('b', 2.4, 'D' + (q + 2))],
                       rel, T0 + (8 + q) * HOUR);
    if (r2.resolved.length) resolution = r2.resolved[0];
  }
  assert('the claim resolves once, on its own derived horizon', !!resolution,
    'still open after 14 polls');
  assert('and it resolves HONESTLY as persistent, not as agreement',
    resolution && resolution.resolution.outcome === D.OUTCOME.PERSISTENT,
    resolution ? resolution.resolution.outcome : 'n/a');
  /* THE NUMBER THE WHOLE CHAIN EXISTS FOR: 14 polls, 6 observations. Before the recorder
     kept the source key there was no way to tell those apart, so `persistent` could
     resolve from re-reads of one cached value and call it corroboration. */
  assert('from 14 polls it counted exactly 6 independent observations',
    resolution && resolution.observations === 6,
    resolution ? resolution.observations + ' observations from 14 polls' : 'n/a');
  assert('which is the minimum the outcome requires, met by publications not polls',
    resolution && resolution.observations >= D.MIN_OBSERVATIONS,
    'MIN_OBSERVATIONS=' + D.MIN_OBSERVATIONS);

  /* THE CONTROL. With no source identity at all the ledger must not silently fall back
     to counting polls — that would be the original defect wearing the fix's name. */
  var blind = D.createLedger();
  for (var b2 = 0; b2 < 8; b2++) {
    D.observe(blind, [sensor('a', -1.8, null), sensor('b', 2.4, null)], rel, T0 + b2 * HOUR);
  }
  var bk = Object.keys(blind.open);
  assert('with NO identity the claim still opens once',
    bk.length === 1, JSON.stringify(bk));
  assert('and does not accumulate eight observations from eight polls',
    blind.open[bk[0]].observations < 8,
    blind.open[bk[0]].observations + ' observations from 8 identity-less polls');
})();

// ── S6: old rows still work, and say what they cannot say ────────────────────
(function () {
  console.log('S6: rows recorded before the fix stay readable and report honestly');
  var legacy = { t: T0, s: 0.4, src: [{ n: 'FRED Crude Oil', v: 79.2, l: 1, ch: 'value' }] };
  var readings = BIND.readRecorderRow(legacy);
  assert('the value still reads', readings.fredCrude.value === 79.2);
  assert('and identity is absent rather than back-filled from our own clock',
    readings.fredCrude.observationId === undefined, JSON.stringify(readings.fredCrude));
  var ch = C.createChannel({ key: 'fredCrude', cadenceMs: 24 * HOUR });
  assert('so the channel reports null — cannot tell, not "no new data"',
    C.step(ch, readings.fredCrude, T0).sourceIdentity === null);
})();

// ── S7: a DERIVED observation needs a COMPOSITE identity ─────────────────────
(function () {
  console.log('S7: an observation derived from two records is identified by both');
  var DS = require('../../handlers/domain-snapshot.js');
  var ci = DS._compositeIdentity;

  /**
   * THE DEFECT THIS GUARDS. The Treasury yield-curve value is Bills MINUS Notes, and the
   * first version identified it by the Bills record date alone. A Notes publication then
   * moves the value while the identity stays put, so a genuinely new derived observation
   * reads as a re-read of one already counted — the exact poll-versus-observation
   * confusion the source key exists to remove, reintroduced one level up where it is
   * harder to see, and on the side that happened not to be sampled first.
   */
  var base = ci([['bills', '2026-07-30'], ['notes', '2026-07-29']]);
  assert('both components appear in the identity', base === 'bills:2026-07-30|notes:2026-07-29', String(base));

  var notesMoved = ci([['bills', '2026-07-30'], ['notes', '2026-07-31']]);
  assert('a publication on the SECOND record changes the identity', notesMoved !== base,
    base + ' vs ' + notesMoved);
  var billsMoved = ci([['bills', '2026-07-31'], ['notes', '2026-07-29']]);
  assert('a publication on the first record changes it too', billsMoved !== base,
    base + ' vs ' + billsMoved);
  assert('and the two are distinguishable from each other', notesMoved !== billsMoved,
    notesMoved + ' vs ' + billsMoved);

  /* Labelled, so component values cannot be transposed into a collision. */
  assert('labels prevent a swap from colliding',
    ci([['bills', 'A'], ['notes', 'B']]) !== ci([['bills', 'B'], ['notes', 'A']]));

  /* Complete, or nothing. A composite with a hole cannot represent the derived value:
     changes in the absent component would be invisible, which is worse than admitting we
     cannot tell — absent identity is handled correctly everywhere downstream. */
  assert('a missing component yields NO identity rather than a partial one',
    ci([['bills', '2026-07-30'], ['notes', null]]) === null);
  assert('and it does not matter which component is missing',
    ci([['bills', null], ['notes', '2026-07-29']]) === null);
  assert('an empty string counts as missing', ci([['bills', '2026-07-30'], ['notes', '']]) === null);

  /* Stable across calls, so a replay produces the same identity. */
  assert('identical inputs give an identical identity',
    ci([['bills', 'X'], ['notes', 'Y']]) === ci([['bills', 'X'], ['notes', 'Y']]));
})();

function finish() {
  console.log('');
  console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                       : tests + '/' + tests + ' passed');
  console.log('');
  console.log('NOT PROVEN BY THIS FILE: that any real source supplies a usable key often enough');
  console.log('to accumulate evidence. That is a measurement, and it needs the recorder to run.');
  console.log('');
  process.exit(failures ? 1 : 0);
}

// ── S8: support comes from a DECLARED RELATIONSHIP, never a channel count ────
/* The fixture builder is ESM and this file is CJS, so it is imported dynamically and the
   summary runs once that resolves. */
import('../../scripts/build-brain-fixture.mjs').then(function (FX) {
  console.log('S8: row 10 support is judged on declared pairs, not on usable channels');

  /**
   * THE DEFECT THIS GUARDS. Support was `usable.length >= 2`. Two usable channels in
   * unrelated corners of a domain — an alert count and a CVE count — say nothing about
   * whether any DECLARED relationship can be tested, because a divergence claim is a
   * statement about a specific pair observing a specific latent. A corpus could report
   * "supports independent observations" while every declared pair remained untestable.
   */
  function stat(name, keys, values) {
    return { name: name, rows: 100, distinctValues: values, distinctSourceKeys: keys,
             rowsWithoutKey: 0, moving: values >= 2, identified: keys >= 1, usableObservations: keys };
  }
  var manifest = FX.loadManifest('energy');
  assert('the energy manifest loads', manifest.ok === true, manifest.why || '');
  assert('and carries its declared relationships', manifest.relationships.length === 7,
    String(manifest.relationships.length));

  /* TWO USABLE CHANNELS THAT ARE NOT A DECLARED PAIR. The old rule called this support. */
  var unrelated = [stat('NOAA NWS Alerts', 30, 30), stat('CISA KEV', 30, 30)];
  var relsA = FX.testableRelationships(unrelated, manifest);
  assert('two usable but UNRELATED channels make no relationship testable',
    relsA.filter(function (r) { return r.testable; }).length === 0,
    JSON.stringify(relsA.filter(function (r) { return r.testable; })));

  /* A DECLARED PAIR, both sides usable. */
  var pair = [stat('EIA Natural Gas Weekly', 12, 9), stat('LNG Market News', 12, 9)];
  var relsB = FX.testableRelationships(pair, manifest);
  var okPairs = relsB.filter(function (r) { return r.testable; });
  assert('a declared pair with both sides usable IS testable', okPairs.length === 1,
    JSON.stringify(okPairs.map(function (r) { return r.a + '<->' + r.b; })));
  assert('and it is the declared pair, carrying its latent',
    okPairs[0] && okPairs[0].a === 'natGas' && okPairs[0].b === 'lng' &&
    okPairs[0].latent === 'natural gas supply pressure', JSON.stringify(okPairs[0]));

  /* ONE STRONG SIDE IS NOT A PAIR. A relationship is only as testable as its weaker half. */
  var lopsided = [stat('EIA Natural Gas Weekly', 40, 40), stat('LNG Market News', 2, 9)];
  var relsC = FX.testableRelationships(lopsided, manifest).filter(function (r) { return r.testable; });
  assert('a pair whose weaker side is under the floor is NOT testable', relsC.length === 0,
    JSON.stringify(relsC));
  var blocked = FX.testableRelationships(lopsided, manifest)
    .filter(function (r) { return r.a === 'natGas' && r.b === 'lng'; })[0];
  assert('and the blocking side is named, not just "untestable"',
    blocked && blocked.blockedBy === 'lng', blocked ? String(blocked.blockedBy) : 'n/a');

  /* A MOVING SIDE WITH NO KEY IS NOT USABLE, however much it moves. */
  var noKeys = [stat('EIA Natural Gas Weekly', 0, 50), stat('LNG Market News', 0, 50)];
  assert('channels that move but carry no source key make nothing testable',
    FX.testableRelationships(noKeys, manifest).filter(function (r) { return r.testable; }).length === 0);

  /**
   * NO BINDER: ABSTAIN. Without declared latents there is nothing a relationship could be
   * tested against, so support must be false with a stated reason rather than inferred
   * from whatever channels happen to be present.
   *
   * Probed with a name that can never have a binder. This assertion previously used
   * `finance`, which was true when written and stopped being true the moment
   * `bind/finance.js` was added — the suite caught it immediately, which is the system
   * working. Pinning the abstain path to a domain that cannot exist keeps it testing the
   * behaviour rather than a passing fact about which domains happen to be bound today.
   */
  /* TWO DIFFERENT REFUSALS, and they must not report the same thing. A name that is not
     a domain at all and a real domain nobody has bound yet send an operator to different
     places, so each says which it is. */
  var none = FX.loadManifest('no-such-domain-xyz');
  assert('a name that is not a canonical domain does not load a manifest', none.ok === false);
  assert('and says so, rather than blaming a missing binder',
    /not one of the 20 canonical domains/.test(none.why), none.why);

  /**
   * THE NO-BINDER PATH IS NOW UNREACHABLE FROM A CANONICAL NAME, and that is the finding
   * rather than a problem to route around.
   *
   * This assertion has been rewritten three times, and the history is the point. It was
   * pinned to `finance`, then to `economy` — each true when written and false the moment
   * that domain was bound — then to whichever domain the registry still reported as
   * unbound at run time. That last version was self-maintaining right up until manifest
   * coverage completed, at which point it correctly announced that it needed rethinking.
   *
   * With all twenty bound, the only refusal `loadManifest` can now produce from a
   * canonical name is none at all. So the coverage itself is what gets asserted: if a
   * binder is ever deleted this fails loudly, which is the behaviour the old probe was
   * really protecting. The absent-binder branch still exists and is still correct; it is
   * simply not reachable by valid input while every domain has a manifest.
   */
  var REG = require('../bind/registry.js');
  var stillUnbound = REG.survey().filter(function (r) { return r.state === REG.STATE.UNBOUND; });
  assert('manifest coverage is complete — no canonical domain lacks a binder',
    stillUnbound.length === 0, JSON.stringify(stillUnbound.map(function (r) { return r.product; })));
  assert('so every canonical domain loads a manifest',
    REG.PRODUCT_KEYS.every(function (k) { return FX.loadManifest(k).ok === true; }),
    REG.PRODUCT_KEYS.filter(function (k) { return !FX.loadManifest(k).ok; }).join(', '));
  assert('and the only refusal left is for a name that is not a domain at all',
    none.ok === false && /not one of the 20 canonical domains/.test(none.why), none.why);

  /* And finance, which IS bound now, loads its three declared relationships. */
  var fin = FX.loadManifest('finance');
  assert('finance now loads a manifest, since it has a binder', fin.ok === true, fin.why || '');
  assert('with its three declared SPY-price relationships',
    fin.relationships.length === 3 &&
    fin.relationships.every(function (r) { return r.latent === 'SPY price level'; }),
    String(fin.relationships.length));
  assert('but with no fixture, nothing about it is testable',
    FX.testableRelationships([], fin).every(function (r) { return !r.testable; }));

  /* THE REAL CORPUS, as the ground truth for all of the above. */
  var doc = require('../fixtures/energy-recorder.json');
  var live = FX.testableRelationships(FX.analyze(doc.rows), manifest);
  assert('and on the recorded energy corpus, zero of seven declared pairs are testable',
    live.length === 7 && live.filter(function (r) { return r.testable; }).length === 0,
    live.filter(function (r) { return r.testable; }).length + ' of ' + live.length);

  /**
   * THE MANIFEST MUST LOAD FROM ANYWHERE, and this assertion is the one that was missing.
   *
   * `loadManifest` joined `brain-v2/bind/<domain>.js` onto process.cwd(), so the answer
   * depended on where the command was typed: from the repo root the energy manifest
   * loaded and seven relationships were checked; from any other directory the same call
   * reported "no binder" and the verdict ABSTAINED. Every assertion above passed, because
   * every one of them ran from the root.
   *
   * That is the dangerous direction for an evidence tool. It does not crash and it never
   * overstates — it quietly reports LESS support than the data holds, which reads as a
   * finding about the corpus rather than a bug in the reader.
   *
   * The cwd is restored in `finally`, or every test after this one would inherit a
   * directory this test chose.
   */
  var originalCwd = process.cwd();
  try {
    process.chdir(require('os').tmpdir());
    assert('the cwd really did change to somewhere outside the repository',
      process.cwd() !== originalCwd && !fs.existsSync('brain-v2'),
      process.cwd());

    var elsewhere = FX.loadManifest('energy');
    assert('the energy manifest STILL loads from outside the repository',
      elsewhere.ok === true, elsewhere.why || '');
    assert('with all seven declared relationships, not a truncated set',
      elsewhere.relationships.length === 7, String(elsewhere.relationships.length));
    assert('and the identical manifest content, not merely a loadable one',
      JSON.stringify(elsewhere.relationships) === JSON.stringify(manifest.relationships));
    assert('so the channel-name mapping survives too',
      elsewhere.nameByKey.get('fredCrude') === 'FRED Crude Oil',
      String(elsewhere.nameByKey.get('fredCrude')));

    /* And the verdict it produces is the same one, rather than a false abstention. */
    var awayRels = FX.testableRelationships(FX.analyze(doc.rows), elsewhere);
    assert('the verdict from outside matches the verdict from the root',
      JSON.stringify(awayRels) === JSON.stringify(live),
      awayRels.length + ' vs ' + live.length + ' relationships');

    /* A domain with genuinely no binder must still abstain — the fix must not make
       everything load. */
    assert('a name that is not a domain still abstains from outside the repository',
      FX.loadManifest('no-such-domain-xyz').ok === false);
    assert('while a bound one still loads from outside the repository',
      FX.loadManifest('finance').ok === true);
  } finally {
    process.chdir(originalCwd);
  }
  assert('and the working directory is restored afterwards', process.cwd() === originalCwd,
    process.cwd());

  finish();
}).catch(function (e) {
  console.error('  FAIL S8 could not load the fixture builder :: ' + e.message);
  failures++; tests++;
  finish();
});
