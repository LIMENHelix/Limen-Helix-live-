'use strict';
// Bounded artifact migration, NOT a full digest rebuild. Default is read-only.
// Change only invalid verified verdicts and their counts; retain every payload,
// selected identity, ordering, timestamp, manifest and availability field.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { hasAffirmativeProvenance } = require('./treatment-provenance.cjs');
const root = path.resolve(__dirname, '..');
const digestFile = path.join(root, 'assets/data/deep/p2_agri-diagnosis-digest.json');
const indexFile = path.join(root, 'assets/data/opportunities-index.json');
const digest = JSON.parse(fs.readFileSync(digestFile)), index = JSON.parse(fs.readFileSync(indexFile));
const changes = new Map(); let count = 0;
for (const d of digest.diagnoses) d.tx.forEach((t, i) => {
  if (t.syn !== 0 || hasAffirmativeProvenance(t.c, t.st)) return;
  assert.match(t.c || '', /^\[CITATION NEEDED:/, 'unreviewed invalid evidence requires separate inspection');
  t.syn = 2; count++;
  if (!changes.has(d.id)) changes.set(d.id, []);
  changes.get(d.id).push({ i, label: t.l, sourceKey: t.k });
});
assert.ok(count === 0 || count === 11, 'only the reviewed11 incidences may change');
let indexed = 0;
for (const o of index.opportunities) if (o.d === 'p2_agri' && changes.has(o.id)) {
  for (const t of changes.get(o.id)) {
    assert.equal(o.tx[t.i].l, t.label, 'preserve exact selected position');
    assert.equal(o.tx[t.i].s, 0); o.tx[t.i].s = 2; indexed++;
  }
}
assert.equal(indexed, count);
digest.unknownTreatments += count;
for (const totals of [index.provenance, index.perDomain.p2_agri.provenance]) {
  totals.verifiedEligible -= count; totals.unknown += count;
}
if (process.argv.includes('--write') && count) {
  fs.writeFileSync(digestFile, JSON.stringify(digest));
  fs.writeFileSync(indexFile, JSON.stringify(index));
}
console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'write' : 'read_only',
  demotedIncidences: count, indexedIncidences: indexed, fleetProvenance: index.provenance,
  changedSources: Object.fromEntries(changes) }, null, 2));
