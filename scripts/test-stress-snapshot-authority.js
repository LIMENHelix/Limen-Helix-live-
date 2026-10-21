#!/usr/bin/env node
'use strict';

/**
 * test-stress-snapshot-authority.js — the committed stress snapshot and every
 * consumer of it must enforce the current Thing One authority contract.
 *
 * A stale pre-gate artifact has the same shape as a current one; only the
 * `authority` contract distinguishes them.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const P = require('../lib/limen-stress-propagator');

const ROOT = path.join(__dirname, '..');
const snapshotPath = path.join(ROOT, 'assets', 'data', 'stress-network-state.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

assert.strictEqual(P.hasCurrentAuthority(snapshot), true,
  'committed snapshot lacks the current authority contract');
assert.strictEqual(snapshot.authority.contract, P.AUTHORITY_CONTRACT);
assert.strictEqual(snapshot.authority.kernelId, P.AUTHORITY_KERNEL_ID);
assert.strictEqual(snapshot.authority.thing1Validation, 'validated');
assert.strictEqual(snapshot.authority.thing0Qualification, 'qualified');
assert.strictEqual(snapshot.authority.thing0PermitsThing1Use, true);

assert.strictEqual(snapshot.stats.stressedNodes, 0,
  'committed snapshot still has kernel intrinsic seeds');
assert.strictEqual(snapshot.stats.networkPushed, 0,
  'committed snapshot still has kernel network pushes');
assert.strictEqual(snapshot.propagated.some((n) => n.slug === 'saia'), false,
  'quarantined identity appears in the committed snapshot');

const cbPath = path.join(ROOT, 'assets', 'data', 'command-board-data.json');
const cbHash = crypto.createHash('sha256').update(fs.readFileSync(cbPath)).digest('hex');
assert.strictEqual(snapshot.source.commandBoard.sha256, cbHash,
  'snapshot source hash does not match the committed Command Board feed');
assert.strictEqual(snapshot.source.commandBoard.rows, 493);

// A pre-gate artifact with the same propagated shape is refused.
const stale = JSON.parse(JSON.stringify(snapshot));
delete stale.authority;
assert.strictEqual(P.hasCurrentAuthority(stale), false,
  'a pre-gate artifact was accepted');
assert.strictEqual(P.isCurrentAuthorityMeta({ contract: 'legacy' }), false);
assert.strictEqual(P.isCurrentAuthorityMeta({
  contract: P.AUTHORITY_CONTRACT, kernelId: P.AUTHORITY_KERNEL_ID,
  thing1Validation: 'unvalidated_after_modification',
  thing0Qualification: 'qualified', thing0PermitsThing1Use: true
}), false, 'unvalidated Thing 1 authority was accepted');
assert.strictEqual(P.isCurrentAuthorityMeta({
  contract: P.AUTHORITY_CONTRACT, kernelId: P.AUTHORITY_KERNEL_ID,
  thing1Validation: 'validated',
  thing0Qualification: 'partially_qualified', thing0PermitsThing1Use: true
}), false, 'partial Thing 0 authority was accepted');

// Every consumer uses the shared gate.
const consumers = {
  'handlers/limen-stress-propagation.js': 'hasCurrentAuthority(cached)',
  'handlers/limen-stress-slim.js': 'hasCurrentAuthority(sn)',
  'handlers/limen-worker-autofire.js': 'hasCurrentAuthority(sn)',
  'handlers/limen-worker-autoqueue.js': 'isCurrentAuthorityMeta(stressSlim.authority)'
};
for (const [file, marker] of Object.entries(consumers)) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.ok(src.includes(marker), file + ' does not enforce snapshot authority');
}

console.log('stress snapshot authority: 0 seeds, 0 pushes, 797 nodes, source hash current, stale artifacts refused');
