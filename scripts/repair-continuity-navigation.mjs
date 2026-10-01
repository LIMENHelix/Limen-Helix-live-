import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// One-time repair of the pre-repair inventory. Re-running against reconciled
// references intentionally aborts before writing; the JSON repair ledger is
// the durable record. This script never restores or creates a missing portal.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/audits/continuity-route-reconciliation.json'), 'utf8'));
const repairs = [];
for (const row of inventory.brokenLinks) {
  if (!/^\/[a-z]+_[a-z]+_portal$/.test(row.route)) continue;
  const domain = row.route.split('_')[0].slice(1);
  const parent = domain + '_portal.html';
  if (!fs.existsSync(path.join(root, parent))) throw Error('Missing owning parent: ' + parent);
  const files = [...new Set(row.localReferences.map(ref => ref.file))];
  if (files.length !== 1) throw Error('Unexpected reference scope: ' + row.route);
  const file = files[0];
  const original = fs.readFileSync(path.join(root, file), 'utf8');
  const href = row.route.slice(1) + '.html';
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const crumb = new RegExp('<a href="' + escaped + '">[^<]+</a><span class="bc-sep">&rarr;</span>');
  const back = new RegExp('<a href="' + escaped + '" class="topbar-back">&larr; [^<]+</a>');
  if (!crumb.test(original) || !back.test(original) || !original.includes('href="' + parent + '"')) {
    throw Error('Navigation contract changed: ' + file);
  }
  const updated = original.replace(crumb, '').replace(back,
    '<a href="' + parent + '" class="topbar-back">&larr; ' + domain[0].toUpperCase() + domain.slice(1) + '</a>');
  if (updated.includes('href="' + href + '"')) throw Error('Unrepaired reference: ' + file);
  repairs.push({ file, missingTarget: row.route, backTarget: '/' + parent.replace(/\.html$/, ''),
    scope: 'breadcrumb/back navigation only', original, updated });
}
if (repairs.length !== 23) throw Error('Expected 23 navigation repairs; inspect inventory');
// Validate the entire plan before changing any page.
for (const repair of repairs) fs.writeFileSync(path.join(root, repair.file), repair.updated);
const report = {
  evidenceLevel: 'LOCAL navigation fix; no deployment or current live HTTP claim',
  repairedTargets: repairs.length, repairedReferences: repairs.length * 2,
  repairs: repairs.map(({ original, updated, ...row }) => row),
  remainingTargets: inventory.brokenLinks.filter(row => !repairs.some(repair => repair.missingTarget === row.route)).map(row => row.route)
};
fs.writeFileSync(path.join(root, 'docs/audits/continuity-navigation-repair.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ repairedTargets: report.repairedTargets, repairedReferences: report.repairedReferences,
  remainingTargets: report.remainingTargets }, null, 2));
