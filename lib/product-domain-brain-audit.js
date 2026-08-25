/**
 * Read-only audit of the product-layer domain brains.
 *
 * This intentionally does not inspect brain-v2/kernel or its binders. The
 * product brains live in assets/js/domain-brains and execute in the browser.
 */

'use strict';

var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var BRAIN_DIR = path.join(ROOT, 'assets', 'js', 'domain-brains');

var DOMAINS = [
  { product: 'agriculture', runtime: 'agriculture' },
  { product: 'communication', runtime: 'communication' },
  { product: 'culture', runtime: 'culture' },
  { product: 'defense', runtime: 'defense' },
  { product: 'economy', runtime: 'economy' },
  { product: 'education', runtime: 'education' },
  { product: 'energy', runtime: 'energy' },
  { product: 'environment', runtime: 'environment' },
  { product: 'finance', runtime: 'finance' },
  { product: 'governance', runtime: 'governance' },
  { product: 'industry', runtime: 'industry' },
  { product: 'infrastructure', runtime: 'infrastructure' },
  { product: 'intelligence', runtime: 'intelligence' },
  { product: 'law', runtime: 'law' },
  { product: 'medicine', runtime: 'health' },
  { product: 'population', runtime: 'population' },
  { product: 'religion', runtime: 'religion' },
  { product: 'science', runtime: 'research' },
  { product: 'technology', runtime: 'technology' },
  { product: 'trade', runtime: 'supplyChain' }
];

var REQUIRED_PARTS = [
  'separateFile', 'baseConstructed', 'cycleOverride', 'diagnosisIndex',
  'emissionRules', 'authoritySurface', 'homeostasis', 'neuroLayers',
  'afference', 'attention', 'inhibition', 'businessLayer',
  'cortexRetrieval', 'refreshController', 'resourceMetabolism'
];

function firstMatch(source, expression) {
  var match = expression.exec(source);
  return match ? match[1] : null;
}

function authority(source) {
  var body = firstMatch(source, /this\._actuation\s*=\s*\{([^}]+)\}/);
  if (!body) return { present: false, flags: {} };
  var flags = {};
  var matches = body.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:\s*(true|false)/g);
  for (var match of matches) flags[match[1]] = match[2] === 'true';
  return { present: true, flags: flags };
}

function resourceAuthority(source) {
  var body = firstMatch(source, /this\.resourceAuthority\s*=\s*\{([^;]+)\};/);
  if (!body) return { present: false, ownerDomain: null, policyId: null, externalAction: null };
  return {
    present: true,
    ownerDomain: firstMatch(body, /ownerDomain\s*:\s*['"]([^'"]+)['"]/),
    policyId: firstMatch(body, /policyId\s*:\s*['"]([^'"]+)['"]/),
    externalAction: firstMatch(body, /externalAction\s*:\s*(true|false)/) === 'true'
  };
}

function hasDomainMethod(source, suffix) {
  return new RegExp('_compute[A-Za-z0-9_$]*' + suffix + '\\s*=\\s*function').test(source);
}

function inspect(descriptor) {
  var product = descriptor.product;
  var brainFile = path.join(BRAIN_DIR, product + '-brain.js');
  var exists = fs.existsSync(brainFile);
  var source = exists ? fs.readFileSync(brainFile, 'utf8') : '';
  var ctor = firstMatch(source, /function\s+([A-Za-z][A-Za-z0-9_]*Brain)\s*\(/);
  var runtime = firstMatch(source, /domainId\s*:\s*['"]([^'"]+)['"]/);
  var ownAuthority = authority(source);
  var ownResource = resourceAuthority(source);
  var businessLayer = source.indexOf('assets/js/' + product + '-node-business-engine.js') >= 0 &&
    source.indexOf('assets/js/' + product + '-business-review.js') >= 0;
  var cortex = path.join(BRAIN_DIR, product + '-cortex-retrieval.js');
  var refresh = path.join(BRAIN_DIR, product + '-refresh-controller.js');

  var parts = {
    separateFile: exists && source.length > 0,
    baseConstructed: /Base\.call\(this\s*,/.test(source) && /Object\.create\(Base\.prototype\)/.test(source),
    cycleOverride: !!ctor && new RegExp(ctor + '\\.prototype\\.cycle\\s*=\\s*function').test(source),
    diagnosisIndex: /this\.diagnosisIndex\s*=\s*\{/.test(source),
    emissionRules: /this\.emissionRules\s*=\s*\[/.test(source),
    authoritySurface: ownAuthority.present,
    homeostasis: hasDomainMethod(source, 'Homeostasis'),
    neuroLayers: hasDomainMethod(source, 'NeuroLayers'),
    afference: hasDomainMethod(source, 'Afferent'),
    attention: hasDomainMethod(source, 'Attention'),
    inhibition: hasDomainMethod(source, 'Inhibition'),
    businessLayer: businessLayer,
    cortexRetrieval: fs.existsSync(cortex),
    refreshController: fs.existsSync(refresh),
    resourceMetabolism: ownResource.present && ownResource.ownerDomain === descriptor.runtime && !!ownResource.policyId
  };

  /* Authority parity: a part is present when the domain has an implementation
     or explicitly inhibits that authority. Missing code plus true authority is
     a structural gap; false authority is an explicit gate, not a missing brain. */
  var servoMethod = hasDomainMethod(source, 'Servo');
  var phaseMethod = /_compute[A-Za-z0-9_$]*Phase(?:Dynamics|Advisory|Percept)\s*=\s*function/.test(source);
  var servoFlag = ownAuthority.flags.servo;
  var phaseFlag = ownAuthority.flags.phase;
  var authorityParity = {
    servo: { authorized: servoFlag === true, implemented: servoMethod, explicitInhibition: servoFlag === false },
    phase: { authorized: phaseFlag === true, implemented: phaseMethod, explicitInhibition: phaseFlag === false },
    refractory: { authorized: ownAuthority.flags.refractory === true, explicitInhibition: ownAuthority.flags.refractory === false },
    eiBrake: { authorized: ownAuthority.flags.eiBrake === true, explicitInhibition: ownAuthority.flags.eiBrake === false }
  };
  authorityParity.servo.valid = authorityParity.servo.implemented || authorityParity.servo.explicitInhibition;
  authorityParity.phase.valid = authorityParity.phase.implemented || authorityParity.phase.explicitInhibition;
  authorityParity.refractory.valid = typeof ownAuthority.flags.refractory === 'boolean';
  authorityParity.eiBrake.valid = typeof ownAuthority.flags.eiBrake === 'boolean';

  var missing = REQUIRED_PARTS.filter(function (name) { return parts[name] !== true; });
  var authorityGaps = Object.keys(authorityParity).filter(function (name) { return !authorityParity[name].valid; });
  return {
    product: product,
    runtime: runtime,
    expectedRuntime: descriptor.runtime,
    identityMatches: runtime === descriptor.runtime,
    file: path.relative(ROOT, brainFile).replace(/\\/g, '/'),
    bytes: Buffer.byteLength(source, 'utf8'),
    constructor: ctor,
    parts: parts,
    authority: { flags: ownAuthority.flags, parity: authorityParity },
    resourceAuthority: ownResource,
    coreComplete: missing.length === 0 && runtime === descriptor.runtime,
    missing: missing,
    authorityGaps: authorityGaps
  };
}

function audit() {
  var domains = DOMAINS.map(inspect);
  return {
    schemaVersion: 'product-domain-brain-audit/1.0',
    measuredAt: new Date().toISOString(),
    layer: 'assets/js/domain-brains',
    requiredParts: REQUIRED_PARTS.slice(),
    coreComplete: domains.filter(function (row) { return row.coreComplete; }).length,
    authorityParityComplete: domains.filter(function (row) { return row.authorityGaps.length === 0; }).length,
    domains: domains
  };
}

module.exports = { DOMAINS: DOMAINS.slice(), REQUIRED_PARTS: REQUIRED_PARTS.slice(), inspect: inspect, audit: audit };
