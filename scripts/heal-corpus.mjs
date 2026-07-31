#!/usr/bin/env node
/**
 * heal-corpus.mjs — the immune cell. Reads _vitals.json, runs every
 * unambiguous heal, re-audits, writes back vitals with `lastHeals` populated.
 *
 * The split: safe heals are deterministic re-writes of corpus data that the
 * audit scripts already wrote (and were already validated by hand). Ambiguous
 * issues — CIK collisions (intentional segments?), thin portals (regen costs
 * API), domain mis-routing (requires CB source edits), under-tagged brains
 * (regen costs API), name-dup clusters (canonicalization decision) — stay in
 * the operator-attention queue. The immune system doesn't make decisions only
 * a human should make.
 *
 *   node scripts/heal-corpus.mjs --dry-run   # plan only
 *   node scripts/heal-corpus.mjs --apply     # default, runs heals
 *
 * Designed to be safe to re-run: every safe heal is idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VITALS = path.join(ROOT, 'assets', 'data', '_vitals.json');
const DRY = process.argv.includes('--dry-run');

// ─── handler registry ─────────────────────────────────────────────
// Each safe heal: (a) which attention-queue item it answers, (b) the script
// to run, (c) a lightweight summary parser. Anything not registered here
// stays in operator-attention as a flag for human judgment.
const HEALS = [
  {
    issueRe: /DATA_NEEDED placeholders/i,
    name: 'scrub-data-needed',
    cmd: ['node', ['scripts/scrub-data-needed-corpus.mjs', '--apply']],
    summarize: out => {
      const m = out.match(/portals touched:\s*(\d+)[^\d]+fields scrubbed:\s*(\d+)/i);
      return m ? `touched ${m[1]} portals · scrubbed ${m[2]} fields` : 'completed';
    }
  },
  {
    issueRe: /Curated CB rows with broken portal links/i,
    name: 'wire-curated-cb',
    cmd: ['node', ['scripts/wire-cb-slugs.mjs']],
    summarize: out => {
      const m = out.match(/(\d+)\s+rows?\s+(?:updated|re-pointed|rewired)/i);
      return m ? `re-pointed ${m[1]} curated rows` : 'completed';
    }
  },
  {
    issueRe: /Eligible CB rows with broken portal links/i,
    name: 'wire-eligible-cb',
    cmd: ['node', ['scripts/wire-eligible-slugs.mjs']],
    summarize: out => {
      const m = out.match(/hp=true.*?(\d+)/i) || out.match(/(\d+)\s+rows?\s+(?:updated|re-pointed|rewired)/i);
      return m ? `re-pointed ${m[1]} eligible rows / hp updated` : 'completed';
    }
  },
  {
    issueRe: /Category bleed/i,
    name: 'fix-fn-category-bleed',
    cmd: ['node', ['scripts/fix-fn-category-bleed.mjs', '--apply']],
    summarize: out => {
      const m = out.match(/(\d+)\s+entries?\s+(?:moved|re-?slotted|reslotted)/i);
      return m ? `re-slotted ${m[1]} entries` : 'completed';
    }
  }
];

const OPERATOR_ONLY = [
  /CIK collisions/i,
  /Thin portals/i,
  /Domain mis-routing/i,
  /brain-tagging below/i,
  /Name-fingerprint dup/i,
  /Null kernel composite on ELIGIBLE/i,    // needs CIK / kernel-rescore investigation
  /NaN composite values/i,                 // data error, inspect manually
  /Truncated prose in fn entries/i,        // heal-prose-truncation not yet built
  // body-wide organ items (introduced by audit-system-vitals.mjs)
  /Canonical domains with NO/i,            // feeds & nodes both surface this
  /Missing canonical domain brain files/i, // domain organ
  /domain-packet-adapter\.js missing/i,    // domain organ — the canonical #1 pathology
  /Domain brain files lacking required markers/i,
  /Feed source count low/i,
  /stress-network snapshot stale/i,        // could be healable by invoking worker, operator-only for now
  /Propagator output has NO downstream consumers/i,
  /path-C anomalies in propagator output/i,
  /companies-manifest count drift/i,
  /Kernel never finished scoring/i,
  /PROPAGATE_FRACTION=0/i,                 // connectome dead state
  /SBNY CIK hardcoded/i,
  /not publishing to pattern bus/i,
  /not consuming domain packets/i,
  /Envelope integrity seal missing/i,
  /Orphan L1 nodes/i,
  /L1 node count drift/i,
  /Surfaces build company-portal links without an hp gate/i,    // structural — operator decides per-surface
  /CB rows pointing to a portal slug with NO file on disk/i,    // realized — accept absence or build portals
  /Master Brain inbox stale/i,                                  // run build-master-inbox.mjs
  /Master Brain inbox never built/i,                            // run build-master-inbox.mjs
  /All [0-9]+ candidate artifacts INHIBITED/i                   // threshold tuning needed
];

// ─── load pre-state ───────────────────────────────────────────────
if (!fs.existsSync(VITALS)) {
  console.error('No _vitals.json found. Run: node scripts/audit-corpus-vitals.mjs first.');
  process.exit(1);
}
const pre = JSON.parse(fs.readFileSync(VITALS, 'utf8'));
const startedAt = new Date().toISOString();
const heals = [];
const skipped = [];

console.log('=== heal-corpus ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');
console.log('pre-heal score: ' + pre.overall.score + ' (' + pre.overall.status + ')');
console.log('attention items: ' + (pre.operatorAttention || []).length);
console.log();

for (const item of pre.operatorAttention || []) {
  const handler = HEALS.find(h => h.issueRe.test(item.issue));
  if (!handler) {
    const opOnly = OPERATOR_ONLY.some(r => r.test(item.issue));
    skipped.push({ issue: item.issue, severity: item.severity, count: item.count, reason: opOnly ? 'operator-only (requires human judgment)' : 'no registered heal' });
    console.log('  skip · ' + item.issue + ' (' + item.count + ') — ' + (opOnly ? 'operator-only' : 'unhandled'));
    continue;
  }
  if (DRY) {
    console.log('  PLAN · ' + handler.name + ' for "' + item.issue + '" (' + item.count + ')');
    heals.push({ name: handler.name, issue: item.issue, count: item.count, planned: true });
    continue;
  }
  console.log('  RUN  · ' + handler.name + ' → ' + handler.cmd[0] + ' ' + handler.cmd[1].join(' '));
  const ranAt = new Date().toISOString();
  const r = spawnSync(handler.cmd[0], handler.cmd[1], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const ok = r.status === 0;
  const out = (r.stdout || '') + (r.stderr || '');
  const summary = handler.summarize(out);
  console.log('       ' + (ok ? '✓' : '✗') + ' ' + summary);
  heals.push({ name: handler.name, issue: item.issue, countBefore: item.count, ranAt, success: ok, summary, exitCode: r.status });
}

// ─── re-audit to capture post-heal state ──────────────────────────
if (!DRY) {
  console.log('\nre-auditing…');
  // Prefer the body-wide aggregator; fall back to the corpus-only audit if not present
  const audit = fs.existsSync(path.join(ROOT, 'scripts', 'audit-system-vitals.mjs')) ? 'audit-system-vitals.mjs' : 'audit-corpus-vitals.mjs';
  const a = spawnSync('node', ['scripts/' + audit], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (a.status !== 0) {
    console.error('audit failed:', a.stderr || a.stdout);
    process.exit(2);
  }
  const post = JSON.parse(fs.readFileSync(VITALS, 'utf8'));

  /**
   * VERIFY EACH HEAL AGAINST THE RE-AUDIT. A heal is not successful because it exited 0.
   *
   * `success` used to be `r.status === 0` and nothing more, and the heal records were written
   * BEFORE this re-audit, so the proof was computed and never compared back. The live vitals
   * carried the consequence: wire-eligible-cb ran 2026-07-12 with countBefore 176, exitCode 0,
   * success true, preScore 95, postScore 95 — and the very same file, regenerated 19 days later,
   * still reported that issue at 176. vitals.html:228 renders success as a green tick, so a heal
   * that changed nothing displayed as a heal that worked.
   *
   * That is the difference between an immune system and a system that says it has one, and it is
   * the precondition for healing without a prompt: an autonomous healer whose success criterion
   * is its own exit code cannot tell you it failed.
   *
   * success now REQUIRES the defect count to have fallen. exitOk keeps the old meaning so a
   * crashed healer stays distinguishable from a healer that ran cleanly and accomplished nothing.
   * The change is one-directional: nothing that was false becomes true.
   */
  const postCounts = new Map((post.operatorAttention || []).map(a => [a.issue, a.count || 0]));
  for (const h of heals) {
    if (h.planned) continue;
    const before = h.countBefore || 0;
    const after = postCounts.has(h.issue) ? postCounts.get(h.issue) : 0;   // issue gone entirely = 0
    h.exitOk = h.success === true;
    h.countAfter = after;
    h.resolved = after === 0;
    h.success = h.exitOk && after < before;
    if (h.exitOk && !h.success) {
      h.summary = 'NO EFFECT — exited 0 but the count did not fall (' + before + ' → ' + after + '). ' + (h.summary || '');
    } else if (h.success) {
      h.summary = 'healed ' + before + ' → ' + after + '. ' + (h.summary || '');
    }
  }

  // merge in heal log
  post.lastHeals = (pre.lastHeals || []).concat([{ startedAt, finishedAt: new Date().toISOString(), preScore: pre.overall.score, postScore: post.overall.score, heals, skipped }]).slice(-20);
  fs.writeFileSync(VITALS, JSON.stringify(post, null, 2));

  console.log('\n--- result ---');
  console.log('score:   ' + pre.overall.score + ' → ' + post.overall.score + '  (' + pre.overall.status + ' → ' + post.overall.status + ')');
  const fmt = obj => Object.entries(obj).map(([k, v]) => k + '=' + v).join(' ');
  console.log('pre:     ' + fmt(pre.scores));
  console.log('post:    ' + fmt(post.scores));
  const noEffect = heals.filter(h => h.exitOk && !h.success);
  console.log('heals VERIFIED (count actually fell): ' + heals.filter(h => h.success).length + '/' + heals.length);
  if (noEffect.length) {
    console.log('heals that exited 0 and changed NOTHING: ' + noEffect.length);
    for (const h of noEffect) console.log('  · ' + h.name + ' — ' + h.countBefore + ' → ' + h.countAfter + ' — ' + h.issue);
  }
  console.log('operator-attention remaining: ' + (post.operatorAttention || []).length);
} else {
  console.log('\n(dry run — nothing written)');
}
