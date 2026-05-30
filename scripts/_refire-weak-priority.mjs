#!/usr/bin/env node
/**
 * Re-fire the 5 weakly-anchored priority portals through the multipass
 * enricher (the same path that landed BMY when single-call failed 3x).
 * Multipass splits the work across 4 calls so each pass has more
 * breathing room for density and anchoring.
 *
 * Targets (anchored% from initial single-call run):
 *   veritone                   27%  ← worst
 *   athersys                   58%
 *   lindsay_corporation        59%
 *   houghton_mifflin_harcourt  62%
 *   lincoln_ed_services        81%
 *
 * Existing portals are OVERWRITTEN. Phase-1 reciprocity stubs already
 * resolved against these slugs will need to be re-evaluated since
 * brainNodeId / brainNodeRole inheritance may shift. Phase-1 resolver
 * is idempotent and safe to re-run after this completes.
 *
 * Each multipass run: ~8 min wall + ~$0.10 Haiku. Total ~40 min, ~$0.50.
 */
import { execSync } from 'node:child_process';

const TARGETS = [
  { slug: 'veritone',                  cik: '0001615165', ticker: 'VERI',
    name: 'Veritone, Inc.', domain: 'technology',
    hints: 'aiWARE enterprise AI cognitive computing platform — media (broadcast clip/captioning), public-safety (digital evidence management), energy forecasting; transactional + SaaS licensing; Chairman Ryan Steelberg.' },

  { slug: 'athersys',                  cik: '0001368148', ticker: 'ATHX',
    name: 'Athersys, Inc.', domain: 'medicine',
    hints: 'MultiStem allogeneic stem-cell platform — TREASURE Japan Phase 2/3 ischemic stroke (with Healios partnership), MASTERS-2 US Phase 3 stroke, ARDS Phase 1/2; Chapter 11 filed May 2024 (TERMINAL_DIVERGENCE phylogenetic failure case).' },

  { slug: 'lindsay_corporation',       cik: '0000836157', ticker: 'LNN',
    name: 'Lindsay Corporation', domain: 'agriculture',
    hints: 'Zimmatic center-pivot + lateral-move irrigation, FieldNET remote-management SaaS; Road Infrastructure segment (Road Zipper movable barriers, crash cushions); ~70/30 irrigation/infrastructure revenue split; CEO Randy Wood.' },

  { slug: 'houghton_mifflin_harcourt', cik: '0001580156', ticker: 'HMHC',
    name: 'Houghton Mifflin Harcourt Company', domain: 'education',
    hints: 'K-12 curriculum + digital — Into Reading + Into Math; HMH Ed Suite SaaS; Veritas Capital take-private $2.8B Apr 2022; ESSER pandemic-funding wind-down 2024-2026 affects district adoption cycles; CEO Jack Lynch.' },

  { slug: 'lincoln_ed_services',       cik: '0001168331', ticker: 'LINC',
    name: 'Lincoln Educational Services Corporation', domain: 'education',
    hints: 'For-profit post-secondary career/technical education — automotive + skilled trades (welding/HVAC/electrical) + healthcare + business; ~22 campuses; Title IV financial aid + gainful-employment + 90/10 rule + financial-responsibility composite-score exposure; CEO Scott Shaw.' }
];

let succeeded = 0;
let failed = 0;
const results = [];

for (let i = 0; i < TARGETS.length; i++) {
  const t = TARGETS[i];
  console.log('═══ [' + (i + 1) + '/' + TARGETS.length + '] ' + t.slug + ' ═══');

  // Shell out to the multipass orchestrator
  const cmd = [
    'node', 'scripts/portal-create-multipass.mjs',
    '--slug', t.slug,
    '--cik', t.cik,
    '--ticker', t.ticker,
    '--name', '"' + t.name + '"',
    '--domain', t.domain,
    '--hints', '"' + t.hints + '"'
  ].join(' ');

  console.log('  cmd: ' + cmd);
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);

    // Parse the summary line from multipass output
    const m = out.match(/passes succeeded:\s+(\d+)\s+\/\s+(\d+)/);
    const tot = out.match(/total fn entries:\s+(\d+)/);
    const passOk = m ? parseInt(m[1], 10) : 0;
    const passTotal = m ? parseInt(m[2], 10) : 0;
    const entries = tot ? parseInt(tot[1], 10) : 0;
    console.log('  multipass: ' + passOk + '/' + passTotal + ' passes, ' + entries + ' entries, ' + elapsed + 's');
    results.push({ slug: t.slug, ok: true, passes: passOk + '/' + passTotal, entries, elapsedSec: elapsed });
    if (passOk === passTotal && entries >= 30) succeeded++;
    else failed++;
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    console.log('  FAIL after ' + elapsed + 's: ' + (e.message || e).slice(0, 200));
    results.push({ slug: t.slug, ok: false, error: e.message || String(e), elapsedSec: elapsed });
    failed++;
  }
  console.log('');
}

console.log('═══ SUMMARY ═══');
for (const r of results) {
  if (r.ok) console.log('  ' + r.slug.padEnd(34) + ' ' + r.passes + ' passes, ' + r.entries + ' entries  (' + r.elapsedSec + 's)');
  else console.log('  ' + r.slug.padEnd(34) + ' FAIL: ' + (r.error || '?'));
}
console.log('  ' + succeeded + '/' + TARGETS.length + ' fully succeeded');
