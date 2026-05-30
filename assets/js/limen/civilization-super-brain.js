/**
 * LIMEN Helix — Civilization Super-Brain
 *
 * Wraps the existing civilization aggregation stack (domain-packet-adapter,
 * cross-domain-audit, cross-node-opportunity, handoff-contract) into a
 * unified pattern emission. The 20 domain brains already produce their
 * output via the adapter; this super-brain consumes that consolidated
 * view and emits a single civilization pattern envelope.
 *
 * Per [[limen_neural_analogy]]: civilization is DMN + Salience. It
 * aggregates and surfaces but does not execute. The pattern this brain
 * emits is what the Master Brain consumes for executive decisions.
 *
 * Exposed via window.LIMENCivilizationSuperBrain.
 *
 * Depends on: LIMENPatternEnvelope, LIMENPatternBroker, LIMENSuperBrainBase.
 * Optional integrations (consumed if present, ignored if absent):
 *   window.LIMENCivilizationPackets       — domain-packet-adapter output
 *   window.LIMENCrossDomainAuditState     — cross-domain-audit output
 *   window.LIMENMainBrainHandoffState     — handoff-contract output
 *   window.LIMENCrossNodeOpportunityState — cross-node-opportunity output
 *   window.LIMENDomainBrains              — direct domain brain access
 */
(function (root) {
  'use strict';

  var Envelope = root.LIMENPatternEnvelope;
  var Broker = root.LIMENPatternBroker;
  var Base = root.LIMENSuperBrainBase;
  if (!Envelope || !Broker || !Base) {
    console.error('[CivilizationSuperBrain] missing dependencies');
    return;
  }

  function CivilizationSuperBrain(options) {
    if (!(this instanceof CivilizationSuperBrain)) {
      return new CivilizationSuperBrain(options);
    }
    options = options || {};
    Base.call(this, 'civilization', 'civilization', Object.assign({
      cycleIntervalMs: 6000
    }, options));
  }
  CivilizationSuperBrain.prototype = Object.create(Base.prototype);
  CivilizationSuperBrain.prototype.constructor = CivilizationSuperBrain;

  // The 20 canonical domains we expect to aggregate.
  var CANONICAL_DOMAINS = [
    'agriculture', 'communication', 'culture', 'defense', 'economy',
    'education', 'energy', 'environment', 'finance', 'governance',
    'industry', 'infrastructure', 'intelligence', 'law', 'medicine',
    'population', 'religion', 'science', 'supplyChain', 'technology'
  ];

  // ── Kernel readout: civilization-scope Thing 2 (phase distribution) ──
  CivilizationSuperBrain.prototype._computeKernels = function (_inputs) {
    var kernels = Envelope.emptyKernels();
    var packets = root.LIMENCivilizationPackets || {};

    // Aggregate stress + phase across domains
    var stressSum = 0;
    var stressCount = 0;
    var phaseDist = {};
    var phaseMax = { phase: null, count: 0 };

    CANONICAL_DOMAINS.forEach(function (d) {
      var p = packets[d];
      if (!p) return;
      if (typeof p.stressScore === 'number') {
        stressSum += p.stressScore;
        stressCount++;
      }
      var phase = p.brainPhase || p.phase || null;
      if (phase) {
        phaseDist[phase] = (phaseDist[phase] || 0) + 1;
        if (phaseDist[phase] > phaseMax.count) {
          phaseMax = { phase: phase, count: phaseDist[phase] };
        }
      }
    });

    var avgStress = stressCount > 0 ? stressSum / stressCount : 0;
    var trajectory = avgStress > 0.55 ? 'ESCALATING' : (avgStress < 0.30 ? 'STABLE' : 'WATCH');

    kernels.thing2 = {
      kernelId: 'civilization-aggregator-v1',
      kernelVersion: '1.0.0',
      dominantPhase: phaseMax.phase,
      phaseConfidence: stressCount > 0 ? Math.min(1, phaseMax.count / Math.max(1, stressCount)) : 0,
      phaseVector: phaseDist,
      stress: clamp(avgStress, 0, 1),
      trajectory: trajectory,
      coupling: {
        mode: 'civilization_aggregated',
        source: 'domain_packet_adapter',
        intrinsic: null,
        coupled: null,
        biasContributions: null
      },
      interpretiveOnly: true
    };

    // Thing 1 — civilization-level not yet validated; pass through.
    kernels.thing1 = {
      kernelId: 'civilization-validated-stub',
      kernelVersion: null,
      validationStatus: 'unavailable',
      alert: null,
      distressBand: null,
      narrativeSafe: ['Civilization-level validated kernel not yet wired.']
    };

    return kernels;
  };

  // ── Pattern projection ─────────────────────────────────────────────
  CivilizationSuperBrain.prototype._computePattern = function (kernels, _inputs) {
    var packets = root.LIMENCivilizationPackets || {};
    var audit   = root.LIMENCrossDomainAuditState || {};
    var handoff = root.LIMENMainBrainHandoffState || {};
    var crossNodeOpps = root.LIMENCrossNodeOpportunityState || {};

    var nodes = {};        // brainNodeId → { weight, role, state, sources[] }
    var bindings = [];     // pointers to other patterns
    var crossDomainAffinities = [];
    var opCounts = {
      patents: 0, grants: 0, investments: 0, sba: 0, franchise: 0, research: 0
    };
    var diagnoses = 0, opportunities = 0;

    // Walk each domain packet
    var activeDomains = 0;
    CANONICAL_DOMAINS.forEach(function (d) {
      var p = packets[d];
      if (!p) return;
      activeDomains++;
      diagnoses += (p.activeDiagnoses ? p.activeDiagnoses.length : 0) +
                    (p.brainDiagnoses ? p.brainDiagnoses.length : 0);
      opportunities += (p.brainOpportunities ? p.brainOpportunities.length : 0);

      // Bindings: each domain pattern is a binding upstream
      bindings.push({
        id: 'domain:' + d,
        kind: 'domain',
        weight: clamp(p.stressScore || 0.1, 0.05, 1),
        sourceSig: p.adapterSig || null
      });

      // Operator hint scan — count opportunity paths if present
      var opps = p.brainOpportunities || [];
      for (var i = 0; i < opps.length; i++) {
        var path = String(opps[i].path || opps[i].type || '').toUpperCase();
        if (path.indexOf('PATENT') !== -1) opCounts.patents++;
        if (path.indexOf('GRANT')  !== -1) opCounts.grants++;
        if (path.indexOf('INVEST') !== -1) opCounts.investments++;
        if (path.indexOf('SBA')    !== -1 || path.indexOf('LOAN') !== -1) opCounts.sba++;
        if (path.indexOf('FRANCH') !== -1) opCounts.franchise++;
        if (path.indexOf('RESEARCH') !== -1) opCounts.research++;
      }
    });

    // Cross-domain audit findings → nodeSharedAffinities → cross-binding hints
    var nsa = audit.nodeSharedAffinities || [];
    for (var j = 0; j < nsa.length; j++) {
      var ent = nsa[j];
      if (!ent || !ent.node) continue;
      nodes[ent.node] = nodes[ent.node] || { weight: 0, role: ent.role || null, state: 'shared', sources: [] };
      nodes[ent.node].weight = Math.min(1, nodes[ent.node].weight + 0.1);
      if (ent.sourceDomain) nodes[ent.node].sources.push(ent.sourceDomain);
    }

    // Handoff lanes → operator readiness signals
    var lanes = handoff.lanes || {};
    function laneReadiness(name) {
      var arr = lanes[name] || [];
      if (!arr.length) return 0;
      var ready = 0;
      for (var k = 0; k < arr.length; k++) if (arr[k].readyForGeneration) ready++;
      return ready / arr.length;
    }

    // Operators block — every level addresses all 9 (fractal rule)
    var operators = Envelope.emptyOperators();
    operators.communication = { readiness: clamp(activeDomains / CANONICAL_DOMAINS.length, 0, 1), salience: 0.3, evidence: 0.5, gateSignal: null };
    operators.reporting     = { readiness: 0.9, salience: 0.4, evidence: 0.9, gateSignal: null };
    operators.auditing      = { readiness: Object.keys(audit).length > 0 ? 1 : 0.2, salience: 0.5, evidence: 0.7, gateSignal: null };
    operators.code          = { readiness: 0, salience: 0, evidence: 0, gateSignal: null }; // civilization doesn't write code
    operators.patents       = { readiness: laneReadiness('patents'), salience: opCounts.patents > 0 ? 0.7 : 0.1, evidence: opCounts.patents / Math.max(1, opportunities), gateSignal: null };
    operators.grants        = { readiness: Math.max(laneReadiness('business-grants'), laneReadiness('research-grants'), laneReadiness('nsf-project-pitch')), salience: opCounts.grants > 0 ? 0.7 : 0.1, evidence: opCounts.grants / Math.max(1, opportunities), gateSignal: null };
    operators.investments   = { readiness: laneReadiness('investments'), salience: opCounts.investments > 0 ? 0.7 : 0.1, evidence: opCounts.investments / Math.max(1, opportunities), gateSignal: null };
    operators.phaseTracking = { readiness: kernels.thing2.dominantPhase ? 1 : 0, salience: 0.6, evidence: 0.8, gateSignal: kernels.thing2.dominantPhase };
    operators.phaseLogic    = { readiness: kernels.thing2.trajectory ? 0.8 : 0.2, salience: 0.4, evidence: 0.7, gateSignal: kernels.thing2.trajectory };

    // Cross-domain affinities — top entries from cross-node opportunity surface
    var cno = (crossNodeOpps && crossNodeOpps.opportunities) || [];
    for (var m = 0; m < Math.min(cno.length, 20); m++) {
      var o = cno[m];
      if (!o || !o.domains) continue;
      crossDomainAffinities.push({
        domain: (o.domains[0] || ''),
        role: o.lanes ? o.lanes.join(',') : '',
        strength: clamp((o.confidence || 0.5) * (o.evidenceQuality || 0.5), 0, 1),
        oppId: o.id || null
      });
    }

    // Salience: blend of average stress + handoff readiness + audit findings
    var totalHandoff = 0;
    Object.keys(lanes).forEach(function (k2) { totalHandoff += (lanes[k2] || []).length; });
    var salience = clamp(
      0.4 * kernels.thing2.stress +
      0.3 * Math.min(1, totalHandoff / 20) +
      0.3 * Math.min(1, (audit.divergences || []).length / 10),
      0, 1);

    return {
      salience: salience,
      operators: operators,
      nodes: nodes,
      bindings: bindings,
      crossDomainAffinities: crossDomainAffinities,
      // civilization doesn't fire engines directly; pending artifacts come
      // from the master brain. Drain any that the runner left for us.
      artifacts: this._drainPendingArtifacts(),
      // Extra metadata for UI consumption
      _meta: {
        activeDomains: activeDomains,
        totalDiagnoses: diagnoses,
        totalOpportunities: opportunities,
        opCounts: opCounts,
        handoffPackets: totalHandoff,
        auditFindings: Object.keys(audit).length
      }
    };
  };

  // Civilization doesn't fire engines — the master brain does. This stays empty.
  CivilizationSuperBrain.prototype._decideEngines = function (_envelope) {
    return [];
  };

  function clamp(n, lo, hi) {
    n = +n;
    if (!isFinite(n)) return 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  root.LIMENCivilizationSuperBrain = CivilizationSuperBrain;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
