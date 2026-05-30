/**
 * assets/js/node-translation.js
 * LIMEN Node Translation Layer (NTL)
 *
 * Structured mapping: connectome nodes → real-world businesses → assets → actions.
 *
 * This is a DATA + LOGIC layer consumed by:
 *   - opportunities page (node → business relevance)
 *   - investment console (node → suggested assets)
 *   - portal pages (node → real-world mapping)
 *
 * Does NOT score, rank, or affect kernel authority.
 * Does NOT replace existing ASSET_MAP or TICKER_DOMAINS.
 * Additive only — complements existing mappings with node-level grounding.
 *
 * Node IDs match brain-connectome.json exactly.
 * Business functions derived from brain-node-domains.json role mappings.
 * Tickers and companies are first-pass heuristic mappings.
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// NODE TRANSLATION MAP
// ═══════════════════════════════════════════════════

var NODE_TRANSLATION_MAP = {

  dlPFC: {
    function: 'Executive control, planning, top-down regulation',
    businessFunctions: [
      'strategic planning',
      'workforce management',
      'grid management',
      'software engineering',
      'supply chain management'
    ],
    sectors: ['technology', 'energy', 'consulting', 'defense', 'finance'],
    exampleCompanies: ['McKinsey', 'Accenture', 'Palantir', 'SAP', 'Workday'],
    tickers: ['ACN', 'PLTR', 'SAP', 'WDAY', 'IBM'],
    actions: ['plan', 'coordinate', 'regulate', 'optimize', 'govern'],
    description: 'Central executive authority across all domains. When Hypo, the system loses planning capacity. Intervention: restore executive function through strategic advisory, management platforms, or governance tools.'
  },

  dACC: {
    function: 'Conflict monitoring, error detection, quality control',
    businessFunctions: [
      'compliance and governance',
      'quality control',
      'regulatory oversight',
      'peer review',
      'DevOps monitoring'
    ],
    sectors: ['compliance', 'cybersecurity', 'quality assurance', 'regulatory tech', 'infrastructure'],
    exampleCompanies: ['Palo Alto Networks', 'CrowdStrike', 'Drata', 'Datadog', 'Splunk'],
    tickers: ['PANW', 'CRWD', 'DDOG', 'SPLK', 'FTNT'],
    actions: ['monitor', 'audit', 'detect', 'enforce', 'alert'],
    description: 'System-wide error detection and compliance layer. When Altered, oversight fails silently. Intervention: deploy monitoring, auditing, and compliance automation.'
  },

  HIPP: {
    function: 'Memory, context retention, state persistence',
    businessFunctions: [
      'institutional knowledge',
      'data warehousing',
      'legal precedent',
      'learning science',
      'database systems'
    ],
    sectors: ['technology', 'logistics', 'education', 'legal', 'real estate'],
    exampleCompanies: ['Snowflake', 'Oracle', 'Palantir', 'Amazon', 'MongoDB'],
    tickers: ['SNOW', 'ORCL', 'PLTR', 'AMZN', 'MDB'],
    actions: ['store', 'replicate', 'retrieve', 'archive', 'preserve'],
    description: 'Maintains system continuity and prevents loss of state. When Hypo, the organization forgets how to operate — the critical difference between depression (memory intact) and bankruptcy (memory lost). Intervention: knowledge management, data persistence, institutional memory tools.'
  },

  vmPFC: {
    function: 'Valuation, policy formation, safety signaling',
    businessFunctions: [
      'financial management',
      'policy formation',
      'trade agreements',
      'conservation policy',
      'moral reasoning frameworks'
    ],
    sectors: ['finance', 'government', 'ESG', 'insurance', 'philanthropy'],
    exampleCompanies: ['BlackRock', 'Vanguard', 'Bloomberg', 'Moody\'s', 'S&P Global'],
    tickers: ['BLK', 'BK', 'MCO', 'SPGI', 'MSCI'],
    actions: ['value', 'price', 'insure', 'regulate', 'arbitrate'],
    description: 'Assigns value and forms policy across all domains. When Altered, valuation becomes distorted — assets mispriced, policies misaligned. Intervention: restore valuation clarity through analytics, rating systems, transparent pricing.'
  },

  THAL: {
    function: 'Information routing, relay, gating',
    businessFunctions: [
      'information flow',
      'grid distribution',
      'monetary policy transmission',
      'data center operations',
      'port operations'
    ],
    sectors: ['telecommunications', 'infrastructure', 'logistics', 'cloud computing', 'finance'],
    exampleCompanies: ['Cisco', 'Equinix', 'Cloudflare', 'Akamai', 'Crown Castle'],
    tickers: ['CSCO', 'EQIX', 'NET', 'AKAM', 'CCI'],
    actions: ['route', 'distribute', 'relay', 'gate', 'switch'],
    description: 'Routes all information through the system. When disrupted, signals fail to reach destinations — grid blackouts, data center failures, port congestion. Intervention: network infrastructure, routing optimization, distribution systems.'
  },

  OFC: {
    function: 'Value judgment, compulsive drive, market intelligence',
    businessFunctions: [
      'market intelligence',
      'capital markets',
      'energy trading',
      'standards and compliance',
      'customs and tariffs'
    ],
    sectors: ['trading', 'market research', 'commodities', 'regulatory', 'border security'],
    exampleCompanies: ['CME Group', 'Intercontinental Exchange', 'FactSet', 'Bloomberg LP', 'Refinitiv'],
    tickers: ['CME', 'ICE', 'FDS', 'NDAQ', 'MKTX'],
    actions: ['trade', 'assess', 'price', 'negotiate', 'arbitrate'],
    description: 'Drives compulsive valuation and market-making behavior. When Hyper, markets become irrational (bubbles). When Hypo, liquidity dries up. Intervention: market structure, pricing transparency, exchange infrastructure.'
  },

  NAcc: {
    function: 'Reward processing, motivation, incentive salience',
    businessFunctions: [
      'sales and revenue',
      'consumer spending',
      'commodity exchanges',
      'electoral systems',
      'reward program design'
    ],
    sectors: ['retail', 'advertising', 'consumer goods', 'fintech', 'media'],
    exampleCompanies: ['Shopify', 'The Trade Desk', 'Visa', 'Mastercard', 'Meta'],
    tickers: ['SHOP', 'TTD', 'V', 'MA', 'META'],
    actions: ['incentivize', 'sell', 'reward', 'engage', 'convert'],
    description: 'The reward engine. Drives all motivation and revenue-generating behavior. When Hyper, unsustainable growth chasing. When exhausted, motivation collapses. Intervention: incentive design, revenue optimization, engagement platforms.'
  },

  STRI: {
    function: 'Habit automation, procedural execution, operational routines',
    businessFunctions: [
      'operations',
      'industrial production',
      'public transit',
      'clinical workflows',
      'semiconductor manufacturing'
    ],
    sectors: ['manufacturing', 'semiconductors', 'transportation', 'process automation', 'healthcare ops'],
    exampleCompanies: ['Taiwan Semiconductor', 'Honeywell', 'Rockwell Automation', 'UiPath', 'Siemens'],
    tickers: ['TSM', 'HON', 'ROK', 'PATH', 'SIEGY'],
    actions: ['automate', 'produce', 'execute', 'standardize', 'scale'],
    description: 'Automates learned patterns into reliable execution. When Hyper, rigid and unable to adapt. When Hypo, operational paralysis. Intervention: process automation, manufacturing systems, operational tooling.'
  },

  BLA: {
    function: 'Threat assessment, fear processing, risk evaluation',
    businessFunctions: [
      'risk assessment',
      'debt market analysis',
      'criminal threat assessment',
      'wildlife management',
      'fear extinction'
    ],
    sectors: ['insurance', 'security', 'risk analytics', 'defense', 'credit'],
    exampleCompanies: ['Verisk Analytics', 'Kroll', 'Palantir', 'TransUnion', 'FICO'],
    tickers: ['VRSK', 'TRU', 'FICO', 'PLTR', 'ALL'],
    actions: ['assess', 'hedge', 'insure', 'mitigate', 'de-risk'],
    description: 'Evaluates threats and assigns risk. When Hyper, paralysis from overestimated risk. When Hypo, reckless exposure. Intervention: risk analytics, insurance products, credit assessment tools.'
  },

  AI: {
    function: 'Internal state sensing, crisis detection, interoception',
    businessFunctions: [
      'crisis detection',
      'services sector monitoring',
      'legal risk detection',
      'clinical intuition systems',
      'population density analysis'
    ],
    sectors: ['monitoring', 'analytics', 'health tech', 'crisis management', 'urban planning'],
    exampleCompanies: ['Dataminr', 'PagerDuty', 'Dynatrace', 'New Relic', 'Everbridge'],
    tickers: ['PD', 'DT', 'NEWR', 'EVBG', 'DDOG'],
    actions: ['sense', 'detect', 'alert', 'triage', 'respond'],
    description: 'Senses internal system state before external signs appear. When Altered, the system cannot feel its own distress until too late. Intervention: monitoring, observability, early warning systems.'
  },

  FPN: {
    function: 'Executive coordination, complex task management, leadership',
    businessFunctions: [
      'executive leadership',
      'artificial intelligence',
      'intelligence analysis',
      'logistics technology',
      'clinical coordination'
    ],
    sectors: ['AI/ML', 'consulting', 'defense intelligence', 'logistics', 'digital infrastructure'],
    exampleCompanies: ['NVIDIA', 'Microsoft', 'Google', 'Booz Allen Hamilton', 'C3.ai'],
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'BAH', 'AI'],
    actions: ['coordinate', 'analyze', 'integrate', 'decide', 'orchestrate'],
    description: 'Frontoparietal executive network — coordinates complex multi-domain tasks. When impaired, complex operations fall apart even if individual components work. Intervention: AI systems, coordination platforms, integration tools.'
  },

  CeA: {
    function: 'Emergency response, threat activation, crisis escalation',
    businessFunctions: [
      'emergency systems',
      'cybersecurity response',
      'law enforcement',
      'crisis management',
      'safety systems'
    ],
    sectors: ['defense', 'cybersecurity', 'emergency management', 'law enforcement', 'safety'],
    exampleCompanies: ['CrowdStrike', 'Fortinet', 'Axon Enterprise', 'Motorola Solutions', 'Leidos'],
    tickers: ['CRWD', 'FTNT', 'AXON', 'MSI', 'LDOS'],
    actions: ['activate', 'escalate', 'deploy', 'defend', 'secure'],
    description: 'Triggers emergency response cascades. When Hyper, false alarms and overreaction. When Hypo, threats go unmet. Intervention: emergency infrastructure, incident response, defense systems.'
  },

  M1: {
    function: 'Motor output, production, physical execution',
    businessFunctions: [
      'production and delivery',
      'power generation',
      'construction',
      'hardware manufacturing',
      'assembly lines'
    ],
    sectors: ['manufacturing', 'energy', 'construction', 'hardware', 'logistics'],
    exampleCompanies: ['Caterpillar', 'Deere', 'General Electric', 'Intel', 'Nucor'],
    tickers: ['CAT', 'DE', 'GE', 'INTC', 'NUE'],
    actions: ['build', 'manufacture', 'generate', 'deliver', 'construct'],
    description: 'Converts plans into physical output. When impaired, nothing gets built regardless of how good the plan is. Intervention: production infrastructure, equipment, physical execution capacity.'
  },

  HPA: {
    function: 'Stress response, organizational pressure, burnout cascade',
    businessFunctions: [
      'organizational stress management',
      'legal system backlog',
      'provider burnout',
      'stress-relapse prevention',
      'stress testing'
    ],
    sectors: ['HR tech', 'wellness', 'legal services', 'healthcare', 'financial stress testing'],
    exampleCompanies: ['Headspace', 'Calm', 'Workday', 'BetterUp', 'Lyra Health'],
    tickers: ['WDAY', 'ZS', 'VEEV', 'DOCS', 'TDOC'],
    actions: ['de-stress', 'rebalance', 'buffer', 'recover', 'prevent'],
    description: 'The stress axis. Chronic activation causes cascading system failure. When stuck on, every other node degrades. Intervention: stress management tools, workload optimization, burnout prevention.'
  },

  CBLM: {
    function: 'Precision execution, fine-tuning, quality calibration',
    businessFunctions: [
      'quality control',
      'robotics and automation',
      'rail systems',
      'precision machining',
      'ritual and process'
    ],
    sectors: ['robotics', 'precision manufacturing', 'transportation', 'quality assurance'],
    exampleCompanies: ['ABB', 'Fanuc', 'Intuitive Surgical', 'Zebra Technologies', 'Keyence'],
    tickers: ['ABB', 'ISRG', 'ZBRA', 'ROK', 'TER'],
    actions: ['calibrate', 'fine-tune', 'automate', 'inspect', 'refine'],
    description: 'Fine-tunes execution quality. When impaired, output is sloppy even when strategy is correct. Intervention: precision tooling, robotics, quality calibration systems.'
  }
};

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

/**
 * Get the full translation mapping for a node.
 * @param {string} nodeId - brain node ID (e.g., 'dlPFC', 'HIPP')
 * @returns {Object|null} translation object or null if not mapped
 */
function getNodeTranslation(nodeId) {
  return NODE_TRANSLATION_MAP[nodeId] || null;
}

/**
 * Get deduplicated list of tickers for an array of node IDs.
 * @param {Array} nodeIds - array of brain node IDs
 * @returns {Array} unique tickers
 */
function getAssetsForNodes(nodeIds) {
  var seen = {};
  var result = [];
  for (var i = 0; i < nodeIds.length; i++) {
    var t = NODE_TRANSLATION_MAP[nodeIds[i]];
    if (!t || !t.tickers) continue;
    for (var j = 0; j < t.tickers.length; j++) {
      if (!seen[t.tickers[j]]) {
        seen[t.tickers[j]] = true;
        result.push(t.tickers[j]);
      }
    }
  }
  return result;
}

/**
 * Get deduplicated list of business functions for an array of node IDs.
 * @param {Array} nodeIds - array of brain node IDs
 * @returns {Array} unique business functions
 */
function getBusinessesForNodes(nodeIds) {
  var seen = {};
  var result = [];
  for (var i = 0; i < nodeIds.length; i++) {
    var t = NODE_TRANSLATION_MAP[nodeIds[i]];
    if (!t || !t.businessFunctions) continue;
    for (var j = 0; j < t.businessFunctions.length; j++) {
      if (!seen[t.businessFunctions[j]]) {
        seen[t.businessFunctions[j]] = true;
        result.push(t.businessFunctions[j]);
      }
    }
  }
  return result;
}

/**
 * Get deduplicated sectors for an array of node IDs.
 * @param {Array} nodeIds - array of brain node IDs
 * @returns {Array} unique sectors
 */
function getSectorsForNodes(nodeIds) {
  var seen = {};
  var result = [];
  for (var i = 0; i < nodeIds.length; i++) {
    var t = NODE_TRANSLATION_MAP[nodeIds[i]];
    if (!t || !t.sectors) continue;
    for (var j = 0; j < t.sectors.length; j++) {
      if (!seen[t.sectors[j]]) {
        seen[t.sectors[j]] = true;
        result.push(t.sectors[j]);
      }
    }
  }
  return result;
}

/**
 * Get all actions (verbs) for an array of node IDs.
 * @param {Array} nodeIds - array of brain node IDs
 * @returns {Array} unique action verbs
 */
function getActionsForNodes(nodeIds) {
  var seen = {};
  var result = [];
  for (var i = 0; i < nodeIds.length; i++) {
    var t = NODE_TRANSLATION_MAP[nodeIds[i]];
    if (!t || !t.actions) continue;
    for (var j = 0; j < t.actions.length; j++) {
      if (!seen[t.actions[j]]) {
        seen[t.actions[j]] = true;
        result.push(t.actions[j]);
      }
    }
  }
  return result;
}

/**
 * Get the count of mapped nodes.
 * @returns {number}
 */
function getMappedNodeCount() {
  return Object.keys(NODE_TRANSLATION_MAP).length;
}

/**
 * Get all mapped node IDs.
 * @returns {Array}
 */
function getMappedNodeIds() {
  return Object.keys(NODE_TRANSLATION_MAP);
}

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENNodeTranslation = {
  MAP: NODE_TRANSLATION_MAP,
  getNodeTranslation: getNodeTranslation,
  getAssetsForNodes: getAssetsForNodes,
  getBusinessesForNodes: getBusinessesForNodes,
  getSectorsForNodes: getSectorsForNodes,
  getActionsForNodes: getActionsForNodes,
  getMappedNodeCount: getMappedNodeCount,
  getMappedNodeIds: getMappedNodeIds
};

})();
