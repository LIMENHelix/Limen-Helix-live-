/**
 * scripts/test-transfer-ledger.js — CrossDomainEvidencePacket + receiving-domain disposition (gating)
 * + the tamper-evident transfer ledger. Run: node scripts/test-transfer-ledger.js
 *
 *   T1  packet build: required fields validated; relationType never 'proximity'; honest defaults
 *   T2  disposition: contradicting local evidence ⇒ rejected
 *   T3  disposition: uncalibrated source ⇒ requires-review (never auto-accept)
 *   T4  disposition: calibrated + overlap + relation ⇒ accepted with a weight; unknown+no-overlap ⇒ deferred
 *   T5  transfer ledger: receipt recorded on the immutable audit chain; verifies
 *   T6  outcome recorded + uplift readout is OBSERVATIONAL and abstains below the min
 *   T7  uplift: net improved ⇒ net-positive-observational (never claims "works")
 */
var EP = require('../lib/evidence-packet');
var TL = require('../lib/transfer-ledger');
var audit = require('../lib/audit-ledger');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

console.log('T1: packet build + validation');
var bad = EP.build({ sourceDomain: 'energy' });
assert('missing target+canonicalId ⇒ not ok', bad.ok === false && bad.errors.length >= 2);
var good = EP.build({ sourceDomain: 'energy', targetDomain: 'finance', canonicalId: 'GRID_STRESS', relationType: 'grid-connection', sourceConfidence: 0.8, calibrationState: 'calibrated', madeAt: 100, transmissionReason: 'upstream grid stress' });
assert('valid packet ⇒ ok', good.ok === true);
assert('relationType kept', good.packet.relationType === 'grid-connection');
var prox = EP.build({ sourceDomain: 'a', targetDomain: 'b', canonicalId: 'X', relationType: 'proximity' });
assert('proximity is NOT a valid relation ⇒ coerced to unknown', prox.packet.relationType === 'unknown');
assert('honest defaults (no fabricated confidence)', bad.packet.sourceConfidence === null && bad.packet.calibrationState === 'uncalibrated');

console.log('T2: contradicted by local evidence ⇒ rejected');
var d2 = EP.disposition(good.packet, { contradicts: true }, {});
assert('rejected', d2.disposition === 'rejected' && d2.weight === 0);

console.log('T3: uncalibrated source ⇒ requires-review');
var unc = EP.build({ sourceDomain: 'energy', targetDomain: 'finance', canonicalId: 'X', relationType: 'market-linkage', sourceConfidence: 0.9, calibrationState: 'self-consistency', madeAt: 1 });
var d3 = EP.disposition(unc.packet, { spatialOverlap: 1, temporalOverlap: 1, ontologyRelated: true }, {});
assert('requires-review (not auto-accepted despite high conf)', d3.disposition === 'requires-review', JSON.stringify(d3));

console.log('T4: accepted with weight; unknown+no-overlap ⇒ deferred');
var d4 = EP.disposition(good.packet, { spatialOverlap: 0.9, temporalOverlap: 1, ontologyRelated: true }, { usefulness: 0.7, samples: 5 });
assert('calibrated + overlap ⇒ accepted', d4.disposition === 'accepted', JSON.stringify(d4));
assert('weight in (0,1]', d4.weight > 0 && d4.weight <= 1);
var unknownPacket = EP.build({ sourceDomain: 'a', targetDomain: 'b', canonicalId: 'Y', calibrationState: 'calibrated', sourceConfidence: 0.6, spatialScope: { regionId: 'R1' }, madeAt: 2 });
var d4b = EP.disposition(unknownPacket.packet, { spatialOverlap: 0.0, temporalOverlap: 1 }, {});
assert('unknown relation + no spatial overlap ⇒ deferred', d4b.disposition === 'deferred', JSON.stringify(d4b));

console.log('T5-T7: transfer ledger on the immutable audit chain');
(async function () {
  var db = require('../lib/limen-db');
  var pkt = good.packet;
  var disp = EP.disposition(pkt, { spatialOverlap: 0.9, temporalOverlap: 1, ontologyRelated: true }, {});
  var rec = await TL.recordReceipt(db, pkt, disp, { changed: true, fields: ['attention'] }, 1000);
  assert('receipt returns a ref', typeof rec.ref === 'string' && rec.ref.indexOf('energy|GRID_STRESS') === 0);
  var v = await audit.verify(db, TL.stream('finance'));
  assert('transfer chain verifies (built on audit-ledger)', v.ok === true, JSON.stringify(v));

  // uplift before outcomes ⇒ insufficient-data
  var u0 = await TL.uplift(db, 'finance');
  assert('uplift abstains below min (insufficient-data)', u0.verdict === 'insufficient-data' && u0.observedUpliftRate === null);
  assert('uplift note disclaims baseline', /NOT a randomized no-transfer baseline/.test(u0.note));

  // record 10 receipts + outcomes: 7 improved, 2 worsened, 1 no-effect ⇒ net +5
  for (var i = 0; i < 10; i++) {
    var p = EP.build({ sourceDomain: 'energy', targetDomain: 'finance', canonicalId: 'C' + i, relationType: 'market-linkage', sourceConfidence: 0.8, calibrationState: 'calibrated', madeAt: 2000 + i }).packet;
    var dp = EP.disposition(p, { spatialOverlap: 1, temporalOverlap: 1, ontologyRelated: true }, {});
    var rr = await TL.recordReceipt(db, p, dp, { changed: true, fields: ['forecast'] }, 2000 + i);
    var verdict = i < 7 ? 'improved' : i < 9 ? 'worsened' : 'no-effect';
    await TL.recordOutcome(db, 'finance', rr.ref, verdict, verdict === 'improved' ? 0.05 : -0.03, 5000 + i);
  }
  var u = await TL.uplift(db, 'finance');
  assert('withOutcome counted (10)', u.withOutcome === 10, JSON.stringify(u));
  assert('improved 7 / worsened 2', u.improved === 7 && u.worsened === 2);
  assert('net-positive OBSERVATIONAL (not "works")', u.verdict === 'net-positive-observational' && /OBSERVATIONAL/.test(u.note));
  var vf = await audit.verify(db, TL.stream('finance'));
  assert('full transfer chain still verifies after 20+ appends', vf.ok === true, JSON.stringify(vf));

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
