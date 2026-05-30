#!/usr/bin/env node
/**
 * persist-k2-readings.mjs — call the deployed Helix kernel API for every
 * portal with a CIK, store the K2 (polyvagal) reading into portal.kernelReadings.
 *
 * Per the architectural reframe (2026-05-29): rendering must NOT gate on K1.
 * Every portal carries a `kernelReadings` slot, and surfaces read whichever
 * kernel has the strongest signal. This script populates kernelReadings.k2
 * across the corpus, post the gate-relaxation in api/helix_app/index.py +
 * phase_engine.py (deployed once main is pushed).
 *
 * Schema written to each portal:
 *
 *   portal.kernelReadings = {
 *     k1:   null | { phase, composite, alert, trajectory, kernelId, lastScored },
 *     k2:   { phase, coupling_mode, intrinsic_source, polyvagal_context_source,
 *             bias_contributions, kernelId, lastScored } | null,
 *     k3:   null,                                     // reserved
 *     primary: 'k2' | 'k1' | 'k3'                     // which to render
 *   }
 *
 * Behaviour:
 *   - Idempotent: skip portals where kernelReadings.k2.lastScored is within
 *     STALE_HOURS (default 24h). --force to re-score everything.
 *   - Concurrent: 4 in flight by default; --concurrency=N to override.
 *   - Skips portals without a CIK (those need K3 — reserved).
 *   - Logs each portal's outcome; writes _k2-persist-log.json summary.
 *
 *   node scripts/persist-k2-readings.mjs --dry-run
 *   node scripts/persist-k2-readings.mjs --apply
 *   node scripts/persist-k2-readings.mjs --apply --concurrency=8 --force
 *   node scripts/persist-k2-readings.mjs --apply --base=http://localhost:3000   # local dev
 *   node scripts/persist-k2-readings.mjs --apply --slug=walmart                 # one portal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const LOG_PATH = path.join(ROOT, 'assets', 'data', '_k2-persist-log.json');

const arg = (name, dflt) => {
  const i = process.argv.findIndex(a => a === '--' + name || a.startsWith('--' + name + '='));
  if (i === -1) return dflt;
  const a = process.argv[i];
  if (a.includes('=')) return a.split('=')[1];
  return process.argv[i + 1] || dflt;
};
const has = name => process.argv.includes('--' + name);

const APPLY = has('apply');
const FORCE = has('force');
const DRY = !APPLY;
const CONCURRENCY = parseInt(arg('concurrency', '4'), 10);
const BASE = arg('base', 'https://limenhelix.com');
const SLUG_FILTER = arg('slug', null);
const STALE_HOURS = 24;

console.log('=== persist-k2-readings ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');
console.log('base URL:    ' + BASE);
console.log('concurrency: ' + CONCURRENCY);
console.log('force:       ' + FORCE);
if (SLUG_FILTER) console.log('slug filter: ' + SLUG_FILTER);
console.log();

// ─── enumerate portals + filter ────────────────────────────────────
let files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
if (SLUG_FILTER) files = files.filter(f => f === SLUG_FILTER + '.json');
console.log('portals to consider: ' + files.length);

const todo = [];
let skippedNoCik = 0, skippedFresh = 0;
for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const cik = String(p.cik || '').replace(/^0+/, '');
  if (!cik) { skippedNoCik++; continue; }
  if (!FORCE) {
    const prior = p.kernelReadings && p.kernelReadings.k2;
    if (prior && prior.lastScored) {
      const ageHours = (Date.now() - new Date(prior.lastScored).getTime()) / 3600000;
      if (ageHours < STALE_HOURS) { skippedFresh++; continue; }
    }
  }
  todo.push({ slug: f.replace(/\.json$/, ''), cik, file: f, portal: p });
}
console.log('skip · no CIK (K3 frontier): ' + skippedNoCik);
console.log('skip · fresh K2 reading (<' + STALE_HOURS + 'h): ' + skippedFresh);
console.log('queued for K2 scoring:       ' + todo.length);
console.log();

if (DRY) { console.log('(dry run — nothing written; re-run with --apply)'); process.exit(0); }

// ─── score one portal: POST /api/helix/helix-report/score ─────────
async function scoreOne(t) {
  const url = BASE.replace(/\/$/, '') + '/api/helix/helix-report/score';
  let resp, data;
  try {
    resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cik: t.cik }) });
    if (!resp.ok) return { ok: false, status: resp.status, error: 'HTTP ' + resp.status };
    data = await resp.json();
  } catch (e) {
    return { ok: false, status: 0, error: String(e.message || e) };
  }
  // extract K2 reading from response. Shape (per phase_engine.py composer):
  //   data.thing2 | data.kernel | data.score → has dominant_phase, coupling_mode,
  //   intrinsic_source, _polyvagal_context_source, bias_contributions
  const k2 = data.thing2 || data.kernel || data.score || data;
  const reading = {
    phase: k2.dominant_phase || null,
    intrinsicPhase: k2.intrinsic_dominant_phase || null,
    coupling_mode: k2.coupling_mode || 'intrinsic_only',
    intrinsic_source: k2.intrinsic_source || 'unknown',
    polyvagal_context_source: k2._polyvagal_context_source || 'none',
    bias_contributions: k2.bias_contributions || null,
    composite: typeof k2.composite === 'number' ? k2.composite : null,
    trajectory: k2.trajectory || null,
    kernelId: 'phase_engine.py',
    lastScored: new Date().toISOString()
  };
  // K1 reading: if intrinsic_source = 'edgar_rows' AND intrinsic_dominant_phase exists,
  // we got a real K1 + K2 pair. Otherwise K1 stays null (will be filled by limen_v4 kernel).
  const k1 = (k2.intrinsic_source === 'edgar_rows' && k2.intrinsic_dominant_phase) ? {
    phase: k2.intrinsic_dominant_phase,
    composite: typeof k2.composite === 'number' ? k2.composite : null,
    alert: k2.alert === true,
    trajectory: k2.trajectory || null,
    kernelId: 'limen_backtest.py',
    lastScored: new Date().toISOString()
  } : null;
  // primary kernel selection: K2 (post-relaxation, fires for everyone with context),
  // fall back to K1 if K2 has no phase, then K3 (reserved).
  const primary = reading.phase ? 'k2' : (k1 && k1.phase ? 'k1' : 'k3');
  return { ok: true, reading, k1, primary };
}

// ─── concurrent pool with stable-rate dispatch ────────────────────
let done = 0, ok = 0, failed = 0, scored = 0, neutralPrior = 0;
const results = [];

async function worker() {
  while (todo.length > 0) {
    const t = todo.shift();
    if (!t) return;
    const r = await scoreOne(t);
    done++;
    if (r.ok) {
      ok++;
      if (r.reading.intrinsic_source === 'neutral_prior') neutralPrior++;
      if (r.reading.phase) scored++;
      // merge into portal
      t.portal.kernelReadings = {
        k1: r.k1 || (t.portal.kernelReadings && t.portal.kernelReadings.k1) || null,
        k2: r.reading,
        k3: (t.portal.kernelReadings && t.portal.kernelReadings.k3) || null,
        primary: r.primary
      };
      fs.writeFileSync(path.join(DIR, t.file), JSON.stringify(t.portal, null, 2));
      results.push({ slug: t.slug, ok: true, phase: r.reading.phase, mode: r.reading.coupling_mode, source: r.reading.intrinsic_source, primary: r.primary });
      if (done % 25 === 0) console.log('  ' + done + '/' + (done + todo.length) + ' done · ' + scored + ' scored · ' + neutralPrior + ' neutral · ' + failed + ' failed');
    } else {
      failed++;
      results.push({ slug: t.slug, ok: false, error: r.error, status: r.status });
      if (failed % 10 === 0) console.log('  ' + done + ' done, ' + failed + ' failed (most recent: ' + t.slug + ' ' + r.error + ')');
    }
  }
}

const startedAt = new Date().toISOString();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
const finishedAt = new Date().toISOString();

// ─── summary log ──────────────────────────────────────────────────
const summary = { startedAt, finishedAt, base: BASE, concurrency: CONCURRENCY, force: FORCE, total: done, ok, failed, scored, neutralPrior, byPrimary: results.reduce((acc, r) => { if (r.ok) acc[r.primary] = (acc[r.primary] || 0) + 1; return acc; }, {}), results: results.slice(0, 200) };
fs.writeFileSync(LOG_PATH, JSON.stringify(summary, null, 2));

console.log();
console.log('=== done ===');
console.log('total:   ' + done);
console.log('ok:      ' + ok);
console.log('failed:  ' + failed);
console.log('scored (has phase):     ' + scored);
console.log('neutral-prior (no edgar): ' + neutralPrior);
console.log('by primary kernel:       ' + JSON.stringify(summary.byPrimary));
console.log('summary log:             ' + LOG_PATH);
