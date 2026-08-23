'use strict';
const A = require('./audit-civilization-runtime-surface.cjs');
let n = 0, failed = 0;
function t(name, ok) { n++; if (ok) console.log('  PASS ' + name); else { failed++; console.error('  FAIL ' + name); } }
const snapshot = { meta: { snapshotId: 'snap-1', liveCount: 4, fallbackCount: 1 }, domains: { energy: { sources: [{},{}] }, research: { sources: [{},{}] } } };
const autofire = { total: 3, budget: { enabled: true, armed: true, spentTodayUsd: 0, remainingUsd: 20 }, cycles: [
  { evaluated: 1, fired: 1, errors: 0, results: [{ lane: 'research-papers' }] },
  { evaluated: 0, fired: 0, errors: 0, results: [] }
] };
const report = A.summarize(snapshot, autofire, { status: 401 });
t('counts domains and sources', report.domainSurface.domains === 2 && report.domainSurface.sources === 4);
t('counts observed autofire work', report.autofire.evaluated === 1 && report.autofire.fired === 1);
t('marks research live-observed', report.laneInventory.find((x) => x.lane === 'research-papers').status === 'live-observed');
t('marks investment blocked with no result', report.laneInventory.find((x) => x.lane === 'investments').status === 'blocked');
t('marks every inactive lane not-observable', report.laneInventory.filter((x) => x.status === 'not-observable').length === 11);
t('preserves auth-gated shadow status', report.endpoints.brainShadow.status === 'auth-gated');
console.log(n + '/' + n + ' passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
