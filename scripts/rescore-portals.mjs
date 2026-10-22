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
import investmentEngine from './run-investment-engine.js';

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

/* Completed Thing 1 provenance means validated, not merely present. A recent
   portal whose last run was unvalidated, stale, ingestion-suspect or
   unavailable must be retried once the runtime or data is restored. */
export function hasThing1Provenance(financialHealth) {
  const p = financialHealth && financialHealth.thing1Validation;
  /* Legacy provenance objects without the protected identity and canonical
     Thing Zero fields are not current and must be rescored. */
  return !!(p
    && p.status === 'validated'
    && p.available === true
    && p.effectiveStatus === 'validated'
    && p.kernelId === 'limen_backtest.py'
    && p.thing0Qualification === 'qualified'
    && p.thing0PermitsThing1Use === true);
}

/* Affirmative Thing 0 qualification. Missing, malformed, refused, partial or
   non-permitting evidence is not qualification, even when the filing quarter
   is recent. This is migration/readiness logic; it does not authorize an
   investment selection and does not replace the downstream Thing 1 gate. */
export function hasThing0Qualification(financialHealth) {
  const t0 = financialHealth && financialHealth.thing0Eligibility;
  if (!t0 || typeof t0 !== 'object' || Array.isArray(t0)) return false;
  return t0.qualification_status === 'qualified'
    && t0.permits_thing1_use === true;
}

/* Skip a recent record only when BOTH provenances are affirmative. The
   investment engine continues to consume Thing 1 validation alone; Thing 0
   remains the upstream qualifier for Thing 1. */
export function shouldRescoreStaleOnly(portal) {
  const fh = portal && portal.financialHealth;
  if (!fh) return true;
  if (qAgeOf(fh.latestQuarter) > 2) return true;
  return !(hasThing1Provenance(fh) && hasThing0Qualification(fh));
}

function bandFor(r) {
  /* The band is a Thing 1 display. A Thing 0 refusal arrives as
     not_permitted_by_thing0, so this does not need a Thing 0 check. */
  if (r.validation_status !== 'validated') return 'gray';
  if (r.interpretive_only) return 'gray';      // out of envelope -> not a validated read
  if (r.alert) return 'red';
  if ((r.composite_score || 0) >= 0.75) return 'yellow';
  return 'green';
}

/* Derive effective Thing One authority from the whole response. A raw
   validation_status of 'validated' is not enough: the protected scorer
   identity, affirmative Thing Zero qualification/permission and the absence of
   fingerprint, envelope or interpretive refusals must all agree. Raw fields
   are preserved separately for diagnostics. */
export function deriveThing1Authority(r) {
  const rawKernel = r && r.kernel_id;
  const kernelId = typeof rawKernel === 'string' && rawKernel.trim() ? rawKernel.trim() : null;
  const validationStatus = r && r.validation_status;
  const t0 = r && (r.thing0_eligibility || r.thing0Eligibility) || null;

  const t0IsObject = !!(t0 && typeof t0 === 'object' && !Array.isArray(t0));
  const statusSnake = t0IsObject && typeof t0.qualification_status === 'string'
    ? t0.qualification_status : null;
  const statusCamel = t0IsObject && typeof t0.qualificationStatus === 'string'
    ? t0.qualificationStatus : null;
  const statusContradictory = statusSnake !== null && statusCamel !== null
    && statusSnake.toLowerCase() !== statusCamel.toLowerCase();
  const t0Status = statusSnake || statusCamel;
  const permitsSnake = t0IsObject && typeof t0.permits_thing1_use === 'boolean'
    ? t0.permits_thing1_use : null;
  const permitsCamel = t0IsObject && typeof t0.permitsThing1Use === 'boolean'
    ? t0.permitsThing1Use : null;
  const permitsContradictory = permitsSnake !== null && permitsCamel !== null
    && permitsSnake !== permitsCamel;
  const t0Qualified = !statusContradictory && t0Status === 'qualified';
  const t0Permits = !permitsContradictory && (permitsSnake === true || permitsCamel === true);

  const fp = r && r.fingerprint_status;
  const fpState = fp && typeof fp === 'object' ? fp.state : (typeof fp === 'string' ? fp : null);
  const fingerprintRefused = !!(fpState && fpState !== 'match');
  const interpretiveRefused = !!(r && r.interpretive_only === true);
  const envelopeCode = r && r.envelope_status_code;
  const envelopeRefused = !!(r && (r.in_envelope === false
    || (envelopeCode && envelopeCode !== 'ELIGIBLE_NOW')));

  let reason = null;
  if (validationStatus !== 'validated') {
    reason = 'validation_not_validated:' + (validationStatus || 'unavailable');
  } else if (!kernelId) {
    reason = 'kernel_id_missing';
  } else if (kernelId !== 'limen_backtest.py') {
    reason = 'kernel_id_wrong:' + kernelId;
  } else if (t0 === null || t0 === undefined) {
    reason = 'thing0_missing';
  } else if (!t0IsObject) {
    reason = 'thing0_malformed';
  } else if (statusContradictory || permitsContradictory) {
    reason = 'thing0_evidence_contradictory';
  } else if (!t0Status) {
    reason = 'thing0_malformed';
  } else if (!t0Qualified) {
    reason = 'thing0_not_qualified:' + t0Status;
  } else if (permitsSnake === null && permitsCamel === null) {
    reason = 'thing0_permission_missing';
  } else if (!t0Permits) {
    reason = 'thing0_permission_false';
  } else if (fingerprintRefused) {
    reason = 'fingerprint_refused:' + fpState;
  } else if (interpretiveRefused) {
    reason = 'interpretive_refusal';
  } else if (envelopeRefused) {
    reason = 'envelope_refused:' + (envelopeCode || 'out_of_envelope');
  }

  const available = reason === null;
  return {
    available,
    status: validationStatus || 'unavailable',
    effectiveStatus: available ? 'validated' : (reason || 'unavailable'),
    kernelId,
    kernelIdValid: kernelId === 'limen_backtest.py',
    thing0Present: t0IsObject,
    thing0Qualification: t0IsObject && typeof t0Status === 'string' ? t0Status : 'unavailable',
    thing0PermitsThing1Use: t0Permits === true,
    refusalReason: reason,
    raw: {
      validation_status: validationStatus === undefined ? null : validationStatus,
      kernel_id: rawKernel === undefined ? null : rawKernel,
      thing0_qualification_status: statusSnake,
      thing0_qualification_status_camel: statusCamel,
      permits_thing1_use: permitsSnake,
      permits_thing1_use_camel: permitsCamel,
      fingerprint_status: r && r.fingerprint_status !== undefined ? r.fingerprint_status : null,
      in_envelope: r && r.in_envelope !== undefined ? r.in_envelope : null,
      interpretive_only: r && r.interpretive_only !== undefined ? r.interpretive_only : null,
      envelope_status_code: envelopeCode === undefined ? null : envelopeCode
    }
  };
}

// Map the live endpoint response into the financialHealth schema the portal
// renderer already understands, plus the new envelope fields.
export function toFinancialHealth(r, nowIso) {
  const authority = deriveThing1Authority(r);
  return {
    asOf: nowIso.slice(0, 10),
    lastKernelRun: nowIso,
    kernelId: authority.kernelId,
    kernelShaLock: (r.kernel_sha256_lock || '').slice(0, 16),
    validationStatus: r.validation_status,
    /* THING 1 PROVENANCE. Investment and the portal consume this, not Thing 0.
       Availability is derived from the full authority chain; raw response
       fields are retained under `raw` for diagnostics. */
    thing1Validation: {
      status: authority.status,
      effectiveStatus: authority.effectiveStatus,
      available: authority.available,
      kernelId: authority.kernelId,
      kernelIdValid: authority.kernelIdValid,
      thing0Present: authority.thing0Present,
      thing0Qualification: authority.thing0Qualification,
      thing0PermitsThing1Use: authority.thing0PermitsThing1Use,
      refusalReason: authority.refusalReason,
      source: 'api/limen/score',
      runAt: nowIso,
      raw: authority.raw
    },
    // ── Thing 0 qualification (authoritative; absent means unavailable) ──
    thing0Eligibility: r.thing0_eligibility || r.thing0Eligibility || null,
    thing0PermitsThing1: authority.thing0PermitsThing1Use,
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
    pathA: r.path_a_score,
    pathB: r.path_b_score,
    pathC: r.path_c_score,
    pathAThreshold: r.path_a_threshold,
    pathBThreshold: r.path_b_threshold,
    pathCThreshold: r.path_c_threshold,
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
      if (!shouldRescoreStaleOnly(j)) { skipped++; continue; }
      const lq = j.financialHealth && j.financialHealth.latestQuarter;
      if (qAgeOf(lq) <= 2) {
        /* Report which provenance is actually absent. A recent record can now
           be rescored for missing Thing 0 while Thing 1 is validated. */
        const fh = j.financialHealth || {};
        const missing = [];
        if (!hasThing1Provenance(fh)) missing.push('thing1');
        if (!hasThing0Qualification(fh)) missing.push('thing0');
        tally('rescored:missing-' + missing.join('+') + '-provenance');
      }
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
      applyFinancialRefresh(j, fh, new Date(NOW.getTime()).toISOString());
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

/* Fields owned by the Thing 1 verdict. A refresh replaces these and preserves
   authored fundamentals not in this set (revenueLast4Q, margins, free cash
   flow, etc.). */
const KERNEL_VERDICT_FIELDS = [
  'asOf', 'lastKernelRun', 'kernelId', 'kernelShaLock', 'validationStatus',
  'thing1Validation', 'thing0Eligibility', 'thing0PermitsThing1', 'inEnvelope',
  'interpretiveOnly', 'envelopeStatusCode', 'envelopeDisclaimer', 'regimeContext',
  'isFinancial', 'sicCode', 'historyQuarters', 'latestQuarter', 'alert',
  'alertA', 'alertB', 'alertC', 'pathA', 'pathB', 'pathC',
  'pathAThreshold', 'pathBThreshold', 'pathCThreshold', 'pathway',
  'firstAlertQuarter', 'distressBand', 'compositeScore', 'dominantPhase',
  'financialState', 'inputPresence', 'envelopeStatus', 'phaseStateLabel',
  'stressRate', 'quarantine'
];

export function applyFinancialRefresh(portal, financialHealth, at) {
  /* THE VERDICT SUBSET IS REPLACED; AUTHORED FUNDAMENTALS ARE KEPT. Deleting
     the whole object removed revenueLast4Q, margins and free cash flow, which
     are independent financial inputs used by the stage classifier and engine
     context builder. */
  const preserved = { ...(portal.financialHealth || {}) };
  for (const key of KERNEL_VERDICT_FIELDS) delete preserved[key];
  portal.financialHealth = { ...preserved, ...financialHealth };
  const p = financialHealth.thing1Validation;
  const thing1Validated = !!(p
    && p.status === 'validated'
    && p.available === true
    && p.effectiveStatus === 'validated'
    && p.kernelId === 'limen_backtest.py'
    && p.thing0Qualification === 'qualified'
    && p.thing0PermitsThing1Use === true);
  if (!thing1Validated) {
    investmentEngine.quarantineInvestmentSignals(portal, 'thing1_not_validated', at);
  }
  return portal;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
