/**
 * LIMEN Master Brain — Observatory Input Bundle (OIB) assembler — Phase 1
 *
 * Read-only SNAPSHOT of production observatory surfaces. Performs zero
 * writes to source windows. Emits no decisions. Persists nothing.
 *
 * Exposes: window.LIMENMasterBrain.getOIB()
 *
 * Spec: Master Brain spec §2 (INPUT CONTRACT) / §9 FIRST BUILD TARGET.
 * Shape:
 *   OIB = {
 *     assembledAt, cycleId,
 *     sources:       { civilization, domains, globalState, polarity,
 *                      patentOpp, regulation, reports },
 *     envelopes:     { perSource: { [key]: { freshnessMs, trustTier,
 *                                            schemaVersion, available } } },
 *     admissibility: { overallConfidence, overallTier, floors }
 *   }
 *
 * Snapshot contract:
 *   - Each source in OIB.sources.* is a safe plain-object CLONE of the
 *     corresponding production window (structuredClone when available,
 *     JSON fallback otherwise). Never a live reference.
 *   - Availability reflects original source presence at assembly time.
 *     A clone failure does NOT downgrade availability; in that case the
 *     source field is null while `available` remains true. Callers can
 *     infer clone-failed as `available && sources.foo === null`.
 *   - freshnessMs is null when no trustworthy timestamp exists on the
 *     source. Never synthesized from Date.now() as a fake fallback.
 *   - Confidence is never upgraded. admissibility is derived from the
 *     CLONED civilization evidence when present; conservative
 *     null / 'insufficient' otherwise.
 *
 * Not in this phase: decisions, persistence, telemetry, UI surfaces.
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 'v1';

  // Static trust-tier table (Master Brain spec §2). 'domains' is
  // freshness-gated and computed per snapshot; not in this table.
  var TRUST_TIER_STATIC = {
    civilization: 'high',
    reports:      'high',
    globalState:  'moderate',
    polarity:     'moderate',
    regulation:   'moderate',
    patentOpp:    'low'
  };

  // domains.* → 'high' when freshnessMs < this; else 'moderate'.
  var FRESHNESS_DOMAIN_HIGH_MS = 60000;

  // Floors exposed on admissibility for downstream phases.
  var FLOORS = {
    admissibility:       0.40,  // evidence-builder 'low' band
    autoEmit:            0.75,  // evidence-builder 'high' band
    synthesisMinSources: 3      // spec §3
  };

  // Monotonic cycle counter — guarantees unique cycleId even on
  // same-millisecond calls within a session.
  var _cycleCounter = 0;
  function _nextCycleId(ts) {
    _cycleCounter += 1;
    return 'oib-' + ts + '-' + _cycleCounter;
  }

  function _isFiniteNumber(x) {
    return typeof x === 'number' && isFinite(x);
  }

  // Safe plain-object snapshot. Returns null on any clone failure.
  // Never mutates the input.
  function _safeClone(src) {
    if (src === null || typeof src === 'undefined') return null;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(src); }
      catch (e) { /* fall through to JSON fallback */ }
    }
    try { return JSON.parse(JSON.stringify(src)); }
    catch (e) { return null; }
  }

  function _freshnessFromTimestamp(ts, now) {
    if (!_isFiniteNumber(ts)) return null;
    return Math.max(0, now - ts);
  }

  // Oldest domain freshness — conservative read: if any domain is stale,
  // the aggregate is stale. Returns null if no domain has a finite
  // `updated` timestamp.
  function _oldestDomainFreshness(domains, now) {
    if (!domains || typeof domains !== 'object') return null;
    var oldestTs = null;
    for (var k in domains) {
      if (!Object.prototype.hasOwnProperty.call(domains, k)) continue;
      var d = domains[k];
      if (!d || !_isFiniteNumber(d.updated)) continue;
      if (oldestTs === null || d.updated < oldestTs) oldestTs = d.updated;
    }
    return oldestTs === null ? null : Math.max(0, now - oldestTs);
  }

  function _oldestReportFreshness(reports, now) {
    if (!reports || typeof reports !== 'object') return null;
    var oldestTs = null;
    for (var k in reports) {
      if (!Object.prototype.hasOwnProperty.call(reports, k)) continue;
      var r = reports[k];
      if (!r || !_isFiniteNumber(r.generatedAt)) continue;
      if (oldestTs === null || r.generatedAt < oldestTs) oldestTs = r.generatedAt;
    }
    return oldestTs === null ? null : Math.max(0, now - oldestTs);
  }

  function _domainsTrustTier(freshnessMs) {
    if (freshnessMs === null) return 'moderate';
    return freshnessMs < FRESHNESS_DOMAIN_HIGH_MS ? 'high' : 'moderate';
  }

  function _isNonEmptyObject(x) {
    if (x === null || typeof x !== 'object') return false;
    for (var k in x) {
      if (Object.prototype.hasOwnProperty.call(x, k)) return true;
    }
    return false;
  }

  // Admissibility derived from the CLONED civilization snapshot. Keeps
  // the OIB self-contained — if clone failed, admissibility degrades
  // conservatively to null / 'insufficient'.
  function _deriveAdmissibility(civSnapshot) {
    var conf = null;
    var tier = 'insufficient';
    if (civSnapshot && civSnapshot.evidence) {
      var ev = civSnapshot.evidence;
      if (_isFiniteNumber(ev.overallConfidence)) conf = ev.overallConfidence;
      if (typeof ev.overallTier === 'string' && ev.overallTier) tier = ev.overallTier;
    }
    return {
      overallConfidence: conf,
      overallTier:       tier,
      floors:            FLOORS
    };
  }

  function getOIB() {
    var now = Date.now();
    var w   = (typeof window !== 'undefined') ? window : null;

    // Raw references — used ONLY for availability checks and freshness
    // derivation. Never placed into the returned OIB.
    var rawReports      = (w && w.LIMENReports)           ? w.LIMENReports           : null;
    var rawCivilization = (rawReports && rawReports.civilization) ? rawReports.civilization : null;
    var rawDomains      = (w && w.LIMENDomains)           ? w.LIMENDomains           : null;
    var rawGlobalState  = (w && w.LIMENGlobalState)       ? w.LIMENGlobalState       : null;
    var rawPolarity     = (w && w.LIMENPolarity)          ? w.LIMENPolarity          : null;
    var rawPatentOpp    = (w && w.LIMENPatentOpportunity) ? w.LIMENPatentOpportunity : null;
    var rawRegulation   = (w && w.LIMENRegulationOutput)  ? w.LIMENRegulationOutput  : null;

    // Availability — computed from raw sources, BEFORE cloning. Clone
    // failures do not flip availability; the envelope honestly reports
    // source presence at assembly time.
    var availCivilization = rawCivilization !== null && typeof rawCivilization === 'object';
    var availDomains      = _isNonEmptyObject(rawDomains);
    var availGlobalState  = rawGlobalState !== null && typeof rawGlobalState === 'object';
    var availPolarity     = rawPolarity !== null && typeof rawPolarity === 'object';
    var availPatentOpp    = rawPatentOpp !== null && typeof rawPatentOpp === 'object';
    var availRegulation   = rawRegulation !== null && typeof rawRegulation === 'object';
    var availReports      = _isNonEmptyObject(rawReports);

    // Freshness — computed from raw sources (read-only iteration).
    var freshCiv     = rawCivilization && _isFiniteNumber(rawCivilization.generatedAt)
                       ? _freshnessFromTimestamp(rawCivilization.generatedAt, now)
                       : null;
    var freshDomains = _oldestDomainFreshness(rawDomains, now);
    var freshReports = _oldestReportFreshness(rawReports, now);
    // globalState / polarity / patentOpp / regulation have no canonical
    // timestamps on their production shapes — honest null, no invention.

    // Safe snapshot clones. Any clone failure yields null for that
    // source; availability remains based on the raw-source check.
    var snapCivilization = availCivilization ? _safeClone(rawCivilization) : null;
    var snapDomains      = availDomains      ? _safeClone(rawDomains)      : null;
    var snapGlobalState  = availGlobalState  ? _safeClone(rawGlobalState)  : null;
    var snapPolarity     = availPolarity     ? _safeClone(rawPolarity)     : null;
    var snapPatentOpp    = availPatentOpp    ? _safeClone(rawPatentOpp)    : null;
    var snapRegulation   = availRegulation   ? _safeClone(rawRegulation)   : null;
    var snapReports      = availReports      ? _safeClone(rawReports)      : null;

    var perSource = {
      civilization: { freshnessMs: freshCiv,     trustTier: TRUST_TIER_STATIC.civilization,  schemaVersion: SCHEMA_VERSION, available: availCivilization },
      domains:      { freshnessMs: freshDomains, trustTier: _domainsTrustTier(freshDomains), schemaVersion: SCHEMA_VERSION, available: availDomains },
      globalState:  { freshnessMs: null,         trustTier: TRUST_TIER_STATIC.globalState,   schemaVersion: SCHEMA_VERSION, available: availGlobalState },
      polarity:     { freshnessMs: null,         trustTier: TRUST_TIER_STATIC.polarity,      schemaVersion: SCHEMA_VERSION, available: availPolarity },
      patentOpp:    { freshnessMs: null,         trustTier: TRUST_TIER_STATIC.patentOpp,     schemaVersion: SCHEMA_VERSION, available: availPatentOpp },
      regulation:   { freshnessMs: null,         trustTier: TRUST_TIER_STATIC.regulation,    schemaVersion: SCHEMA_VERSION, available: availRegulation },
      reports:      { freshnessMs: freshReports, trustTier: TRUST_TIER_STATIC.reports,       schemaVersion: SCHEMA_VERSION, available: availReports }
    };

    return {
      assembledAt: now,
      cycleId:     _nextCycleId(now),
      sources: {
        civilization: snapCivilization,
        domains:      snapDomains,
        globalState:  snapGlobalState,
        polarity:     snapPolarity,
        patentOpp:    snapPatentOpp,
        regulation:   snapRegulation,
        reports:      snapReports
      },
      envelopes: {
        perSource: perSource
      },
      admissibility: _deriveAdmissibility(snapCivilization)
    };
  }

  if (typeof window !== 'undefined') {
    window.LIMENMasterBrain = {
      getOIB: getOIB
    };
  }
})();
