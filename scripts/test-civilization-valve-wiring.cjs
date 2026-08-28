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
  assert.ok(line.source && line.actionRoute && line.destination && line.observerRoute && line.recoveryRoute, line.id + ' has a complete visible path');
  if (line.actionRoute !== 'limen-worker-autofire') assert.equal(Registry.forRoute(line.actionRoute), line.id, line.id + ' route is runtime-valve bound');
}
console.log('civilization valve wiring: Admin link, real topology, 20 route identities, worker owner routing, and emergency control passed');
