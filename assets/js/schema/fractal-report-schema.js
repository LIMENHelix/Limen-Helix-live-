/**
 * LIMEN HELIX — Fractal Report Schema
 * ════════════════════════════════════
 *
 * Canonical, deterministic data schema for the fractal
 * diagnosis / treatment system.
 *
 * Hierarchy:
 *   civilization → domain → portal → diagnosis → treatment → step
 *
 * Every level is fractal and reusable. A domain contains many portals,
 * a portal contains many diagnoses, etc.
 *
 * This module exports:
 *   - Schema enums and constants
 *   - Factory functions for each level
 *   - Validation helpers (returns { valid, errors[] })
 *   - Deep-validate for full trees
 *
 * IIFE — exposes window.LIMENFractalSchema
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // ENUMS
  // ═══════════════════════════════════════════════════════════════

  var SEVERITY = Object.freeze({
    CRITICAL:  'critical',
    HIGH:      'high',
    MODERATE:  'moderate',
    LOW:       'low',
    INFO:      'info'
  });

  var STATUS = Object.freeze({
    LIVE:      'live',
    FALLBACK:  'fallback',
    INFERRED:  'inferred',
    STATIC:    'static'
  });

  var TREATMENT_TYPE = Object.freeze({
    STRATEGY:    'strategy',
    COACHING:    'coaching',
    STRUCTURAL:  'structural',
    CULTURE:     'culture',
    TOOLS:       'tools',
    DIAGNOSTIC:  'diagnostic',
    REGULATORY:  'regulatory',
    DIPLOMATIC:  'diplomatic'
  });

  var SCALE_TAG = Object.freeze({
    GLOBAL: 'global',
    LOCAL:  'local',
    USER:   'user'
  });

  var TIME_TAG = Object.freeze({
    IMMEDIATE:  'immediate',
    NEAR_TERM:  'near-term',
    STRUCTURAL: 'structural'
  });

  var EVIDENCE_GRADE = Object.freeze({
    A:        'A',
    A_MINUS:  'A-',
    B_PLUS:   'B+',
    B:        'B',
    B_MINUS:  'B-',
    C_PLUS:   'C+',
    C:        'C',
    STRONG:   'Strong',
    MODERATE: 'Moderate',
    LIMITED:  'Limited',
    NONE:     'None'
  });

  var CIRCUIT_DIR = Object.freeze({
    HYPER:   'Hyper-active',
    HYPO:    'Hypo-active',
    ALTERED: 'Altered'
  });

  var TARGET_LEVEL = Object.freeze({
    CIVILIZATION: 'civilization',
    DOMAIN:       'domain',
    PORTAL:       'portal',
    DIAGNOSIS:    'diagnosis',
    TREATMENT:    'treatment',
    STEP:         'step'
  });

  // ═══════════════════════════════════════════════════════════════
  // SCHEMA SHAPES (documentation + runtime reference)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Step — atomic action unit
   * {
   *   id:             string (required)
   *   action:         string (required) — what to do
   *   sequence:       number (required) — 1-based order
   *   targetLevel:    TARGET_LEVEL (required)
   *   expectedEffect: string (required)
   *   dependencies:   string[] — ids of prerequisite steps
   *   status:         STATUS
   *   notes:          string
   * }
   */

  /**
   * Treatment — intervention package
   * {
   *   id:             string (required)
   *   title:          string (required)
   *   type:           TREATMENT_TYPE (required)
   *   rationale:      string (required)
   *   prerequisites:  string[]
   *   scaleTags:      SCALE_TAG[] (required, ≥1)
   *   timeTags:       TIME_TAG[] (required, ≥1)
   *   steps:          Step[] (required, ≥1)
   *   evidence:       EvidenceChain
   *   monitoring:     string
   *   escalation:     string
   *   citations:      Citation[]
   *   status:         STATUS
   *   confidence:     number (0–1)
   *   uncertainty:    number (0–1)
   *   spillover:      Spillover[]
   * }
   */

  /**
   * Diagnosis — problem identification
   * {
   *   id:             string (required)
   *   title:          string (required)
   *   description:    string (required)
   *   severity:       SEVERITY (required)
   *   severityScore:  number (0–1)
   *   severityLogic:  string — explanation of how severity was determined
   *   indicators:     Indicator[] (required, ≥1)
   *   evidenceReqs:   EvidenceRequirement[]
   *   circuits:       Circuit[]
   *   treatments:     Treatment[] (required, ≥1)
   *   propagation:    Spillover[]
   *   confidence:     number (0–1)
   *   uncertainty:    number (0–1)
   *   evidenceChain:  EvidenceChain
   *   sourceLinks:    string[]
   *   status:         STATUS
   * }
   */

  /**
   * Portal — operational entry point
   * {
   *   id:          string (required)
   *   title:       string (required)
   *   domainId:    string (required) — parent domain
   *   phase:       string
   *   diagnoses:   Diagnosis[] (required)
   *   status:      STATUS
   *   confidence:  number (0–1)
   *   metadata:    object
   * }
   */

  /**
   * Domain — thematic grouping
   * {
   *   id:          string (required)
   *   title:       string (required)
   *   portals:     Portal[] (required, ≥1)
   *   stress:      number (0–1)
   *   trend:       string
   *   status:      STATUS
   *   confidence:  number (0–1)
   *   spillover:   Spillover[]
   *   metadata:    object
   * }
   */

  /**
   * Civilization — top-level container
   * {
   *   id:          string (required)
   *   title:       string (required)
   *   generatedAt: string (ISO 8601)
   *   domains:     Domain[] (required, ≥1)
   *   globalState: string
   *   confidence:  number (0–1)
   *   status:      STATUS
   *   metadata:    object
   * }
   */

  // ═══════════════════════════════════════════════════════════════
  // SUB-STRUCTURES
  // ═══════════════════════════════════════════════════════════════

  // Indicator: a measurable signal
  // { id, label, value, threshold, unit, direction ('rising'|'falling'|'stable'), source }

  // Circuit: brain-node linkage
  // { nodeId, dir (CIRCUIT_DIR), detail, evidence (EVIDENCE_GRADE) }

  // EvidenceRequirement: what data is needed to confirm diagnosis
  // { id, description, grade (EVIDENCE_GRADE), satisfied (bool), source }

  // EvidenceChain: provenance trail
  // { sources[], method, temporal ('historical'|'current'|'projected'), grade (EVIDENCE_GRADE), notes }

  // Spillover: cross-domain propagation
  // { targetDomainId, mechanism, magnitude (0–1), direction ('amplify'|'dampen'|'destabilize'), confidence (0–1) }

  // Citation: reference
  // { author, year, title, journal, doi, url }

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════════

  function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }
  function isNumber01(v) { return typeof v === 'number' && v >= 0 && v <= 1; }
  function isOptionalNumber01(v) { return v === undefined || v === null || isNumber01(v); }
  function isArrayOf(arr, fn) {
    if (!Array.isArray(arr)) return false;
    for (var i = 0; i < arr.length; i++) { if (!fn(arr[i])) return false; }
    return true;
  }
  function enumValues(obj) {
    var vals = [];
    for (var k in obj) { if (obj.hasOwnProperty(k)) vals.push(obj[k]); }
    return vals;
  }
  function inEnum(val, enumObj) {
    var vals = enumValues(enumObj);
    return vals.indexOf(val) !== -1;
  }

  // Path-aware error collector
  function Errors() {
    this.list = [];
  }
  Errors.prototype.add = function (path, msg) {
    this.list.push({ path: path, message: msg });
  };
  Errors.prototype.result = function () {
    return { valid: this.list.length === 0, errors: this.list };
  };

  // ── Validate Step ──

  function validateStep(step, path) {
    var e = new Errors();
    if (!path) path = 'step';
    if (!step || typeof step !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!isNonEmptyString(step.id))             e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(step.action))          e.add(path + '.action', 'required non-empty string');
    if (typeof step.sequence !== 'number' || step.sequence < 1)
      e.add(path + '.sequence', 'required positive integer');
    if (!isNonEmptyString(step.targetLevel))     e.add(path + '.targetLevel', 'required non-empty string');
    else if (!inEnum(step.targetLevel, TARGET_LEVEL))
      e.add(path + '.targetLevel', 'must be one of: ' + enumValues(TARGET_LEVEL).join(', '));
    if (!isNonEmptyString(step.expectedEffect))  e.add(path + '.expectedEffect', 'required non-empty string');
    if (step.dependencies !== undefined && !isArrayOf(step.dependencies || [], isNonEmptyString))
      e.add(path + '.dependencies', 'must be array of strings');
    if (step.status !== undefined && !inEnum(step.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));
    return e.result();
  }

  // ── Validate Indicator ──

  function validateIndicator(ind, path) {
    var e = new Errors();
    if (!ind || typeof ind !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!isNonEmptyString(ind.id))    e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(ind.label)) e.add(path + '.label', 'required non-empty string');
    return e.result();
  }

  // ── Validate Circuit ──

  function validateCircuit(c, path) {
    var e = new Errors();
    if (!c || typeof c !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!isNonEmptyString(c.nodeId)) e.add(path + '.nodeId', 'required non-empty string');
    if (!isNonEmptyString(c.dir))    e.add(path + '.dir', 'required non-empty string');
    return e.result();
  }

  // ── Validate Spillover ──

  function validateSpillover(s, path) {
    var e = new Errors();
    if (!s || typeof s !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!isNonEmptyString(s.targetDomainId)) e.add(path + '.targetDomainId', 'required non-empty string');
    if (!isNonEmptyString(s.mechanism))      e.add(path + '.mechanism', 'required non-empty string');
    if (!isNumber01(s.magnitude))             e.add(path + '.magnitude', 'required number 0–1');
    return e.result();
  }

  // ── Validate EvidenceChain ──

  function validateEvidenceChain(ec, path) {
    var e = new Errors();
    if (!ec || typeof ec !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!Array.isArray(ec.sources)) e.add(path + '.sources', 'required array');
    if (!isNonEmptyString(ec.method)) e.add(path + '.method', 'required non-empty string');
    return e.result();
  }

  // ── Validate Citation ──

  function validateCitation(c, path) {
    var e = new Errors();
    if (!c || typeof c !== 'object') { e.add(path, 'must be an object'); return e.result(); }
    if (!isNonEmptyString(c.author)) e.add(path + '.author', 'required non-empty string');
    if (!isNonEmptyString(c.title))  e.add(path + '.title', 'required non-empty string');
    return e.result();
  }

  // ── Validate Treatment ──

  function validateTreatment(t, path) {
    var e = new Errors();
    if (!path) path = 'treatment';
    if (!t || typeof t !== 'object') { e.add(path, 'must be an object'); return e.result(); }

    if (!isNonEmptyString(t.id))        e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(t.title))     e.add(path + '.title', 'required non-empty string');
    if (!isNonEmptyString(t.type))      e.add(path + '.type', 'required non-empty string');
    else if (!inEnum(t.type, TREATMENT_TYPE))
      e.add(path + '.type', 'must be one of: ' + enumValues(TREATMENT_TYPE).join(', '));
    if (!isNonEmptyString(t.rationale)) e.add(path + '.rationale', 'required non-empty string');

    // scaleTags
    if (!Array.isArray(t.scaleTags) || t.scaleTags.length === 0)
      e.add(path + '.scaleTags', 'required non-empty array');
    else {
      for (var si = 0; si < t.scaleTags.length; si++) {
        if (!inEnum(t.scaleTags[si], SCALE_TAG))
          e.add(path + '.scaleTags[' + si + ']', 'must be one of: ' + enumValues(SCALE_TAG).join(', '));
      }
    }

    // timeTags
    if (!Array.isArray(t.timeTags) || t.timeTags.length === 0)
      e.add(path + '.timeTags', 'required non-empty array');
    else {
      for (var ti = 0; ti < t.timeTags.length; ti++) {
        if (!inEnum(t.timeTags[ti], TIME_TAG))
          e.add(path + '.timeTags[' + ti + ']', 'must be one of: ' + enumValues(TIME_TAG).join(', '));
      }
    }

    // steps
    if (!Array.isArray(t.steps) || t.steps.length === 0)
      e.add(path + '.steps', 'required non-empty array of Step objects');
    else {
      for (var xi = 0; xi < t.steps.length; xi++) {
        var sr = validateStep(t.steps[xi], path + '.steps[' + xi + ']');
        if (!sr.valid) e.list = e.list.concat(sr.errors);
      }
    }

    // optional fields
    if (t.prerequisites !== undefined && !isArrayOf(t.prerequisites || [], isNonEmptyString))
      e.add(path + '.prerequisites', 'must be array of strings');
    if (!isOptionalNumber01(t.confidence))
      e.add(path + '.confidence', 'must be number 0–1');
    if (!isOptionalNumber01(t.uncertainty))
      e.add(path + '.uncertainty', 'must be number 0–1');
    if (t.status !== undefined && !inEnum(t.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));
    if (t.evidence) {
      var ecr = validateEvidenceChain(t.evidence, path + '.evidence');
      if (!ecr.valid) e.list = e.list.concat(ecr.errors);
    }
    if (t.citations) {
      if (!Array.isArray(t.citations)) e.add(path + '.citations', 'must be array');
      else {
        for (var ci = 0; ci < t.citations.length; ci++) {
          var cr = validateCitation(t.citations[ci], path + '.citations[' + ci + ']');
          if (!cr.valid) e.list = e.list.concat(cr.errors);
        }
      }
    }
    if (t.spillover) {
      if (!Array.isArray(t.spillover)) e.add(path + '.spillover', 'must be array');
      else {
        for (var spi = 0; spi < t.spillover.length; spi++) {
          var spr = validateSpillover(t.spillover[spi], path + '.spillover[' + spi + ']');
          if (!spr.valid) e.list = e.list.concat(spr.errors);
        }
      }
    }

    return e.result();
  }

  // ── Validate Diagnosis ──

  function validateDiagnosis(dx, path) {
    var e = new Errors();
    if (!path) path = 'diagnosis';
    if (!dx || typeof dx !== 'object') { e.add(path, 'must be an object'); return e.result(); }

    if (!isNonEmptyString(dx.id))          e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(dx.title))       e.add(path + '.title', 'required non-empty string');
    if (!isNonEmptyString(dx.description)) e.add(path + '.description', 'required non-empty string');
    if (!isNonEmptyString(dx.severity))    e.add(path + '.severity', 'required non-empty string');
    else if (!inEnum(dx.severity, SEVERITY))
      e.add(path + '.severity', 'must be one of: ' + enumValues(SEVERITY).join(', '));

    // indicators
    if (!Array.isArray(dx.indicators) || dx.indicators.length === 0)
      e.add(path + '.indicators', 'required non-empty array');
    else {
      for (var ii = 0; ii < dx.indicators.length; ii++) {
        var ir = validateIndicator(dx.indicators[ii], path + '.indicators[' + ii + ']');
        if (!ir.valid) e.list = e.list.concat(ir.errors);
      }
    }

    // treatments
    if (!Array.isArray(dx.treatments) || dx.treatments.length === 0)
      e.add(path + '.treatments', 'required non-empty array');
    else {
      for (var ti = 0; ti < dx.treatments.length; ti++) {
        var tr = validateTreatment(dx.treatments[ti], path + '.treatments[' + ti + ']');
        if (!tr.valid) e.list = e.list.concat(tr.errors);
      }
    }

    // optional arrays
    if (dx.circuits) {
      if (!Array.isArray(dx.circuits)) e.add(path + '.circuits', 'must be array');
      else {
        for (var ci = 0; ci < dx.circuits.length; ci++) {
          var cr = validateCircuit(dx.circuits[ci], path + '.circuits[' + ci + ']');
          if (!cr.valid) e.list = e.list.concat(cr.errors);
        }
      }
    }
    if (dx.propagation) {
      if (!Array.isArray(dx.propagation)) e.add(path + '.propagation', 'must be array');
      else {
        for (var pi = 0; pi < dx.propagation.length; pi++) {
          var pr = validateSpillover(dx.propagation[pi], path + '.propagation[' + pi + ']');
          if (!pr.valid) e.list = e.list.concat(pr.errors);
        }
      }
    }
    if (dx.evidenceReqs) {
      if (!Array.isArray(dx.evidenceReqs)) e.add(path + '.evidenceReqs', 'must be array');
    }

    if (!isOptionalNumber01(dx.confidence))  e.add(path + '.confidence', 'must be number 0–1');
    if (!isOptionalNumber01(dx.uncertainty))  e.add(path + '.uncertainty', 'must be number 0–1');
    if (dx.status !== undefined && !inEnum(dx.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));
    if (dx.evidenceChain) {
      var ecr = validateEvidenceChain(dx.evidenceChain, path + '.evidenceChain');
      if (!ecr.valid) e.list = e.list.concat(ecr.errors);
    }

    return e.result();
  }

  // ── Validate Portal ──

  function validatePortal(portal, path) {
    var e = new Errors();
    if (!path) path = 'portal';
    if (!portal || typeof portal !== 'object') { e.add(path, 'must be an object'); return e.result(); }

    if (!isNonEmptyString(portal.id))       e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(portal.title))    e.add(path + '.title', 'required non-empty string');
    if (!isNonEmptyString(portal.domainId)) e.add(path + '.domainId', 'required non-empty string');

    if (!Array.isArray(portal.diagnoses) || portal.diagnoses.length === 0)
      e.add(path + '.diagnoses', 'required non-empty array');
    else {
      for (var di = 0; di < portal.diagnoses.length; di++) {
        var dr = validateDiagnosis(portal.diagnoses[di], path + '.diagnoses[' + di + ']');
        if (!dr.valid) e.list = e.list.concat(dr.errors);
      }
    }

    if (!isOptionalNumber01(portal.confidence)) e.add(path + '.confidence', 'must be number 0–1');
    if (portal.status !== undefined && !inEnum(portal.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));

    return e.result();
  }

  // ── Validate Domain ──

  function validateDomain(domain, path) {
    var e = new Errors();
    if (!path) path = 'domain';
    if (!domain || typeof domain !== 'object') { e.add(path, 'must be an object'); return e.result(); }

    if (!isNonEmptyString(domain.id))    e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(domain.title)) e.add(path + '.title', 'required non-empty string');

    if (!Array.isArray(domain.portals) || domain.portals.length === 0)
      e.add(path + '.portals', 'required non-empty array');
    else {
      for (var pi = 0; pi < domain.portals.length; pi++) {
        var pr = validatePortal(domain.portals[pi], path + '.portals[' + pi + ']');
        if (!pr.valid) e.list = e.list.concat(pr.errors);
      }
    }

    if (!isOptionalNumber01(domain.stress))     e.add(path + '.stress', 'must be number 0–1');
    if (!isOptionalNumber01(domain.confidence))  e.add(path + '.confidence', 'must be number 0–1');
    if (domain.status !== undefined && !inEnum(domain.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));
    if (domain.spillover) {
      if (!Array.isArray(domain.spillover)) e.add(path + '.spillover', 'must be array');
      else {
        for (var si = 0; si < domain.spillover.length; si++) {
          var sr = validateSpillover(domain.spillover[si], path + '.spillover[' + si + ']');
          if (!sr.valid) e.list = e.list.concat(sr.errors);
        }
      }
    }

    return e.result();
  }

  // ── Validate Civilization (full tree) ──

  function validateCivilization(civ, path) {
    var e = new Errors();
    if (!path) path = 'civilization';
    if (!civ || typeof civ !== 'object') { e.add(path, 'must be an object'); return e.result(); }

    if (!isNonEmptyString(civ.id))    e.add(path + '.id', 'required non-empty string');
    if (!isNonEmptyString(civ.title)) e.add(path + '.title', 'required non-empty string');

    if (!Array.isArray(civ.domains) || civ.domains.length === 0)
      e.add(path + '.domains', 'required non-empty array');
    else {
      for (var di = 0; di < civ.domains.length; di++) {
        var dr = validateDomain(civ.domains[di], path + '.domains[' + di + ']');
        if (!dr.valid) e.list = e.list.concat(dr.errors);
      }
    }

    if (!isOptionalNumber01(civ.confidence)) e.add(path + '.confidence', 'must be number 0–1');
    if (civ.status !== undefined && !inEnum(civ.status, STATUS))
      e.add(path + '.status', 'must be one of: ' + enumValues(STATUS).join(', '));

    return e.result();
  }

  // ═══════════════════════════════════════════════════════════════
  // GUARD — prevent rendering of malformed objects
  // ═══════════════════════════════════════════════════════════════

  /**
   * guardRender(level, obj)
   * Returns the object if valid, throws if not.
   * Use before passing data to any renderer.
   *
   * @param {'step'|'treatment'|'diagnosis'|'portal'|'domain'|'civilization'} level
   * @param {object} obj
   * @returns {object} the validated obj
   * @throws {Error} with all validation errors joined
   */
  var VALIDATORS = {
    step:         validateStep,
    treatment:    validateTreatment,
    diagnosis:    validateDiagnosis,
    portal:       validatePortal,
    domain:       validateDomain,
    civilization: validateCivilization
  };

  function guardRender(level, obj) {
    var fn = VALIDATORS[level];
    if (!fn) throw new Error('Unknown schema level: ' + level);
    var result = fn(obj);
    if (!result.valid) {
      var msgs = [];
      for (var i = 0; i < result.errors.length; i++) {
        msgs.push(result.errors[i].path + ': ' + result.errors[i].message);
      }
      throw new Error('LIMEN Schema validation failed (' + level + '):\n' + msgs.join('\n'));
    }
    return obj;
  }

  // ═══════════════════════════════════════════════════════════════
  // ADAPTER — convert existing domain JSON to fractal schema
  // ═══════════════════════════════════════════════════════════════

  /**
   * Converts a legacy domain JSON (activations/issues structure)
   * into the fractal portal schema.
   *
   * @param {object} domainJson — raw domain JSON from assets/data/domains/
   * @returns {Portal} — fractal portal object
   */
  function fromLegacyDomain(domainJson) {
    if (!domainJson) return null;

    var diagnoses = [];

    // Map each issue → diagnosis
    var issues = domainJson.issues || [];
    var activations = domainJson.activations || [];

    // Index activations by brainNodeId
    var activationMap = {};
    for (var ai = 0; ai < activations.length; ai++) {
      var act = activations[ai];
      if (act.brainNodeId) activationMap[act.brainNodeId] = act;
    }

    for (var ii = 0; ii < issues.length; ii++) {
      var issue = issues[ii];
      var circuits = [];
      var treatments = [];
      var seenTreatments = {};

      var issueCircuits = issue.circuits || [];
      for (var ci = 0; ci < issueCircuits.length; ci++) {
        var c = issueCircuits[ci];
        circuits.push({
          nodeId: String(c.nodeId),
          dir: c.dir || 'Altered',
          detail: c.detail || '',
          evidence: c.evidence || 'Limited'
        });

        // Harvest treatments from matching activation
        var act2 = activationMap[c.nodeId];
        if (act2 && act2.treatments) {
          for (var ti = 0; ti < act2.treatments.length; ti++) {
            var rawT = act2.treatments[ti];
            var tKey = rawT.label || rawT.description;
            if (seenTreatments[tKey]) continue;
            seenTreatments[tKey] = true;

            var steps = [];
            var rawSteps = rawT.steps || [];
            for (var si = 0; si < rawSteps.length; si++) {
              steps.push({
                id: (issue.id || 'dx') + '_t' + ti + '_s' + (si + 1),
                action: rawSteps[si],
                sequence: si + 1,
                targetLevel: 'portal',
                expectedEffect: 'Progress toward ' + (rawT.target || 'operational resilience'),
                dependencies: si > 0 ? [(issue.id || 'dx') + '_t' + ti + '_s' + si] : []
              });
            }

            var typeMap = {
              STRATEGY: 'strategy', COACHING: 'coaching', STRUCTURAL: 'structural',
              CULTURE: 'culture', TOOLS: 'tools', DIAGNOSTIC: 'diagnostic'
            };

            treatments.push({
              id: (issue.id || 'dx') + '_t' + ti,
              title: rawT.label || rawT.description || 'Treatment ' + (ti + 1),
              type: typeMap[(rawT.type || '').toUpperCase()] || 'strategy',
              rationale: rawT.description || rawT.label || '',
              prerequisites: [],
              scaleTags: ['local'],
              timeTags: ['near-term'],
              steps: steps.length > 0 ? steps : [{
                id: (issue.id || 'dx') + '_t' + ti + '_s1',
                action: 'Implement ' + (rawT.label || 'treatment'),
                sequence: 1,
                targetLevel: 'portal',
                expectedEffect: 'Improvement in target domain',
                dependencies: []
              }],
              evidence: {
                sources: rawT.cite ? [rawT.cite] : [],
                method: 'literature-review',
                temporal: 'current',
                grade: rawT.evidence || 'C'
              },
              monitoring: rawT.monitoring || '',
              escalation: rawT.escalation || '',
              citations: (rawT.citation || []).map(function (ref) {
                return {
                  author: ref.author || '',
                  year: ref.year || null,
                  title: ref.title || '',
                  journal: ref.journal || '',
                  doi: ref.doi || null,
                  url: null
                };
              }),
              status: 'static',
              confidence: 0.5,
              uncertainty: 0.3
            });
          }
        }
      }

      // Build at least one treatment if none harvested
      if (treatments.length === 0) {
        treatments.push({
          id: (issue.id || 'dx_' + ii) + '_t0',
          title: 'General Intervention for ' + (issue.label || 'this issue'),
          type: 'strategy',
          rationale: 'Default intervention pending specific treatment mapping',
          prerequisites: [],
          scaleTags: ['local'],
          timeTags: ['near-term'],
          steps: [{
            id: (issue.id || 'dx_' + ii) + '_t0_s1',
            action: 'Assess and develop targeted response',
            sequence: 1,
            targetLevel: 'portal',
            expectedEffect: 'Baseline assessment established',
            dependencies: []
          }],
          status: 'fallback',
          confidence: 0.25,
          uncertainty: 0.5
        });
      }

      diagnoses.push({
        id: issue.id || 'dx_' + ii,
        title: issue.label || 'Diagnosis ' + (ii + 1),
        description: issue.summary || issue.label || '',
        severity: 'moderate',
        indicators: [{
          id: (issue.id || 'dx_' + ii) + '_ind_circuit_count',
          label: 'Affected circuits',
          value: circuits.length,
          threshold: 3,
          unit: 'circuits'
        }],
        circuits: circuits,
        treatments: treatments,
        confidence: 0.5,
        uncertainty: 0.3,
        status: 'static'
      });
    }

    return {
      id: domainJson.domainId || 'unknown',
      title: domainJson.title || domainJson.domainId || 'Unknown Portal',
      domainId: domainJson.domainId || 'unknown',
      phase: domainJson.phase || null,
      diagnoses: diagnoses.length > 0 ? diagnoses : [{
        id: 'placeholder',
        title: 'No issues mapped',
        description: 'This portal has no mapped issues',
        severity: 'info',
        indicators: [{ id: 'none', label: 'None', value: 0 }],
        treatments: [{
          id: 'placeholder_t0',
          title: 'No treatments',
          type: 'diagnostic',
          rationale: 'Awaiting issue mapping',
          scaleTags: ['local'],
          timeTags: ['near-term'],
          steps: [{
            id: 'placeholder_t0_s1',
            action: 'Map issues to this portal',
            sequence: 1,
            targetLevel: 'portal',
            expectedEffect: 'Issue coverage',
            dependencies: []
          }],
          status: 'fallback',
          confidence: 0.1
        }],
        status: 'fallback'
      }],
      status: 'static',
      confidence: 0.5
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════

  var _export = {
    // Enums
    SEVERITY:       SEVERITY,
    STATUS:         STATUS,
    TREATMENT_TYPE: TREATMENT_TYPE,
    SCALE_TAG:      SCALE_TAG,
    TIME_TAG:       TIME_TAG,
    EVIDENCE_GRADE: EVIDENCE_GRADE,
    CIRCUIT_DIR:    CIRCUIT_DIR,
    TARGET_LEVEL:   TARGET_LEVEL,

    // Validators (return { valid, errors[] })
    validateStep:         validateStep,
    validateTreatment:    validateTreatment,
    validateDiagnosis:    validateDiagnosis,
    validatePortal:       validatePortal,
    validateDomain:       validateDomain,
    validateCivilization: validateCivilization,

    // Guard — throws on invalid, returns obj on valid
    guardRender: guardRender,

    // Adapter
    fromLegacyDomain: fromLegacyDomain
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _export;
  }
  if (typeof window !== 'undefined') {
    window.LIMENFractalSchema = _export;
  }

})();
