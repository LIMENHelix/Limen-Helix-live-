#!/usr/bin/env node
/**
 * sync-approved-patterns.mjs — drain APPROVED proposals from Redis into
 * the local bridge-patterns.json file, ready for commit.
 *
 * On Vercel the approve flow runs but can't write to the read-only filesystem,
 * so the pattern is marked APPROVED with `awaitingLocalSync: true` in Redis.
 * Run this locally to:
 *   1. Pull the APPROVED proposals from Redis (uses UPSTASH_REDIS_REST_URL+TOKEN)
 *   2. Merge each pattern's JSON into assets/data/bridge-patterns.json
 *   3. Mark them as `awaitingLocalSync: false` in Redis
 *   4. (Optional) git commit the change so the next deploy + bridge-build
 *      pass picks them up
 *
 *   node scripts/sync-approved-patterns.mjs --dry-run
 *   node scripts/sync-approved-patterns.mjs --apply
 *   node scripts/sync-approved-patterns.mjs --apply --commit
 *
 * Requires the Upstash env vars in your local shell:
 *   $env:UPSTASH_REDIS_REST_URL = "..."
 *   $env:UPSTASH_REDIS_REST_TOKEN = "..."
 * (Copy from your Vercel project Settings → Environment Variables.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PATTERNS_PATH = path.join(ROOT, 'assets', 'data', 'bridge-patterns.json');
const REDIS_KEY = 'limen:pattern-proposals';

const DRY = !process.argv.includes('--apply');
const COMMIT = process.argv.includes('--commit');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in your local shell.');
  console.error('Copy them from Vercel project Settings → Environment Variables.');
  process.exit(1);
}

async function redisCmd(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (!r.ok) throw new Error('redis ' + cmd[0] + ' ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
  return j && j.result;
}

console.log('=== sync-approved-patterns ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');

// Pull all proposals from Redis
const raw = await redisCmd(['LRANGE', REDIS_KEY, '0', '500']);
const proposals = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
console.log('total proposals in Redis: ' + proposals.length);

// Latest-wins dedup (LPUSH puts updates at head)
const seen = new Set();
const latest = [];
for (const p of proposals) {
  const id = p.pattern && p.pattern.id;
  if (!id || seen.has(id)) continue;
  seen.add(id);
  latest.push(p);
}
console.log('unique proposals (latest-wins): ' + latest.length);

const approvedPending = latest.filter(p => p.status === 'APPROVED' && p.awaitingLocalSync);
const approvedDone = latest.filter(p => p.status === 'APPROVED' && !p.awaitingLocalSync);
const pending = latest.filter(p => p.status === 'PENDING_REVIEW' || !p.status);
const rejected = latest.filter(p => p.status === 'REJECTED');
console.log('  APPROVED awaiting local sync: ' + approvedPending.length);
console.log('  APPROVED already synced:      ' + approvedDone.length);
console.log('  PENDING_REVIEW:               ' + pending.length);
console.log('  REJECTED:                     ' + rejected.length);

if (approvedPending.length === 0) {
  console.log('\nNothing to sync. (Approve proposals on /pattern-proposals.html first.)');
  process.exit(0);
}

// Load current library
let lib;
try { lib = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8')); }
catch (e) { console.error('Cannot read ' + PATTERNS_PATH + ': ' + e.message); process.exit(1); }
const existingIds = new Set((lib.patterns || []).map(p => p.id));

const toMerge = approvedPending.filter(p => !existingIds.has(p.pattern.id));
const alreadyInLib = approvedPending.filter(p => existingIds.has(p.pattern.id));

console.log();
console.log('to merge: ' + toMerge.length);
for (const p of toMerge) console.log('  + ' + p.pattern.id + ' (target: ' + (p.targetDomain || 'business') + ', source: ' + (p.sourcePortal || '?') + ')');
if (alreadyInLib.length) {
  console.log('already in library (will mark synced): ' + alreadyInLib.length);
  for (const p of alreadyInLib) console.log('  · ' + p.pattern.id);
}

if (DRY) { console.log('\n(dry run — re-run with --apply to write)'); process.exit(0); }

// Merge into library
for (const p of toMerge) lib.patterns.push(p.pattern);
lib.generatedAt = new Date().toISOString();
fs.writeFileSync(PATTERNS_PATH, JSON.stringify(lib, null, 2));
console.log('\nwrote ' + PATTERNS_PATH + ' (' + lib.patterns.length + ' patterns total)');

// Mark each as synced in Redis (LPUSH updated copy)
for (const p of [...toMerge, ...alreadyInLib]) {
  const updated = { ...p, awaitingLocalSync: false, syncedAt: new Date().toISOString() };
  await redisCmd(['LPUSH', REDIS_KEY, JSON.stringify(updated)]);
}
await redisCmd(['LTRIM', REDIS_KEY, '0', '499']);
console.log('marked ' + (toMerge.length + alreadyInLib.length) + ' proposals as synced in Redis');

if (COMMIT) {
  try {
    execSync('git add ' + JSON.stringify(PATTERNS_PATH));
    execSync('git -c commit.gpgsign=false commit -m "Sync ' + toMerge.length + ' approved bridge pattern(s) from Redis"');
    console.log('\ngit commit created. Run `git push` when ready.');
  } catch (e) { console.warn('git commit failed: ' + e.message); }
}

console.log('\nNext: bridge-build will pick these up automatically on the next cron tick,');
console.log('OR run `node scripts/build-bridge-readings.mjs --apply` to re-match across the corpus now.');
