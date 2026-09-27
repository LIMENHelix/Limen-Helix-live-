'use strict';
// Full-pool availability is diagnosis-treatment incidence, not globally unique
// treatment entities, and must be measured before the 180-diagnosis window.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-digest-availability-'));
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function treatments(count) {
  return Array.from({ length: count }, (_, i) => ({ label: 'Source treatment ' + i, evidence: 'A', cite: 'authored-source', steps: ['step ' + i] }));
}
function write(dir, slug, issues, count = 8) {
  fs.writeFileSync(path.join(dir, slug + '.json'), JSON.stringify({ issues,
    activations: [{ brainNodeId: 'N', treatments: treatments(count) }, { brainNodeId: 'M', treatments: treatments(2) }] }));
}
function issue(id) { return { id, label: id, circuits: [{ nodeId: 'N', evidence: 'A' }], _authored: [{ nodeId: 'N' }, { nodeId: 'M' }] }; }
(async () => {
  const { buildDigest } = await import('./build-diagnosis-digest.mjs');
  for (const pk of ['finance', 'p2_agri', 'communication']) {
    for (const count of [0, 3, 180, 181, 205]) {
      test(pk + ': full availability at ' + count + ' diagnoses', () => {
        const dir = path.join(temporary, pk + '-' + count); fs.mkdirSync(dir);
        write(dir, pk, [issue('ROOT_MUST_BE_EXCLUDED')], 100);
        write(dir, pk + '_fixture', Array.from({ length: count }, (_, i) => issue('DX_' + i)));
        // Duplicate ID: richest occurrence wins, not sum of siblings. Canonical
        // and authored circuits overlap at N; that node must be counted once.
        if (count) write(dir, pk + '_richer', [issue('DX_0')], 16);
        if (count > 1) write(dir, pk + '_poorer', [issue('DX_1')], 1);
        const result = buildDigest(pk, dir);
        const expected = count * 10 + (count ? 8 : 0);
        assert.equal(result.diagnosisTotalAvailable, count);
        assert.equal(result.availableTreatments, expected, 'full pool includes unselected diagnosis links');
        assert.equal(result.diagnosisCount, Math.min(count, 180));
        const cap = pk === 'finance' ? 6 : 2;
        assert.equal(result.treatmentTotal, Math.min(count, 180) * cap, 'selected treatment cap unchanged');
        assert.equal(result._manifest.length, count);
        assert.ok(result.diagnoses.every(d => d.depth === 2), 'p2_agri underscore does not shift depth');
        assert.equal(result.unknownTreatments, 0);
        assert.equal(result.syntheticTreatments, 0);
        assert.deepEqual(result, buildDigest(pk, dir), 'deterministic repeated build');
      });
    }
    test(pk + ': stratified depths preserve full-pool sum', () => {
      const dir = path.join(temporary, pk + '-depths'); fs.mkdirSync(dir);
      const expectedIds = [];
      for (let depth = 2; depth <= 6; depth++) {
        const ids = Array.from({ length: 41 }, (_, i) => 'DEPTH_' + depth + '_DX_' + i);
        expectedIds.push(...ids);
        write(dir, pk + '_' + Array(depth - 1).fill('branch').join('_'), ids.map(issue), depth);
      }
      const result = buildDigest(pk, dir);
      assert.equal(result.availableTreatments, 41 * (4 + 5 + 6 + 7 + 8));
      assert.equal(result.diagnosisTotalAvailable, 205);
      assert.equal(result.diagnosisCount, 180);
      assert.deepEqual(result._manifest.map(d => d[0]).sort(), expectedIds.sort());
      assert.deepEqual([...new Set(result.diagnoses.map(d => d.depth))].sort(), [2, 3, 4, 5, 6]);
      assert.equal(result.treatmentTotal, result.diagnoses.reduce((n, d) => n + d.tx.length, 0));
    });
  }
  // Pinned accounting snapshot from the independent local full-source scan on
  // 2026-09-27. Bind expected totals to exact manifest bytes; this is not a
  // completeness/provenance certification. Rebaseline intentionally if the
  // corpus changes, never derive availability from the selected 180 rows.
  const snapshots = [
    ["communication",32943,603212,"b8c4ffe4559ff819ac91bc883f4ae1e75b987ba8d86c3f8c5aef598013c03edf"],
    ["culture",47754,868278,"af441adacfc8fab2dfaa2ba570b36b0bef2425f9840c280b1da3f9a1a59c8819"],
    ["defense",52755,957476,"4fb87604669725502c88bf91d6837589ff4fe42aed463be60dfa678c6ab93d91"],
    ["economy",45792,832979,"c820d36f0a2c596f8de4cdd013afb60c8f0c5fdfd6b2a5e040bc7e1a5d18a96c"],
    ["education",31313,574051,"bb9b2ec300015a7a671346c549b1ad3ab72ef0a5dfad17ffccd0de650ea3e831"],
    ["energy",51984,943726,"c783e30a9f7eea63d3726c7b7ebff480a660f2b209ccf5c1104f9f9ec6f9e3d4"],
    ["environment",53343,967706,"2db9ad643e0014d4d8ba6ec038cd1c75551836a7798ebf831b7a79ccd20ea374"],
    ["finance",37614,686503,"bf6bd5f560425e51699a4cd0ca7eaab942af65085fa061f7d03c4873ad7ce835"],
    ["governance",54312,985292,"d2f93c8be9673f9405a736373ed9556b285cadf909a3da23af41124fe78093c1"],
    ["industry",52254,948514,"63770858a982f6a0ff6adf7bf3ae366288f95584417e941f3be97476d35416d8"],
    ["infrastructure",52284,948980,"282b2de66f4d439a0cc34af4717a79cac415f14bc9930a76c0797ae89fcde4b9"],
    ["intelligence",39768,724943,"e6517fbaa4e503e5f312f675bc25cbd64a3c5945ab47542bd83dc4f545431d93"],
    ["law",35421,647157,"afd248e074f9b5b475d9e641f484aaa0ded57edc4e215396a93224c88d03315f"],
    ["medicine",34176,611136,"2fa9d791f4b20d534e1587420883e8c0d942d481d0188e25bf9c02f6deee7c93"],
    ["p2_agri",54004,934921,"f959bb915c101d3cc9fba8c85f847725a4ddbf67e40c66689ae5f0719915b2b4"],
    ["population",55002,997270,"86cdd1bfea8d71ed139e33db9d86cae8545654addc767962d4fe5c4ae7dba6be"],
    ["religion",54282,984890,"cf6fa2171979af83ef797a9194fee73112b5dfe4299f3065cadbc146a43d0f3f"],
    ["science",33249,608277,"55239b20d6a9929962083facbeb6e42dcc18534740758a825d8a0db5d522c9f8"],
    ["technology",36186,660893,"1f415007cc03773f89cb8679ec3335c98e5df0332dc01f14f74fc9e352ff1a53"],
    ["trade",32508,595445,"955b0a6d9eefcb498e1f7724fb0191327b2df117128d23dfe136730235d02e78"],
  ];
  for (const [pk, diagnosisTotal, treatmentLinks, manifestHash] of snapshots) {
    test(pk + ': committed full-pool availability snapshot', () => {
      const deep = path.join(__dirname, '../assets/data/deep');
      const manifest = fs.readFileSync(path.join(deep, pk + '-diagnosis-manifest.json'));
      const digest = JSON.parse(fs.readFileSync(path.join(deep, pk + '-diagnosis-digest.json'), 'utf8'));
      assert.equal(crypto.createHash('sha256').update(manifest).digest('hex'), manifestHash, 'manifest population is pinned');
      assert.equal(digest.diagnosisTotalAvailable, diagnosisTotal);
      assert.equal(JSON.parse(manifest).entries.length, diagnosisTotal);
      assert.equal(digest.availableTreatments, treatmentLinks, 'committed total must include unselected diagnoses');
    });
  }
  console.log(passed + '/' + (passed + failed) + ' digest availability tests passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => {
  const resolved = fs.realpathSync(temporary);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('limen-digest-availability-'));
  fs.rmSync(resolved, { recursive: true });
});
