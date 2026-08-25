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
    autonomousInternalEmission: has(source, 'EnergyBrain.prototype._runEnergyAutonomousEmission = function')
  };
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
    'resourceMetabolism', 'motorReadiness', 'emissionQueue', 'autonomousInternalEmission'
  ];

  var domains = product.domains.map(function (row) {
    var source = fs.readFileSync(path.join(BRAIN_DIR, row.product + '-brain.js'), 'utf8');
    var energy = row.product === 'energy';
    var implementation = energy ? customEnergyFoundation(source) : {
      recurrentPlasticity: generic.recurrentPlasticity,
      activeInference: generic.activeInference,
      interoception: generic.interoception,
      phasePerception: generic.phasePerception,
      resourceMetabolism: generic.resourceMetabolism && row.parts.resourceMetabolism,
      motorReadiness: generic.motorReadiness && row.parts.motorReadiness,
      emissionQueue: generic.emissionQueue,
      autonomousInternalEmission: generic.autonomousInternalEmission
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
      implementationMode: energy ? 'energy-custom-reference' : 'generic-port-plus-domain-specialization',
      separateBrainFile: row.file,
      commonPhysiologyImplemented: allTrue(implementation, required),
      implementation: implementation,
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
        : 'same required physiology through the base port; domain-specialized cognition and authority remain separate'
    };
  });

  return {
    schemaVersion: 'product-domain-energy-parity-audit/1.0',
    measuredAt: new Date().toISOString(),
    referenceDomain: 'energy',
    semantics: {
      sameBrain: 'same required physiology and lifecycle with separate state and authority',
      notClaimed: 'byte-for-byte identity, identical domain knowledge, identical activation, or external autonomy'
    },
    summary: {
      separateBrains: domains.length,
      commonPhysiologyImplemented: domains.filter(function (d) { return d.commonPhysiologyImplemented; }).length,
      energyCustomImplementations: domains.filter(function (d) { return d.implementationMode === 'energy-custom-reference'; }).length,
      genericPortImplementations: domains.filter(function (d) { return d.implementationMode !== 'energy-custom-reference'; }).length,
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
    domains: domains
  };
}

module.exports = { audit: audit, genericFoundation: genericFoundation };
