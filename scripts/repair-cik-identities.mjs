#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'assets', 'data');
const REPAIR_PATH = path.join(DATA, 'audit', 'sec-cik-identity-repairs.json');
const APPLY = process.argv.includes('--apply');

const repairDoc = JSON.parse(fs.readFileSync(REPAIR_PATH, 'utf8'));
const repairs = repairDoc.repairs;

function normCik(value) {
  return String(value == null ? '' : value).replace(/^0+/, '') || '0';
}

function sameTicker(a, b) {
  return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
}

function findRepair(ticker, cik) {
  const normalized = normCik(cik);
  return repairs.find((repair) =>
    repair.oldCiks.some((old) => normCik(old) === normalized) &&
    repair.oldTickers.some((old) => sameTicker(old, ticker))
  ) || null;
}

function findCanonicalRepair(ticker, cik) {
  const normalized = normCik(cik);
  return repairs.find((repair) =>
    normCik(repair.cik) === normalized && sameTicker(repair.ticker, ticker)
  ) || null;
}

function formattedCik(previous, canonical) {
  if (typeof previous === 'number') return Number(canonical);
  const text = String(previous == null ? '' : previous);
  if (/^0\d+$/.test(text) && text.length >= 10) return String(canonical).padStart(10, '0');
  return String(canonical);
}

function repairRecord(record) {
  if (!record || typeof record !== 'object' || !record.ticker || !record.cik) return null;
  const repair = findRepair(record.ticker, record.cik);
  if (!repair) return null;
  const before = { ticker: record.ticker, cik: record.cik };
  record.ticker = repair.ticker;
  record.cik = formattedCik(record.cik, repair.cik);
  return { repair, before, after: { ticker: record.ticker, cik: record.cik } };
}

function jsonStyle(text) {
  const pretty = /\r?\n/.test(text);
  const indentMatch = pretty ? text.match(/\n([ \t]+)"/) : null;
  return {
    indent: pretty ? (indentMatch ? indentMatch[1] : '  ') : 0,
    newline: text.endsWith('\r\n') ? '\r\n' : text.endsWith('\n') ? '\n' : ''
  };
}

function writeJson(file, value, original) {
  const style = jsonStyle(original);
  const serialized = JSON.stringify(value, null, style.indent);
  fs.writeFileSync(file, serialized + style.newline);
}

function replaceOwnCikReferences(value, repair) {
  let replacements = 0;
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') node[i] = replace(node[i]);
        else if (node[i] && typeof node[i] === 'object') visit(node[i]);
      }
      return;
    }
    for (const [key, child] of Object.entries(node || {})) {
      if (typeof child === 'string') node[key] = replace(child);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  const replace = (text) => {
    let next = text;
    for (const old of repair.oldCiks || []) {
      const oldCik = normCik(old);
      const pattern = new RegExp(`(\\bCIK(?:\\s+is\\s+|[:=]\\s*)?)0*${oldCik}\\b`, 'gi');
      next = next.replace(pattern, (_, prefix) => {
        replacements++;
        return prefix + repair.cik;
      });
    }
    return next;
  };
  visit(value);
  return replacements;
}

const changes = [];

function mutateJson(file, mutate) {
  const original = fs.readFileSync(file, 'utf8');
  const value = JSON.parse(original);
  const fileChanges = mutate(value) || [];
  if (!fileChanges.length) return;
  changes.push(...fileChanges.map((change) => ({ file: path.relative(ROOT, file).replaceAll('\\', '/'), ...change })));
  if (APPLY) writeJson(file, value, original);
}

mutateJson(path.join(DATA, 'company-index.json'), (doc) => {
  const found = [];
  for (const record of Object.values(doc.companies || {})) {
    const change = repairRecord(record);
    if (change) found.push({ surface: 'company-index', ...change });
  }
  return found;
});

mutateJson(path.join(DATA, 'companies-manifest.json'), (doc) => {
  const found = [];
  for (const record of Object.values(doc.index || {})) {
    const change = repairRecord(record);
    if (change) found.push({ surface: 'companies-manifest', ...change });
  }
  return found;
});

mutateJson(path.join(DATA, 'sp500-ciks.json'), (doc) => {
  const found = [];
  for (const record of doc.companies || []) {
    const change = repairRecord(record);
    if (change) found.push({ surface: 'sp500', ...change });
  }
  return found;
});

mutateJson(path.join(DATA, 'operator-references.json'), (doc) => {
  const found = [];
  for (const record of doc.companies || []) {
    const change = repairRecord(record);
    if (change) found.push({ surface: 'operator-references', ...change });
  }
  return found;
});

mutateJson(path.join(DATA, 'entity-registry.json'), (doc) => {
  const found = [];
  for (const domain of Object.values(doc.domains || {})) {
    for (const portal of Object.values(domain.portals || {})) {
      for (const record of portal.entities || []) {
        const change = repairRecord(record);
        if (change) found.push({ surface: 'entity-registry', ...change });
      }
    }
  }
  return found;
});

mutateJson(path.join(DATA, 'company-registry.json'), (doc) => {
  const found = [];
  const nextByCik = {};
  for (const [storedCik, record] of Object.entries(doc.byCik || {})) {
    const repair = findRepair(record.ticker, storedCik);
    if (!repair) {
      nextByCik[storedCik] = record;
      continue;
    }
    const canonicalCik = formattedCik(storedCik, repair.cik);
    if (doc.byCik[canonicalCik] && doc.byCik[canonicalCik].slug !== record.slug) {
      throw new Error(`CIK repair collision: ${storedCik} -> ${canonicalCik}`);
    }
    const before = { ticker: record.ticker, cik: storedCik };
    record.ticker = repair.ticker;
    nextByCik[canonicalCik] = record;
    if (record.slug && normCik(doc.bySlug?.[record.slug]) === normCik(storedCik)) {
      doc.bySlug[record.slug] = canonicalCik;
    }
    found.push({
      surface: 'company-registry',
      repair,
      before,
      after: { ticker: record.ticker, cik: canonicalCik }
    });
  }
  doc.byCik = nextByCik;
  return found;
});

const companyDir = path.join(DATA, 'companies');
for (const name of fs.readdirSync(companyDir).filter((name) => name.endsWith('.json') && !name.startsWith('_'))) {
  const file = path.join(companyDir, name);
  mutateJson(file, (portal) => {
    const change = repairRecord(portal);
    const repair = change?.repair || findCanonicalRepair(portal.ticker, portal.cik);
    if (!repair) return [];

    const oldTicker = change?.before.ticker || portal.ticker;
    const oldCik = normCik(change?.before.cik || repair.oldCiks[0]);
    const newCik = repair.cik;

    if (typeof portal.helixReportUrl === 'string') {
      portal.helixReportUrl = portal.helixReportUrl.replace(new RegExp(`([?&]cik=)0*${oldCik}(?=&|$)`), `$1${newCik}`);
    }
    if (Array.isArray(portal.marketDataTickers)) {
      portal.marketDataTickers = portal.marketDataTickers.map((ticker) => sameTicker(ticker, oldTicker) ? repair.ticker : ticker);
    }
    for (const source of portal.feedSources || []) {
      if (source && source.type === 'sec_edgar' && typeof source.url === 'string') {
        source.url = source.url.replace(new RegExp(`CIK0*${oldCik}\\.json$`), `CIK${String(newCik).padStart(10, '0')}.json`);
      }
    }
    if (repair.status === 'retired') {
      portal.publicMarketStatus = 'retired';
      portal.publicMarketRetiredAt = repair.retiredAt;
    }
    const evidenceCikReferencesUpdated = replaceOwnCikReferences(portal, repair);
    if (!change && !evidenceCikReferencesUpdated) return [];
    return [{
      surface: 'company-portal-identity',
      repair,
      before: change?.before || { ticker: portal.ticker, cik: portal.cik },
      after: { ticker: portal.ticker, cik: portal.cik },
      evidenceCikReferencesUpdated
    }];
  });
}

const bySurface = {};
for (const change of changes) bySurface[change.surface] = (bySurface[change.surface] || 0) + 1;

console.log(JSON.stringify({
  mode: APPLY ? 'applied' : 'measure-only',
  authoritativeTickerSource: repairDoc.authoritativeTickerSource,
  changedRecords: changes.length,
  changedFiles: new Set(changes.map((change) => change.file)).size,
  bySurface,
  repairs: changes.map(({ repair, ...change }) => ({
    ...change,
    canonical: { ticker: repair.ticker, cik: repair.cik, status: repair.status }
  }))
}, null, 2));
