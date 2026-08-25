'use strict';

/**
 * Read-only Energy-reference parity ledger for the 20 product brains.
 *
 * "Same brain" means the same required physiology and lifecycle, not copied
 * domain knowledge or one shared authority. This report separates existing
 * implementation, domain-owned activation, and external authorization.
 */

var fs = require('node:fs');
var path = require('node:path');
var ProductAudit = require('./product-domain-brain-audit.js');

var ROOT = path.join(__dirname, '..');
var BRAIN_DIR = path.join(ROOT, 'assets', 'js', 'domain-brains');
var BASE_FILE = path.join(BRAIN_DIR, 'domain-brain-base.js');

function has(source, text) { return source.indexOf(text) >= 0; }

function genericFoundation(base) {
  return {
    recurrentPlasticity: has(base, 'DomainBrainBase.prototype._computeDomainPlasticity = function'),
    activeInference: has(base, 'DomainBrainBase.prototype._computeGenericActiveInference = function'),
    interoception: has(base, 'DomainBrainBase.prototype._computeGenericInteroception = function'),
    phasePerception: has(base, 'DomainBrainBase.prototype._computeGenericPhasePercept = function'),
    resourceMetabolism: has(base, 'DomainBrainBase.prototype._computeResourceMetabolism = function'),
    motorReadiness: has(base, 'DomainBrainBase.prototype._computeMotorReadiness = function'),
    emissionQueue: has(base, 'DomainBrainBase.prototype._computeGenericEmissionQueue = function'),
    autonomousInternalEmission: has(base, 'DomainBrainBase.prototype._runGenericAutonomousEmission = function'),
    defaultPlasticityArm: has(base, 'this._actuation.plasticityLive = true'),
    defaultRecencyTrustArm: has(base, 'this._actuation.recencyTrustLive = true'),
    defaultMetaplasticityArm: has(base, 'this._actuation.metaplasticityLive = true')
  };
}

function customEnergyFoundation(source) {
  return {
    recurrentPlasticity: has(source, 'EnergyBrain.prototype._computeEnergyPlasticity = function'),
    activeInference: has(source, 'EnergyBrain.prototype._computeEnergyActiveInference = function'),
    interoception: has(source, 'EnergyBrain.prototype._computeEnergyInteroception = function'),
    phasePerception: has(source, 'EnergyBrain.prototype._computeEnergyPhasePercept = function'),
    resourceMetabolism: true,
    motorReadiness: true,
    emissionQueue: has(source, 'EnergyBrain.prototype._computeEnergyEmissionQueue = function'),
    autonomousInternalEmission: has(source, 'EnergyBrain.prototype._runEnergyAutonomousEmission = function'),
    actionOutcomeFeedback: has(source, 'EnergyBrain.prototype._refreshExternalOutcome = function') &&
      has(source, 'this._refreshExternalOutcome();')
  };
}

/*
 * Domain-local depth is intentionally stricter than inherited availability.
 * A generic base port proves that an organ can run; it does not prove the
 * domain owns Energy-level implementation depth in its own brain file.
 * Phase perception is excluded from this ledger while that work is paused.
 */
function methodNames(source, namePattern) {
  var expression = new RegExp('(?:[A-Za-z][A-Za-z0-9_]*Brain\\.prototype|P)\\.(' + namePattern + ')\\s*=\\s*function', 'g');
  var names = [];
  var match;
  while ((match = expression.exec(source)) !== null) names.push(match[1]);
  return names;
}

function methodEvidence(source, namePattern, lifecycleSlot) {
  var names = methodNames(source, namePattern);
  var directlyInvoked = names.some(function (name) {
    return new RegExp('this\\.' + name.replace(/[$]/g, '\\$&') + '\\s*\\(').test(source);
  });
  var routedToLifecycle = !!lifecycleSlot && names.some(function (name) {
    return new RegExp('prototype\\.' + lifecycleSlot + '\\s*=\\s*[A-Za-z][A-Za-z0-9_]*Brain\\.prototype\\.' + name.replace(/[$]/g, '\\$&')).test(source);
  });
  return {
    defined: names.length > 0,
    methods: names,
    directlyInvoked: directlyInvoked,
    routedToLifecycle: routedToLifecycle,
    implementedAndWired: names.length > 0 && (directlyInvoked || routedToLifecycle)
  };
}

function brainV2LocalFoundation(source) {
  var organs = {
    afference: methodEvidence(source, '_compute[A-Za-z0-9_$]*Afferent'),
    gainControl: methodEvidence(source, '_compute[A-Za-z0-9_$]*GainControl'),
    slowConsolidation: methodEvidence(source, '_(?:compute|consolidate)[A-Za-z0-9_$]*SlowModel'),
    outcomeSelfConsistency: methodEvidence(source, '_score[A-Za-z0-9_$]*Outcomes'),
    perceptionDepth: methodEvidence(source, '_compute[A-Za-z0-9_$]*PerceptionDepth'),
    attention: methodEvidence(source, '_compute[A-Za-z0-9_$]*Attention'),
    inhibition: methodEvidence(source, '_compute[A-Za-z0-9_$]*Inhibition'),
    homeostasis: methodEvidence(source, '_compute[A-Za-z0-9_$]*Homeostasis'),
    assembly: methodEvidence(source, '_compute[A-Za-z0-9_$]*NeuroLayers')
  };
  return organs;
}

function domainLocalFoundation(source) {
  var evidence = {
    recurrentPlasticity: methodEvidence(source, '_compute[A-Za-z0-9_$]*Plasticity', '_computeDomainPlasticity'),
    activeInference: methodEvidence(source, '_compute[A-Za-z0-9_$]*ActiveInference', '_computeGenericActiveInference'),
    interoception: methodEvidence(source, '_compute[A-Za-z0-9_$]*Interoception', '_computeGenericInteroception'),
    emissionQueue: methodEvidence(source, '_compute[A-Za-z0-9_$]*EmissionQueue', '_computeGenericEmissionQueue'),
    autonomousInternalEmission: methodEvidence(source, '_run[A-Za-z0-9_$]*AutonomousEmission', '_runGenericAutonomousEmission'),
    actionOutcomeFeedback: methodEvidence(source, '_refresh[A-Za-z0-9_$]*ActionOutcome')
  };
  var implemented = {};
  Object.keys(evidence).forEach(function (name) { implemented[name] = evidence[name].implementedAndWired; });
  return { implemented: implemented, evidence: evidence };
}

function allTrue(value, names) {
  return names.every(function (name) { return value[name] === true; });
}

function audit() {
  var product = ProductAudit.audit();
  var baseSource = fs.readFileSync(BASE_FILE, 'utf8');
  var generic = genericFoundation(baseSource);
  var required = [
    'recurrentPlasticity', 'activeInference', 'interoception', 'phasePerception',
    'resourceMetabolism', 'motorReadiness', 'emissionQueue', 'autonomousInternalEmission',
    'actionOutcomeFeedback'
  ];

  var domains = product.domains.map(function (row) {
    var source = fs.readFileSync(path.join(BRAIN_DIR, row.product + '-brain.js'), 'utf8');
    var energy = row.product === 'energy';
    var local = domainLocalFoundation(source);
    if (energy) {
      local.evidence.actionOutcomeFeedback = methodEvidence(source, '_refreshExternalOutcome');
      local.implemented.actionOutcomeFeedback = local.evidence.actionOutcomeFeedback.implementedAndWired;
    }
    var localImplementation = local.implemented;
    var localRequired = [
      'recurrentPlasticity', 'activeInference', 'interoception',
      'emissionQueue', 'autonomousInternalEmission', 'actionOutcomeFeedback'
    ];
    var brainV2 = brainV2LocalFoundation(source);
    var brainV2Required = Object.keys(brainV2);
    var localComplete = allTrue(localImplementation, localRequired);
    var implementation = energy ? customEnergyFoundation(source) : localComplete ? {
      recurrentPlasticity: localImplementation.recurrentPlasticity,
      activeInference: localImplementation.activeInference,
      interoception: localImplementation.interoception,
      phasePerception: generic.phasePerception,
      resourceMetabolism: generic.resourceMetabolism && row.parts.resourceMetabolism,
      motorReadiness: generic.motorReadiness && row.parts.motorReadiness,
      emissionQueue: localImplementation.emissionQueue,
      autonomousInternalEmission: localImplementation.autonomousInternalEmission,
      actionOutcomeFeedback: localImplementation.actionOutcomeFeedback
    } : {
      recurrentPlasticity: generic.recurrentPlasticity,
      activeInference: generic.activeInference,
      interoception: generic.interoception,
      phasePerception: generic.phasePerception,
      resourceMetabolism: generic.resourceMetabolism && row.parts.resourceMetabolism,
      motorReadiness: generic.motorReadiness && row.parts.motorReadiness,
      emissionQueue: generic.emissionQueue,
      autonomousInternalEmission: generic.autonomousInternalEmission,
      actionOutcomeFeedback: false
    };
    var flags = row.authority.flags || {};
    var phaseActuation = flags.phase === true;
    var phasePerceptArmed = flags.phasePercept === true;
    var plasticityArmed = energy ? flags.plasticityLive === true : generic.defaultPlasticityArm;
    var recencyTrustArmed = energy ? flags.recencyTrustLive === true : generic.defaultRecencyTrustArm;
    var metaplasticityArmed = energy ? flags.metaplasticityLive === true : generic.defaultMetaplasticityArm;
    var external = row.resourceAuthority.externalAction === true && row.motorAuthority.external === true &&
      row.motorAuthority.executorVerified === true && row.motorAuthority.outcomeObserverVerified === true;
    var activationGaps = [];
    if (!phaseActuation) activationGaps.push('domain-phase-actuation-inhibited');
    if (!phasePerceptArmed) activationGaps.push('phase-percept-not-armed');
    if (!plasticityArmed) activationGaps.push('plasticity-not-armed');
    if (!recencyTrustArmed) activationGaps.push('recency-trust-not-armed');
    if (!metaplasticityArmed) activationGaps.push('metaplasticity-not-armed');
    var outwardGaps = [];
    if (row.resourceAuthority.externalAction !== true) outwardGaps.push('external-resource-switch-off');
    if (row.motorAuthority.external !== true) outwardGaps.push('external-motor-switch-off');
    if (row.motorAuthority.executorVerified !== true) outwardGaps.push('production-executor-unverified');
    if (row.motorAuthority.outcomeObserverVerified !== true) outwardGaps.push('independent-outcome-observer-unverified');
    return {
      productDomain: row.product,
      runtimeOwner: row.runtime,
      implementationMode: energy ? 'energy-custom-reference' : (localComplete ? 'domain-local-extension' : 'generic-port-plus-domain-specialization'),
      separateBrainFile: row.file,
      commonPhysiologyImplemented: allTrue(implementation, required),
      implementation: implementation,
      domainLocalDepthComplete: allTrue(localImplementation, localRequired),
      domainLocalImplementation: localImplementation,
      domainLocalEvidence: local.evidence,
      domainLocalDepthGaps: localRequired.filter(function (name) { return localImplementation[name] !== true; })
        .map(function (name) { return 'domain-local-' + name + '-missing'; }),
      brainV2LocalSpineComplete: brainV2Required.every(function (name) { return brainV2[name].implementedAndWired; }),
      brainV2LocalSpine: brainV2,
      brainV2LocalSpineGaps: brainV2Required.filter(function (name) { return !brainV2[name].implementedAndWired; }),
      activation: {
        phaseActuation: phaseActuation,
        phasePerceptArmed: phasePerceptArmed,
        plasticityArmed: plasticityArmed,
        recencyTrustArmed: recencyTrustArmed,
        metaplasticityArmed: metaplasticityArmed
      },
      activationGaps: activationGaps,
      externalAutonomyReady: external,
      outwardGaps: outwardGaps,
      lane: row.motorAuthority.lane,
      note: energy
        ? 'custom reference implementation; domain authority remains inhibited externally'
        : (localComplete
          ? 'five extension organs are implemented and lifecycle-routed inside this domain brain; state and authority remain domain-owned'
          : 'generic physiology is available, but inherited availability does not count as Energy-level domain-local depth')
    };
  });

  return {
    schemaVersion: 'product-domain-energy-parity-audit/1.3',
    measuredAt: new Date().toISOString(),
    referenceDomain: 'energy',
    semantics: {
      sameBrain: 'same required physiology and lifecycle with separate state and authority',
      caughtUpToEnergy: 'required organs implemented inside the owning domain brain rather than counted only through inherited generic ports',
      notClaimed: 'byte-for-byte identity, identical domain knowledge, phase activation, or external autonomy'
    },
    referencePosture: {
      recurrentPlasticity: 'SHADOW_OR_OUTCOME_GATED',
      activeInference: 'SHADOW_ADVISORY_NO_LIVE_CONSUMER',
      interoception: 'OBSERVE_ONLY',
      emission: 'INTERNAL_RESEARCH_ONLY_OR_CAPITAL_STAGED',
      outcome: 'DOMAIN_LOCAL_ACTION_OUTCOME_INPUT_PRESENT; SOURCE_ELIGIBILITY_REMAINS_DOMAIN_SPECIFIC',
      externalAuthority: 'INHIBITED'
    },
    summary: {
      separateBrains: domains.length,
      commonPhysiologyImplemented: domains.filter(function (d) { return d.commonPhysiologyImplemented; }).length,
      brainV2LocalSpineComplete: domains.filter(function (d) { return d.brainV2LocalSpineComplete; }).length,
      domainLocalDepthComplete: domains.filter(function (d) { return d.domainLocalDepthComplete; }).length,
      energyCustomImplementations: domains.filter(function (d) { return d.implementationMode === 'energy-custom-reference'; }).length,
      domainLocalExtensionImplementations: domains.filter(function (d) { return d.implementationMode === 'domain-local-extension'; }).length,
      genericPortImplementations: domains.filter(function (d) { return d.implementationMode === 'generic-port-plus-domain-specialization'; }).length,
      phaseActuationEnabled: domains.filter(function (d) { return d.activation.phaseActuation; }).length,
      phasePerceptArmed: domains.filter(function (d) { return d.activation.phasePerceptArmed; }).length,
      plasticityArmed: domains.filter(function (d) { return d.activation.plasticityArmed; }).length,
      externalAutonomyReady: domains.filter(function (d) { return d.externalAutonomyReady; }).length
    },
    neurologistReviewQueue: domains.filter(function (d) {
      return d.activationGaps.indexOf('domain-phase-actuation-inhibited') >= 0 ||
        d.activationGaps.indexOf('phase-percept-not-armed') >= 0;
    }).map(function (d) { return { domain: d.productDomain, gaps: d.activationGaps }; }),
    businessExecutionQueue: domains.filter(function (d) { return !d.externalAutonomyReady; }).map(function (d) {
      return { domain: d.productDomain, lane: d.lane, gaps: d.outwardGaps };
    }),
    domainLocalRepairQueue: domains.filter(function (d) { return !d.domainLocalDepthComplete; }).map(function (d) {
      return { domain: d.productDomain, brainFile: d.separateBrainFile, gaps: d.domainLocalDepthGaps };
    }),
    domains: domains
  };
}

module.exports = {
  audit: audit,
  genericFoundation: genericFoundation,
  methodEvidence: methodEvidence,
  brainV2LocalFoundation: brainV2LocalFoundation,
  domainLocalFoundation: domainLocalFoundation
};
