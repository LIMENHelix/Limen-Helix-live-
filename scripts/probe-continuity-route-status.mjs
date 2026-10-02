import fs from 'node:fs';
import crypto from 'node:crypto';

// Read-only page or static JSON asset HEAD observations, never API/action requests. Resume only
// against the exact same inventory bytes. HTTP success is not rendered proof.
const source = 'docs/audits/continuity-route-reconciliation.json';
const output = process.argv[2];
if (!output) throw new Error('Supply a checkpoint output path');
const bytes = fs.readFileSync(source);
const sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const inventory = JSON.parse(bytes);
const dataAssets = process.argv[3] === '--data-assets';
if (process.argv[3] && !dataAssets) throw new Error('Unknown probe scope');
if (dataAssets && inventory.dataAssets.some(file => !/^assets\/data\/[A-Za-z0-9_./-]+\.json$/.test(file) || file.includes('..')))
  throw new Error('Data inventory contains a non-static or unsafe path');
const scope = dataAssets ? 'static-data-assets' : 'pages';
const routes = [...new Set(dataAssets ? inventory.dataAssets.map(file => '/' + file)
  : [...inventory.routes.map(r => r.route), ...inventory.brokenLinks.map(r => r.route)])];
const report = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {
  schemaVersion: 'continuity-route-head-probe/1.0', source, sourceSha256,
  startedAt: new Date().toISOString(), method: 'HEAD', redirects: 'manual',
  targetScope: scope,
  scope: dataAssets ? 'HTTP static JSON asset availability only; no body, fallback API, content freshness or autonomy claim'
    : 'HTTP page availability only; no rendered content, data endpoint or autonomy claim', rows: []
};
if (report.sourceSha256 !== sourceSha256) throw new Error('Inventory changed; do not mix observations');
if ((report.targetScope || 'pages') !== scope || report.rows.some(row => !routes.includes(row.route)))
  throw new Error('Probe scope changed; do not mix observations');
const seen = new Set(report.rows.map(r => r.route));
const pending = routes.filter(route => !seen.has(route));
let next = 0;
function save() {
  report.updatedAt = new Date().toISOString();
  report.complete = report.rows.length === routes.length;
  report.counts = report.rows.reduce((counts, row) => { const key = row.skipped ? 'skipped' : row.error ? 'error' : String(row.status); counts[key] = (counts[key] || 0) + 1; return counts; }, {});
  fs.writeFileSync(output + '.tmp', JSON.stringify(report, null, 2) + '\n');
  fs.renameSync(output + '.tmp', output);
}
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < pending.length) {
    const route = pending[next++], url = new URL(route, 'https://limenhelix.com');
    const row = { route, observedAt: new Date().toISOString() };
    if (url.origin !== 'https://limenhelix.com' || route.startsWith('/api/')) row.skipped = 'outside-page-only-scope';
    else try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'LIMEN-continuity-read-only-audit/1.0' } });
      row.status = response.status; row.location = response.headers.get('location');
      row.contentType = response.headers.get('content-type');
    } catch (error) { row.error = String(error.message); }
    report.rows.push(row); save();
    if (report.rows.length % 100 === 0) console.log(JSON.stringify({ checked: report.rows.length, total: routes.length, counts: report.counts }));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}));
save(); console.log(JSON.stringify({ complete: report.complete, checked: report.rows.length, total: routes.length, counts: report.counts }));
