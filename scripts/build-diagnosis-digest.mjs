#!/usr/bin/env node
/**
 * build-diagnosis-digest.mjs — Track 1 of the Capital Conversion opportunity work.
 *
 * The domain brains' per-cycle deriveDiagnoses() reads ONLY the L1 root portal
 * file (/assets/data/domains/{portalKey}.json, ~5 issues). The deep subportal
 * tree (L2-L7, hundreds of files per domain) already carries thousands of
 * authored issues + treatments that the brain never consumes.
 *
 * This script pre-aggregates that deep tree into ONE lean per-domain digest the
 * base brain can fetch once (no 200-file-per-cycle fetch flood). Each digest
 * diagnosis arrives with its treatments already resolved (circuit nodeId ->
 * activation brainNodeId, within the same portal file), so the brain can inject
 * stress-gated deep diagnoses straight into state.diagnoses and let each
 * domain's existing opportunity generator surface them.
 *
 * Pure data transform — NO Anthropic / API calls, no new content authored.
 * That (authoring genuinely-missing diagnoses) is Track 2, separately gated.
 *
 *   node scripts/build-diagnosis-digest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOMAINS_DIR = path.join(ROOT, 'assets', 'data', 'domains');
const OUT_DIR = path.join(ROOT, 'assets', 'data', 'deep');

// portalKey == file prefix for all 20 brains (verified): most = domainId,
// plus medicine='medicine', science='science', trade='trade'.
const PORTAL_KEYS = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];

const MAX_TX_PER_DX = 2;       // keep the digest lean — top treatments by evidence
const MAX_DX_PER_DOMAIN = 180; // brain injects only ~8 stress-gated per cycle; keep the richest + urgent
const SUMMARY_MAX = 160;
const EV_RANK = { Strong: 4, A: 4, Moderate: 3, B: 3, C: 2, Emerging: 1 };

// Urgent current-situation themes (grounded in June 2026 news: Colorado/Lake
// Powell drought emergency, $72B migration enforcement + TPS rulings, etc.).
// Diagnoses matching these float to the TOP of the digest so the brain's
// stress-gated top-N pick always includes the current-relevant ones instead of
// only the treatment-richest. Pure ranking bias — no content is added.
const URGENT_THEMES = {
  water:      /water|drought|aquifer|reservoir|potable|sewer|wastewater|scarcity|hydropower/i,
  migration:  /migrat|refugee|asylum|\bborder\b|displace|immigr|deportation/i,
  weather:    /\bweather\b|storm|hurricane|flood|wildfire|\bheat\b|heatwave|extreme|climate/i,
  population: /population|demograph|aging|fertility|housing|birth rate|depopulat/i,
  economy:    /inflation|recession|interest rate|unemploy|tariff|\bdebt\b|deficit|fiscal|cost of living/i,
  grid:       /\bgrid\b|blackout|\bpower\b|electric|outage|capacity overload/i,
  food:       /\bfood\b|famine|crop|harvest|agricultur|supply shortage/i,
  health:     /outbreak|epidemic|pandemic|disease|shortage|overdose/i,
  conflict:   /conflict|\bwar\b|security threat|cyberattack|terror|sanction/i
};

function matchThemes(text) {
  const t = [];
  for (const k in URGENT_THEMES) if (URGENT_THEMES[k].test(text)) t.push(k);
  return t;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function bestCircuitEvidence(circuits) {
  let best = '', bestRank = -1;
  (circuits || []).forEach(c => {
    const r = EV_RANK[c.evidence] || 0;
    if (r > bestRank) { bestRank = r; best = c.evidence || ''; }
  });
  return best;
}

function buildDigest(pk) {
  const files = fs.readdirSync(DOMAINS_DIR)
    .filter(f => f.endsWith('.json') && (f === pk + '.json' || f.startsWith(pk + '_')));

  const diagnoses = [];
  let portalCount = 0;

  files.forEach(file => {
    const slug = file.replace(/\.json$/, '');
    const depth = slug.split('_').length;        // L1 = 1, deeper = more
    if (depth < 2) return;                        // skip the L1 root — brain already reads it
    const j = readJSON(path.join(DOMAINS_DIR, file));
    if (!j || !Array.isArray(j.issues) || !j.issues.length) return;
    portalCount++;

    // Resolve activation node -> treatments within THIS portal file.
    const byNode = {};
    (j.activations || []).forEach(a => {
      if (!a || !a.brainNodeId) return;
      byNode[a.brainNodeId] = (byNode[a.brainNodeId] || []).concat(a.treatments || []);
    });

    j.issues.forEach(iss => {
      if (!iss || !iss.id) return;
      const circuits = iss.circuits || [];
      // Collect this diagnosis's treatments via its circuit node ids.
      let tx = [];
      circuits.forEach(c => {
        (byNode[c.nodeId] || []).forEach(t => {
          if (t && t.label) tx.push({ l: t.label, t: t.type || '', e: t.evidence || '' });
        });
      });
      const txCount = tx.length;
      // Keep the strongest-evidence treatments, capped.
      tx.sort((a, b) => (EV_RANK[b.e] || 0) - (EV_RANK[a.e] || 0));
      tx = tx.slice(0, MAX_TX_PER_DX);

      const themes = matchThemes(
        (iss.label || '') + ' ' + (iss.summary || '') + ' ' + (iss.id || '') + ' ' + slug
      );
      diagnoses.push({
        id: iss.id,
        label: iss.label || iss.id,
        summary: (iss.summary || '').slice(0, SUMMARY_MAX),
        slug: slug,
        sub: slug.split('_').slice(1).join('_') || '',
        depth: depth,
        circuits: circuits.map(c => c.nodeId).filter(Boolean),
        evidence: bestCircuitEvidence(circuits),
        themes: themes,
        tx: tx,
        txCount: txCount
      });
    });
  });

  // De-dup identical diagnosis ids across sibling portals — keep the richest.
  const byId = {};
  diagnoses.forEach(d => {
    const prev = byId[d.id];
    if (!prev || d.txCount > prev.txCount) byId[d.id] = d;
  });
  let deduped = Object.keys(byId).map(k => byId[k]);

  // Rank: urgent current-theme diagnoses FIRST (so the brain's stress-gated
  // top-N pick always includes them), then by treatment richness + evidence.
  // The brain only surfaces a handful per cycle, so the thin non-urgent tail
  // just bloats the fetch; it stays in the portal tree (reachable via eager
  // drill). The digest is the brain's working set.
  const totalBeforeCap = deduped.length;
  deduped.sort((a, b) =>
    ((b.themes.length ? 1 : 0) - (a.themes.length ? 1 : 0)) ||
    (b.txCount - a.txCount) ||
    ((EV_RANK[b.evidence] || 0) - (EV_RANK[a.evidence] || 0))
  );
  const urgentCount = deduped.filter(d => d.themes.length).length;
  deduped = deduped.slice(0, MAX_DX_PER_DOMAIN);

  return {
    domain: pk,
    portalCount: portalCount,
    diagnosisCount: deduped.length,
    diagnosisTotalAvailable: totalBeforeCap,
    urgentThemeCount: deduped.filter(d => d.themes.length).length,
    urgentThemeAvailable: urgentCount,
    treatmentTotal: deduped.reduce((s, d) => s + d.txCount, 0),
    diagnoses: deduped
  };
}

let grand = { domains: 0, diagnoses: 0, treatments: 0 };
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

PORTAL_KEYS.forEach(pk => {
  const dg = buildDigest(pk);
  const out = path.join(OUT_DIR, pk + '-diagnosis-digest.json');
  fs.writeFileSync(out, JSON.stringify(dg));
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(
    pk.padEnd(15),
    'portals=' + String(dg.portalCount).padStart(3),
    'dx=' + String(dg.diagnosisCount).padStart(4),
    'urgent=' + String(dg.urgentThemeCount).padStart(3) + '/' + String(dg.urgentThemeAvailable).padStart(3),
    'tx=' + String(dg.treatmentTotal).padStart(5),
    '(' + kb + 'KB)'
  );
  grand.domains++; grand.diagnoses += dg.diagnosisCount; grand.treatments += dg.treatmentTotal;
});

console.log('---');
console.log('TOTAL', grand.domains, 'domains  ', grand.diagnoses, 'deep diagnoses  ', grand.treatments, 'treatment links');
