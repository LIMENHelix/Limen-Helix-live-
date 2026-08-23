'use strict';

var H = require('../core/sandbox-domain-handoff.js');
var failures = 0, tests = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function packet() {
  return {
    schemaVersion: H.PACKET_SCHEMA,
    domainId: 'research',
    sourceType: 'domain-brain',
    activeDiagnoses: [{ id: 'DX_RESEARCH', label: 'research diagnosis', summary: 'bounded diagnosis', active: true, relevance: 0.9 }],
    treatments: [{ id: 'TX_RESEARCH', label: 'research treatment', treatment: { id: 'TX_RESEARCH', label: 'research treatment' } }]
  };
}
function opportunity() {
  return { id: 'opp-1', motorClaim: { variable: 'sandbox:research:delta', magnitude: 1 } };
}
console.log('=== SANDBOX DOMAIN HANDOFF ===');
var out = H.fromPacket(packet(), opportunity(), 'research-papers', 1000);
assert('emits the handoff schema', out.schemaVersion === H.HANDOFF_SCHEMA);
assert('carries the source domain', out.sourceDomains.length === 1 && out.sourceDomains[0] === 'research');
assert('carries diagnosis identity', out.sourceDiagnoses[0].id === 'DX_RESEARCH');
assert('carries treatment identity', out.sourceTreatments[0].treatment.id === 'TX_RESEARCH');
assert('carries the motor claim', out.motorClaim.variable === 'sandbox:research:delta' && out.motorClaim.magnitude === 1);
assert('records packet provenance', out.sourcePacketSchema === H.PACKET_SCHEMA && out.packetSourceType === 'domain-brain');

function refuses(fn, label) { var ok = false; try { fn(); } catch (e) { ok = String(e.message).indexOf('sandbox-domain-handoff') >= 0; } assert(label, ok); }
refuses(function () { H.fromPacket({}, opportunity(), 'research-papers', 1000); }, 'rejects an unversioned packet');
refuses(function () { H.fromPacket(packet(), opportunity(), 'publication', 1000); }, 'rejects an inactive lane');
refuses(function () { H.fromPacket(Object.assign(packet(), { activeDiagnoses: [] }), opportunity(), 'research-papers', 1000); }, 'rejects a packet with no diagnoses');
refuses(function () { H.fromPacket(Object.assign(packet(), { treatments: [] }), opportunity(), 'research-papers', 1000); }, 'rejects a packet with no treatments');
refuses(function () { H.fromPacket(packet(), { id: 'opp-1' }, 'research-papers', 1000); }, 'rejects a missing motor claim');
console.log(tests + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
process.exit(failures ? 1 : 0);
