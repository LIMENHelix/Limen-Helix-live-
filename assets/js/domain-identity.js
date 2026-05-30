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
 * Exposes: window.LIMENDomainIdentity
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
    'BRIDGE_COLLAPSE':   'MAINTENANCE_DEFICIT',
    'WATER_CRISIS':      'GRID_DEGRADATION',
    'TELECOM_OUTAGE':    'GRID_DEGRADATION',
    'TRANSIT_BREAKDOWN': 'MAINTENANCE_DEFICIT'
  };

  window.LIMENDomainIdentity = {
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

})();
