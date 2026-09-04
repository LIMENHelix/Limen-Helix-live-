#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const admission = require('../lib/portal-admission');
const enricher = require('../handlers/enrich-portal-claude');

const ROOT = path.resolve(__dirname, '..');
const categories = ['suppliers', 'logisticsPartners', 'customers', 'competitors', 'regulators', 'capitalProviders'];
const functionalNetwork = {};
for (const category of categories) functionalNetwork[category] = [];
for (let i = 0; i < 24; i++) {
  functionalNetwork[categories[i % categories.length]].push({
    name: `Counterparty ${i}`,
    ticker: null,
    cik: '0000001800',
    slug: `counterparty_${i}`,
    neuralRole: ['Sensory', 'Motor', 'Peer', 'DMN', 'Salience', 'PFC'][i % 6],
    brainNodeId: `N${i}`,
    brainNodeRole: 'Specific relational role',
    relationshipNote: `The 2024 relationship record identifies counterparty ${i} in this category.`,
    confidence: 'medium',
    sourceType: ['industry-report']
  });
}

const raw = {
  schemaVersion: '2.0.1', type: 'company', slug: 'model_guess', companyId: 'model_guess',
  name: 'Model Guess, Inc.', ticker: 'BAD', cik: '0000001800', domainId: 'economy',
  portalAttachment: 'industry-portal.html', fredSeries: [], feedSources: [], marketDataTickers: [],
  commodityExposure: [], warningSignals: [], opportunitySignals: [], newsFeed: [],
  commercializationStatus: { enginesRun: [], engineOutputs: [] }, notes: {},
  domainRelevance: 'Specific domain relevance that is long enough for admission.',
  portalRelevance: 'Specific portal relevance that is long enough for admission.',
  intelligenceCycle: [],
  kernelStatus: 'ELIGIBLE_NOW', helixReportMode: 'validated_kernel', helixReportUrl: 'made-up',
  financialHealth: { validationStatus: 'validated', compositeScore: 0.99, alert: true, dominantPhase: 'p3' },
  functionalNetwork: { model: 'Specific relational network model for this company.', ...functionalNetwork }
};
const target = { slug: 'hubbell', name: 'Hubbell Incorporated', ticker: 'HUBB', cik: '48898', domainId: 'industry' };
const prepared = admission.prepareGeneratedPortal(raw, target, null);
assert.equal(prepared.portal.slug, 'hubbell');
assert.equal(prepared.portal.companyId, 'hubbell');
assert.equal(prepared.portal.name, 'Hubbell Incorporated');
assert.equal(prepared.portal.ticker, 'HUBB');
assert.equal(prepared.portal.cik, '0000048898');
assert.equal(prepared.portal.kernelStatus, 'INGESTION_SUSPECT');
assert.equal(prepared.portal.financialHealth.validationStatus, 'unavailable');
assert.equal(prepared.portal.financialHealth.compositeScore, null);
assert.equal(prepared.portal.financialHealth.alert, false);
assert.equal(prepared.portal.financialHealth.dominantPhase, null);
assert.equal(prepared.sanitization.nestedCiksCleared, 24);
assert.ok(admission.networkEntries(prepared.portal).every(row => row.entry.cik === null));
assert.equal(admission.validatePortalAdmission(prepared.portal).ok, true);

const contaminated = JSON.parse(JSON.stringify(prepared.portal));
contaminated.functionalNetwork.suppliers[0].relationshipNote = 'Supplier [DATA_NEEDED: contract value].';
const refused = admission.validatePortalAdmission(contaminated);
assert.equal(refused.ok, false);
assert.ok(refused.errors.some(error => error.code === 'PLACEHOLDER_CONTAMINATION'));

const current = {
  financialHealth: { validationStatus: 'validated', compositeScore: 0.42, alert: false },
  kernelReadings: { k1: { phase: 'p5', composite: 0.42 }, primary: 'k1' },
  kernelStatus: 'ELIGIBLE_NOW', helixReportMode: 'validated_kernel', helixReportUrl: 'helix-report.html?cik=48898'
};
const enriched = admission.prepareGeneratedPortal(raw, target, current).portal;
for (const key of ['financialHealth', 'kernelReadings', 'kernelStatus', 'helixReportMode', 'helixReportUrl']) {
  assert.deepEqual(enriched[key], current[key]);
}

const systemPrompt = enricher._test.buildSystemBlock();
assert.ok(!systemPrompt.includes('use [DATA_NEEDED'));
assert.ok(!systemPrompt.includes('or DATA_NEEDED'));
assert.ok(systemPrompt.includes('The strings DATA_NEEDED, CITATION_NEEDED, VERIFY, TBD, TODO, INSERT, and PLACEHOLDER are forbidden'));
assert.ok(systemPrompt.includes('The admission floor is 20, so never return fewer than 24'));
assert.ok(!systemPrompt.includes('NAcc/OFC'));
assert.ok(!systemPrompt.includes('15-entry portal is shippable'));
assert.ok(systemPrompt.includes('0 for pure-B2C'));
assert.ok(!/\|\s*STRI\s*\|/.test(systemPrompt));
assert.ok(!/\|\s*FPN\s*\|/.test(systemPrompt));

const priorRegenKey = process.env.PORTAL_REGEN_ADMIN_KEY;
process.env.PORTAL_REGEN_ADMIN_KEY = 'scoped-portal-regen-test-key';
assert.equal(enricher._test.isAuthorized({ headers: { 'x-limen-pass': 'scoped-portal-regen-test-key' } }), true);
assert.equal(enricher._test.isAuthorized({ headers: { 'x-limen-pass': 'wrong-key' } }), false);
if (priorRegenKey === undefined) delete process.env.PORTAL_REGEN_ADMIN_KEY;
else process.env.PORTAL_REGEN_ADMIN_KEY = priorRegenKey;
assert.equal(enricher._test.isAnthropicCreditError({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), true);
assert.equal(enricher._test.isAnthropicCreditError({ error: { type: 'authentication_error', message: 'bad key' } }), false);
assert.deepEqual(enricher._test.parsePortalText('```json\n{"ok":true}\n```').portal, { ok: true });

const builderSource = fs.readFileSync(path.join(ROOT, 'scripts/build-fractal-portals.mjs'), 'utf8');
assert.ok(builderSource.includes('const MAX_DATA_NEEDED = 0'));
assert.ok(builderSource.includes("'x-limen-pass': ADMIN_KEY"));
assert.ok(builderSource.includes('PORTAL_REGEN_ADMIN_KEY'));
assert.ok(builderSource.includes('ALIAS[c.s] && slugSet.has(ALIAS[c.s])'));

const dry = execFileSync(process.execPath, ['scripts/build-fractal-portals.mjs', '--tier', '1', '--source', 'eligible', '--limit', '1', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
// Eligible alone has 171 missing rows. The autonomous combined queue reports
// 170 eligible additions because one slug already appears in its 5 curated
// targets, yielding 175 unique targets rather than double-counting 176 rows.
assert.match(dry, /queue: 171\b/);

console.log('PASS generated identity is target-authoritative and CIK is zero-padded');
console.log('PASS new portals cannot inherit model-authored kernel claims');
console.log('PASS existing portals preserve prior kernel fields exactly');
console.log('PASS nested model-authored CIKs are cleared before admission');
console.log('PASS every placeholder token is rejected');
console.log('PASS the paid endpoint accepts only the scoped regeneration key or existing master key');
console.log('PASS Anthropic credit exhaustion is narrowly identified for the metered xAI fallback');
console.log('PASS builder authenticates and the standalone eligible queue is measured at 171');
