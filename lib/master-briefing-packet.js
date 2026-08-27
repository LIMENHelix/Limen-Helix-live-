/**
 * master-briefing-packet.js
 *
 * Read-only, server-built afferent packet for the Civilization briefing layer.
 * The browser may submit a compact display projection, but it is never treated
 * as evidence. Authoritative observations come from the stores already written
 * by the sensing and cognition workers:
 *
 *   console_snapshot                    current domain stress + market/series/text state
 *   opportunities_snapshot              internally surfaced business candidates
 *   limen:brain:cognition:<domain>       durable domain packet + semantic observations
 *
 * This module selects nothing, writes nothing, calls no provider, and grants no
 * motor or capital authority. Thing 2 phase data is deliberately quarantined as
 * contextual/masking comparison only.
 */
'use strict';

var dbDefault = require('./limen-db');
var redisDefault = require('./redis-kv');
var domainNames = require('./domain-names');

var DOMAINS = [
  'agriculture', 'communication', 'culture', 'defense', 'economy',
  'education', 'energy', 'environment', 'finance', 'governance',
  'industry', 'infrastructure', 'intelligence', 'law', 'medicine',
  'population', 'religion', 'science', 'technology', 'trade'
];

var COGNITION_PREFIX = 'limen:brain:cognition:';
var MAX_HEADLINES = 3;
var MAX_OPPORTUNITIES = 3;
var CONSOLE_STALE_MS = 20 * 60 * 1000;
var COGNITION_STALE_MS = 3 * 60 * 60 * 1000;

function finite(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
function text(v, n) {
  if (v === undefined || v === null) return null;
  var s = String(v).trim();
  if (!s) return null;
  return s.length > n ? s.slice(0, n) : s;
}
function list(v) { return Array.isArray(v) ? v : []; }
function bool(v) { return v === true; }
function at(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var n = Date.parse(String(v || ''));
  return isFinite(n) ? n : null;
}
function iso(v) { var n = at(v); return n === null ? null : new Date(n).toISOString(); }
function canonical(v) { return domainNames.toCanonical(String(v || '')).toLowerCase(); }
function runtime(v) { return domainNames.toRuntime(String(v || '')); }
function round(v) { return finite(v) === null ? null : Math.round(v * 10000) / 10000; }

function safeClientModels(models) {
  var byDomain = {};
  list(models).slice(0, 24).forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    var d = canonical(m.domain);
    if (DOMAINS.indexOf(d) < 0 || byDomain[d]) return;
    byDomain[d] = {
      stress: round(m.stress),
      phase: text(m.phase, 32),
      phaseGrounded: bool(m.phaseGrounded),
      phaseDivergent: bool(m.phaseDivergent),
      salience: text(m.salience, 40),
      role: 'display-advisory-only'
    };
  });
  return byDomain;
}

function compactHeadline(x) {
  if (!x || typeof x !== 'object') return null;
  var title = text(x.title, 280);
  if (!title) return null;
  return {
    title: title,
    publisher: text(x.publisherLabel || x.publisher, 120),
    feed: text(x.feedName, 120),
    contentKind: text(x.contentKind, 60),
    sourceRecordUrl: text(x.aggregatorItemUrl || x.sourceRecordId, 600),
    canonicalUrl: text(x.canonicalUrl, 600),
    sourceIdentity: x.sourceIdentity && typeof x.sourceIdentity === 'object' ? {
      kind: text(x.sourceIdentity.kind, 80),
      value: text(x.sourceIdentity.value, 300)
    } : null,
    sourceUpdatedAt: iso(x.sourceUpdatedAt),
    recordedAt: iso(x.recordedAt),
    independence: text(x.publisherIndependence, 40) || 'unassessed'
  };
}

function compactOpportunity(x) {
  if (!x || typeof x !== 'object') return null;
  var title = text(x.title, 220);
  if (!title) return null;
  return {
    title: title,
    path: text(x.path, 60),
    rank: round(x.rank),
    confidence: round(x.confidence),
    source: text(x.source, 80),
    authority: 'candidate-only; not validated and not authorized'
  };
}

function opportunitiesByDomain(snapshot) {
  var out = {};
  list(snapshot && snapshot.opportunities).forEach(function (o) {
    var d = canonical(o && o.domain);
    if (DOMAINS.indexOf(d) < 0) return;
    if (!out[d]) out[d] = [];
    if (out[d].length >= MAX_OPPORTUNITIES) return;
    var c = compactOpportunity(o);
    if (c) out[d].push(c);
  });
  return out;
}

function compactPhase(consoleRow) {
  var row = consoleRow || {};
  var grounded = bool(row.phaseGrounded);
  var divergent = bool(row.phaseDivergent);
  return {
    value: text(row.phase, 24),
    label: text(row.phaseLabel, 48),
    prior: text(row.phasePrior, 24),
    grounded: grounded,
    divergent: divergent,
    precision: round(row.phasePrecision),
    source: text(row.phaseSource, 64),
    evidence: row.phaseEvidence && typeof row.phaseEvidence === 'object' ? {
      scored: finite(row.phaseEvidence.scored),
      coverage: round(row.phaseEvidence.coverage),
      distribution: row.phaseEvidence.distribution || {}
    } : null,
    thing2Role: 'contextual masking comparison only',
    maskingAssessment: !grounded ? 'UNASSESSED' : (divergent ? 'POSSIBLE_MASKING' : 'NO_DIVERGENCE_OBSERVED'),
    possibleMasking: grounded && divergent,
    decisionAuthority: false,
    predictionAuthority: false,
    note: 'Thing 2 identifies possible masking when its long-arc company snapshot diverges from the present stress read. Possible masking is not confirmed masking; Thing 2 never selects, confirms, sizes, buys, sells, or vetoes an investment.'
  };
}

function investmentNewsReview(opportunities, cognition, phase) {
  var investmentCandidates = list(opportunities).filter(function (o) {
    return /invest/i.test(String(o && o.path || ''));
  });
  var semantic = cognition && cognition.semanticEvidence || {};
  var headlines = list(semantic.headlines);
  var required = investmentCandidates.length > 0;
  var newsReady = headlines.length > 0 && cognition && cognition.stale !== true && semantic.status === 'OBSERVED';
  var possible = !!(phase && phase.possibleMasking);
  return {
    required: required,
    sequence: 'CURRENT_NEWS_FIRST_THEN_THING2_MASKING_CONTEXT',
    status: !required ? 'NOT_APPLICABLE' : (newsReady ? 'CURRENT_NEWS_PRESENT' : 'ABSTAINED_CURRENT_NEWS_MISSING_OR_STALE'),
    investmentCandidateCount: investmentCandidates.length,
    scope: 'domain-level',
    currentNews: headlines,
    thing2PossibleMasking: possible,
    maskingConfirmation: !possible ? 'NO_THING2_DIVERGENCE_TO_RECONCILE'
      : (!newsReady ? 'UNCONFIRMED_NO_CURRENT_NEWS'
      : 'UNCONFIRMED_REQUIRES_COMPANY_SPECIFIC_NEWS_COMPARISON'),
    decisionAuthority: false,
    note: 'For an investment result, show current news before the Thing 2 masking flag. Domain-level news can motivate company research but cannot confirm company-specific masking; exact-issuer current news is required.'
  };
}

function compactCognition(rec, now) {
  var c = rec && rec.c && typeof rec.c === 'object' ? rec.c : null;
  if (!c) return {
    present: false,
    observedAt: null,
    stale: true,
    packetId: null,
    packetSchema: null,
    stress: null,
    phase: null,
    regulation: null,
    immune: null,
    interoception: null,
    feedHealth: null,
    semanticEvidence: {
      status: 'ABSTAINED',
      reason: 'cognition-record-missing',
      observationsRead: 0,
      retrievedAt: null,
      authority: 'observation-only',
      headlines: []
    },
    abstentions: ['cognition-record-missing']
  };
  var packet = c.serverPacket && typeof c.serverPacket === 'object' ? c.serverPacket : {};
  var truth = packet.truth && typeof packet.truth === 'object' ? packet.truth : {};
  var semanticMeta = truth.semanticEvidenceMeta && typeof truth.semanticEvidenceMeta === 'object' ? truth.semanticEvidenceMeta : {};
  var headlines = list(truth.semanticEvidence).map(compactHeadline).filter(Boolean).slice(0, MAX_HEADLINES);
  var observedAt = at(rec.ts) || at(packet.generatedAt);
  var intero = c.interoception && typeof c.interoception === 'object' ? c.interoception : {};
  var model = c.model && typeof c.model === 'object' ? c.model : {};
  var immune = c.immune && typeof c.immune === 'object' ? c.immune : {};
  return {
    present: true,
    observedAt: iso(observedAt),
    stale: observedAt === null || now - observedAt > COGNITION_STALE_MS,
    packetId: text(packet.packetId, 180),
    packetSchema: text(packet.schemaVersion, 80),
    stress: round(c.stress),
    phase: text(c.phase, 48),
    regulation: text(model.regulation, 48),
    immune: text(immune.immuneState, 48),
    interoception: {
      salience: text(intero.salience, 48),
      attend: text(intero.attend, 64),
      divergence: round(intero.divergence),
      channelCount: finite(intero.channelCount),
      role: 'internal observe-only divergence; not external truth and not action authority'
    },
    feedHealth: truth.feedHealth && typeof truth.feedHealth === 'object' ? {
      configured: finite(truth.feedHealth.configured),
      live: finite(truth.feedHealth.live)
    } : null,
    semanticEvidence: {
      status: text(semanticMeta.status, 48) || 'ABSTAINED',
      reason: text(semanticMeta.reason, 180),
      observationsRead: finite(semanticMeta.observationsRead),
      retrievedAt: iso(semanticMeta.retrievedAt),
      authority: text(semanticMeta.authority, 64) || 'observation-only',
      headlines: headlines
    },
    abstentions: list(packet.homologyContext && packet.homologyContext.abstentions).slice(0, 12).map(function (x) { return text(x, 160); }).filter(Boolean)
  };
}

async function build(options) {
  options = options || {};
  var db = options.db || dbDefault;
  var redisMGet = options.redisMGet || redisDefault.redisMGet;
  var now = finite(options.now) === null ? Date.now() : options.now;
  var client = safeClientModels(options.clientModels);
  var consoleSnapshot = null, opportunitiesSnapshot = null, cognition = {};
  var readErrors = [];

  try { consoleSnapshot = await db.get('console_snapshot'); }
  catch (e) { readErrors.push('console_snapshot:' + text(e && e.message || e, 160)); }
  try { opportunitiesSnapshot = await db.get('opportunities_snapshot'); }
  catch (e) { readErrors.push('opportunities_snapshot:' + text(e && e.message || e, 160)); }
  var cognitionKeys = DOMAINS.map(function (d) { return COGNITION_PREFIX + d; });
  try { cognition = await redisMGet(cognitionKeys) || {}; }
  catch (e) { readErrors.push('brain_cognition:' + text(e && e.message || e, 160)); }

  var consoleGeneratedAt = at(consoleSnapshot && consoleSnapshot.generatedAt);
  var consoleDomains = consoleSnapshot && consoleSnapshot.domains || {};
  var opps = opportunitiesByDomain(opportunitiesSnapshot);
  var domains = [];
  var serverCount = 0, semanticObserved = 0, headlineCount = 0, groundedCount = 0, divergentCount = 0, clientDrift = 0;

  DOMAINS.forEach(function (domain) {
    var runtimeKey = runtime(domain);
    var row = consoleDomains[runtimeKey] || consoleDomains[domain] || null;
    var rec = cognition[COGNITION_PREFIX + domain] || null;
    var cog = compactCognition(rec, now);
    var phase = compactPhase(row);
    var display = client[domain] || null;
    var stress = row && finite(row.stress) !== null ? round(row.stress) : cog.stress;
    var domainOpportunities = opps[domain] || [];
    var newsReview = investmentNewsReview(domainOpportunities, cog, phase);
    if (row || cog.present) serverCount++;
    if (cog.semanticEvidence.status === 'OBSERVED') semanticObserved++;
    headlineCount += cog.semanticEvidence.headlines.length;
    if (phase.grounded) groundedCount++;
    if (phase.divergent) divergentCount++;
    var drift = display && finite(display.stress) !== null && finite(stress) !== null ? round(Math.abs(display.stress - stress)) : null;
    if (drift !== null && drift >= 0.05) clientDrift++;
    domains.push({
      domain: domain,
      runtimeKey: runtimeKey,
      serverObservation: {
        present: !!row,
        stress: stress,
        confidence: round(row && row.confidence),
        activity: round(row && row.activity),
        stressSource: text(row && row.stressSource, 96),
        topSignal: text(row && row.topSignal, 240),
        topSignalSource: text(row && row.topSignalSource, 120),
        sourceCount: list(row && row.sources).length,
        observedAt: iso((row && row.updated) || consoleGeneratedAt)
      },
      cognition: cog,
      investmentNewsReview: newsReview,
      phaseContext: phase,
      opportunities: domainOpportunities,
      clientProjection: display ? { present: true, stress: display.stress, phase: display.phase, salience: display.salience, stressDriftFromServer: drift, role: display.role } : { present: false, role: 'display-advisory-only' },
      decisionAuthority: false
    });
  });

  var packetId = 'master-briefing:' + now + ':' + (consoleGeneratedAt || 'no-console');
  return {
    schemaVersion: 'master-briefing-evidence/1.0',
    packetId: packetId,
    generatedAt: new Date(now).toISOString(),
    mode: 'read-only-afferent',
    authority: {
      observes: true,
      synthesizes: true,
      selectsAction: false,
      movesCapital: false,
      posts: false,
      emails: false,
      writesDomainState: false
    },
    truthPolicy: {
      serverStoresAuthoritative: true,
      clientProjectionAdvisoryOnly: true,
      headlinesAreObservationsNotVerifiedClaims: true,
      opportunitiesAreCandidatesNotConclusions: true,
      thing2IsContextOnly: true,
      thing2DecisionAuthority: false,
      thing2PredictionAuthority: false
    },
    freshness: {
      consoleGeneratedAt: iso(consoleGeneratedAt),
      consoleAgeMs: consoleGeneratedAt === null ? null : Math.max(0, now - consoleGeneratedAt),
      consoleStale: consoleGeneratedAt === null || now - consoleGeneratedAt > CONSOLE_STALE_MS,
      opportunityGeneratedAt: iso(opportunitiesSnapshot && opportunitiesSnapshot.generatedAt)
    },
    coverage: {
      expectedDomains: DOMAINS.length,
      serverObservedDomains: serverCount,
      semanticObservedDomains: semanticObserved,
      evidenceHeadlinesIncluded: headlineCount,
      thing2ContextGroundedDomains: groundedCount,
      thing2ContextDivergentDomains: divergentCount,
      clientServerStressDriftDomains: clientDrift
    },
    readErrors: readErrors,
    domains: domains
  };
}

module.exports = {
  build: build,
  DOMAINS: DOMAINS,
  COGNITION_PREFIX: COGNITION_PREFIX,
  _test: {
    safeClientModels: safeClientModels,
    compactHeadline: compactHeadline,
    compactPhase: compactPhase,
    compactCognition: compactCognition,
    opportunitiesByDomain: opportunitiesByDomain,
    investmentNewsReview: investmentNewsReview
  }
};
