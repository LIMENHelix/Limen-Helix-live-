/**
 * scripts/test-memory-tiers.js — five-tier memory model + evidence-gated promotion + explicit expiry.
 * Run: node scripts/test-memory-tiers.js
 *
 *   T1  tallyCandidates: counts recurrence of recommendation kinds across proposals; ignores 'none'
 *   T2  promote: below minRuns ⇒ held; >= minRuns ⇒ stabilized (NEVER validated); provenance carried
 *   T3  promote merges with existing semantic records (updates runs/lastSeen)
 *   T4  pruneExpired: explicit expiry past ttl with a reason; fresh records kept
 *   T5  handler: ?run=1 promotes into semantic:<domain>; ?domain reads it; applies nothing; no "validated"
 */
var M = require('../lib/memory-tiers');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

function prop(gen, kinds) { return { generatedAt: gen, recommendations: kinds.map(function (k) { return { kind: k, reason: k + ' reason' }; }) }; }

console.log('T1: tallyCandidates');
var proposals = [
  prop(3000, ['downscale-confidence', 'promotion-candidate']),
  prop(2000, ['downscale-confidence', 'none']),
  prop(1000, ['downscale-confidence'])
];
var cands = M.tallyCandidates(proposals);
var dc = cands.filter(function (c) { return c.kind === 'downscale-confidence'; })[0];
assert('downscale-confidence recurred 3x', dc && dc.runs === 3, JSON.stringify(cands));
assert('firstSeen/lastSeen span captured', dc.firstSeen === 1000 && dc.lastSeen === 3000);
assert("'none' ignored", !cands.some(function (c) { return c.kind === 'none'; }));

console.log('T2: promote gates on minRuns; stabilized never validated');
var pr = M.promote('energy', cands, [], { minRuns: 3 });
assert('downscale-confidence promoted (3 >= 3)', pr.promoted.indexOf('downscale-confidence') !== -1, JSON.stringify(pr.promoted));
assert('promotion-candidate held (1 < 3)', pr.held.some(function (h) { return h.pattern === 'promotion-candidate'; }));
var rec = pr.semantic.filter(function (r) { return r.pattern === 'downscale-confidence'; })[0];
assert('status stabilized, validated:false', rec.status === 'stabilized' && rec.validated === false);
assert('provenance carried', rec.provenance && rec.provenance.promotedFrom === 'consolidation:hist' && rec.provenance.evidenceRuns === 3);
assert('reversible flag set', rec.reversible === true);

console.log('T3: merge with existing');
var pr2 = M.promote('energy', cands, pr.semantic, { minRuns: 3 });
assert('merged, not duplicated', pr2.semantic.filter(function (r) { return r.pattern === 'downscale-confidence'; }).length === 1);

console.log('T4: explicit expiry');
var DAY = 24 * 3600 * 1000, nowT4 = 40 * DAY;
var old = [{ pattern: 'x', lastSeen: 0 }, { pattern: 'y', lastSeen: nowT4 - 10 * DAY }];   // x 40d stale, y 10d fresh
var pruned = M.pruneExpired(old, nowT4, {});
assert('stale record pruned with reason', pruned.pruned.length === 1 && pruned.pruned[0].pattern === 'x' && /no recurrence/.test(pruned.pruned[0].reason), JSON.stringify(pruned));
assert('fresh record kept', pruned.kept.some(function (r) { return r.pattern === 'y'; }));

console.log('T5: handler run + read (in-memory db)');
(async function () {
  var db = require('../lib/limen-db');
  var base = Date.now(), D = 24 * 3600 * 1000;   // recent generatedAt so the promoted record isn't instantly expired
  await db.set('feedhist:index', ['energy']);
  await db.lpush('consolidation:hist:energy', prop(base, ['downscale-confidence']));
  await db.lpush('consolidation:hist:energy', prop(base - D, ['downscale-confidence']));
  await db.lpush('consolidation:hist:energy', prop(base - 2 * D, ['downscale-confidence']));
  var handler = require('../handlers/memory-promote');
  function call(url) { return new Promise(function (resolve) { var res = { setHeader: function () {}, statusCode: 200, end: function (b) { resolve({ status: res.statusCode, json: JSON.parse(b || '{}') }); } }; handler({ method: 'GET', url: url, headers: {} }, res); }); }
  var run = await call('/api/memory-promote?run=1');
  assert('run promoted downscale-confidence', run.json.ok && run.json.results[0] && run.json.results[0].promoted.indexOf('downscale-confidence') !== -1, JSON.stringify(run.json));
  assert('applied nothing', run.json.appliedAnything === false);
  var read = await call('/api/memory-promote?domain=energy');
  assert('semantic store readable', read.json.ok && read.json.semantic.length >= 1);
  assert('no record claims validated', read.json.semantic.every(function (r) { return r.validated === false; }));
  var tiers = await call('/api/memory-promote?tiers=1');
  assert('tier map exposed (5 tiers)', tiers.json.ok && Object.keys(tiers.json.tiers).length === 5);

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
