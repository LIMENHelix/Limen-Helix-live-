/**
 * scripts/test-grounded-stress.js — SHADOW candidate: domain stress from kernel-scored company
 * distress (not feed volume). Run: node scripts/test-grounded-stress.js
 *
 *   T1  thin coverage (< minScored) ⇒ ABSTAIN (grounded:false, stress:null) — no false number
 *   T2  all companies healthy ⇒ ~0 stress
 *   T3  kernel `alert` flags drive the alert share
 *   T4  distress trajectories (UNRECOVERED_P3, RUPTURE) count when no alert flag
 *   T5  structural p7a/p7b/p3 counts contribute; blend is 0.6*alert + 0.4*structural
 *   T6  the energy-shaped case from the live snapshot reads ~14% (feed said 100%)
 */
var G = require('../lib/grounded-stress');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

function join(companies, extra) {
  var scored = companies.filter(function (c) { return c.scored; });
  var o = { scored_count: scored.length, companies: companies, p7a_count: 0, p7b_count: 0, p3_count: 0, coverage: 1 };
  return Object.assign(o, extra || {});
}
function co(alert, traj) { return { scored: true, alert: !!alert, trajectory: traj || 'RECOVERED' }; }

console.log('T1: thin coverage ⇒ abstain');
var thin = G.compute(join([co(true), co(false), co(false)]));   // 3 scored < 4
assert('grounded:false + stress null', thin.grounded === false && thin.stress === null, JSON.stringify(thin));

console.log('T2: all healthy ⇒ ~0');
var healthy = G.compute(join([co(false), co(false), co(false), co(false), co(false)]));
assert('grounded:true', healthy.grounded === true);
assert('stress ~0', healthy.stress < 0.01, 'stress=' + healthy.stress);

console.log('T3: alert flags drive alert share');
var alerts = G.compute(join([co(true), co(true), co(false), co(false), co(false)]));   // 2/5 alert
assert('alertShare = 0.4', Math.abs(alerts.alertShare - 0.4) < 1e-6, 'alertShare=' + alerts.alertShare);
assert('alerts counted', alerts.alerts === 2);

console.log('T4: distress trajectories count without an alert flag');
var traj = G.compute(join([co(false, 'UNRECOVERED_P3'), co(false, 'RUPTURE'), co(false), co(false), co(false)]));   // 2 distress-traj / 5
assert('trajectory distress raises alertShare', traj.alertShare > 0.3, 'alertShare=' + traj.alertShare);

console.log('T5: structural p-counts + blend');
var struct = G.compute(join([co(false), co(false), co(false), co(false), co(false)], { p7a_count: 2, p3_count: 1 }));
// structural = (2*1 + 0 + 1*0.6)/5 = 2.6/5 = 0.52 ; alertShare 0 ; blend = 0.6*0 + 0.4*0.52 = 0.208
assert('structural = 0.52', Math.abs(struct.structural - 0.52) < 1e-6, 'structural=' + struct.structural);
assert('blend = 0.4*structural = 0.208', Math.abs(struct.stress - 0.208) < 1e-6, 'stress=' + struct.stress);

console.log('T6: energy-shaped live case reads low (feed said 100%)');
// 16 scored, 3 alerting (Chevron/Constellation-style), p3_count 2 — like the live snapshot
var companies16 = [];
for (var i = 0; i < 16; i++) companies16.push(co(i < 3, i < 3 ? 'UNRECOVERED_P3' : 'RECOVERED'));
var energy = G.compute(join(companies16, { p3_count: 2 }));
// alertShare = 3/16 = 0.1875 ; structural = (0+0+2*0.6)/16 = 0.075 ; blend = 0.6*0.1875 + 0.4*0.075 = 0.1425
assert('energy grounded stress ~0.14 (not 1.0)', Math.abs(energy.stress - 0.1425) < 0.01, 'stress=' + energy.stress);
assert('reads far below the feed-stress 1.0', energy.stress < 0.25);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
