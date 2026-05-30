#!/usr/bin/env node
/**
 * scripts/portal-redensify-weak.mjs
 *
 * Re-densifies portals that scored anchoredRate < 0.7 in the genericity
 * audit. Sends each through /api/enrich-portal-claude with strict-anchor
 * instructions appended on top of the portal's existing target metadata.
 * Writes the new portal back IF the server-side densityReport returns
 * genericityWarning: false (≥ 70% anchored). Otherwise saves to
 * _failed-redensify-N for manual review.
 *
 * Usage:
 *   node scripts/portal-redensify-weak.mjs                   # all weak
 *   node scripts/portal-redensify-weak.mjs --slugs a,b
 *   node scripts/portal-redensify-weak.mjs --limit 6         # first N weak
 *   node scripts/portal-redensify-weak.mjs --dry-run
 *
 * Spacing: 90s between calls (Haiku 10K TPM cap).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');
const BACKUP_DIR = path.join(PORTAL_DIR, '_pre-redensify');
const BASE = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const limitArg = (function () {
  const i = argv.indexOf('--limit');
  return i === -1 ? Infinity : parseInt(argv[i + 1], 10);
})();
const slugsArg = (function () {
  const i = argv.indexOf('--slugs');
  return i === -1 ? null : (argv[i + 1] || '').split(',').map(s => s.trim()).filter(Boolean);
})();

const ANCHOR_PATTERNS = [
  /\b(19|20)\d{2}\b/,
  /\$\s*\d+(?:[.,]\d+)?\s*(?:[BMK]|billion|million|trillion|bn|mn)?/i,
  /\b\d+(?:\.\d+)?\s*%/,
  /\b(?:CFR|U\.S\.C|USC|FDA|EPA|FTC|SEC|USPTO|NHTSA|OFAC|CFTC|FERC|FAA|FCC|NMPA|MHRA|EMA|PMDA|GDPR|HIPAA|SOX|DORA|MiCA|REACH)\b/,
  /\bSection\s+\d/i,
  /\bPart\s+\d{2,}/i,
  /\b\d+\s*(?:basis points|bps)\b/i,
  /\bQ[1-4]\s*20\d{2}\b/i,
  /\b(?:Form|10-K|10-Q|8-K|13F|S-1|14A|20-F)\b/i
];

const CATEGORIES = [
  'suppliers', 'logisticsPartners', 'customers', 'competitors',
  'regulators', 'capitalProviders', 'executiveTeam', 'marketSignals',
  'peers', 'partners', 'auditors'
];

function hasAnchor(text) {
  if (!text || typeof text !== 'string') return false;
  for (const re of ANCHOR_PATTERNS) if (re.test(text)) return true;
  return false;
}

function auditPortal(p) {
  const fn = p.functionalNetwork || {};
  let anchored = 0, generic = 0;
  function check(arr) {
    if (!Array.isArray(arr)) return;
    for (const e of arr) {
      if (!e || typeof e !== 'object' || e._autoReciprocityFill) continue;
      const note = e.relationshipNote || e.note || '';
      if (hasAnchor(note)) anchored++; else generic++;
    }
  }
  for (const cat of CATEGORIES) check(fn[cat]);
  if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) {
    if (hasAnchor(fn.auditor.relationshipNote || fn.auditor.note || '')) anchored++;
    else generic++;
  }
  return { anchored, generic, rate: (anchored + generic) > 0 ? anchored / (anchored + generic) : 0 };
}

async function loadPortal(slug) {
  const raw = await fs.readFile(path.join(PORTAL_DIR, slug + '.json'), 'utf8');
  return JSON.parse(raw);
}

const STRICT_INSTRUCTIONS_SUFFIX =
  ' STRICT-ANCHOR PASS: this is a re-densification because the prior pass ' +
  'produced too many generic relationshipNotes. Every relationshipNote MUST ' +
  'contain at least one of: 4-digit year, $-amount with B/M/K suffix, ' +
  'percent, named program/contract, agency code (FDA/EPA/FTC/SEC/CFR etc.), ' +
  'specific facility location, or named executive. Generic prose like ' +
  '"primary supplier" or "key partner" or "important regulator" without an ' +
  'anchor is REJECTED. If you do not know a specific anchor, write ' +
  '[DATA_NEEDED: <missing>] inline rather than producing generic prose.';

async function redensifyOne(slug) {
  const existing = await loadPortal(slug);
  const target = {
    cik: existing.cik || null,
    slug: existing.slug || slug,
    name: existing.name || slug,
    ticker: existing.ticker || null,
    domainId: existing.domainId || null,
    industry: existing.industry || null,
    instructions: (existing.instructions || '') + STRICT_INSTRUCTIONS_SUFFIX
  };

  const t0 = Date.now();
  const r = await fetch(BASE + '/api/enrich-portal-claude', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target, currentPortal: existing, maxTokens: 15000 })
  });
  const j = await r.json();
  const elapsed = (Date.now() - t0) / 1000;
  if (!j.ok) {
    return { slug, status: 'enrich-fail', detail: j.error || j.parseError, elapsed };
  }
  const dr = j.densityReport || {};
  const newAudit = auditPortal(j.portal);
  return {
    slug,
    status: 'ok',
    serverWarning: dr.genericityWarning,
    serverRate: dr.anchoredRate,
    localRate: newAudit.rate,
    elapsed,
    entries: dr.functionalNetworkTotal,
    portal: j.portal
  };
}

async function main() {
  // Build weak list locally first
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  // Skip portals that already failed a re-densify pass — their
  // .failed.json marker means the strict prompt couldn't lift them
  // and they need targeted instructions. Use --slugs to override.
  let knownFailed = new Set();
  try {
    const failedFiles = await fs.readdir(BACKUP_DIR);
    for (const ff of failedFiles) {
      if (ff.endsWith('.failed.json')) knownFailed.add(ff.replace(/\.failed\.json$/, ''));
    }
  } catch (_) { /* dir doesn't exist yet, fine */ }

  const entries = await fs.readdir(PORTAL_DIR);
  const weak = [];
  for (const f of entries) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const slug = f.replace(/\.json$/, '');
    if (slugsArg && !slugsArg.includes(slug)) continue;
    if (!slugsArg && knownFailed.has(slug)) continue;  // already tried + failed
    try {
      const p = await loadPortal(slug);
      if (p.schemaVersion !== '2.0.1') continue;
      const audit = auditPortal(p);
      if (audit.rate < 0.7) weak.push({ slug, rate: audit.rate, total: audit.anchored + audit.generic });
    } catch (_) { /* skip */ }
  }
  weak.sort((a, b) => a.rate - b.rate);
  const targets = slugsArg ? weak : weak.slice(0, isFinite(limitArg) ? limitArg : weak.length);

  console.log('=== Re-densify weak portals ===');
  console.log('base:    ' + BASE);
  console.log('weak:    ' + weak.length + ' (rate < 0.7)');
  console.log('targets: ' + targets.length + (slugsArg ? ' (slug-filtered)' : ' (' + (isFinite(limitArg) ? limitArg : 'all') + ')'));
  console.log('dryRun:  ' + dryRun);
  console.log('');

  const summary = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log('[' + (i + 1) + '/' + targets.length + '] ' + t.slug + ' (prior rate ' + (t.rate * 100).toFixed(0) + '%)');
    if (dryRun) {
      summary.push({ slug: t.slug, status: 'dry-run' });
      continue;
    }
    try {
      const result = await redensifyOne(t.slug);
      if (result.status !== 'ok') {
        console.log('  FAIL: ' + result.detail);
        summary.push({ slug: t.slug, status: 'fail', detail: result.detail });
      } else {
        const before = t.rate;
        const after = result.localRate;
        console.log('  rate: ' + (before * 100).toFixed(0) + '% → ' + (after * 100).toFixed(0) + '%' +
                    ' (' + result.entries + ' entries, ' + result.elapsed.toFixed(0) + 's)');
        if (result.serverWarning && after < 0.7) {
          // Still weak. Save to _failed dir for manual review.
          const failPath = path.join(BACKUP_DIR, t.slug + '.failed.json');
          await fs.writeFile(failPath, JSON.stringify(result.portal, null, 2), 'utf8');
          console.log('  STILL WEAK — saved candidate to ' + path.relative(REPO_ROOT, failPath));
          summary.push({ slug: t.slug, status: 'still-weak', before, after });
        } else {
          // Backup existing then write
          const existing = await loadPortal(t.slug);
          await fs.writeFile(path.join(BACKUP_DIR, t.slug + '.json'), JSON.stringify(existing, null, 2), 'utf8');
          await fs.writeFile(path.join(PORTAL_DIR, t.slug + '.json'), JSON.stringify(result.portal, null, 2), 'utf8');
          console.log('  WROTE ' + t.slug + '.json');
          summary.push({ slug: t.slug, status: 'rewritten', before, after, entries: result.entries });
        }
      }
    } catch (e) {
      console.log('  EXCEPTION: ' + e.message);
      summary.push({ slug: t.slug, status: 'exception', detail: e.message });
    }
    // 90s pacing
    if (i < targets.length - 1) {
      console.log('  (90s pause for TPM)');
      await new Promise(r => setTimeout(r, 90000));
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  const c = summary.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  for (const [k, v] of Object.entries(c)) console.log('  ' + k + ': ' + v);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
