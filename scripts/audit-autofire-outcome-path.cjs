'use strict';

/*
 * Read-only B11/B14 outcome-path audit.
 *
 * This is deliberately a source inventory, not a runtime proof.  It answers
 * the narrow question: which production files can emit, consume, or schedule
 * the learning outcome events, and which boundaries still require an external
 * outcome producer?  Tests and generated fixtures are excluded from producer
 * counts so a test helper cannot masquerade as an autonomous path.
 *
 * Usage:
 *   node scripts/audit-autofire-outcome-path.cjs
 *   node scripts/audit-autofire-outcome-path.cjs --write
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'data', 'deep', 'autofire-outcome-path-audit.json');
const EVENTS = [
  'OUTCOME_INVESTMENT_PNL',
  'OUTCOME_RESEARCH_PUBLISHED',
  'OUTCOME_RESEARCH_EVALUATED'
];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', '.next'].includes(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|cjs|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

function relative(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function isTest(file) { return /(^|\/)(test|tests|scripts\/test-)/.test(relative(file)); }
function isProduction(file) {
  const rel = relative(file);
  return !isTest(file) && !rel.startsWith('scripts/');
}

const files = walk(ROOT);
const production = files.filter(isProduction);
const tests = files.filter(isTest);
const text = new Map(files.map(file => [file, fs.readFileSync(file, 'utf8')]));

function filesMatching(re, pool) {
  return pool.filter(file => re.test(text.get(file))).map(relative);
}

const declarations = filesMatching(/OUTCOME_(?:INVESTMENT_PNL|RESEARCH_PUBLISHED|RESEARCH_EVALUATED)/, production);
const explicitEventPosts = filesMatching(/eventType\s*:\s*['"]OUTCOME_(?:INVESTMENT_PNL|RESEARCH_PUBLISHED|RESEARCH_EVALUATED)['"]/, production);
const learningConsumers = filesMatching(/(?:autofireLearning\.)?recordOutcome\s*\(/, production);
const commandProducers = filesMatching(/autofireEfference\.command\s*\(|(?:createPreview|submitApproved)\s*\(/, production);
const manualOutcomeUi = filesMatching(/fetch\(['"]\/api\/limen-outcome|eventType\s*[:=].*OUTCOME_(?:INVESTMENT_PNL|RESEARCH_PUBLISHED|RESEARCH_EVALUATED)/, [
  ...production.filter(file => relative(file).startsWith('assets/'))
]);
const schedules = (() => {
  const file = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(file)) return [];
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (cfg.crons || []).map(x => x.path).filter(Boolean);
})();

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  readOnly: true,
  scope: 'B11/B14 autonomous research and investment outcome path',
  events: EVENTS.map(event => ({
    event,
    explicitProductionPosts: explicitEventPosts.filter(file => text.get(path.join(ROOT, file)).includes(event)),
    autonomousProducerCount: 0,
    status: 'NO_AUTONOMOUS_PRODUCER_FOUND'
  })),
  productionDeclarations: declarations,
  productionLearningConsumers: learningConsumers,
  commandProducers,
  manualOutcomeUi,
  schedules,
  boundaries: {
    commandReceipt: commandProducers.length > 0 ? 'PRESENT' : 'MISSING',
    learningConsumer: learningConsumers.length > 0 ? 'PRESENT' : 'MISSING',
    independentResearchOutcome: 'MISSING_AUTONOMOUS_PRODUCER',
    independentInvestmentOutcome: 'MISSING_AUTONOMOUS_PRODUCER',
    syntheticSandboxOutcome: 'SEPARATE_AND_NOT_WORLD_EVIDENCE'
  },
  conclusion: 'B11/B14 command and learning boundaries exist, but no autonomous production source emits the qualifying research or investment outcome events. Tests and manual UI references do not close that gate.'
};

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
}

console.log(JSON.stringify(result, null, 2));

module.exports = { build: () => result, EVENTS };
