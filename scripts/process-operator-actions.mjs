#!/usr/bin/env node
/**
 * process-operator-actions.mjs — drain the operator action queue.
 *
 * Reads QUEUED actions, dispatches each to print or refresh pipeline, updates
 * status + result. Runs in the autonomic loop after vitals + heal.
 *
 *   node scripts/process-operator-actions.mjs --apply
 *   node scripts/process-operator-actions.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const queue = require(path.join(ROOT, 'lib', 'operator-action-queue.js'));
const { printArtifact } = require(path.join(ROOT, 'lib', 'print-pipeline.js'));
const { refreshArtifact } = require(path.join(ROOT, 'lib', 'refresh-pipeline.js'));

const DRY = !process.argv.includes('--apply');
console.log('=== process-operator-actions ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');

const pending = await queue.listPending();
console.log('queued actions: ' + pending.length);
if (pending.length === 0) { console.log('(nothing to process)'); process.exit(0); }

let processed = 0, failed = 0;
for (const a of pending) {
  console.log();
  console.log('  ' + a.action.padEnd(8) + ' · ' + a.artifactRef + ' · ' + (a.patternId || ''));
  if (DRY) continue;
  await queue.updateAction(a.id, { status: 'PROCESSING' });
  const parts = a.artifactRef.split('/');
  const portalSlug = parts[0], lane = parts[1], index = parts[2];
  try {
    let result;
    if (a.action === 'PRINT') {
      result = printArtifact({ portalSlug, lane, index, actionId: a.id });
    } else if (a.action === 'REFRESH') {
      result = await refreshArtifact({ portalSlug, lane, index, strictness: 2, actionId: a.id });
    } else if (a.action === 'DECLINE') {
      result = { ok: true, declined: true };
    } else {
      result = { ok: false, error: 'unknown action ' + a.action };
    }
    await queue.updateAction(a.id, { status: result.ok ? 'COMPLETED' : 'FAILED', processedAt: new Date().toISOString(), result });
    if (result.ok) { processed++; console.log('    ✓ ' + (result.files ? 'files: ' + result.files.md : (result.strictness ? 'refreshed (strictness ' + result.strictness + ')' : 'declined'))); }
    else { failed++; console.log('    ✗ ' + result.error); }
  } catch (e) {
    failed++;
    await queue.updateAction(a.id, { status: 'FAILED', processedAt: new Date().toISOString(), result: { error: String(e.message || e) } });
    console.log('    ✗ ' + e.message);
  }
}

console.log();
console.log('=== done ===');
console.log('processed: ' + processed + ' · failed: ' + failed);
