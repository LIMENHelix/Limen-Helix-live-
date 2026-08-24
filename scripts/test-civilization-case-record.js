'use strict';
var assert = require('node:assert/strict');
var packet = require('../lib/civilization-server-packet');
var cases = require('../lib/civilization-case-record');
var passed = 0;
function ok(name, fn) { fn(); passed++; console.log('PASS ' + name); }
var p = packet.buildPacket({ schemaVersion: packet.PACKET_SCHEMA, sourceType: 'server-cognition-refresh', domainId: 'science', domainLabel: 'Science', cycleId: '1', generatedAt: '2026-08-24T00:00:00Z', sourceIdentity: { snapshotId: 's', retrievedAt: '2026-08-24T00:00:00Z', refreshId: 'r', producer: 'test' }, truth: { stressScore: null, confidence: 0.7, activityLevel: null, phase: 'p2', phaseLabel: 'RHYTHM', activeDiagnoses: [{ id: 'dx' }], treatments: [{ id: 'tx' }], opportunities: [], directives: [], feedHealth: null } });
ok('research record is versioned and abstained', function () { var h = packet.toHandoff(p, 'research-papers', { id: 'o', title: 'Study', lane: 'research-papers' }); assert.equal(h.caseRecord.schemaVersion, cases.SCHEMA); assert.equal(h.caseRecord.status, 'OBSERVATIONAL'); assert.equal(h.caseRecord.authorization.liveExecution, false); assert.equal(h.caseRecord.laneTerms.evaluationStatus, 'NOT_EVALUATED'); });
ok('research record preserves required mappings and independence gap', function () { var h = packet.toHandoff(p, 'research-papers', { id: 'o2', title: 'Study', lane: 'research-papers' }); assert.deepEqual(h.caseRecord.laneTerms.requiredMappings, cases.MAPPINGS); assert.equal(h.caseRecord.evidence.independenceAssessment.status, 'UNESTABLISHED'); assert.ok(h.caseRecord.decision.reasons.includes('no-independent-evidence-ids')); });
ok('investment record is paper-only with 30/60/90 terms', function () { var h = packet.toHandoff(p, 'investments', { id: 'o3', title: 'Paper thesis', lane: 'investments' }); assert.equal(h.caseRecord.authorization.paperOnly, true); assert.deepEqual(h.caseRecord.laneTerms.horizonsDays, [30, 60, 90]); assert.equal(h.caseRecord.laneTerms.accountableOwner, 'finance'); assert.equal(h.caseRecord.decision.status, 'ABSTAINED'); });
console.log(passed + '/3 passed');
