// build-opportunity-index.mjs — flatten every domain's diagnoses into one ranked
// opportunity index. Each diagnosis already maps dysregulation -> nodes (circuits)
// -> feed (themes) -> treatments/businesses (tx). We surface ALL of them, ranked.
// Output: assets/data/opportunities-index.json (assets/data/*.json is bundled + served).
//
// No validation gate on SURFACING: a lead is a work queue, not a claim. Ranking is by
// evidence strength + depth; the outward-claim honesty bar applies only when one is
// published or acted on, not to listing it.
import fs from 'fs';

const DEEP = 'assets/data/deep';
const EV_RANK = { Strong: 3, Moderate: 2, Emerging: 1, Weak: 1, Limited: 1 };

const digests = fs.readdirSync(DEEP).filter(f => f.endsWith('-diagnosis-digest.json'));
const opportunities = [];
const perDomain = {};
let txOppTotal = 0;

for (const f of digests) {
  let j; try { j = JSON.parse(fs.readFileSync(DEEP + '/' + f, 'utf8')); } catch (e) { continue; }
  const domain = j.domain || f.replace('-diagnosis-digest.json', '');
  const diags = Array.isArray(j.diagnoses) ? j.diagnoses : [];
  perDomain[domain] = { diagnoses: diags.length, treatmentOpps: 0 };
  for (const d of diags) {
    const tx = Array.isArray(d.tx) ? d.tx : [];
    perDomain[domain].treatmentOpps += tx.length;
    txOppTotal += tx.length;
    opportunities.push({
      d: domain,
      id: d.id,
      l: d.label,
      n: Array.isArray(d.circuits) ? d.circuits : [],   // dysregulated nodes
      th: Array.isArray(d.themes) ? d.themes : [],       // feed link
      ev: d.evidence || null,
      dp: d.depth || 0,
      txn: tx.length,                                     // # treatment/business actions
      tx: tx.slice(0, 3).map(t => t.l || t.label || t.t).filter(Boolean),  // top actions
      evr: EV_RANK[d.evidence] || 0
    });
  }
}

// rank: evidence strength, then treatment breadth, then depth
opportunities.sort((a, b) => (b.evr - a.evr) || (b.txn - a.txn) || (b.dp - a.dp));

const out = {
  generatedAt: new Date().toISOString(),
  totalDiagnoses: opportunities.length,
  totalTreatmentOpps: txOppTotal,
  domains: Object.keys(perDomain).length,
  perDomain,
  opportunities
};
fs.writeFileSync('assets/data/opportunities-index.json', JSON.stringify(out));

// report
const rows = Object.entries(perDomain).sort((a, b) => b[1].diagnoses - a[1].diagnoses);
console.log('DOMAIN'.padEnd(16) + 'DIAGNOSES'.padStart(11) + 'TREATMENT-OPPS'.padStart(16));
for (const [dom, v] of rows) console.log(dom.padEnd(16) + String(v.diagnoses).padStart(11) + String(v.treatmentOpps).padStart(16));
console.log('-'.repeat(43));
console.log('TOTAL'.padEnd(16) + String(out.totalDiagnoses).padStart(11) + String(out.totalTreatmentOpps).padStart(16));
console.log('\nwrote assets/data/opportunities-index.json (' + (fs.statSync('assets/data/opportunities-index.json').size / 1e6).toFixed(1) + 'MB)');
