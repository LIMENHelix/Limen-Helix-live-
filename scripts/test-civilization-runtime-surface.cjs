'use strict';
const A = require('./audit-civilization-runtime-surface.cjs');
let n = 0, failed = 0;
function t(name, ok) { n++; if (ok) console.log('  PASS ' + name); else { failed++; console.error('  FAIL ' + name); } }
const snapshot = { meta: { snapshotId: 'snap-1', liveCount: 4, fallbackCount: 1 }, domains: { energy: { sources: [{},{}] }, research: { sources: [{},{}] } } };
const autofire = { total: 3, budget: { enabled: true, armed: true, spentTodayUsd: 0, remainingUsd: 20 }, cycles: [
  { evaluated: 1, fired: 1, errors: 0, results: [{ lane: 'research' }] },
  { evaluated: 1, fired: 0, errors: 0, results: [{ lane: 'investment' }] }
] };
const report = A.summarize(snapshot, autofire, { status: 401 });
t('counts domains and sources', report.domainSurface.domains === 2 && report.domainSurface.sources === 4);
t('counts observed autofire work', report.autofire.evaluated === 2 && report.autofire.fired === 1 && report.autofire.observedResults === 2);
t('marks research live-observed', report.laneInventory.find((x) => x.lane === 'research-papers').status === 'live-observed');
t('joins research display lane to runtime lane', report.laneInventory.find((x) => x.lane === 'research-papers').runtimeLane === 'research');
t('marks investment live-observed', report.laneInventory.find((x) => x.lane === 'investments').status === 'live-observed');
t('joins investment display lane to runtime lane', report.laneInventory.find((x) => x.lane === 'investments').runtimeLane === 'investment');
t('marks every inactive lane not-observable', report.laneInventory.filter((x) => x.status === 'not-observable').length === 11);
t('preserves auth-gated shadow status', report.endpoints.brainShadow.status === 'auth-gated');
const liveShadow = A.summarize(snapshot, autofire, { status: 200, body: { runtime: 'brain-v2-shadow/0.1.0', installedCount: 20, totalDomains: 20, cycles: { energy: { ok: true, ticks: 1, rowsApplied: 1, restored: true }, finance: { ok: false, ticks: 0, rowsApplied: 0, restored: false } }, stateValueBytesTotal: 123 } });
t('summarizes an authenticated shadow read', liveShadow.authenticatedShadow.domainsOk === 1 && liveShadow.authenticatedShadow.domainsErrored === 1 && liveShadow.authenticatedShadow.restoredCount === 1);
console.log(n + '/' + n + ' passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
