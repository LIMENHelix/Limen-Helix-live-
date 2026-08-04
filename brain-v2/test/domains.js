/**
 * brain-v2/test/domains.js — the all-domain contract.
 *
 *   node brain-v2/test/domains.js
 *
 * Answers one question the system could not previously answer at all: of the twenty
 * canonical domains, which are actually bound, which are merely declared, and which are
 * neither — with a reason for each.
 *
 * THE ANSWER IS DELIBERATELY UNFLATTERING. One domain is bound with data behind it. The
 * distinction between BOUND and MANIFEST-ONLY is the whole point of the file: writing
 * nineteen more manifests would be a day's work and would let the system report "20
 * domains bound" while exactly one had ever seen a real observation. A manifest is a
 * claim about what a domain WOULD observe; only a fixture makes it a claim about what it
 * DID.
 *
 * The compatibility assertions matter as much as the survey. Energy is the only domain
 * with a real fixture, and every number on the scorecard is quoted against its exact
 * readings — so the factory refactor is pinned to a hash rather than to a hope.
 */

'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var REG = require('../bind/registry.js');
var FACTORY = require('../bind/factory.js');
var ENERGY = require('../bind/energy.js');
var FINANCE = require('../bind/finance.js');
var L = require('../kernel/lateral.js');
var PK = require('../kernel/packet.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

console.log('');
console.log('=== ALL-DOMAIN CONTRACT ===');
console.log('');

// ── D1: the canonical list is the handler's list ─────────────────────────────
(function () {
  console.log('D1: the registry enumerates the same 20 domains the snapshot handler does');
  assert('twenty canonical domains', REG.CANONICAL.length === 20, String(REG.CANONICAL.length));

  /**
   * READ OUT OF THE HANDLER, not trusted. The registry copies the list deliberately —
   * requiring domain-snapshot.js pulls in the whole live-fetch surface — but a copy that
   * nobody checks is a copy that drifts. A domain added to the handler and forgotten here
   * would simply never appear in any survey, which is the silent-omission failure this
   * whole file exists to prevent.
   */
  var src = fs.readFileSync(path.join(__dirname, '..', '..', 'handlers', 'domain-snapshot.js'), 'utf8');
  var m = src.match(/var keys = \[([^\]]+)\]/);
  assert('the handler still declares its domain list in the expected form', !!m);
  if (m) {
    var handlerKeys = m[1].split(',').map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
    assert('and the registry matches it exactly, in the same order',
      JSON.stringify(handlerKeys) === JSON.stringify(REG.CANONICAL),
      'handler ' + handlerKeys.length + ' vs registry ' + REG.CANONICAL.length + '; diff: ' +
      handlerKeys.filter(function (k) { return REG.CANONICAL.indexOf(k) < 0; }).join(',') + ' / ' +
      REG.CANONICAL.filter(function (k) { return handlerKeys.indexOf(k) < 0; }).join(','));
  }
})();

// ── D2: THE SURVEY ───────────────────────────────────────────────────────────
(function () {
  console.log('D2: every canonical domain reports a state and a reason');
  var rows = REG.survey();
  console.log('');
  console.log('  ' + pad('domain', 16) + pad('state', 16) + pad('ch', 5) + pad('rel', 5) + pad('find', 6) + 'why');
  console.log('  ' + '-'.repeat(104));
  rows.forEach(function (r) {
    console.log('  ' + pad(r.domain, 16) + pad(r.state, 16) + pad(r.channels || '-', 5) +
      pad(r.relationships === undefined ? '-' : r.relationships, 5) +
      pad(r.findings === undefined ? '-' : r.findings, 6) + String(r.why).slice(0, 60));
  });
  console.log('');

  assert('every domain has a state', rows.every(function (r) { return !!r.state; }));
  assert('and every one states WHY, not just what',
    rows.every(function (r) { return typeof r.why === 'string' && r.why.length > 20; }));
  assert('no domain reports a state outside the three declared ones',
    rows.every(function (r) { return [REG.STATE.BOUND, REG.STATE.MANIFEST_ONLY, REG.STATE.UNBOUND].indexOf(r.state) >= 0; }));

  var s = REG.summary();
  console.log('  ' + s.why);
  console.log('');

  /* THE HEADLINE, and it is not the binder count. */
  assert('exactly ONE domain is bound with data behind it', s.byState[REG.STATE.BOUND] === 1,
    JSON.stringify(s.bound));
  assert('and it is energy, the only domain with a fixture', s.bound[0] === 'energy', String(s.bound[0]));
  assert('finance is MANIFEST-ONLY, not bound — a second manifest is not a second domain',
    s.manifestOnly.indexOf('finance') >= 0 && s.bound.indexOf('finance') < 0,
    JSON.stringify(s.manifestOnly));
  assert('and its reason names the missing fixture',
    /no fixture at/.test(REG.inspect('finance').why), REG.inspect('finance').why);
  assert('the remaining eighteen are unbound, each saying so',
    s.byState[REG.STATE.UNBOUND] === 18, String(s.byState[REG.STATE.UNBOUND]));
})();

// ── D3: energy is the compatibility reference, pinned to a hash ──────────────
(function () {
  console.log('D3: the factory did not change the one domain with real measurements behind it');
  /**
   * Byte-identity against the hand-written manifest the factory replaced. Energy is the
   * only domain with a fixture, so every acceptance number and every scorecard row is
   * quoted against these exact readings; a factory that silently altered them would
   * invalidate all of them at once and nothing else would notice.
   *
   * One near miss, recorded because it was caught by this and not by review: the factory's
   * readRecorderRow first branched on `field === 'recent7d'` to read `s.r7`, which reads
   * as an obvious correction of a real live-vs-replay asymmetry. The recorder only began
   * storing `r7` on 2026-08-01 and this fixture predates it — 0 of 6516 recorded source
   * entries carry `r7` — so the "fix" would have dropped all thirteen news-derived
   * channels to nothing.
   */
  var SPEC_SHA = '56505177dbe1b504cb42267806862e38a97e7fcfc9c26e2070663d145cd1d4f6';
  var READ_SHA = '7d8c6c687ba1f7f659ef41bd9ee90ab5aa86f2a1fecfab74297376b583499201';

  assert('energy spec() is byte-identical to the pre-factory manifest',
    sha(JSON.stringify(ENERGY.spec())) === SPEC_SHA, sha(JSON.stringify(ENERGY.spec())));

  var rows = require('../fixtures/energy-recorder.json').rows;
  var all = rows.map(function (r) { return JSON.stringify(ENERGY.readRecorderRow(r)); }).join('|');
  assert('and readRecorderRow is identical across all ' + rows.length + ' recorded rows',
    sha(all) === READ_SHA, sha(all));

  /* The findings' test functions do not survive JSON, so they are checked separately —
     a hash that silently omitted them would pass while every rule had been replaced. */
  assert('all six findings survive with their ids, requirements and callable tests',
    ENERGY.FINDINGS.length === 6 &&
    ENERGY.FINDINGS.every(function (f) { return f.id && Array.isArray(f.requires) && typeof f.test === 'function'; }),
    String(ENERGY.FINDINGS.length));
  assert('and the exported surface is unchanged',
    ['domain', 'CHANNELS', 'RELATIONSHIPS', 'FINDINGS', 'SIGMA', 'readLive', 'readRecorderRow', 'spec']
      .every(function (k) { return ENERGY[k] !== undefined; }));
})();

// ── D4: the factory refuses a fabricated relationship ────────────────────────
(function () {
  console.log('D4 [adversarial]: a relationship to a channel that does not exist is refused');
  var chans = [{ key: 'a', name: 'A', field: 'value', source: 's', cadenceMs: 3600000, units: 'u', q: 0.02, r: 0.05 }];

  function build(extra) {
    return FACTORY.createBinder(Object.assign({
      domain: 'test', version: 'v', levelsPerSensor: 3, sigma: 2.0, channels: chans
    }, extra));
  }

  var threw = false;
  try { build({ relationships: [{ a: 'a', b: 'ghost', latent: 'invented', expect: 'agree' }] }); }
  catch (e) { threw = /does not declare/.test(e.message); }
  assert('a relationship naming an undeclared channel throws', threw);

  threw = false;
  try { build({ relationships: [{ a: 'a', b: 'a', latent: '', expect: 'agree' }] }); }
  catch (e) { threw = /must name the latent|does not declare/.test(e.message); }
  assert('a relationship with no stated latent throws', threw);

  threw = false;
  try { build({ findings: [{ id: 'F', requires: ['ghost'], test: function () { return false; } }] }); }
  catch (e) { threw = /does not declare/.test(e.message); }
  assert('a finding requiring an undeclared channel throws — it could never fire', threw);

  threw = false;
  try {
    FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
      channels: [{ key: 'x', name: 'X', field: 'value', source: 's', units: 'u' }] });
  } catch (e) { threw = /must declare its own cadence/.test(e.message); }
  assert('a channel with no declared cadence throws', threw);

  threw = false;
  try {
    FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
      channels: [{ key: 'x', name: 'X', field: 'value', source: 's', cadenceMs: 1000 }] });
  } catch (e) { threw = /must declare units/.test(e.message); }
  assert('a channel with no declared units throws', threw);
})();

// ── D5: finance declares only what its fetchers verifiably measure ───────────
(function () {
  console.log('D5: the finance manifest is grounded, and small on purpose');
  var spec = FINANCE.spec();
  assert('finance declares thirteen channels', spec.channels.length === 13, String(spec.channels.length));
  assert('every channel declares units, cadence and a source', spec.channels.every(function (c) {
    return c.units && c.cadenceMs > 0 && c.source;
  }));
  assert('every channel declares its own q and r priors',
    spec.channels.every(function (c) { return typeof c.q === 'number' && typeof c.r === 'number'; }));

  /* THE THREE RELATIONSHIPS, and only three. All are the same instrument read by
     different vendors — verified from the fetch URLs, which name SPY explicitly. */
  assert('finance declares exactly three relationships', spec.relationships.length === 3,
    String(spec.relationships.length));
  assert('and all three are the one latent that the code establishes',
    spec.relationships.every(function (r) { return r.latent === 'SPY price level'; }),
    JSON.stringify(spec.relationships.map(function (r) { return r.latent; })));
  var priced = spec.channels.filter(function (c) { return c.units === '$/share'; }).map(function (c) { return c.key; });
  assert('every side of every relationship is one of the three SPY-priced channels',
    spec.relationships.every(function (r) { return priced.indexOf(r.a) >= 0 && priced.indexOf(r.b) >= 0; }),
    JSON.stringify(priced));
  assert('it is a full triangle, so no single absent vendor kills every pair',
    spec.relationships.length === 3 && priced.length === 3);

  /* NOTHING relates the keyword-count channels. Plausible is not verified, and a wrong
     declaration is worse than a missing one: divergence would grade a real relationship
     against a latent nobody can defend. */
  var counted = spec.channels.filter(function (c) { return c.units === 'keyword mentions'; }).map(function (c) { return c.key; });
  /* FOUR, not five. FINRA looked like the fifth and is not: its fetcher counts `<item>`
     tags in the feed, while FDIC, OCC, CFTC and NCUA each count regex matches against a
     keyword list. Counting documents and counting mentions of a word inside documents are
     different measurements, and the units say which. Checked in the fetchers, not guessed
     from the source names. */
  assert('the four keyword-match channels exist and are honestly labelled',
    counted.length === 4 && counted.join() === 'fdic,occ,cftc,ncua', JSON.stringify(counted));
  assert('and FINRA is NOT among them — it counts feed items, not keyword matches',
    counted.indexOf('finra') < 0 &&
    spec.channels.filter(function (c) { return c.key === 'finra'; })[0].units === 'disciplinary entries');
  assert('and NONE of them is related to anything — plausible is not verified',
    spec.relationships.every(function (r) { return counted.indexOf(r.a) < 0 && counted.indexOf(r.b) < 0; }));

  /* Findings must rest on real quantities, not on publication counts. */
  var countedSet = {}; counted.forEach(function (k) { countedSet[k] = true; });
  assert('no finding is built on a keyword-count channel',
    spec.findings.every(function (f) { return (f.requires || []).every(function (k) { return !countedSet[k]; }); }),
    JSON.stringify(spec.findings.map(function (f) { return f.requires; })));
  assert('and every finding has a stated basis', spec.findings.every(function (f) { return !!f.basis; }));
})();

// ── D6: finance behaves as a real peer on the lateral bus ────────────────────
(function () {
  console.log('D6: finance participates as a peer, and nothing crosses without a declared latent');
  var T0 = 1e12;
  var bus = L.createBus();
  L.register(bus, 'energy', T0);
  L.register(bus, 'finance', T0);

  /**
   * NO CROSS-DOMAIN LINK IS DECLARED, and that is the correct state. Energy and finance
   * plausibly share latents — an oil shock and a market move are not unrelated — but
   * "plausibly" is exactly the standard this project refuses. Nothing in either binder
   * establishes a common observable, so no link exists and nothing crosses.
   */
  var r = L.publish(bus, 'finance', { latent: 'SPY price level', value: 500, precision: 4 }, T0 + 1);
  assert('with no declared link, a finance observation reaches nobody',
    r.delivered.length === 0, JSON.stringify(r.delivered));

  /* SYNTHETIC LINK, clearly labelled: the mechanism is exercised, the claim is not made. */
  L.link(bus, 'energy', 'finance', { at: T0, latent: 'synthetic test latent', why: 'mechanism exercise only, not a declared cross-domain claim' });
  var ok = L.publish(bus, 'energy', { latent: 'synthetic test latent', value: 1, precision: 4 }, T0 + 2);
  assert('once a link is declared, a packet crosses exactly one boundary',
    ok.delivered.length === 1 && ok.delivered[0].to === 'finance', JSON.stringify(ok.delivered.length));
  assert('and it arrives labelled foreign, with its origin intact',
    ok.delivered[0].provenance === 'foreign' && ok.delivered[0].from === 'energy');
  assert('carrying the bus-verified contributor chain',
    ok.delivered[0].contributors.join() === 'energy', ok.delivered[0].contributors.join());

  /* The mismatched latent must still not cross, even between linked peers. */
  var mismatch = L.publish(bus, 'energy', { latent: 'SPY price level', value: 1, precision: 4 }, T0 + 3);
  assert('a latent the link does not declare still crosses nothing',
    mismatch.delivered.length === 0, JSON.stringify(mismatch.delivered));

  /* Echo suppression across the two REAL domain ids. */
  var back = L.publish(bus, 'finance', { latent: 'synthetic test latent', value: 1, precision: 4 },
                       T0 + 4, { inheritedFrom: ok.delivered[0] });
  assert('finance cannot return energy its own signal as corroboration',
    back.delivered.length === 0 && /ECHO/.test(back.refused[0].why), JSON.stringify(back.refused));

  /* A finance domain that has measured nothing admits nothing, however much it is told. */
  assert('a domain with no measurements of its own admits no peer evidence',
    L.receive(bus, 'finance', 0).admitted.length === 0);

  /* And a lateral PACKET carrying a finance payload is well-formed under packet.js rules. */
  var pkt = PK.create({
    traceId: PK.newTraceId({ d: 'finance', t: T0 }), seq: 0,
    sourceDomain: 'finance', sourceModule: 'bind/finance',
    signalKind: PK.KIND.OBSERVATION, role: PK.ROLE.DRIVER, direction: PK.DIRECTION.LATERAL,
    payload: { channel: 'finnhub', value: 500 },
    eventTime: T0, observationTime: T0, processingTime: T0,
    simulationStatus: PK.STATUS.OBSERVED, confidence: null, salience: null
  });
  assert('a lateral packet from finance constructs and carries its domain',
    pkt.sourceDomain === 'finance' && pkt.direction === PK.DIRECTION.LATERAL);
  assert('and row 24 is still NOT satisfied — the bus says so itself',
    L.report(bus).satisfiesRow24 === false);
})();

// ── D7: no row is advanced by any of this ────────────────────────────────────
(function () {
  console.log('D7: binding a second manifest advances no checklist row');
  var s = REG.summary();
  /**
   * Stated as an assertion so it cannot quietly stop being true. Row 24 asks whether peer
   * domains inform each other usefully. Finance has a manifest and no observations, and
   * there is no declared cross-domain latent, so nothing here is evidence about that
   * question. The moment a finance fixture exists this assertion will need revisiting on
   * evidence — not before.
   */
  assert('finance has no fixture, so no cross-domain observation has ever occurred',
    REG.inspect('finance').fixture === false);
  assert('and the bound count is still one',
    s.byState[REG.STATE.BOUND] === 1, String(s.byState[REG.STATE.BOUND]));
  assert('so row 24 remains blocked on real second-domain observations, not on a binder',
    L.report(L.createBus()).satisfiesRow24 === false);
})();

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('BOUND WITH DATA: 1 of 20 (energy). Finance is declared and unobserved.');
console.log('Rows 10, 22, 24 and 25 are unchanged by this file and remain evidence-blocked.');
console.log('');
process.exit(failures ? 1 : 0);
