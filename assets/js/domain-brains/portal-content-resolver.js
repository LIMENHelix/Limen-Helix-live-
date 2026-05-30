/**
 * portal-content-resolver.js — Deep Portal Content Pipeline
 *
 * When a domain brain activates a diagnosis, this resolver fetches
 * the relevant deep portal subtree and extracts treatments with
 * full depth: steps, citations, monitoring, escalation.
 *
 * The resolver maps diagnosis conditions to portal subtrees:
 *   OIL_SHOCK → energy_fossil, energy_pipeline, energy_energytrade
 *   GRID_COLLAPSE → energy_grid, energy_power, energy_transmission
 *   etc.
 *
 * Fetched content is cached and made available to:
 *   - Brain treatment recommendations
 *   - Document generators (grant, patent, investor memo)
 *   - UI drill-deeper panels
 *
 * Exposes: window.LIMENPortalContentResolver
 */
(function () {
  'use strict';

  var CACHE_TTL = 300000; // 5 min positive cache
  var NEG_CACHE_TTL = 3600000; // 1 hour negative cache for paths that 404
  var _cache = {};        // domainId -> { data, timestamp }
  var _negCache = {};     // domainId -> timestamp of last failed lookup
  var _deepTreatmentCache = {}; // diagnosisKey -> [treatments with full depth]

  // Lightweight counters so each top-level resolve run can emit ONE summary
  // log instead of relying on browser-auto 404 lines. Reads are taken at
  // entry and exit of resolveForBrain/resolveForDiagnosis (delta logged).
  var _stats = { fetched: 0, hit: 0, neg: 0, missed: 0 };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS → PORTAL SUBTREE MAPPING
  //
  // Maps diagnosis IDs to which child portal domains contain relevant
  // treatments. Each diagnosis may span multiple portal subtrees.
  // ══════════════════════════════════════════════════════════════════════

  var DIAGNOSIS_PORTAL_MAP = {
    // Energy domain
    OIL_SHOCK:                ['energy_fossil', 'energy_pipeline', 'energy_energytrade', 'energy_distribution'],
    GRID_COLLAPSE:            ['energy_grid', 'energy_transmission', 'energy_gridmod', 'energy_distribution', 'energy_power'],
    NUCLEAR_INCIDENT:         ['energy_nuclear', 'energy_energypolicy'],
    RENEWABLE_INTERMITTENCY:  ['energy_solar', 'energy_hydro', 'energy_battery', 'energy_storage', 'energy_offgrid'],
    PIPELINE_DISRUPTION:      ['energy_pipeline', 'energy_distribution', 'energy_transmission'],

    // Energy deep subtree diagnoses (auto-mapped from portal hierarchy)
    ENERGY_POWER_SYSTEM_FAILURE: ['energy_power'],
    ENERGY_POWER_CAPACITY_CRISIS: ['energy_power'],
    ENERGY_GRID_SYSTEM_FAILURE: ['energy_grid'],
    ENERGY_FOSSIL_SYSTEM_FAILURE: ['energy_fossil'],
    ENERGY_FOSSIL_CAPACITY_CRISIS: ['energy_fossil'],

    // Supply chain / Trade domain
    SUPPLY_CHAIN_COLLAPSE:    ['trade_supply', 'trade_container', 'trade_warehousing', 'trade_trucking', 'trade_rail'],
    INDUSTRIAL_INPUT_FAILURE: ['trade_supply', 'trade_container', 'trade_warehousing', 'trade_trucking', 'trade_rail'],
    PORT_BLOCKADE:            ['trade_port', 'trade_container', 'trade_customs'],
    TRADE_WAR:                ['trade_tradepolicy', 'trade_customs', 'trade_tradezone', 'trade_wto', 'trade_tradecompliance'],
    TARIFF_SHOCK:             ['trade_tradepolicy', 'trade_customs', 'trade_tradezone', 'trade_wto', 'trade_tradecompliance'],
    SHIPPING_CRISIS:          ['trade_container', 'trade_air', 'trade_port', 'trade_lastmile'],
    CUSTOMS_DISRUPTION:       ['trade_customs', 'trade_tradecompliance', 'trade_origincert'],
    MARITIME_ROUTING:         ['trade_container', 'trade_port'],
    FREIGHT_DISRUPTION:       ['trade_trucking', 'trade_rail', 'trade_air'],

    // Defense domain
    ESCALATION_CASCADE:       ['defense_procurement', 'defense_operations'],
    STRAIT_CONTROL:           ['defense_naval', 'defense_operations'],

    // Finance domain
    BANKING_CRISIS:           ['finance_commercial', 'finance_centralbank', 'finance_insurance', 'finance_reinsurance'],
    CREDIT_CHANNEL_BREAK:     ['finance_commercial', 'finance_centralbank', 'finance_insurance', 'finance_reinsurance'],
    CREDIT_FREEZE:            ['finance_commercial', 'finance_bond', 'finance_microfinance'],
    MARKET_CRASH:             ['finance_stock', 'finance_derivatives', 'finance_private', 'finance_venture'],
    EQUITY_WEALTH_SHOCK:      ['finance_stock', 'finance_derivatives', 'finance_private', 'finance_venture'],
    CURRENCY_COLLAPSE:        ['finance_forex', 'finance_sovereign', 'finance_centralbank'],
    SYSTEMIC_CONTAGION:       ['finance_compliance', 'finance_derivatives', 'finance_stock', 'finance_commercial'],
    FRAUD_SCANDAL:            ['finance_accounting', 'finance_compliance', 'finance_corporatefin'],

    // Defense domain
    INVASION:              ['defense_ground', 'defense_air', 'defense_command', 'defense_naval'],
    CYBER_OPERATION:       ['defense_cyber', 'defense_deftech', 'defense_intelligence', 'technology_cybersecurity'],
    CYBER_ATTACK:          ['defense_cyber', 'defense_deftech', 'defense_intelligence', 'technology_cybersecurity'],
    NUCLEAR_THREAT:        ['defense_missile', 'defense_nuclear', 'defense_command', 'defense_alliances'],
    INTEL_COMPROMISE:      ['defense_intelligence', 'defense_command', 'defense_strategic'],
    INTELLIGENCE_FAILURE:  ['defense_intelligence', 'defense_command', 'defense_strategic'],
    LOGISTICS_COLLAPSE:    ['defense_logistics', 'defense_ground', 'defense_procurement'],
    CIVIL_UNREST:          ['defense_ground', 'defense_defreform', 'defense_personnel'],

    // Science/Research domain
    REPLICATION_CRISIS:   ['science_replication', 'science_experimental', 'science_peer'],
    FUNDING_COLLAPSE:     ['science_funding', 'science_policy', 'science_metrics'],
    INFRA_FUNDING_COLLAPSE: ['science_funding', 'science_policy', 'science_metrics'],
    DATA_FRAUD:           ['science_integrity', 'science_ethics', 'science_data'],
    PARADIGM_CONFLICT:    ['science_hypothesis', 'science_openscience', 'science_collaboration'],
    BRAIN_DRAIN:          ['science_workforce', 'science_policy', 'science_laboratory'],
    PUBLICATION_BIAS:     ['science_publication', 'science_peer', 'science_citation'],

    // Industry domain (SUPPLY_CHAIN_COLLAPSE shared key with Trade — resolver serves both)
    AUTOMATION_FAILURE:        ['industry_automation', 'industry_robotics', 'industry_assembly', 'industry_quality'],
    TOXIC_SPILL:               ['industry_safety', 'industry_indsafety', 'industry_sustainability'],
    QUALITY_CRISIS:            ['industry_qualitymgmt', 'industry_quality', 'industry_design'],
    WORKFORCE_SHORTAGE:        ['industry_industrial', 'industry_assembly', 'industry_indpolicy'],

    // Infrastructure domain
    GRID_FAILURE:         ['infrastructure_electrical', 'infrastructure_pipeline', 'infrastructure_resilience'],
    BRIDGE_COLLAPSE:      ['infrastructure_bridges', 'infrastructure_road', 'infrastructure_maintenance', 'infrastructure_construction'],
    WATER_CRISIS:         ['infrastructure_water', 'infrastructure_dams', 'infrastructure_waste_infra'],
    TELECOM_OUTAGE:       ['infrastructure_telecom', 'infrastructure_digital', 'infrastructure_smartcity'],
    TRANSIT_BREAKDOWN:    ['infrastructure_transit', 'infrastructure_rail', 'infrastructure_road', 'infrastructure_urban'],
    // Infrastructure domain — new brain diagnosis IDs
    GRID_DEGRADATION:     ['infrastructure_electrical', 'infrastructure_pipeline', 'infrastructure_resilience', 'infrastructure_smartcity'],
    SUPPLY_CHAIN_BOTTLENECK: ['infrastructure_construction', 'infrastructure_road', 'infrastructure_bridges', 'infrastructure_maintenance'],
    CAPACITY_OVERLOAD:    ['infrastructure_transit', 'infrastructure_road', 'infrastructure_urban', 'infrastructure_rail'],
    MAINTENANCE_DEFICIT:  ['infrastructure_maintenance', 'infrastructure_bridges', 'infrastructure_dams', 'infrastructure_water'],
    CYBER_PHYSICAL_ATTACK: ['infrastructure_digital', 'infrastructure_smartcity', 'infrastructure_telecom', 'infrastructure_resilience'],

    // Governance domain
    CONSTITUTIONAL_CRISIS:    ['governance_constitutional', 'governance_judicial', 'governance_legislative', 'governance_executive'],
    REGIME_INSTABILITY:       ['governance_executive', 'governance_succession', 'governance_crisis', 'governance_electoral'],
    POLICY_FAILURE:           ['governance_policy', 'governance_regulatory', 'governance_federalism', 'governance_intergovt'],
    CORRUPTION_SCANDAL:       ['governance_anticorruption', 'governance_govaudit', 'governance_public'],
    DIPLOMATIC_BREAKDOWN:     ['governance_diplomatic', 'governance_sanctions', 'governance_intelligence'],
    MILITARY_OVERREACH:       ['governance_crisis', 'governance_intelligence', 'governance_executive'],

    // Agriculture domain
    CASH_FLOW_CRISIS:         ['p2_agri_finance', 'p2_agri_commodity', 'p2_agri_fertilizer', 'p2_agri_landuse'],
    SUPPLY_CHAIN_BREAKDOWN:   ['p2_agri_supplychain', 'p2_agri_foodproc', 'p2_agri_postharvest', 'p2_agri_livestock', 'p2_agri_commodity'],
    DROUGHT:                  ['p2_agri_climate', 'p2_agri_water', 'p2_agri_soil', 'p2_agri_crop', 'p2_agri_landuse'],
    MARKET_COLLAPSE:          ['p2_agri_commodity', 'p2_agri_finance', 'p2_agri_supplychain'],
    EQUIPMENT_FAILURE:        ['p2_agri_equipment', 'p2_agri_machinery', 'p2_agri_precisionag', 'p2_agri_crop'],
    PEST_OUTBREAK:            ['p2_agri_protection', 'p2_agri_crop', 'p2_agri_livestock', 'p2_agri_horticulture'],

    // Environment domain
    CLIMATE_TIPPING_POINT:    ['environment_climate', 'environment_airquality', 'environment_water', 'environment_conservation'],
    MASS_EXTINCTION:          ['environment_conservation', 'environment_wildlife', 'environment_ocean', 'environment_biodiversity'],
    OCEAN_ACIDIFICATION:      ['environment_ocean', 'environment_water', 'environment_climate', 'environment_pollution'],
    DEFORESTATION:            ['environment_conservation', 'environment_biodiversity', 'environment_soil', 'environment_climate'],
    TOXIC_CONTAMINATION:      ['environment_pollution', 'environment_water', 'environment_soil', 'environment_airquality'],

    // Technology domain
    CYBER_ATTACK:                 ['technology_cybersecurity', 'technology_networking', 'technology_cloud', 'technology_data'],
    AI_ALIGNMENT_FAILURE:         ['technology_artificial', 'technology_machine', 'technology_robotics', 'technology_techethics'],
    INFRASTRUCTURE_COLLAPSE:      ['technology_cloud', 'technology_networking', 'technology_data', 'technology_devops'],
    DATA_BREACH:                  ['technology_cybersecurity', 'technology_data', 'technology_cloud'],
    CHIP_SHORTAGE:                ['technology_hardware', 'technology_semiconductors', 'technology_chipindustry'],
    PLATFORM_MONOPOLY:            ['technology_platforms', 'technology_software', 'technology_cloud', 'technology_opensource'],

    // Culture domain
    CULTURAL_ERASURE:             ['culture_cultpolicy', 'culture_architecture', 'culture_crafts', 'culture_dance'],
    HERITAGE_DESTRUCTION:         ['culture_architecture', 'culture_cultpolicy', 'culture_criticism', 'culture_crafts'],
    CENSORSHIP:                   ['culture_cultpolicy', 'culture_criticism', 'culture_culinary', 'culture_dance'],
    IDENTITY_CRISIS:              ['culture_cultpolicy', 'culture_cultural_econ', 'culture_crafts', 'culture_dance'],
    CREATIVE_STAGNATION:          ['culture_cultural_econ', 'culture_dance', 'culture_criticism', 'culture_culinary'],

    // Communication domain
    DISINFORMATION_CRISIS:        ['communication_disinfo', 'communication_social', 'communication_journalism', 'communication_public'],
    TELECOM_FAILURE:              ['communication_telecom', 'communication_datacomm', 'communication_satellite', 'communication_internet'],
    CENSORSHIP_OVERREACH:         ['communication_medialaw', 'communication_public', 'communication_journalism', 'communication_accesscomm'],
    MEDIA_MONOPOLY:               ['communication_medialaw', 'communication_broadcasting', 'communication_publishing', 'communication_advertising'],
    CYBER_PROPAGANDA:             ['communication_disinfo', 'communication_social', 'communication_analytics', 'communication_internet'],

    // Intelligence domain
    INTELLIGENCE_FAILURE:         ['intelligence_collection', 'intelligence_allsource', 'intelligence_strategic'],
    MASS_SURVEILLANCE_SCANDAL:    ['intelligence_oversight', 'intelligence_sigint', 'intelligence_privacy', 'intelligence_collection'],
    CYBER_ESPIONAGE:              ['intelligence_cyber', 'intelligence_counterintelligence', 'intelligence_sigint', 'intelligence_technical'],
    WHISTLEBLOWER_CRISIS:         ['intelligence_oversight', 'intelligence_counterintelligence', 'intelligence_collection'],
    FOREIGN_INTERFERENCE:         ['intelligence_counterintelligence', 'intelligence_allsource', 'intelligence_covert', 'intelligence_strategic'],

    // Population domain
    POPULATION_COLLAPSE:          ['population_birth', 'population_aging', 'population_labor', 'population_popdata'],
    MASS_MIGRATION:               ['population_migration', 'population_refugees', 'population_urbanization', 'population_popdata'],
    AGING_CRISIS:                 ['population_aging', 'population_pophealth', 'population_labor'],
    URBANIZATION_OVERLOAD:        ['population_urbanization', 'population_housing', 'population_infrastructure', 'population_density'],
    PANDEMIC_DEMOGRAPHIC_SHOCK:   ['population_pophealth', 'population_mortality', 'population_popdata', 'population_birth'],

    // Religion domain
    SECTARIAN_CONFLICT:       ['religion_interfaith', 'religion_theological', 'religion_relethics', 'religion_relorg'],
    INSTITUTIONAL_ABUSE:      ['religion_leadership', 'religion_relorg', 'religion_relethics', 'religion_pastoral'],
    RADICALIZATION:           ['religion_theological', 'religion_interfaith', 'religion_relethics', 'religion_releduc'],
    SECULARIZATION_CRISIS:    ['religion_relorg', 'religion_ritual', 'religion_releduc', 'religion_pastoral'],
    THEOLOGICAL_SCHISM:       ['religion_theological', 'religion_leadership', 'religion_releduc', 'religion_interfaith'],

    // Economy domain
    RECESSION:            ['economy_gdp', 'economy_labor', 'economy_consumer', 'economy_industrial'],
    HYPERINFLATION:       ['economy_inflation', 'economy_monetary', 'economy_consumer', 'economy_fiscal'],
    DEBT_CRISIS:          ['economy_debt', 'economy_fiscal', 'economy_capital', 'economy_monetary'],

    // Law domain
    JUDICIAL_CRISIS:              ['law_judiciary', 'law_criminal', 'law_civil', 'law_administrative'],
    CONSTITUTIONAL_VIOLATION:     ['law_constitutional', 'law_civil', 'law_criminal'],
    REGULATORY_CAPTURE:           ['law_regulatory', 'law_administrative', 'law_banking', 'law_health'],
    MASS_INCARCERATION:           ['law_criminal', 'law_prosecution', 'law_legal'],
    INTERNATIONAL_LAW_BREAKDOWN:  ['law_intl', 'law_maritime', 'law_immigration', 'law_arbitration'],

    // Health / Medicine domain
    SUPPLY_FRACTURE:                    ['medicine_diagnostics', 'medicine_therapeutics'],
    ADVERSE_EVENT_GAP:                  ['medicine_diagnostics', 'medicine_pharmacy'],
    CARE_ACCESS_FAILURE:                ['medicine_primary', 'medicine_telehealth', 'medicine_emergency', 'medicine_publichealth'],
    CHRONIC_DISEASE_LOAD:               ['medicine_metabolic', 'medicine_cardiology', 'medicine_rehabilitation', 'medicine_primary'],
    CLINICAL_COORDINATION_BREAKDOWN:    ['medicine_primary', 'medicine_telehealth', 'medicine_radiology', 'medicine_neurology'],
    THERAPEUTIC_RELIABILITY_RISK:       ['medicine_diagnostics', 'medicine_pharmacy', 'medicine_oncology', 'medicine_medresearch'],

    // Education domain
    FUNDING_CRISIS:           ['education_higher', 'education_k12', 'education_equity'],
    TEACHER_SHORTAGE:         ['education_k12', 'education_higher', 'education_special', 'education_vocational'],
    ACHIEVEMENT_GAP:          ['education_equity', 'education_k12', 'education_literacy', 'education_learning'],
    ACCREDITATION_FAILURE:    ['education_higher', 'education_vocational', 'education_international'],
    TECHNOLOGY_DISRUPTION:    ['education_edtech', 'education_distance', 'education_learning'],

    // Energy — systemic stress (supplements existing OIL_SHOCK / GRID_COLLAPSE entries)
    SYSTEMIC_ENERGY_STRESS:   ['energy_grid', 'energy_power', 'energy_transmission', 'energy_distribution', 'energy_energypolicy']
  };

  // ══════════════════════════════════════════════════════════════════════
  // FETCH PORTAL CONTENT
  // ══════════════════════════════════════════════════════════════════════

  function _fetchPortal(domainId, opts) {
    opts = opts || {};
    var eager = !!(opts.eager || opts.recursive);
    // Per-call stats (if present) preferred over module-scope _stats.
    // Concurrent resolves no longer bleed each other's counts into the
    // summary log when each top-level call passes its own _stats object.
    var stats = opts._stats || _stats;

    // Negative-cache short-circuit. A path that 404'd in the last hour
    // does NOT get refetched — neither browser console nor network logs
    // a second request. This is the load-bearing guard against the deep
    // portal 404 storm (L2/L3 leaves intentionally absent from deploy).
    var neg = _negCache[domainId];
    if (neg && (Date.now() - neg) < NEG_CACHE_TTL) {
      stats.neg++;
      return Promise.resolve(null);
    }

    var cached = _cache[domainId];
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      stats.hit++;
      return Promise.resolve(cached.data);
    }

    stats.fetched++;

    // Static-first fetch: top-level domain JSONs ship in the Vercel
    // bundle and serve instantly. Deep-tree leaves (L2+) are NOT in the
    // static bundle.
    //
    // Non-eager (per-cycle brain) calls MUST NOT fall back to
    // /api/fetch-portal — that route depends on a GITHUB_TOKEN env var
    // that is rate-limited / 502s during normal operation, and the
    // resulting browser-auto error lines flooded DevTools even when the
    // resolver itself stayed quiet. Static 404 in non-eager mode is
    // treated as "this leaf is not deployed", negative-cached, and
    // returns null. The brain still gets all L1 portal content that DID
    // ship in the bundle; missing deep leaves remain optional.
    //
    // Eager mode (document generation, drill-deeper) keeps the API
    // fallback so genuinely deep paths can still resolve via GitHub
    // contents API when the token is healthy.
    return fetch('/assets/data/domains/' + domainId + '.json')
      .then(function (r) { if (!r.ok) throw new Error('static ' + r.status); return r.json(); })
      .catch(function () {
        if (!eager) {
          // Non-eager: end of road. No /api/fetch-portal call.
          _negCache[domainId] = Date.now();
          stats.missed++;
          return null;
        }
        // Eager only: try GitHub-backed API fallback.
        return fetch('/api/fetch-portal?domainId=' + domainId)
          .then(function (r) {
            // Treat any non-2xx (404 "Domain not found", 502 token
            // failure, etc.) as a failure so we fall through to the
            // outer negative-cache catch.
            if (!r.ok) throw new Error('api ' + r.status);
            return r.json();
          })
          .then(function (data) {
            // Defensive: API may someday return 200 + {error: ...}.
            if (data && data.error) throw new Error('api error envelope');
            return data;
          });
      })
      .then(function (data) {
        if (data) _cache[domainId] = { data: data, timestamp: Date.now() };
        return data;
      })
      .catch(function () {
        _negCache[domainId] = Date.now();
        stats.missed++;
        return cached ? cached.data : null;
      });
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXTRACT DEEP TREATMENTS
  //
  // From a portal JSON, extract all treatments with full depth:
  // label, type, evidence, description, cite, steps, monitoring, escalation
  // ══════════════════════════════════════════════════════════════════════

  function _extractTreatments(portalData, depth, ancestryPath) {
    if (!portalData) return [];
    depth = (typeof depth === 'number') ? depth : 0;
    ancestryPath = Array.isArray(ancestryPath) ? ancestryPath : [];

    var treatments = [];
    var activations = portalData.activations || [];
    var portalId = portalData.domainId || '';
    var portalTitle = portalData.title || '';

    for (var ai = 0; ai < activations.length; ai++) {
      var act = activations[ai];
      var nodeId = act.brainNodeId || '';
      var nodeLabel = act.domainLabel || nodeId;
      var treats = act.treatments || [];

      for (var ti = 0; ti < treats.length; ti++) {
        var t = treats[ti];
        treatments.push({
          label: t.label || '',
          type: t.type || '',
          evidence: t.evidence || '',
          description: t.description || '',
          cite: t.cite || null,
          citation: t.citation || null,
          steps: t.steps || [],
          monitoring: t.monitoring || null,
          escalation: t.escalation || null,
          target: t.target || null,
          nodeId: nodeId,
          nodeLabel: nodeLabel,
          portalDomain: portalId,
          portalDomainId: portalId,
          portalTitle: portalTitle,
          depth: depth,
          ancestryPath: ancestryPath.slice(),
          hasDepth: !!(t.steps && t.steps.length > 0 && t.cite)
        });
      }
    }

    return treatments;
  }

  // ══════════════════════════════════════════════════════════════════════
  // L2–L6 RECURSION (additive)
  //
  // Walks each L1 mapped portal AND its childPortal references recursively
  // up to MAX_RECURSION_DEPTH levels. Provenance fields (depth, ancestryPath,
  // portalDomainId) are preserved per-treatment so downstream consumers can
  // filter / display by depth.
  //
  // Cycle-safe: a per-resolution Set tracks visited domainIds; revisits are
  // skipped silently (zero duplicates).
  //
  // Network discipline: parallel fetch within a level, but each level only
  // starts after the previous one resolves — bounds peak concurrency.
  //
  // childPortal naming convention: '<id>_portal.html' → '<id>'. Companion
  // pattern verified in agriculture-directive-extractor.js:73.
  // ══════════════════════════════════════════════════════════════════════

  var MAX_RECURSION_DEPTH = 2; // L1 (depth 0) → L2 (depth 1) → L3 (depth 2)

  function _portalFileToId(childPortal) {
    if (!childPortal || typeof childPortal !== 'string') return null;
    var m = childPortal.match(/^(.+?)_portal\.html$/i);
    if (m) return m[1];
    return childPortal.replace(/\.html$/i, '');
  }

  function _resolveDeepRecursive(domainId, maxDepth, currentDepth, ancestryPath, seen, opts) {
    if (!domainId) return Promise.resolve([]);
    if (seen.has(domainId)) return Promise.resolve([]);
    seen.add(domainId);

    return _fetchPortal(domainId, opts).then(function (portalData) {
      if (!portalData) return [];

      var thisPath = ancestryPath.concat([domainId]);
      var treatments = _extractTreatments(portalData, currentDepth, thisPath);

      if (currentDepth >= maxDepth) return treatments;

      // Collect next-level child portal IDs (deduped against `seen`)
      var children = [];
      var activations = portalData.activations || [];
      for (var i = 0; i < activations.length; i++) {
        var cp = activations[i] && activations[i].childPortal;
        var cid = _portalFileToId(cp);
        if (cid && !seen.has(cid) && children.indexOf(cid) === -1) children.push(cid);
      }

      if (children.length === 0) return treatments;

      // Parallel fetch within a level; sequential between levels.
      var childCalls = children.map(function (cid) {
        return _resolveDeepRecursive(cid, maxDepth, currentDepth + 1, thisPath, seen, opts);
      });
      return Promise.all(childCalls).then(function (childResults) {
        for (var ci = 0; ci < childResults.length; ci++) {
          for (var ti = 0; ti < childResults[ci].length; ti++) treatments.push(childResults[ci][ti]);
        }
        return treatments;
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE TREATMENTS FOR A DIAGNOSIS
  //
  // Given a diagnosis ID, fetches all mapped portal subtrees,
  // extracts treatments, and returns the full-depth ones sorted
  // by evidence grade.
  // ══════════════════════════════════════════════════════════════════════

  function resolveForDiagnosis(diagnosisId, opts) {
    opts = opts || {};
    // Recursion is opt-in. Per-brain cycles (the hot path that flooded
    // the console with thousands of L2/L3 404s) get L1-only by default.
    // Document generation / drill-deeper paths pass {eager:true} to
    // restore the full depth-2 walk.
    var eager = !!(opts.eager || opts.recursive);
    var defaultDepth = eager ? MAX_RECURSION_DEPTH : 0;
    var maxDepth = (typeof opts.maxDepth === 'number') ? opts.maxDepth : defaultDepth;
    var cacheKey = diagnosisId + '::d' + maxDepth;

    // Check cache (depth-aware)
    if (_deepTreatmentCache[cacheKey] && (Date.now() - _deepTreatmentCache[cacheKey].timestamp) < CACHE_TTL) {
      return Promise.resolve(_deepTreatmentCache[cacheKey].treatments);
    }

    var portalIds = DIAGNOSIS_PORTAL_MAP[diagnosisId];
    if (!portalIds || portalIds.length === 0) {
      return Promise.resolve([]);
    }

    // Recursive walk per L1 root, sharing a `seen` set across all roots so
    // a child referenced by two L1s isn't double-walked. opts forwarded
    // so _fetchPortal can read eager + per-call _stats.
    var seen = new Set();
    var deepCalls = portalIds.map(function (pid) {
      return _resolveDeepRecursive(pid, maxDepth, 0, [], seen, opts);
    });

    return Promise.all(deepCalls).then(function (results) {
      var allTreatments = [];
      for (var i = 0; i < results.length; i++) {
        for (var j = 0; j < results[i].length; j++) allTreatments.push(results[i][j]);
      }

      // Sort: full-depth first, then shallow (small `depth`) first, then evidence grade.
      var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
      allTreatments.sort(function (a, b) {
        if (a.hasDepth !== b.hasDepth) return a.hasDepth ? -1 : 1;
        if ((a.depth || 0) !== (b.depth || 0)) return (a.depth || 0) - (b.depth || 0);
        return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0);
      });

      _deepTreatmentCache[cacheKey] = { treatments: allTreatments, timestamp: Date.now() };
      return allTreatments;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE CONTENT FOR DOCUMENT GENERATION
  //
  // Returns a structured content package suitable for grant/patent/memo:
  // - Top treatments with citations and steps
  // - Evidence anchors from portal content
  // - Node-business mappings
  // ══════════════════════════════════════════════════════════════════════

  function resolveForDocument(diagnosisId, maxTreatments, opts) {
    maxTreatments = maxTreatments || 8;
    // Document generation needs full depth — opt in to recursion unless
    // the caller explicitly overrides.
    var resolveOpts = opts || { eager: true };

    return resolveForDiagnosis(diagnosisId, resolveOpts).then(function (treatments) {
      // Take top N with full depth
      var deep = treatments.filter(function (t) { return t.hasDepth; }).slice(0, maxTreatments);
      if (deep.length < 3) {
        // Supplement with non-deep treatments
        var shallow = treatments.filter(function (t) { return !t.hasDepth; }).slice(0, maxTreatments - deep.length);
        deep = deep.concat(shallow);
      }

      // Build evidence anchors from citations
      var evidenceAnchors = [];
      var seenCites = {};
      for (var i = 0; i < deep.length; i++) {
        var t = deep[i];
        if (t.cite && !seenCites[t.cite]) {
          seenCites[t.cite] = true;
          evidenceAnchors.push({
            type: 'citation',
            text: t.cite,
            evidence: t.evidence,
            source: t.portalTitle
          });
        }
      }

      // Build implementation steps
      var implementationSteps = [];
      for (var j = 0; j < deep.length; j++) {
        var tt = deep[j];
        if (tt.steps && tt.steps.length > 0) {
          implementationSteps.push({
            treatmentLabel: tt.label,
            type: tt.type,
            evidence: tt.evidence,
            steps: tt.steps,
            monitoring: tt.monitoring,
            escalation: tt.escalation,
            nodeId: tt.nodeId,
            target: tt.target
          });
        }
      }

      // Build node map
      var nodeMap = {};
      for (var k = 0; k < deep.length; k++) {
        var nid = deep[k].nodeId;
        if (nid && !nodeMap[nid]) {
          nodeMap[nid] = { nodeId: nid, nodeLabel: deep[k].nodeLabel, treatmentCount: 0 };
        }
        if (nid && nodeMap[nid]) nodeMap[nid].treatmentCount++;
      }

      return {
        diagnosisId: diagnosisId,
        totalTreatments: treatments.length,
        deepTreatments: deep.length,
        treatments: deep,
        evidenceAnchors: evidenceAnchors,
        implementationSteps: implementationSteps,
        nodeMap: Object.values(nodeMap),
        resolvedAt: Date.now()
      };
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // RESOLVE ALL ACTIVE DIAGNOSES FOR A DOMAIN BRAIN
  //
  // Takes a brain state, resolves content for all active diagnoses,
  // returns combined content package.
  // ══════════════════════════════════════════════════════════════════════

  function resolveForBrain(brainState, opts) {
    opts = opts || {};
    // Bumped from 5 → 200 to pass the full L2-recursion uplift through to
    // brainResolvedContent. With recursion off (maxDepth=0) the count caps
    // naturally at L1's available count; with recursion on the bottleneck
    // is here, not in the resolver.
    var maxTreatments = (typeof opts.maxTreatments === 'number') ? opts.maxTreatments : 200;
    // Per-cycle brain calls default to L1-only (eager=false). Callers
    // that need deep recursion (drill-deeper UI, document generation)
    // pass {eager:true}.
    var eager = !!(opts.eager || opts.recursive);
    var domainLabel = (brainState && brainState.domainId) || 'unknown';
    var activeDx = (brainState.diagnoses || []).filter(function (d) { return d.active; });
    if (activeDx.length === 0) return Promise.resolve(null);

    // Per-call stats. Concurrent resolveForBrain runs no longer
    // double-count each other's fetches because each owns its own
    // counter object threaded down via opts._stats.
    var callStats = { fetched: 0, hit: 0, neg: 0, missed: 0 };
    var innerOpts = { eager: eager, _stats: callStats };

    var resolves = activeDx.map(function (dx) {
      return resolveForDocument(dx.id, maxTreatments, innerOpts);
    });

    return Promise.all(resolves).then(function (results) {
      var combined = {
        activeDiagnoses: activeDx.length,
        totalTreatments: 0,
        totalDeep: 0,
        totalCitations: 0,
        byDiagnosis: {},
        allEvidenceAnchors: [],
        allImplementationSteps: [],
        resolvedAt: Date.now()
      };

      for (var i = 0; i < results.length; i++) {
        if (!results[i]) continue;
        var r = results[i];
        combined.totalTreatments += r.totalTreatments;
        combined.totalDeep += r.deepTreatments;
        combined.totalCitations += r.evidenceAnchors.length;
        combined.byDiagnosis[r.diagnosisId] = r;
        combined.allEvidenceAnchors = combined.allEvidenceAnchors.concat(r.evidenceAnchors);
        combined.allImplementationSteps = combined.allImplementationSteps.concat(r.implementationSteps);
      }

      // One concise summary per brain resolve, only when actual network
      // work happened. Stats are per-call so concurrent resolves report
      // their own counts accurately.
      if (callStats.fetched > 0 || callStats.missed > 0) {
        console.log('[PortalResolver] ' + domainLabel +
          ' eager=' + eager +
          ' dx=' + activeDx.length +
          ' fetched=' + callStats.fetched +
          ' missed=' + callStats.missed +
          ' negSkipped=' + callStats.neg);
      }

      return combined;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENPortalContentResolver = {
    resolveForDiagnosis: resolveForDiagnosis,
    resolveForDocument: resolveForDocument,
    resolveForBrain: resolveForBrain,
    getDiagnosisPortalMap: function () { return DIAGNOSIS_PORTAL_MAP; },
    getCache: function () { return { portals: Object.keys(_cache).length, treatments: Object.keys(_deepTreatmentCache).length }; }
  };

})();
