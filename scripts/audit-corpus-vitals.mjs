#!/usr/bin/env node
/**
 * audit-corpus-vitals.mjs — the system's interoception organ.
 *
 * Single deterministic pass over the corpus that produces a structured vitals
 * snapshot (assets/data/_vitals.json) covering every dimension the immune
 * system needs to act on:
 *
 *   - placeholder bleed       (DATA_NEEDED across the corpus)
 *   - brain-tag fidelity      (every fn entry must have brainNodeId+neuralRole+brainNodeRole)
 *   - dup risk                (name-fingerprint, baseSlug, CIK collisions)
 *   - CB wiring health        (curated 506 + eligible 302 — do their s slugs resolve?)
 *   - thin portals            (<20 fn entries = stub, not a portal)
 *   - domain routing          (pharma SIC routed off medicine domain = mis-classification)
 *   - category bleed          (competitor entries in supplier/customer slots)
 *   - CIK integrity           (collisions where ≥2 portals share a real CIK)
 *
 * Every metric carries a 0-100 score; the aggregate is the corpus health score.
 * Each issue list is keyed for the heal executor to act on.
 *
 *   node scripts/audit-corpus-vitals.mjs            # writes assets/data/_vitals.json
 *   node scripts/audit-corpus-vitals.mjs --dry-run  # print only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const VITALS_PATH = path.join(ROOT, 'assets', 'data', '_vitals.json');
const DRY = process.argv.includes('--dry-run');

// ─── helpers ──────────────────────────────────────────────────────
const norm = c => String(c == null ? '' : c).replace(/^0+/, '') || '';
const arrOf = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? [x] : []);
const NAME_STOP = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|lp|sa|ag|nv|se|holdings?|group|the)\b/gi;
const nameKey = n => String(n || '').replace(NAME_STOP, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SLUG_SUFFIX = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'plc', 'llc', 'lp', 'sa', 'ag', 'nv', 'se', 'holdings', 'holding', 'group', 'the', 'of']);
const baseSlug = s => { const p = String(s || '').split('_'); while (p.length > 1 && SLUG_SUFFIX.has(p[p.length - 1])) p.pop(); return p.join('_'); };
function countDN(node) { if (node == null) return 0; if (typeof node === 'string') return (node.match(/DATA_NEEDED/g) || []).length; if (Array.isArray(node)) return node.reduce((s, v) => s + countDN(v), 0); if (typeof node === 'object') { let s = 0; for (const k in node) s += countDN(node[k]); return s; } return 0; }

// Detectors below MUST stay identical to their dedicated audit scripts —
// audit-fn-category-bleed.mjs (categoryBleed), audit-portal-quality.mjs
// (truncation + null-composite + NaN), audit-prose-quality.mjs (prose).
// When a dedicated audit's logic changes, mirror it here or this organ
// silently goes blind.
const STRONG_COMPETE_RE = /\b(is\s+(?:a|the|one\s+of)\s+[^.]*\bcompetitor|competitor\s+(?:in|to|of)|competes\s+(?:directly\s+)?(?:with|in|against))/i;
const ROLE_RE = {
  suppliers: /\b(suppl(?:ies|ier|y)|provides|sources?\s+from|manufactures?\s+for|ships?\s+to\s+\w|raw\s+material|components?|ingredients?|API\b)/i,
  customers: /\b(customer|buys?\b|purchas|deploys?|uses?\s+\w+\s+(?:to|for)|client\b|orders?\b|reseller)/i,
  logisticsPartners: /\b(partner|integrat|logistics|delivery|fulfillment|carrier|freight|ships?\b|interconnect)/i,
  capitalProviders: /\b(lend|loan|credit|financ|underwrit|investor|capital|revolver|notes?\b|facility)/i
};
// prose-quality (exact mirror of audit-prose-quality.mjs flagsForNote)
function proseFlagsForNote(note) {
  const issues = [];
  const t = String(note || '').trim();
  if (!t) { issues.push('empty'); return issues; }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 18) issues.push('too-short');
  if (!/[.!?]$/.test(t)) issues.push('no-terminal-punct');
  if (/[a-z]$/.test(t) && words.length < 50) issues.push('lowercase-final');
  if (/\b([a-z]{2,})\1{2,}\b/i.test(t)) issues.push('repeat-token');
  if (words.length >= 30 && !/[.;,]/.test(t)) issues.push('run-on');
  if (words.length < 25 && !/^[A-Z]/.test(t)) issues.push('fragment-start');
  if (/\b(?:and|of|for|with|by|to|in|on|the|a|an)$/i.test(t)) issues.push('trailing-stopword');
  if (/\.{2,}\s*$/.test(t)) issues.push('trailing-ellipsis');
  return issues;
}

// ─── pass 1: walk every portal once ───────────────────────────────
const portalIndex = {}, byCik = {}, byBase = {}, byNameKey = {};
let files; try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch (e) { files = []; }

const placeholder = { worst: [], totalDN: 0, portalsAffected: 0 };
const brainFidelity = { totalEntries: 0, taggedEntries: 0, fullyTaggedRate: 0, underTagged: [], rolesUnion: new Set() };
const thin = { below20: [] };
const categoryBleed = { pureMisslot: 0, coopetition: 0, examples: [] };
const domainRouting = { mismatches: [] };
const kernelIntegrity = { nullCompositeEligible: [], nanComposite: [], totalEligible: 0,
  // A composite the kernel could NOT have produced. limen_backtest.py scores from EDGAR keyed
  // by CIK; a portal with no CIK has no EDGAR identity. Measured 2026-07-31: 111 such portals
  // carry validationStatus 'validated', 6 of them raise a distress ALERT, and 9 back a curated
  // Command Board row. Their scores cluster on EIGHT values (0.78 x34, 0.72 x32, 0.68 x20,
  // 0.62 x19, ...) against 357 distinct values for the 518 CIK-backed portals, and every
  // lastKernelRun among them is one of 9 timestamps from Oct/Nov 2024.
  // The audit previously scored this set ~100% because it only looked for NULL composites —
  // a fabricated-looking value passes a null check. Detected explicitly now.
  validatedWithoutCik: [] };
const prose = { badEntries: 0, totalEntries: 0, byIssue: {}, portalsAffected: 0, worst: [] };

for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  portalIndex[slug] = { name: p.name || slug, cik: norm(p.cik), sic: String(p.sic || ''), domain: p.domainId || '', ticker: (p.ticker || '').toLowerCase() };
  if (p.cik) (byCik[norm(p.cik)] = byCik[norm(p.cik)] || []).push(slug);
  const bs = baseSlug(slug); (byBase[bs] = byBase[bs] || []).push(slug);
  const nk = nameKey(p.name); if (nk) (byNameKey[nk] = byNameKey[nk] || []).push(slug);

  const dn = countDN(p);
  if (dn > 0) { placeholder.totalDN += dn; placeholder.portalsAffected++; placeholder.worst.push({ slug, dn }); }

  const fn = p.functionalNetwork || {};
  let fnTotal = 0, fnTagged = 0;
  let portalProseIssues = 0;
  const localRoles = new Set();
  for (const cat in fn) {
    const arr = arrOf(fn[cat]);
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      fnTotal++; brainFidelity.totalEntries++;
      const tagged = !!(e.brainNodeId && e.neuralRole && e.brainNodeRole);
      if (tagged) { fnTagged++; brainFidelity.taggedEntries++; }
      if (e.neuralRole) { brainFidelity.rolesUnion.add(e.neuralRole); localRoles.add(e.neuralRole); }
      // category-bleed (parity with audit-fn-category-bleed.mjs: requires e.slug;
      // concatenates relationshipNote + brainNodeRole to match the heal's scope)
      if (e.slug && ['suppliers', 'customers', 'logisticsPartners', 'capitalProviders'].includes(cat)) {
        const note = String(e.relationshipNote || '') + ' ' + String(e.brainNodeRole || '');
        if (STRONG_COMPETE_RE.test(note)) {
          const hasRole = ROLE_RE[cat] && ROLE_RE[cat].test(note);
          if (hasRole) categoryBleed.coopetition++;
          else {
            categoryBleed.pureMisslot++;
            if (categoryBleed.examples.length < 10) categoryBleed.examples.push({ slug, cat, name: e.name });
          }
        }
      }
      // prose-quality scan (parity with audit-prose-quality.mjs — only scans relationshipNote)
      prose.totalEntries++;
      const proseIss = proseFlagsForNote(e.relationshipNote);
      if (proseIss.length > 0) {
        prose.badEntries++;
        portalProseIssues++;
        for (const k of proseIss) prose.byIssue[k] = (prose.byIssue[k] || 0) + 1;
      }
    }
  }
  if (portalProseIssues > 0) { prose.portalsAffected++; prose.worst.push({ slug, issues: portalProseIssues }); }
  if (fnTotal < 20) thin.below20.push({ slug, name: p.name, fn: fnTotal });
  if (fnTotal > 0 && fnTagged / fnTotal < 0.9) brainFidelity.underTagged.push({ slug, taggedRate: +(fnTagged / fnTotal).toFixed(2), totalEntries: fnTotal });

  // kernel integrity — ELIGIBLE-marked portals must carry a numeric composite
  const kernelStatus = String(p.kernelStatus || '');
  const fh = p.financialHealth || {};
  // field-drift: portals store the score as `compositeScore`, NOT `composite` (same fix the
  // kernel organ applied). Checking only `.composite` reported ~714 false "null composite".
  const comp = (typeof fh.compositeScore === 'number') ? fh.compositeScore
             : (fh.compositeScore != null ? fh.compositeScore : fh.composite);
  if (typeof comp === 'number' && !p.cik && /validated/i.test(String(fh.validationStatus || ''))) {
    kernelIntegrity.validatedWithoutCik.push({ slug, composite: comp, status: fh.validationStatus, alert: !!fh.alert });
  }
  if (/ELIGIBLE/.test(kernelStatus)) {
    kernelIntegrity.totalEligible++;
    if (comp == null) kernelIntegrity.nullCompositeEligible.push({ slug, kernelStatus });
    else if (typeof comp === 'number' && Number.isNaN(comp)) kernelIntegrity.nanComposite.push({ slug, kernelStatus });
  } else if (typeof comp === 'number' && Number.isNaN(comp)) {
    kernelIntegrity.nanComposite.push({ slug, kernelStatus });
  }

  // domain routing — pharma SIC routed to non-medicine
  const sic = String(p.sic || ''), industry = String(p.industry || '').toLowerCase(), domain = String(p.domainId || '').toLowerCase();
  if ((/^283/.test(sic) || /pharm/i.test(industry)) && domain && domain !== 'medicine' && domain !== 'science') {
    domainRouting.mismatches.push({ slug, sic, industry: p.industry, domain });
  }
}
placeholder.worst.sort((a, b) => b.dn - a.dn);
placeholder.worst = placeholder.worst.slice(0, 25);
brainFidelity.fullyTaggedRate = brainFidelity.totalEntries ? +(brainFidelity.taggedEntries / brainFidelity.totalEntries).toFixed(3) : 0;
brainFidelity.underTagged.sort((a, b) => a.taggedRate - b.taggedRate);
brainFidelity.underTagged = brainFidelity.underTagged.slice(0, 25);
brainFidelity.rolesPresent = brainFidelity.rolesUnion.size;
delete brainFidelity.rolesUnion;
prose.worst.sort((a, b) => b.issues - a.issues);
prose.worst = prose.worst.slice(0, 25);
prose.badEntryRate = prose.totalEntries ? +(prose.badEntries / prose.totalEntries).toFixed(3) : 0;
kernelIntegrity.nullCompositeRate = kernelIntegrity.totalEligible ? +(kernelIntegrity.nullCompositeEligible.length / kernelIntegrity.totalEligible).toFixed(3) : 0;

// ─── dup risk ─────────────────────────────────────────────────────
const dupRisk = { byName: [], byBase: [], byCik: [] };
for (const k in byNameKey) if (byNameKey[k].length > 1) dupRisk.byName.push({ key: k, slugs: byNameKey[k] });
for (const k in byBase) if (byBase[k].length > 1) dupRisk.byBase.push({ key: k, slugs: byBase[k] });
// Skip empty/zero CIK: CIK-less companies (private / non-EDGAR) legitimately share no real CIK —
// grouping them on the empty-string key is a false "collision" (e.g. insight_timer/sounds_true/tyndale_house).
for (const k in byCik) if (k && k !== '0' && k !== '0000000000' && byCik[k].length > 1) dupRisk.byCik.push({ cik: k, slugs: byCik[k] });

// ─── CB wiring health (curated 506 + eligible 302) ────────────────
/**
 * `broken` conflated TWO defects with different remedies, and the attention item it produced
 * named an action that could not work.
 *
 *   REWIRABLE  — the row's slug does not resolve, but a portal DOES exist for the row's CIK
 *                under another slug. This is a pointer problem. wire-eligible-slugs.mjs fixes it.
 *   NOT BUILT  — the row's slug does not resolve and NO portal exists for that CIK at all.
 *                No wiring script can fix this; the portal has to be generated.
 *
 * Everything was reported as the first kind, with the action "run scripts/wire-eligible-slugs.mjs".
 * That script only repoints slugs at portals that already exist and sets `hp`. Measured
 * 2026-07-31 on the live corpus: 301 eligible companies, 115 with a portal, 186 without,
 * "slugs fixed: 0". So the healer ran, correctly did nothing, exited 0, and heal-corpus recorded
 * success while the count stayed at 176 for nineteen days.
 *
 * Splitting them makes each count actionable: one has a registered heal that can move it, the
 * other belongs to the paused portal-regen queue and should stop being offered a wiring fix.
 *
 * The `eligibleWiring` score below is deliberately left on total `broken`. It is really a
 * build-coverage measure rather than a wiring measure, but changing a score changes organ
 * health, and that is a separate decision from making the queue honest.
 */
function wiringFor(filePath) {
  let r = { totalRows: 0, withSlug: 0, resolving: 0, broken: 0, brokenRewirable: 0, brokenNoPortal: 0, hpTrue: 0, brokenList: [] };
  try {
    const cb = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = cb.companies || [];
    r.totalRows = rows.length;
    let aliases = {}; try { aliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'company-aliases.json'), 'utf8')).aliases || {}; } catch (e) {}
    for (const row of rows) {
      if (!row.s) continue;
      r.withSlug++;
      if (row.hp) r.hpTrue++;
      const eff = aliases[row.s] || row.s;
      if (fs.existsSync(path.join(DIR, eff + '.json'))) r.resolving++;
      else {
        r.broken++;
        // A portal for this CIK under a DIFFERENT slug means the pointer is wrong and a
        // wiring pass can fix it. No portal for the CIK at all means it was never built.
        const cikSlugs = byCik[norm(row.c)] || [];
        if (cikSlugs.length > 0) r.brokenRewirable++; else r.brokenNoPortal++;
        if (r.brokenList.length < 25) r.brokenList.push({ name: row.n, s: row.s, cik: row.c, rewirable: cikSlugs.length > 0 });
      }
    }
  } catch (e) {}
  return r;
}
const curatedHealth = wiringFor(path.join(ROOT, 'assets', 'data', 'command-board-data.json'));
const eligibleHealth = wiringFor(path.join(ROOT, 'assets', 'data', 'command-board-eligible.json'));

// ─── per-metric scoring (0=dead, 100=perfect) ─────────────────────
const score = {
  placeholderBleed: placeholder.totalDN === 0 ? 100 : Math.max(0, 100 - Math.round(placeholder.totalDN / 50)),
  brainFidelity: Math.round(brainFidelity.fullyTaggedRate * 100),
  dupRisk: Math.max(0, 100 - dupRisk.byName.length * 5 - dupRisk.byBase.length * 5 - Math.max(0, dupRisk.byCik.length - 1) * 10),
  curatedWiring: curatedHealth.withSlug ? Math.round(curatedHealth.resolving / curatedHealth.withSlug * 100) : 0,
  eligibleWiring: eligibleHealth.withSlug ? Math.round(eligibleHealth.resolving / eligibleHealth.withSlug * 100) : 0,
  thinPortals: Math.max(0, 100 - thin.below20.length * 5),
  domainRouting: Math.max(0, 100 - domainRouting.mismatches.length * 10),
  categoryBleed: Math.max(0, 100 - categoryBleed.pureMisslot),
  cikIntegrity: Math.max(0, 100 - Math.max(0, dupRisk.byCik.length - 1) * 20),
  // ELIGIBLE-marked portals with no composite = the kernel never finished scoring them
  kernelIntegrity: kernelIntegrity.totalEligible ? Math.round((1 - kernelIntegrity.nullCompositeEligible.length / kernelIntegrity.totalEligible) * 100) - kernelIntegrity.nanComposite.length * 5 : 100,
  // prose: % of fn entries where relationshipNote passes the quality flags
  proseQuality: prose.totalEntries ? Math.round((1 - prose.badEntries / prose.totalEntries) * 100) : 100
};
score.kernelIntegrity = Math.max(0, Math.min(100, score.kernelIntegrity));
const overallScore = Math.round(Object.values(score).reduce((s, v) => s + v, 0) / Object.keys(score).length);
const status = overallScore >= 90 ? 'HEALTHY' : overallScore >= 75 ? 'DEGRADED' : 'IN_PAIN';

// ─── operator-attention queue (sorted by severity) ────────────────
const attention = [];
if (placeholder.totalDN > 0) attention.push({ issue: 'DATA_NEEDED placeholders present', count: placeholder.totalDN, severity: 'high', action: 'run scripts/scrub-data-needed-corpus.mjs --apply' });
if (dupRisk.byName.length > 0) attention.push({ issue: 'Name-fingerprint dup clusters', count: dupRisk.byName.length, severity: 'high', action: 'review scripts/_dedup-analysis.mjs output and choose canonicals' });
if (dupRisk.byCik.length > 1) attention.push({ issue: 'CIK collisions (real ciks shared)', count: dupRisk.byCik.length, severity: 'high', action: 'inspect each — usually intentional segment (Abbott/abbott_metabolic), else dedup' });
// Rewirable: a portal exists for the CIK under another slug, so a wiring pass CAN fix it.
if (curatedHealth.brokenRewirable > 0) attention.push({ issue: 'Curated CB rows with broken portal links', count: curatedHealth.brokenRewirable, severity: 'med', action: 'run scripts/wire-cb-slugs.mjs' });
if (eligibleHealth.brokenRewirable > 0) attention.push({ issue: 'Eligible CB rows with broken portal links', count: eligibleHealth.brokenRewirable, severity: 'med', action: 'run scripts/wire-eligible-slugs.mjs' });
// Not built: no portal exists for the CIK at all. No wiring script can move this number, and
// offering one is what kept a no-op heal reporting success. This belongs to the portal-regen
// backlog, which is deliberately paused (scripts/autonomous-portal-regen.mjs queues, never builds).
if (curatedHealth.brokenNoPortal > 0) attention.push({ issue: 'Curated CB rows whose portal was never built', count: curatedHealth.brokenNoPortal, severity: 'med', action: 'portal does not exist for this CIK — belongs to the portal-regen queue, NOT a wiring fix. hp is already false so the board does not render a dead link.' });
if (eligibleHealth.brokenNoPortal > 0) attention.push({ issue: 'Eligible CB rows whose portal was never built', count: eligibleHealth.brokenNoPortal, severity: 'med', action: 'portal does not exist for this CIK — belongs to the portal-regen queue, NOT a wiring fix. hp is already false so the board does not render a dead link.' });
if (thin.below20.length > 0) attention.push({ issue: 'Thin portals (<20 fn entries)', count: thin.below20.length, severity: 'med', action: 'review for regeneration or deletion' });
if (domainRouting.mismatches.length > 0) attention.push({ issue: 'Domain mis-routing (pharma SIC on non-medicine domain)', count: domainRouting.mismatches.length, severity: 'med', action: 'fix domainId at source (CB data) and re-wire' });
if (categoryBleed.pureMisslot > 0) attention.push({ issue: 'Category bleed (competitors in supplier/customer slots)', count: categoryBleed.pureMisslot, severity: 'low', action: 'run scripts/fix-fn-category-bleed.mjs --apply' });
if (brainFidelity.underTagged.length > 0) attention.push({ issue: 'Portals with brain-tagging below 90%', count: brainFidelity.underTagged.length, severity: 'low', action: 'regenerate via runner (gate enforces ≥90%)' });
if (kernelIntegrity.validatedWithoutCik.length > 0) attention.push({ issue: 'Portals claiming validationStatus "validated" with NO CIK — the kernel cannot have scored them', count: kernelIntegrity.validatedWithoutCik.length, severity: 'high', action: 'limen_backtest.py scores from EDGAR by CIK; these have none, and their composites cluster on 8 values vs 357 for CIK-backed portals. Mostly foreign filers (Airbus, BASF, Shell, Saudi Aramco) and subsidiaries (AWS, google_cloud, pratt_whitney) that should carry FOREIGN_FILER / PRIVATE, not ELIGIBLE_NOW + validated. Decide the correct label before trusting any of these scores; ' + kernelIntegrity.validatedWithoutCik.filter(x => x.alert).length + ' of them currently raise a distress ALERT' });
if (kernelIntegrity.nullCompositeEligible.length > 0) attention.push({ issue: 'Null kernel composite on ELIGIBLE-marked portals', count: kernelIntegrity.nullCompositeEligible.length, severity: 'high', action: 'investigate — kernel never scored these (CIK mismatch? API failure during generation?)' });
if (kernelIntegrity.nanComposite.length > 0) attention.push({ issue: 'NaN composite values (data error)', count: kernelIntegrity.nanComposite.length, severity: 'high', action: 'inspect financialHealth.composite — likely division by zero in kernel math' });
if (prose.badEntries > 0) attention.push({ issue: 'Truncated prose in fn entries (ellipsis / fragment / empty)', count: prose.badEntries, severity: 'med', action: 'run scripts/heal-prose-truncation.mjs --apply  (when built) — flag for regeneration meanwhile' });

// ─── output ───────────────────────────────────────────────────────
const out = {
  schemaVersion: 'vitals/1.1',
  generatedAt: new Date().toISOString(),
  overall: { score: overallScore, status, summary: `${files.length} portals · DATA_NEEDED ${placeholder.totalDN} · brain-tagged ${(brainFidelity.fullyTaggedRate * 100).toFixed(0)}% · kernel ${score.kernelIntegrity}/100 · prose ${score.proseQuality}/100 · curated ${score.curatedWiring}% · eligible ${score.eligibleWiring}%` },
  scores: { ...score, overall: overallScore },
  metrics: {
    corpus: { totalPortals: files.length, curatedBoard: curatedHealth, eligibleBoard: eligibleHealth },
    placeholderBleed: placeholder,
    brainFidelity,
    dupRisk: { byName: dupRisk.byName.slice(0, 25), byBase: dupRisk.byBase.slice(0, 25), byCik: dupRisk.byCik.slice(0, 25), nameCount: dupRisk.byName.length, baseCount: dupRisk.byBase.length, cikCount: dupRisk.byCik.length },
    thinPortals: { below20Count: thin.below20.length, list: thin.below20.slice(0, 25) },
    domainRouting: { mismatchCount: domainRouting.mismatches.length, examples: domainRouting.mismatches.slice(0, 25) },
    categoryBleed,
    kernelIntegrity: { totalEligible: kernelIntegrity.totalEligible, nullCompositeCount: kernelIntegrity.nullCompositeEligible.length, nullCompositeRate: kernelIntegrity.nullCompositeRate, nanCompositeCount: kernelIntegrity.nanComposite.length, nullCompositeSample: kernelIntegrity.nullCompositeEligible.slice(0, 15), nanSample: kernelIntegrity.nanComposite.slice(0, 15) },
    prose: { badEntries: prose.badEntries, totalEntries: prose.totalEntries, badEntryRate: prose.badEntryRate, byIssue: prose.byIssue, portalsAffected: prose.portalsAffected, worst: prose.worst }
  },
  operatorAttention: attention,
  lastHeals: []
};

// Preserve heal log across pulses — the workflow runs audit FIRST then heal,
// and heal-corpus's history merge would otherwise see lastHeals=[] every time.
// Anyone calling the audit doesn't intend to forget what was healed before.
if (fs.existsSync(VITALS_PATH)) {
  try {
    const prev = JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8'));
    if (Array.isArray(prev.lastHeals) && prev.lastHeals.length) out.lastHeals = prev.lastHeals.slice(-20);
  } catch (e) { /* fresh start */ }
}

console.log('=== corpus vitals ===');
console.log('overall:', overallScore, status, '|', out.overall.summary);
console.log('per-metric:', JSON.stringify(score));
console.log('operator-attention items:', attention.length);
attention.forEach(a => console.log('  [' + a.severity.toUpperCase() + '] ' + a.issue + ' (' + a.count + ')'));
if (!DRY) {
  fs.writeFileSync(VITALS_PATH, JSON.stringify(out, null, 2));
  console.log('\nwritten:', VITALS_PATH);
}
