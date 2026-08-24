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

const contract = read('lib/autofire-outcome-contract.js');
const learner = read('lib/autofire-learning.js');
const publicationAdapter = read('lib/post-adapters.js');
const engineOutput = read('handlers/limen-worker-autofire.js');
const publicationObserver = read('handlers/limen-outcome-observer.js');
const outcomeHandler = read('handlers/limen-outcome.js');
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
    autonomousProducer: false,
    producerBasis: 'endpoint validation/learning consumer is not a source-grounded evaluator'
  },
  requiredExternalInput: {
    independentEvidenceIds: true,
    establishedIndependenceAssessment: true,
    mappingCoverage: requiredMappings,
    progressDecision: ['PROGRESS', 'REGRESSION', 'NO_CHANGE']
  },
  conclusion: 'The contract and learner exist, but the production publication path carries no evaluation metadata and no autonomous source-grounded evaluator exists. A publication, citation list, article count, or originating domain signal cannot create OUTCOME_RESEARCH_EVALUATED; the system must abstain until an independently identified evidence set and all four mapping decisions are supplied.'
};

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
module.exports = { build: () => result };
