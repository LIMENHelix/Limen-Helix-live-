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

  /**
   * THE HEADLINE, and it is not the binder count.
   *
   * ALL TWENTY ARE NOW BOUND: every domain has a binder AND a recorder fixture its binder
   * produces readings from. Nineteen were installed at once from ~19.5 days of production
   * feed history, which is what the recorder was built to accumulate.
   *
   * WHAT BOUND DOES AND DOES NOT MEAN, because the previous version of this file used
   * "one bound domain" as shorthand for "one domain with real evidence" and those have
   * now come apart. `registry.js` defines BOUND as: a binder that validates, plus a
   * non-empty fixture the binder can read. That is INSTALLATION. It says nothing about
   * whether the fixture contains independent observations — that is SPEC row 10, it is a
   * property of a declared PAIR rather than of the corpus, and every one of the nineteen
   * fixtures reports `supportsIndependentObservations: false` today. The two counts are
   * asserted separately below so neither can be read as the other.
   */
  assert('all twenty domains are bound: binder plus a readable fixture',
    s.byState[REG.STATE.BOUND] === 20, JSON.stringify(s.bound));
  assert('and energy is still among them, unchanged',
    s.bound.indexOf('energy') >= 0, JSON.stringify(s.bound));
  assert('finance is bound too, from its own recorded history',
    s.bound.indexOf('finance') >= 0 && s.manifestOnly.indexOf('finance') < 0,
    JSON.stringify(s.manifestOnly));
  assert('and its reason names the fixture it can read, not a missing one',
    /produced readings from a fixture/.test(REG.inspect('finance').why), REG.inspect('finance').why);
  assert('no domain is left manifest-only',
    s.byState[REG.STATE.MANIFEST_ONLY] === 0, JSON.stringify(s.manifestOnly));
  assert('no domain is unbound: every one of the twenty has a binder',
    s.byState[REG.STATE.UNBOUND] === 0, String(s.byState[REG.STATE.UNBOUND]));
  /**
   * INSTALLED IS NOT EVIDENCED. Asserted here so a reader of the bound count cannot take
   * it for the evidence count; the fixtures say so themselves.
   *
   * ITERATES ALL TWENTY FROM THE REGISTRY, not a sample. An earlier version listed four
   * domains by hand, which stated a universal invariant while testing a fifth of it — and
   * the sixteen it skipped are exactly where an unearned `true` would go unnoticed. The
   * offending fixture is named, because "some fixture claims row 10" sends the reader
   * looking through twenty files.
   */
  var claiming = REG.PRODUCT_KEYS.filter(function (p) {
    var fp = REG.fixturePath(REG.descriptorFor(p));
    if (!fs.existsSync(fp)) return false;
    var doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return !!(doc.evidence && doc.evidence.supportsIndependentObservations === true);
  });
  assert('across ALL TWENTY fixtures, not one claims independent observations',
    REG.PRODUCT_KEYS.length === 20 && claiming.length === 0,
    claiming.length ? 'claimed by: ' + claiming.join(', ') + ' — row 10 support is earned, not installed'
                    : 'checked ' + REG.PRODUCT_KEYS.length + ' domains');
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
  /* UPDATED 2026-08-09 when readings gained `recordedAt`, the recorder's receipt time from
     `row.t`. READ_SHA is a BEHAVIOURAL guarantee and moving it needs more than a note, so
     the move is proved additive below rather than asserted: strip only the new field and the
     PREVIOUS hash comes back byte-identical across all 5682 readings, so no existing field's
     presence, name, order or value changed. That assertion is kept permanently, because
     "we updated the golden hash" is exactly the sentence behind which a real regression hides.
     Previous: 7d8c6c687ba1f7f659ef41bd9ee90ab5aa86f2a1fecfab74297376b583499201 */
  var READ_SHA = '30f160831b6410103b8f3483c518ade2d4ff49aa2c7bc0cd9dc8c207e1cfd9de';
  var READ_SHA_BEFORE_RECORDED_AT = '7d8c6c687ba1f7f659ef41bd9ee90ab5aa86f2a1fecfab74297376b583499201';

  assert('energy spec() is byte-identical to the pre-factory manifest',
    sha(JSON.stringify(ENERGY.spec())) === SPEC_SHA, sha(JSON.stringify(ENERGY.spec())));

  var rows = require('../fixtures/energy-recorder.json').rows;
  var all = rows.map(function (r) { return JSON.stringify(ENERGY.readRecorderRow(r)); }).join('|');
  assert('and readRecorderRow is identical across all ' + rows.length + ' recorded rows',
    sha(all) === READ_SHA, sha(all));

  /* THE HASH MOVED BY EXACTLY ONE FIELD, AND NOTHING ELSE. */
  var strippedReadings = 0, withReceipt = 0;
  var stripped = rows.map(function (r) {
    var o = ENERGY.readRecorderRow(r);
    Object.keys(o).forEach(function (k) {
      strippedReadings++;
      if (typeof o[k].recordedAt === 'number') withReceipt++;
      delete o[k].recordedAt;
    });
    return JSON.stringify(o);
  }).join('|');
  assert('removing ONLY recordedAt restores the previous hash, so the change is purely additive',
    sha(stripped) === READ_SHA_BEFORE_RECORDED_AT, sha(stripped));
  assert('and every one of the ' + strippedReadings + ' readings carries the receipt, not a subset',
    withReceipt === strippedReadings && strippedReadings > 0,
    withReceipt + '/' + strippedReadings);

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

  /* FINGERPRINT OF THE FIXTURES DIRECTORY, taken before any validation runs and compared
     after. The previous version of this guard asserted that finance had NO fixture, which
     was a proxy for "this test wrote nothing" that worked only while finance was empty.
     Now that all twenty domains are installed the proxy is meaningless, and the property
     it stood for matters MORE: a test that can overwrite real recorded evidence is worse
     than the defect it covers. So the real property is measured instead. */
  var FIXDIR = path.dirname(REG.fixturePath(d));
  var fixturesBefore = fs.readdirSync(FIXDIR).sort().map(function (f) {
    var st = fs.statSync(path.join(FIXDIR, f));
    return f + ':' + st.size + ':' + st.mtimeMs;
  }).join('|');

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

  /* THE SAFETY PROPERTY ITSELF: this test wrote nothing. Measured, not proxied — every
     fixture file, its size and its mtime, unchanged across the whole validation block. */
  var fixturesAfter = fs.readdirSync(FIXDIR).sort().map(function (f) {
    var st = fs.statSync(path.join(FIXDIR, f));
    return f + ':' + st.size + ':' + st.mtimeMs;
  }).join('|');
  assert('running this test created, deleted or modified NO fixture file',
    fixturesAfter === fixturesBefore,
    'fixtures directory changed during a pure-validation test');
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
  console.log('D8: all nineteen declared binders, checked against the sources that actually exist');
  var ECONOMY = require('../bind/economy.js');
  var ENVIRONMENT = require('../bind/environment.js');
  var MEDICINE = require('../bind/medicine.js');
  var TECHNOLOGY = require('../bind/technology.js');
  var SCIENCE = require('../bind/science.js');
  var TRADE = require('../bind/trade.js');
  var GOVERNANCE = require('../bind/governance.js');
  var INFRA = require('../bind/infrastructure.js');
  var AGRICULTURE = require('../bind/agriculture.js');
  var INDUSTRY = require('../bind/industry.js');
  var EDUCATION = require('../bind/education.js');
  var COMMUNICATION = require('../bind/communication.js');
  var CULTURE = require('../bind/culture.js');
  var DEFENSE = require('../bind/defense.js');
  var RELIGION = require('../bind/religion.js');
  var POPULATION = require('../bind/population.js');
  var LAW = require('../bind/law.js');
  var INTELLIGENCE = require('../bind/intelligence.js');
  var batch = [
    { b: ECONOMY,     product: 'economy',     snapshot: 'economy',     channels: 15, batch: 1 },
    { b: ENVIRONMENT, product: 'environment', snapshot: 'environment', channels: 10, batch: 1 },
    { b: MEDICINE,    product: 'medicine',    snapshot: 'health',      channels: 15, batch: 1 },
    { b: TECHNOLOGY,  product: 'technology',  snapshot: 'technology',  channels: 10, batch: 2 },
    { b: SCIENCE,     product: 'science',     snapshot: 'research',    channels: 15, batch: 2 },
    { b: TRADE,       product: 'trade',       snapshot: 'supplyChain', channels: 13, batch: 2 },
    { b: GOVERNANCE,  product: 'governance',  snapshot: 'governance',  channels: 12, batch: 3 },
    { b: INFRA,       product: 'infrastructure', snapshot: 'infrastructure', channels: 18, batch: 3 },
    { b: AGRICULTURE, product: 'agriculture', snapshot: 'agriculture', channels: 13, batch: 3 },
    { b: INDUSTRY,      product: 'industry',      snapshot: 'industry',      channels: 11, batch: 4 },
    { b: EDUCATION,     product: 'education',     snapshot: 'education',     channels: 10, batch: 4 },
    { b: COMMUNICATION, product: 'communication', snapshot: 'communication', channels: 11, batch: 4 },
    { b: CULTURE,   product: 'culture',   snapshot: 'culture',   channels: 16, batch: 5 },
    { b: DEFENSE,   product: 'defense',   snapshot: 'defense',   channels: 15, batch: 5 },
    { b: RELIGION,  product: 'religion',  snapshot: 'religion',  channels: 15, batch: 5 },
    { b: POPULATION,   product: 'population',   snapshot: 'population',   channels: 15, batch: 6 },
    { b: LAW,          product: 'law',          snapshot: 'law',          channels: 15, batch: 6 },
    { b: INTELLIGENCE, product: 'intelligence', snapshot: 'intelligence', channels: 15, batch: 6 }
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

    /**
     * ZERO RELATIONSHIPS IS A RESULT, NOT AN OVERSIGHT. Across the rollout the close
     * candidates were rejected on population, denominator, horizon or provenance: monthly
     * FRED CPI against annual World Bank inflation, openFDA drug enforcement against an
     * FDA food-recall feed, arXiv CS as a subset of arXiv All, three WGI dimensions, a
     * measured drought area against a count of forecasters' vocabulary.
     *
     * POPULATION was briefly the exception and is not. It was declared once the UN row
     * selection was verified, then WITHDRAWN on a defect the verification never touched:
     * WPP 2024's estimation period ends in 2023, so the latest completed year is a
     * projection, and the World Bank side may sit on a different year. Knowing which row
     * you read is not the same as knowing two publishers describe the same year, or the
     * same kind of number. Every batch-2-onward binder is back to zero.
     */
    var expectedRels = 0;
    assert(e.product + ': declares ' + expectedRels + ' relationship(s)',
      spec.relationships.length === expectedRels, String(spec.relationships.length));

    /* FINDINGS REST ON MEASURED QUANTITIES ONLY. A finding on a publication count fires
       when somebody publishes, and would be reported as a condition of the world. */
    var byKey = {};
    spec.channels.forEach(function (c) { byKey[c.key] = c; });
    var publicationUnits = /articles\/7d|documents in 30d|net term count|feed items|search result total|cumulative articles|cumulative papers|indexed works|applications matched|top stories|keyword mentions/;
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

  /**
   * NO FUSED-STATE FINDING IN BATCH 2. A finding whose test reads `state.departure`
   * restates a number the cycle has already emitted as its own dysregulation, so it adds
   * a second voice saying the same thing rather than evidence. Batch 1 and the two
   * earlier binders each carry one (`SYSTEMIC_*`); those are left alone rather than
   * silently edited — energy's in particular is inside the byte-identical spec hash that
   * pins every measurement on the scorecard. Reported here so the inconsistency is
   * visible and deliberate rather than discovered later.
   */
  batch.filter(function (e) { return e.batch >= 2; }).forEach(function (e) {
    var systemic = e.b.spec().findings.filter(function (f) { return /^SYSTEMIC_/.test(f.id); });
    assert(e.product + ': declares no SYSTEMIC_* fused-state finding',
      systemic.length === 0, JSON.stringify(systemic.map(function (f) { return f.id; })));
    assert(e.product + ': and no finding tests the fused departure directly',
      e.b.spec().findings.every(function (f) { return !/s\.departure/.test(String(f.test)); }),
      e.b.spec().findings.filter(function (f) { return /s\.departure/.test(String(f.test)); })
        .map(function (f) { return f.id; }).join(', '));
    /* Neutrally named: a finding says WHICH channel departed, not what it means. */
    /* `every` on an empty list is vacuously true, which is correct: a domain with no
       findings cannot have a badly named one. The zero-findings case is asserted
       explicitly below rather than left to pass silently here. */
    assert(e.product + ': finding ids are neutral, naming the measure rather than a cause',
      e.b.spec().findings.every(function (f) { return /_DEPARTURE$|_CO_DEPARTING$/.test(f.id); }),
      e.b.spec().findings.map(function (f) { return f.id; }).join(', '));
  });

  /* The earlier binders DO carry one each; counted rather than asserted away, so the
     number is on the record and a later cleanup has a baseline. */
  var legacySystemic = [ENERGY, FINANCE, ECONOMY, ENVIRONMENT, MEDICINE]
    .reduce(function (n, b) { return n + b.FINDINGS.filter(function (f) { return /^SYSTEMIC_/.test(f.id); }).length; }, 0);
  console.log('  note: ' + legacySystemic + ' SYSTEMIC_* fused-state findings remain in the five earlier binders');

  /* SCIENCE HAS EXACTLY ONE FINDING, and that is the honest count. Fourteen of its
     fifteen channels count publications; promoting one of those to a finding to make the
     domain look better instrumented is precisely what the unit rule above prevents. */
  assert('science declares exactly one finding, on its only measured quantity',
    SCIENCE.FINDINGS.length === 1 && SCIENCE.FINDINGS[0].requires.join() === 'rndIntensity',
    JSON.stringify(SCIENCE.FINDINGS.map(function (f) { return f.id; })));

  /**
   * CISA KEV IS A 30-DAY FLOW, AND BOTH BINDERS MUST SAY SO.
   *
   * Batch 2 shipped describing this channel as the cumulative catalogue size, in the
   * units, the finding name and the header prose. `fetchCISAKEV()` walks the feed
   * counting entries whose `dateAdded` falls inside a 30-day cutoff and returns THAT; the
   * catalogue total is computed in the same function and interpolated into the label
   * string only, so it never reaches the channel.
   *
   * The stale description survived because it was self-consistent — units, finding name
   * and header all agreed with each other and all disagreed with the fetcher. So this
   * asserts against the SOURCE TEXT as well as the manifest: a wrong claim in a comment
   * is what the next reader will believe.
   */
  ['technology', 'trade'].forEach(function (dom) {
    var b = require('../bind/' + dom + '.js');
    var kev = b.CHANNELS.filter(function (c) { return c.key === 'cisaKev'; })[0];
    assert(dom + ': declares CISA KEV as a 30-day flow',
      kev && /30d/.test(kev.units) && /new KEV entries/.test(kev.units), kev && kev.units);
    assert(dom + ': and its source names the 30-day window',
      /entries added in 30d/.test(kev.source), kev && kev.source);

    var src = fs.readFileSync(path.join(__dirname, '..', 'bind', dom + '.js'), 'utf8');
    assert(dom + ': the file nowhere says "catalogued CVEs"', src.indexOf('catalogued CVEs') < 0);
    assert(dom + ': nor "cumulative catalogue"', src.toLowerCase().indexOf('cumulative catalogue') < 0);
    assert(dom + ': nor describes CISA against NVD as stock versus inflow',
      !/stock and its inflow|stock versus inflow/i.test(src));
  });

  /* The finding is renamed, and the old name must be gone rather than aliased. */
  var techFindings = require('../bind/technology.js').FINDINGS.map(function (f) { return f.id; });
  assert('technology renames the KEV finding to NEW_KEV_30D_DEPARTURE',
    techFindings.indexOf('NEW_KEV_30D_DEPARTURE') >= 0, techFindings.join(', '));
  assert('and KEV_CATALOGUE_DEPARTURE no longer exists',
    techFindings.indexOf('KEV_CATALOGUE_DEPARTURE') < 0, techFindings.join(', '));
  assert('the joint finding describes two populations over two windows, not a stock and a flow',
    /two different populations over two different windows/.test(
      require('../bind/technology.js').FINDINGS
        .filter(function (f) { return f.id === 'VULNERABILITY_COUNTS_CO_DEPARTING'; })[0].basis));

  /* AND THE CONCLUSION IS UNCHANGED. Both are flows, over different populations and
     different windows, so they still must not be related. The correction was to the
     description, not to the decision. */
  assert('technology still declares zero relationships after the correction',
    require('../bind/technology.js').RELATIONSHIPS.length === 0);
  assert('trade still declares zero relationships after the correction',
    require('../bind/trade.js').RELATIONSHIPS.length === 0);

  /**
   * BATCH 3's TWO HARDEST REJECTIONS, asserted so a later edit cannot quietly reverse them.
   *
   * GOVERNANCE: the three World Bank WGI channels share publisher, construction, units,
   * geography and annual horizon — every surface property a relationship is checked on —
   * and measure three DIFFERENT dimensions by design. A gap between control of corruption
   * and government effectiveness is a real distinction, not an instrument fault, so
   * relating them would report a state being effective and corrupt as a sensor error.
   */
  var wgi = GOVERNANCE.CHANNELS.filter(function (c) { return c.units === 'index score'; });
  assert('governance declares three WGI index channels', wgi.length === 3,
    JSON.stringify(wgi.map(function (c) { return c.key; })));
  assert('they share units and cadence, which is exactly why the rejection matters',
    wgi.every(function (c) { return c.units === wgi[0].units && c.cadenceMs === wgi[0].cadenceMs; }));
  assert('and none of them is related to another',
    GOVERNANCE.RELATIONSHIPS.length === 0, String(GOVERNANCE.RELATIONSHIPS.length));
  assert('each has its OWN finding rather than a joint one, which would assert they co-move',
    GOVERNANCE.FINDINGS.length === 3 &&
    GOVERNANCE.FINDINGS.every(function (f) { return f.requires.length === 1; }),
    JSON.stringify(GOVERNANCE.FINDINGS.map(function (f) { return f.requires; })));

  /**
   * AGRICULTURE: two channels are both called drought. One measures the percentage of
   * CONUS in D2-D4; the other counts intensification terms in the CPC outlook TEXT. A
   * measured area and a count of forecasters' vocabulary.
   */
  var byKeyAg = {};
  AGRICULTURE.CHANNELS.forEach(function (c) { byKeyAg[c.key] = c; });
  assert('agriculture measures drought area as a percentage of land',
    /% of CONUS/.test(byKeyAg.droughtArea.units), byKeyAg.droughtArea.units);
  assert('and declares the CPC outlook channel as a keyword count, not a drought measure',
    byKeyAg.cpcOutlook.units === 'keyword mentions', byKeyAg.cpcOutlook.units);
  assert('the two are NOT related — an area and a vocabulary are not one latent',
    AGRICULTURE.RELATIONSHIPS.length === 0);
  assert('and no finding is built on the CPC term count, which would fire on a rewording',
    AGRICULTURE.FINDINGS.every(function (f) { return f.requires.indexOf('cpcOutlook') < 0; }),
    JSON.stringify(AGRICULTURE.FINDINGS.map(function (f) { return f.requires; })));

  /**
   * INFRASTRUCTURE: three FRED channels all arrive as a percentage change, which is a
   * transformation rather than a quantity. Sharing a unit is not sharing a latent.
   */
  var pct = INFRA.CHANNELS.filter(function (c) { return /^% change/.test(c.units); });
  assert('infrastructure declares three percentage-change channels', pct.length === 3,
    JSON.stringify(pct.map(function (c) { return c.key; })));
  assert('each names the different series it is a change OF',
    new Set(pct.map(function (c) { return c.units; })).size === 3,
    JSON.stringify(pct.map(function (c) { return c.units; })));
  assert('and none is related to another', INFRA.RELATIONSHIPS.length === 0);

  /* SHARED CHANNELS ACROSS DOMAINS are fine; a relationship spanning them is not.
     NOAA alerts and USGS earthquakes now appear in three domains each. */
  var sharedCount = ['nwsAlerts', 'earthquakes'].map(function (k) {
    return [ENVIRONMENT, TRADE, INFRA].filter(function (b) {
      return b.CHANNELS.some(function (c) { return c.key === k; });
    }).length;
  });
  assert('NOAA alerts and USGS earthquakes are each declared by three domains',
    sharedCount.join() === '3,3', sharedCount.join());
  assert('and no binder relates a channel it does not itself declare',
    [ENVIRONMENT, TRADE, INFRA].every(function (b) {
      var keys = b.CHANNELS.map(function (c) { return c.key; });
      return b.RELATIONSHIPS.every(function (r) { return keys.indexOf(r.a) >= 0 && keys.indexOf(r.b) >= 0; });
    }));

  /**
   * BATCH 4's REJECTIONS.
   *
   * EDUCATION: both World Bank channels are written as a percentage, and they are
   * percentages of DIFFERENT DENOMINATORS — expenditure as a share of GDP, enrolment as a
   * share of a cohort. `%` is not a unit in the sense a relationship needs. They are also
   * an input and an outcome, so a gap between them is the interesting thing about an
   * education system rather than a fault in an instrument.
   */
  var eduByKey = {};
  EDUCATION.CHANNELS.forEach(function (c) { eduByKey[c.key] = c; });
  assert('education declares spend as a share of GDP', eduByKey.eduSpend.units === '% of GDP',
    eduByKey.eduSpend.units);
  assert('and enrolment as a share of a cohort — a different denominator',
    eduByKey.tertiaryEnrol.units === '% gross enrolment ratio', eduByKey.tertiaryEnrol.units);
  assert('the two units are distinct, so "%" alone never made them comparable',
    eduByKey.eduSpend.units !== eduByKey.tertiaryEnrol.units);
  assert('and they are not related', EDUCATION.RELATIONSHIPS.length === 0);
  assert('each has its own finding rather than a joint one, which would assert they co-move',
    EDUCATION.FINDINGS.length === 2 && EDUCATION.FINDINGS.every(function (f) { return f.requires.length === 1; }));

  /**
   * INDUSTRY: two recall feeds are the tempting pair. Both are RSS article counts over
   * different product classes, so a relationship would compare two rates of publication.
   */
  var indByKey = {};
  INDUSTRY.CHANNELS.forEach(function (c) { indByKey[c.key] = c; });
  assert('industry declares both recall channels as article counts',
    indByKey.nhtsaRecalls.units === 'articles/7d' && indByKey.cpscRecalls.units === 'articles/7d');
  assert('over different populations, named in their sources',
    /vehicle/.test(indByKey.nhtsaRecalls.source) && /consumer product/.test(indByKey.cpscRecalls.source),
    indByKey.nhtsaRecalls.source + ' | ' + indByKey.cpscRecalls.source);
  assert('and they are not related', INDUSTRY.RELATIONSHIPS.length === 0);
  assert('nor does either carry a finding',
    INDUSTRY.FINDINGS.every(function (f) {
      return f.requires.indexOf('nhtsaRecalls') < 0 && f.requires.indexOf('cpscRecalls') < 0;
    }));

  /**
   * COMMUNICATION is a domain whose subject is communication, instrumented almost
   * entirely by counting communications. Ten of eleven channels count what was published;
   * one finding is therefore the honest count, not a shortfall.
   */
  var commPub = COMMUNICATION.CHANNELS.filter(function (c) {
    return /articles\/7d|feed items|documents in 30d/.test(c.units);
  });
  assert('communication declares ten of eleven channels as publication counts',
    commPub.length === 10, String(commPub.length));
  assert('and carries exactly one finding, on its only measured quantity',
    COMMUNICATION.FINDINGS.length === 1 &&
    COMMUNICATION.FINDINGS[0].requires.join() === 'internetUsers',
    JSON.stringify(COMMUNICATION.FINDINGS.map(function (f) { return f.requires; })));
  assert('the press-freedom feeds are not related to each other',
    COMMUNICATION.RELATIONSHIPS.length === 0);

  /**
   * BATCH 5: TWO DOMAINS DECLARE NO FINDINGS AT ALL, and that must be asserted rather
   * than allowed to pass vacuously.
   *
   * Every channel in culture and religion counts published artefacts — fifteen RSS
   * keyword queries plus an article count in culture, fifteen RSS queries in religion.
   * The established rule excludes all of them, so an empty findings list is the honest
   * output: it reports that these domains are instrumented entirely by coverage.
   *
   * The risk an empty list carries is that it looks like an oversight, so this asserts
   * the REASON as well as the count — no channel in either domain measures anything but
   * publication, which is what makes zero correct rather than lazy.
   */
  var coverageUnits = /articles\/7d|articles matched|feed items|documents in 30d|keyword mentions/;
  [{ b: CULTURE, name: 'culture', channels: 16 },
   { b: RELIGION, name: 'religion', channels: 15 }].forEach(function (e) {
    assert(e.name + ': declares zero findings', e.b.FINDINGS.length === 0,
      JSON.stringify(e.b.FINDINGS.map(function (f) { return f.id; })));
    assert(e.name + ': because EVERY channel counts published artefacts, which is why zero is correct',
      e.b.CHANNELS.every(function (c) { return coverageUnits.test(c.units); }),
      e.b.CHANNELS.filter(function (c) { return !coverageUnits.test(c.units); })
        .map(function (c) { return c.key + '=' + c.units; }).join(', '));
    assert(e.name + ': and declares zero relationships', e.b.RELATIONSHIPS.length === 0);
    assert(e.name + ': with all ' + e.channels + ' channels present',
      e.b.CHANNELS.length === e.channels, String(e.b.CHANNELS.length));
  });

  /**
   * DEFENSE is the opposite shape and worth naming: it HAS findings, and not one of them
   * is about defence. Seven of its fifteen channels are coverage counts of defence, and
   * the only measured quantities it can reach are weather, seismic and vulnerability data
   * shared in from other domains.
   */
  var defByKey = {};
  DEFENSE.CHANNELS.forEach(function (c) { defByKey[c.key] = c; });
  assert('defense carries findings only on channels shared in from outside its subject',
    DEFENSE.FINDINGS.every(function (f) {
      return f.requires.every(function (k) {
        return ['nwsAlerts', 'earthquakes', 'cisaKev'].indexOf(k) >= 0;
      });
    }), JSON.stringify(DEFENSE.FINDINGS.map(function (f) { return f.requires; })));
  assert('and none on the seven defence coverage counts',
    DEFENSE.FINDINGS.every(function (f) {
      return f.requires.every(function (k) { return defByKey[k].units !== 'articles/7d'; });
    }));
  assert('nor on the OFAC keyword count',
    DEFENSE.FINDINGS.every(function (f) { return f.requires.indexOf('ofac') < 0; }));
  assert('the two state-media channels are declared as article counts and unrelated',
    defByKey.tass.units === 'articles/7d' && defByKey.xinhua.units === 'articles/7d' &&
    DEFENSE.RELATIONSHIPS.length === 0);

  /**
   * BATCH 6. The closest relationship candidate of the whole rollout, refused on
   * PROVENANCE rather than plausibility, and it is worth pinning so a later reader does
   * not re-litigate it from the plausibility side.
   *
   * World Bank SP.POP.TOTL and UN indicator 49 at location 840 are two different
   * publishers, same country, same annual horizon — none of the usual disqualifiers
   * (population, denominator, horizon) applies. What was missing is that `indicators/49`
   * is an opaque id: nothing in the code said what it measures except the fetcher name and
   * label, which the discipline excludes. It was read from the portal's own metadata,
   * which is also what corrected the unit from thousands to PERSONS — both sides are in
   * persons, so no scale claim is involved.
   *
   * THAT STILL WAS NOT ENOUGH, and the channel assertions below are all that survives. The
   * relationship declared on the strength of this work was withdrawn: WPP 2024's estimation
   * period ends in 2023, so the latest completed year is a projection rather than an
   * estimate, and the two publishers need not be on the same year. See the withdrawal
   * block at the end of this file.
   */
  var popByKey = {};
  POPULATION.CHANNELS.forEach(function (c) { popByKey[c.key] = c; });
  assert('population declares the World Bank total from a self-describing indicator',
    /SP\.POP\.TOTL/.test(popByKey.populationTotal.source), popByKey.populationTotal.source);
  assert('and the UN channel is now verified down to sex, variant and unit',
    /both sexes/.test(popByKey.unPopulation.source) && popByKey.unPopulation.units === 'people',
    popByKey.unPopulation.source + ' | ' + popByKey.unPopulation.units);
  assert('in the same unit as the World Bank total, not thousands',
    popByKey.unPopulation.units === popByKey.populationTotal.units &&
    !/thousand/i.test(popByKey.unPopulation.units + popByKey.unPopulation.source),
    popByKey.unPopulation.units + ' vs ' + popByKey.populationTotal.units);
  assert('and the two are STILL NOT RELATED, because matching units is not a matching year',
    POPULATION.RELATIONSHIPS.length === 0, String(POPULATION.RELATIONSHIPS.length));
  assert('and the UN channel still carries no finding of its own',
    POPULATION.FINDINGS.every(function (f) { return f.requires.indexOf('unPopulation') < 0; }),
    JSON.stringify(POPULATION.FINDINGS.map(function (f) { return f.requires; })));
  assert('while both self-describing World Bank indicators do carry one',
    POPULATION.FINDINGS.length === 2 &&
    POPULATION.FINDINGS.every(function (f) {
      return ['populationTotal', 'fertilityRate'].indexOf(f.requires[0]) >= 0;
    }));

  /**
   * LAW AND INTELLIGENCE EACH CARRY ONE FINDING, AND NEITHER IS ABOUT ITS OWN SUBJECT.
   * Fourteen of fifteen channels in each count published artefacts; the only measured
   * quantity either can reach is the CISA vulnerability flow. Asserted rather than left
   * implicit, because it is the clearest statement of what these domains can and cannot
   * currently see.
   */
  [{ b: LAW, name: 'law' }, { b: INTELLIGENCE, name: 'intelligence' }].forEach(function (e) {
    assert(e.name + ': carries exactly one finding', e.b.FINDINGS.length === 1,
      JSON.stringify(e.b.FINDINGS.map(function (f) { return f.id; })));
    assert(e.name + ': and it is on the vulnerability flow, not on its own subject matter',
      e.b.FINDINGS[0].requires.join() === 'cisaKev', e.b.FINDINGS[0].requires.join());
    var counted = e.b.CHANNELS.filter(function (c) {
      return /articles\/7d|documents in 30d|keyword mentions|rule documents|filings today/.test(c.units);
    });
    assert(e.name + ': because fourteen of its fifteen channels count published artefacts',
      counted.length === 14, String(counted.length));
    assert(e.name + ': declares zero relationships', e.b.RELATIONSHIPS.length === 0);
  });

  /* MEDICINE IS THE ALIAS CASE, and both names must reach it. */
  assert('medicine is reachable by product name', REG.inspect('medicine').channels === 15);
  assert('and by snapshot key, returning the same binder',
    REG.inspect('health').version === REG.inspect('medicine').version);
  assert('its binder file is bind/medicine.js',
    fs.existsSync(REG.binderPath(REG.descriptorFor('medicine'))));
  assert('and its fixture would be filed as health-recorder.json',
    path.basename(REG.fixturePath(REG.descriptorFor('medicine'))) === 'health-recorder.json');

  /* ALL OF THEM ARE NOW BOUND, each against its own recorded history. What each binder
     DECLARES was asserted above; this asserts only that the declaration now meets data. */
  ['economy', 'environment', 'medicine', 'technology', 'science', 'trade',
   'governance', 'infrastructure', 'agriculture',
   'industry', 'education', 'communication',
   'culture', 'defense', 'religion',
   'population', 'law', 'intelligence'].forEach(function (d) {
    assert(d + ' is BOUND: its binder reads its fixture', REG.inspect(d).state === REG.STATE.BOUND,
      REG.inspect(d).why);
  });
  assert('every one of the twenty is bound', REG.summary().bound.length === 20,
    REG.summary().bound.join());

  /**
   * CULTURE AND RELIGION ARE BOUND ON A SHORTER WINDOW THAN THE REST, and the CAUSE is
   * pinned rather than asserted in prose. Culture reads `r7` on fifteen of its sixteen
   * channels and religion on all fifteen of its own; `r7` did not exist in recorded rows
   * until the recorder was fixed on 2026-08-01. Their fixtures span the same ~19.5 days
   * as the others, but only the rows from that fix onward are readable.
   *
   * "FEWER THAN HALF THE ROWS" WOULD NOT HAVE TESTED THAT. It is satisfied by any sparse
   * domain for any reason, so it would have gone on passing if the real cause were
   * something else entirely — a dead feed, a renamed source, a binder bug. What makes the
   * claim falsifiable is the COINCIDENCE: the first row the binder can read must be the
   * first row carrying `r7` at all, and the row before it must carry none. The boundary
   * index is not hardcoded, so a refreshed fixture moves it without breaking the test,
   * but the causal link has to survive.
   */
  ['culture', 'religion'].forEach(function (d) {
    var doc = JSON.parse(fs.readFileSync(REG.fixturePath(REG.descriptorFor(d)), 'utf8'));
    var binder = require('../bind/' + REG.descriptorFor(d).binder + '.js');
    var hasR7 = function (r) { return (r.src || []).some(function (s) { return s.r7 !== undefined; }); };
    var canRead = function (r) {
      try { return Object.keys(binder.readRecorderRow(r) || {}).length > 0; } catch (e) { return false; }
    };
    var firstReadable = -1, firstR7 = -1;
    doc.rows.forEach(function (r, i) {
      if (firstReadable < 0 && canRead(r)) firstReadable = i;
      if (firstR7 < 0 && hasR7(r)) firstR7 = i;
    });
    var readable = doc.rows.filter(canRead).length;

    assert(d + ': every channel it reads is declared r7, which is why the boundary exists',
      binder.CHANNELS.filter(function (c) { return c.recordedField === 'r7'; }).length >= 15,
      JSON.stringify(binder.CHANNELS.reduce(function (a, c) {
        a[c.recordedField] = (a[c.recordedField] || 0) + 1; return a; }, {})));
    assert(d + ': the first readable row IS the first row carrying r7',
      firstReadable >= 0 && firstReadable === firstR7,
      'firstReadable=' + firstReadable + ' firstR7=' + firstR7);
    assert(d + ': and the row immediately before the boundary carries no r7 at all',
      firstReadable > 0 && !hasR7(doc.rows[firstReadable - 1]),
      'row ' + (firstReadable - 1) + ' at ' + new Date(doc.rows[firstReadable - 1].t).toISOString());
    assert(d + ': the boundary falls on or after the 2026-08-01 recorder fix',
      doc.rows[firstReadable].t >= Date.UTC(2026, 7, 1),
      new Date(doc.rows[firstReadable].t).toISOString());
    assert(d + ': so every row from the boundary on is readable, and none before it',
      readable === doc.rows.length - firstReadable,
      readable + ' readable, ' + (doc.rows.length - firstReadable) + ' from boundary ' + firstReadable);
  });

  /* NO CROSS-DOMAIN LINK WAS INVENTED. Every relationship in every binder stays inside
     its own channel set — asserted across all five so a future batch cannot slip one in. */
  var all = [ENERGY, FINANCE, ECONOMY, ENVIRONMENT, MEDICINE, TECHNOLOGY, SCIENCE, TRADE,
             GOVERNANCE, INFRA, AGRICULTURE, INDUSTRY, EDUCATION, COMMUNICATION,
             CULTURE, DEFENSE, RELIGION, POPULATION, LAW, INTELLIGENCE];
  /**
   * THE WHOLE-ROLLOUT INVARIANT, now that all twenty binders exist. Across every domain,
   * not one relationship was declared. That is a result about what public feeds can
   * support, not a policy: two domains DID find same-latent pairs — energy's crude trio
   * and finance's SPY trio — and those were declared. Everything since has been article
   * counts, different populations, different denominators or different horizons.
   */
  var totalRels = all.reduce(function (n, b) { return n + b.RELATIONSHIPS.length; }, 0);
  assert('exactly ten relationships exist across all twenty binders',
    totalRels === 10, String(totalRels));
  assert('and they live in exactly two domains: energy and finance',
    all.filter(function (b) { return b.RELATIONSHIPS.length > 0; }).length === 2 &&
    ENERGY.RELATIONSHIPS.length + FINANCE.RELATIONSHIPS.length === 10,
    String(all.filter(function (b) { return b.RELATIONSHIPS.length > 0; }).length));
  assert('every other binder declares zero',
    all.filter(function (b) { return b !== ENERGY && b !== FINANCE; })
       .every(function (b) { return b.RELATIONSHIPS.length === 0; }));

  /**
   * THE POPULATION WITHDRAWAL, pinned — the one relationship that was declared and then
   * taken back. What is asserted here is that the channel work SURVIVED the withdrawal and
   * the conclusion did not, because those are separable and a later reader will be tempted
   * to undo both or neither.
   *
   * It is not enough to check the count is zero. The count was zero in batch 6 too, for a
   * reason that no longer applies. The live objection is the REFERENCE YEAR and the KIND of
   * statistic: WPP 2024 estimates run to 2023, so the latest completed year is a
   * projection, and `fetchWorldBankPopulation` reads whatever its own latest year is.
   */
  assert('population declares NO relationship',
    POPULATION.RELATIONSHIPS.length === 0,
    JSON.stringify(POPULATION.RELATIONSHIPS.map(function (r) { return r.latent; })));
  assert('and no binder anywhere still declares usa_total_population',
    all.every(function (b) {
      return b.RELATIONSHIPS.every(function (r) { return r.latent !== 'usa_total_population'; });
    }));
  var unCh = POPULATION.CHANNELS.filter(function (c) { return c.key === 'unPopulation'; })[0];
  assert('the UN channel work survives: it does not call its statistic unverified',
    !/unverified/.test(unCh.units) && !/unverified/.test(unCh.source), unCh.units + ' | ' + unCh.source);
  assert('its source names both sexes and the documented Median variant',
    /both sexes/.test(unCh.source) && /Median variant/.test(unCh.source), unCh.source);
  assert('and it now states that the series is an ESTIMATE or a PROJECTION depending on year',
    /ESTIMATE/.test(unCh.source) && /PROJECTION/.test(unCh.source) && /2023/.test(unCh.source),
    unCh.source);
  assert('the UN channel still carries no finding of its own',
    POPULATION.FINDINGS.every(function (f) { return f.requires.indexOf('unPopulation') < 0; }),
    JSON.stringify(POPULATION.FINDINGS.map(function (f) { return f.requires; })));

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
  /* FINANCE NOW HAS THE FIRST OF THE THREE and row 24 has not moved, which is the whole
     point of stating them separately. Installing twenty fixtures changed the bound count
     and nothing else: no cross-domain latent has been declared, and no transfer has been
     measured against a withheld-link control. */
  assert('finance now has a fixture, so the first of row 24 three requirements is met',
    REG.inspect('finance').fixture === true);
  assert('and every domain is bound, which moves row 24 not at all',
    s.byState[REG.STATE.BOUND] === 20, String(s.byState[REG.STATE.BOUND]));
  /* Loaded here rather than reusing an outer list, so this assertion covers all twenty by
     construction and cannot silently check fewer if the outer list changes. */
  var everyBinder = REG.PRODUCT_KEYS.map(function (p) {
    return require('../bind/' + REG.descriptorFor(p).binder + '.js');
  });
  assert('because NO cross-domain latent is declared anywhere, in any of the twenty binders',
    everyBinder.length === 20 && everyBinder.every(function (b) {
      var keys = b.CHANNELS.map(function (c) { return c.key; });
      return b.RELATIONSHIPS.every(function (r) { return keys.indexOf(r.a) >= 0 && keys.indexOf(r.b) >= 0; });
    }), 'every declared relationship still lives inside one domain');
  assert('so row 24 remains blocked on a declared cross-domain latent and measured transfer',
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
console.log('MANIFEST COVERAGE IS COMPLETE: 20 of 20 domains have a binder.');
console.log('BOUND WITH DATA: 1 of 20 (energy). The other nineteen are declared and');
console.log('unobserved — no fixture exists for any of them, so nothing they declare has');
console.log('met a real observation. The next milestone is a SECOND FIXTURE, not a binder.');
console.log('Row 24 needs THREE things, not one: finance observations, a DECLARED cross-domain');
console.log('latent (none exists), and MEASURED beneficial transfer against a withheld-link');
console.log('control. A fixture is necessary and not sufficient.');
console.log('');
process.exit(failures ? 1 : 0);
