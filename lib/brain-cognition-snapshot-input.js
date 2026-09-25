'use strict';

/*
 * Assemble the hosted cognition runner's read model from two existing stores:
 *
 *   domain-snapshot  -> live feed/source observations
 *   console_snapshot -> node-grounded phase + domain/company join
 *
 * The merge is intentionally narrow. Console stress and other derived fields
 * do not replace the live domain observation. Only the phase authority fields,
 * company join, and convergence evidence are promoted. Missing or stale
 * console evidence produces an explicit abstention and never a fabricated
 * empty/grounded reading.
 */

var SCHEMA = 'brain-cognition-snapshot-input/1.0';
var MAX_CONSOLE_AGE_MS = 20 * 60 * 1000;
var MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
var ALIASES = Object.freeze({ medicine: 'health', science: 'research', trade: 'supplyChain' });
var REVERSE = Object.freeze({ health: 'medicine', research: 'science', supplyChain: 'trade' });
var PHASE_RE = /^p(?:[0-9]|10)(?:[ab])?$/i;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function runtimeDomain(domain) { return ALIASES[domain] || domain; }

function keysFor(domain) {
  var canonical = runtimeDomain(domain);
  var legacy = REVERSE[canonical];
  return [domain, canonical, legacy].filter(function (value, index, list) {
    return value && list.indexOf(value) === index;
  });
}

function readDomain(map, domain) {
  if (!map || typeof map !== 'object') return null;
  var keys = keysFor(domain);
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]] != null) return map[keys[i]];
  }
  return null;
}

function validConsole(consoleSnapshot, now) {
  if (!consoleSnapshot || typeof consoleSnapshot !== 'object' || Array.isArray(consoleSnapshot)) {
    return { ok: false, reason: 'console-snapshot-missing' };
  }
  var generatedAt = Number(consoleSnapshot.generatedAt);
  if (!Number.isFinite(generatedAt)) return { ok: false, reason: 'console-snapshot-time-missing' };
  var ageMs = now - generatedAt;
  if (ageMs < -MAX_FUTURE_SKEW_MS) return { ok: false, reason: 'console-snapshot-from-future', ageMs: ageMs };
  if (ageMs > MAX_CONSOLE_AGE_MS) return { ok: false, reason: 'console-snapshot-stale', ageMs: ageMs };
  if (!consoleSnapshot.domains || typeof consoleSnapshot.domains !== 'object') {
    return { ok: false, reason: 'console-snapshot-domains-missing', ageMs: ageMs };
  }
  return { ok: true, ageMs: Math.max(0, ageMs), generatedAt: generatedAt };
}

function copyAliasedMap(source) {
  var out = {};
  if (!source || typeof source !== 'object') return out;
  Object.keys(source).forEach(function (domain) {
    var row = clone(source[domain]);
    keysFor(domain).forEach(function (key) { out[key] = row; });
  });
  return out;
}

function overlayPhase(target, source) {
  if (!target || !source || !PHASE_RE.test(String(source.phase || ''))) return false;
  target.phase = String(source.phase).toLowerCase();
  target.phaseLabel = source.phaseLabel || target.phaseLabel || null;
  target.phaseSource = source.phaseSource || 'console-snapshot';
  target.phaseGrounded = source.phaseGrounded === true;
  target.phaseDivergent = source.phaseDivergent === true;
  target.phasePrior = source.phasePrior || null;
  target.phasePrecision = source.phasePrecision == null ? null : source.phasePrecision;
  target.phaseSalience = source.phaseSalience == null ? null : source.phaseSalience;
  target.phaseEvidence = clone(source.phaseEvidence || null);
  return true;
}

function merge(domainSnapshot, consoleSnapshot, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  if (!domainSnapshot || typeof domainSnapshot !== 'object' || Array.isArray(domainSnapshot) ||
      !domainSnapshot.domains || !domainSnapshot.meta) {
    throw new Error('brain cognition snapshot input requires domain-snapshot domains and meta');
  }
  var snapshot = clone(domainSnapshot);
  var check = validConsole(consoleSnapshot, now);
  var evidence = {
    schemaVersion: SCHEMA,
    status: check.ok ? 'OBSERVED' : 'ABSTAINED',
    reason: check.ok ? null : check.reason,
    phaseAuthority: check.ok ? 'console_snapshot.domain.phase' : 'domain-snapshot-fallback',
    consoleGeneratedAt: check.generatedAt || null,
    consoleAgeMs: Number.isFinite(check.ageMs) ? check.ageMs : null,
    phaseDomainsOverlaid: 0,
    companyJoinDomains: 0,
    aliases: clone(ALIASES),
    readOnly: true
  };

  snapshot.domainCompanyJoin = {};
  snapshot.convergenceSignals = {};
  if (!check.ok) {
    snapshot.cognitionInputEvidence = evidence;
    return { snapshot: snapshot, evidence: evidence };
  }

  Object.keys(snapshot.domains).forEach(function (domain) {
    var phaseRow = readDomain(consoleSnapshot.domains, domain);
    if (phaseRow && overlayPhase(snapshot.domains[domain], phaseRow)) evidence.phaseDomainsOverlaid++;
  });
  snapshot.domainCompanyJoin = copyAliasedMap(consoleSnapshot.domainCompanyJoin);
  snapshot.convergenceSignals = copyAliasedMap(consoleSnapshot.convergenceSignals);
  evidence.companyJoinDomains = Object.keys(consoleSnapshot.domainCompanyJoin || {}).length;
  snapshot.meta = Object.assign({}, snapshot.meta, {
    phaseAuthority: evidence.phaseAuthority,
    consoleSnapshotGeneratedAt: evidence.consoleGeneratedAt,
    consoleSnapshotAgeMs: evidence.consoleAgeMs
  });
  snapshot.cognitionInputEvidence = evidence;
  return { snapshot: snapshot, evidence: evidence };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_CONSOLE_AGE_MS: MAX_CONSOLE_AGE_MS,
  MAX_FUTURE_SKEW_MS: MAX_FUTURE_SKEW_MS,
  ALIASES: ALIASES,
  runtimeDomain: runtimeDomain,
  readDomain: readDomain,
  validConsole: validConsole,
  merge: merge
};
