#!/usr/bin/env node
/**
 * build-kernel-watchlist.mjs — the ONLY companies that matter (operator directive
 * 2026-07-11): the kernel is validated for a small % of companies where it calls
 * bankruptcy ~12-20mo out. Track exactly those + investment-primed names; suppress
 * the rest.
 *
 * SHORT / bankruptcy-call set = a company that is BOTH:
 *   (1) inside the validated envelope (vs === 'validated' / es === 'ELIGIBLE_NOW'),
 *       so the kernel's claim is in-scope (out-of-envelope alerts are NOT valid), AND
 *   (2) actively alerting (kernel alert flag: RUPTURE / CASH_DECLINE / UNRECOVERED_P3).
 *
 * LONG / investment-primed set = pending operator definition (no signal exists yet).
 *
 * Reads command-board-eligible.json (the validated-envelope source). Writes
 * assets/data/kernel-watchlist.json — the single source surfaces filter on.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELIGIBLE = path.join(ROOT, 'assets', 'data', 'command-board-eligible.json');
const OUT = path.join(ROOT, 'assets', 'data', 'kernel-watchlist.json');

const raw = JSON.parse(fs.readFileSync(ELIGIBLE, 'utf8'));
const rows = Array.isArray(raw) ? raw : (raw.companies || raw.rows || Object.values(raw));

const validated = rows.filter(r => (r.vs || r.validation_status) === 'validated');
const DISTRESS_TRAJ = new Set(['RUPTURE', 'CASH_DECLINE', 'UNRECOVERED_P3', 'TERMINAL_DIVERGENCE']);

// STRUCTURAL EXCLUSION: the kernel is INVALID on the Finance/Insurance/Real-Estate
// division (SIC 6000-6799) — banks/brokers/insurers/REITs/funds carry deposits +
// borrowings as "debt", so the debt/cash rupture logic mis-fires (bank pathC
// composites of 13-39 are artifacts, not distress). These are out-of-envelope no
// matter what the eligibility file says. Only OPERATING companies are in scope.
function structurallyExcluded(sic) {
  const s = parseInt(String(sic || '').slice(0, 4), 10);
  return !isNaN(s) && s >= 6000 && s <= 6799;
}

function pick(r) {
  return {
    slug: r.slug || r.d || null, name: r.n || r.name, ticker: r.t || r.ticker, cik: r.c || r.cik,
    path: r.path, composite: Number(r.co || r.composite || 0), trajectory: r.tr || r.trajectory,
    distressScore: Number(r.ds || 0), alert: !!(r.a || r.alert), sector: r.sec, sic: r.sic
  };
}

// SHORT: validated-envelope + operating company (not FIRE) + kernel alert
const inScope = validated.filter(r => !structurallyExcluded(r.sic || r.SIC));
const excludedFinancials = validated.length - inScope.length;
const bankruptcyWatch = inScope
  .filter(r => (r.a || r.alert) || DISTRESS_TRAJ.has(r.tr || r.trajectory))
  .map(pick)
  .sort((a, b) => b.composite - a.composite);

const out = {
  generatedAt: new Date().toISOString(),
  directive: 'Only kernel-validated bankruptcy-call candidates + investment-primed names surface. No other companies matter. (operator 2026-07-11)',
  criteria: {
    short: 'validation_status === validated (in-envelope) AND (kernel alert OR distress trajectory RUPTURE/CASH_DECLINE/UNRECOVERED_P3)',
    long: 'PENDING operator definition — no investment-primed signal exists yet'
  },
  counts: {
    universe: rows.length,
    validatedEnvelope: validated.length,
    excludedFinancials: excludedFinancials,
    inScopeOperating: inScope.length,
    bankruptcyWatch: bankruptcyWatch.length,
    investmentPrimed: 0,
    suppressed: rows.length - bankruptcyWatch.length
  },
  bankruptcyWatch,
  investmentPrimed: []
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('wrote kernel-watchlist.json');
console.log('  universe ' + out.counts.universe + ' -> validated ' + out.counts.validatedEnvelope +
  ' -> bankruptcy-call ' + out.counts.bankruptcyWatch + ' (suppress ' + out.counts.suppressed + ')');
console.log('  top short candidates:');
bankruptcyWatch.slice(0, 10).forEach(c => console.log('    ' + String(c.name).slice(0, 30).padEnd(32) +
  ' ' + (c.trajectory || '?').padEnd(16) + ' co=' + c.composite.toFixed(2) + ' path=' + c.path));
