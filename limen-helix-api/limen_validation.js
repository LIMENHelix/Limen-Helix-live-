#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// LIMEN v4.0 Kernel — Self-Consistency Suite (Thing 2)
//
// This file runs `limen_v4_kernel.js` (Thing 2, v4 patent recursive)
// against an internal regression dataset to detect drift in the v4
// kernel's own behavior. It is NOT Thing 1 distress validation.
//
// Thing 1 (validated financial distress scorer) is api/thing1/limen_backtest.py
// and is hash-locked via api/thing1/VALIDATION_LOCK.json. This file does
// not exercise Thing 1 and cannot certify Thing 1.
//
// Zero modifications to kernel constants, thresholds, or window sizes.
// Calls runLimenPipeline() directly and uses its native alert output
// for self-consistency reporting only — that "alert" is the v4
// kernel's internal trajectory flag, not a Thing 1 validated alert.
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  LIMEN,
  runLimenPipeline,
  getDominantPhase,
  dateToQuarter,
} from './limen_v4_kernel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRED_API_KEY = process.env.FRED_API_KEY;
const SEC_UA = 'LIMEN-Helix validation research@limenhelix.com';
const RATE_MS = 120;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': SEC_UA, 'Accept': 'application/json' },
      });
      if (res.status === 429) {
        const wait = Math.min(30000, 5000 * (attempt + 1));
        console.log(`  429 rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      if (attempt < retries - 1) { await sleep(2000 * (attempt + 1)); continue; }
      throw e;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. FETCH BANKRUPTCY CIKs FROM EDGAR EFTS
// ═══════════════════════════════════════════════════════════════════

async function fetchBKCompanies(target = 300) {
  console.log(`\n[1/5] Fetching BK companies from EFTS (target: ${target})...`);
  const base = 'https://efts.sec.gov/LATEST/search-index';
  const params = 'q=%22chapter+11%22&forms=8-K&dateRange=custom&startdt=2000-01-01&enddt=2023-12-31';
  const seen = new Map();
  let from = 0;
  const pageSize = 100;

  while (seen.size < target && from < 8000) {
    const url = `${base}?${params}&from=${from}&size=${pageSize}`;
    let data;
    try { data = await fetchJSON(url); } catch (e) {
      console.log(`  EFTS error at offset ${from}: ${e.message}`);
      break;
    }
    const hits = data?.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const src = hit._source || {};
      let cik = src.entity_id || src.cik || src.ciks;
      if (Array.isArray(cik)) cik = cik[0];
      if (!cik && src.file_num) {
        const fn = Array.isArray(src.file_num) ? src.file_num[0] : src.file_num;
        if (fn) cik = fn;
      }
      if (!cik) continue;
      cik = String(cik).replace(/^0+/, '') || '0';
      const name = (Array.isArray(src.display_names) ? src.display_names[0] :
        src.entity_name || src.display_name || 'Unknown').trim();
      const filingDate = src.file_date || src.filing_date || null;
      if (!seen.has(cik)) seen.set(cik, { cik, name, filingDate });
      if (seen.size >= target) break;
    }
    from += pageSize;
    await sleep(RATE_MS);
    if (seen.size > 0 && seen.size % 100 === 0) console.log(`  Found ${seen.size} unique BK CIKs...`);
  }

  console.log(`  Total BK CIKs: ${seen.size}`);
  return Array.from(seen.values());
}

// ═══════════════════════════════════════════════════════════════════
// 2. HEALTHY CONTROL CIKs
// ═══════════════════════════════════════════════════════════════════

async function fetchHealthyCIKs(bkCIKSet, target = 150) {
  console.log(`\n[2/5] Building healthy control set (target: ${target})...`);
  const specified = [320193, 789019, 732834, 19617, 101830, 100030, 77476, 813672, 1090727, 1045810];
  const largeCaps = [
    1652044, 1018724, 1326801, 886982, 1403161, 1141391, 354950, 78003,
    21344, 200406, 51143, 34088, 858877, 2488, 4962, 1318605, 1467373,
    723125, 70858, 72971, 831001, 769397, 895421, 316206, 36270, 310158,
    63908, 804328, 1075531, 858470, 97745, 310764, 14693, 1551152,
    1085869, 1564902, 1113232, 40545, 14272, 65984, 49826, 37996,
    1339947, 60714, 1710582, 93410, 732717, 66740, 86312, 1000228,
  ];
  const healthy = [];
  const addedSet = new Set();
  function tryAdd(cik, name) {
    const cikStr = String(cik);
    if (bkCIKSet.has(cikStr) || addedSet.has(cikStr)) return;
    addedSet.add(cikStr);
    healthy.push({ cik: cikStr, name: name || `CIK-${cik}` });
  }
  for (const cik of specified) tryAdd(cik, `Specified-${cik}`);
  for (const cik of largeCaps) tryAdd(cik, `LargeCap-${cik}`);
  if (healthy.length < target) {
    try {
      const data = await fetchJSON('https://www.sec.gov/files/company_tickers.json');
      for (const entry of Object.values(data)) {
        if (healthy.length >= target) break;
        tryAdd(entry.cik_str, entry.title);
      }
    } catch (e) { console.log(`  Warning: could not fetch company tickers: ${e.message}`); }
  }
  console.log(`  Healthy controls: ${healthy.length}`);
  return healthy;
}

// ═══════════════════════════════════════════════════════════════════
// 3. XBRL DATA FETCHING & PARSING
// ═══════════════════════════════════════════════════════════════════

const REV_CONCEPTS = [
  'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueGoodsNet',
];
const OCF_CONCEPTS = [
  'NetCashProvidedByUsedInOperatingActivities',
  'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
];
const CASH_CONCEPTS = [
  'CashAndCashEquivalentsAtCarryingValue',
  'CashCashEquivalentsAndShortTermInvestments', 'CashAndDueFromBanks',
];
const DEBT_CONCEPTS = [
  'LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations',
];

function findFacts(usGaap, conceptNames) {
  for (const name of conceptNames) {
    const concept = usGaap[name];
    if (concept?.units?.USD && concept.units.USD.length > 0) return concept.units.USD;
  }
  return [];
}

function factsToQuarterly(facts, isFlow, beforeDate) {
  const quarterly = {};
  const byFY = {};
  for (const f of facts) {
    if (f.form !== '10-Q' && f.form !== '10-K') continue;
    if (beforeDate && new Date(f.end) > beforeDate) continue;
    if (f.val === null || f.val === undefined) continue;
    const endDate = new Date(f.end);
    const qKey = dateToQuarter(endDate);
    if (isFlow) {
      if (f.fp === 'Q1' || f.fp === 'Q2' || f.fp === 'Q3') quarterly[qKey] = f.val;
      if (f.fy) {
        if (!byFY[f.fy]) byFY[f.fy] = {};
        if (f.fp === 'FY') { byFY[f.fy].FY = f.val; byFY[f.fy].FY_end = f.end; }
        if (f.fp === 'Q1' || f.fp === 'Q2' || f.fp === 'Q3') {
          if (!byFY[f.fy].q) byFY[f.fy].q = {};
          byFY[f.fy].q[f.fp] = f.val;
        }
      }
    } else {
      quarterly[qKey] = f.val;
    }
  }
  if (isFlow) {
    for (const [fy, data] of Object.entries(byFY)) {
      if (data.FY !== undefined && data.q && Object.keys(data.q).length === 3) {
        const q4Val = data.FY - (data.q.Q1 || 0) - (data.q.Q2 || 0) - (data.q.Q3 || 0);
        if (data.FY_end) {
          const qKey = dateToQuarter(new Date(data.FY_end));
          if (quarterly[qKey] === undefined) quarterly[qKey] = q4Val;
        }
      }
    }
  }
  return quarterly;
}

function extractQuarterlyData(companyFacts, beforeDate) {
  const usGaap = companyFacts?.facts?.['us-gaap'] || {};
  return {
    Revenue: factsToQuarterly(findFacts(usGaap, REV_CONCEPTS), true, beforeDate),
    OCF: factsToQuarterly(findFacts(usGaap, OCF_CONCEPTS), true, beforeDate),
    Cash: factsToQuarterly(findFacts(usGaap, CASH_CONCEPTS), false, beforeDate),
    Debt: factsToQuarterly(findFacts(usGaap, DEBT_CONCEPTS), false, beforeDate),
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. FRED DFF (Federal Funds Rate)
// ═══════════════════════════════════════════════════════════════════

async function fetchFREDDelta() {
  console.log(`\n[3/5] Fetching FRED DFF series...`);
  if (!FRED_API_KEY) {
    console.log('  Warning: FRED_API_KEY not set, skipping macro data');
    return {};
  }
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${FRED_API_KEY}&file_type=json&observation_start=1999-01-01&frequency=q&aggregation_method=avg`;
  const data = await fetchJSON(url);
  const obs = data?.observations || [];
  const quarterlyAvg = {};
  for (const o of obs) {
    if (o.value === '.' || o.value === undefined) continue;
    quarterlyAvg[dateToQuarter(new Date(o.date))] = parseFloat(o.value);
  }
  const fredDelta = {};
  const keys = Object.keys(quarterlyAvg).sort();
  for (let i = 1; i < keys.length; i++) fredDelta[keys[i]] = quarterlyAvg[keys[i]] - quarterlyAvg[keys[i - 1]];
  console.log(`  FRED quarters: ${keys.length}, deltas: ${Object.keys(fredDelta).length}`);
  return fredDelta;
}

// ═══════════════════════════════════════════════════════════════════
// 5. PR-AUC
// ═══════════════════════════════════════════════════════════════════

function computePRAUC(items) {
  if (items.length === 0) return 0;
  const sorted = items.slice().sort((a, b) => b.score - a.score);
  const totalPos = sorted.filter(i => i.label === 1).length;
  if (totalPos === 0) return 0;
  let tp = 0, fp = 0;
  const precisions = [], recalls = [];
  for (const item of sorted) {
    if (item.label === 1) tp++; else fp++;
    precisions.push(tp / (tp + fp));
    recalls.push(tp / totalPos);
  }
  let auc = 0;
  for (let i = 1; i < recalls.length; i++) {
    const dr = recalls[i] - recalls[i - 1];
    if (dr > 0) auc += dr * (precisions[i] + precisions[i - 1]) / 2;
  }
  return auc;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  const fredDelta = await fetchFREDDelta();
  const bkCompanies = await fetchBKCompanies(300);
  const bkCIKSet = new Set(bkCompanies.map(c => c.cik));
  const healthyCompanies = await fetchHealthyCIKs(bkCIKSet, 150);

  const allCompanies = [
    ...bkCompanies.map(c => ({ ...c, label: 1 })),
    ...healthyCompanies.map(c => ({ ...c, label: 0 })),
  ];

  console.log(`\n[4/5] Scoring ${allCompanies.length} companies via runLimenPipeline()...`);

  const results = [];
  let skipped = 0, errors = 0;

  for (let i = 0; i < allCompanies.length; i++) {
    const co = allCompanies[i];
    try {
      const paddedCik = co.cik.padStart(10, '0');
      const facts = await fetchJSON(`https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`);
      await sleep(RATE_MS);

      const entityName = facts?.entityName || co.name;

      // BK companies: only pre-bankruptcy data. Healthy: all data.
      const beforeDate = co.label === 1 && co.filingDate ? new Date(co.filingDate) : null;
      const companyData = extractQuarterlyData(facts, beforeDate);

      const revCount = Object.keys(companyData.Revenue).length;
      const ocfCount = Object.keys(companyData.OCF).length;
      if (revCount < 5 && ocfCount < 5) { skipped++; continue; }

      // Call the kernel pipeline directly — zero modifications
      const result = runLimenPipeline(companyData, fredDelta);
      if (!result.rows || result.rows.length === 0) { skipped++; continue; }

      const lastRow = result.rows[result.rows.length - 1];
      let maxCt = 0;
      result.rows.forEach(r => { if (r.C_t > maxCt) maxCt = r.C_t; });

      results.push({
        cik: co.cik,
        name: entityName,
        label: co.label,
        alert: result.alert,
        composite: result.composite,
        trajectory: result.trajectory,
        C_t: lastRow.C_t || 0,
        maxC_t: maxCt,
        dominantPhase: getDominantPhase(lastRow),
        quarterCount: result.rows.length,
        pathA: result.details.pathA,
        pathB: result.details.pathB,
        pathC: result.details.pathC,
        hystAlert: lastRow.hysteresis_alert,
      });
    } catch (e) {
      errors++;
    }

    if ((i + 1) % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  [${i + 1}/${allCompanies.length}] scored: ${results.length}, skipped: ${skipped}, errors: ${errors} (${elapsed}s)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // [5/5] METRICS — using kernel's native alert as binary decision
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n[5/5] Computing metrics...`);

  const bkResults = results.filter(r => r.label === 1);
  const healthyResults = results.filter(r => r.label === 0);

  // PR-AUC: composite score as continuous ranking signal
  const prAUC = computePRAUC(results.map(r => ({ label: r.label, score: r.composite })));

  // Confusion matrix: kernel's native alert boolean
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of results) {
    if (r.label === 1 && r.alert) tp++;
    else if (r.label === 0 && r.alert) fp++;
    else if (r.label === 0 && !r.alert) tn++;
    else fn++;
  }
  const recall = tp / Math.max(tp + fn, 1);
  const fpr = fp / Math.max(fp + tn, 1);
  const precision = tp / Math.max(tp + fp, 1);
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const meanCtBK = bkResults.length > 0 ? bkResults.reduce((a, r) => a + r.C_t, 0) / bkResults.length : 0;
  const meanCtH = healthyResults.length > 0 ? healthyResults.reduce((a, r) => a + r.C_t, 0) / healthyResults.length : 0;
  const meanCompBK = bkResults.length > 0 ? bkResults.reduce((a, r) => a + r.composite, 0) / bkResults.length : 0;
  const meanCompH = healthyResults.length > 0 ? healthyResults.reduce((a, r) => a + r.composite, 0) / healthyResults.length : 0;

  // ═══════════════════════════════════════════════════════════════
  // AUDIT TRAIL — show your work
  // ═══════════════════════════════════════════════════════════════
  console.log('\n===================================================');
  console.log('  PATENT VALIDATION — AUDIT TRAIL');
  console.log('===================================================');
  console.log();
  console.log('  Function called:');
  console.log('    runLimenPipeline(companyData, fredDelta)');
  console.log('    Signature: function runLimenPipeline(companyData, fredDelta)');
  console.log('    Returns: { composite, firstQ, alert, trajectory, details, rows }');
  console.log('    Note: score_company() wraps this but discards alert/composite/details.');
  console.log('    Pipeline called directly to access native alert decision.');
  console.log();
  console.log('  Constants used (read from LIMEN object, not overridden):');
  console.log(`    COMPOSITE_THRESH_A: ${LIMEN.COMPOSITE_THRESH_A}`);
  console.log(`    COMPOSITE_THRESH_B: ${LIMEN.COMPOSITE_THRESH_B}`);
  console.log(`    COMPOSITE_THRESH_C: ${LIMEN.COMPOSITE_THRESH_C}`);
  console.log(`    HYSTERESIS_CONSEC:  ${LIMEN.HYSTERESIS_CONSEC}`);
  console.log(`    LAMBDA:             ${LIMEN.LAMBDA}`);
  console.log(`    START_YEAR:         ${LIMEN.START_YEAR}`);
  console.log(`    P3_ENTRY:           ${LIMEN.P3_ENTRY}`);
  console.log();
  console.log('  Confirmation: NO constants were modified from limen_v4_kernel.js.');
  console.log('  The LIMEN object was imported read-only and used as-is.');
  console.log();
  console.log('---------------------------------------------------');
  console.log('  First 3 company scores:');
  console.log('---------------------------------------------------');

  for (let i = 0; i < Math.min(3, results.length); i++) {
    const r = results[i];
    const alertA = r.pathA >= LIMEN.COMPOSITE_THRESH_A;
    const alertB = r.pathB >= LIMEN.COMPOSITE_THRESH_B;
    const alertC = r.pathC >= LIMEN.COMPOSITE_THRESH_C;

    let firedLine;
    if (r.alert) {
      const paths = [];
      if (alertA) paths.push(`pathA(${r.pathA.toFixed(3)}) >= ${LIMEN.COMPOSITE_THRESH_A} [limen_v4_kernel.js:751]`);
      if (alertB) paths.push(`pathB(${r.pathB.toFixed(3)}) >= ${LIMEN.COMPOSITE_THRESH_B} [limen_v4_kernel.js:752]`);
      if (alertC) paths.push(`pathC(${r.pathC.toFixed(3)}) >= ${LIMEN.COMPOSITE_THRESH_C} [limen_v4_kernel.js:753]`);
      firedLine = paths.join('\n                    ') + `\n                    && hystAlert=true [limen_v4_kernel.js:754]`;
    } else {
      if (!alertA && !alertB && !alertC) {
        firedLine = `No path reached threshold: pathA=${r.pathA.toFixed(3)}<${LIMEN.COMPOSITE_THRESH_A}, pathB=${r.pathB.toFixed(3)}<${LIMEN.COMPOSITE_THRESH_B}, pathC=${r.pathC.toFixed(3)}<${LIMEN.COMPOSITE_THRESH_C}`;
      } else {
        const paths = [];
        if (alertA) paths.push(`pathA(${r.pathA.toFixed(3)})`);
        if (alertB) paths.push(`pathB(${r.pathB.toFixed(3)})`);
        if (alertC) paths.push(`pathC(${r.pathC.toFixed(3)})`);
        firedLine = `${paths.join('+')} exceeded threshold BUT hystAlert=${r.hystAlert} blocked [limen_v4_kernel.js:754]`;
      }
    }

    console.log();
    console.log(`  [${i + 1}] ${r.name} (CIK ${r.cik})`);
    console.log(`      Label:    ${r.label === 1 ? 'BANKRUPT' : 'HEALTHY'}`);
    console.log(`      C_t:      ${r.C_t.toFixed(4)}`);
    console.log(`      Alert:    ${r.alert}`);
    console.log(`      Fired by: ${firedLine}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION RESULTS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n===================================================');
  console.log('  LIMEN v4.0 — VALIDATION RESULTS');
  console.log('===================================================');
  console.log(`  BK scored:      ${bkResults.length}`);
  console.log(`  Healthy scored: ${healthyResults.length}`);
  console.log(`  Skipped: ${skipped}  Errors: ${errors}`);
  console.log('---------------------------------------------------');
  console.log(`  PR-AUC (composite):  ${prAUC.toFixed(4)}`);
  console.log('---------------------------------------------------');
  console.log(`  Kernel native alert → TP: ${tp}  FP: ${fp}  TN: ${tn}  FN: ${fn}`);
  console.log(`  Recall:     ${recall.toFixed(4)}`);
  console.log(`  FPR:        ${fpr.toFixed(4)}`);
  console.log(`  Precision:  ${precision.toFixed(4)}`);
  console.log(`  F1:         ${f1.toFixed(4)}`);
  console.log('---------------------------------------------------');
  console.log(`  Alert rate (BK):      ${bkResults.length > 0 ? (bkResults.filter(r => r.alert).length / bkResults.length * 100).toFixed(1) : 0}%`);
  console.log(`  Alert rate (Healthy): ${healthyResults.length > 0 ? (healthyResults.filter(r => r.alert).length / healthyResults.length * 100).toFixed(1) : 0}%`);
  console.log('---------------------------------------------------');
  console.log(`  Mean C_t (BK):           ${meanCtBK.toFixed(4)}`);
  console.log(`  Mean C_t (Healthy):      ${meanCtH.toFixed(4)}`);
  console.log(`  Mean composite (BK):     ${meanCompBK.toFixed(4)}`);
  console.log(`  Mean composite (Healthy):${meanCompH.toFixed(4)}`);
  console.log('---------------------------------------------------');

  // Phase distribution
  const phaseBK = {}, phaseH = {};
  bkResults.forEach(r => { phaseBK[r.dominantPhase] = (phaseBK[r.dominantPhase] || 0) + 1; });
  healthyResults.forEach(r => { phaseH[r.dominantPhase] = (phaseH[r.dominantPhase] || 0) + 1; });
  console.log(`  Phase dist (BK):      ${JSON.stringify(phaseBK)}`);
  console.log(`  Phase dist (Healthy): ${JSON.stringify(phaseH)}`);

  // Trajectory distribution
  const trajBK = {}, trajH = {};
  bkResults.forEach(r => { trajBK[r.trajectory] = (trajBK[r.trajectory] || 0) + 1; });
  healthyResults.forEach(r => { trajH[r.trajectory] = (trajH[r.trajectory] || 0) + 1; });
  console.log(`  Trajectory (BK):      ${JSON.stringify(trajBK)}`);
  console.log(`  Trajectory (Healthy): ${JSON.stringify(trajH)}`);

  console.log(`\n  Runtime: ${elapsed}s`);
  console.log('===================================================\n');

  // Save
  const output = {
    meta: {
      generated: new Date().toISOString(),
      kernel: 'v4.0 patent',
      signal: 'native alert from runLimenPipeline()',
      rankingSignal: 'composite (max of pathA, pathB, pathC)',
      constantsUnmodified: true,
      COMPOSITE_THRESH_A: LIMEN.COMPOSITE_THRESH_A,
      HYSTERESIS_CONSEC: LIMEN.HYSTERESIS_CONSEC,
      LAMBDA: LIMEN.LAMBDA,
      START_YEAR: LIMEN.START_YEAR,
      runtimeSeconds: parseFloat(elapsed),
      bkScored: bkResults.length,
      healthyScored: healthyResults.length,
      skipped, errors,
    },
    metrics: { prAUC, recall, fpr, precision, f1, tp, fp, tn, fn,
      meanC_t_BK: meanCtBK, meanC_t_Healthy: meanCtH,
      meanComposite_BK: meanCompBK, meanComposite_Healthy: meanCompH,
    },
    companies: results,
  };

  const outPath = path.join(__dirname, 'bk_validation_results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Results saved to ${outPath}`);
}

main().catch(e => { console.error('Fatal error:', e.message); process.exit(1); });
