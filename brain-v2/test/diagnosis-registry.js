/**
 * brain-v2/test/diagnosis-registry.js — the declarative registry decides exactly what the
 * sixty-three executable predicates decided, and nothing else.
 *
 * WHY THIS TEST IS THE WHOLE POINT OF THE MIGRATION. Rewriting sixty-three predicates as data
 * is only safe if "the same rule, written differently" is a checkable claim rather than a
 * hopeful one. So this file does not test the registry against the design document, or against
 * what the entries look like. It tests it against THE ACTUAL PREDICATES AS THEY WERE, read out
 * of git at the baseline commit and evaluated side by side with the compiled entries.
 *
 * Four kinds of evidence, in increasing strength:
 *
 *   INVENTORY   sixty-three entries, ten forms, the exact per-form counts, keyed (domain, id)
 *   GRID        every finding, old vs new, over a dense grid of departures including the exact
 *               threshold points, where floating point and >= versus > actually differ
 *   FIXTURE     every domain's recorded fixture replayed twice through the real brain — once
 *               with the old predicates, once with the compiled entries — comparing fired,
 *               did-not-fire and could-not-be-judged per cycle
 *   NEGATIVE    deliberate corruptions of the registry that MUST break the tests above. A
 *               green suite that stays green when the thing under test is broken is not
 *               evidence, and four specific ways to get this migration wrong are checked here
 *               by breaking them on purpose.
 *
 * Run: node brain-v2/test/diagnosis-registry.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var FORMS = require('../bind/diagnosis-forms.js');
var REGISTRY = require('../bind/diagnosis-registry.js');
var FACTORY = require('../bind/factory.js');
var B = require('../core/brain.js');

var BASELINE = 'ea5923ba';
var BIND_DIR = path.join(__dirname, '..', 'bind');
var FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

var tests = 0, failures = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/**
 * The predicates AS THEY WERE, lifted out of git at the baseline commit.
 *
 * The old binder files cannot simply be required: they call the factory, which now refuses
 * inline test functions, which is the very change under test. So only the `var FINDINGS = [...]`
 * block is extracted and evaluated with SIGMA in scope, which is the only free name those
 * bodies ever referenced. This is the genuine pre-migration code, not a re-typing of it.
 */
/**
 * THE BASELINE MUST EXIST, AND ITS ABSENCE MUST BE LOUD.
 *
 * A shallow clone (actions/checkout defaults to depth 1) does not contain the baseline
 * commit, and the first version of this file returned null in that case. The sections that
 * matter then compared nothing, and the failure surfaced ten screens later as a TypeError on
 * a null. A test that cannot reach its evidence must say exactly that, at the top, once.
 */
function requireBaseline() {
  try {
    cp.execSync('git cat-file -t ' + BASELINE, { cwd: path.join(__dirname, '..', '..'), stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('');
    console.error('CANNOT RUN: the baseline commit ' + BASELINE + ' is not in this clone.');
    console.error('This suite proves the registry decides what the ORIGINAL predicates decided,');
    console.error('and it reads them from git rather than from a copy. Without that history there');
    console.error('is nothing to compare against, and passing would mean nothing.');
    console.error('');
    console.error('  CI:    actions/checkout needs fetch-depth: 0');
    console.error('  local: git fetch --unshallow');
    console.error('');
    process.exit(1);
  }
}
requireBaseline();

function oldFindingsFor(file) {
  var src;
  try {
    src = cp.execSync('git show ' + BASELINE + ':brain-v2/bind/' + file,
      { cwd: path.join(__dirname, '..', '..'), maxBuffer: 1 << 24 }).toString();
  } catch (e) {
    /* The baseline exists (checked above), so a miss here means the FILE did not exist at
       that commit — a genuine result for a binder added later, not an environment problem. */
    return null;
  }
  var start = src.search(/^var FINDINGS = \[/m);
  if (start < 0) return [];
  var rest = src.slice(start);
  var end = rest.search(/^\];\s*$/m);
  if (end < 0) throw new Error(file + ': could not delimit the baseline FINDINGS array');
  var block = rest.slice(0, end + 2);
  /* SIGMA is the single free name in every baseline predicate body. Passing the same 2.0 the
     binders declared keeps the comparison about representation and not about the constant. */
  var fn = new Function('SIGMA', block + '\nreturn FINDINGS;');
  return fn(2.0);
}

/**
 * The binder modules in bind/, identified by WHAT THEY EXPORT rather than by what they are
 * not called.
 *
 * This was a hardcoded list of exclusions — factory, registry, and the two new registry
 * files — which is a rule that silently rots. `bind/calendars.js` landed on main between this
 * branch being cut and CI running it: a declared-data module, not a binder, and the exclusion
 * list did not know about it. The suite required it and died on `binder.spec is not a
 * function`, which names the symptom and not the cause. A binder is a thing with a domain, a
 * findings array and a spec; anything else in this directory is not one, whenever it arrives.
 */
function binderFiles() {
  return fs.readdirSync(BIND_DIR).filter(function (f) {
    if (f.slice(-3) !== '.js') return false;
    var m;
    try { m = require(path.join(BIND_DIR, f)); } catch (e) { return false; }
    return !!m && typeof m.domain === 'string' && Array.isArray(m.FINDINGS) && typeof m.spec === 'function';
  });
}

var DOMAIN_OF = {};
binderFiles().forEach(function (f) { DOMAIN_OF[f] = require(path.join(BIND_DIR, f)).domain; });

console.log('DR: the declarative registry decides what the executable predicates decided');
console.log('    baseline ' + BASELINE + ', predicates read from git, not retyped');
console.log('');

// ── DR1: inventory ───────────────────────────────────────────────────────────
(function () {
  console.log('DR1: the registry holds exactly the measured library');
  var entries = REGISTRY.allEntries();
  assert('sixty-three entries', entries.length === 63, String(entries.length));

  var EXPECTED = {
    SINGLE_DEPART_ABS: 39, SINGLE_DEPART_SIGNED: 6, PAIR_CO_DEPART_ABS_SUM: 5, DOMAIN_DEPART: 5,
    PAIR_CO_DEPART_SIGNED: 2, PAIR_CO_DEPART_SIGNED_SUM: 2, PAIR_CO_DEPART_ABS: 1,
    PAIR_EITHER_PLUS_SUM: 1, PAIR_SUM_ONLY: 1, PAIR_SIGN_DISAGREE: 1
  };
  var tally = {};
  entries.forEach(function (e) { tally[e.entry.form] = (tally[e.entry.form] || 0) + 1; });
  var exact = Object.keys(EXPECTED).every(function (k) { return tally[k] === EXPECTED[k]; }) &&
              Object.keys(tally).length === Object.keys(EXPECTED).length;
  assert('the ten measured forms, at their measured counts', exact, JSON.stringify(tally));
  assert('and the counts sum to sixty-three',
    Object.keys(EXPECTED).reduce(function (n, k) { return n + EXPECTED[k]; }, 0) === 63);

  assert('every entry is data: no entry carries a function or an expression string',
    entries.every(function (e) {
      return typeof e.entry.test !== 'function' && typeof e.entry.expression !== 'string';
    }));
  assert('every entry declares schemaVersion 1',
    entries.every(function (e) { return e.entry.schemaVersion === 1; }));
  assert('every entry declares a numeric definitionVersion',
    entries.every(function (e) { return typeof e.entry.definitionVersion === 'number'; }));
  assert('every entry declares status "declared" — nothing here is activated',
    entries.every(function (e) { return e.entry.status === 'declared'; }));

  /* PROVENANCE IS PINNED, not merely present. "derived from the predicates" is unfalsifiable
     without the commit those predicates were read at: the same sentence would be true of any
     later, drifted version of them. The pin is what makes the derivation re-runnable. */
  assert('every entry pins its provenance to the baseline commit ' + BASELINE,
    entries.every(function (e) { return e.entry.provenance && e.entry.provenance.commit === BASELINE; }),
    JSON.stringify(entries.filter(function (e) {
      return !e.entry.provenance || e.entry.provenance.commit !== BASELINE;
    }).map(function (e) { return e.domain + '/' + e.entry.id; }).slice(0, 3)));
  assert('and names what it was derived from and by what method',
    entries.every(function (e) {
      return /predicates/.test(e.entry.provenance.derivedFrom || '') &&
             /regen-finding-map/.test(e.entry.provenance.method || '');
    }));

  /* Two versions, moving independently. A reformatted record with unchanged meaning and a
     re-defined diagnosis in an unchanged shape are opposite events; one number cannot say
     which happened, so the registry must expose both. */
  assert('schemaVersion and definitionVersion are separate, independently readable fields',
    REGISTRY.SCHEMA_VERSION === 1 && REGISTRY.DEFINITION_VERSION === 1 &&
    Object.keys(REGISTRY).indexOf('SCHEMA_VERSION') > -1 && Object.keys(REGISTRY).indexOf('DEFINITION_VERSION') > -1);
  assert('and every entry agrees with the module-level versions',
    entries.every(function (e) {
      return e.entry.schemaVersion === REGISTRY.SCHEMA_VERSION &&
             e.entry.definitionVersion === REGISTRY.DEFINITION_VERSION;
    }));
  assert('only the three reviewed thresholds appear anywhere in the registry',
    entries.every(function (e) {
      return (e.entry.thresholds || []).every(function (t) {
        return t === 'SIGMA' || t === 1.0 || t === 2.5;
      });
    }));
})();

// ── DR2: (domain, id) is the key ─────────────────────────────────────────────
(function () {
  console.log('DR2 [regression]: the key is (domain, id), because ids repeat across domains');
  var entries = REGISTRY.allEntries();
  var byId = {};
  entries.forEach(function (e) { (byId[e.entry.id] = byId[e.entry.id] || []).push(e.domain); });

  var shared = Object.keys(byId).filter(function (id) { return byId[id].length > 1; });
  assert('some ids genuinely repeat across domains, so this is not a hypothetical',
    shared.length > 0, shared.join(', '));
  assert('NEW_KEV_30D_DEPARTURE is declared by four domains',
    (byId.NEW_KEV_30D_DEPARTURE || []).length === 4, (byId.NEW_KEV_30D_DEPARTURE || []).join(', '));
  ['PHYSICAL_HAZARDS_CO_DEPARTING', 'SEISMIC_DEPARTURE', 'WEATHER_ALERT_DEPARTURE'].forEach(function (id) {
    assert(id + ' is declared by three domains', (byId[id] || []).length === 3, (byId[id] || []).join(', '));
  });

  var duplicatesCollapsed = Object.keys(byId).length;
  assert('keying on the id alone would lose entries; keying on (domain, id) does not',
    duplicatesCollapsed < 63 && entries.length === 63,
    duplicatesCollapsed + ' distinct ids for 63 entries');

  /* The same id in two domains must stay two independently resolvable entries. */
  var kevDomains = byId.NEW_KEV_30D_DEPARTURE || [];
  var distinct = kevDomains.every(function (d) {
    return REGISTRY.findingsFor(d).filter(function (r) { return r.id === 'NEW_KEV_30D_DEPARTURE'; }).length === 1;
  });
  assert('and each domain resolves its own copy', distinct);

  /* The same channel pair carries different forms in different domains: environment reads
     nwsAlerts/earthquakes signed, the other three read them absolute. If the registry ever
     merged by id, this difference would vanish silently. */
  function formOf(domain, id) {
    var r = REGISTRY.findingsFor(domain).filter(function (x) { return x.id === id; })[0];
    return r ? r.form : null;
  }
  assert('environment and defense treat the same channel pair differently, and both survive',
    formOf('environment', 'COMPOUND_HAZARD') === 'PAIR_CO_DEPART_SIGNED_SUM' &&
    formOf('defense', 'PHYSICAL_HAZARDS_CO_DEPARTING') === 'PAIR_CO_DEPART_ABS_SUM',
    formOf('environment', 'COMPOUND_HAZARD') + ' vs ' + formOf('defense', 'PHYSICAL_HAZARDS_CO_DEPARTING'));
})();

// ── DR3: old vs new over a dense grid, including exact threshold points ──────
(function () {
  console.log('DR3: every finding decides identically, old predicate vs compiled entry');

  /* The grid deliberately includes the exact thresholds and the values immediately either
     side of them. A migration that turned >= into > is invisible everywhere except at the
     boundary, and floating point is exactly where a rewritten comparison goes wrong. */
  var EPS = 1e-9;
  var GRID = [];
  [0, 1.0, 2.0, 2.5].forEach(function (t) {
    GRID.push(t - EPS, t, t + EPS, -t - EPS, -t, -t + EPS);
  });
  GRID = GRID.concat([-3.7, -2.6, -1.5, -0.4, 0.4, 1.5, 2.6, 3.7, 12, -12]);
  /* de-duplicate while keeping order stable */
  GRID = GRID.filter(function (v, i) { return GRID.indexOf(v) === i; });

  var comparisons = 0, disagreements = [];
  var covered = 0;

  binderFiles().forEach(function (file) {
    var domain = DOMAIN_OF[file];
    var olds = oldFindingsFor(file);
    if (olds === null) { return; }
    var news = require(path.join(BIND_DIR, file)).FINDINGS;
    if (olds.length !== news.length) {
      disagreements.push(domain + ': arity ' + olds.length + ' old vs ' + news.length + ' new');
      return;
    }
    olds.forEach(function (oldF, i) {
      var newF = news[i];
      if (oldF.id !== newF.id) { disagreements.push(domain + ': id ' + oldF.id + ' vs ' + newF.id); return; }
      covered++;
      var entry = REGISTRY.findingsFor(domain)[i];
      var chans = (entry.operands && entry.operands.length) ? entry.operands.slice() : (entry.requires || []).slice(0, 2);

      GRID.forEach(function (za) {
        GRID.forEach(function (zb) {
          var deps = {};
          if (chans[0]) deps[chans[0]] = { z: za, n: 30 };
          if (chans[1]) deps[chans[1]] = { z: zb, n: 30 };
          [{ departure: za }, { departure: zb }, { departure: null }, {}].forEach(function (state) {
            var o, n;
            try { o = oldF.test({}, state, deps); } catch (e) { o = 'THREW'; }
            try { n = newF.test({}, state, deps); } catch (e) { n = 'THREW'; }
            comparisons++;
            /* Truthiness, not identity: the old bodies returned the operand object itself
               when a channel was missing (`d.a && ...`), and core/brain.js has only ever
               branched on truthiness. The compiled entries return strict booleans. */
            if (Boolean(o) !== Boolean(n)) {
              disagreements.push(domain + '/' + oldF.id + ' za=' + za + ' zb=' + zb +
                ' state=' + JSON.stringify(state) + ' old=' + String(o) + ' new=' + String(n));
            }
          });
        });
      });

      /* A required channel absent from deps entirely: the "could not read it" case. */
      var o2, n2;
      try { o2 = oldF.test({}, { departure: 3 }, {}); } catch (e) { o2 = 'THREW'; }
      try { n2 = newF.test({}, { departure: 3 }, {}); } catch (e) { n2 = 'THREW'; }
      comparisons++;
      if (Boolean(o2) !== Boolean(n2)) {
        disagreements.push(domain + '/' + oldF.id + ' empty-deps old=' + String(o2) + ' new=' + String(n2));
      }
    });
  });

  assert('all sixty-three findings were compared', covered === 63, String(covered));
  assert(comparisons + ' old-vs-new evaluations, zero disagreements',
    disagreements.length === 0, disagreements.slice(0, 5).join(' | '));
  console.log('       (' + comparisons + ' evaluations across ' + covered + ' findings)');
})();

// ── DR4: boundary behaviour at every threshold ───────────────────────────────
(function () {
  console.log('DR4: the comparison is >= at every threshold, below / at / above');
  var chans = { a: { key: 'a' }, b: { key: 'b' } };
  function ev(form, operands, thresholds, za, zb, dep) {
    var f = FORMS.FORMS[form];
    var th = thresholds.map(function (t) { return FORMS.resolveThreshold(t, 'test'); });
    var deps = { a: { z: za }, b: { z: zb } };
    return f.evaluate(operands, th, { departure: dep }, deps);
  }
  var EPS = 1e-9;

  [['SINGLE_DEPART_ABS', 2.0], ['SINGLE_DEPART_SIGNED', 2.0]].forEach(function (c) {
    assert(c[0] + ' does not fire immediately below the threshold', ev(c[0], ['a'], ['SIGMA'], c[1] - EPS, 0, 0) === false);
    assert(c[0] + ' fires exactly AT the threshold', ev(c[0], ['a'], ['SIGMA'], c[1], 0, 0) === true);
    assert(c[0] + ' fires immediately above it', ev(c[0], ['a'], ['SIGMA'], c[1] + EPS, 0, 0) === true);
  });

  assert('DOMAIN_DEPART does not fire immediately below', ev('DOMAIN_DEPART', [], ['SIGMA'], 0, 0, 2.0 - EPS) === false);
  assert('DOMAIN_DEPART fires exactly AT', ev('DOMAIN_DEPART', [], ['SIGMA'], 0, 0, 2.0) === true);
  assert('DOMAIN_DEPART fires immediately above', ev('DOMAIN_DEPART', [], ['SIGMA'], 0, 0, 2.0 + EPS) === true);

  /* the 1.0 floors and the 2.5 sum, on the sum forms */
  assert('a 1.0 floor is not cleared immediately below',
    ev('PAIR_CO_DEPART_ABS_SUM', ['a', 'b'], [1.0, 1.0, 2.5], 1.0 - EPS, 2.0, 0) === false);
  assert('a 1.0 floor is cleared exactly AT',
    ev('PAIR_CO_DEPART_ABS_SUM', ['a', 'b'], [1.0, 1.0, 2.5], 1.0, 1.5, 0) === true);
  assert('the 2.5 sum is not cleared immediately below',
    ev('PAIR_CO_DEPART_ABS_SUM', ['a', 'b'], [1.0, 1.0, 2.5], 1.25 - EPS, 1.25, 0) === false);
  assert('the 2.5 sum is cleared exactly AT',
    ev('PAIR_CO_DEPART_ABS_SUM', ['a', 'b'], [1.0, 1.0, 2.5], 1.25, 1.25, 0) === true);
  assert('and immediately above',
    ev('PAIR_CO_DEPART_ABS_SUM', ['a', 'b'], [1.0, 1.0, 2.5], 1.25 + EPS, 1.25, 0) === true);
})();

// ── DR5: signed and absolute are independently correct ───────────────────────
(function () {
  console.log('DR5: signed forms ignore a large negative departure; absolute forms do not');
  function ev(form, th, za, zb) {
    var f = FORMS.FORMS[form];
    var t = th.map(function (x) { return FORMS.resolveThreshold(x, 'test'); });
    return f.evaluate(['a', 'b'], t, { departure: 0 }, { a: { z: za }, b: { z: zb } });
  }
  assert('SINGLE_DEPART_ABS fires on a large NEGATIVE departure',
    FORMS.FORMS.SINGLE_DEPART_ABS.evaluate(['a'], [2.0], {}, { a: { z: -3 } }) === true);
  assert('SINGLE_DEPART_SIGNED does NOT fire on the same negative departure',
    FORMS.FORMS.SINGLE_DEPART_SIGNED.evaluate(['a'], [2.0], {}, { a: { z: -3 } }) === false);
  assert('PAIR_CO_DEPART_ABS fires on two large negatives', ev('PAIR_CO_DEPART_ABS', ['SIGMA', 'SIGMA'], -3, -3) === true);
  assert('PAIR_CO_DEPART_SIGNED does not', ev('PAIR_CO_DEPART_SIGNED', ['SIGMA', 'SIGMA'], -3, -3) === false);
  assert('PAIR_CO_DEPART_ABS_SUM fires on two large negatives', ev('PAIR_CO_DEPART_ABS_SUM', [1.0, 1.0, 2.5], -1.5, -1.5) === true);
  assert('PAIR_CO_DEPART_SIGNED_SUM does not', ev('PAIR_CO_DEPART_SIGNED_SUM', [1.0, 1.0, 2.5], -1.5, -1.5) === false);
})();

// ── DR6: the pair-form matrix ────────────────────────────────────────────────
(function () {
  console.log('DR6: every pair form, across the six ways two channels can present');
  function ev(form, th, za, zb) {
    var f = FORMS.FORMS[form];
    var t = th.map(function (x) { return FORMS.resolveThreshold(x, 'test'); });
    return f.evaluate(['a', 'b'], t, { departure: 0 }, { a: { z: za }, b: { z: zb } });
  }

  // only A clears / only B clears / both clear
  assert('CO_DEPART_SIGNED: only A clears -> no', ev('PAIR_CO_DEPART_SIGNED', ['SIGMA', 1.0], 3, 0.5) === false);
  assert('CO_DEPART_SIGNED: only B clears -> no', ev('PAIR_CO_DEPART_SIGNED', ['SIGMA', 1.0], 1, 3) === false);
  assert('CO_DEPART_SIGNED: both clear -> yes', ev('PAIR_CO_DEPART_SIGNED', ['SIGMA', 1.0], 2, 1) === true);

  // sum clears WITHOUT per-channel floors
  assert('PAIR_SUM_ONLY fires on sum alone, with one channel negative',
    ev('PAIR_SUM_ONLY', [2.5], 3.0, -0.4) === true);
  assert('CO_DEPART_ABS_SUM refuses the same shape, because it has floors',
    ev('PAIR_CO_DEPART_ABS_SUM', [1.0, 1.0, 2.5], 3.0, -0.4) === false);

  // per-channel floors clear WITHOUT the sum
  assert('CO_DEPART_ABS_SUM: both floors cleared but sum short -> no',
    ev('PAIR_CO_DEPART_ABS_SUM', [1.0, 1.0, 2.5], 1.2, 1.2) === false);
  assert('CO_DEPART_ABS (no sum term) fires on the same inputs',
    ev('PAIR_CO_DEPART_ABS', [1.0, 1.0], 1.2, 1.2) === true);

  // either-plus-sum
  assert('EITHER_PLUS_SUM: A clears and sum clears -> yes', ev('PAIR_EITHER_PLUS_SUM', ['SIGMA', 'SIGMA', 2.5], 2.4, 0.2) === true);
  assert('EITHER_PLUS_SUM: neither clears though sum does -> no', ev('PAIR_EITHER_PLUS_SUM', ['SIGMA', 'SIGMA', 2.5], 1.5, 1.5) === false);
  assert('EITHER_PLUS_SUM: A clears but sum short -> no', ev('PAIR_EITHER_PLUS_SUM', ['SIGMA', 'SIGMA', 2.5], 2.1, -1.0) === false);

  // opposite signs
  assert('SIGN_DISAGREE fires only when the signs differ and the gap is wide',
    ev('PAIR_SIGN_DISAGREE', ['SIGMA'], 1.5, -1.5) === true);
  assert('SIGN_DISAGREE does not fire when both point the same way, however far apart',
    ev('PAIR_SIGN_DISAGREE', ['SIGMA'], 4.0, 0.5) === false);
  assert('SIGN_DISAGREE does not fire on opposite signs inside the gap',
    ev('PAIR_SIGN_DISAGREE', ['SIGMA'], 0.5, -0.5) === false);

  // a missing channel is never a fire, in any pair form
  ['PAIR_CO_DEPART_ABS', 'PAIR_CO_DEPART_ABS_SUM', 'PAIR_CO_DEPART_SIGNED',
   'PAIR_CO_DEPART_SIGNED_SUM', 'PAIR_EITHER_PLUS_SUM', 'PAIR_SUM_ONLY', 'PAIR_SIGN_DISAGREE'].forEach(function (form) {
    var f = FORMS.FORMS[form];
    var th = [];
    for (var i = 0; i < f.thresholds; i++) th.push(2.0);
    assert(form + ' cannot fire with one channel absent',
      f.evaluate(['a', 'b'], th, {}, { a: { z: 99 } }) === false);
  });
})();

// ── DR7: the whole brain, every fixture, old predicates vs compiled entries ──
(function () {
  console.log('DR7: every domain fixture replayed twice, comparing fired / not-fired / not-judged');

  function outcomesFor(domain, file, useOld) {
    var binder = require(path.join(BIND_DIR, file));
    var spec = binder.spec();
    if (useOld) {
      var olds = oldFindingsFor(file);
      if (olds === null) return null;
      spec = {
        domain: spec.domain, version: spec.version, levelsPerSensor: spec.levelsPerSensor,
        channels: spec.channels, relationships: spec.relationships, efferent: spec.efferent,
        findings: olds
      };
    }
    var fixturePath = path.join(FIXTURE_DIR, domain + '-recorder.json');
    if (!fs.existsSync(fixturePath)) return null;
    var rows = require(fixturePath).rows || [];
    var brain = B.createBrain(spec);
    var trace = [];
    rows.forEach(function (r) {
      var out = B.cycle(brain, binder.readRecorderRow(r), r.t);
      /* `findings` is the FIRED list and `candidates` holds everything that did not fire,
         split by triggerSource: 'evaluated' means the predicate ran and said no, and
         'unevaluated' means a required channel did not report, which is the distinction
         this whole layer exists to keep. */
      var cands = out.candidates || [];
      trace.push({
        fired: (out.findings || []).map(function (x) { return x.id; }).sort(),
        evaluated: cands.filter(function (x) { return x.triggerSource === 'evaluated'; })
          .map(function (x) { return x.id; }).sort(),
        unevaluated: cands.filter(function (x) { return x.triggerSource === 'unevaluated'; })
          .map(function (x) { return x.id; }).sort()
      });
    });
    return trace;
  }

  var domainsChecked = 0, cyclesChecked = 0, mismatches = [];
  var firedSeen = 0, unevaluatedSeen = 0, evaluatedSeen = 0;

  binderFiles().forEach(function (file) {
    var domain = DOMAIN_OF[file];
    var oldTrace, newTrace;
    try { oldTrace = outcomesFor(domain, file, true); newTrace = outcomesFor(domain, file, false); }
    catch (e) { mismatches.push(domain + ': replay threw ' + e.message); return; }
    if (!oldTrace || !newTrace) return;
    domainsChecked++;
    if (oldTrace.length !== newTrace.length) { mismatches.push(domain + ': cycle count differs'); return; }
    for (var i = 0; i < oldTrace.length; i++) {
      cyclesChecked++;
      firedSeen += newTrace[i].fired.length;
      evaluatedSeen += newTrace[i].evaluated.length;
      unevaluatedSeen += newTrace[i].unevaluated.length;
      if (JSON.stringify(oldTrace[i]) !== JSON.stringify(newTrace[i])) {
        mismatches.push(domain + ' cycle ' + i + ': ' + JSON.stringify(oldTrace[i]) + ' vs ' + JSON.stringify(newTrace[i]));
      }
    }
  });

  assert('every domain with a fixture was replayed both ways', domainsChecked === 20, String(domainsChecked));
  assert(cyclesChecked + ' cycles compared, zero differences in fired / evaluated / unevaluated',
    mismatches.length === 0, mismatches.slice(0, 3).join(' | '));
  /* A comparison where nothing ever fires proves nothing, so the three outcomes are counted
     and each must actually have occurred somewhere in the corpus. */
  assert('and the corpus actually exercised firing', firedSeen > 0, 'fired ' + firedSeen);
  assert('and did-not-fire', evaluatedSeen > 0, 'evaluated ' + evaluatedSeen);
  assert('and could-not-be-judged', unevaluatedSeen > 0, 'unevaluated ' + unevaluatedSeen);
  console.log('       (' + domainsChecked + ' domains, ' + cyclesChecked + ' cycles, ' +
    firedSeen + ' fired / ' + evaluatedSeen + ' not-fired / ' + unevaluatedSeen + ' not-judged)');
})();

// ── DR8: refusals ────────────────────────────────────────────────────────────
(function () {
  console.log('DR8 [adversarial]: what the interpreter must refuse to build');
  var chans = [
    { key: 'a', name: 'A', recordedField: 'v', field: 'value', source: 's', cadenceMs: 3600000, units: 'u', q: 0.02, r: 0.05 },
    { key: 'b', name: 'B', recordedField: 'v', field: 'value', source: 's', cadenceMs: 3600000, units: 'u', q: 0.02, r: 0.05 }
  ];
  function base(extra) {
    return Object.assign({ id: 'F', form: 'SINGLE_DEPART_ABS', operands: ['a'], requires: ['a'],
      thresholds: ['SIGMA'], basis: 'a stated basis', schemaVersion: 1, definitionVersion: 1,
      status: 'declared', provenance: { derivedFrom: 'test', commit: 'test' } }, extra);
  }
  function build(finding) {
    return FACTORY.createBinder({ domain: 'test', version: 'v', levelsPerSensor: 3, sigma: 2.0,
      channels: chans, findings: [finding] });
  }
  function refuses(name, finding, pattern) {
    var threw = false, msg = '';
    try { build(finding); } catch (e) { msg = e.message; threw = pattern.test(e.message); }
    assert(name, threw, msg || 'did not throw');
  }

  refuses('an eleventh form is refused', base({ form: 'PAIR_TRIPLE_WHATEVER', operands: ['a', 'b'] }), /unknown form/);
  refuses('an operand naming an undeclared channel is refused', base({ operands: ['ghost'] }), /not a channel this domain declares/);
  refuses('a requirement naming an undeclared channel is refused', base({ requires: ['ghost'] }), /does not declare/);
  refuses('the wrong operand count is refused', base({ form: 'PAIR_CO_DEPART_ABS', operands: ['a'], thresholds: ['SIGMA', 'SIGMA'] }), /operand/);
  refuses('the wrong threshold count is refused', base({ thresholds: ['SIGMA', 'SIGMA'] }), /threshold\(s\)/);
  refuses('an unreviewed numeric threshold is refused', base({ thresholds: [1.7] }), /not one of the reviewed literals/);
  refuses('an unknown named threshold is refused', base({ thresholds: ['TAU'] }), /unknown threshold constant/);
  refuses('a missing basis is refused', base({ basis: undefined }), /state its basis/);
  refuses('an unsupported schemaVersion is refused', base({ schemaVersion: 2 }), /schemaVersion 2 is not implemented/);
  refuses('a missing definitionVersion is refused', base({ definitionVersion: undefined }), /definitionVersion is required/);
  refuses('missing provenance is refused', base({ provenance: undefined }), /provenance must name/);
  refuses('an illegal status is refused', base({ status: 'active' }), /is not legal/);
  refuses('an inline test function is refused', base({ test: function () { return true; } }), /entries are DATA/);
  refuses('an expression string is refused', base({ expression: 'd.a.z >= 2' }), /never evaluates text/);

  /* The valid entry must still build, or the refusals above prove only that everything fails. */
  var built = null;
  try { built = build(base({})); } catch (e) { built = null; }
  assert('and a valid declarative entry still builds and is callable',
    !!built && built.FINDINGS.length === 1 && typeof built.FINDINGS[0].test === 'function');
})();

// ── DR9: negative controls ───────────────────────────────────────────────────
(function () {
  console.log('DR9 [negative controls]: four ways to get this migration wrong, each caught');

  /* Each control corrupts the interpreter or an entry IN MEMORY, re-runs the specific check
     that should catch it, and requires that the check FAILS. A test suite that cannot fail
     is not evidence, and these are the four failures most likely to look correct. */

  function compiled(form, operands, thresholds, requires) {
    return FORMS.compile('control', { id: 'C', form: form, operands: operands,
      thresholds: thresholds, requires: requires || operands });
  }

  // 1. requires and operands conflated
  (function () {
    var entry = REGISTRY.findingsFor('economy').filter(function (r) { return r.id === 'SYSTEMIC_ECONOMIC_STRESS'; })[0];
    var correct = compiled('DOMAIN_DEPART', [], entry.thresholds, entry.requires);
    var conflated = compiled('SINGLE_DEPART_ABS', [entry.requires[0]], entry.thresholds, entry.requires);
    var deps = { cpi: { z: 0.1 }, effr: { z: 0.1 } };
    var state = { departure: 3.0 };
    assert('control 1: conflating requires with operands changes the decision',
      correct({}, state, deps) === true && conflated({}, state, deps) === false,
      'correct=' + correct({}, state, deps) + ' conflated=' + conflated({}, state, deps));
  })();

  // 2. DOMAIN_DEPART evaluating a channel instead of the fused state
  (function () {
    var real = FORMS.FORMS.DOMAIN_DEPART;
    var deps = { cpi: { z: 3.0 } };
    var state = { departure: 0.0 };
    var viaState = real.evaluate([], [2.0], state, deps);
    var viaChannel = FORMS.FORMS.SINGLE_DEPART_ABS.evaluate(['cpi'], [2.0], state, deps);
    assert('control 2: reading a channel instead of s.departure inverts the answer',
      viaState === false && viaChannel === true, 'state=' + viaState + ' channel=' + viaChannel);
  })();

  // 3. a signed form silently made absolute
  (function () {
    var signed = FORMS.FORMS.SINGLE_DEPART_SIGNED.evaluate(['a'], [2.0], {}, { a: { z: -3 } });
    var abs = FORMS.FORMS.SINGLE_DEPART_ABS.evaluate(['a'], [2.0], {}, { a: { z: -3 } });
    assert('control 3: swapping signed for absolute changes the decision on a negative departure',
      signed === false && abs === true, 'signed=' + signed + ' abs=' + abs);
  })();

  // 4. a silently defaulted threshold
  (function () {
    var threw = false, msg = '';
    try { FORMS.resolveThreshold(undefined, 'control'); } catch (e) { threw = true; msg = e.message; }
    assert('control 4: a missing threshold throws rather than defaulting', threw, msg);
    var threw2 = false;
    try { FORMS.resolveThreshold(0, 'control'); } catch (e) { threw2 = true; }
    assert('control 4b: and a plausible-looking 0 is refused too, not silently accepted', threw2);
  })();

  /**
   * 6 and 7 corrupt a REAL registry entry rather than a synthetic fixture.
   *
   * DR8 proves the validator rejects a bad hand-written entry. That is a weaker claim than
   * this one: these take an entry the system actually ships, change one governance field,
   * and require that the binder refuses to build at all. The failure mode being guarded is a
   * future edit to diagnosis-registry.js that bumps a version or flips a status and is
   * carried into the runtime because nothing downstream re-checked it.
   */
  function buildWithEntry(domain, entry) {
    var binderChannels = require(path.join(BIND_DIR, 'economy.js')).CHANNELS;
    return FACTORY.createBinder({ domain: domain, version: 'v', levelsPerSensor: 3, sigma: 2.0,
      channels: binderChannels, findings: [entry] });
  }
  function cloneEntry(domain, id, overrides) {
    var real = REGISTRY.findingsFor(domain).filter(function (r) { return r.id === id; })[0];
    var copy = {};
    Object.keys(real).forEach(function (k) { copy[k] = real[k]; });
    Object.keys(overrides).forEach(function (k) { copy[k] = overrides[k]; });
    return copy;
  }

  (function () {
    var built = null, threw = false, msg = '';
    try { built = buildWithEntry('economy', cloneEntry('economy', 'PRICE_SHOCK', {})); }
    catch (e) { built = null; }
    assert('control 6 baseline: the unmodified shipped entry builds',
      !!built && built.FINDINGS.length === 1);

    try { buildWithEntry('economy', cloneEntry('economy', 'PRICE_SHOCK', { schemaVersion: 2 })); }
    catch (e) { threw = /schemaVersion 2 is not implemented/.test(e.message); msg = e.message; }
    assert('control 6: a shipped entry bumped to an unsupported schemaVersion refuses to build',
      threw, msg || 'did not throw');
  })();

  (function () {
    var threw = false, msg = '';
    try { buildWithEntry('economy', cloneEntry('economy', 'PRICE_SHOCK', { status: 'active' })); }
    catch (e) { threw = /is not legal/.test(e.message); msg = e.message; }
    assert('control 7: a shipped entry flipped to status "active" refuses to build',
      threw, msg || 'did not throw');

    var threw2 = false;
    try { buildWithEntry('economy', cloneEntry('economy', 'PRICE_SHOCK', { status: 'declared ' })); }
    catch (e) { threw2 = /is not legal/.test(e.message); }
    assert('control 7b: and a near-miss status string is refused, not trimmed into legality', threw2);
  })();

  /* And the equivalence check itself must be capable of failing: corrupt one entry's
     threshold and confirm the old-vs-new comparison notices. */
  (function () {
    var file = 'economy.js';
    var olds = oldFindingsFor(file) || [];
    var priceShock = olds.filter(function (f) { return f.id === 'PRICE_SHOCK'; })[0];
    assert('control 5 precondition: the baseline PRICE_SHOCK predicate was actually read',
      !!priceShock && typeof priceShock.test === 'function');
    if (!priceShock) return;
    var corrupted = FORMS.compile('economy', { id: 'PRICE_SHOCK', form: 'SINGLE_DEPART_ABS',
      operands: ['cpi'], thresholds: [1.0], requires: ['cpi'] });
    var deps = { cpi: { z: 1.5 } };
    var o = Boolean(priceShock.test({}, {}, deps));
    var n = corrupted({}, {}, deps);
    assert('control 5: a retuned threshold is caught by the old-vs-new comparison',
      o === false && n === true, 'old=' + o + ' corrupted=' + n);
  })();
})();

console.log('');
console.log(tests - failures + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
console.log('');
console.log('WHAT THIS DID NOT DO: it added no diagnosis, no form, and no threshold. The registry');
console.log('holds the same sixty-three rules the executable predicates held, and the fixtures');
console.log('replay to the same decisions. Nothing here activates a pathway or changes a score.');
if (failures) process.exit(1);
