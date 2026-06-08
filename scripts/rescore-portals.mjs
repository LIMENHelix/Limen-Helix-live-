#!/usr/bin/env node
/**
 * rescore-portals.mjs — Consistent EDGAR -> portal refresh.
 *
 * THE MISSING LINK: company portal JSONs (assets/data/companies/*.json) store
 * `financialHealth` that was baked ONCE by migrate-v2-portals-to-v201.js
 * (~Nov 2024) and never refreshed, even though live EDGAR is current. This
 * script re-scores each portal against the LIVE envelope-aware kernel
 * (/api/limen/score) and writes the fresh, envelope-classified financialHealth
 * back into each JSON — so portals stop showing 2024 data.
 *
 * It calls the deployed endpoint (single source of truth for the envelope
 * gates) rather than re-implementing scoring. Rate-limited for SEC/Vercel.
 *
 * Usage:
 *   node scripts/rescore-portals.mjs --limit 5 --dry-run     # preview mapping
 *   node scripts/rescore-portals.mjs --stale-only            # only refresh non-current
 *   node scripts/rescore-portals.mjs                         # full corpus
 *   node scripts/rescore-portals.mjs --base http://localhost:3000
 *
 * Writes a progress log to scripts/_rescore-portals-log.jsonl (resumable).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const LOG = path.join(__dirname, '_rescore-portals-log.jsonl');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = has('--dry-run');
const STALE_ONLY = has('--stale-only');
const LIMIT = parseInt(val('--limit', '0'), 10) || 0;
const BASE = val('--base', 'https://limenhelix.com');
const PACE_MS = parseInt(val('--pace', '700'), 10); // SEC-friendly
const URL = BASE + '/api/limen/score';

// Current quarter (for stale-only filtering)
const NOW = new Date();
const NOW_Y = NOW.getUTCFullYear();
const NOW_Q = Math.floor(NOW.getUTCMonth() / 3) + 1;
function qAgeOf(latest) {
  const m = /^(\d{4})Q([1-4])$/.exec(latest || '');
  if (!m) return 999;
  return (NOW_Y - +m[1]) * 4 + (NOW_Q - +m[2]);
}

function bandFor(r) {
  if (r.interpretive_only) return 'gray';      // out of envelope -> not a validated read
  if (r.alert) return 'red';
  if ((r.composite_score || 0) >= 0.75) return 'yellow';
  return 'green';
}

// Map the live endpoint response into the financialHealth schema the portal
// renderer already understands, plus the new envelope fields.
function toFinancialHealth(r, nowIso) {
  return {
    asOf: nowIso.slice(0, 10),
    lastKernelRun: nowIso,
    kernelId: r.kernel_id || 'limen_backtest.py',
    kernelShaLock: (r.kernel_sha256_lock || '').slice(0, 16),
    validationStatus: r.validation_status,
    // ── envelope (new) ──
    inEnvelope: r.in_envelope,
    interpretiveOnly: r.interpretive_only,
    envelopeStatusCode: r.envelope_status_code,
    envelopeDisclaimer: r.envelope_disclaimer,
    regimeContext: r.regime_context,
    isFinancial: r.is_financial,
    sicCode: r.sic_code,
    // ── verdict ──
    historyQuarters: r.history_quarters,
    latestQuarter: r.latest_quarter,
    alert: r.alert,
    alertA: r.alert_a,
    alertB: r.alert_b,
    alertC: r.alert_c,
    pathway: r.pathway,
    firstAlertQuarter: r.first_alert_quarter,
    distressBand: bandFor(r),
    compositeScore: r.composite_score,
    dominantPhase: r.dominant_phase,
    financialState: r.financial_state || {},
    inputPresence: r.input_presence || {},
  };
}

async function scoreCik(cik) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cik }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch {}
    return { _error: `HTTP ${res.status}${detail ? ' ' + detail : ''}` };
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  let scanned = 0, updated = 0, skipped = 0, errored = 0;
  const buckets = {};
  const tally = (s) => { buckets[s] = (buckets[s] || 0) + 1; };

  for (const f of files) {
    const fp = path.join(DIR, f);
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const cik = (j.cik || '').toString();
    if (!cik || /[^0-9]/.test(cik.replace(/^0+/, ''))) { skipped++; continue; }

    if (STALE_ONLY) {
      const lq = j.financialHealth && j.financialHealth.latestQuarter;
      if (qAgeOf(lq) <= 2) { skipped++; continue; }   // already current
    }

    scanned++;
    if (LIMIT && scanned > LIMIT) { scanned--; break; }

    const r = await scoreCik(cik);
    if (r._error) {
      errored++; tally('error:' + r._error.slice(0, 24));
      fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), slug: j.slug || f, cik, error: r._error }) + '\n');
      console.log(`  ✗ ${(j.slug || f).padEnd(38)} ${r._error}`);
      await sleep(PACE_MS); continue;
    }

    const fh = toFinancialHealth(r, new Date(NOW.getTime()).toISOString());
    tally(fh.validationStatus);
    console.log(`  ${fh.distressBand === 'red' ? '🔴' : fh.inEnvelope ? '🟢' : '⚪'} ${(j.slug || f).padEnd(38)} ${String(fh.validationStatus).padEnd(20)} ${fh.latestQuarter || '-'}  ${fh.alert ? 'ALERT ' + (fh.pathway || '') : ''}`);

    if (!DRY) {
      j.financialHealth = { ...(j.financialHealth || {}), ...fh };
      fs.writeFileSync(fp, JSON.stringify(j));
      fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), slug: j.slug || f, cik, status: fh.validationStatus, latest: fh.latestQuarter, alert: fh.alert }) + '\n');
      updated++;
    }
    await sleep(PACE_MS);
  }

  console.log('\n=== RESCORE SUMMARY ' + (DRY ? '(DRY RUN — nothing written)' : '') + ' ===');
  console.log(`  scanned: ${scanned}  updated: ${updated}  skipped: ${skipped}  errored: ${errored}`);
  console.log('  buckets:');
  Object.entries(buckets).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k.padEnd(28)} ${v}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
