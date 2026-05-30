/**
 * medicine-targeting-engine.js — Context-aware targeting for promoted medicine directives
 *
 * Resolves WHO TO TARGET using a tiered model:
 *   Tier 1: Verified entities (domain-aligned companies from portal data)
 *   Tier 2: Entity classes (always present — industry segments)
 *   Tier 3: Example entities (high-confidence, well-known sector players)
 *
 * Filters out mismatched companies (e.g. pharma under hospital_systems).
 * Never hallucinates — Tier 3 uses only well-established industry names.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENMedicineTargetingEngine
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INDUSTRY SEGMENT TAXONOMY — maps node/directive context to segments
  // ══════════════════════════════════════════════════════════════════════

  var SEGMENTS = {
    pharma_biotech: {
      label: 'Pharmaceutical & biotechnology firms',
      keywords: ['pharma', 'biotech', 'drug', 'medication', 'prescription', 'therapeutic', 'molecule', 'biosimilar', 'generic', 'pipeline'],
      tier3: [
        { name: 'Johnson & Johnson', ticker: 'JNJ' },
        { name: 'Pfizer', ticker: 'PFE' },
        { name: 'Eli Lilly', ticker: 'LLY' },
        { name: 'Moderna', ticker: 'MRNA' },
        { name: 'Regeneron', ticker: 'REGN' }
      ]
    },
    medical_devices: {
      label: 'Medical device & equipment manufacturers',
      keywords: ['device', 'implant', 'surgical', 'instrument', 'prosthetic', 'imaging equipment', 'catheter', 'stent', 'robotic surgery', 'wearable'],
      tier3: [
        { name: 'Abbott Laboratories', ticker: 'ABT' },
        { name: 'Intuitive Surgical', ticker: 'ISRG' },
        { name: 'Thermo Fisher Scientific', ticker: 'TMO' },
        { name: 'Danaher', ticker: 'DHR' },
        { name: 'Illumina', ticker: 'ILMN' }
      ]
    },
    hospital_systems: {
      label: 'Hospital systems & health networks',
      keywords: ['hospital', 'health system', 'inpatient', 'icu', 'emergency department', 'bed capacity', 'acute care', 'trauma center', 'discharge', 'readmission'],
      tier3: [
        { name: 'HCA Healthcare', ticker: 'HCA' },
        { name: 'UnitedHealth Group', ticker: 'UNH' },
        { name: 'CommonSpirit Health', ticker: null },
        { name: 'Kaiser Permanente', ticker: null },
        { name: 'Ascension Health', ticker: null }
      ]
    },
    health_insurance: {
      label: 'Health insurance & managed care organizations',
      keywords: ['insurance', 'payer', 'coverage', 'premium', 'claims', 'managed care', 'reimbursement', 'copay', 'deductible', 'actuarial'],
      tier3: [
        { name: 'UnitedHealth Group', ticker: 'UNH' },
        { name: 'CVS Health (Aetna)', ticker: 'CVS' },
        { name: 'Cigna', ticker: 'CI' },
        { name: 'Elevance Health', ticker: null },
        { name: 'Centene', ticker: null }
      ]
    },
    telemedicine: {
      label: 'Telemedicine & digital health platforms',
      keywords: ['telemedicine', 'telehealth', 'virtual visit', 'remote care', 'digital health', 'remote monitoring', 'mhealth', 'patient portal', 'connected health'],
      tier3: [
        { name: 'Teladoc Health', ticker: 'TDOC' },
        { name: 'Veeva Systems', ticker: 'VEEV' },
        { name: 'Amwell', ticker: null },
        { name: 'Doximity', ticker: null },
        { name: 'Hims & Hers Health', ticker: null }
      ]
    },
    diagnostics: {
      label: 'Diagnostics & laboratory services firms',
      keywords: ['diagnostic', 'lab test', 'pathology', 'radiology', 'imaging', 'screening', 'biopsy', 'biomarker', 'genomic', 'molecular'],
      tier3: [
        { name: 'Thermo Fisher Scientific', ticker: 'TMO' },
        { name: 'Danaher', ticker: 'DHR' },
        { name: 'Illumina', ticker: 'ILMN' },
        { name: 'Quest Diagnostics', ticker: null },
        { name: 'Laboratory Corp', ticker: null }
      ]
    },
    clinical_research: {
      label: 'Clinical research organizations & trial sponsors',
      keywords: ['clinical trial', 'cro', 'research', 'phase', 'randomized', 'endpoint', 'fda approval', 'regulatory submission', 'protocol', 'investigator'],
      tier3: [
        { name: 'IQVIA', ticker: 'IQV' },
        { name: 'Vertex Pharmaceuticals', ticker: 'VRTX' },
        { name: 'PPD (Thermo Fisher)', ticker: 'TMO' },
        { name: 'Medpace', ticker: null },
        { name: 'Parexel', ticker: null }
      ]
    },
    mental_health: {
      label: 'Mental health & behavioral health providers',
      keywords: ['mental health', 'psychiatric', 'behavioral', 'depression', 'anxiety', 'substance', 'counseling', 'therapy', 'psycho', 'suicide'],
      tier3: [
        { name: 'Teladoc Health', ticker: 'TDOC' },
        { name: 'Acadia Healthcare', ticker: null },
        { name: 'Universal Health Services', ticker: null },
        { name: 'Talkspace', ticker: null },
        { name: 'SAMHSA', ticker: null }
      ]
    },
    public_health: {
      label: 'Public health agencies & epidemiology institutions',
      keywords: ['public health', 'epidemiology', 'surveillance', 'outbreak', 'cdc', 'prevention', 'immunization', 'vaccine', 'pandemic', 'quarantine'],
      tier3: [
        { name: 'CDC', ticker: null },
        { name: 'WHO', ticker: null },
        { name: 'Moderna', ticker: 'MRNA' },
        { name: 'Pfizer', ticker: 'PFE' },
        { name: 'BARDA', ticker: null }
      ]
    },
    specialty_care: {
      label: 'Specialty care & oncology/cardiology providers',
      keywords: ['oncology', 'cancer', 'cardiology', 'cardiac', 'neurology', 'orthopedic', 'specialty', 'surgery', 'transplant', 'rare disease'],
      tier3: [
        { name: 'Intuitive Surgical', ticker: 'ISRG' },
        { name: 'Regeneron', ticker: 'REGN' },
        { name: 'Vertex Pharmaceuticals', ticker: 'VRTX' },
        { name: 'Eli Lilly', ticker: 'LLY' },
        { name: 'MD Anderson Cancer Center', ticker: null }
      ]
    },
    home_health: {
      label: 'Home health & post-acute care providers',
      keywords: ['home health', 'home care', 'post-acute', 'rehabilitation', 'skilled nursing', 'hospice', 'palliative', 'long-term care', 'assisted living'],
      tier3: [
        { name: 'Amedisys', ticker: null },
        { name: 'Encompass Health', ticker: null },
        { name: 'BrightSpring Health', ticker: null },
        { name: 'Kindred Healthcare', ticker: null },
        { name: 'CMS Home Health Division', ticker: null }
      ]
    },
    health_it: {
      label: 'Health IT & electronic health record vendors',
      keywords: ['ehr', 'electronic health', 'interoperability', 'health information', 'clinical data', 'health it', 'fhir', 'hl7', 'health analytics', 'population health'],
      tier3: [
        { name: 'Veeva Systems', ticker: 'VEEV' },
        { name: 'Epic Systems', ticker: null },
        { name: 'Cerner (Oracle Health)', ticker: null },
        { name: 'Allscripts', ticker: null },
        { name: 'MEDITECH', ticker: null }
      ]
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // NODE → SEGMENT AFFINITY — which segments each medicine node maps to
  // ══════════════════════════════════════════════════════════════════════

  var NODE_SEGMENTS = {
    'STRI':  ['hospital_systems', 'health_insurance'],                   // Core Care Delivery & Coverage
    'FORN':  ['pharma_biotech', 'medical_devices'],                      // Drug & Device Supply Networks
    'OFC':   ['health_insurance', 'public_health'],                      // Health Finance & Public Health
    'S1':    ['hospital_systems', 'specialty_care'],                      // Acute & Specialty Care
    'vmPFC': ['public_health', 'health_insurance'],                      // Health Policy & Population Management
    'CBLM':  ['clinical_research', 'diagnostics'],                       // Clinical Research & Diagnostics
    'M1':    ['medical_devices', 'health_it'],                           // Medical Technology & Innovation
    'THAL':  ['hospital_systems', 'home_health'],                        // Care Distribution & Post-Acute
    'VTA':   ['telemedicine', 'health_it'],                              // Digital Health & Telehealth
    'PAG':   ['pharma_biotech', 'clinical_research'],                    // Pharma & Clinical Trials
    'NTS':   ['public_health', 'clinical_research'],                     // Epidemiology & Research
    'HIPP':  ['health_it', 'diagnostics'],                               // Clinical Data & Analytics
    'CC':    ['hospital_systems', 'specialty_care'],                      // Clinical Operations & Specialty
    'dlPFC': ['public_health', 'health_insurance'],                      // Regulatory & Payer Oversight
    'dACC':  ['diagnostics', 'clinical_research'],                       // Clinical Risk Assessment
    'ENS':   ['pharma_biotech', 'public_health'],                        // Drug Safety & Public Health Coordination
    'CAUD':  ['telemedicine', 'mental_health'],                          // Digital Mental Health & Innovation
    'FEF':   ['medical_devices', 'specialty_care'],                      // Surgical & Device Investment
    'BNST':  ['mental_health', 'home_health'],                           // Behavioral Health & Home Care
    'EMP':   ['public_health', 'pharma_biotech'],                        // Global Health Infrastructure
    'INS':   ['health_insurance', 'hospital_systems'],                   // Insurance & Network Management
    'AMY':   ['mental_health', 'specialty_care'],                        // Behavioral & Specialty Response
    'PCC':   ['hospital_systems', 'health_it'],                          // Care Coordination & HIT
    'SMA':   ['pharma_biotech', 'diagnostics'],                          // Drug Discovery & Diagnostics
    'PUT':   ['home_health', 'telemedicine']                             // Post-Acute & Remote Monitoring
  };

  // Companies that should NEVER appear under certain segments
  var EXCLUSIONS = {
    pharma_biotech:    ['HCA', 'TDOC', 'VEEV', 'ISRG'],
    medical_devices:   ['UNH', 'CVS', 'CI', 'TDOC', 'HCA'],
    hospital_systems:  ['ILMN', 'VRTX', 'MRNA', 'IQV', 'VEEV'],
    health_insurance:  ['ISRG', 'ILMN', 'TMO', 'DHR', 'MRNA'],
    telemedicine:      ['JNJ', 'PFE', 'ABT', 'ISRG', 'HCA'],
    diagnostics:       ['HCA', 'UNH', 'CVS', 'CI', 'TDOC'],
    clinical_research: ['HCA', 'CVS', 'CI', 'TDOC', 'ISRG'],
    mental_health:     ['JNJ', 'ABT', 'TMO', 'ISRG', 'ILMN'],
    public_health:     ['HCA', 'ISRG', 'VEEV', 'ILMN', 'DHR'],
    specialty_care:    ['TDOC', 'VEEV', 'CVS', 'CI', 'IQV'],
    home_health:       ['ISRG', 'ILMN', 'MRNA', 'VRTX', 'IQV'],
    health_it:         ['JNJ', 'PFE', 'LLY', 'MRNA', 'REGN']
  };

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE TARGETS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Resolve targeting for a promoted directive.
   */
  function resolveTargets(directive) {
    if (!directive) return _empty();

    var dir = directive._directive || {};
    var nodeId = dir.nodeId || '';
    var nodeLabel = (dir.nodeLabel || '').toLowerCase();
    var treatLabel = (dir.treatmentLabel || directive.title || '').toLowerCase();
    var dxId = (directive.diagnosisId || '').toLowerCase();
    var path = directive.path || 'GRANT-ELIGIBLE';

    // 1. Determine relevant segments
    var relevantSegments = _resolveSegments(nodeId, nodeLabel, treatLabel, dxId);

    // 2. Build Tier 2 — entity classes
    var tier2 = [];
    for (var si = 0; si < relevantSegments.length; si++) {
      var seg = SEGMENTS[relevantSegments[si]];
      if (seg) tier2.push({ segment: relevantSegments[si], label: seg.label });
    }

    // 3. Build Tier 1 — verified entities from portal data
    var tier1 = [];
    var portalCompanies = directive.examples || [];
    var rawCompanies = (directive._directive && directive._directive.companies) || [];
    var companyPool = [];
    if (rawCompanies.length > 0) {
      companyPool = rawCompanies;
    } else {
      for (var ei = 0; ei < portalCompanies.length; ei++) {
        var m = portalCompanies[ei].match(/^(.+?)\s*\(([A-Z.]+)\)$/);
        if (m) companyPool.push({ name: m[1], ticker: m[2] });
        else companyPool.push({ name: portalCompanies[ei], ticker: null });
      }
    }

    var validTickers = {};
    for (var sgi = 0; sgi < relevantSegments.length; sgi++) {
      var segKey = relevantSegments[sgi];
      var segTier3 = (SEGMENTS[segKey] || {}).tier3 || [];
      var exclusions = EXCLUSIONS[segKey] || [];
      for (var t3i = 0; t3i < segTier3.length; t3i++) {
        if (segTier3[t3i].ticker) validTickers[segTier3[t3i].ticker] = true;
      }
      for (var exi = 0; exi < exclusions.length; exi++) {
        validTickers[exclusions[exi]] = false;
      }
    }

    for (var ci = 0; ci < companyPool.length; ci++) {
      var co = companyPool[ci];
      var ticker = co.ticker || '';
      if (ticker && validTickers[ticker] === false) continue;
      if (ticker && validTickers[ticker] === true) {
        tier1.push({ name: co.name, ticker: ticker, source: 'portal_verified' });
      }
    }

    // 4. Build Tier 3 — example entities
    var tier3 = [];
    var tier1Tickers = {};
    for (var t1i = 0; t1i < tier1.length; t1i++) {
      if (tier1[t1i].ticker) tier1Tickers[tier1[t1i].ticker] = true;
    }

    for (var s3i = 0; s3i < relevantSegments.length; s3i++) {
      var seg3 = SEGMENTS[relevantSegments[s3i]];
      if (!seg3) continue;
      var examples = seg3.tier3 || [];
      for (var e3i = 0; e3i < Math.min(examples.length, 3); e3i++) {
        var ex = examples[e3i];
        if (ex.ticker && tier1Tickers[ex.ticker]) continue;
        tier3.push({ name: ex.name, ticker: ex.ticker, segment: relevantSegments[s3i] });
      }
    }
    tier3 = tier3.slice(0, 5);

    // 5. Execution targets based on path
    var executionTargets = [];
    if (path === 'GRANT-ELIGIBLE') executionTargets = ['NIH program offices', 'BARDA advanced research division', 'CMS Innovation Center', 'HRSA regional offices', 'State health departments'];
    else if (path === 'PATENTABLE') executionTargets = ['Patent attorneys (life sciences)', 'Health IT licensing platforms', 'Strategic acquirers (medtech/pharma)'];
    else if (path === 'INVESTABLE') executionTargets = ['Healthcare-focused hedge funds', 'Biotech venture capital', 'Hospital REIT investors'];

    // 6. Format for display
    var formatted = _format(tier1, tier2, tier3, executionTargets);

    return {
      tier1: tier1,
      tier2: tier2,
      tier3: tier3,
      executionTargets: executionTargets,
      formatted: formatted,
      segments: relevantSegments
    };
  }

  /**
   * Determine relevant industry segments from node + directive context.
   */
  function _resolveSegments(nodeId, nodeLabel, treatLabel, dxId) {
    var segments = [];
    var seen = {};

    var nodeMapped = NODE_SEGMENTS[nodeId] || [];
    for (var ni = 0; ni < nodeMapped.length; ni++) {
      if (!seen[nodeMapped[ni]]) { seen[nodeMapped[ni]] = true; segments.push(nodeMapped[ni]); }
    }

    var text = (nodeLabel + ' ' + treatLabel + ' ' + dxId).toLowerCase();
    for (var segKey in SEGMENTS) {
      if (seen[segKey]) continue;
      var kws = SEGMENTS[segKey].keywords;
      for (var ki = 0; ki < kws.length; ki++) {
        if (text.indexOf(kws[ki]) !== -1) {
          seen[segKey] = true;
          segments.push(segKey);
          break;
        }
      }
    }

    if (segments.length === 0) segments.push('pharma_biotech');

    return segments;
  }

  /**
   * Format targets for display.
   */
  function _format(tier1, tier2, tier3, executionTargets) {
    var parts = [];

    if (tier2.length > 0) {
      var classes = tier2.map(function (t) { return t.label; });
      parts.push(classes.join('. ') + '.');
    }

    if (tier1.length > 0) {
      var verified = tier1.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Verified: ' + verified.join(', ') + '.');
    }

    if (tier3.length > 0) {
      var examples = tier3.map(function (t) { return t.name + (t.ticker ? ' (' + t.ticker + ')' : ''); });
      parts.push('Also consider: ' + examples.join(', ') + '.');
    }

    if (executionTargets.length > 0) {
      parts.push('Execute via: ' + executionTargets.join(', ') + '.');
    }

    return parts.join(' ');
  }

  function _empty() {
    return { tier1: [], tier2: [], tier3: [], executionTargets: [], formatted: '', segments: [] };
  }

  window.LIMENMedicineTargetingEngine = { resolveTargets: resolveTargets };
})();
