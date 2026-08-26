'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const HANDLER = path.join(ROOT, 'handlers', 'limen-research-evaluation-observer.js');
const STORE = path.join(ROOT, 'lib', 'autofire-efference-store.js');
const OUTCOME = path.join(ROOT, 'handlers', 'limen-outcome.js');
const RECOVERY = path.join(ROOT, 'lib', 'research-artifact-recovery.js');

function mock(file, exports, replacements) { const resolved = require.resolve(file); replacements.push([resolved, require.cache[resolved]]); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; }
function res() { return { statusCode: 200, body: '', setHeader() {}, end(value) { this.body = value || ''; } }; }
async function invoke(handler, headers) { const response = res(); await handler({ method: 'GET', url: '/api/limen-research-evaluation-observer', headers: headers || {} }, response); return { code: response.statusCode, json: JSON.parse(response.body || '{}') }; }

(async function () {
  const oldSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'research-observer-secret';
  const replacements = [], values = new Map(), recorded = [], recovered = [];
  const evaluatorIdentity = { kind: 'external-evaluator', value: 'evaluation:1', retrievedAt: '2026-08-25T00:00:00.000Z' };
  const event = { schemaVersion: 'autofire-outcome-observation/1.0', eventType: 'OUTCOME_RESEARCH_EVALUATED', lane: 'research', ownerDomain: 'medicine', outputId: 'eo_medicine_1', actionId: 'act_medicine_1', observationId: 'eval_medicine_1', observedAt: '2026-08-25T00:00:00.000Z', sourceIdentity: evaluatorIdentity, outcomeData: { evidenceIds: ['study-1', 'dataset-1'] } };
  values.set('research_evaluation_input:eval_medicine_1', {
    schemaVersion: 'research-evaluation-intake/1.0', intakeId: 'rei_1', status: 'ADMITTED', event,
    admissionEvidence: {
      publicationIdentity: { kind: 'external-publication', value: 'doi:10.1/original' },
      evaluatorIdentity,
      evidenceRecords: [
        { id: 'study-1', sourceIdentity: { kind: 'external-study', value: 'doi:10.2/replication' }, retrievedAt: '2026-08-25T00:01:00.000Z' },
        { id: 'dataset-1', sourceIdentity: { kind: 'external-dataset', value: 'dataset:independent-1' }, retrievedAt: '2026-08-25T00:02:00.000Z' }
      ]
    }
  });
  let strictFailure = false;
  mock(STORE, {
    assertDurable() { if (strictFailure) throw new Error('redis unavailable'); },
    async lrange() { return [{ observationId: 'eval_medicine_1' }, { observationId: 'missing' }]; },
    async get(key) { return values.get(key) || null; }
  }, replacements);
  mock(OUTCOME, { async recordAutonomousOutcome(value) { recorded.push(value); return { ok: true, event: value }; } }, replacements);
  mock(RECOVERY, { async recover(store, value) { recovered.push(value); return { ok: true, status: 'WITHDRAWN', applied: true, recoveryId: 'rar_1' }; } }, replacements);
  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  try {
    const unauthorized = await invoke(handler, {});
    assert.equal(unauthorized.code, 401);
    assert.equal(recorded.length, 0);
    const good = await invoke(handler, { authorization: 'Bearer research-observer-secret' });
    assert.equal(good.code, 200);
    assert.equal(good.json.eligible, 1);
    assert.equal(good.json.recorded, 1);
    assert.equal(good.json.abstentions.length, 1);
    assert.equal(good.json.recovery.withdrawn, 1);
    assert.equal(recovered.length, 1);
    assert.equal(recorded[0].eventType, 'OUTCOME_RESEARCH_EVALUATED');
    strictFailure = true;
    const unavailable = await invoke(handler, { authorization: 'Bearer research-observer-secret' });
    assert.equal(unavailable.code, 503);
    assert.equal(unavailable.json.error, 'research-evaluation-observer-failed');
    console.log('research evaluation observer handler: auth, durable readback, autonomous return, abstention, and failure path passed');
  } finally {
    if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
    delete require.cache[require.resolve(HANDLER)];
    replacements.forEach(function (row) { if (row[1]) require.cache[row[0]] = row[1]; else delete require.cache[row[0]]; });
  }
})().catch(function (error) { console.error(error); process.exit(1); });
