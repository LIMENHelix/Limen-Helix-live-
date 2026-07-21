/**
 * domain-identity.js — Canonical Domain Identity Resolver
 *
 * SINGLE SOURCE OF TRUTH for domain key resolution.
 *
 * Problem: 4 domains have dual naming (URL key ≠ API/runtime key):
 *   trade      ↔ supplyChain
 *   science    ↔ research
 *   medicine   ↔ health
 *   agriculture → portalKey: p2_agri
 *
 * This resolver centralizes all alias→canonical mappings so no other file
 * needs to maintain its own copy of the SK map.
 *
 * Usage:
 *   var id = window.LIMENDomainIdentity;
 *   id.snapshotKey('trade')     → 'supplyChain'
 *   id.snapshotKey('medicine')  → 'health'
 *   id.snapshotKey('energy')    → 'energy'  (passthrough)
 *   id.canonical('supplyChain') → 'trade'
 *   id.canonical('health')      → 'medicine'
 *   id.portalKey('agriculture') → 'p2_agri'
 *   id.resolve('health')        → { canonical:'medicine', snapshotKey:'health', portalKey:'medicine', label:'Medicine & Health' }
 *
 * Exposes: window.LIMENDomainIdentity (browser) + module.exports (node/generators/crons/tests).
 *
 * DUAL EXPORT ADDED 2026-07-21 — this file was browser-ONLY (window assignment, no module.exports),
 * so `require('./assets/js/domain-identity.js')` threw "window is not defined". That is the ROOT
 * CAUSE of agriculture falling out of the 19/20 neuro-substrate rollout: the generator runs in node,
 * could not load this table, and fell back to globbing `assets/data/domains/<domain>.json`. Every
 * domain matched except agriculture, whose file is `p2_agri.json` — so it was skipped silently.
 * The alias was never the bug; the resolver being unreachable from the code that needed it was.
 * Matches the dual-export contract every other shared module here already uses (limen-ei-balance.js
 * et al). Additive: the browser path is unchanged.
 *
 * RULE FOR ANY GENERATOR / PORT SCRIPT: never string-concatenate a domain name into a data path.
 * Resolve it — portalKey() for portal/graph data, snapshotKey() for runtime/API reads, canonical()
 * to normalize an unknown key. This covers all FOUR alias domains, not just agriculture: a glob-based
 * generator mis-keys trade (supplyChain), science (research) and medicine (health) the same way.
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL IDENTITY TABLE — edit HERE when domains change
  // ══════════════════════════════════════════════════════════════════════

  var DOMAINS = {
    trade:          { snapshotKey: 'supplyChain', portalKey: 'trade',      label: 'Supply Chain' },
    science:        { snapshotKey: 'research',    portalKey: 'science',    label: 'Research' },
    medicine:       { snapshotKey: 'health',      portalKey: 'medicine',   label: 'Medicine & Health' },
    agriculture:    { snapshotKey: 'agriculture',  portalKey: 'p2_agri',   label: 'Agriculture' },
    energy:         { snapshotKey: 'energy',       portalKey: 'energy',    label: 'Energy' },
    finance:        { snapshotKey: 'finance',      portalKey: 'finance',   label: 'Finance' },
    economy:        { snapshotKey: 'economy',      portalKey: 'economy',   label: 'Economy' },
    governance:     { snapshotKey: 'governance',   portalKey: 'governance', label: 'Governance' },
    infrastructure: { snapshotKey: 'infrastructure', portalKey: 'infrastructure', label: 'Infrastructure' },
    education:      { snapshotKey: 'education',    portalKey: 'education', label: 'Education' },
    technology:     { snapshotKey: 'technology',   portalKey: 'technology', label: 'Technology' },
    communication:  { snapshotKey: 'communication', portalKey: 'communication', label: 'Communication' },
    culture:        { snapshotKey: 'culture',      portalKey: 'culture',   label: 'Culture' },
    defense:        { snapshotKey: 'defense',      portalKey: 'defense',   label: 'Defense' },
    environment:    { snapshotKey: 'environment',  portalKey: 'environment', label: 'Environment' },
    religion:       { snapshotKey: 'religion',     portalKey: 'religion',  label: 'Religion' },
    population:     { snapshotKey: 'population',   portalKey: 'population', label: 'Population' },
    law:            { snapshotKey: 'law',          portalKey: 'law',       label: 'Law' },
    intelligence:   { snapshotKey: 'intelligence', portalKey: 'intelligence', label: 'Intelligence' },
    industry:       { snapshotKey: 'industry',     portalKey: 'industry',  label: 'Industry' }
  };

  // ══════════════════════════════════════════════════════════════════════
  // REVERSE ALIAS MAP — accepts any known key, returns canonical
  // ══════════════════════════════════════════════════════════════════════

  var ALIAS = {};
  for (var canon in DOMAINS) {
    ALIAS[canon] = canon;
    var sk = DOMAINS[canon].snapshotKey;
    if (sk !== canon) ALIAS[sk] = canon;
    var pk = DOMAINS[canon].portalKey;
    if (pk !== canon && pk !== sk) ALIAS[pk] = canon;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function resolve(key) {
    if (!key) return null;
    var canon = ALIAS[key] || key;
    var entry = DOMAINS[canon];
    if (!entry) {
      // Unknown domain — passthrough
      return { canonical: key, snapshotKey: key, portalKey: key, label: key };
    }
    return {
      canonical: canon,
      snapshotKey: entry.snapshotKey,
      portalKey: entry.portalKey,
      label: entry.label
    };
  }

  function canonical(key)   { var r = resolve(key); return r ? r.canonical : key; }
  function snapshotKey(key)  { var r = resolve(key); return r ? r.snapshotKey : key; }
  function portalKey(key)    { var r = resolve(key); return r ? r.portalKey : key; }
  function label(key)        { var r = resolve(key); return r ? r.label : key; }

  function isAlias(key) {
    return ALIAS[key] !== undefined && ALIAS[key] !== key;
  }

  function allCanonical() {
    return Object.keys(DOMAINS);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC — warn if stale alias usage detected
  // ══════════════════════════════════════════════════════════════════════

  function warnIfAlias(key, context) {
    if (isAlias(key)) {
      console.warn('[DomainIdentity] Stale alias "' + key + '" used in ' + (context || 'unknown') +
        ' — canonical is "' + canonical(key) + '". Consider updating to canonical key.');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS KEY TRANSLATION — portal issue ID → brain diagnosisIndex key
  // Infrastructure portal uses asset-class IDs; brain uses failure-category keys.
  // ══════════════════════════════════════════════════════════════════════

  var INFRA_PORTAL_TO_BRAIN = {
    'GRID_FAILURE':      'GRID_DEGRADATION',
    'BRIDGE_COLLAPSE':   'MAINTENANCE_DEFICIT',     // structural / aging-asset failure
    'WATER_CRISIS':      'MAINTENANCE_DEFICIT',     // aging water mains / deferred maintenance
    'TELECOM_OUTAGE':    'CYBER_PHYSICAL_ATTACK',   // digital/telecom infra → cyber-physical
    'TRANSIT_BREAKDOWN': 'MAINTENANCE_DEFICIT'
  };

  var API = {
    resolve: resolve,
    canonical: canonical,
    snapshotKey: snapshotKey,
    portalKey: portalKey,
    label: label,
    isAlias: isAlias,
    allCanonical: allCanonical,
    warnIfAlias: warnIfAlias,
    INFRA_PORTAL_TO_BRAIN: INFRA_PORTAL_TO_BRAIN
  };

  // Dual export (2026-07-21). Browser assignment unchanged; node/generator path added.
  if (typeof window !== 'undefined') window.LIMENDomainIdentity = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})();
