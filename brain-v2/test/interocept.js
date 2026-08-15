/**
 * brain-v2/test/interocept.js — the drift guard for 20 INDIVIDUAL interoception brains.
 *
 *   node brain-v2/test/interocept.js
 *
 * WHY THIS FILE EXISTS, stated as the objection it answers.
 *
 * brain-v2/interocept/ deliberately holds one self-contained module per domain rather than
 * one shared engine, so each brain owns its own interoception the way it owns its own
 * binder. The cost of that decision is real and worth naming: the same three measures are
 * implemented twenty times, and twenty copies drift. A rule changed in nineteen files and
 * missed in the twentieth fails SILENTLY, which is the worst failure shape available.
 *
 * The mitigation is not to centralise the brains. It is to centralise the CHECK. This test
 * re-derives all three measures from the binder declarations using an INDEPENDENT
 * implementation written differently on purpose (set arithmetic and reduces here, index
 * loops there) and asserts every domain agrees with it. A copy that drifts stops matching
 * the referee, and the referee is one file that cannot itself drift out of twenty places.
 *
 * It also asserts COMPLETENESS: every binder in bind/ must have a matching interocept
 * module. Adding a 21st domain without its own brain fails here rather than in production.
 *
 * Deterministic: no clock, no I/O, no network. Pure over the declarations.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var BIND_DIR = path.join(__dirname, '..', 'bind');
var INTERO_DIR = path.join(__dirname, '..', 'interocept');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var NOT_A_DOMAIN = { 'factory.js': 1, 'registry.js': 1 };
var DOMAINS = fs.readdirSync(BIND_DIR)
  .filter(function (f) { return /\.js$/.test(f) && !NOT_A_DOMAIN[f]; })
  .map(function (f) { return f.replace(/\.js$/, ''); })
  .sort();

/* ── Referee: an independent re-derivation. Written unlike the modules on purpose. ────── */

function specOf(domain) {
  var b = require(path.join(BIND_DIR, domain + '.js'));
  return b.spec ? b.spec() : b;
}

/** Independent latency floor: reduce over requires, max of cadences, null if any unknown. */
function refLatency(spec) {
  var cadence = (spec.channels || []).reduce(function (acc, c) {
    var v = c.cadenceMs;
    acc[c.key] = (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
    return acc;
  }, {});
  return (spec.findings || []).map(function (f) {
    var reqs = f.requires || [];
    var anyUnknown = reqs.some(function (k) { return cadence[k] === null || cadence[k] === undefined; });
    return {
      id: f.id,
      floorMs: anyUnknown ? null : reqs.reduce(function (m, k) { return Math.max(m, cadence[k]); }, 0) || null
    };
  });
}

/** Independent diaschisis: build the inverse index findings->channels, then invert it. */
function refDiaschisis(spec) {
  var byChannel = {};
  (spec.channels || []).forEach(function (c) { byChannel[c.key] = { f: [], r: [] }; });
  (spec.findings || []).forEach(function (f) {
    (f.requires || []).forEach(function (k) { if (byChannel[k]) byChannel[k].f.push(f.id); });
  });
  (spec.relationships || []).forEach(function (r) {
    [r.a, r.b].forEach(function (k) {
      if (byChannel[k]) byChannel[k].r.push(r.id || (r.a + '~' + r.b));
    });
  });
  var keys = Object.keys(byChannel);
  var silent = keys.filter(function (k) { return !byChannel[k].f.length && !byChannel[k].r.length; });
  return {
    byChannel: byChannel,
    total: keys.length,
    silent: silent.length,
    loadBearing: keys.length - silent.length
  };
}

/**
 * Independent reserve. Exhaustive minimum hitting set by increasing size, which is the
 * DEFINITION rather than the greedy approximation the modules use. For these requirement
 * sets the two must agree; if greedy ever exceeds the true minimum, this test says so.
 */
function refReserve(spec) {
  var findings = (spec.findings || []).map(function (f) { return (f.requires || []).slice(); });
  if (!findings.length) return 0;
  var universe = {};
  findings.forEach(function (r) { r.forEach(function (k) { universe[k] = 1; }); });
  var chans = Object.keys(universe);
  if (!chans.length) return 0;
  function hitsAll(subset) {
    return findings.every(function (req) {
      return req.some(function (k) { return subset.indexOf(k) >= 0; });
    });
  }
  for (var size = 1; size <= chans.length; size++) {
    var found = null;
    (function combine(start, acc) {
      if (found) return;
      if (acc.length === size) { if (hitsAll(acc)) found = acc.slice(); return; }
      for (var i = start; i < chans.length && !found; i++) combine(i + 1, acc.concat(chans[i]));
    })(0, []);
    if (found) return size;
  }
  return chans.length;
}

/* ── 1. Completeness ──────────────────────────────────────────────────────────────────── */

console.log('\n1. COMPLETENESS — every binder has its own brain');
var interoFiles = fs.readdirSync(INTERO_DIR).filter(function (f) { return /\.js$/.test(f); })
  .map(function (f) { return f.replace(/\.js$/, ''); }).sort();

assert('20 domains declared in bind/', DOMAINS.length === 20, DOMAINS.length + ' found');
assert('one interocept module per domain, no extras',
  interoFiles.join(',') === DOMAINS.join(','),
  'bind=' + DOMAINS.join(',') + ' interocept=' + interoFiles.join(','));

/* ── 2. Export surface ────────────────────────────────────────────────────────────────── */

console.log('\n2. EXPORT SURFACE — every brain answers the same three questions');
var MODS = {};
DOMAINS.forEach(function (d) {
  var m = require(path.join(INTERO_DIR, d + '.js'));
  MODS[d] = m;
  var ok = m && m.domain === d &&
    typeof m.latency === 'function' && typeof m.diaschisis === 'function' &&
    typeof m.reserve === 'function' && typeof m.report === 'function';
  assert(d + ': exports domain + latency + diaschisis + reserve + report', ok);
});

/* ── 3. Agreement with the independent referee ────────────────────────────────────────── */

console.log('\n3. AGREEMENT — each brain must match an independently written derivation');
DOMAINS.forEach(function (d) {
  var spec = specOf(d);
  var m = MODS[d];

  var mine = m.latency().findings.map(function (f) { return f.id + ':' + f.floorMs; }).sort().join('|');
  var ref = refLatency(spec).map(function (f) { return f.id + ':' + f.floorMs; }).sort().join('|');
  assert(d + ': latency floors match referee', mine === ref, 'module=' + mine + ' referee=' + ref);

  var dm = m.diaschisis(), dr = refDiaschisis(spec);
  assert(d + ': loadBearing/silent/total match referee',
    dm.loadBearingCount === dr.loadBearing && dm.silentCount === dr.silent && dm.totalChannels === dr.total,
    'module=' + dm.loadBearingCount + '/' + dm.silentCount + '/' + dm.totalChannels +
    ' referee=' + dr.loadBearing + '/' + dr.silent + '/' + dr.total);

  var perCh = dm.channels.map(function (c) {
    return c.key + ':' + c.findingsLost.slice().sort().join('+');
  }).sort().join('|');
  var perChRef = Object.keys(dr.byChannel).map(function (k) {
    return k + ':' + dr.byChannel[k].f.slice().sort().join('+');
  }).sort().join('|');
  assert(d + ': per-channel finding loss matches referee', perCh === perChRef);

  var rm = m.reserve().worstCaseKnockout, rr = refReserve(spec);
  assert(d + ': knockout depth equals the EXACT minimum hitting set', rm === rr,
    'greedy=' + rm + ' exact=' + rr);
});

/* ── 4. Invariants that must hold for every brain ─────────────────────────────────────── */

console.log('\n4. INVARIANTS — arithmetic and honesty properties');
DOMAINS.forEach(function (d) {
  var m = MODS[d], spec = specOf(d);
  var dm = m.diaschisis(), lm = m.latency(), rm = m.reserve();

  assert(d + ': loadBearing + silent = total channels',
    dm.loadBearingCount + dm.silentCount === dm.totalChannels);
  assert(d + ': totalChannels equals the binder channel count',
    dm.totalChannels === (spec.channels || []).length);
  assert(d + ': one latency entry per declared finding',
    lm.findings.length === (spec.findings || []).length);
  assert(d + ': knockout depth never exceeds finding count',
    rm.worstCaseKnockout <= (spec.findings || []).length);

  // A conjunctive finding is bound by its SLOWER channel: the floor must equal the max,
  // never the min, of its requirements. This is the property most likely to be typo'd.
  var cad = {};
  (spec.channels || []).forEach(function (c) { cad[c.key] = c.cadenceMs; });
  var conjOk = lm.findings.every(function (f) {
    if (!f.requires || f.requires.length < 2 || f.floorMs === null) return true;
    var mx = Math.max.apply(null, f.requires.map(function (k) { return cad[k]; }));
    return f.floorMs === mx;
  });
  assert(d + ': conjunctive findings bound by the SLOWER channel', conjOk);

  // Zero findings must report the degenerate case explicitly, never a fast-looking null.
  if ((spec.findings || []).length === 0) {
    assert(d + ': zero findings reports noDetector', lm.noDetector === true);
    assert(d + ': zero findings reports alreadyBlind, not robustness', rm.alreadyBlind === true);
  }
});

/* ── 5. These brains must never be able to act ────────────────────────────────────────── */

console.log('\n5. CANNOT ACT — structural self-measurement only');
DOMAINS.forEach(function (d) {
  var r = MODS[d].report();
  assert(d + ': report marks itself interpretive', r.interpretive === true);
  assert(d + ': report declares activates:false', r.activates === false);

  var src = fs.readFileSync(path.join(INTERO_DIR, d + '.js'), 'utf8');
  var body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // No clock and no randomness: a structural measure must replay identically.
  assert(d + ': no Date.now()', body.indexOf('Date.now') < 0);
  assert(d + ': no new Date()', body.indexOf('new Date') < 0);
  assert(d + ': no Math.random()', body.indexOf('Math.random') < 0);

  // REACH, not vocabulary. A substring ban is the wrong test: finding IDs legitimately
  // contain FISCAL_STRESS, and `activates:false` legitimately contains "activate". What
  // actually matters is that this module CANNOT reach anything that acts. Its only
  // dependency must be its own binder — no kernel, no store, no actuator, no sibling
  // domain. That is a structural guarantee a rename cannot quietly defeat.
  var requires = (body.match(/require\(([^)]*)\)/g) || []).map(function (r) {
    return r.replace(/require\(\s*['"]?|['"]?\s*\)/g, '');
  });
  assert(d + ': requires exactly its own binder and nothing else',
    requires.length === 1 && requires[0] === '../bind/' + d + '.js',
    JSON.stringify(requires));

  // It must not CREATE a field with an actionable name. Property/assignment position only,
  // so prose and finding IDs are untouched while a real `stress:` output would fail.
  ['stress', 'promoted', 'activation', 'candidate', 'pathway', 'diagnosis', 'score', 'severity']
    .forEach(function (word) {
      var re = new RegExp('\\b' + word + '\\s*[:=][^=]', 'i');
      assert(d + ': emits no "' + word + '" field', !re.test(body));
    });
  // The one permitted mention of activation is the negative declaration itself.
  assert(d + ': declares activates:false and claims no other activation',
    (body.match(/activat/gi) || []).length === 1 && /activates:\s*false/.test(body));
});

/* ── 6. Vacuity guard ─────────────────────────────────────────────────────────────────── */

/**
 * An assertion that cannot fail is not a test. "Conjunctive findings are bound by the
 * SLOWER channel" only discriminates when a finding's two channels have DIFFERENT
 * cadences: where they are equal, max and min agree and a swapped comparison is invisible.
 *
 * Measured 2026-08-15: 6 of 18 conjunctive findings have mixed cadences (agriculture 1,
 * economy 2, environment 1, finance 2). Energy's five conjunctions are all daily-daily, so
 * energy alone CANNOT catch that mutation — which is exactly how this gap was found.
 *
 * So the guard is explicit: if the mixed-cadence population ever drops to zero, the
 * conjunctive assertion has silently become decorative and this test says so out loud.
 */
console.log('\n6. VACUITY GUARD — the conjunctive assertion must be able to fail');
var mixed = 0, conj = 0, blindDomains = [];
DOMAINS.forEach(function (d) {
  var spec = specOf(d);
  var cad = {};
  (spec.channels || []).forEach(function (c) { cad[c.key] = c.cadenceMs; });
  var domainMixed = 0;
  (spec.findings || []).forEach(function (f) {
    var reqs = f.requires || [];
    if (reqs.length < 2) return;
    conj++;
    var cs = reqs.map(function (k) { return cad[k]; });
    if (Math.max.apply(null, cs) !== Math.min.apply(null, cs)) { mixed++; domainMixed++; }
  });
  if (conj > 0 && domainMixed === 0 && (spec.findings || []).some(function (f) {
    return (f.requires || []).length > 1;
  })) blindDomains.push(d);
});
assert('at least one mixed-cadence conjunctive finding exists', mixed > 0,
  mixed + ' of ' + conj + ' conjunctive findings have differing cadences');
console.log('  NOTE ' + mixed + '/' + conj + ' conjunctive findings can detect a max/min swap.');
console.log('  NOTE domains with only equal-cadence conjunctions (cannot detect it locally): ' +
  (blindDomains.join(', ') || 'none'));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
