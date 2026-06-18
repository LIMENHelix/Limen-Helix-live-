/**
 * f0-survival-probe.cjs — proves Energy's recurrent brain model (energyModel /
 * predictionError / regulationState / readyForHandoff) SURVIVES end-to-end:
 *   energy-brain.state.energyModel → brain-adapter payload → Civilization packet →
 *   HandoffPacket → ArtifactPacket → finalizer safe-extract (the AI prompt input).
 * Read-only. Uses the REAL transform functions from each hop file.
 * Run: node scripts/_taxonomy-pilot/f0-survival-probe.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib.cjs');

const ROOT = path.join(__dirname, '..', '..');
const A = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── 1. get a REAL energyModel by running the energy brain once ──────────────
function brainContext() {
  const doc = { createElement: () => ({ style: {}, set textContent(v) {}, set innerHTML(v) {}, appendChild() {}, addEventListener() {} }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, head: { appendChild() {} }, body: {} };
  const loc = { pathname: '/civilization.html', search: '', href: 'x' };
  const fetch = (url) => { var rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]; var p = path.join(ROOT, rel); if (rel.startsWith('assets/data/') && fs.existsSync(p)) { var t = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); } return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') }); };
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: false, location: loc, document: doc, LIMENDomains: { register() {}, list: [] }, LIMENActionAdapters: { getDrafts: () => [], createDraft() {} }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, fetch };
  const sb = { window: win, document: doc, location: loc, navigator: { userAgent: 'p' }, console: { log() {}, warn() {}, error() {}, info() {} }, Math: Math, Date: Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, Map, Set, fetch, setTimeout: () => 0, setInterval: () => 0, clearInterval() {} };
  sb.globalThis = sb; sb.self = sb; vm.createContext(sb); return sb;
}

// ── 2. shared civilization context with capture of internal functions ───────
function civContext() {
  const sb = L.makeContext({ seed: 7 });
  sb.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve('') });
  sb.window.fetch = sb.fetch;
  sb.window.LIMENDomains = {};
  sb.window.__cap = {};
  return sb;
}
function loadWithCapture(ctx, file, names) {
  let src = A(file);
  const marker = ';try{window.__cap=window.__cap||{};' + names.map(n => 'if(typeof ' + n + '!=="undefined")window.__cap[' + JSON.stringify(n) + ']=' + n + ';').join('') + '}catch(e){}';
  const idx = src.lastIndexOf('})()');
  if (idx === -1) throw new Error(file + ': no IIFE close found');
  src = src.slice(0, idx) + marker + src.slice(idx);
  vm.runInContext(src, ctx, { filename: file });
}

const results = [];
function hop(name, fn) { try { var r = fn(); results.push({ name, ok: r.ok, detail: r.detail }); } catch (e) { results.push({ name, ok: false, detail: 'ERROR: ' + (e && e.message || e) }); } }

(async function () {
  // real energyModel
  const bc = brainContext();
  vm.runInContext(A('assets/js/domain-brains/domain-brain-base.js'), bc, { filename: 'base' });
  vm.runInContext(A('assets/js/domain-brains/energy-brain.js'), bc, { filename: 'energy-brain' });
  const brain = bc.window.LIMENEnergyBrain;
  await brain.cycle();
  // give the model a non-trivial state so survival is visible
  brain.state.stress = 0.7; if ((brain.state.diagnoses || [])[0]) brain.state.diagnoses[0].active = true;
  brain._updateEnergyModel(); brain._updateEnergyModel();
  const realState = JSON.parse(JSON.stringify(brain.state));
  const EM = realState.energyModel;
  console.log('\n================ F0 — ENERGY SURVIVAL PROBE ================\n');
  console.log('source energyModel: cycle=' + EM.cycle + ' predictionError.total=' + (EM.predictionError && EM.predictionError.total) + ' regulation=' + (EM.regulation && EM.regulation.state) + ' readyForHandoff=' + EM.readyForHandoff);

  const cc = civContext();
  loadWithCapture(cc, 'assets/js/domain-brain-adapter.js', ['_buildPayload']);
  loadWithCapture(cc, 'assets/js/civilization/domain-packet-adapter.js', ['_buildPacket']);
  loadWithCapture(cc, 'assets/js/civilization/handoff-contract.js', ['_packetForLane']);
  vm.runInContext(A('assets/js/civilization/artifact-packet-builder.js'), cc, { filename: 'apb' });
  const cap = cc.window.__cap;
  const APB = cc.window.LIMENArtifactPacketBuilder;

  // HOP 0 — brain state → slot payload
  let payload = null;
  hop('HOP0 brain-adapter: state.energyModel → slot.brainEnergyModel', function () {
    payload = cap._buildPayload(realState);
    var ok = payload && payload.brainEnergyModel && payload.brainEnergyModel.cycle === EM.cycle;
    return { ok: ok, detail: ok ? 'slot.brainEnergyModel.cycle=' + payload.brainEnergyModel.cycle : 'brainEnergyModel missing/mismatch' };
  });

  // HOP 1 — slot → Civilization packet.deepBrain
  let packet = null;
  hop('HOP1 packet-adapter: slot.brainEnergyModel → packet.deepBrain', function () {
    cc.window.LIMENDomains = { energy: payload };
    packet = cap._buildPacket('energy');
    var db = packet && packet.deepBrain;
    var ok = !!db && db.cycle === EM.cycle && db.regulationState != null;
    return { ok: ok, detail: ok ? 'packet.deepBrain {cycle:' + db.cycle + ', regulationState:' + db.regulationState + ', readyForHandoff:' + db.readyForHandoff + '}' : 'packet.deepBrain missing' };
  });

  // HOP 2 — packet → HandoffPacket.deepBrain
  let handoff = null;
  hop('HOP2 handoff-contract: packet.deepBrain → HandoffPacket.deepBrain', function () {
    var packets = { energy: packet };
    var opp = { id: 'opp_energy_1', domains: ['energy'], confidence: 0.9, evidenceQuality: 0.9, urgency: 0.6, rationale: 'r', summary: 's', type: 'diagnosis', provenance: 'p' };
    handoff = cap._packetForLane('patents', opp, packets);
    var db = handoff && handoff.deepBrain;
    var ok = !!db && db.cycle === EM.cycle;
    return { ok: ok, detail: ok ? 'HandoffPacket.deepBrain.cycle=' + db.cycle + ' readyForGeneration=' + handoff.readyForGeneration : 'HandoffPacket null or deepBrain missing' };
  });

  // HOP 3 — HandoffPacket → ArtifactPacket.deepBrain (+ raw.handoffPacket.deepBrain)
  let artifact = null;
  hop('HOP3 artifact-packet-builder: HandoffPacket.deepBrain → ArtifactPacket.deepBrain', function () {
    artifact = APB.buildFromHandoffPacket(handoff, {});
    if (!artifact) return { ok: false, detail: 'buildFromHandoffPacket returned null' };
    var db = artifact.deepBrain;
    var rawdb = artifact.raw && artifact.raw.handoffPacket && artifact.raw.handoffPacket.deepBrain;
    var ok = !!db && db.cycle === EM.cycle && !!rawdb;
    return { ok: ok, detail: ok ? 'ArtifactPacket.deepBrain.cycle=' + db.cycle + ' (+ raw.handoffPacket.deepBrain present)' : 'deepBrain missing (db=' + !!db + ' raw=' + !!rawdb + ')' };
  });

  // HOP 4 — ArtifactPacket → finalizer safe-extract (the AI prompt input)
  hop('HOP4 finalizer (expand-artifact): ArtifactPacket.deepBrain → safeInput.deepBrain', function () {
    var finalizer = require('../../handlers/expand-artifact.js');
    var pkt = artifact || { deepBrain: { cycle: EM.cycle, predictionError: EM.predictionError, regulationState: EM.regulation && EM.regulation.state, readyForHandoff: EM.readyForHandoff, predictedStress: EM.predictedStress } };
    var safe = finalizer._extractSafeInput(pkt);
    var db = safe && safe.deepBrain;
    var ok = !!db && db.cycle === EM.cycle && db.regulationState != null && typeof db.predictionError === 'number';
    return { ok: ok, detail: ok ? 'finalizer sees deepBrain {cycle:' + db.cycle + ', predictionError:' + db.predictionError + ', regulationState:' + db.regulationState + ', readyForHandoff:' + db.readyForHandoff + '}' : 'safeInput.deepBrain missing/incomplete' };
  });

  console.log('\n--- HOP-BY-HOP SURVIVAL ---');
  var allOk = true;
  for (const r of results) { allOk = allOk && r.ok; console.log('  [' + (r.ok ? 'SURVIVES ✓' : 'LOST ✗') + '] ' + r.name + '\n       ' + r.detail); }
  console.log('\nF0: ' + (allOk ? 'PASS ✓ — Energy recurrent state reaches the finalizer prompt' : 'FAIL ✗ — field lost at a hop above') + '\n');
  console.log('================ END F0 PROBE ================\n');
  process.exit(allOk ? 0 : 1);
})().catch(function (e) { console.error('PROBE ERROR:', e && e.stack || e); process.exit(1); });
