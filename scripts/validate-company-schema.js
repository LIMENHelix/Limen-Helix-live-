#!/usr/bin/env node
/**
 * validate-company-schema.js
 *
 * Validates every JSON in assets/data/companies/ against the canonical
 * v2.0.1 schema defined in docs/portal-schema-v2.md.
 *
 * Exits 0 if every file passes; 1 if any drift is found.
 * Usage:
 *   node scripts/validate-company-schema.js           # validate all
 *   node scripts/validate-company-schema.js walmart   # validate one
 *   node scripts/validate-company-schema.js --v2only  # skip v1 legacy files
 */

const fs = require('fs');
const path = require('path');

const COMPANIES_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const BRAIN_NODES_FILE = path.join(__dirname, '..', 'assets', 'data', 'brain-node-domains.json');

const VALID_KERNEL_STATUS = new Set([
  'ELIGIBLE_NOW', 'INGESTION_SUSPECT', 'STALE', 'INSUFFICIENT_HISTORY',
  'ERROR', 'PRIVATE', 'FOREIGN_FILER', 'NOT_PROBED'
]);
const VALID_NEURAL_ROLE = new Set(['DMN', 'Salience', 'PFC', 'Motor', 'Sensory', 'Peer']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_SOURCE_TYPE = new Set([
  '10-K', '10-Q', '8-K', 'S-1', 'DEF14A', '20-F',
  'statutory', 'industry-report', 'news', 'inferred'
]);
const VALID_DOMAIN_ID = new Set([
  'agriculture','communication','culture','defense','education','energy',
  'environment','family','finance','governance','industry','infrastructure',
  'intelligence','law','medicine','population','religion','science',
  'technology','trade'
]);

const BRAIN_NODE_IDS = new Set(Object.keys(JSON.parse(fs.readFileSync(BRAIN_NODES_FILE, 'utf8'))));

const args = process.argv.slice(2);
const v2only = args.includes('--v2only');
const single = args.find(a => !a.startsWith('--'));

const files = single
  ? [path.join(COMPANIES_DIR, single + '.json')]
  : fs.readdirSync(COMPANIES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(COMPANIES_DIR, f));

let totalFiles = 0;
let totalPass = 0;
let totalFail = 0;
let totalSkipV1 = 0;
const allDrift = [];

function check(cond, msg, file, drifts) {
  if (!cond) drifts.push({ file: path.basename(file), msg });
}

function validateEntry(entry, slotName, file, drifts) {
  const prefix = `[${slotName}/${entry.name || entry.shortName || '?'}]`;
  check(typeof entry.name === 'string' && entry.name.length > 0, `${prefix} missing name`, file, drifts);
  check(VALID_NEURAL_ROLE.has(entry.neuralRole), `${prefix} invalid neuralRole: ${entry.neuralRole}`, file, drifts);
  check(typeof entry.brainNodeId === 'string' && BRAIN_NODE_IDS.has(entry.brainNodeId),
        `${prefix} unknown brainNodeId: ${entry.brainNodeId}`, file, drifts);
  check(typeof entry.brainNodeRole === 'string' && entry.brainNodeRole.length > 0,
        `${prefix} missing brainNodeRole`, file, drifts);
  check(typeof entry.relationshipNote === 'string' && entry.relationshipNote.length > 0,
        `${prefix} relationshipNote missing`, file, drifts);
  if (typeof entry.relationshipNote === 'string' && entry.relationshipNote.length > 0 && entry.relationshipNote.length < 30) {
    drifts.push({ file: path.basename(file), msg: `[warn] ${prefix} relationshipNote thin (${entry.relationshipNote.length} chars) — enrich in next pass` });
  }
  check(VALID_CONFIDENCE.has(entry.confidence),
        `${prefix} invalid confidence: ${entry.confidence}`, file, drifts);
  if (entry.sourceType) {
    const types = Array.isArray(entry.sourceType) ? entry.sourceType : [entry.sourceType];
    for (const t of types) {
      check(VALID_SOURCE_TYPE.has(t), `${prefix} invalid sourceType element: ${t}`, file, drifts);
    }
  } else {
    check(false, `${prefix} missing sourceType`, file, drifts);
  }
}

for (const file of files) {
  totalFiles++;
  let j;
  try {
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[FAIL] ${path.basename(file)} — JSON parse error: ${e.message}`);
    totalFail++;
    continue;
  }

  const drifts = [];

  // True v1 legacy = no functionalNetwork at all. Skip per --v2only flag.
  if (!j.functionalNetwork) {
    if (v2only) { totalSkipV1++; continue; }
    drifts.push({ file: path.basename(file), msg: '[legacy v1] no functionalNetwork — needs v2 migration' });
    console.error(`[FAIL] ${path.basename(file)}\n  - ${drifts[0].msg}`);
    allDrift.push(...drifts);
    totalFail++;
    continue;
  }
  // Partially-migrated v2 (has functionalNetwork but missing schemaVersion etc) — validate fully.

  // Top-level v2.0.1 required fields.
  check(j.schemaVersion === '2.0.1', `top: schemaVersion must be "2.0.1" (got: ${j.schemaVersion})`, file, drifts);
  check(j.type === 'company', `top: type must be "company"`, file, drifts);
  check(typeof j.companyId === 'string', `top: companyId required`, file, drifts);
  check(typeof j.slug === 'string', `top: slug required`, file, drifts);
  check(typeof j.name === 'string', `top: name required`, file, drifts);
  check(VALID_DOMAIN_ID.has(j.domainId), `top: invalid domainId: ${j.domainId}`, file, drifts);
  check(typeof j.portalAttachment === 'string', `top: portalAttachment required`, file, drifts);
  check(VALID_KERNEL_STATUS.has(j.kernelStatus), `top: invalid kernelStatus: ${j.kernelStatus}`, file, drifts);
  check(Array.isArray(j.fredSeries), `top: fredSeries must be array`, file, drifts);
  check(Array.isArray(j.feedSources), `top: feedSources must be array`, file, drifts);
  check(Array.isArray(j.marketDataTickers), `top: marketDataTickers must be array`, file, drifts);
  check(Array.isArray(j.commodityExposure), `top: commodityExposure must be array`, file, drifts);
  check(typeof j.financialHealth === 'object' && j.financialHealth !== null, `top: financialHealth must be object`, file, drifts);
  check(Array.isArray(j.warningSignals), `top: warningSignals must be array`, file, drifts);
  check(Array.isArray(j.opportunitySignals), `top: opportunitySignals must be array`, file, drifts);
  check(typeof j.commercializationStatus === 'object' && j.commercializationStatus !== null,
        `top: commercializationStatus must be object`, file, drifts);
  check(Array.isArray(j.newsFeed), `top: newsFeed must be array`, file, drifts);
  check(typeof j.domainRelevance === 'string' && j.domainRelevance.length >= 30,
        `top: domainRelevance missing or too short`, file, drifts);

  // functionalNetwork — required for kernelStatus != ERROR
  if (j.kernelStatus !== 'ERROR' && j.kernelStatus !== 'PRIVATE' && j.kernelStatus !== 'NOT_PROBED') {
    check(typeof j.functionalNetwork === 'object', `top: functionalNetwork required for kernelStatus=${j.kernelStatus}`, file, drifts);
  }

  if (j.functionalNetwork) {
    const fn = j.functionalNetwork;
    check(typeof fn.model === 'string' && fn.model.length > 0, `functionalNetwork.model required`, file, drifts);

    for (const slot of ['suppliers', 'logisticsPartners', 'customers', 'competitors',
                        'regulators', 'executiveTeam', 'marketSignals']) {
      if (!fn[slot]) continue;
      check(Array.isArray(fn[slot]), `fn.${slot} must be array`, file, drifts);
      if (Array.isArray(fn[slot])) {
        for (const e of fn[slot]) validateEntry(e, slot, file, drifts);
      }
    }
    if (fn.auditor) validateEntry(fn.auditor, 'auditor', file, drifts);
  }

  // Brain-node distribution warning (not an error)
  if (j.functionalNetwork) {
    const nodes = new Set();
    for (const slot of Object.values(j.functionalNetwork)) {
      if (Array.isArray(slot)) for (const e of slot) if (e.brainNodeId) nodes.add(e.brainNodeId);
      else if (slot && typeof slot === 'object' && slot.brainNodeId) nodes.add(slot.brainNodeId);
    }
    const totalEntries = [].concat(
      fn=j.functionalNetwork,
      fn.suppliers || [], fn.logisticsPartners || [], fn.customers || [],
      fn.competitors || [], fn.regulators || [], fn.executiveTeam || [], fn.marketSignals || [],
      fn.auditor ? [fn.auditor] : []
    ).filter(x => x && typeof x === 'object' && x.brainNodeId).length;
    if (totalEntries >= 10 && nodes.size <= 4) {
      drifts.push({ file: path.basename(file), msg: `[warn] only ${nodes.size} unique brain nodes across ${totalEntries} entries — consider diversifying taxonomy use` });
    }
  }

  if (drifts.length === 0) {
    totalPass++;
    if (single) console.log(`[PASS] ${path.basename(file)}`);
  } else {
    const hardFails = drifts.filter(d => !d.msg.startsWith('[warn]'));
    if (hardFails.length === 0) {
      totalPass++;
      console.warn(`[PASS+warn] ${path.basename(file)}`);
      for (const d of drifts) console.warn(`  - ${d.msg}`);
    } else {
      totalFail++;
      console.error(`[FAIL] ${path.basename(file)}`);
      for (const d of drifts) console.error(`  - ${d.msg}`);
    }
    allDrift.push(...drifts);
  }
}

console.log('\n──── SUMMARY ────');
console.log(`files scanned: ${totalFiles}`);
console.log(`pass:          ${totalPass}`);
console.log(`fail:          ${totalFail}`);
if (totalSkipV1) console.log(`v1-skipped:    ${totalSkipV1}`);
process.exit(totalFail > 0 ? 1 : 0);
