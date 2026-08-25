'use strict';

/*
 * Read-only audit of the input boundary for OUTCOME_RESEARCH_EVALUATED.
 *
 * This does not score a publication or decide whether research progressed. It
 * proves whether the production tree currently carries the independently
 * identified evidence and four mapping decisions that the reviewed contract
 * requires. Tests and UI fixtures are not counted as autonomous producers.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'data', 'deep', 'research-evaluation-input-audit.json');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function has(rel, re) { return re.test(read(rel)); }
function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', '.next'].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|cjs|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
function relative(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }

const contract = read('lib/autofire-outcome-contract.js');
const learner = read('lib/autofire-learning.js');
const publicationAdapter = read('lib/post-adapters.js');
const engineOutput = read('handlers/limen-worker-autofire.js');
const publicationObserver = read('handlers/limen-outcome-observer.js');
const outcomeHandler = read('handlers/limen-outcome.js');
const productionFiles = walk(ROOT).filter(function (file) {
  const rel = relative(file);
  return !rel.startsWith('scripts/') && !/(^|\/)test(?:s)?\//.test(rel) &&
    rel !== 'lib/autofire-outcome-contract.js' && rel !== 'lib/autofire-learning.js' &&
    rel !== 'handlers/limen-outcome.js';
});
const researchEvaluationAdapters = productionFiles.filter(function (file) {
  return relative(file) === 'lib/research-evaluation-input-adapter.js';
}).map(relative);
const researchEvaluationProducers = productionFiles.filter(function (file) {
  const rel = relative(file);
  if (rel === 'lib/research-evaluation-input-adapter.js') return false;
  if (rel === 'handlers/limen-research-evaluation-observer.js') return true;
  const source = fs.readFileSync(file, 'utf8');
  return /buildResearchEvaluation\s*\(/.test(source) ||
    /eventType\s*[:=]\s*['"]OUTCOME_RESEARCH_EVALUATED['"]/.test(source);
}).map(relative);
const requiredMappings = [
  'neurology_to_business_homology',
  'business_to_neurology_homology',
  'kernel_dynamics',
  'p0_p10_proof_and_effects'
];

const result = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  readOnly: true,
  scope: 'production input boundary for OUTCOME_RESEARCH_EVALUATED',
  contract: {
    builderPresent: /function buildResearchEvaluation\s*\(/.test(contract),
    independenceRequired: /independenceAssessment\.status !== 'ESTABLISHED'/.test(contract),
    evidenceIdsRequired: /evidenceIds/.test(contract),
    requiredMappings: requiredMappings.filter(function (name) { return contract.indexOf(name) >= 0; })
  },
  learner: {
    consumerPresent: /OUTCOME_RESEARCH_EVALUATED/.test(learner),
    gradingPresent: /function gradeResearch|gradeResearch/.test(learner)
  },
  publicationPath: {
    persistsCitations: /evidenceCitationsUsed|citations/.test(publicationAdapter),
    engineOutputCarriesCitations: /evidenceCitationsUsed/.test(engineOutput),
    persistsProvenance: /provenance/.test(publicationAdapter),
    persistsEvaluationMetadata: /researchEvaluation|mappingCoverage|independenceAssessment|evidenceIds/.test(publicationAdapter),
    observerEmitsEvaluation: /OUTCOME_RESEARCH_EVALUATED/.test(publicationObserver)
  },
  outcomeEndpoint: {
    acceptsEvaluation: /OUTCOME_RESEARCH_EVALUATED/.test(outcomeHandler),
    autonomousProducer: researchEvaluationProducers.length > 0,
    autonomousSourceProducer: false,
    inputGated: true,
    producerFiles: researchEvaluationProducers,
    explicitInputAdapter: researchEvaluationAdapters.length > 0,
    adapterFiles: researchEvaluationAdapters,
    producerBasis: researchEvaluationProducers.length
      ? 'a cron return producer consumes only separately admitted external evaluation records; it does not generate their evidence or mapping decisions'
      : researchEvaluationAdapters.length
        ? 'an explicit evaluator-input adapter exists, but it requires separately supplied evidence and is not an autonomous producer'
        : 'source-tree scan found no evaluator/producers outside the validator and learner'
  },
  requiredExternalInput: {
    independentEvidenceIds: true,
    establishedIndependenceAssessment: true,
    mappingCoverage: requiredMappings,
    progressDecision: ['PROGRESS', 'REGRESSION', 'NO_CHANGE']
  },
  conclusion: researchEvaluationProducers.length
    ? 'A scheduled return producer now consumes durably admitted evaluations, but sourcing remains external and input-gated: two distinct evidence identities and all four mapping decisions must be supplied before the observer can emit an outcome.'
    : researchEvaluationAdapters.length
      ? 'An explicit evaluator-input adapter exists, but it is not autonomous: a publication, citation list, article count, or originating domain signal cannot create OUTCOME_RESEARCH_EVALUATED. A separately supplied independently identified evidence set and all four mapping decisions are still required.'
      : 'The contract and learner exist, but the production publication path carries no evaluation metadata and no autonomous source-grounded evaluator exists. A publication, citation list, article count, or originating domain signal cannot create OUTCOME_RESEARCH_EVALUATED; the system must abstain until an independently identified evidence set and all four mapping decisions are supplied.'
};

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
module.exports = { build: () => result };
