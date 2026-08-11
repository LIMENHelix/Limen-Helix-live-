/**
 * brain-v2/test/energy-recorded-field.js — energy replays the quantity it declares.
 *
 * THE DEFECT. Energy's eleven news channels declare `field: 'recent7d'` and read a seven-day
 * article density live. Replayed, they read `v`, the raw page count, which saturates at the
 * Google News page size and then stops moving. Those are two different quantities, not a
 * fresh and a stale copy of one. Measured in production 2026-08-11: nine of the eleven sat
 * at exactly 100 while their live `recent7d` ranged from 0 to 29, a gap of 52 to 100.
 *
 * THE REPAIR. A channel may declare both keys. The current one wins whenever the row carries
 * it; the legacy one is read only where it does not. Every reading names which key it came
 * from, because the two eras are different quantities and a history that mixes them silently
 * is the "two instruments under one channel key" error.
 *
 * THE ONE LINE THIS FILE EXISTS FOR. Presence is `typeof number`, never truthiness. Written
 * `s.r7 || s.v`, a recorded `r7` of 0 reads as absent and the saturated legacy count is
 * substituted in its place. Zero articles in seven days is a real reading — energy's
 * `gridRel` published exactly that in production while its `v` said 100 — so the shortcut
 * does not merely lose a value, it replaces the quietest signal the channel has with its
 * loudest possible one.
 *
 * Run: node brain-v2/test/energy-recorded-field.js
 */

'use strict';

var FACTORY = require('../bind/factory.js');
var ENERGY = require('../bind/energy.js');
var B = require('../core/brain.js');
var LOOP = require('../kernel/loop.js');

var tests = 0, failures = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/** Channel key -> the source NAME the recorder writes it under. */
var NAME_OF = {};
ENERGY.CHANNELS.forEach(function (c) { NAME_OF[c.key] = c.name; });
var NEWS = ENERGY.CHANNELS.filter(function (c) { return c.field === 'recent7d'; }).map(function (c) { return c.key; });

/** One recorded row carrying the given per-channel source entries. */
function row(t, entries) {
  return { t: t, src: Object.keys(entries).map(function (key) {
    var e = entries[key];
    var s = { n: NAME_OF[key] };
    if ('v' in e) s.v = e.v;
    if ('r7' in e) s.r7 = e.r7;
    return s;
  }) };
}

console.log('ERF: energy replays the quantity it declares');
console.log('');

// ── E1: presence is typeof number, not truthiness ────────────────────────────
(function () {
  console.log('E1 [regression]: a recorded r7 of ZERO is a reading, not an absence');

  var zero = ENERGY.readRecorderRow(row(1, { gridRel: { v: 100, r7: 0 } }));
  assert('r7:0 alongside v:100 reads 0, not 100',
    zero.gridRel && zero.gridRel.value === 0, JSON.stringify(zero.gridRel));
  assert('and it reports that it read the current key',
    zero.gridRel.recordedFieldUsed === 'r7', zero.gridRel && zero.gridRel.recordedFieldUsed);

  var absent = ENERGY.readRecorderRow(row(1, { gridRel: { v: 100 } }));
  assert('r7 absent falls back to the legacy v',
    absent.gridRel.value === 100 && absent.gridRel.recordedFieldUsed === 'v',
    JSON.stringify(absent.gridRel));

  var nulled = ENERGY.readRecorderRow({ t: 1, src: [{ n: NAME_OF.gridRel, v: 100, r7: null }] });
  assert('r7 present but null falls back, because null is not a number',
    nulled.gridRel.value === 100 && nulled.gridRel.recordedFieldUsed === 'v',
    JSON.stringify(nulled.gridRel));

  var nan = ENERGY.readRecorderRow({ t: 1, src: [{ n: NAME_OF.gridRel, v: 100, r7: NaN }] });
  assert('and a non-finite r7 falls back rather than poisoning the channel',
    nan.gridRel.value === 100 && nan.gridRel.recordedFieldUsed === 'v',
    JSON.stringify(nan.gridRel));

  var neither = ENERGY.readRecorderRow({ t: 1, src: [{ n: NAME_OF.gridRel }] });
  assert('with neither key the channel is absent, not zero',
    neither.gridRel === undefined, JSON.stringify(neither));

  /* The shortcut this file exists to refuse, stated as an executable comparison. */
  var s = { r7: 0, v: 100 };
  assert('for the record: `s.r7 || s.v` would have returned 100 where the truth is 0',
    (s.r7 || s.v) === 100 && ENERGY.readRecorderRow(row(1, { gridRel: s })).gridRel.value === 0);
})();

// ── E2: mixed-era replay ─────────────────────────────────────────────────────
(function () {
  console.log('E2: one replay spanning both recorder eras reads each row on its own terms');

  var rows = [];
  for (var i = 0; i < 6; i++) rows.push(row(1000 + i, { gridRel: { v: 100 }, natGas: { v: 100 } }));
  for (var j = 0; j < 6; j++) {
    rows.push(row(2000 + j, { gridRel: { v: 100, r7: j }, natGas: { v: 100, r7: 20 + j } }));
  }

  var used = [], values = [];
  rows.forEach(function (r) {
    var o = ENERGY.readRecorderRow(r);
    used.push(o.gridRel.recordedFieldUsed);
    values.push(o.gridRel.value);
  });

  assert('the six legacy rows read v',
    used.slice(0, 6).every(function (u) { return u === 'v'; }), used.slice(0, 6).join(','));
  assert('the six modern rows read r7',
    used.slice(6).every(function (u) { return u === 'r7'; }), used.slice(6).join(','));
  assert('legacy values are the saturated 100 and modern values are the real density',
    values.slice(0, 6).every(function (v) { return v === 100; }) &&
    values.slice(6).join(',') === '0,1,2,3,4,5', values.join(','));
  assert('so the era boundary is visible in the readings rather than hidden in a number',
    new Set(used).size === 2);

  /* Both channels cross the boundary independently: a row may carry r7 for one source and
     not another, because the recorder writes per source. */
  var partial = ENERGY.readRecorderRow(row(3000, { gridRel: { v: 100, r7: 4 }, natGas: { v: 100 } }));
  assert('within ONE row, a source with r7 and a source without are read differently',
    partial.gridRel.recordedFieldUsed === 'r7' && partial.gridRel.value === 4 &&
    partial.natGas.recordedFieldUsed === 'v' && partial.natGas.value === 100,
    JSON.stringify(partial));
})();

// ── E3: units, declared and enforced ─────────────────────────────────────────
(function () {
  console.log('E3: the fallback is a different quantity, and the declaration must say so');

  var news = ENERGY.CHANNELS.filter(function (c) { return c.field === 'recent7d'; });
  assert('all eleven news channels declare units and legacyUnits, and they differ',
    news.length === 11 && news.every(function (c) {
      return c.units === 'articles/7d' && !!c.legacyUnits && c.legacyUnits !== c.units;
    }), news.length + ' channels');

  function build(over) {
    var ch = Object.assign({ key: 'x', name: 'X', recordedField: 'r7', field: 'recent7d',
      source: 's', cadenceMs: 3600000, units: 'articles/7d', q: 0.02, r: 0.05 }, over);
    return FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2, channels: [ch] });
  }
  function refuses(name, over, pattern) {
    var threw = false, msg = '';
    try { build(over); } catch (e) { msg = e.message; threw = pattern.test(msg); }
    assert(name, threw, msg || 'did not throw');
  }

  refuses('a legacy fallback with no legacyUnits is refused',
    { recordedFieldLegacy: 'v' }, /no `legacyUnits`/);
  refuses('legacyUnits with nothing to describe is refused',
    { legacyUnits: 'articles' }, /no recordedFieldLegacy to describe/);
  refuses('a fallback to the same key is refused',
    { recordedFieldLegacy: 'r7', legacyUnits: 'articles' }, /A fallback to itself is not a fallback/);
  refuses('a legacy key the recorder never writes is refused',
    { recordedFieldLegacy: 'nope', legacyUnits: 'articles' }, /the recorder never writes/);

  var ok = null;
  try { ok = build({ recordedFieldLegacy: 'v', legacyUnits: 'articles (page-capped total)' }); } catch (e) { ok = null; }
  assert('and a properly declared pair builds', !!ok);
})();

// ── E4: which channel is NAMED as the driver changes ─────────────────────────
(function () {
  console.log('E4: reading the declared quantity changes which channel is named as the driver');

  /* A binder identical to energy except that it reads only the legacy key — the behaviour
     before this repair — so the two can be run over the SAME rows. */
  var legacySpec = {
    domain: 'energyLegacy', version: 'test', levelsPerSensor: 3, sigma: ENERGY.SIGMA,
    channels: ENERGY.CHANNELS.map(function (c) {
      var copy = {};
      Object.keys(c).forEach(function (k) { if (k !== 'recordedFieldLegacy' && k !== 'legacyUnits') copy[k] = c[k]; });
      copy.recordedField = 'v';
      return copy;
    }),
    findings: [], relationships: [], efferent: null
  };
  var LEGACY = FACTORY.createBinder(legacySpec);

  /**
   * Rows where the two keys tell opposite stories, which is the real situation: `v` is
   * pinned at the page size for every news channel and cannot depart from its own baseline,
   * while `r7` moves. Only `opec` is given a late surge.
   */
  var rows = [];
  for (var i = 0; i < 30; i++) {
    var e = {};
    NEWS.forEach(function (k) {
      /* `v` is the page count and is pinned for every channel, exactly as production shows.
         `r7` moves, and opec surges late. Same rows, two readings. */
      e[k] = { v: 100, r7: (k === 'opec' && i >= 26) ? 400 : (4 + (i % 3)) };
    });
    rows.push(row(1000 + i * 3600000, e));
  }

  function lastCycle(binder, spec) {
    var brain = B.createBrain(spec);
    var out = null;
    rows.forEach(function (r) { out = B.cycle(brain, binder.readRecorderRow(r), r.t); });
    return out;
  }

  var r7Out = lastCycle(ENERGY, ENERGY.spec());
  var vOut = lastCycle(LEGACY, LEGACY.spec());
  var r7Drivers = (r7Out.dysregulation && r7Out.dysregulation.drivers) || [];

  /* GUARD FIRST. A comparison where neither side names anything would pass a "they differ"
     assertion while proving nothing, which is how this test failed on its first run. */
  assert('reading r7, the domain names a driver at all',
    r7Drivers.length > 0, JSON.stringify(r7Out.dysregulation));
  assert('and the channel it names is the one that actually surged',
    r7Drivers[0] && r7Drivers[0].key === 'opec', JSON.stringify(r7Drivers.slice(0, 2)));

  /**
   * Reading the saturated key, there is no driver to name — and not because the surge is
   * small. Every news channel holds one value forever, so each is judged dead or unproven
   * and the fused state ABSTAINS. The domain does not report a wrong driver; it reports
   * nothing, and says the dysregulation is unmeasured rather than absent.
   */
  assert('reading the saturated v, the fused state abstains instead',
    vOut.state && vOut.state.abstained === true, JSON.stringify(vOut.state));
  assert('and it says dysregulation is UNMEASURED, not absent',
    vOut.dysregulation && vOut.dysregulation.detected === false &&
    /unmeasured, NOT absent/.test(vOut.dysregulation.why || ''), JSON.stringify(vOut.dysregulation));
  assert('so no driver is named at all',
    !(vOut.dysregulation && vOut.dysregulation.drivers && vOut.dysregulation.drivers.length),
    JSON.stringify(vOut.dysregulation));
  assert('the repair therefore changes a silent domain into one that names a channel',
    r7Drivers.length > 0 && !(vOut.dysregulation.drivers || []).length);

  /* And the reason, stated as a measurement: v cannot depart from a baseline it never leaves. */
  var vSpread = {}, r7Spread = {};
  rows.forEach(function (r) {
    vSpread[LEGACY.readRecorderRow(r).opec.value] = 1;
    r7Spread[ENERGY.readRecorderRow(r).opec.value] = 1;
  });
  assert('v holds one distinct value across all thirty rows, r7 holds more',
    Object.keys(vSpread).length === 1 && Object.keys(r7Spread).length > 1,
    'v=' + Object.keys(vSpread).length + ' r7=' + Object.keys(r7Spread).length);
})();

// ── E5: serialization and restoration across the era boundary ────────────────
(function () {
  console.log('E5: a run interrupted mid-boundary restores to the same state it would have reached');

  var rows = [];
  for (var i = 0; i < 8; i++) rows.push(row(1000 + i * 3600000, { gridRel: { v: 100 }, natGas: { v: 100 } }));
  for (var j = 0; j < 8; j++) {
    rows.push(row(1000 + (8 + j) * 3600000, { gridRel: { v: 100, r7: j }, natGas: { v: 100, r7: 20 + j } }));
  }

  function loopSpec() { return { domain: 'energy', brainSpec: ENERGY.spec(), horizonMs: 100 }; }

  /* Uninterrupted. */
  var a = LOOP.create(loopSpec());
  rows.forEach(function (r) { LOOP.tick(a, ENERGY.readRecorderRow(r), r.t); });
  var straightThrough = LOOP.serialize(a);

  /* Interrupted exactly at the era boundary, serialized, restored, continued. */
  var b = LOOP.create(loopSpec());
  rows.slice(0, 8).forEach(function (r) { LOOP.tick(b, ENERGY.readRecorderRow(r), r.t); });
  var mid = JSON.parse(JSON.stringify(LOOP.serialize(b)));
  var c = LOOP.restore(loopSpec(), mid);
  rows.slice(8).forEach(function (r) { LOOP.tick(c, ENERGY.readRecorderRow(r), r.t); });
  var restored = LOOP.serialize(c);

  assert('the same number of ticks was taken either way',
    straightThrough.ticks === restored.ticks && straightThrough.ticks === rows.length,
    straightThrough.ticks + ' vs ' + restored.ticks);
  assert('and the restored channel state is byte-identical to the uninterrupted run',
    JSON.stringify(restored.channels) === JSON.stringify(straightThrough.channels));

  /* The readings themselves survive a JSON round trip with their era marker intact, which
     is the boundary that actually gets serialised in production. */
  var reading = ENERGY.readRecorderRow(rows[rows.length - 1]);
  var roundTripped = JSON.parse(JSON.stringify(reading));
  assert('readings survive serialisation with value and era marker unchanged',
    JSON.stringify(roundTripped) === JSON.stringify(reading) &&
    roundTripped.gridRel.recordedFieldUsed === 'r7',
    JSON.stringify(roundTripped.gridRel));
})();

// ── E6: the shipped fixture is untouched ─────────────────────────────────────
(function () {
  console.log('E6: the one domain with a real fixture reads exactly what it read before');
  var rows = require('../fixtures/energy-recorder.json').rows;
  var entries = 0, withR7 = 0;
  rows.forEach(function (r) {
    (r.src || []).forEach(function (s) { entries++; if (typeof s.r7 === 'number' && isFinite(s.r7)) withR7++; });
  });
  assert('the fixture predates r7 entirely, so every reading takes the legacy path',
    withR7 === 0 && entries > 0, withR7 + ' of ' + entries + ' entries carry r7');

  var readings = 0, legacy = 0;
  rows.forEach(function (r) {
    var o = ENERGY.readRecorderRow(r);
    Object.keys(o).forEach(function (k) { readings++; if (o[k].recordedFieldUsed === 'v') legacy++; });
  });
  assert('all ' + readings + ' readings report the legacy key, and none is missing',
    readings > 0 && legacy === readings, legacy + '/' + readings);
})();

console.log('');
console.log(tests - failures + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
console.log('');
console.log('WHAT THIS DID NOT DO: it did not touch headline transport, candidate creation,');
console.log('Massive Crude timestamp derivation, or the WTI-versus-Brent question. It changed');
console.log('which recorded key eleven energy channels read, and nothing else.');
if (failures) process.exit(1);
