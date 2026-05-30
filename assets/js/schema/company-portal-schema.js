/**
 * company-portal-schema.js
 * LIMEN HELIX — Company / Entity Portal Data Model
 *
 * Phase 5: Company / Market Tracking Layer
 *
 * Defines the data model for domain-linked company/institution portals
 * that can be monitored as substructures of civilization domains.
 *
 * Examples:
 *   Medicine domain → hospital systems, pharma companies, health insurers
 *   Finance domain → major banks, exchanges, fintech platforms
 *   Energy domain → oil majors, utility companies, renewable firms
 *   Technology domain → semiconductor companies, cloud providers, AI labs
 *
 * Each company portal links to:
 *   - Parent domain
 *   - Market identifiers (ticker, entity ID)
 *   - Sector/industry classification
 *   - FRED-linked or macro-linked indicators
 *   - Company-specific stress signals
 *   - Diagnosis and treatment mappings
 *
 * This module provides:
 *   - Schema shape definitions
 *   - Factory function for creating company portals
 *   - Validation
 *   - FRED indicator registry
 *
 * Exposes: window.LIMENCompanyPortalSchema
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // Enums
  // ═══════════════════════════════════════════════════════════════

  var ENTITY_TYPE = Object.freeze({
    PUBLIC_COMPANY:  'public_company',
    PRIVATE_COMPANY: 'private_company',
    INSTITUTION:     'institution',
    GOVERNMENT:      'government_body',
    NGO:             'ngo',
    CONSORTIUM:      'consortium'
  });

  var MARKET_STATUS = Object.freeze({
    ACTIVE:    'active',
    DELISTED:  'delisted',
    PRIVATE:   'private',
    UNKNOWN:   'unknown'
  });

  var SIGNAL_TYPE = Object.freeze({
    PRICE:       'price',
    VOLUME:      'volume',
    FUNDAMENTAL: 'fundamental',
    MACRO:       'macro',
    SENTIMENT:   'sentiment',
    REGULATORY:  'regulatory',
    OPERATIONAL: 'operational'
  });

  // ═══════════════════════════════════════════════════════════════
  // FRED Indicator Registry — common macro indicators by domain
  // ═══════════════════════════════════════════════════════════════

  var FRED_INDICATORS = {
    // Economy / Finance
    GDP:              { id: 'GDP',         label: 'Gross Domestic Product',         unit: 'billions USD', frequency: 'quarterly' },
    UNRATE:           { id: 'UNRATE',      label: 'Unemployment Rate',              unit: '%',            frequency: 'monthly' },
    CPIAUCSL:         { id: 'CPIAUCSL',    label: 'Consumer Price Index',           unit: 'index',        frequency: 'monthly' },
    FEDFUNDS:         { id: 'FEDFUNDS',    label: 'Federal Funds Rate',             unit: '%',            frequency: 'daily' },
    DGS10:            { id: 'DGS10',       label: '10-Year Treasury Rate',          unit: '%',            frequency: 'daily' },
    M2SL:             { id: 'M2SL',        label: 'M2 Money Supply',               unit: 'billions USD', frequency: 'monthly' },
    VIXCLS:           { id: 'VIXCLS',      label: 'CBOE Volatility Index (VIX)',    unit: 'index',        frequency: 'daily' },

    // Energy
    DCOILWTICO:       { id: 'DCOILWTICO',  label: 'WTI Crude Oil Price',           unit: 'USD/barrel',   frequency: 'daily' },
    DCOILBRENTEU:     { id: 'DCOILBRENTEU', label: 'Brent Crude Oil Price',        unit: 'USD/barrel',   frequency: 'daily' },
    DHHNGSP:          { id: 'DHHNGSP',     label: 'Henry Hub Natural Gas Price',    unit: 'USD/MMBtu',    frequency: 'daily' },

    // Health / Medicine
    HLTHSCPIDM:       { id: 'HLTHSCPIDM',  label: 'Health Services CPI',           unit: 'index',        frequency: 'monthly' },

    // Housing / Infrastructure
    CSUSHPINSA:       { id: 'CSUSHPINSA',  label: 'Case-Shiller Home Price Index',  unit: 'index',        frequency: 'monthly' },
    HOUST:            { id: 'HOUST',       label: 'Housing Starts',                 unit: 'thousands',    frequency: 'monthly' },

    // Trade / Supply Chain
    BOPGSTB:          { id: 'BOPGSTB',     label: 'Trade Balance',                  unit: 'millions USD', frequency: 'monthly' },
    AMTMNO:           { id: 'AMTMNO',      label: 'Manufacturers New Orders',       unit: 'millions USD', frequency: 'monthly' },

    // Agriculture
    PCOTTINDUSDM:     { id: 'PCOTTINDUSDM', label: 'Cotton Price',                 unit: 'USD/lb',       frequency: 'monthly' },
    PMAIZMTUSDM:      { id: 'PMAIZMTUSDM',  label: 'Maize Price',                  unit: 'USD/mt',       frequency: 'monthly' },

    // Population / Demographics
    POPTHM:           { id: 'POPTHM',       label: 'Total Population',             unit: 'thousands',    frequency: 'monthly' }
  };

  // Domain → relevant FRED indicators
  var DOMAIN_INDICATORS = {
    economy:        ['GDP', 'UNRATE', 'CPIAUCSL'],
    finance:        ['FEDFUNDS', 'DGS10', 'M2SL', 'VIXCLS'],
    energy:         ['DCOILWTICO', 'DCOILBRENTEU', 'DHHNGSP'],
    health:         ['HLTHSCPIDM'],
    infrastructure: ['CSUSHPINSA', 'HOUST'],
    supplyChain:    ['BOPGSTB', 'AMTMNO'],
    agriculture:    ['PCOTTINDUSDM', 'PMAIZMTUSDM'],
    population:     ['POPTHM']
  };

  // ═══════════════════════════════════════════════════════════════
  // Schema Shape — Company Portal
  // ═══════════════════════════════════════════════════════════════

  /**
   * CompanyPortal shape:
   * {
   *   id:                string (required) — unique portal ID (e.g., "health_pfizer")
   *   name:              string (required) — entity name
   *   entityType:        ENTITY_TYPE (required)
   *   domainId:          string (required) — parent domain runtime key
   *   sector:            string — GICS sector or equivalent
   *   industry:          string — GICS industry or equivalent
   *   description:       string
   *
   *   // Market identifiers
   *   ticker:            string — stock ticker (e.g., "PFE")
   *   exchange:          string — exchange (e.g., "NYSE")
   *   entityId:          string — LEI, CIK, or internal ID
   *   marketStatus:      MARKET_STATUS
   *
   *   // FRED / macro indicators
   *   fredIndicators:    FREDLink[] — macro indicators relevant to this entity
   *   customIndicators:  CustomIndicator[] — entity-specific metrics
   *
   *   // Stress signals
   *   stressSignals:     StressSignal[] — company-specific stress detectors
   *
   *   // Domain relevance
   *   domainRelevance: {
   *     weight:          number (0-1) — how important this entity is to the domain
   *     mechanism:       string — how it affects the domain
   *     subDomains:      string[] — specific sub-domain connections
   *   }
   *
   *   // Diagnosis / treatment mappings
   *   diagnoses:         Diagnosis[] — entity-specific diagnoses (fractal schema)
   *   treatments:        Treatment[] — entity-specific treatments (fractal schema)
   *
   *   // Metadata
   *   lastUpdated:       string (ISO 8601)
   *   confidence:        number (0-1)
   *   status:            STATUS
   * }
   *
   * FREDLink: { indicatorId, label, threshold, direction ('above'|'below'), weight }
   * CustomIndicator: { id, label, source, unit, frequency, threshold, direction }
   * StressSignal: { id, type (SIGNAL_TYPE), label, threshold, direction, weight, source }
   */

  // ═══════════════════════════════════════════════════════════════
  // Factory
  // ═══════════════════════════════════════════════════════════════

  function createCompanyPortal(opts) {
    opts = opts || {};
    return {
      id:               opts.id || null,
      name:             opts.name || '',
      entityType:       opts.entityType || ENTITY_TYPE.PUBLIC_COMPANY,
      domainId:         opts.domainId || null,
      sector:           opts.sector || '',
      industry:         opts.industry || '',
      description:      opts.description || '',

      ticker:           opts.ticker || null,
      exchange:         opts.exchange || null,
      entityId:         opts.entityId || null,
      marketStatus:     opts.marketStatus || MARKET_STATUS.ACTIVE,

      fredIndicators:   opts.fredIndicators || [],
      customIndicators: opts.customIndicators || [],

      stressSignals:    opts.stressSignals || [],

      domainRelevance: opts.domainRelevance || {
        weight: 0.5,
        mechanism: '',
        subDomains: []
      },

      diagnoses:        opts.diagnoses || [],
      treatments:       opts.treatments || [],

      lastUpdated:      opts.lastUpdated || new Date().toISOString(),
      confidence:       opts.confidence || 0.5,
      status:           opts.status || 'static'
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════════════════════════

  function validate(portal) {
    var errors = [];
    if (!portal || typeof portal !== 'object') return { valid: false, errors: ['must be an object'] };
    if (!portal.id) errors.push('id required');
    if (!portal.name) errors.push('name required');
    if (!portal.domainId) errors.push('domainId required');
    if (!portal.entityType) errors.push('entityType required');
    return { valid: errors.length === 0, errors: errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get FRED indicators relevant to a domain.
   */
  function getIndicatorsForDomain(domainId) {
    var ids = DOMAIN_INDICATORS[domainId] || [];
    var result = [];
    for (var i = 0; i < ids.length; i++) {
      if (FRED_INDICATORS[ids[i]]) {
        result.push(FRED_INDICATORS[ids[i]]);
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENCompanyPortalSchema = {
    ENTITY_TYPE:       ENTITY_TYPE,
    MARKET_STATUS:     MARKET_STATUS,
    SIGNAL_TYPE:       SIGNAL_TYPE,
    FRED_INDICATORS:   FRED_INDICATORS,
    DOMAIN_INDICATORS: DOMAIN_INDICATORS,

    create:            createCompanyPortal,
    validate:          validate,
    getIndicatorsForDomain: getIndicatorsForDomain
  };

})();
