/**
 * brain-v2/test/unmapped-stress-candidate.js — the contract refuses what it says it refuses.
 *
 * A validator is only worth the failures it produces, so almost every assertion here is a
 * refusal: a candidate that is wrong in exactly one way, and the specific message that must
 * come back. The valid candidate is built ONCE from the real energy vocabulary and then
 * corrupted one field at a time, which is what makes each refusal attributable to the field
 * it names rather than to the fixture being broken in general.
 *
 * The vocabulary is real on purpose. `unmappedAgainst` is checked against the channels the
 * energy binder declares and the finding ids the diagnosis registry declares for energy, so
 * these tests fail if that vocabulary ever moves — which is the point of establishing
 * "unmapped" against a registry rather than against a list someone typed.
 *
 * Run: node brain-v2/test/unmapped-stress-candidate.js
 */

'use strict';

var USC = require('../core/unmapped-stress-candidate.js');
var ENERGY = require('../bind/energy.js');
var REGISTRY = require('../bind/diagnosis-registry.js');

var tests = 0, failures = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/** Assert that validating `mutate(valid)` throws, and that the message matches. */
function refuses(name, mutate, pattern) {
  var c = mutate(fresh());
  var threw = false, msg = '';
  try { USC.validate(c, VOCAB); } catch (e) { msg = e.message; threw = pattern.test(msg); }
  assert(name, threw, msg || 'did not throw');
}

var VOCAB = USC.vocabulary('energy', ENERGY.CHANNELS, REGISTRY.findingsFor('energy'));

function evidenceItem(over) {
  var base = {
    evidenceId: 'ev-1',
    contentKind: 'headline_title',
    publisherItemId: null,
    canonicalUrl: null,
    publishedAt: null,
    publisher: null,
    syndication: { lineage: [], assessedHere: false },
    claim: 'Grid operator warns of capacity shortfall in the southeast',
    observationWindow: { from: 1000, to: 2000, distinctFrom: [] },
    role: 'adverse',
    provenance: { snapshotId: 'snap-1', commit: 'abc1234', generator: 'test' },
    uncertainty: { semanticIdentityTier: 'absent', abstentions: ['no publisher-issued id in this feed'] }
  };
  Object.keys(over || {}).forEach(function (k) {
    if (over[k] === undefined) delete base[k]; else base[k] = over[k];
  });
  return base;
}

/** A candidate that is valid in every respect, rebuilt fresh for each mutation. */
function fresh() {
  return {
    candidateId: 'usc-energy-0001',
    domain: 'energy',
    unmappedAgainst: {
      channels: VOCAB.channels.slice(),
      findingIds: VOCAB.findingIds.slice(),
      binderCommit: '9dcf3918'
    },
    regulatedVariable: 'regional generation reserve margin',
    mechanism: 'reserve margin falls as unplanned outages coincide with peak load, and no declared channel reads outage counts',
    failureModes: {
      highSide: 'margin held far above need: capacity paid for and not used, cost carried with no reliability gain',
      lowSide: 'margin below need: load shed, and the shortfall is only visible after the event'
    },
    evidence: {
      adverse: { items: [evidenceItem({})], abstentionReason: null },
      constructive: { items: [], abstentionReason: 'no build or capacity item in this window' },
      recovery: { items: [], abstentionReason: 'the variable has not returned to range, so there is nothing to record' },
      contradictory: { items: [], abstentionReason: 'not searched: no contradiction source is wired' }
    },
    independenceAssessment: {
      comparedEvidenceIds: ['ev-1'],
      dimensions: { ownership: 'unknown', editorial: 'unknown', syndication: 'unknown' },
      result: 'unknown',
      method: null,
      supportingEvidence: [],
      abstentionReason: 'feed names are not publishers and links are aggregator redirects, so nothing supports an independence verdict'
    },
    observationWindows: [{ from: 1000, to: 2000, distinctFrom: [], distinctnessBasis: 'single feed, single window' }],
    abstentions: [{ element: 'publisher', reason: 'the feed does not name one' }],
    uncertainty: {
      competingExplanations: ['ordinary seasonal peak already covered by existing channels'],
      knownGaps: ['no outage-count channel exists to check this against']
    },
    provenance: { snapshotId: 'snap-1', commit: '9dcf3918', generator: 'test', createdAt: 1000 },
    schemaVersion: 1,
    definitionVersion: 1,
    creationStatus: 'observational'
  };
}

console.log('USC: an unresolved possible condition, and what the contract refuses');
console.log('');

// ── U1: the vocabulary is the registry's, and it is real ─────────────────────
(function () {
  console.log('U1: "unmapped" is established against the declared vocabulary, not a typed list');
  assert('the energy vocabulary comes from the binder and the registry',
    VOCAB.domain === 'energy' && VOCAB.channels.length === ENERGY.CHANNELS.length &&
    VOCAB.findingIds.length === REGISTRY.findingsFor('energy').length,
    VOCAB.channels.length + ' channels, ' + VOCAB.findingIds.length + ' findings');
  assert('and it is not empty, so these tests are not vacuous',
    VOCAB.channels.length > 0 && VOCAB.findingIds.length > 0);
  assert('a fully specified candidate validates', USC.validate(fresh(), VOCAB) === true);
})();

// ── U2: observational only ───────────────────────────────────────────────────
(function () {
  console.log('U2: creation is observational, and cannot declare itself otherwise');
  refuses('a candidate claiming any other creationStatus is refused',
    function (c) { c.creationStatus = 'confirmed'; return c; }, /only legal value is "observational"/);
  refuses('including one that claims to be active',
    function (c) { c.creationStatus = 'active'; return c; }, /only legal value is "observational"/);
  refuses('and a missing creationStatus is refused rather than defaulted',
    function (c) { delete c.creationStatus; return c; }, /only legal value is "observational"/);

  var built = USC.create({
    candidateId: 'usc-2', domain: 'energy', unmappedAgainst: fresh().unmappedAgainst,
    regulatedVariable: fresh().regulatedVariable, mechanism: fresh().mechanism,
    failureModes: fresh().failureModes, evidence: fresh().evidence,
    independenceAssessment: fresh().independenceAssessment,
    observationWindows: fresh().observationWindows, uncertainty: fresh().uncertainty,
    provenance: fresh().provenance,
    creationStatus: 'active'   // ignored on purpose
  }, VOCAB);
  assert('create() sets creationStatus itself and ignores a caller trying to choose',
    built.creationStatus === 'observational', built.creationStatus);
})();

// ── U3: a candidate may not carry anything that makes it a measurement ───────
(function () {
  console.log('U3 [adversarial]: no score, no stress, no promotion marker, at any depth');
  refuses('a score at the top level is refused',
    function (c) { c.score = 0.7; return c; }, /may not hold a score/);
  refuses('a stress value nested inside evidence is refused',
    function (c) { c.evidence.adverse.items[0].stress = 0.4; return c; }, /may not hold a score/);
  refuses('a promotion marker buried in uncertainty is refused',
    function (c) { c.uncertainty.promoted = true; return c; }, /may not hold a score/);
  refuses('a confidence number is refused, because it is the first step of ranking',
    function (c) { c.confidence = 0.9; return c; }, /may not hold a score/);
})();

// ── U4: unmappedAgainst, and the full-set rule ───────────────────────────────
(function () {
  console.log('U4: "unmapped" is falsifiable only against the FULL declared set');
  refuses('a channel the domain does not declare is refused',
    function (c) { c.unmappedAgainst.channels.push('ghostChannel'); return c; }, /does not declare/);
  refuses('a finding the domain does not declare is refused',
    function (c) { c.unmappedAgainst.findingIds.push('NOT_A_FINDING'); return c; }, /does not declare/);

  /* The (domain, findingId) key doing real work: PRICE_SHOCK exists, but in economy. */
  refuses("another domain's finding id is refused even though that id exists",
    function (c) { c.unmappedAgainst.findingIds.push('PRICE_SHOCK'); return c; },
    /names finding "PRICE_SHOCK", which energy does not declare/);

  refuses('omitting a channel is refused: that is how everything looks novel',
    function (c) { c.unmappedAgainst.channels.pop(); return c; }, /FULL declared set/);
  refuses('omitting a finding is refused for the same reason',
    function (c) { c.unmappedAgainst.findingIds.pop(); return c; }, /FULL declared set/);
  refuses('an unpinned binder commit is refused',
    function (c) { delete c.unmappedAgainst.binderCommit; return c; }, /pin the binder commit/);
  refuses('and unmappedAgainst itself is required',
    function (c) { delete c.unmappedAgainst; return c; }, /meaningless without naming/);
})();

// ── U5: two-sided failure is about the regulated variable ────────────────────
(function () {
  console.log('U5: high-side and low-side failure, and they may not be the same sentence');
  refuses('a missing high side is refused',
    function (c) { delete c.failureModes.highSide; return c; }, /highSide is required/);
  refuses('a missing low side is refused',
    function (c) { delete c.failureModes.lowSide; return c; }, /lowSide is required/);
  refuses('two identical sides are refused as not two-sided at all',
    function (c) { c.failureModes.lowSide = c.failureModes.highSide; return c; }, /identical/);
  refuses('the regulated variable must be named',
    function (c) { delete c.regulatedVariable; return c; }, /name the regulated variable/);
  refuses('and the mechanism must be stated',
    function (c) { delete c.mechanism; return c; }, /state the mechanism/);
})();

// ── U6: four evidence buckets, constructive and recovery kept apart ──────────
(function () {
  console.log('U6: four buckets, all required, any legitimately empty but never silently');
  assert('the contract names four buckets, with constructive and recovery separate',
    USC.EVIDENCE_BUCKETS.join(',') === 'adverse,constructive,recovery,contradictory',
    USC.EVIDENCE_BUCKETS.join(','));

  USC.EVIDENCE_BUCKETS.forEach(function (b) {
    refuses('a missing ' + b + ' bucket is refused',
      function (c) { delete c.evidence[b]; return c; }, /is required, even when empty/);
  });
  refuses('an empty bucket with no abstentionReason is refused',
    function (c) { c.evidence.recovery.abstentionReason = null; return c; }, /gives no abstentionReason/);
  refuses('a candidate with no evidence at all is refused',
    function (c) {
      c.evidence.adverse.items = [];
      c.evidence.adverse.abstentionReason = 'none found';
      return c;
    }, /holds no evidence of any kind/);

  /* One item is enough. This is the rule that lets the system notice something it has not
     instrumented, and it is asserted rather than assumed. */
  var one = fresh();
  assert('a SINGLE observation is sufficient to raise a candidate',
    one.evidence.adverse.items.length === 1 && USC.validate(one, VOCAB) === true);

  /* Constructive is not recovery: a record in the wrong bucket is refused by role/bucket
     agreement, which is what keeps an announcement from reading as resolution. */
  refuses('a constructive record sitting in the recovery bucket is refused',
    function (c) {
      c.evidence.recovery.items = [evidenceItem({ evidenceId: 'ev-c', role: 'constructive' })];
      c.evidence.recovery.abstentionReason = null;
      return c;
    }, /Role and bucket must agree/);
})();

// ── U7: contradiction is a relation ──────────────────────────────────────────
(function () {
  console.log('U7: a contradiction names what it contradicts, or it is not one');
  function withContradiction(over) {
    return function (c) {
      var rec = evidenceItem({ evidenceId: 'ev-x', role: undefined });
      rec.contradicts = { targetKind: 'evidence', targetId: 'ev-1', basis: 'reports the outage resolved', strength: 'direct' };
      Object.keys(over || {}).forEach(function (k) {
        if (over[k] === undefined) delete rec.contradicts[k]; else rec.contradicts[k] = over[k];
      });
      if (over && over.__dropContradicts) delete rec.contradicts;
      if (over && over.__addRole) rec.role = 'adverse';
      c.evidence.contradictory.items = [rec];
      c.evidence.contradictory.abstentionReason = null;
      return c;
    };
  }
  var ok = withContradiction({})(fresh());
  assert('a well-formed contradiction validates', USC.validate(ok, VOCAB) === true);

  refuses('a contradiction that names nothing is refused',
    withContradiction({ __dropContradicts: true }), /must declare what it contradicts/);
  refuses('an unknown target kind is refused',
    withContradiction({ targetKind: 'vibes' }), /targetKind must be one of/);
  refuses('a missing target id is refused',
    withContradiction({ targetId: undefined }), /must name the thing contradicted/);
  refuses('a missing basis is refused',
    withContradiction({ basis: undefined }), /must state what specifically conflicts/);
  refuses('a contradiction carrying a role is refused, because it is a relation not a role',
    withContradiction({ __addRole: true }), /RELATION, not a role/);
})();

// ── U8: the two identity systems may not touch ───────────────────────────────
(function () {
  console.log('U8 [regression]: sensor identity may not appear on semantic evidence');
  USC.SENSOR_IDENTITY_FIELDS.forEach(function (f) {
    refuses('an evidence record carrying ' + f + ' is refused',
      function (c) { c.evidence.adverse.items[0][f] = 'x'; return c; },
      /belongs to the SENSOR identity system/);
  });
  refuses('publisherItemId must be present as its own field, even as null',
    function (c) { delete c.evidence.adverse.items[0].publisherItemId; return c; },
    /must declare publisherItemId/);
  refuses('and canonicalUrl separately, because they are different identity claims',
    function (c) { delete c.evidence.adverse.items[0].canonicalUrl; return c; },
    /must declare canonicalUrl/);
})();

// ── U9: contentKind, because titles are not article claims ───────────────────
(function () {
  console.log('U9: a record must say what kind of thing it holds');
  assert('the three kinds are titles, source claims and numeric observations',
    USC.CONTENT_KINDS.join(',') === 'headline_title,source_claim,numeric_observation');
  refuses('a missing contentKind is refused',
    function (c) { delete c.evidence.adverse.items[0].contentKind; return c; }, /declares contentKind/);
  refuses('an invented contentKind is refused',
    function (c) { c.evidence.adverse.items[0].contentKind = 'article_body'; return c; }, /declares contentKind/);
  assert('and the module offers NO function that promotes a title into a source claim',
    Object.keys(USC).every(function (k) { return !/promote|upgrade|transform|toSourceClaim/i.test(k); }),
    Object.keys(USC).join(','));
})();

// ── U10: independence is a cross-evidence assessment ─────────────────────────
(function () {
  console.log('U10: independence is assessed across evidence, never inferred per item');
  refuses('an item claiming to have assessed independence itself is refused',
    function (c) { c.evidence.adverse.items[0].syndication.assessedHere = true; return c; },
    /Independence is a claim about a SET/);
  refuses('a missing independenceAssessment is refused',
    function (c) { delete c.independenceAssessment; return c; },
    /Per-item publisher metadata does not establish independence/);
  refuses('an unknown result with no abstentionReason is refused',
    function (c) { c.independenceAssessment.abstentionReason = null; return c; },
    /abstentionReason is required/);
  refuses('a missing dimension is refused',
    function (c) { delete c.independenceAssessment.dimensions.editorial; return c; },
    /dimensions.editorial must be one of/);
  refuses('a verdict other than unknown must name its method',
    function (c) {
      c.independenceAssessment.dimensions = { ownership: 'independent', editorial: 'independent', syndication: 'independent' };
      c.independenceAssessment.result = 'independent';
      c.independenceAssessment.method = null;
      c.independenceAssessment.abstentionReason = null;
      return c;
    }, /must name the method/);
})();

// ── U11: windows, abstentions, provenance, versions ──────────────────────────
(function () {
  console.log('U11: windows are distinct only when distinctness is stated');
  refuses('a window with no distinctFrom is refused',
    function (c) { delete c.observationWindows[0].distinctFrom; return c; }, /must declare distinctFrom/);
  refuses('a window with no stated basis for distinctness is refused',
    function (c) { delete c.observationWindows[0].distinctnessBasis; return c; }, /state the basis on which it is distinct/);
  refuses('a window running backwards is refused',
    function (c) { c.observationWindows[0].from = 9999; return c; }, /from must not be after to/);
  refuses('no window at all is refused',
    function (c) { c.observationWindows = []; return c; }, /at least one observation window/);

  refuses('an abstention with no reason is refused',
    function (c) { c.abstentions = [{ element: 'publisher' }]; return c; }, /name an element and a reason/);

  refuses('an unsupported schemaVersion is refused',
    function (c) { c.schemaVersion = 2; return c; }, /schemaVersion 2 is not implemented/);
  refuses('a missing definitionVersion is refused',
    function (c) { delete c.definitionVersion; return c; }, /definitionVersion is required/);
  refuses('provenance without a commit is refused',
    function (c) { c.provenance.commit = ''; return c; }, /must pin the code state/);
  refuses('provenance without a snapshotId is refused',
    function (c) { delete c.provenance.snapshotId; return c; }, /provenance must declare snapshotId/);

  refuses('a candidate validated against the wrong domain vocabulary is refused',
    function (c) { c.domain = 'finance'; return c; }, /validated against the vocabulary for/);
})();

// ── U12: this module writes nothing ──────────────────────────────────────────
(function () {
  console.log('U12: storage, consolidation and promotion are not in this module');
  var exported = Object.keys(USC);
  assert('no exported name suggests writing, storing or persisting',
    exported.every(function (k) { return !/save|store|persist|write|flush|commit[A-Z]|db/i.test(k); }),
    exported.join(','));
  assert('no exported name suggests consolidation, promotion or activation',
    exported.every(function (k) { return !/consolidat|promot|activat|merge|rank/i.test(k); }),
    exported.join(','));
  assert('the module surface is the contract, the validator, and the vocabulary builder',
    typeof USC.validate === 'function' && typeof USC.create === 'function' &&
    typeof USC.vocabulary === 'function');

  /* create() returns the record and nothing else happens: same input, same output, twice. */
  var parts = {
    candidateId: 'usc-3', domain: 'energy', unmappedAgainst: fresh().unmappedAgainst,
    regulatedVariable: fresh().regulatedVariable, mechanism: fresh().mechanism,
    failureModes: fresh().failureModes, evidence: fresh().evidence,
    independenceAssessment: fresh().independenceAssessment,
    observationWindows: fresh().observationWindows, uncertainty: fresh().uncertainty,
    provenance: fresh().provenance
  };
  var a = USC.create(parts, VOCAB), b = USC.create(parts, VOCAB);
  assert('create() is pure: two calls with the same parts produce the same record',
    JSON.stringify(a) === JSON.stringify(b));
})();

// ── U13: every other domain's vocabulary resolves too ────────────────────────
(function () {
  console.log('U13: the vocabulary builder works for every domain, including those with no findings');
  var fs = require('fs'), path = require('path');
  var BIND = path.join(__dirname, '..', 'bind');
  var domains = 0, withFindings = 0, withoutFindings = 0;
  fs.readdirSync(BIND).forEach(function (f) {
    if (f.slice(-3) !== '.js') return;
    var m;
    try { m = require(path.join(BIND, f)); } catch (e) { return; }
    if (!m || typeof m.domain !== 'string' || !Array.isArray(m.FINDINGS) || typeof m.spec !== 'function') return;
    domains++;
    var v = USC.vocabulary(m.domain, m.CHANNELS, REGISTRY.findingsFor(m.domain));
    if (v.findingIds.length) withFindings++; else withoutFindings++;
    if (v.channels.length !== m.CHANNELS.length) throw new Error(m.domain + ': channel count mismatch');
  });
  assert('all twenty domains resolve a vocabulary', domains === 20, String(domains));
  assert('eighteen declare findings and two declare none, which is a legal vocabulary',
    withFindings === 18 && withoutFindings === 2, withFindings + ' with, ' + withoutFindings + ' without');
})();

console.log('');
console.log(tests - failures + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
console.log('');
console.log('WHAT THIS DID NOT DO: it stored nothing, consolidated nothing, promoted nothing,');
console.log('and activated nothing. A candidate is an unresolved possible condition and this');
console.log('file is the boundary that keeps it one.');
if (failures) process.exit(1);
