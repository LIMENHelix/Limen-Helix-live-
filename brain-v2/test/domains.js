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
var NAMES = require('../../lib/domain-names.js');
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

// ── D1: both naming systems, and the handler's list ─────────────────────────
(function () {
  console.log('D1: the registry carries BOTH names for all 20 domains');
  assert('twenty snapshot keys', REG.SNAPSHOT_KEYS.length === 20, String(REG.SNAPSHOT_KEYS.length));
  assert('twenty product keys', REG.PRODUCT_KEYS.length === 20, String(REG.PRODUCT_KEYS.length));

  /**
   * READ OUT OF THE HANDLER, not trusted. The registry copies the snapshot list
   * deliberately — requiring domain-snapshot.js pulls in the whole live-fetch surface —
   * but a copy nobody checks is a copy that drifts. A domain added there and forgotten
   * here would never appear in any survey, which is the silent omission this file exists
   * to prevent.
   */
  var src = fs.readFileSync(path.join(__dirname, '..', '..', 'handlers', 'domain-snapshot.js'), 'utf8');
  var m = src.match(/var keys = \[([^\]]+)\]/);
  assert('the handler still declares its domain list in the expected form', !!m);
  if (m) {
    var handlerKeys = m[1].split(',').map(function (x) { return x.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
    assert('and the SNAPSHOT keys match it exactly, in order',
      JSON.stringify(handlerKeys) === JSON.stringify(REG.SNAPSHOT_KEYS),
      'handler ' + handlerKeys.length + ' vs registry ' + REG.SNAPSHOT_KEYS.length);
  }

  /**
   * THE THREE ALIASES. LIMEN has always carried two names for these, and the first
   * version of the registry listed only the runtime keys and called them canonical —
   * so "20/20 domains" would have described the runtime layer while reading as a
   * statement about the product, with the three aliased domains invisible under the
   * names the portals actually use.
   */
  var aliased = REG.DOMAINS.filter(function (d) { return d.aliased; });
  assert('exactly three domains carry two names', aliased.length === 3, String(aliased.length));
  var pairs = aliased.map(function (d) { return d.product + '->' + d.snapshot; }).sort().join(',');
  assert('and they are medicine/health, science/research, trade/supplyChain',
    pairs === 'medicine->health,science->research,trade->supplyChain', pairs);

  /* The mapping is NOT redeclared in the registry — lib/domain-names.js owns it, and its
     own header records that hand-copying it into eight files WAS the bug. */
  assert('the aliases come from lib/domain-names.js, not a ninth copy',
    NAMES.toRuntime('medicine') === 'health' && NAMES.toCanonical('supplyChain') === 'trade');
  assert('and the registry agrees with it for every domain',
    REG.DOMAINS.every(function (d) {
      return NAMES.toRuntime(d.product) === d.snapshot && NAMES.toCanonical(d.snapshot) === d.product;
    }));

  /* Lookup must work from either side, or a caller holding a portal name finds nothing. */
  assert('a domain is findable by its product name', REG.inspect('medicine').snapshot === 'health');
  assert('and by its snapshot key', REG.inspect('health').product === 'medicine');
  assert('trade and supplyChain resolve to one descriptor',
    REG.inspect('trade').snapshot === 'supplyChain' && REG.inspect('supplyChain').product === 'trade');
  assert('an unknown name is refused rather than invented',
    REG.inspect('not-a-domain').state === REG.STATE.UNBOUND &&
    /not one of the 20/.test(REG.inspect('not-a-domain').why));
})();

// ── D2: THE SURVEY ───────────────────────────────────────────────────────────
(function () {
  console.log('D2: every canonical domain reports a state and a reason');
  var rows = REG.survey();
  console.log('');
  console.log('  ' + pad('product', 15) + pad('snapshot', 15) + pad('state', 16) + pad('ch', 5) + pad('rel', 5) + pad('find', 6) + 'why');
  console.log('  ' + '-'.repeat(112));
  rows.forEach(function (r) {
    console.log('  ' + pad(r.product, 15) + pad(r.snapshot, 15) + pad(r.state, 16) + pad(r.channels || '-', 5) +
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
  assert('four domains are declared but unobserved',
    s.byState[REG.STATE.MANIFEST_ONLY] === 4, JSON.stringify(s.manifestOnly));
  assert('and the remaining fifteen are unbound, each saying so',
    s.byState[REG.STATE.UNBOUND] === 15, String(s.byState[REG.STATE.UNBOUND]));
  /* The arithmetic, so a domain can never be counted twice or vanish between states as
     batches land. The explicit numbers above move with each batch on purpose — a change
     to them should be a deliberate line in a diff, not something that drifts. */
  assert('every domain is in exactly one state, summing to twenty',
    s.byState[REG.STATE.BOUND] + s.byState[REG.STATE.MANIFEST_ONLY] + s.byState[REG.STATE.UNBOUND] === 20,
    JSON.stringify(s.byState));
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
  /* UPDATED 2026-08-04 when every channel gained an explicit `recordedField`. The spec
     hash SHOULD move when the manifest gains a field; what must NOT move is READ_SHA,
     which is the behavioural guarantee. It did not — the readings are byte-identical, so
     energy declaring its legacy `v` explicitly changed the declaration and nothing else.
     Previous: 56505177dbe1b504cb42267806862e38a97e7fcfc9c26e2070663d145cd1d4f6 */
  var SPEC_SHA = 'f3caed39f9d0909b6dd4593192eebf189f7e3c8aac88a2327fb4d3a0a69c3a2b';
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

// D3b: the recorded field is DECLARED, never guessed
(function () {
  console.log('D3b [regression]: a channel reads the recorded key it declares');
  /**
   * THE DEFECT. The factory read `s.v` for every channel, including ones declared
   * `field: 'recent7d'`. Correct for the energy fixture, which predates the recorder
   * storing `r7`, and silently wrong for every domain recorded after it. Probed with
   * `{v:1, r7:9}` on a recent7d channel, it returned 1.
   *
   * `field` says which value the LIVE snapshot carries; `recordedField` says which key
   * the RECORDER wrote. Two different questions, so neither is inferred from the other.
   */
  function ch(key, recordedField) {
    return { key: key, name: key.toUpperCase(), recordedField: recordedField, field: 'recent7d',
             source: 's', cadenceMs: 3600000, units: 'articles/7d', q: 0.06, r: 0.25 };
  }
  var b = FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
    channels: [ch('legacy', 'v'), ch('modern', 'r7')] });

  var read = b.readRecorderRow({ src: [{ n: 'LEGACY', v: 1, r7: 9 }, { n: 'MODERN', v: 1, r7: 9 }] });
  assert('a channel declaring v reads v, from a row carrying both',
    read.legacy.value === 1, JSON.stringify(read.legacy));
  assert('a channel declaring r7 reads r7, from the SAME row',
    read.modern.value === 9, JSON.stringify(read.modern));

  var threw = false;
  try { FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
    channels: [{ key: 'x', name: 'X', field: 'value', source: 's', cadenceMs: 1000, units: 'u' }] }); }
  catch (e) { threw = /must declare .recordedField./.test(e.message); }
  assert('a channel that declares no recordedField is refused', threw);

  threw = false;
  try { FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
    channels: [{ key: 'x', name: 'X', recordedField: 'nope', field: 'value', source: 's', cadenceMs: 1000, units: 'u' }] }); }
  catch (e) { threw = /the recorder never writes/.test(e.message); }
  assert('a recordedField the recorder never writes is refused, not silently undefined', threw);

  /* ENERGY DECLARES THE LEGACY CHOICE DELIBERATELY, on all eighteen channels including
     its thirteen recent7d ones, because 0 of that fixture's 6516 source entries carry
     `r7`. It is a written-down decision now, not a default that happened to be right. */
  assert('energy declares recordedField on every channel',
    ENERGY.CHANNELS.every(function (c) { return !!c.recordedField; }));
  assert('and every one of them is the legacy v, on purpose',
    ENERGY.CHANNELS.every(function (c) { return c.recordedField === 'v'; }));
  assert('including the thirteen declared recent7d, which is the deliberate part',
    ENERGY.CHANNELS.filter(function (c) { return c.field === 'recent7d'; })
      .every(function (c) { return c.recordedField === 'v'; }),
    String(ENERGY.CHANNELS.filter(function (c) { return c.field === 'recent7d'; }).length));
  assert('finance declares it on every channel too',
    FINANCE.CHANNELS.every(function (c) { return !!c.recordedField; }));
})();

// D3c: BOUND is earned by reading the fixture, not by its filename
(function () {
  console.log('D3c [regression]: a fixture must be readable before a domain counts as bound');
  /**
   * THE DEFECT. `inspect()` promoted a domain to BOUND on `fs.existsSync` alone. An
   * empty `{"rows":[]}` written to fixtures/finance-recorder.json reported BOUND —
   * measured, not hypothesised.
   *
   * AND THE DEFECT IN THE FIRST TEST FOR IT, which was worse. It wrote that file into
   * `brain-v2/fixtures/` and removed it in a `finally`. That works exactly until finance
   * has a real fixture, at which point running the suite DELETES evidence somebody spent
   * a week recording — an unlinkSync cannot tell a temp file it created from a corpus. A
   * test that can destroy real data is a worse defect than the one it covers.
   *
   * So validation is a pure function over a DOCUMENT and every case below is in memory.
   * Nothing in this file touches the fixtures directory.
   */
  var d = REG.descriptorFor('finance');
  var FIN = require('../bind/finance.js');
  var V = function (doc) { return REG.validateFixtureDocument(d, FIN, doc); };
  var goodRow = { t: 1, src: [{ n: 'Finnhub Market', v: 5 }] };

  assert('an empty rows array is refused', V({ domain: 'finance', rows: [] }).usable === false);
  assert('and says an empty file is not data', /not data/.test(V({ domain: 'finance', rows: [] }).why));

  var wrong = V({ domain: 'energy', rows: [goodRow] });
  assert('a document declaring another domain is refused',
    wrong.usable === false && /declares domain/.test(wrong.why), wrong.why);

  var alien = V({ rows: [{ t: 1, src: [{ n: 'Some Other Domain Source', v: 5 }] }] });
  assert('a document this binder cannot read a single channel from is refused',
    alien.usable === false && /produced no readings/.test(alien.why), alien.why);

  assert('unparseable text is refused rather than throwing',
    V('{not json').usable === false && /unparseable/.test(V('{not json').why));
  assert('a document with no rows array at all is refused',
    V({ domain: 'finance' }).usable === false && /not a recorder dump/.test(V({ domain: 'finance' }).why));
  assert('null is refused', V(null).usable === false);

  assert('and a document the binder CAN read is accepted', V({ domain: 'finance', rows: [goodRow] }).usable === true);

  /* An aliased fixture declaring its PRODUCT name must match its snapshot filing, or
     every medicine fixture would be refused for declaring `medicine` while filed as
     `health`. Compared through toRuntime for exactly that reason. */
  var med = REG.descriptorFor('medicine');
  assert('a fixture declaring the product name matches its snapshot filing',
    REG.validateFixtureDocument(med, ENERGY, { domain: 'medicine', rows: [{ t: 1, src: [] }] }).why
      .indexOf('declares domain') < 0);

  /* Every refusal states a reason. "Not bound" with no cause sends someone to look at
     the binder when the fault is in the file. */
  assert('every refusal carries a stated reason',
    [V({ domain: 'finance', rows: [] }), V('{x'), V(null), alien, wrong]
      .every(function (r) { return typeof r.why === 'string' && r.why.length > 15; }));

  /* THE SAFETY PROPERTY ITSELF: this test wrote nothing. */
  assert('no finance fixture was created by running this test',
    !fs.existsSync(REG.fixturePath(d)), REG.fixturePath(d));
  assert('and the energy fixture is untouched and still readable',
    REG.inspect('energy').state === REG.STATE.BOUND);
})();

// D3d: every row is scanned, so a slow source is not mistaken for a broken one
(function () {
  console.log('D3d [regression]: readability is judged on ALL rows, not the first 24');
  /**
   * The scan was capped at 24 rows. A weekly release, or a feed that went quiet for a
   * fortnight and came back, can legitimately produce its first reading hundreds of rows
   * in — and the cap would classify that domain unreadable for a reason that is a fact
   * about our sampling rather than about the data. Fixtures are bounded at 500 rows, so
   * the whole scan is cheap and stops at the first readable row anyway.
   */
  var d = REG.descriptorFor('finance');
  var FIN = require('../bind/finance.js');
  function sparse(firstReadableAt, total) {
    var rows = [];
    for (var i = 0; i < total; i++) rows.push({ t: i, src: [{ n: 'Unrelated Source', v: 1 }] });
    rows[firstReadableAt] = { t: firstReadableAt, src: [{ n: 'Finnhub Market', v: 5 }] };
    return { domain: 'finance', rows: rows };
  }
  var late = REG.validateFixtureDocument(d, FIN, sparse(300, 400));
  assert('a source first readable at row 300 of 400 is accepted', late.usable === true, late.why);
  assert('and the report says where it first became readable', late.scannedRows === 301, String(late.scannedRows));

  var justPastOldCap = REG.validateFixtureDocument(d, FIN, sparse(24, 60));
  assert('a source first readable at row 24 — one past the old cap — is accepted',
    justPastOldCap.usable === true, justPastOldCap.why);

  var never = REG.validateFixtureDocument(d, FIN, sparse(-1, 500));
  assert('a fixture readable on NO row is still refused, having scanned all 500',
    never.usable === false && /any of the 500 rows/.test(never.why), never.why);
})();

// D3e: the two naming systems resolve to the right artefacts, before any binder exists
(function () {
  console.log('D3e: aliased domains resolve to the correct binder, feed key and fixture name');
  /**
   * These three have no binder yet and are not being written here. What is asserted is
   * that when one IS written, every artefact will be looked for in the right place —
   * because getting it wrong fails silently in both directions: `--domain health` hunts
   * for a `bind/health.js` that will never exist, and `--domain medicine` queries a
   * `feedhist:medicine` the recorder never writes. Both read as "this domain has no data".
   */
  [['medicine', 'health'], ['science', 'research'], ['trade', 'supplyChain']].forEach(function (pair) {
    var product = pair[0], snapshot = pair[1];
    [product, snapshot].forEach(function (given) {
      var d = REG.descriptorFor(given);
      assert('"' + given + '" resolves to product ' + product + ' and snapshot ' + snapshot,
        d && d.product === product && d.snapshot === snapshot, JSON.stringify(d));
      assert('  its binder is bind/' + product + '.js',
        path.basename(REG.binderPath(d)) === product + '.js', REG.binderPath(d));
      assert('  its fixture is ' + snapshot + '-recorder.json',
        path.basename(REG.fixturePath(d)) === snapshot + '-recorder.json', REG.fixturePath(d));
      assert('  and the feed key is the snapshot one',
        NAMES.toRuntime(given) === snapshot, NAMES.toRuntime(given));
    });
    /* RESOLUTION IS INDEPENDENT OF EXISTENCE, and that is now testable in both
       directions: medicine has a binder and science and trade do not, yet all three
       resolve identically. When this was written none of them existed; keeping the
       assertion as "none exists" would have made it expire the moment a batch landed. */
    var exists = fs.existsSync(REG.binderPath(REG.descriptorFor(product)));
    assert('  resolves the same whether its binder exists (' + exists + ') or not',
      REG.descriptorFor(product).snapshot === snapshot &&
      REG.descriptorFor(snapshot).binder === product);
  });

  /* Unaliased domains must be unaffected — the mapping passes them through unchanged. */
  ['energy', 'finance', 'law'].forEach(function (k) {
    var d = REG.descriptorFor(k);
    assert('"' + k + '" is unaliased and both names agree',
      d.product === k && d.snapshot === k && d.aliased === false);
  });
})();

// ── D4: the factory refuses a fabricated relationship ────────────────────────
(function () {
  console.log('D4 [adversarial]: a relationship to a channel that does not exist is refused');
  var chans = [{ key: 'a', name: 'A', recordedField: 'v', field: 'value', source: 's', cadenceMs: 3600000, units: 'u', q: 0.02, r: 0.05 }];

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
      channels: [{ key: 'x', name: 'X', recordedField: 'v', field: 'value', source: 's', units: 'u' }] });
  } catch (e) { threw = /must declare its own cadence/.test(e.message); }
  assert('a channel with no declared cadence throws', threw);

  threw = false;
  try {
    FACTORY.createBinder({ domain: 't', version: 'v', levelsPerSensor: 3, sigma: 2,
      channels: [{ key: 'x', name: 'X', recordedField: 'v', field: 'value', source: 's', cadenceMs: 1000 }] });
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

// D8: the Economy / Environment / Medicine batch
(function () {
  console.log('D8: three new binders, declared against the sources that actually exist');
  var ECONOMY = require('../bind/economy.js');
  var ENVIRONMENT = require('../bind/environment.js');
  var MEDICINE = require('../bind/medicine.js');
  var batch = [
    { b: ECONOMY,     product: 'economy',     snapshot: 'economy',     channels: 15 },
    { b: ENVIRONMENT, product: 'environment', snapshot: 'environment', channels: 10 },
    { b: MEDICINE,    product: 'medicine',    snapshot: 'health',      channels: 15 }
  ];

  /**
   * EVERY DECLARED CHANNEL MUST NAME A SOURCE THE SNAPSHOT ACTUALLY EMITS. Read out of
   * handlers/domain-snapshot.js rather than trusted: a channel naming a source that does
   * not exist reads nothing forever, and "no data" is indistinguishable from a domain
   * that is simply quiet.
   */
  var snapSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'handlers', 'domain-snapshot.js'), 'utf8');
  var declaredNames = {};
  var re = /src\('([^']+)'/g, m;
  while ((m = re.exec(snapSrc)) !== null) declaredNames[m[1]] = true;

  batch.forEach(function (e) {
    var spec = e.b.spec();
    assert(e.product + ': declares ' + e.channels + ' channels', spec.channels.length === e.channels,
      String(spec.channels.length));
    assert(e.product + ': its domain key is the SNAPSHOT key "' + e.snapshot + '"',
      spec.domain === e.snapshot, spec.domain);
    assert(e.product + ': every channel names a source domain-snapshot.js emits',
      spec.channels.every(function (c) { return declaredNames[c.name]; }),
      spec.channels.filter(function (c) { return !declaredNames[c.name]; }).map(function (c) { return c.name; }).join(', '));
    assert(e.product + ': every channel declares field, recordedField, units, cadence and source',
      spec.channels.every(function (c) {
        return c.field && c.recordedField && c.units && c.cadenceMs > 0 && c.source;
      }));
    assert(e.product + ': every channel declares its own q and r priors',
      spec.channels.every(function (c) { return typeof c.q === 'number' && typeof c.r === 'number'; }));

    /* A recent7d channel in a NEW domain reads r7 — the un-saturated count. Energy's stay
       on v because its fixture predates that field; these have no such history. */
    assert(e.product + ': recent7d channels read r7, not the saturating v',
      spec.channels.filter(function (c) { return c.field === 'recent7d'; })
        .every(function (c) { return c.recordedField === 'r7'; }),
      spec.channels.filter(function (c) { return c.field === 'recent7d' && c.recordedField !== 'r7'; })
        .map(function (c) { return c.key; }).join(', '));

    /* ZERO RELATIONSHIPS IS A RESULT, NOT AN OVERSIGHT. None of these three has two
       sources measuring the same statistic in the same units on the same horizon —
       checked, and the closest candidates were rejected: monthly FRED CPI against annual
       World Bank inflation, and openFDA drug enforcement against an FDA food-recall feed.
       Declaring a plausible pair to avoid an empty list is the fabrication the latent
       requirement exists to prevent. */
    assert(e.product + ': declares zero relationships, which the factory accepts',
      spec.relationships.length === 0, String(spec.relationships.length));

    /* FINDINGS REST ON MEASURED QUANTITIES ONLY. A finding on a publication count fires
       when somebody publishes, and would be reported as a condition of the world. */
    var byKey = {};
    spec.channels.forEach(function (c) { byKey[c.key] = c; });
    var publicationUnits = /articles\/7d|documents in 30d|net term count|feed items|search result total/;
    assert(e.product + ': no finding is built on a publication or keyword count',
      spec.findings.every(function (f) {
        return (f.requires || []).every(function (k) { return !publicationUnits.test(byKey[k].units); });
      }),
      spec.findings.filter(function (f) {
        return (f.requires || []).some(function (k) { return publicationUnits.test(byKey[k].units); });
      }).map(function (f) { return f.id; }).join(', '));
    assert(e.product + ': every finding states a basis', spec.findings.every(function (f) { return !!f.basis; }));
    assert(e.product + ': and every finding requires only declared channels',
      spec.findings.every(function (f) { return (f.requires || []).every(function (k) { return !!byKey[k]; }); }));
  });

  /* MEDICINE IS THE ALIAS CASE, and both names must reach it. */
  assert('medicine is reachable by product name', REG.inspect('medicine').channels === 15);
  assert('and by snapshot key, returning the same binder',
    REG.inspect('health').version === REG.inspect('medicine').version);
  assert('its binder file is bind/medicine.js',
    fs.existsSync(REG.binderPath(REG.descriptorFor('medicine'))));
  assert('and its fixture would be filed as health-recorder.json',
    path.basename(REG.fixturePath(REG.descriptorFor('medicine'))) === 'health-recorder.json');

  /* ALL THREE ARE MANIFEST-ONLY. No fixture exists for any of them, so nothing declared
     above has been exercised against a single real observation. */
  ['economy', 'environment', 'medicine'].forEach(function (d) {
    assert(d + ' is MANIFEST-ONLY, not bound', REG.inspect(d).state === REG.STATE.MANIFEST_ONLY,
      REG.inspect(d).state);
  });
  assert('energy is still the only bound domain', REG.summary().bound.join() === 'energy',
    REG.summary().bound.join());

  /* NO CROSS-DOMAIN LINK WAS INVENTED. Every relationship in every binder stays inside
     its own channel set — asserted across all five so a future batch cannot slip one in. */
  var all = [ENERGY, FINANCE, ECONOMY, ENVIRONMENT, MEDICINE];
  assert('no binder declares a relationship naming a channel outside itself',
    all.every(function (b) {
      var keys = b.CHANNELS.map(function (c) { return c.key; });
      return b.RELATIONSHIPS.every(function (r) { return keys.indexOf(r.a) >= 0 && keys.indexOf(r.b) >= 0; });
    }));
})();

// ── D7: no row is advanced by any of this ────────────────────────────────────
(function () {
  console.log('D7: binding a second manifest advances no checklist row');
  var s = REG.summary();
  /**
   * Stated as assertions so they cannot quietly stop being true.
   *
   * A FINANCE FIXTURE IS NECESSARY AND NOT SUFFICIENT for row 24, and the difference
   * matters because "get the fixture and the row completes" is the obvious reading. Row
   * 24 asks whether peer domains inform each other USEFULLY. That needs three things:
   * finance observations, a DECLARED cross-domain latent (none exists — and inventing
   * one because an oil price and an equity price are plausibly related is precisely the
   * standard this refuses), and MEASURED beneficial transfer against a control with the
   * link withheld. Traffic crossing a link is not the same as a link that helps.
   */
  assert('finance has no fixture, so no cross-domain observation has ever occurred',
    REG.inspect('finance').fixture === false);
  assert('and the bound count is still one',
    s.byState[REG.STATE.BOUND] === 1, String(s.byState[REG.STATE.BOUND]));
  assert('so row 24 remains blocked on real second-domain observations, not on a binder',
    L.report(L.createBus()).satisfiesRow24 === false);

  /* AND NOT ONLY ON OBSERVATIONS. No cross-domain latent is declared by either binder,
     so even a perfect finance fixture would leave nothing to route and nothing to
     measure. Asserted here so the "fixture completes row 24" reading cannot take hold. */
  var latents = {};
  [require('../bind/energy.js'), require('../bind/finance.js')].forEach(function (b) {
    b.RELATIONSHIPS.forEach(function (r) { latents[r.latent] = (latents[r.latent] || 0) + 1; });
  });
  var shared = Object.keys(latents).filter(function (k) {
    var inE = require('../bind/energy.js').RELATIONSHIPS.some(function (r) { return r.latent === k; });
    var inF = require('../bind/finance.js').RELATIONSHIPS.some(function (r) { return r.latent === k; });
    return inE && inF;
  });
  assert('no latent is declared by BOTH domains, so there is no cross-domain link to test',
    shared.length === 0, JSON.stringify(shared));
  assert('and every declared relationship stays inside its own domain',
    require('../bind/finance.js').RELATIONSHIPS.every(function (r) {
      var keys = require('../bind/finance.js').CHANNELS.map(function (c) { return c.key; });
      return keys.indexOf(r.a) >= 0 && keys.indexOf(r.b) >= 0;
    }));
})();

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('BOUND WITH DATA: 1 of 20 (energy). Four declared and unobserved:');
console.log('economy, environment, medicine, finance — no fixture exists for any of them.');
console.log('Row 24 needs THREE things, not one: finance observations, a DECLARED cross-domain');
console.log('latent (none exists), and MEASURED beneficial transfer against a withheld-link');
console.log('control. A fixture is necessary and not sufficient.');
console.log('');
process.exit(failures ? 1 : 0);
