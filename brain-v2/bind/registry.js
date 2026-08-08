/**
 * brain-v2/bind/registry.js — the 20 canonical domains, in BOTH naming systems.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * TWO NAMES, AND CONFLATING THEM IS A REAL FAILURE MODE, NOT A TIDINESS ISSUE
 *
 * LIMEN carries two names for three of its domains and always has:
 *
 *   product / portal / console        snapshot / runtime / store key
 *   --------------------------        ------------------------------
 *   medicine                          health
 *   science                           research
 *   trade                             supplyChain
 *
 * The first version of this file listed only the runtime keys and called them canonical.
 * "20/20 domains" would then have described the runtime layer while reading as a
 * statement about the product, and the three aliased domains would have been invisible
 * under the names the portals actually use.
 *
 * The mapping is NOT redeclared here. `lib/domain-names.js` is the one place it lives,
 * and its own header records why: the map had been hand-copied into eight files, in both
 * directions, and two of those copies were added the same day patching the same defect
 * without noticing it was the same defect. A ninth copy in this file would be that bug
 * again. What makes it dangerous is that a missing alias does not throw — it resolves to
 * a key that does not exist, which reads as ABSENT DATA.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * THREE STATES, AND THE MIDDLE ONE IS THE HONEST ANSWER
 *
 *   BOUND          a binder loads AND a fixture exists that the binder can actually
 *                  read. Verified by reading it, not by the filename.
 *   MANIFEST_ONLY  a binder loads and validates, but no usable fixture does. Everything
 *                  about the domain is declared and nothing about it is observed.
 *   UNBOUND        no binder. The domain records into feed history and nothing reads it.
 *
 * Collapsing MANIFEST_ONLY into BOUND is the failure this file exists to prevent.
 * Nineteen more manifests would let the system report "20 domains bound" while exactly
 * one had ever seen a real observation.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var NAMES = require('../../lib/domain-names.js');

/* Paths resolve against THIS FILE, never process.cwd(). A registry whose answer depends
   on the directory the caller happened to be in is not a registry. */
var BIND_DIR = __dirname;
var FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

/**
 * The canonical 20 SNAPSHOT keys, in the order handlers/domain-snapshot.js lists them.
 * @see handlers/domain-snapshot.js — `var keys = [...]`
 */
var SNAPSHOT_KEYS = [
  'economy', 'energy', 'environment', 'health', 'technology',
  'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture',
  'industry', 'education', 'communication', 'culture', 'defense',
  'religion', 'population', 'law', 'finance', 'intelligence'
];

/**
 * DESCRIPTORS. Every domain carries both names and the key each artefact is filed under.
 *
 *   product   what the portal, console and registry call it (medicine, science, trade)
 *   snapshot  what the snapshot, recorder and Redis stores use (health, research, supplyChain)
 *   binder    bind/<binder>.js — filed under the PRODUCT name, because a binder is a
 *             product artefact describing what a domain observes
 *   fixture   fixtures/<snapshot>-recorder.json — filed under the SNAPSHOT key, because
 *             handlers/feed-record.js writes `feedhist:<snapshotKey>` and the fixture is
 *             a dump of that. Getting this backwards would have the registry hunting for
 *             a file the recorder can never produce.
 */
var DOMAINS = SNAPSHOT_KEYS.map(function (snapshot) {
  var product = NAMES.toCanonical(snapshot);
  return {
    product: product,
    snapshot: snapshot,
    binder: product,
    aliased: NAMES.isAliased(snapshot)
  };
});

var STATE = {
  BOUND: 'bound',
  MANIFEST_ONLY: 'manifest-only',
  UNBOUND: 'unbound'
};

function descriptorFor(name) {
  var snap = NAMES.toRuntime(name);
  for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i].snapshot === snap) return DOMAINS[i];
  return null;
}

function binderPath(d) { return path.join(BIND_DIR, d.binder + '.js'); }
function fixturePath(d) { return path.join(FIXTURE_DIR, d.snapshot + '-recorder.json'); }

/**
 * IS THIS DOCUMENT A FIXTURE THIS BINDER CAN READ? Pure — no filesystem, no clock.
 *
 * Split out from fixtureUsable() because the tests for it were writing real files into
 * `brain-v2/fixtures/` and deleting them afterwards. That works exactly until finance has
 * a real fixture, at which point running the test suite DESTROYS the evidence it was
 * written to protect — an unlinkSync in a `finally` cannot tell a temp file it created
 * from a corpus somebody spent a week recording. A test that can delete real data is a
 * worse defect than the one it covers, so the validation logic now takes a document and
 * the tests hand it documents.
 *
 * Accepts a parsed object or raw text; raw text is parsed here so the parse guard is
 * testable in memory too, rather than being the one branch only a real file could reach.
 *
 * FAILS CLOSED. Any doubt returns usable:false with a reason. A registry that guesses in
 * the optimistic direction is worse than one that refuses, because the optimistic guess
 * is the one nobody re-checks.
 */
function validateFixtureDocument(d, binder, docOrRaw) {
  var doc = docOrRaw;
  if (typeof docOrRaw === 'string') {
    try { doc = JSON.parse(docOrRaw); }
    catch (e) { return { usable: false, why: 'fixture present but unparseable: ' + e.message }; }
  }

  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.rows)) {
    return { usable: false, why: 'fixture has no `rows` array — it is not a recorder dump' };
  }
  if (!doc.rows.length) {
    return { usable: false, why: 'fixture contains 0 rows; an empty file is not data' };
  }
  /* Identity, when the fixture states one. Fixtures written by scripts/build-brain-fixture.mjs
     carry `domain`; the original energy fixture predates that field, and its absence is
     accepted rather than treated as a mismatch — but a WRONG one is refused outright.
     Compared through toRuntime so a fixture declaring `medicine` matches `health`. */
  if (doc.domain !== undefined && doc.domain !== null && NAMES.toRuntime(doc.domain) !== d.snapshot) {
    return { usable: false, why: 'fixture declares domain "' + doc.domain + '" but is filed as ' + d.snapshot };
  }

  /**
   * THE REAL TEST: can this binder read anything at all out of it? A fixture for another
   * domain parses fine and yields zero channels, because the source names do not match.
   * This is the identity check that does not depend on a field being present.
   *
   * EVERY ROW, not the first 24. A slow or sparse source — a weekly release, a feed that
   * went quiet for a fortnight and came back — can legitimately produce its first reading
   * hundreds of rows in, and capping the scan would classify that domain as unreadable
   * for a reason that is a fact about our sampling rather than about the data. Fixtures
   * are bounded at 500 rows by the builder, so the whole scan is cheap, and it stops at
   * the first readable row anyway.
   */
  var readable = false, scanned = 0;
  for (var i = 0; i < doc.rows.length; i++) {
    scanned++;
    try {
      if (Object.keys(binder.readRecorderRow(doc.rows[i]) || {}).length) { readable = true; break; }
    } catch (e) { return { usable: false, why: 'binder threw reading row ' + i + ': ' + e.message }; }
  }
  if (!readable) {
    return { usable: false, why: 'the binder produced no readings from any of the ' + doc.rows.length +
      ' rows — the fixture parses but this domain cannot read it, which usually means it belongs to another domain' };
  }

  return {
    usable: true, rows: doc.rows.length, scannedRows: scanned,
    declaredDomain: doc.domain === undefined ? null : doc.domain,
    why: 'binder produced readings from a fixture of ' + doc.rows.length + ' rows (first readable at row ' + scanned + ')'
  };
}

/**
 * The file-reading half. Opens the fixture and hands the bytes to the pure validator.
 * This function touches the filesystem and NOTHING else, so the only thing that needs a
 * real file to test is "does the file exist".
 */
function fixtureUsable(d, binder) {
  var fp = fixturePath(d);
  if (!fs.existsSync(fp)) return { usable: false, why: 'no fixture at fixtures/' + d.snapshot + '-recorder.json' };
  var raw;
  try { raw = fs.readFileSync(fp, 'utf8'); }
  catch (e) { return { usable: false, why: 'fixture present but unreadable: ' + e.message }; }
  return validateFixtureDocument(d, binder, raw);
}

/**
 * Inspect one domain, by either name. Never throws: a binder that fails to load is a
 * REPORTABLE state, not a crash, or one broken manifest would hide the other nineteen.
 */
function inspect(name) {
  var d = descriptorFor(name);
  if (!d) {
    return { product: String(name), snapshot: null, state: STATE.UNBOUND, binder: false, fixture: false,
      why: 'not one of the 20 canonical domains, under either naming system' };
  }

  var base = { product: d.product, snapshot: d.snapshot, aliased: d.aliased };
  var bp = binderPath(d);
  if (!fs.existsSync(bp)) {
    return Object.assign(base, {
      state: STATE.UNBOUND, binder: false, fixture: fs.existsSync(fixturePath(d)),
      why: 'no binder at bind/' + d.binder + '.js. The domain is recorded into feed history by ' +
           'handlers/feed-record.js and nothing reads it.'
    });
  }

  var binder, spec;
  try { binder = require(bp); spec = binder.spec(); }
  catch (e) {
    return Object.assign(base, {
      state: STATE.UNBOUND, binder: true, fixture: fs.existsSync(fixturePath(d)), loadError: e.message,
      why: 'binder present but it did not load: ' + e.message
    });
  }

  Object.assign(base, {
    binder: true,
    channels: (spec.channels || []).length,
    relationships: (spec.relationships || []).length,
    findings: (spec.findings || []).length,
    version: spec.version
  });

  var fx = fixtureUsable(d, binder);
  if (!fx.usable) {
    return Object.assign(base, {
      state: STATE.MANIFEST_ONLY, fixture: false, fixtureWhy: fx.why,
      why: 'binder validates (' + base.channels + ' channels, ' + base.relationships +
           ' declared relationships) but has no usable fixture: ' + fx.why +
           '. Declaring a domain is not observing one.'
    });
  }

  return Object.assign(base, {
    state: STATE.BOUND, fixture: true, fixtureRows: fx.rows,
    why: 'binder validates and ' + fx.why + ', so the domain can be replayed and measured'
  });
}

/**
 * INSTALLED_DOMAINS: the domains the production shadow runtime actually executes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS IS THE ONLY OPERATIONAL MEMBERSHIP LIST IN THE SYSTEM.
 *
 * `lib/brain-shadow-runtime.js` and `handlers/brain-shadow.js` both derive their default
 * set from here, and neither declares one of its own. Two independently authored lists is
 * how a domain gets executed by the cron and then omitted from the health read: the cycle
 * runs, nothing reports it, and the operator reads "that domain is not installed" about a
 * domain that has been writing state for a week. The runtime used to hold the list and the
 * handler used to iterate the runtime's copy, which was one list reached two ways; this is
 * the same list reached two ways, declared where domain membership already lives.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * BOUND IS NOT INSTALLED, and the gap is deliberate. All 20 domains are BOUND, meaning a
 * validating binder plus a fixture that binder can read. Seven are installed. A domain
 * joins this list only after a batch audit has measured what it will actually contribute,
 * so the distance between 20 and 7 is the distance between "declared and observable
 * offline" and "executing hourly against production feed history".
 *
 * INSTALLED IS NOT EVIDENCED EITHER. Installation puts a domain in SHADOW. It activates no
 * relationship, grants no pathway, and licenses no claim of independent evidence. The
 * evidence gate is separate and still open: see brain-v2/DELIVERY_STATE.md.
 */
var INSTALLED_DOMAINS = [
  /* Batch 0, the canaries. First production run of the shared runtime (PR #5). */
  'energy', 'finance',
  /* Batch 1, audited 2026-08-06. Selected because each reads from row 0 of its fixture,
     so its first cycle is immediately falsifiable rather than silent for three hours, and
     each carries 91-100% channel coverage, and declares ZERO relationships, which means
     installing them cannot activate anything early even by mistake. */
  'education', 'economy', 'trade', 'industry', 'population',
  /* Batch 2, audited 2026-08-08, selected on the SAME three properties in the same order,
     because the batch-1 criteria were not a one-off convenience: each declares ZERO
     relationships, each reads from row 0 so its first cycle is falsifiable immediately, and
     these are the five highest channel-coverage domains left (86-94%).

     CULTURE AND RELIGION ARE STILL EXCLUDED, and still not for coverage: their first
     readable row is 373 of 470, so at the 120-row cap they tick ZERO times for three
     consecutive cycles. A canary that cannot fail for three hours is the worst kind. They
     go in only behind a cursor that starts near their first readable row. */
  'infrastructure', 'science', 'intelligence', 'environment', 'medicine',
  /* Batch 3, audited 2026-08-08, same three properties in the same order. Each declares ZERO
     relationships, each reads from row 0 so its first cycle is falsifiable immediately, and
     these are the five highest-coverage domains left of the six that read from row 0.

     COVERAGE IS MATERIALLY LOWER HERE AND THAT IS NOT HIDDEN. Batch 1 ran 91-100%, batch 2
     86-94%, batch 3 is 58-85%: agriculture 11/13, law 12/15, defense 11/15, technology 7/10,
     governance 7/12. The batch-1 wording said an unavailable input should be "a small, named
     exception rather than the norm", and at governance's 5 of 12 unread that no longer holds.
     It is installed anyway because the remaining pool contains nothing better and because
     shadow sensing over the channels that DO read is still legitimate, but the honest
     statement is that this batch senses less per domain than either batch before it. The
     unread channels are named in DELIVERY_STATE.md rather than left as a percentage.

     CULTURE AND RELIGION ARE STILL EXCLUDED, for the third time, and still not for coverage:
     religion reads 15/15 and culture 15/16, the two best figures in the whole roster. Their
     first readable row is 373 of 470, so at the 120-row cap they tick ZERO times for three
     consecutive cycles. They go in with communication in batch 4, behind a cursor that starts
     near their first readable row. */
  'agriculture', 'law', 'defense', 'technology', 'governance'
];

/**
 * VALIDATED AT LOAD, NOT AT FIRST USE. An unresolvable name would otherwise surface as one
 * failed cycle per hour on one domain, which reads as a data problem rather than a typo,
 * and `runDomain` reports domain errors instead of throwing so nothing would ever escalate.
 */
INSTALLED_DOMAINS.forEach(function (p) {
  if (!descriptorFor(p)) {
    throw new Error('registry: INSTALLED_DOMAINS names "' + p + '", which is not one of the ' +
      'twenty canonical domains under either naming system');
  }
});
(function () {
  var seen = Object.create(null);
  INSTALLED_DOMAINS.forEach(function (p) {
    var snap = NAMES.toRuntime(p);
    /* A domain listed twice would run two cycles against one cursor in the same batch. The
       second finds no rows past the cursor the first just wrote, so it reports a healthy
       zero-row cycle and the duplication is invisible in the output. */
    if (seen[snap]) {
      throw new Error('registry: INSTALLED_DOMAINS lists ' + snap + ' twice (as ' + p + '); ' +
        'a domain installed twice runs two cycles against one cursor and the second reports ' +
        'a healthy no-op, so the duplicate never shows up in the health read');
    }
    seen[snap] = true;
  });
})();

/** Every canonical domain, with its state and the reason for it. */
function survey() { return DOMAINS.map(function (d) { return inspect(d.snapshot); }); }

function summary() {
  var rows = survey();
  var by = Object.create(null);
  Object.keys(STATE).forEach(function (k) { by[STATE[k]] = 0; });
  rows.forEach(function (r) { by[r.state]++; });
  return {
    total: rows.length,
    byState: by,
    bound: rows.filter(function (r) { return r.state === STATE.BOUND; }).map(function (r) { return r.product; }),
    manifestOnly: rows.filter(function (r) { return r.state === STATE.MANIFEST_ONLY; }).map(function (r) { return r.product; }),
    /* The headline is BOUND, never binder-count. A manifest is a claim about what a
       domain WOULD observe; only a readable fixture makes it a claim about what it DID. */
    why: by[STATE.BOUND] + ' of ' + rows.length + ' domains are bound with readable data behind them; ' +
         by[STATE.MANIFEST_ONLY] + ' declared but unobserved; ' + by[STATE.UNBOUND] + ' unbound'
  };
}

module.exports = {
  DOMAINS: DOMAINS,
  SNAPSHOT_KEYS: SNAPSHOT_KEYS,
  PRODUCT_KEYS: DOMAINS.map(function (d) { return d.product; }),
  /* The sole operational membership authority. Consumers derive; none redeclares. */
  INSTALLED_DOMAINS: INSTALLED_DOMAINS,
  STATE: STATE,
  descriptorFor: descriptorFor,
  inspect: inspect,
  survey: survey,
  summary: summary,
  binderPath: binderPath,
  fixturePath: fixturePath,
  fixtureUsable: fixtureUsable,
  validateFixtureDocument: validateFixtureDocument
};
