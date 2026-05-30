/**
 * operator-canonical-identity.js
 * LIMEN HELIX — Operator Canonical Identity Declaration
 *
 * The vmPFC/OFC analog: a frozen declaration of who the human operator is,
 * what signals are allowed to influence the system, what actions are
 * permanently disallowed for biosensor-driven authority, and what regulation
 * goals the human-state gate should optimize against.
 *
 * This is the upstream layer that makes the gate possible. Without a
 * canonical identity, "is this action context-appropriate?" has no
 * referent to evaluate against.
 *
 * Loaded BEFORE human-state-packet.js and human-context-gate.js.
 * Loaded AFTER biosensor-bridge.js (no dependency, but reads cleanly only
 * once biosensor stack is up).
 *
 * Exposes:
 *   window.LIMENOperatorCanonicalIdentity = {
 *     get()                  -> deep-cloned identity object
 *     getVersion()           -> identity declaration version string
 *     isInputAllowed(name)   -> boolean
 *     isActionDisallowed(t)  -> boolean   // pure refusal — biosensor cannot authorize
 *     getRegulationGoals()   -> string[]
 *     getProvenance()        -> { version, declaredAt, declaredBy, immutable: true }
 *   }
 */
(function () {
  'use strict';

  // ── Identity version (bump when goals/inputs/disallowed-actions change) ──
  var IDENTITY_VERSION = '1.0.0';
  var DECLARED_AT = '2026-05-22T00:00:00Z';

  // ── Canonical identity (frozen — never mutated at runtime) ──
  var HUMAN_OPERATOR_CANONICAL_IDENTITY = Object.freeze({
    schemaVersion: IDENTITY_VERSION,
    declaredAt: DECLARED_AT,

    entityId: 'operator_chris',
    entityType: 'human_operator',
    role: 'founder_architect',
    systemFunction: 'executive_intuition_and_architectural_direction',

    // What signals the biosensor stack is permitted to ingest as input
    // to the human-state-packet derivation. Anything not on this list
    // is silently ignored by the packet builder (defense-in-depth: even
    // if biosensorEngine grows new channels, the gate won't accept them
    // until they're declared here).
    allowedInputs: Object.freeze([
      'typing_cadence',
      'typing_variability',
      'backspace_rate',
      'pause_duration',
      'hrv_proxy',
      'camera_motion',
      'facial_tension',
      'interaction_latency',
      'task_switching_rate',
      'error_correction_rate',
      'heart_rate',
      'arousal',
      'coherence',
      'cognitive_load',
      'valence',
      'self_report'
    ]),

    // Actions the biosensor-driven gate is NEVER allowed to authorize
    // alone, regardless of operator-state confidence or phase. These
    // require explicit operator signature on a per-instance basis.
    // The gate may RECOMMEND, BLOCK, or DEFER these — but cannot
    // independently EXECUTE them.
    disallowedActions: Object.freeze([
      'medical_diagnosis',
      'medical_recommendation',
      'automatic_external_submission',
      'high_stakes_financial_execution',
      'legal_filing_without_review',
      'self_pathologizing_output',
      'runaway_recursive_analysis',
      'trading_execution',
      'capital_disbursement',
      'irreversible_data_deletion',
      'external_communication_send'
    ]),

    // What the gate is optimizing FOR when it routes work to or away
    // from the operator. These goals are the loss function the
    // human-context-gate references when scoring proposed actions.
    regulationGoals: Object.freeze([
      'maintain cognitive coherence',
      'detect overload before performance degrades',
      'reduce task fragmentation',
      'protect executive decision quality',
      'route work to correct cognitive state',
      'preserve agency — biosensor is advisory, not authoritative',
      'prevent reflexive-loop amplification (biosensor → system → behavior → biosensor)'
    ]),

    // Hard invariants the gate must honor.
    invariants: Object.freeze({
      biosensorAuthority: 'advisory_only',
      operatorSignatureRequired: ['medical', 'legal', 'financial', 'external_submission'],
      maxBiosensorWeight: 0.30,           // mirrors domain-biosensor-adapter MAX_WEIGHT
      sessionMemoryOnly: true,            // packet lives in RAM by default
      persistRequiresAuth: true,          // server-side persistence requires operator token
      noTracking: true,                   // per CLAUDE.md prime directive
      noFingerprinting: true,
      explainabilityRequired: true        // every refusal carries reason + alternative
    }),

    // Provenance — who declared this identity, immutable from runtime.
    provenance: Object.freeze({
      declaredBy: 'operator_chris',
      declaredAt: DECLARED_AT,
      version: IDENTITY_VERSION,
      authority: 'human_operator_self_declaration',
      immutable: true,
      changeRequires: 'new file version + script reload (no hot-edit)'
    })
  });

  // ── Lookup helpers (return primitives or deep-clones) ──
  function _deepClone(v) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function get() {
    return _deepClone(HUMAN_OPERATOR_CANONICAL_IDENTITY);
  }

  function getVersion() {
    return IDENTITY_VERSION;
  }

  function isInputAllowed(inputName) {
    if (typeof inputName !== 'string') return false;
    return HUMAN_OPERATOR_CANONICAL_IDENTITY.allowedInputs.indexOf(inputName) !== -1;
  }

  function isActionDisallowed(actionType) {
    if (typeof actionType !== 'string') return false;
    return HUMAN_OPERATOR_CANONICAL_IDENTITY.disallowedActions.indexOf(actionType) !== -1;
  }

  function getRegulationGoals() {
    return HUMAN_OPERATOR_CANONICAL_IDENTITY.regulationGoals.slice();
  }

  function getInvariants() {
    return _deepClone(HUMAN_OPERATOR_CANONICAL_IDENTITY.invariants);
  }

  function getProvenance() {
    return _deepClone(HUMAN_OPERATOR_CANONICAL_IDENTITY.provenance);
  }

  // ── Public API ──
  if (typeof window !== 'undefined') {
    window.LIMENOperatorCanonicalIdentity = {
      get: get,
      getVersion: getVersion,
      isInputAllowed: isInputAllowed,
      isActionDisallowed: isActionDisallowed,
      getRegulationGoals: getRegulationGoals,
      getInvariants: getInvariants,
      getProvenance: getProvenance
    };
  }

  // CommonJS export for server-side gate (autofire / multipass workers).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      HUMAN_OPERATOR_CANONICAL_IDENTITY: HUMAN_OPERATOR_CANONICAL_IDENTITY,
      get: get,
      getVersion: getVersion,
      isInputAllowed: isInputAllowed,
      isActionDisallowed: isActionDisallowed,
      getRegulationGoals: getRegulationGoals,
      getInvariants: getInvariants,
      getProvenance: getProvenance
    };
  }
})();
