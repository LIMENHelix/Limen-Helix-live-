/**
 * LIMEN Helix — Master Living Brain (PFC executor)
 *
 * Subscribes to civilization + connectome patterns + Thing 2 phase output
 * (via direct read of window.LIMEN exposures), runs the integrative cycle,
 * decides which of the 6 engines to fire, persists artifacts to the
 * engine-output endpoint, and emits the master pattern.
 *
 * Per [[limen_neural_analogy]]: the PFC is the only executor. This is
 * where READY-TO-SIGN packages get produced. Actual submission to
 * USPTO/SBA/grants.gov is a human-click step (H6 two-lane integrity).
 *
 * Per [[limen_engine_sequence_and_specs]]: the 6 lanes are
 *   patent / grant / sba / franchise / investment / research
 * grouped into Phase A Protect / B Finance / C Replicate / D Execute
 * with Research as continuous Phase 0.
 *
 * Exposed via window.LIMENMasterLivingBrain.
 *
 * Depends on: LIMENPatternEnvelope, LIMENPatternBroker, LIMENSuperBrainBase.
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  var Broker = root.LIMENPatternBroker;
  var Base = root.LIMENSuperBrainBase;
  if (!Envelope || !Broker || !Base) {
    console.error('[MasterLivingBrain] missing dependencies');
    return;
  }

  // Per-lane readiness thresholds. Above the bar → engine fires next cycle.
  var LANE_THRESHOLDS = {
    patent:     { readiness: 0.55, salience: 0.30 },
    grant:      { readiness: 0.50, salience: 0.30 },
    sba:        { readiness: 0.55, salience: 0.30 },
    franchise:  { readiness: 0.60, salience: 0.30 },
    investment: { readiness: 0.60, salience: 0.40 }, // tightest — terminal lane
    research:   { readiness: 0.40, salience: 0.20 }  // loosest — continuous backbone
  };

  // Map operator key (from pattern.operators) to engine lane
  var OP_TO_LANE = {
    patents: 'patent',
    grants: 'grant',
    investments: 'investment'
    // sba, franchise, research need explicit signal hints from upstream
  };

  function MasterLivingBrain(options) {
    if (!(this instanceof MasterLivingBrain)) {
      return new MasterLivingBrain(options);
    }
    options = options || {};
    Base.call(this, 'master', 'master', Object.assign({
      cycleIntervalMs: 8000,
      engineRunner: options.engineRunner || _defaultEngineRunner
    }, options));

    this._engineFireLog = []; // [{ ts, lane, cik, sig, status }]
    this._lastSlugs = new Set ? new Set() : null;
  }
  MasterLivingBrain.prototype = Object.create(Base.prototype);
  MasterLivingBrain.prototype.constructor = MasterLivingBrain;

  // ── Kernel readout: master-scope integration ───────────────────────
  MasterLivingBrain.prototype._computeKernels = function (inputs) {
    var kernels = Envelope.emptyKernels();
    var civ = inputs.byBrain.civilization || null;
    var con = inputs.byBrain.connectome || null;

    // Master Thing 2 = weighted aggregate of civ + connectome
    var civStress = (civ && civ.kernels && civ.kernels.thing2) ? civ.kernels.thing2.stress : 0;
    var conStress = (con && con.kernels && con.kernels.thing2) ? con.kernels.thing2.stress : 0;
    var civPhase  = (civ && civ.kernels && civ.kernels.thing2) ? civ.kernels.thing2.dominantPhase : null;
    var conPhase  = (con && con.kernels && con.kernels.thing2) ? con.kernels.thing2.dominantPhase : null;

    var integratedStress = 0.65 * civStress + 0.35 * conStress;
    var trajectory = integratedStress > 0.55 ? 'ESCALATING' :
                     integratedStress < 0.25 ? 'STABLE' : 'WATCH';

    kernels.thing2 = {
      kernelId: 'master-integrative-v1',
      kernelVersion: '1.0.0',
      dominantPhase: civPhase || conPhase,
      phaseConfidence: clamp(((civ && civ.kernels && civ.kernels.thing2 && civ.kernels.thing2.phaseConfidence) || 0) * 0.7 +
                              ((con && con.kernels && con.kernels.thing2 && con.kernels.thing2.phaseConfidence) || 0) * 0.3, 0, 1),
      phaseVector: {
        civ: civPhase,
        connectome: conPhase,
        civStress: civStress,
        conStress: conStress
      },
      stress: clamp(integratedStress, 0, 1),
      trajectory: trajectory,
      coupling: {
        mode: 'master_integrated',
        source: 'civilization+connectome',
        intrinsic: { civStress: civStress, conStress: conStress },
        coupled: { integratedStress: integratedStress },
        biasContributions: { civ: 0.65, connectome: 0.35 }
      },
      interpretiveOnly: false  // master gates real engine firings
    };

    // Thing 1 — pulled through from civ if available; master doesn't run
    // its own validated scorer (that's the company-level Thing 1).
    if (civ && civ.kernels && civ.kernels.thing1) {
      kernels.thing1 = Object.assign({}, civ.kernels.thing1, {
        kernelId: 'master-' + (civ.kernels.thing1.kernelId || 'pass-through')
      });
    }

    return kernels;
  };

  // ── Pattern projection ─────────────────────────────────────────────
  MasterLivingBrain.prototype._computePattern = function (kernels, inputs) {
    var civ = inputs.byBrain.civilization;
    var con = inputs.byBrain.connectome;

    // Operator readiness: integrate civ + connectome operator blocks
    var operators = Envelope.emptyOperators();
    var keys = Envelope.OPERATOR_KEYS;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var civOp = (civ && civ.pattern && civ.pattern.operators && civ.pattern.operators[k]) || { readiness: 0, salience: 0, evidence: 0 };
      var conOp = (con && con.pattern && con.pattern.operators && con.pattern.operators[k]) || { readiness: 0, salience: 0, evidence: 0 };
      operators[k] = {
        readiness: clamp(0.7 * civOp.readiness + 0.3 * conOp.readiness, 0, 1),
        salience:  clamp(0.7 * civOp.salience  + 0.3 * conOp.salience,  0, 1),
        evidence:  clamp(0.5 * civOp.evidence  + 0.5 * conOp.evidence,  0, 1),
        gateSignal: civOp.gateSignal || conOp.gateSignal || null
      };
    }

    // Phase-conditioned policy override: if integrated stress > 0.7,
    // suppress franchise + investment lanes (rupture/dark phase per
    // limen_master_brain_architecture).
    if (kernels.thing2.stress > 0.70) {
      operators.investments.readiness = Math.min(operators.investments.readiness, 0.30);
      // No franchise operator key today; would suppress here if added.
    }

    // Bindings — pull from upstream
    var bindings = [];
    if (civ && civ.pattern) {
      bindings.push({ id: 'civilization', kind: 'super', weight: civ.pattern.salience || 0.5, sourceSig: civ.pattern.signature });
    }
    if (con && con.pattern) {
      bindings.push({ id: 'connectome', kind: 'super', weight: con.pattern.salience || 0.5, sourceSig: con.pattern.signature });
    }

    // Merge nodes from civ + connectome (cap top 32)
    var nodes = {};
    if (civ && civ.pattern && civ.pattern.nodes) {
      Object.keys(civ.pattern.nodes).slice(0, 16).forEach(function (n) {
        nodes[n] = civ.pattern.nodes[n];
      });
    }
    if (con && con.pattern && con.pattern.nodes) {
      Object.keys(con.pattern.nodes).slice(0, 16).forEach(function (n) {
        if (!nodes[n]) nodes[n] = con.pattern.nodes[n];
        else nodes[n] = {
          weight: Math.max(nodes[n].weight || 0, con.pattern.nodes[n].weight || 0),
          role: nodes[n].role || con.pattern.nodes[n].role,
          state: con.pattern.nodes[n].state || nodes[n].state
        };
      });
    }

    // Cross-domain affinities — top 24
    var aff = [];
    if (civ && civ.pattern && civ.pattern.crossDomainAffinities) aff = aff.concat(civ.pattern.crossDomainAffinities);
    if (con && con.pattern && con.pattern.crossDomainAffinities) aff = aff.concat(con.pattern.crossDomainAffinities);
    aff.sort(function (a, b) { return (b.strength || 0) - (a.strength || 0); });
    aff = aff.slice(0, 24);

    // Salience — weighted average of upstream
    var salience = 0;
    var n = 0;
    if (civ && civ.pattern) { salience += civ.pattern.salience; n++; }
    if (con && con.pattern) { salience += con.pattern.salience; n++; }
    salience = n > 0 ? salience / n : 0;

    return {
      salience: clamp(salience, 0, 1),
      operators: operators,
      nodes: nodes,
      bindings: bindings,
      crossDomainAffinities: aff,
      artifacts: this._drainPendingArtifacts(),
      _meta: {
        engineFireCount: this._engineFireLog.length,
        lastFires: this._engineFireLog.slice(-5),
        civSig: civ ? civ.pattern.signature : null,
        conSig: con ? con.pattern.signature : null
      }
    };
  };

  // ── Engine decisions ───────────────────────────────────────────────
  MasterLivingBrain.prototype._decideEngines = function (envelope) {
    var descriptors = [];
    var ops = envelope.pattern.operators || {};

    function pushDescriptor(lane, engineId, readiness, extras) {
      var c = _pickCandidateForLane(envelope, lane);
      if (!c || !c.cik) return;

      // ── Anterior → Posterior: bias readiness by historical outcome
      //    efficacy per lane (and per-cik when sample exists).
      //    Multiplier ∈ [0.5, 1.5], neutral 1.0 with no history.
      //    When approval-rate history is strong, this lane fires more
      //    aggressively (readiness scaled up); when rejections dominate
      //    on this cik, the firing is throttled.
      var efficacyMultiplier = 1.0;
      if (root.LIMENOutcomeAggregator) {
        var laneMult = root.LIMENOutcomeAggregator.getLaneEfficacy(lane) || 1.0;
        var cikMult = root.LIMENOutcomeAggregator.getCikEfficacy(c.cik) || 1.0;
        // Lane has more weight than CIK (broader sample); 0.6/0.4
        efficacyMultiplier = 0.6 * laneMult + 0.4 * cikMult;
      }
      var biasedReadiness = clamp(readiness * efficacyMultiplier, 0, 1);

      var d = {
        engineId: engineId,
        lane: lane,
        cik: c.cik,
        slug: c.slug || null,
        domain: c.domain || null,
        sourcePatternSig: envelope.pattern.signature,
        readiness: biasedReadiness,
        readinessRaw: readiness,
        efficacyMultiplier: efficacyMultiplier
      };
      if (extras) Object.keys(extras).forEach(function (k) { d[k] = extras[k]; });
      descriptors.push(d);
      // Notify expander so cool-down kicks in for this (cik, lane)
      if (root.LIMENCikCoverage && typeof root.LIMENCikCoverage.recordFire === 'function') {
        root.LIMENCikCoverage.recordFire(c.cik, lane);
      }
    }

    // Patent
    if (_meets(ops.patents, LANE_THRESHOLDS.patent)) {
      pushDescriptor('patent', 'engine-patent', ops.patents.readiness);
    }
    // Grant
    if (_meets(ops.grants, LANE_THRESHOLDS.grant)) {
      pushDescriptor('grant', 'engine-grant', ops.grants.readiness);
    }
    // Investment — kernel-gated (rupture phases suppress per _computePattern)
    if (_meets(ops.investments, LANE_THRESHOLDS.investment)) {
      pushDescriptor('investment', 'engine-investment', ops.investments.readiness);
    }
    // SBA — fires when grant + patent lane signals are both reasonably high
    if (ops.grants.readiness > LANE_THRESHOLDS.grant.readiness * 0.9 &&
        ops.patents.readiness > LANE_THRESHOLDS.patent.readiness * 0.8) {
      pushDescriptor('sba', 'engine-sba', (ops.grants.readiness + ops.patents.readiness) / 2);
    }
    // Franchise — fires when patent is high AND integrated stress is low
    if (ops.patents.readiness > LANE_THRESHOLDS.patent.readiness &&
        envelope.kernels.thing2.stress < 0.4) {
      pushDescriptor('franchise', 'engine-franchise',
                     ops.patents.readiness * (1 - envelope.kernels.thing2.stress));
    }
    // Research — continuous backbone; fires on any cycle with upstream input
    if ((envelope.provenance.inputs || []).length > 0) {
      pushDescriptor('research', 'engine-research', 0.5, { continuous: true });
    }

    // Log fire intentions for UI inspection
    for (var i = 0; i < descriptors.length; i++) {
      this._engineFireLog.push({
        ts: Date.now(),
        lane: descriptors[i].lane,
        cik: descriptors[i].cik,
        sig: envelope.pattern.signature,
        status: 'queued'
      });
    }
    if (this._engineFireLog.length > 200) {
      this._engineFireLog.splice(0, this._engineFireLog.length - 200);
    }

    return descriptors;
  };

  // ── Default engine runner ──────────────────────────────────────────
  // Calls api/limen-engine-output POST. Caller can supply their own
  // engineRunner option to swap in test doubles or real LLM calls.
  function _defaultEngineRunner(envelope, descriptor) {
    if (typeof fetch !== 'function') return Promise.resolve(null);

    var payload = {
      cik: descriptor.cik,
      slug: descriptor.slug || null,
      engineId: descriptor.engineId,
      lane: descriptor.lane,
      sourcePatternSig: descriptor.sourcePatternSig,
      readiness: descriptor.readiness,
      kernelSnapshot: {
        thing2: envelope.kernels.thing2,
        ts: envelope.ts
      },
      payload: {
        // Minimal stub payload — real implementations will swap this for
        // the artifact-packet-builder output or an Anthropic-expanded draft.
        title: descriptor.lane.toUpperCase() + ' READY-TO-SIGN package',
        readiness: descriptor.readiness,
        kernelPhase: envelope.kernels.thing2.dominantPhase,
        kernelStress: envelope.kernels.thing2.stress,
        provenance: {
          patternSig: envelope.pattern.signature,
          chainSig: envelope.provenance.chainSig,
          generatedAt: new Date(envelope.ts).toISOString()
        }
      }
    };

    // Operator token: read from window.LIMEN_OPERATOR_TOKEN if set
    // (operator UI sets this after sign-in); requests proceed without
    // the header otherwise and the server-side gate decides.
    var headers = { 'content-type': 'application/json' };
    if (typeof window !== 'undefined' && window.LIMEN_OPERATOR_TOKEN) {
      headers.authorization = 'Bearer ' + window.LIMEN_OPERATOR_TOKEN;
    }
    return fetch('/api/limen-engine-output', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (j) {
        return Object.assign({ httpStatus: r.status }, j);
      });
    }).catch(function (err) {
      return { error: String(err && err.message || err) };
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function _meets(opBlock, threshold) {
    if (!opBlock || !threshold) return false;
    return opBlock.readiness >= threshold.readiness &&
           opBlock.salience  >= threshold.salience;
  }

  function _pickCandidateForLane(envelope, lane) {
    // 1. Preferred: rotating candidate from CIK coverage expander
    if (root.LIMENCikCoverage && typeof root.LIMENCikCoverage.nextCandidate === 'function') {
      var c = root.LIMENCikCoverage.nextCandidate(lane);
      if (c && c.cik) {
        return { cik: c.cik, slug: c.slug, name: c.name, domain: c.domain, phase: c.phase };
      }
    }
    // 2. Fall back to civilization affinities for any CIK hint
    var aff = envelope.pattern.crossDomainAffinities || [];
    for (var i = 0; i < aff.length; i++) {
      if (aff[i].cik) return { cik: aff[i].cik };
      if (aff[i].ticker) return { cik: aff[i].ticker };
    }
    // 3. Then bindings
    var bindings = envelope.pattern.bindings || [];
    for (var j = 0; j < bindings.length; j++) {
      if (bindings[j].cik) return { cik: bindings[j].cik };
    }
    // 4. Hard fallback: Walmart (verified ELIGIBLE_NOW exemplar)
    return { cik: '0000104169', slug: 'walmart', name: 'Walmart Inc.' };
  }

  // Back-compat alias — older code paths may call _pickCandidateCIK.
  function _pickCandidateCIK(envelope) {
    var c = _pickCandidateForLane(envelope, 'investment');
    return c && c.cik || null;
  }

  function clamp(n, lo, hi) {
    n = +n;
    if (!isFinite(n)) return 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  root.LIMENMasterLivingBrain = MasterLivingBrain;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
