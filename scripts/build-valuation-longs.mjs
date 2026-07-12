#!/usr/bin/env node
/**
 * build-valuation-longs.mjs — the corrected LONG / investment-primed set (operator
 * 2026-07-11): LONG = kernel1 trajectory RECOVERED (survived distress) AND undervalued
 * (valuation gap: phase-implied target > current price). RECOVERED alone still includes
 * fully-valued survivors (PepsiCo/XOM); the undervalued filter removes them.
 *
 * Per in-scope operating company (from command-board-eligible.json, FIRE excluded):
 *   1. POST /api/limen/score  -> trajectory (validated) + dominant_phase
 *   2. if trajectory === RECOVERED and phase is a LONG phase (PHASE_FACTOR>=1):
 *        assemble md {price(Yahoo), shares/revenue/netDebt(EDGAR)} -> computeValuation
 *        -> upsidePct. undervalued = upsidePct >= UPSIDE_MIN.
 *   3. LONG = RECOVERED AND undervalued.
 *
 * Writes assets/data/kernel-watchlist.json (investmentPrimed rebuilt). SEC rate-limited.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { computeValuation, PHASE_FACTOR } = require(path.join(ROOT, 'lib', 'valuation.js'));

const UA = 'LIMEN Helix research chrishubbel72@gmail.com';
const UPSIDE_MIN = 15;          // undervalued: >= 15% base-case upside
const MIN_REVENUE = 100e6;      // EV/Rev is meaningless below real revenue -> excludes pre-revenue biotech
const MULT_LO = 0.3, MULT_HI = 12;  // sane EV/Rev band -> drops near-zero-rev multiples + extraction errors
const CHEAP_RATIO = 0.75;       // undervalued = current EV/Rev < 75% of the company's own 5y median (>=25% below its norm)
const SLEEP_MS = 180;           // SEC-friendly pacing
const ONLY = process.argv[2] ? parseInt(process.argv[2], 10) : null;  // optional: limit N for a test run

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function get(url, headers = {}) {
  return new Promise((res) => { https.get(url, { headers: { 'User-Agent': UA, ...headers } }, r => {
    let s = ''; r.on('data', d => s += d); r.on('end', () => res({ status: r.statusCode, body: s })); }).on('error', () => res({ status: 0, body: '' })); });
}
function post(url, payload) {
  return new Promise((res) => { const data = JSON.stringify(payload); const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, 'User-Agent': UA } },
      r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res({ status: r.statusCode, body: s })); });
    req.on('error', () => res({ status: 0, body: '' })); req.write(data); req.end(); });
}
function conceptVal(cf, concepts, unit = 'USD', annualOnly = false) {
  for (const c of concepts) {
    const node = cf.facts?.['us-gaap']?.[c] || cf.facts?.['dei']?.[c];
    if (!node?.units?.[unit]) continue;
    let rows = node.units[unit].filter(r => r.val != null && r.end);
    if (annualOnly) { const a = rows.filter(r => r.start && (new Date(r.end) - new Date(r.start)) > 300 * 864e5); if (a.length) rows = a; }
    if (!rows.length) continue;
    rows.sort((a, b) => a.end.localeCompare(b.end));
    return rows[rows.length - 1].val;
  }
  return null;
}
// annual-revenue series [{end, val}] (dedup latest filing per fiscal end) for the historical multiple
function revenueSeries(cf, concepts = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']) {
  for (const c of concepts) {
    const node = cf.facts?.['us-gaap']?.[c];
    if (!node?.units?.USD) continue;
    const annual = node.units.USD.filter(r => r.val != null && r.end && r.start && (new Date(r.end) - new Date(r.start)) > 300 * 864e5);
    if (!annual.length) continue;
    const byEnd = new Map();
    for (const r of annual) { const p = byEnd.get(r.end); if (!p || (r.filed || '') > (p.filed || '')) byEnd.set(r.end, r); }
    return [...byEnd.values()].map(r => ({ end: r.end, val: r.val })).sort((a, b) => a.end.localeCompare(b.end));
  }
  return [];
}
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
async function marketData(cik, ticker) {
  const cfr = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  if (cfr.status !== 200) return null;
  let cf; try { cf = JSON.parse(cfr.body); } catch { return null; }
  const revenue = conceptVal(cf, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], 'USD', true);
  const debt = (conceptVal(cf, ['LongTermDebtNoncurrent', 'LongTermDebt']) || 0) + (conceptVal(cf, ['DebtCurrent', 'ShortTermBorrowings', 'LongTermDebtCurrent']) || 0);
  const cash = conceptVal(cf, ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']) || 0;
  const shares = conceptVal(cf, ['EntityCommonStockSharesOutstanding'], 'shares') || conceptVal(cf, ['CommonStockSharesOutstanding', 'CommonStockSharesIssued'], 'shares');
  if (!revenue || !shares) return null;
  const netDebt = debt - cash;
  await sleep(SLEEP_MS);
  const yr = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1mo`);
  let price = null, hi = null, lo = null, ts = [], close = [];
  try { const rslt = JSON.parse(yr.body).chart?.result?.[0] || {}; const m = rslt.meta || {};
    price = m.regularMarketPrice; hi = m.fiftyTwoWeekHigh; lo = m.fiftyTwoWeekLow;
    ts = rslt.timestamp || []; close = rslt.indicators?.quote?.[0]?.close || []; } catch {}
  if (price == null) return null;
  const currentMultiple = (price * shares + netDebt) / revenue;
  // company's own 5y median EV/Rev: at each past fiscal-year end, price-near-that-date * shares + netDebt / that year's revenue
  const rs = revenueSeries(cf).filter(r => r.val > 0);
  const hist = [];
  for (const r of rs) {
    const et = new Date(r.end).getTime() / 1000;
    let px = null, best = Infinity;
    for (let i = 0; i < ts.length; i++) { const d = Math.abs(ts[i] - et); if (close[i] != null && d < best && d < 75 * 864e2) { best = d; px = close[i]; } }
    if (px != null) hist.push((px * shares + netDebt) / r.val);
  }
  const histMedianMultiple = median(hist);
  return { price, shares, revenue, netDebt, week52High: hi, week52Low: lo, currentMultiple, histMedianMultiple, histN: hist.length };
}

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'command-board-eligible.json'), 'utf8'));
const rows = Array.isArray(raw) ? raw : (raw.companies || raw.rows || Object.values(raw));
const isFIRE = (r) => { const s = parseInt(String(r.sic || '').slice(0, 4), 10); return !isNaN(s) && s >= 6000 && s <= 6799; };
let inScope = rows.filter(r => (r.vs || r.validation_status) === 'validated' && !isFIRE(r));
if (ONLY) inScope = inScope.slice(0, ONLY);

const longs = [];
let checked = 0, recovered = 0, valued = 0;
for (const r of inScope) {
  checked++;
  const cik = String(r.c || r.cik || '').padStart(10, '0');
  const sr = await post('https://limenhelix.com/api/limen/score', { cik });
  await sleep(SLEEP_MS);
  let j; try { j = JSON.parse(sr.body); } catch { continue; }
  if (j.trajectory !== 'RECOVERED') continue;
  recovered++;
  const ph = String(j.dominant_phase || '').toLowerCase();
  if (!(PHASE_FACTOR[ph] >= 1)) continue;   // must be a LONG-side phase too
  const md = await marketData(cik, r.t || r.ticker);
  await sleep(SLEEP_MS);
  if (!md) continue;
  // SANITY: real revenue + sane multiple band -> excludes pre-revenue biotech + extraction errors
  if (md.revenue < MIN_REVENUE) continue;
  if (!(md.currentMultiple >= MULT_LO && md.currentMultiple <= MULT_HI)) continue;
  // CHEAPNESS: must trade below its OWN 5y median multiple (removes fully-valued re-rating names)
  if (!(md.histMedianMultiple > 0 && md.histN >= 3)) continue;   // need history to judge cheap
  const cheap = md.currentMultiple < CHEAP_RATIO * md.histMedianMultiple;
  if (!cheap) continue;
  const v = computeValuation(md, ph, 0.5, 'LONG', 1.25);
  if (!v || v.upsidePct == null) continue;
  valued++;
  if (v.upsidePct >= UPSIDE_MIN) {
    longs.push({ slug: r.s, name: r.n, ticker: r.t, cik, phase: ph, phaseFactor: PHASE_FACTOR[ph],
      trajectory: 'RECOVERED', price: v.price, target: v.pwTarget || v.probWeightedTarget || null,
      upsidePct: v.upsidePct, currentMultiple: Number(md.currentMultiple.toFixed(2)),
      histMedianMultiple: Number(md.histMedianMultiple.toFixed(2)),
      discountToHist: Number((100 * (1 - md.currentMultiple / md.histMedianMultiple)).toFixed(1)),
      asymmetry: v.asymmetry, sic: r.sic });
  }
  if (checked % 20 === 0) console.error(`  ...${checked}/${inScope.length} checked, ${recovered} recovered, ${valued} valued, ${longs.length} LONG`);
}
longs.sort((a, b) => b.upsidePct - a.upsidePct);

// merge into the watchlist (keep the SHORT set as-is; replace investmentPrimed)
const WL = path.join(ROOT, 'assets', 'data', 'kernel-watchlist.json');
const wl = JSON.parse(fs.readFileSync(WL, 'utf8'));
wl.criteria.long = 'investment-primed = kernel1 trajectory RECOVERED AND undervalued (computeValuation upsidePct >= ' + UPSIDE_MIN + '%). Recovered survivor still trading below phase-implied fair value.';
wl.investmentPrimed = longs;
wl.counts.investmentPrimed = longs.length;
wl.counts.surface = wl.counts.bankruptcyWatch + longs.length;
wl.valuationPass = { checkedInScope: checked, recovered, valued, longs: longs.length, upsideMin: UPSIDE_MIN };
fs.writeFileSync(WL, JSON.stringify(wl, null, 2));
console.error(`\nDONE: ${checked} in-scope -> ${recovered} RECOVERED -> ${valued} valued -> ${longs.length} LONG (recovered+undervalued >= ${UPSIDE_MIN}%)`);
longs.slice(0, 15).forEach(c => console.error(`  ${String(c.name).slice(0, 26).padEnd(28)} ${c.phase} $${c.price} -> $${c.target} (+${c.upsidePct}%)`));
