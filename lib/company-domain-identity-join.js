'use strict';

/*
 * Company/domain/CIK join — an explicit boundary between parallel corpora.
 *
 * This module is intentionally pure and read-only. It does not decide that a
 * company is financially distressed, does not call Thing 1, and is not a
 * runtime domain-brain consumer. It exposes disagreement instead of silently
 * selecting whichever registry happened to be loaded first.
 */
const fs = require('fs');
const path = require('path');

const DOMAIN_ALIASES = Object.freeze({
  health: 'medicine',
  medicine: 'medicine',
  legal: 'law',
  law: 'law',
  contemplative: 'religion',
  religion: 'religion',
  supplyChain: 'trade',
  trade: 'trade',
  research: 'science',
  science: 'science',
  p2_agri: 'agriculture',
  agriculture: 'agriculture'
});

function canonicalDomain(domain) {
  if (domain === null || domain === undefined || domain === '') return null;
  const raw = String(domain);
  return DOMAIN_ALIASES[raw] || raw;
}

function normalizeCik(cik) {
  if (cik === null || cik === undefined || cik === '') return null;
  const s = String(cik).trim();
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s;
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function defaultInputs(root) {
  const companyDir = path.join(root, 'assets/data/companies');
  const identityFiles = {};
  for (const file of fs.readdirSync(companyDir)) {
    if (!file.endsWith('.json')) continue;
    const slug = file.slice(0, -5);
    identityFiles[slug] = readJson(root, `assets/data/companies/${file}`);
  }
  const commandBoard = readJson(root, 'assets/data/command-board-data.json');
  return {
    companyRegistry: readJson(root, 'assets/data/company-registry.json'),
    identityFiles,
    commandBoard: Array.isArray(commandBoard) ? commandBoard : (commandBoard.companies || []),
    commandBoardAliases: commandBoard._canonical_subcategory_map || {}
  };
}

function sourceDomains(row) {
  const values = [];
  if (row.registryDomain) values.push({ source: 'companyRegistry', value: row.registryDomain });
  if (row.identityDomain) values.push({ source: 'identityFile', value: row.identityDomain });
  for (const d of row.commandBoardDomains || []) values.push({ source: 'commandBoard', value: d });
  return values;
}

function buildJoin(inputs) {
  if (!inputs || !inputs.companyRegistry || !inputs.identityFiles) {
    throw new TypeError('companyRegistry and identityFiles are required');
  }
  const registry = inputs.companyRegistry;
  const identities = inputs.identityFiles;
  const commandBoard = Array.isArray(inputs.commandBoard) ? inputs.commandBoard : [];
  const rows = new Map();
  const byCik = new Map();
  const byTicker = new Map();

  function rowFor(key) {
    if (!rows.has(key)) rows.set(key, {
      companyKey: key,
      slug: null,
      cik: null,
      ticker: null,
      name: null,
      registryDomain: null,
      identityDomain: null,
      commandBoardDomains: [],
      identitySlugs: [],
      identityExact: false,
      identityAliasSlugs: [],
      sources: [],
      status: null,
      issues: []
    });
    return rows.get(key);
  }

  // The generated registry is the portal-entry source, not a claim that its
  // stale snapshot is the whole identity corpus.
  for (const [slug, cikValue] of Object.entries(registry.bySlug || {})) {
    const cik = normalizeCik(cikValue);
    const detail = cik && registry.byCik ? registry.byCik[String(cikValue)] || registry.byCik[cik] : null;
    const r = rowFor(`slug:${slug}`);
    r.slug = slug;
    r.cik = cik;
    r.ticker = detail && detail.ticker || null;
    r.name = detail && detail.name || null;
    r.registryDomain = detail && detail.domain || null;
    r.sources.push('companyRegistry');
    if (cik) byCik.set(cik, r);
  }

  // Identity files are a broader corpus. Match by slug first, then promote a
  // CIK match; preserving the source label makes the scope difference visible.
  for (const [slug, identity] of Object.entries(identities)) {
    const cik = normalizeCik(identity.cik);
    const exact = rows.get(`slug:${slug}`);
    let r = exact || (cik && byCik.get(cik));
    if (!r) r = rowFor(`slug:${slug}`);
    r.slug = r.slug || slug;
    r.cik = r.cik || cik;
    r.ticker = r.ticker || identity.ticker || null;
    r.name = r.name || identity.name || null;
    r.identityDomain = r.identityDomain || identity.domainId || null;
    if (!r.identitySlugs.includes(slug)) r.identitySlugs.push(slug);
    if (exact || r.slug === slug) r.identityExact = true;
    else {
      r.identityAliasSlugs.push(slug);
      if (!r.issues.includes('identity_slug_differs')) r.issues.push('identity_slug_differs');
    }
    if (!r.sources.includes('identityFile')) r.sources.push('identityFile');
    if (cik) byCik.set(cik, r);
  }

  // Command-board rows are a current operational snapshot. Join by CIK when
  // possible, then by slug; ticker is only a last-resort index and is recorded
  // as such rather than treated as identity proof.
  for (const c of commandBoard) {
    if (!c || (!c.s && !c.c && !c.t)) continue;
    const cik = normalizeCik(c.c);
    let r = (cik && byCik.get(cik)) || (c.s && rows.get(`slug:${c.s}`));
    if (!r && c.t) r = byTicker.get(String(c.t).toUpperCase());
    if (!r) r = rowFor(cik ? `cik:${cik}` : `ticker:${String(c.t).toUpperCase()}`);
    r.slug = r.slug || c.s || null;
    r.cik = r.cik || cik;
    r.ticker = r.ticker || c.t || null;
    r.name = r.name || c.n || null;
    if (c.d && !r.commandBoardDomains.includes(c.d)) r.commandBoardDomains.push(c.d);
    if (!r.sources.includes('commandBoard')) r.sources.push('commandBoard');
    if (r.ticker) byTicker.set(String(r.ticker).toUpperCase(), r);
    if (cik) byCik.set(cik, r);
  }

  for (const r of rows.values()) {
    const observations = sourceDomains(r);
    const canonical = [...new Set(observations.map((x) => canonicalDomain(x.value)).filter(Boolean))];
    r.canonicalDomains = canonical.sort();
    const raw = [...new Set(observations.map((x) => x.value).filter(Boolean))].sort();
    r.rawDomains = raw;
    if (canonical.length > 1) r.issues.push('domain_sources_disagree');
    if (!r.cik) r.issues.push('no_cik');
    if (!r.sources.includes('companyRegistry')) {
      r.status = r.sources.includes('identityFile') ? 'expanded_identity_only' : 'command_board_only';
    } else if (!r.identityExact) {
      r.status = 'registry_missing_identity';
      r.issues.push('registry_identity_file_missing');
    } else if (r.issues.includes('domain_sources_disagree')) {
      r.status = 'joined_domain_conflict';
    } else {
      r.status = 'joined';
    }
    r.sources.sort();
    r.commandBoardDomains.sort();
  }

  const resultRows = [...rows.values()].sort((a, b) => a.companyKey.localeCompare(b.companyKey));
  const statuses = {};
  const issues = {};
  for (const r of resultRows) {
    statuses[r.status] = (statuses[r.status] || 0) + 1;
    for (const issue of r.issues) issues[issue] = (issues[issue] || 0) + 1;
  }
  return {
    schemaVersion: 1,
    sourcePrecedence: ['companyRegistry: portal-entry snapshot', 'identityFile: expanded company record', 'commandBoard: operational snapshot'],
    domainAliases: { ...DOMAIN_ALIASES, ...(inputs.commandBoardAliases || {}) },
    rows: resultRows,
    summary: {
      rows: resultRows.length,
      statuses,
      issues,
      aliasNormalizedRows: resultRows.filter((r) => r.rawDomains.some((d) => canonicalDomain(d) !== d)).length,
      rowsWithCik: resultRows.filter((r) => r.cik).length,
      rowsWithMultipleCanonicalDomains: resultRows.filter((r) => r.canonicalDomains.length > 1).length
    }
  };
}

function loadDefault(root) {
  return buildJoin(defaultInputs(root || path.resolve(__dirname, '..')));
}

module.exports = { DOMAIN_ALIASES, canonicalDomain, normalizeCik, buildJoin, loadDefault };
