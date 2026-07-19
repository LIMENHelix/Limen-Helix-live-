/**
 * scripts/test-grounded-stress.js — proves the properties lib/grounded-stress.js claims.
 * Run: node scripts/test-grounded-stress.js
 *
 * Behavioural assertions, not a smoke test. Each corresponds to a specific claim in the module
 * header, so if a claim stops being true the test fails instead of the comment quietly becoming a
 * lie. T1/T5/T11 are carried over from the v1 suite as regressions.
 */

var G = require('../lib/grounded-stress');

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

function mkCompanies(spec) {
  return spec.map(function (s, i) {
    return {
      name: 'CO' + i, cik: String(1000 + i), scored: true,
      phase: s.phase || 'p5', trajectory: s.trajectory || null,
      alert: s.alert === true, mass: s.mass
    };
  });
}
function mkJoin(companies) {
  return { scored_count: companies.length, mapped_company_count: companies.length, coverage: 1, companies: companies };
}

// ── 1. Abstention (regression from v1 T1) ──────────────────────────────────────────────────────
section('1. Abstains rather than inventing a number on thin coverage');
var thin = G.compute(mkJoin(mkCompanies([{}, {}, {}])));
ok('abstains below minScored', thin.grounded === false && thin.stress === null, JSON.stringify(thin));
ok('abstention states a reason', typeof thin.reason === 'string' && thin.reason.indexOf('thin coverage') === 0);
ok('null join abstains', G.compute(null).grounded === false);

// ── 2. Empirical CDF transform ─────────────────────────────────────────────────────────────────
section('2. Empirical-CDF transform (CISS Eq. 1a) is bounded (0,1] and rank-correct');
var sample = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
var lowRank = G.empiricalCdf(0.05, sample);
var highRank = G.empiricalCdf(0.95, sample);
ok('low value ranks low', lowRank !== null && lowRank < 0.25, 'got ' + lowRank);
ok('high value ranks at the top', highRank === 1, 'got ' + highRank);
ok('output never 0 (range is (0,1])', G.empiricalCdf(-999, sample) > 0, 'got ' + G.empiricalCdf(-999, sample));
ok('returns null on thin sample rather than guessing', G.empiricalCdf(0.5, [1, 2, 3]) === null);
ok('monotone in x', G.empiricalCdf(0.25, sample) <= G.empiricalCdf(0.75, sample));

// ── 3. THE CORE CLAIM: the quadratic form suppresses uncorrelated channels ─────────────────────
section('3. CORE CLAIM: co-moving channels score higher than the same values moving independently');

var companies = mkCompanies([
  { phase: 'p3', trajectory: 'UNRECOVERED_P3' },
  { phase: 'p3', alert: true },
  { phase: 'p3', trajectory: 'RUPTURE' },
  { phase: 'p3', alert: true },
  { phase: 'p3', trajectory: 'STUCK' },
  { phase: 'p3' }
]);
var join = mkJoin(companies);

var histCorrelated = {
  distress:    [0.1, 0.2, 0.1, 0.8, 0.9, 0.2, 0.1, 0.85, 0.9, 0.15],
  unison:      [0.1, 0.2, 0.1, 0.8, 0.9, 0.2, 0.1, 0.85, 0.9, 0.15],
  granularity: [0.1, 0.2, 0.1, 0.8, 0.9, 0.2, 0.1, 0.85, 0.9, 0.15]
};
var histIndependent = {
  distress:    [0.1, 0.2, 0.1, 0.8, 0.9, 0.2, 0.1, 0.85, 0.9, 0.15],
  unison:      [0.9, 0.8, 0.9, 0.2, 0.1, 0.8, 0.9, 0.15, 0.1, 0.85],
  granularity: [0.5, 0.1, 0.9, 0.3, 0.7, 0.4, 0.6, 0.2, 0.8, 0.5]
};

// Walk the EWMA through the history so C actually reflects the pattern, then read the final value.
function runSeries(h, finalJoin) {
  var state = null;
  for (var t = 0; t < h.distress.length; t++) {
    var unified = h.unison[t] > 0.5;
    var hot = h.distress[t] > 0.5;
    var synthetic = mkJoin(mkCompanies([
      { phase: 'p3', alert: hot },
      { phase: unified ? 'p3' : 'p7', alert: hot },
      { phase: unified ? 'p3' : 'p5', alert: hot },
      { phase: unified ? 'p3' : 'p9' },
      { phase: unified ? 'p3' : 'p2' },
      { phase: unified ? 'p3' : 'p8' }
    ]));
    var r = G.compute(synthetic, { history: h, corrState: state });
    if (r.grounded) state = r.corrState;
  }
  return G.compute(finalJoin, { history: h, corrState: state });
}

var rCorr = runSeries(histCorrelated, join);
var rIndep = runSeries(histIndependent, join);

ok('both produce a grounded reading', rCorr.grounded === true && rIndep.grounded === true);
ok('CO-MOVING channels score higher than independent ones',
   rCorr.stress > rIndep.stress,
   'correlated=' + rCorr.stress + ' independent=' + rIndep.stress);
ok('correlationLift is higher when channels co-move',
   rCorr.correlationLift > rIndep.correlationLift,
   'correlated lift=' + rCorr.correlationLift + ' independent lift=' + rIndep.correlationLift);
console.log('        correlated:  stress=' + rCorr.stress + '  lift=' + rCorr.correlationLift);
console.log('        independent: stress=' + rIndep.stress + '  lift=' + rIndep.correlationLift);

// ── 4. The plain average is the UPPER BOUND ────────────────────────────────────────────────────
section('4. The weighted average is the upper bound, reached only at perfect correlation');
ok('correlationLift never exceeds 1 (the average is the ceiling)',
   rCorr.correlationLift <= 1.0001 && rIndep.correlationLift <= 1.0001,
   'corr=' + rCorr.correlationLift + ' indep=' + rIndep.correlationLift);
ok('cold start (C = I) still produces a bounded reading',
   (function () { var r = G.compute(join); return r.grounded && r.stress >= 0 && r.stress <= 1; })());

// ── 5. Phase number is NOT severity (regression from v1 T5) ────────────────────────────────────
section('5. Phase NUMBER is life-cycle position, not severity');
var dHigh = G.channelDistress(mkCompanies([
  { phase: 'p8', trajectory: 'RECOVERED' }, { phase: 'p9', trajectory: 'RECOVERED' },
  { phase: 'p8', trajectory: 'RECOVERED' }, { phase: 'p9', trajectory: 'RECOVERED' },
  { phase: 'p8', trajectory: 'RECOVERED' }
]));
var dLow = G.channelDistress(mkCompanies([
  { phase: 'p0', trajectory: 'RUPTURE' }, { phase: 'p1', trajectory: 'UNRECOVERED_P3' },
  { phase: 'p0', trajectory: 'RUPTURE' }, { phase: 'p1', alert: true },
  { phase: 'p0', trajectory: 'RUPTURE' }
]));
ok('high-phase RECOVERED reads as no distress', dHigh.value === 0, 'got ' + dHigh.value);
ok('low-phase RUPTURE reads as distress', dLow.value > 0.9, 'got ' + dLow.value);

// ── 6. Mass weighting (Gabaix) ─────────────────────────────────────────────────────────────────
section('6. Mass weighting: one large distressed node outweighs many small calm ones');
var flat = G.channelDistress(mkCompanies([{ alert: true }, {}, {}, {}, {}, {}, {}, {}, {}, {}]));
var massed = G.channelDistress(mkCompanies([
  { alert: true, mass: 900 }, { mass: 10 }, { mass: 10 }, { mass: 10 }, { mass: 10 },
  { mass: 10 }, { mass: 10 }, { mass: 10 }, { mass: 10 }, { mass: 10 }
]));
ok('flat weighting gives the distressed node 1/N', Math.abs(flat.value - 0.1) < 1e-9, 'got ' + flat.value);
ok('mass weighting reflects that it carries most of the domain', massed.value > 0.85, 'got ' + massed.value);
ok('massWeighted flag is honest', flat.massWeighted === false && massed.massWeighted === true);

section('   Granularity (Gabaix h = sqrt of the Herfindahl)');
var granConc = G.channelGranularity(mkCompanies([{ mass: 950 }, { mass: 10 }, { mass: 20 }, { mass: 20 }]));
var granSpread = G.channelGranularity(mkCompanies([{ mass: 25 }, { mass: 25 }, { mass: 25 }, { mass: 25 }]));
ok('concentrated domain is granular-fragile', granConc.value > granSpread.value,
   'concentrated=' + granConc.value + ' spread=' + granSpread.value);
ok('equal masses give h = 1/sqrt(N)', Math.abs(granSpread.value - 0.5) < 1e-9, 'got ' + granSpread.value);

// ── 7. Unison channel (absorption-ratio analogue) ──────────────────────────────────────────────
section('7. Unison: nodes collapsing into one phase reads as coupled/fragile');
var allSame = G.channelUnison(mkCompanies([{ phase: 'p3' }, { phase: 'p3' }, { phase: 'p3' }, { phase: 'p3' }]));
var spreadPh = G.channelUnison(mkCompanies([{ phase: 'p1' }, { phase: 'p4' }, { phase: 'p7' }, { phase: 'p9' }]));
ok('all-one-phase reads maximally unified', allSame.value === 1, 'got ' + allSame.value);
ok('fully dispersed reads 0', spreadPh.value === 0, 'got ' + spreadPh.value);
ok('unified > dispersed', allSame.value > spreadPh.value);

// ── 8. corrState round-trips ───────────────────────────────────────────────────────────────────
section('8. Correlation state round-trips (the caller can persist it)');
var r1 = G.compute(join);
var r2 = G.compute(join, { corrState: r1.corrState });
ok('first call returns a corrState', !!(r1.corrState && r1.corrState.var));
ok('state survives a JSON round-trip', (function () {
  var revived = JSON.parse(JSON.stringify(r1.corrState));
  var rr = G.compute(join, { corrState: revived });
  return rr.grounded === true && typeof rr.stress === 'number';
})());
ok('second call is still bounded', r2.stress >= 0 && r2.stress <= 1);

// ── 9. Degradation is reported, not hidden ─────────────────────────────────────────────────────
section('9. Degraded modes are surfaced rather than silently absorbed');
var noHistory = G.compute(join);
ok('no-history run flags untransformed channels',
   !!(noHistory.degraded && noHistory.degraded.untransformedChannels === true),
   JSON.stringify(noHistory.degraded));
ok('no-mass run flags massWeighted:false', noHistory.massWeighted === false);
var withMass = G.compute(mkJoin(mkCompanies([
  { alert: true, mass: 500 }, { mass: 100 }, { mass: 100 }, { mass: 100 }, { mass: 100 }
])), { history: histCorrelated });
ok('mass-bearing run flags massWeighted:true', withMass.massWeighted === true);

// ── 10. Output contract ────────────────────────────────────────────────────────────────────────
section('10. Output contract (consoles read these)');
var c = G.compute(join, { history: histCorrelated });
ok('stress in [0,1]', c.stress >= 0 && c.stress <= 1);
ok('variance-equivalent present and <= vol-equivalent',
   c.stressVarianceEquivalent <= c.stress + 1e-9,
   'var=' + c.stressVarianceEquivalent + ' vol=' + c.stress);
ok('per-channel breakdown present', !!(c.channels && c.channels.distress && c.channels.unison));
ok('legacy v1 fields retained', typeof c.alerts === 'number' && typeof c.distressed === 'number');
ok('note records the method', typeof c.note === 'string' && c.note.indexOf('CISS') !== -1);

// ── 11. The original bug (regression from v1 T6) ───────────────────────────────────────────────
section('11. REGRESSION: the energy-shaped live case must not read like the feed did (1.0)');
var energyCos = [];
for (var i = 0; i < 16; i++) {
  energyCos.push(i < 3
    ? { phase: 'p3', alert: true, trajectory: 'UNRECOVERED_P3' }
    : { phase: ['p5', 'p7', 'p8', 'p2'][i % 4], trajectory: 'RECOVERED' });
}
var energy = G.compute(mkJoin(mkCompanies(energyCos)));
ok('energy reads grounded', energy.grounded === true);
ok('energy reads far below the feed-derived 1.0', energy.stress < 0.35, 'stress=' + energy.stress);
ok('distress channel reflects 3/16 stuck', Math.abs(energy.channels.distress.raw - 0.1875) < 1e-3,
   'distress raw=' + energy.channels.distress.raw);
console.log('        energy: stress=' + energy.stress + '  distress channel=' + energy.channels.distress.raw
  + '  unison=' + energy.channels.unison.raw);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
