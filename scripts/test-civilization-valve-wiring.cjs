'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Registry = require('../lib/civilization-valve-registry.js');

const router = fs.readFileSync(require.resolve('../api/[...route].js'), 'utf8');
const worker = fs.readFileSync(require.resolve('../handlers/limen-worker-autofire.js'), 'utf8');
const admin = fs.readFileSync(require.resolve('../admin.html'), 'utf8');
const page = fs.readFileSync(require.resolve('../admin-valves.html'), 'utf8');
const kill = fs.readFileSync(require.resolve('../lib/ai-kill-switch.js'), 'utf8');

assert.match(router, /runtimeValveHold\(name, req\)/);
assert.match(router, /authorizeActivity\(name, req\.method/);
assert.match(router, /statusCode = 423/);
assert.match(router, /CivilizationValve\.authorize\(valveId\)/);
assert.match(router, /PREPARATION_POST_ROUTES = new Set/);
assert.match(router, /INTERNALLY_GATED_OR_RECOVERY_POST_ROUTES = new Set/);
assert.match(router, /INTERNALLY_GATED_OR_RECOVERY_POST_ROUTES\.has\(name\)/);
const recoveryPostBlock = router.match(/INTERNALLY_GATED_OR_RECOVERY_POST_ROUTES = new Set\(\[([\s\S]*?)\]\);/)[1];
assert.match(recoveryPostBlock, /'communication-video-upload-work'/,
  'provider preflight must use its own JIT gate while receipt replay remains available after valve closure');
assert.match(router, /'agriculture-homestead-cycle'.*'economy-investment-cycle'/s);
const prepBlock = router.match(/PREPARATION_POST_ROUTES = new Set\(\[([\s\S]*?)\]\);/)[1];
assert.doesNotMatch(prepBlock, /'autopilot'/);
assert.doesNotMatch(prepBlock, /'homestead-automail'/);
assert.match(worker, /civilizationValveRegistry\.forCandidate\(entry\)/);
assert.match(worker, /civilizationValve\.authorize\(runtimeValveId, efferenceStore\)/);
assert.match(admin, /card\('\/admin-valves','Valve Room'/);
assert.match(page, /source \/ afferent/);
assert.match(page, /separate domain brain/);
assert.match(page, /decision gate/);
assert.match(page, /Runtime inhibitor/);
assert.match(page, /reafference/);
assert.match(page, /learning \/ rollback/);
assert.match(page, /Past \/ implemented/);
assert.match(page, /Present \/ commissioning/);
assert.match(page, /Future \/ next proof/);
assert.match(page, /Durable live proof/);
assert.match(page, /Complete control inventory/);
assert.match(page, /Missing domain trigger maps/);
assert.match(page, /Deployment controls · values never exposed/);
assert.match(page, /Cadence pumps/);
assert.match(page, /Vercel scheduler →/);
assert.match(page, /Pathway/);
assert.match(page, /ACTIVATE NUKE — FREEZE AND PRESERVE/);
assert.match(page, /ADVANCE TO/);
assert.match(page, /nextNukeStage/);
assert.match(page, /PAID AI INTERLOCK/);
assert.match(kill, /require\('\.\/autofire-efference-store'\)/);
assert.match(kill, /AI runtime pause readback verification failed/);
assert.match(kill, /catch \(e\) \{ return true; \}/);
for (const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(match[1]);

for (const line of Registry.LINES) {
  assert.ok(line.source && line.actionRoute && line.destination, line.id + ' has a visible source-to-effect path');
  assert.ok(line.observerRoute || /^NOT_COMMISSIONED_/.test(String(line.observerStatus || '')),
    line.id + ' has an implemented observer route or an explicit uncommissioned observer status');
  assert.ok(line.recoveryRoute || /^NOT_COMMISSIONED_/.test(String(line.recoveryStatus || '')),
    line.id + ' has an implemented recovery route or an explicit uncommissioned recovery status');
  if (line.actionRoute !== 'limen-worker-autofire') {
    assert(Registry.forRouteAll(line.actionRoute).includes(line.id), line.id + ' route is runtime-valve bound');
  }
}
const youtube = Registry.get('communication:youtube');
assert.equal(youtube.observerRoute, null);
assert.equal(youtube.observerStatus, 'NOT_COMMISSIONED_PRIVATE_PROVIDER_READBACK_ONLY');
assert.equal(youtube.recoveryRoute, 'communication-video-upload-work');
assert.equal(youtube.recoveryStatus, 'IMPLEMENTED_DURABLE_RECEIPT_REPLAY_NO_PROVIDER_RETRY');
console.log('civilization valve wiring: Admin link, real topology, all route identities including shared clocks, worker owner routing, and emergency control passed');
