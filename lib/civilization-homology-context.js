'use strict';

/*
 * Observational homology context for the Civilization handoff.
 *
 * This is a continuity contract, not a diagnosis, a Thing 1 result, a
 * recommendation, or an authorization.  It carries the explicit fields that
 * connect a domain brain's P0-P10 / node reading to a business case.  Missing
 * fields are represented as abstentions; this module never infers
 * dysregulation from a stress scalar and never promotes a phase into a
 * validated kernel claim.
 */

var MODULE_ID = 'civilization-homology-context';
var SCHEMA = 'civilization-homology-context/1.0';
var STATUS = 'OBSERVATIONAL';
var MAX_ITEMS = 32;
var PHASE_RE = /^p(?:[0-9]|10)(?:[ab])?$/i;
var MAPPING_KEYS = [
  'neurology_to_business_homology',
  'business_to_neurology_homology',
  'kernel_dynamics',
  'p0_p10_proof_and_effects'
];

function fail(code, message) {
  var e = new Error(MODULE_ID + ': ' + message);
  e.code = code;
  throw e;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function string(value, name, optional) {
  if (value == null && optional) return null;
  if (typeof value !== 'string' || !value.trim()) fail('HOMOLOGY_' + name.toUpperCase() + '_REQUIRED', name + ' is required');
  return value.trim();
}

function bounded(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail('HOMOLOGY_' + name.toUpperCase() + '_INVALID', name + ' must be an array');
  if (value.length > MAX_ITEMS) fail('HOMOLOGY_' + name.toUpperCase() + '_OVERFLOW', name + ' exceeds the bounded limit');
  return clone(value);
}

function phase(value) {
  if (value == null || value === '') return null;
  var p = string(value, 'phase');
  if (!PHASE_RE.test(p)) fail('HOMOLOGY_PHASE_INVALID', 'phase must use the P0-P10 vocabulary');
  return p.toLowerCase();
}

function status(value, allowed, name, fallback) {
  var v = value == null ? fallback : string(value, name);
  if (allowed.indexOf(v) < 0) fail('HOMOLOGY_' + name.toUpperCase() + '_INVALID', name + ' is not an allowed status');
  return v;
}

function identity(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  var companies = bounded(input.companies, 'identity.companies');
  return {
    domainId: string(input.domainId, 'identity.domainId'),
    domainLabel: string(input.domainLabel || input.domainId, 'identity.domainLabel'),
    joinStatus: status(input.joinStatus, ['joined', 'expanded_identity_only', 'registry_missing_identity', 'joined_domain_conflict', 'command_board_only', 'UNOBSERVED'], 'identity.joinStatus', 'UNOBSERVED'),
    companies: companies,
    issues: bounded(input.issues, 'identity.issues')
  };
}

function phaseContext(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    value: phase(input.value == null ? input.phase : input.value),
    label: string(input.label || input.phaseLabel, 'phase.label', true),
    interpretation: 'P0-P10 interpretive phase; not Thing 1 validation',
    evidence: bounded(input.evidence, 'phase.evidence'),
    abstention: input.abstention == null ? null : string(input.abstention, 'phase.abstention')
  };
}

function regulationContext(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  var direction = input.direction == null ? 'unknown' : string(input.direction, 'regulation.direction').toLowerCase();
  if (['hyper', 'hypo', 'regulated', 'unknown'].indexOf(direction) < 0) fail('HOMOLOGY_REGULATION_DIRECTION_INVALID', 'regulation.direction is invalid');
  var stateValue = input.state == null ? null : String(input.state).toUpperCase();
  return {
    state: status(stateValue, ['REGULATED', 'DYSREGULATED', 'UNOBSERVED'], 'regulation.state', 'UNOBSERVED'),
    direction: direction,
    regulatedVariable: string(input.regulatedVariable, 'regulation.regulatedVariable', true),
    evidence: bounded(input.evidence, 'regulation.evidence'),
    source: string(input.source, 'regulation.source', true)
  };
}

function nodes(input) {
  var list = bounded(input, 'brainNodes');
  return list.map(function (node, index) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) fail('HOMOLOGY_BRAIN_NODE_INVALID', 'brainNodes[' + index + '] must be an object');
    return {
      id: string(node.id || node.brainNodeId, 'brainNodes[' + index + '].id'),
      role: string(node.role, 'brainNodes[' + index + '].role', true),
      state: string(node.state, 'brainNodes[' + index + '].state', true),
      diagnosisIds: bounded(node.diagnosisIds || node.diagnoses, 'brainNodes[' + index + '].diagnosisIds').map(String),
      evidence: bounded(node.evidence, 'brainNodes[' + index + '].evidence'),
      source: string(node.source, 'brainNodes[' + index + '].source', true)
    };
  });
}

function mapping(value, key) {
  var input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    status: status(input.status, ['PRESENT', 'UNESTABLISHED', 'MISSING', 'ABSTAINED'], key + '.status', 'UNESTABLISHED'),
    source: string(input.source, key + '.source', true),
    patternId: string(input.patternId, key + '.patternId', true),
    businessSignature: string(input.businessSignature, key + '.businessSignature', true),
    evidence: bounded(input.evidence, key + '.evidence'),
    note: string(input.note, key + '.note', true)
  };
}

function mappings(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  var out = {};
  for (var i = 0; i < MAPPING_KEYS.length; i++) out[MAPPING_KEYS[i]] = mapping(input[MAPPING_KEYS[i]], MAPPING_KEYS[i]);
  return out;
}

function recovery(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    status: status(input.status, ['OBSERVED', 'UNOBSERVED', 'CONTRADICTED', 'ABSTAINED'], 'recovery.status', 'UNOBSERVED'),
    regulatedVariable: string(input.regulatedVariable, 'recovery.regulatedVariable', true),
    evidence: bounded(input.evidence, 'recovery.evidence'),
    note: string(input.note, 'recovery.note', true)
  };
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('HOMOLOGY_CONTEXT_REQUIRED', 'homologyContext is required');
  if (input.schemaVersion !== SCHEMA) fail('HOMOLOGY_SCHEMA_REQUIRED', 'schemaVersion must be ' + SCHEMA);
  if (input.status !== STATUS) fail('HOMOLOGY_STATUS_REQUIRED', 'status must be ' + STATUS);
  var out = {
    schemaVersion: SCHEMA,
    status: STATUS,
    identity: identity(input.identity),
    phase: phaseContext(input.phase),
    regulation: regulationContext(input.regulation),
    brainNodes: nodes(input.brainNodes),
    mappings: mappings(input.mappings),
    recovery: recovery(input.recovery),
    provenance: input.provenance && typeof input.provenance === 'object' ? clone(input.provenance) : {},
    abstentions: bounded(input.abstentions, 'abstentions'),
    contextOnly: true
  };
  return out;
}

function collectNodes(state) {
  var out = [];
  var seen = Object.create(null);
  var network = state && state.functionalNetwork;
  var list = network && Array.isArray(network.nodes) ? network.nodes : (Array.isArray(network) ? network : []);
  for (var i = 0; i < list.length && out.length < MAX_ITEMS; i++) {
    var n = list[i];
    if (!n) continue;
    var id = n.id || n.brainNodeId;
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push({ id: id, role: n.role || null, state: n.state || null, diagnosisIds: n.diagnosisIds || n.diagnoses || [], evidence: n.evidence || [], source: 'state.functionalNetwork' });
  }
  var dx = state && Array.isArray(state.diagnoses) ? state.diagnoses : [];
  for (var d = 0; d < dx.length && out.length < MAX_ITEMS; d++) {
    var rec = dx[d] || {};
    var did = rec.nodeId || rec.brainNodeId;
    if (!did || seen[did]) continue;
    seen[did] = true;
    out.push({ id: did, role: rec.role || null, state: rec.active === true ? 'active' : 'inactive', diagnosisIds: rec.id ? [rec.id] : [], evidence: rec.evidence || [], source: 'state.diagnoses' });
  }
  return out;
}

function buildFromBrainState(domainId, state, sourceIdentity, extras) {
  state = state && typeof state === 'object' ? state : {};
  extras = extras && typeof extras === 'object' ? extras : {};
  var join = extras.companyDomainJoin || null;
  var companies = join && Array.isArray(join.companies) ? join.companies.slice(0, MAX_ITEMS) : (Array.isArray(state.companies) ? state.companies.slice(0, MAX_ITEMS) : []);
  var regulation = extras.regulation || state.regulation || state.dysregulation || {};
  var phaseEvidence = extras.phaseEvidence || state.phaseEvidence || [];
  var bridge = extras.bridgePattern || state.bridgePattern || state.bridgeReadings || {};
  var hasBridge = bridge && typeof bridge === 'object' && (bridge.patternId || bridge.businessSignature);
  var abstentions = [];
  if (!companies.length) abstentions.push('company-identity-not-present-in-domain-state');
  if (!collectNodes(state).length) abstentions.push('brain-node-context-not-present-in-domain-state');
  if (!regulation || (!regulation.state && !regulation.direction && !regulation.regulatedVariable)) abstentions.push('regulated-dysregulated-state-not-explicitly-supplied');
  if (!(state.recovery || extras.recovery)) abstentions.push('recovery-evidence-not-explicitly-supplied');
  if (!phaseEvidence.length) abstentions.push('phase-evidence-not-explicitly-supplied');
  if (!hasBridge) abstentions.push('business-homology-bridge-pattern-not-explicitly-supplied');
  var mappingsInput = extras.mappings || state.homologyMappings || {};
  if (hasBridge && !mappingsInput.neurology_to_business_homology) {
    mappingsInput = Object.assign({}, mappingsInput, {
      neurology_to_business_homology: {
        status: 'PRESENT', source: 'domain-bridge-pattern', patternId: bridge.patternId || null,
        businessSignature: bridge.businessSignature || null, evidence: bridge.evidence || [],
        note: 'Observed bridge metadata; not Thing 1 validation or authorization.'
      }
    });
  }
  return normalize({
    schemaVersion: SCHEMA,
    status: STATUS,
    identity: {
      domainId: domainId,
      domainLabel: state.label || domainId,
      joinStatus: join && join.joinStatus || (companies.length ? 'UNOBSERVED' : 'UNOBSERVED'),
      companies: companies,
      issues: join && join.issues || []
    },
    phase: { value: state.phase, label: state.phaseLabel, evidence: phaseEvidence, abstention: phaseEvidence.length ? null : 'phase evidence was not supplied by the source' },
    regulation: regulation,
    brainNodes: collectNodes(state),
    mappings: mappingsInput,
    recovery: extras.recovery || state.recovery || {},
    provenance: { sourceIdentity: clone(sourceIdentity), sourceFields: ['state.phase', 'state.phaseLabel', 'state.companies', 'state.diagnoses', 'state.functionalNetwork', 'state.regulation', 'state.recovery', 'bridgePattern'], producer: 'brain-cognition-refresh/1' },
    abstentions: abstentions
  });
}

module.exports = {
  MODULE_ID: MODULE_ID,
  SCHEMA: SCHEMA,
  STATUS: STATUS,
  MAX_ITEMS: MAX_ITEMS,
  MAPPING_KEYS: MAPPING_KEYS.slice(),
  normalize: normalize,
  buildFromBrainState: buildFromBrainState
};
