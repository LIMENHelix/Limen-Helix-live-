'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const COMPANY_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const RETIRED = ['patent', 'grant', 'sba', 'franchise'];
const ACTIVE = ['investment', 'research'];
let passed = 0;

function check(name, fn) {
  fn();
  passed++;
  console.log('PASS ' + name);
}

const files = fs.readdirSync(COMPANY_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let portalsWithOutputs = 0;
let activeArtifacts = 0;

for (const name of files) {
  const portal = JSON.parse(fs.readFileSync(path.join(COMPANY_DIR, name), 'utf8'));
  const output = portal.engineOutputs;
  if (!output || typeof output !== 'object') continue;
  portalsWithOutputs++;
  for (const lane of RETIRED) {
    assert.equal(Object.prototype.hasOwnProperty.call(output, lane), false, name + ' retains retired lane ' + lane);
  }
  assert.deepEqual(Object.keys(output.artifactsByLane || {}).sort(), ACTIVE.slice().sort(), name + ' count vocabulary');
  const expected = ACTIVE.reduce((n, lane) => n + (Array.isArray(output[lane]) ? output[lane].length : 0), 0);
  assert.equal(output.totalArtifacts, expected, name + ' totalArtifacts');
  assert.equal(JSON.stringify(output).includes('claimsPreamble'), false, name + ' retains patent application claims');
  assert.equal(JSON.stringify(output).includes('specificAims'), false, name + ' retains grant application aims');
  activeArtifacts += expected;
}

check('the complete company corpus contains no retired engine lane keys or application payloads', () => {
  assert.equal(files.length > 0, true);
  assert.equal(portalsWithOutputs > 0, true);
  assert.equal(activeArtifacts > 0, true);
});

const inbox = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', '_master-inbox.json'), 'utf8'));
check('the Master Brain inbox exposes only research and investment', () => {
  assert.deepEqual(Object.keys(inbox.queues).sort(), ACTIVE.slice().sort());
  assert.deepEqual(Object.keys(inbox.laneThresholds).sort(), ACTIVE.slice().sort());
  assert.deepEqual(Object.keys(inbox.phaseInhibit).sort(), ACTIVE.slice().sort());
  assert.deepEqual(Object.keys(inbox.stats.byLaneReady).sort(), ACTIVE.slice().sort());
  assert.equal(inbox.topPriority.every(item => ACTIVE.includes(item.lane)), true);
});

const policy = require('../lib/limen-policy.js');
check('retired phase routes are explicitly non-dispatching', () => {
  for (const phase of ['p3', 'p4', 'p5', 'p6', 'p8']) assert.equal(policy.PHASE_TO_LANE[phase], null, phase);
  for (const phase of ['p0', 'p2']) assert.equal(policy.PHASE_TO_LANE[phase], 'research', phase);
  for (const phase of ['p1', 'p7', 'p7a', 'p7b', 'p9', 'p10']) assert.equal(policy.PHASE_TO_LANE[phase], 'investment', phase);
});

check('the browser executor cannot queue a retired engine', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'limen', 'master-living-brain.js'), 'utf8');
  for (const lane of RETIRED) {
    assert.equal(src.includes("pushDescriptor('" + lane + "'"), false, lane);
    assert.equal(src.includes("engine-" + lane), false, lane);
  }
});

const consumer = require('../lib/master-brain-consumer.js');
check('the server consumer has exactly the two active lane gates', () => {
  assert.deepEqual(Object.keys(consumer.LANE_THRESHOLDS).sort(), ACTIVE.slice().sort());
  assert.deepEqual(Object.keys(consumer.PHASE_INHIBIT).sort(), ACTIVE.slice().sort());
});

check('the verbiage library contains no retired application templates', () => {
  const verbiage = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'verbiage-templates.json'), 'utf8'));
  assert.deepEqual(Object.keys(verbiage.lanes), ['investment']);
  assert.deepEqual(Object.keys(verbiage.engineHooks), ['investmentEngine']);
});

check('all retired application generators refuse or are absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'assets', 'js', 'agriculture-execution-panels.js')), false);
  const agri = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'domain-brains', 'agriculture-brain.js'), 'utf8');
  assert.equal(agri.includes('agriculture-execution-panels.js'), false);
  const legacy = fs.readFileSync(path.join(ROOT, 'handlers', 'expand-artifact.js'), 'utf8');
  assert.equal(legacy.includes("status(410)"), true);
  assert.equal(legacy.includes('LANE_RETIRED'), true);
  const paid = fs.readFileSync(path.join(ROOT, 'handlers', 'expand-artifact-claude.js'), 'utf8');
  assert.equal(paid.includes("new Set(['investment', 'research'])"), true);
  assert.equal(paid.includes('invalid-or-retired-lane'), true);
  const printed = require('../lib/print-pipeline.js');
  assert.match(printed.printArtifact({ portalSlug: 'general_mills', lane: 'patent', index: 0 }).error, /retired or unsupported/);
  assert.match(printed.printArtifact({ portalSlug: 'general_mills', lane: 'grant', index: 0 }).error, /retired or unsupported/);
});

check('all changed executable modules parse', () => {
  const filesToCheck = [
    'assets/js/limen/master-living-brain.js',
    'assets/js/domain-brains/agriculture-brain.js',
    'handlers/expand-artifact.js',
    'handlers/expand-artifact-claude.js',
    'lib/engine-output-generator.js',
    'lib/limen-policy.js',
    'lib/master-brain-consumer.js',
    'lib/print-pipeline.js',
    'scripts/build-engine-outputs.mjs',
    'scripts/purge-retired-engine-lanes.mjs',
    'scripts/sense/organ-bridge.mjs',
    'scripts/sense/organ-master-brain.mjs'
  ];
  for (const rel of filesToCheck) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, rel)], { encoding: 'utf8' });
    assert.equal(result.status, 0, rel + '\n' + (result.stderr || result.stdout || 'parse failed'));
  }
});

console.log(passed + '/8 passed across ' + files.length + ' company records and ' + activeArtifacts + ' active artifacts');
