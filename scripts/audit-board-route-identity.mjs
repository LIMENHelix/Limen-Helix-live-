#!/usr/bin/env node
/**
 * audit-board-route-identity.mjs — record every Board route whose portal
 * carries a different issuer identity.
 *
 * Rule: a route is coherent only when normalized Board CIK equals normalized
 * portal CIK and nonempty tickers do not contradict. This script does not
 * repair identities; it records the mismatches and their source attribution so
 * runtime consumers can fail closed and a dedicated remediation can be planned.
 *
 * Output: assets/data/audit/board-route-identity-mismatches.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const coherence = require('../lib/identity-coherence.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTAL_DIR = path.join(ROOT, 'assets/data/companies');
const BOARD = path.join(ROOT, 'assets/data/command-board-data.json');
const OUT = process.env.BOARD_ROUTE_AUDIT_OUT
  || path.join(ROOT, 'assets/data/audit/board-route-identity-mismatches.json');

const portals = {};
for (const f of fs.readdirSync(PORTAL_DIR).filter((x) => x.endsWith('.json'))) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, f), 'utf8'));
    if (p && p.slug) portals[p.slug] = p;
  } catch (e) { /* skip */ }
}

const board = JSON.parse(fs.readFileSync(BOARD, 'utf8')).companies || [];
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/company-index.json'), 'utf8')).companies || {};
const sp500 = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sp500-ciks.json'), 'utf8')).companies || [];
const operatorRefs = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/operator-references.json'), 'utf8')).companies || [];

function inIndex(ticker, cik) {
  for (const [slug, co] of Object.entries(index)) {
    if (coherence.tickerKey(co.ticker) === coherence.tickerKey(ticker)
      && coherence.normalizeCik(co.cik) === coherence.normalizeCik(cik)) return slug;
  }
  return null;
}
function inList(list, ticker, cik) {
  return list.find((x) => coherence.tickerKey(x.ticker) === coherence.tickerKey(ticker)
    && coherence.normalizeCik(x.cik) === coherence.normalizeCik(cik)) || null;
}

const rows = [];
const sourceCounts = { companyIndex: 0, sp500: 0, operatorReferences: 0, unattributed: 0 };
const kindCounts = { cikMismatch: 0, tickerConflict: 0, missingCik: 0 };
const seenRoutes = new Set();
for (const r of board) {
  if (!r || !r.s || !r.c) continue;
  const p = portals[r.s];
  if (!p) continue;
  const boardIdentity = { cik: r.c, ticker: r.t };
  const portalIdentity = { cik: p.cik, ticker: p.ticker };
  if (coherence.routeCoherent(boardIdentity, portalIdentity)) continue;

  const routeKey = String(r.c) + '|' + r.s;
  if (seenRoutes.has(routeKey)) continue;
  seenRoutes.add(routeKey);

  let source = 'unattributed';
  if (inIndex(r.t, r.c)) { source = 'companyIndex'; sourceCounts.companyIndex++; }
  else if (inList(sp500, r.t, r.c)) { source = 'sp500'; sourceCounts.sp500++; }
  else if (inList(operatorRefs, r.t, r.c)) { source = 'operatorReferences'; sourceCounts.operatorReferences++; }
  else { sourceCounts.unattributed++; }

  const bc = coherence.normalizeCik(r.c);
  const pc = coherence.normalizeCik(p.cik);
  const bt = coherence.tickerKey(r.t);
  const pt = coherence.tickerKey(p.ticker);
  const cikMismatch = !!(bc && pc && bc !== pc);
  const tickerConflict = !!(bt && pt && bt !== pt);
  const missingCik = !bc || !pc;
  if (cikMismatch) kindCounts.cikMismatch++;
  if (tickerConflict) kindCounts.tickerConflict++;
  if (missingCik) kindCounts.missingCik++;
  rows.push({
    boardTicker: r.t || null,
    boardCik: r.c,
    boardName: r.n || null,
    boardSlug: r.s,
    portalTicker: p.ticker || null,
    portalCik: p.cik,
    portalName: p.name || null,
    tickerMatches: !!bt && bt === pt,
    kind: cikMismatch ? 'cik-mismatch' : (missingCik ? 'missing-cik' : 'ticker-conflict'),
    source
  });
}
rows.sort((a, b) => String(a.boardTicker).localeCompare(String(b.boardTicker))
  || String(a.boardCik).localeCompare(String(b.boardCik)));

const out = {
  generatedAt: new Date().toISOString(),
  schemaVersion: 'board-route-identity/1.0',
  rule: 'route usable only when normalized Board CIK equals normalized portal CIK and nonempty tickers do not contradict',
  counts: {
    boardRows: board.length,
    mismatches: rows.length,
    tickerMatches: rows.filter((r) => r.tickerMatches).length,
    tickerConflicts: rows.filter((r) => !r.tickerMatches).length,
    ...kindCounts
  },
  sources: sourceCounts,
  notice: 'Diagnostic rows remain in the protected feed. Runtime consumers must fail closed on these routes; identities are not corrected.',
  rows
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log('board route identity audit: ' + out.counts.mismatches + ' mismatches / ' +
  out.counts.boardRows + ' board rows; sources ' + JSON.stringify(sourceCounts));
