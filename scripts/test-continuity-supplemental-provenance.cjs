'use strict';

// Execute the existing optional loaders/builders with local HTTP fixtures, then
// pass their resulting state into the actual read-only observatory. No brain
// constructor, governor, motor, provider, or packet builder is executed here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { JSDOM } = require('jsdom');

const profiles = [
  ['agriculture', '_loadAgricultureCropCycleLayer', '_buildAgricultureCropCycleLayer', 'cropCycleLayer', 'empty', ['_inferCropCyclePhase']],
  ['communication', '_loadCommunicationNetworkLayer', '_buildCommunicationNetworkLayer', 'networkLayer', 'empty'],
  ['culture', '_loadCultureSceneLayer', '_buildCultureSceneLayer', 'sceneLayer', 'empty'],
  ['defense', '_loadDefenseSublayer', '_buildDefenseReadinessSublayer', 'readinessPostureLayer', 'empty'],
  ['economy', '_loadMacroRegimeSublayer', '_buildMacroRegimeSublayer', 'macroRegimeSublayer', 'empty', ['_inferBusinessCyclePhase']],
  ['education', '_loadLearningOutcomesLayer', '_buildLearningOutcomesLayer', 'learningOutcomesLayer', 'hand-authored', ['_handAuthoredLearningOutcomes']],
  ['environment', '_loadClimateRiskSublayer', '_buildClimateRiskLayer', 'climateRiskLayer', 'hand-authored'],
  ['finance', '_loadFinanceSublayer', '_buildFinanceSublayer', 'creditSublayer', 'empty'],
  ['governance', '_loadGovernanceInstitutionalIntegritySublayer', '_buildGovernanceInstitutionalIntegritySublayer', 'governanceInstitutionalIntegrityLayer', 'empty'],
  ['industry', '_loadProductionCapacityLayer', '_buildProductionCapacityLayer', 'productionCapacityLayer', 'hand-authored', ['_handAuthoredProductionCapacity']],
  ['infrastructure', '_infraLoadGridDiagnoses', '_infraBuildGridLayer', 'gridLayer', 'empty'],
  ['intelligence', '_loadIntelligenceSublayer', '_buildIntelligenceCollectionPostureLayer', 'intelligenceCollectionPostureLayer', 'empty'],
  ['law', '_loadLawRuleOfLawSublayer', '_buildLawRuleOfLawSublayer', 'lawRuleOfLawLayer', 'interpretive'],
  ['medicine', '_loadClinicalPipelineDiagnoses', '_buildClinicalPipelineLayer', 'clinicalPipelineLayer', 'empty'],
  ['religion', '_loadAffiliationVitality', '_buildReligionAffiliationLayer', 'affiliationLayer', 'empty'],
  ['science', '_loadResearchDiscoveryPipeline', '_buildResearchDiscoveryLayer', '_discoveryPipelineCache', 'empty'],
  ['technology', '_loadInnovationPipelineLayer', '_buildTechnologyInnovationLayer', 'innovationLayer', 'empty'],
  ['trade', '_loadTradeFreightFlows', '_buildFreightFlowLayer', 'freightFlowLayer', 'hand-authored']
];
const constants = ['ENV_CLIMATE_RISK_DX', 'FREIGHT_FLOW_DIAGNOSES', 'RELIGION_SOURCES', 'RELIGION_AFFILIATION_CATEGORIES'];
const aliases = { trade: 'supplyChain', medicine: 'health', science: 'research' };

async function runConsumer(profile, useExistingFiles) {
  const [domain, loader, builder, field, expected, extra = []] = profile;
  const file = `assets/js/domain-brains/${domain}-brain.js`;
  const source = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true });
  const methods = new Map(), declarations = [];
  walk.simple(ast, {
    AssignmentExpression(node) {
      const left = node.left;
      if (left.type === 'MemberExpression' && left.object.type === 'MemberExpression' &&
          left.object.property.name === 'prototype' && node.right.type === 'FunctionExpression') {
        methods.set(left.property.name, node);
      }
    },
    VariableDeclarator(node) {
      if (constants.includes(node.id.name)) declarations.push('var ' + source.slice(node.start, node.end) + ';');
    }
  });
  const calls = [], inputs = [];
  const context = vm.createContext({ fetch: async url => {
    assert.match(url, /^\/assets\/data\//, 'Only a local data fixture is allowed');
    calls.push(url);
    if (useExistingFiles && fs.existsSync('.' + url)) {
      const bytes = fs.readFileSync('.' + url);
      inputs.push({ path: url, status: 200, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex') });
      return { ok: true, status: 200, json: async () => JSON.parse(bytes.toString('utf8')) };
    }
    inputs.push({ path: url, status: 404, sourceSha256: null });
    return { ok: false, status: 404, json: async () => { throw Error('404 body must not be read'); } };
  } });
  vm.runInContext(declarations.join('\n'), context);
  const canonicalDiagnoses = [{ id: 'canonical-fixture-marker', active: false }];
  const canonicalOpportunities = [{ id: 'canonical-opportunity-marker' }];
  const consumer = {
    state: { diagnoses: canonicalDiagnoses, opportunities: canonicalOpportunities },
    _activeConditions: [], diagnosisIndex: {},
    _resolveCanonicalEnvironmentDiagnosis(id) { return { canonicalDiagnosisId: id }; }
  };
  // DDP work is intentionally outside this test. Builders contain their own
  // try/catch around the absent method; no substitute packet is injected.
  for (const name of [loader, builder, ...extra]) {
    const node = methods.get(name);
    assert.ok(node, `${domain}: actual method ${name} exists`);
    consumer[name] = vm.runInContext('(' + source.slice(node.right.start, node.right.end) + ')', context);
  }
  await consumer[loader]();
  consumer[builder]();
  assert.equal(consumer.state.diagnoses, canonicalDiagnoses, 'Supplemental build preserves canonical diagnosis array');
  assert.equal(consumer.state.opportunities, canonicalOpportunities, 'Supplemental build preserves canonical opportunity array');
  const layer = consumer.state[field];
  assert.ok(layer, `${domain}: existing layer output`);
  if (!useExistingFiles) {
    assert.equal(layer.loaded, expected !== 'empty', `${domain}: absence behavior`);
    if (expected === 'empty') assert.equal(layer.count, 0);
    if (expected === 'hand-authored') assert.ok(layer.count > 0);
  }
  return { domain, field, expectedAll404: expected, mode: useExistingFiles ? 'existing-local-files' : 'all-404',
    file, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    loaderLine: methods.get(loader).loc.start.line, builderLine: methods.get(builder).loc.start.line,
    calls, inputs, layer: JSON.parse(JSON.stringify(layer)), state: consumer.state };
}

async function checkObservatory(rows) {
  const el = { innerHTML: '' }, listeners = {}, brains = {};
  rows.forEach(row => { brains[aliases[row.domain] || row.domain] = { state: row.state }; });
  const before = JSON.stringify(brains);
  const window = { LIMENDomainBrains: { getAll: () => brains }, addEventListener(name, cb) { listeners[name] = cb; } };
  const document = { readyState: 'loading', addEventListener() {}, getElementById: id => id === 'execution-observatory' ? el : null };
  const requests = [];
  const context = vm.createContext({ window, document, fetch: async url => {
    requests.push(url);
    assert.ok(['/api/brain-cognition', '/api/limen-autofire-log?limit=50'].includes(url), 'Only existing read endpoints');
    return { ok: true, json: async () => ({ cognition: {}, count: 0, cycles: [] }) };
  }, setInterval() { throw Error('Manual refresh must not start a timer'); } });
  vm.runInContext(fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8'), context);
  await window.LIMENExecutionObservatory.refresh();
  assert.deepEqual(requests, ['/api/brain-cognition', '/api/limen-autofire-log?limit=50']);
  assert.doesNotMatch(el.innerHTML, /read failure:/, 'Fixture refresh must actually succeed');
  const dom = new JSDOM(el.innerHTML);
  for (const row of rows) {
    const details = dom.window.document.querySelector(`[data-supplemental-domain="${row.domain}"]`);
    assert.ok(details, `${row.domain}: supplemental provenance must reach rendered operator card`);
    assert.ok(details.textContent.includes(row.field), 'Rendered state location');
    assert.ok(details.textContent.includes(row.layer.note), 'Preserve the actual explanatory note');
    for (const dataPath of row.calls) assert.ok(details.textContent.includes(dataPath), 'Configured paths must match actual loader requests');
    assert.match(details.textContent, /source freshness unverified/i);
    const summary = details.querySelector('summary').textContent;
    if (row.layer.loaded === false) assert.match(summary, /DATA UNAVAILABLE/);
    if (row.domain === 'law') assert.match(summary, /INTERPRETIVE/);
    if (['education', 'industry', 'trade', 'environment'].includes(row.domain)) assert.match(summary, /HAND AUTHORED/);
    const card = details.closest('article');
    assert.match(card.querySelector('.exo-domain-head').textContent, /UNOBSERVED/, 'Browser layer cannot establish business readiness');
    for (const item of [...card.querySelectorAll('.exo-chain-item')].slice(3)) {
      assert.match(item.textContent, /UNOBSERVED/, 'Browser layer cannot establish decision, receipt, observation or revenue');
    }
  }
  assert.equal(requests.length, 2, 'Projection adds no requests');
  assert.equal(JSON.stringify(brains), before, 'Projection does not mutate browser state');
  dom.window.close();
  // A later absence and unsafe source text must replace the prior readout.
  brains.industry.state.productionCapacityLayer = { loaded: false, note: '<script>unsafe-source</script>' };
  brains.education.state.learningOutcomesLayer = null;
  await window.LIMENExecutionObservatory.refresh();
  const later = new JSDOM(el.innerHTML);
  const industry = later.window.document.querySelector('[data-supplemental-domain="industry"]');
  assert.match(industry.textContent, /DATA UNAVAILABLE/);
  assert.equal(industry.querySelector('script'), null, 'Notes must be escaped');
  assert.match(industry.textContent, /<script>unsafe-source<\/script>/);
  assert.match(later.window.document.querySelector('[data-supplemental-domain="education"]').textContent, /NOT REPORTED/);
  later.window.close();
  for (const [layer, expected] of [
    [{ loaded: true, sourceMode: 'file' }, 'FILE SOURCED / UNVERIFIED'],
    [{ loaded: true }, 'SOURCE UNVERIFIED'],
    [{ sourceMode: 'file' }, 'STATE UNVERIFIED'],
    [[], 'NOT REPORTED']
  ]) {
    brains.industry.state.productionCapacityLayer = layer;
    await window.LIMENExecutionObservatory.refresh();
    const view = new JSDOM(el.innerHTML);
    assert.ok(view.window.document.querySelector('[data-supplemental-domain="industry"] summary').textContent.includes(expected));
    view.window.close();
  }
}

(async () => {
  const rows = [];
  for (const profile of profiles) {
    for (const local of [false, true]) rows.push(await runConsumer(profile, local));
    console.log(`PASS ${profile[0]}: actual loader/builders, all-404 and existing-file fixture, canonical arrays unchanged`);
  }
  const missing = JSON.parse(fs.readFileSync('docs/audits/continuity-nonbranch-consumer-review-20261001.json')).rows;
  const requested = new Set(rows.flatMap(row => row.calls));
  assert.equal(missing.filter(row => requested.has(row.path)).length, 26, 'Cover all 26 missing brain-loader paths');
  const substrate = require('../assets/js/agriculture-neuro-substrate.js');
  assert.equal(substrate.validateIncompleteCircuit({ id: 'fixture', circuits: [{ nodeId: 'vmPFC' }] }).verdict, 'complete');
  await assert.rejects(substrate.getSubstrate(), /ENOENT/, 'Missing substrate JSON is distinct from the synchronous validator');
  console.log('PASS substrate: actual synchronous validator works; missing JSON API rejects honestly; all 27 missing references covered');
  await checkObservatory(rows.filter(row => row.mode === 'all-404'));
  console.log('PASS observatory: 18 consumer readouts, owning state paths, provenance, no authority, escaping, replacement, no new requests/writes');
  if (process.argv.includes('--write-evidence')) {
    fs.writeFileSync('docs/audits/continuity-supplemental-provenance-20261001.json', JSON.stringify({
      level: 'LOCAL/FIXTURE', networkCalls: 0, brainConstructorExecuted: false, packetBuilderExecuted: false,
      governorOrMotorExecuted: false, complete: false, rows: rows.map(({ state, ...row }) => row)
    }, null, 2) + '\n');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
