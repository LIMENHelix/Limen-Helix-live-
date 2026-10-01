import fs from 'node:fs';
import crypto from 'node:crypto';
const input = process.argv[2];
if (!input) throw new Error('Supply the completed probe path');
const probe = JSON.parse(fs.readFileSync(input, 'utf8'));
const bytes = fs.readFileSync(probe.source);
if (crypto.createHash('sha256').update(bytes).digest('hex') !== probe.sourceSha256) throw new Error('Source inventory differs');
const inventory = JSON.parse(bytes);
const expected = new Set([...inventory.routes.map(r => r.route), ...inventory.brokenLinks.map(r => r.route)]);
const seen = new Set(probe.rows.map(r => r.route));
if (!probe.complete || seen.size !== probe.rows.length || seen.size !== expected.size || [...expected].some(r => !seen.has(r))) throw new Error('Probe incomplete or coverage invalid');
const original = new Map(inventory.routes.map(r => [r.route, r]));
const counts = {}, audiences = {}, changes = [], unresolved = [];
for (const row of probe.rows) {
  const prior = original.get(row.route);
  const status = row.skipped ? 'SKIPPED' : row.error ? 'ERROR' : String(row.status);
  counts[status] = (counts[status] || 0) + 1;
  const audience = prior?.audience || 'Reported broken target outside full route inventory';
  audiences[audience] ||= {};
  audiences[audience][status] = (audiences[audience][status] || 0) + 1;
  if (prior && row.status && row.status !== prior.sourceStatus) changes.push({ route: row.route, historicalStatus: prior.sourceStatus, currentHeadStatus: row.status });
  if (status !== '200') unresolved.push({ ...row, audience, historicalStatus: prior?.sourceStatus ?? null });
}
console.log(JSON.stringify({ schemaVersion: 'continuity-route-probe-summary/1.0', sourceSha256: probe.sourceSha256,
  startedAt: probe.startedAt, updatedAt: probe.updatedAt, method: probe.method, complete: true,
  scope: probe.scope, targets: seen.size, counts, audiences, changes, unresolved,
  limits: ['HEAD status is not rendered content or link validation', 'Redirect destinations not followed', 'API routes intentionally skipped', 'Historical audience/retirement labels unchanged', 'No deployment or route mutation'] }, null, 2));
