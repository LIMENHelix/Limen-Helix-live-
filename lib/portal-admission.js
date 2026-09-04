'use strict';

const PLACEHOLDER_PATTERNS = [
  { code: 'DATA_NEEDED', re: /\bDATA_NEEDED\b/i },
  { code: 'CITATION_NEEDED', re: /\bCITATION_NEEDED\b/i },
  { code: 'VERIFY', re: /\bVERIFY\b/i },
  { code: 'TBD', re: /\bTBD\b/i },
  { code: 'TODO', re: /\bTODO\b/i },
  { code: 'INSERT', re: /\bINSERT\b/i },
  { code: 'PLACEHOLDER', re: /\bPLACEHOLDER\b/i },
  { code: 'MUSTACHE', re: /\{\{[^}]+\}\}/ },
  { code: 'ANGLE_TOKEN', re: /<<[^>]+>>/ }
];

const NETWORK_CATEGORIES = [
  'suppliers', 'logisticsPartners', 'customers', 'competitors',
  'regulators', 'auditor', 'capitalProviders', 'executiveTeam',
  'marketSignals', 'peers', 'partners', 'auditors'
];
const VALID_NEURAL_ROLES = new Set(['DMN', 'Salience', 'PFC', 'Motor', 'Sensory', 'Peer']);
const VALID_BRAIN_NODE_IDS = new Set(Object.keys(require('../assets/data/brain-node-domains.json')));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeCik(value) {
  const candidate = String(value == null ? '' : value).trim().replace(/^CIK/i, '');
  if (!/^\d+$/.test(candidate)) return null;
  const digits = candidate.replace(/^0+/, '');
  if (!digits || digits.length > 10) return null;
  return digits.padStart(10, '0');
}

function walkStrings(value, visit, path) {
  path = path || '$';
  if (typeof value === 'string') return visit(value, path);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) walkStrings(value[i], visit, `${path}[${i}]`);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walkStrings(child, visit, `${path}.${key}`);
  }
}

function findPlaceholderHits(portal) {
  const hits = [];
  walkStrings(portal, (text, path) => {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.re.test(text)) hits.push({ code: pattern.code, path, excerpt: text.slice(0, 140) });
    }
  });
  return hits;
}

function networkEntries(portal) {
  const network = portal && portal.functionalNetwork;
  if (!network || typeof network !== 'object') return [];
  const rows = [];
  for (const category of NETWORK_CATEGORIES) {
    const value = network[category];
    const entries = Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
    for (let index = 0; index < entries.length; index++) rows.push({ category, index, entry: entries[index] });
  }
  return rows;
}

function safeFinancialStub() {
  return {
    asOf: null,
    lastKernelRun: null,
    kernelId: null,
    validationStatus: 'unavailable',
    envelopeStatus: 'INGESTION_SUSPECT',
    historyQuarters: null,
    latestQuarter: null,
    compositeScore: null,
    alert: false,
    distressBand: 'unknown',
    dominantPhase: null,
    financialState: { cashLatest: null, debtLatest: null, cashRunwayQ: null }
  };
}

function preserveOrDelete(portal, currentPortal, key) {
  if (currentPortal && Object.prototype.hasOwnProperty.call(currentPortal, key)) portal[key] = clone(currentPortal[key]);
  else delete portal[key];
}

function prepareGeneratedPortal(rawPortal, target, currentPortal) {
  const portal = clone(rawPortal || {});
  const source = currentPortal && typeof currentPortal === 'object' ? currentPortal : null;
  const authoritativeSlug = String(target && (target.slug || target.companyId) || portal.slug || '').trim();
  const sanitization = { nestedCiksCleared: 0, preservedKernelFields: !!source };

  portal.schemaVersion = '2.0.1';
  portal.type = 'company';
  portal.slug = authoritativeSlug;
  portal.companyId = authoritativeSlug;
  if (target && target.name) portal.name = String(target.name);
  portal.ticker = target && target.ticker ? String(target.ticker) : null;
  portal.cik = normalizeCik(target && target.cik);
  if (target && target.domainId) portal.domainId = String(target.domainId);

  for (const { entry } of networkEntries(portal)) {
    if (entry && entry.cik != null) {
      entry.cik = null;
      sanitization.nestedCiksCleared++;
    }
  }

  if (source) {
    for (const key of ['financialHealth', 'kernelReadings', 'kernelStatus', 'helixReportMode', 'helixReportUrl']) {
      preserveOrDelete(portal, source, key);
    }
  } else {
    portal.financialHealth = safeFinancialStub();
    delete portal.kernelReadings;
    portal.kernelStatus = 'INGESTION_SUSPECT';
    portal.helixReportMode = 'stub';
    portal.helixReportUrl = null;
  }

  return { portal, sanitization };
}

function validatePortalAdmission(portal) {
  const errors = [];
  const placeholderHits = findPlaceholderHits(portal);
  if (placeholderHits.length) errors.push({ code: 'PLACEHOLDER_CONTAMINATION', count: placeholderHits.length });
  if (!portal || typeof portal !== 'object') return { ok: false, errors: [{ code: 'PORTAL_NOT_OBJECT' }], placeholderHits, metrics: {} };
  if (portal.schemaVersion !== '2.0.1') errors.push({ code: 'SCHEMA_VERSION' });
  if (portal.type !== 'company') errors.push({ code: 'TYPE' });
  if (!portal.slug || portal.slug !== portal.companyId) errors.push({ code: 'IDENTITY_SLUG' });
  if (!portal.name) errors.push({ code: 'IDENTITY_NAME' });
  if (portal.cik !== null && !/^\d{10}$/.test(String(portal.cik))) errors.push({ code: 'CIK_FORMAT' });
  if (!portal.domainId) errors.push({ code: 'DOMAIN_ID' });
  if (typeof portal.portalAttachment !== 'string' || !portal.portalAttachment) errors.push({ code: 'PORTAL_ATTACHMENT' });
  for (const key of ['fredSeries', 'feedSources', 'marketDataTickers', 'commodityExposure', 'warningSignals', 'opportunitySignals', 'newsFeed', 'intelligenceCycle']) {
    if (!Array.isArray(portal[key])) errors.push({ code: 'TOP_LEVEL_ARRAY', field: key });
  }
  if (!portal.financialHealth || typeof portal.financialHealth !== 'object' || Array.isArray(portal.financialHealth)) errors.push({ code: 'FINANCIAL_HEALTH' });
  if (!portal.commercializationStatus || typeof portal.commercializationStatus !== 'object' || Array.isArray(portal.commercializationStatus)) errors.push({ code: 'COMMERCIALIZATION_STATUS' });
  if (!portal.notes || typeof portal.notes !== 'object' || Array.isArray(portal.notes)) errors.push({ code: 'NOTES' });
  for (const key of ['domainRelevance', 'portalRelevance']) {
    if (typeof portal[key] !== 'string' || portal[key].trim().length < 30) errors.push({ code: 'TOP_LEVEL_PROSE', field: key });
  }
  if (!portal.functionalNetwork || typeof portal.functionalNetwork.model !== 'string' || !portal.functionalNetwork.model.trim()) errors.push({ code: 'NETWORK_MODEL' });

  const rows = networkEntries(portal);
  const categories = new Set(rows.map(row => row.category));
  let fullyTagged = 0;
  let evidenceTagged = 0;
  for (const { category, index, entry } of rows) {
    const path = `$.functionalNetwork.${category}[${index}]`;
    if (!entry || typeof entry !== 'object') { errors.push({ code: 'NETWORK_ENTRY_OBJECT', path }); continue; }
    if (!entry.name || !entry.relationshipNote) errors.push({ code: 'NETWORK_ENTRY_CONTENT', path });
    if (!VALID_NEURAL_ROLES.has(entry.neuralRole)) errors.push({ code: 'NETWORK_NEURAL_ROLE', path, value: entry.neuralRole || null });
    if (!VALID_BRAIN_NODE_IDS.has(entry.brainNodeId)) errors.push({ code: 'NETWORK_BRAIN_NODE_ID', path, value: entry.brainNodeId || null });
    if (entry.brainNodeId && entry.neuralRole && entry.brainNodeRole) fullyTagged++;
    const hasSource = Array.isArray(entry.sourceType) ? entry.sourceType.some(Boolean) : !!entry.sourceType;
    if (hasSource && /^(high|medium|low)$/i.test(String(entry.confidence || ''))) evidenceTagged++;
    if (entry.cik !== null && entry.cik !== undefined) errors.push({ code: 'UNVERIFIED_NESTED_CIK', path });
  }
  const taggedRate = rows.length ? fullyTagged / rows.length : 0;
  const evidenceRate = rows.length ? evidenceTagged / rows.length : 0;
  if (rows.length < 20) errors.push({ code: 'NETWORK_TOO_THIN', count: rows.length });
  if (categories.size < 6) errors.push({ code: 'NETWORK_CATEGORY_BREADTH', count: categories.size });
  if (taggedRate < 0.90) errors.push({ code: 'NETWORK_TOPOLOGY_TAGGING', rate: +taggedRate.toFixed(3) });
  if (evidenceRate < 0.90) errors.push({ code: 'NETWORK_EVIDENCE_TAGGING', rate: +evidenceRate.toFixed(3) });

  return {
    ok: errors.length === 0,
    errors,
    placeholderHits,
    metrics: {
      relationshipCount: rows.length,
      categoryCount: categories.size,
      topologyTaggedRate: +taggedRate.toFixed(3),
      evidenceTaggedRate: +evidenceRate.toFixed(3)
    }
  };
}

module.exports = {
  PLACEHOLDER_PATTERNS,
  NETWORK_CATEGORIES,
  VALID_NEURAL_ROLES,
  VALID_BRAIN_NODE_IDS,
  findPlaceholderHits,
  networkEntries,
  normalizeCik,
  prepareGeneratedPortal,
  safeFinancialStub,
  validatePortalAdmission
};
