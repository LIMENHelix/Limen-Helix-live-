#!/usr/bin/env node
/**
 * Headless test for the four new human-interoception modules.
 *
 * Sets up a minimal browser-shaped global (window/document/CustomEvent/
 * setInterval) so the IIFE files can self-register. Then runs the same
 * 7 checks the DevTools block was going to run.
 *
 * Stays self-contained — no jsdom, no deps. Stubs adapter/master-brain
 * exactly enough for the gate logic to be exercised end-to-end.
 *
 * Pass/fail per check + final summary. Exits 0 if all pass, 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const FILES = [
  'assets/js/limen/operator-canonical-identity.js',
  'assets/js/limen/human-state-packet.js',
  'assets/js/limen/human-context-gate.js',
  'assets/js/limen/operator-state-ui.js'
];

// ── Minimal DOM-ish shim ──
function makeShim() {
  const listeners = {};
  const elementsById = {};

  function makeElement(tag) {
    const el = {
      tagName: (tag || 'DIV').toUpperCase(),
      _id: '',
      get id() { return this._id; },
      set id(v) {
        this._id = String(v);
        if (this._id) elementsById[this._id] = this;
      },
      style: {},
      _children: [],
      _innerHTML: '',
      _textContent: '',
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) {
        this._innerHTML = v;
        const idMatches = String(v).matchAll(/id="([^"]+)"/g);
        for (const m of idMatches) {
          if (!elementsById[m[1]]) {
            const child = makeElement('div');
            child.id = m[1];
          }
        }
      },
      get textContent() { return this._textContent; },
      set textContent(v) { this._textContent = String(v); },
      dataset: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild(c) { this._children.push(c); return c; },
      removeChild(c) {
        const i = this._children.indexOf(c);
        if (i !== -1) this._children.splice(i, 1);
        return c;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      setAttribute: () => {},
      removeAttribute: () => {},
      title: '',
      parentNode: null
    };
    return el;
  }

  const document = {
    readyState: 'complete',
    hidden: false,
    body: makeElement('body'),
    createElement: makeElement,
    getElementById: (id) => elementsById[id] || null,
    addEventListener: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
    removeEventListener: () => {},
    dispatchEvent: (e) => {
      const fns = listeners[e.type] || [];
      for (const f of fns) try { f(e); } catch (_) {}
    }
  };

  const win = {
    document,
    addEventListener: document.addEventListener,
    removeEventListener: document.removeEventListener,
    dispatchEvent: document.dispatchEvent,
    CustomEvent: function (type, init) {
      return { type, detail: init && init.detail };
    },
    setInterval, clearInterval, setTimeout, clearTimeout,
    structuredClone: (typeof structuredClone === 'function') ? structuredClone : null,
    location: { pathname: '/civilization.html' },
    Map, Set,
    console
  };
  win.window = win;
  return { window: win, document };
}

// ── Stub the existing biosensor + master-brain layer the new modules CONSUME ──
function attachStubs(win, opts = {}) {
  // Domain biosensor adapter — returns either a realistic state or null
  win.LIMENDomainBiosensorAdapter = {
    getRawState: () => opts.adapterState || null
  };
  win.LIMENBiosensor = {
    get active() { return !!opts.adapterState; },
    get arousal() { return opts.adapterState ? opts.adapterState.arousal : 0; },
    get coherence() { return opts.adapterState ? opts.adapterState.coherence : 0; },
    get cognitiveLoad() { return opts.adapterState ? opts.adapterState.cognitiveLoad : 0; },
    get heartRate() { return opts.adapterState ? opts.adapterState.heartRate : 0; },
    get hrv() { return opts.adapterState ? opts.adapterState.hrv : 0; }
  };
  // Engine getState — used by packet builder for behavior channels
  win._limenBiosensor = {
    getState: () => opts.engineState || null,
    subscribe: () => {}
  };
  // Master brain review queue stub — captures enqueue calls
  win.LIMENMasterBrain = win.LIMENMasterBrain || {};
  win.LIMENMasterBrain.review = win.LIMENMasterBrain.review || {
    _enqueued: [],
    enqueue(decision, opts) {
      this._enqueued.push({ decision, opts });
      return decision;
    },
    isReviewEligible: () => true
  };
}

// ── Run a single module file inside the shim's context ──
function loadModule(ctx, filePath) {
  const src = fs.readFileSync(path.resolve(filePath), 'utf8');
  const script = new vm.Script(src, { filename: filePath });
  script.runInContext(ctx);
}

// ── Run all checks against a given shim state ──
function runChecks(win, label) {
  const results = [];
  const pass = (name, ok, extra) => {
    results.push({ name, ok, extra });
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${name}` + (extra !== undefined ? ` — ${typeof extra === 'object' ? JSON.stringify(extra) : extra}` : ''));
  };

  console.log(`\n── ${label} ──`);

  // 1. Global presence
  const globals = {
    LIMENOperatorCanonicalIdentity: win.LIMENOperatorCanonicalIdentity,
    LIMENHumanStatePacket:          win.LIMENHumanStatePacket,
    LIMENHumanContextGate:          win.LIMENHumanContextGate,
    LIMENOperatorStateUI:           win.LIMENOperatorStateUI
  };
  for (const [k, v] of Object.entries(globals)) {
    pass(`global ${k} attached`, !!v);
  }
  if (Object.values(globals).some(v => !v)) {
    console.log('  ! one or more globals missing — stopping further checks');
    return results;
  }

  // 2. Identity version + lookups
  pass(`identity version === '1.0.0'`, win.LIMENOperatorCanonicalIdentity.getVersion() === '1.0.0');
  pass(`isInputAllowed('typing_cadence') true`, win.LIMENOperatorCanonicalIdentity.isInputAllowed('typing_cadence') === true);
  pass(`isInputAllowed('gps_location') false`, win.LIMENOperatorCanonicalIdentity.isInputAllowed('gps_location') === false);
  pass(`isActionDisallowed('medical_diagnosis') true`, win.LIMENOperatorCanonicalIdentity.isActionDisallowed('medical_diagnosis') === true);
  pass(`isActionDisallowed('normal_chat') false`, win.LIMENOperatorCanonicalIdentity.isActionDisallowed('normal_chat') === false);

  // 3. Packet builds
  const pkt = win.LIMENHumanStatePacket.getLatestHumanStatePacket();
  pass(`packet exists with .phase`, !!(pkt && pkt.phase), { phase: pkt && pkt.phase, available: pkt && pkt.available });
  pass(`packet.identityVersion === '1.0.0'`, pkt && pkt.identityVersion === '1.0.0');
  pass(`packet.recommendedSystemBehavior present`, !!(pkt && pkt.recommendedSystemBehavior && pkt.recommendedSystemBehavior.uiMode));

  // 4. Hard refusal on canonical-identity disallowed action
  const hard = win.LIMENHumanContextGate.evaluateHumanContextFit({
    humanStatePacket: pkt,
    proposedAction: { type: 'medical_diagnosis' }
  });
  pass(`hard refusal on medical_diagnosis`,
    hard.allowed === false &&
    hard.refusalClass === 'hard' &&
    hard.reason === 'ACTION_DISALLOWED_BY_CANONICAL_IDENTITY',
    { reason: hard.reason, alt: hard.recommendedAlternative });

  // 5. Allowed action
  const allow = win.LIMENHumanContextGate.evaluateHumanContextFit({
    humanStatePacket: pkt,
    proposedAction: { type: 'normal_chat' }
  });
  pass(`allowed on normal_chat`, allow.allowed === true, { reason: allow.reason });

  // 6. Invalid action
  const bad = win.LIMENHumanContextGate.evaluateHumanContextFit({
    humanStatePacket: pkt,
    proposedAction: { notAType: true }
  });
  pass(`invalid action refused with INVALID_ACTION`, bad.allowed === false && bad.reason === 'INVALID_ACTION');

  // 7. UI panel exists in DOM
  const panel = win.document.getElementById('limen-operator-state-panel');
  pass(`UI panel mounted in DOM`, !!panel);
  pass(`UI.isMounted() === true`, win.LIMENOperatorStateUI.isMounted() === true);

  // 8. Stats accessible
  const stats = win.LIMENHumanContextGate.getStats();
  pass(`gate stats accessible`, !!(stats && typeof stats.evaluated === 'number'),
    { evaluated: stats.evaluated, allowed: stats.allowed, refused: stats.refused, hard: stats.hardRefused });

  // 9. Phase policy returnable
  const policy = win.LIMENHumanContextGate.getPolicy();
  pass(`policy.HUMAN_P7_REDLINE blocks 'send'`, Array.isArray(policy.HUMAN_P7_REDLINE.block) && policy.HUMAN_P7_REDLINE.block.includes('send'));
  pass(`policy.HUMAN_P0_BASELINE blocks nothing`, policy.HUMAN_P0_BASELINE.block.length === 0);

  // 10. Review queue received the hard refusal (integration with existing master-brain)
  const reviewItems = win.LIMENMasterBrain.review._enqueued || [];
  const sawHard = reviewItems.some(e => e.decision && e.decision.subject && e.decision.subject.actionType === 'medical_diagnosis');
  pass(`hard refusal enqueued into existing review queue`, sawHard, `${reviewItems.length} item(s) enqueued total`);

  return results;
}

// ── Scenario A: biosensor OFFLINE (adapter returns null) ──
function scenarioOffline() {
  const { window } = makeShim();
  const ctx = vm.createContext(window);
  attachStubs(window, { adapterState: null });
  for (const f of FILES) loadModule(ctx, f);
  // Force UI to mount synchronously (it normally waits a setTimeout)
  window.LIMENOperatorStateUI.mount();
  return runChecks(window, 'SCENARIO A — biosensor OFFLINE');
}

// ── Scenario B: biosensor ONLINE, P2 FOCUSED_FLOW shape ──
function scenarioFocusedFlow() {
  const { window } = makeShim();
  const ctx = vm.createContext(window);
  attachStubs(window, {
    adapterState: {
      arousal: 0.50, coherence: 0.70, cognitiveLoad: 0.60,
      heartRate: 68, hrv: 45,
      regulation: 'focused', confidence: 0.85, weight: 0.25,
      timestamp: Date.now(), fresh: true
    },
    engineState: { channels: { behavior: { tapCadence: 3.2 } } }
  });
  for (const f of FILES) loadModule(ctx, f);
  window.LIMENOperatorStateUI.mount();
  // Force a packet emit so derived state computes
  window.LIMENHumanStatePacket.forceEmit();
  const results = runChecks(window, 'SCENARIO B — biosensor ONLINE / FOCUSED zone');
  const pkt = window.LIMENHumanStatePacket.getLatestHumanStatePacket();
  console.log('  ↳ derived state:', JSON.stringify(pkt.derivedState));
  console.log('  ↳ classified phase:', pkt.phase, '(confidence', pkt.confidence + ')');
  return results;
}

// ── Scenario C: biosensor ONLINE, OVERLOAD shape ──
function scenarioOverload() {
  const { window } = makeShim();
  const ctx = vm.createContext(window);
  attachStubs(window, {
    adapterState: {
      arousal: 0.85, coherence: 0.25, cognitiveLoad: 0.80,
      heartRate: 105, hrv: 18,
      regulation: 'overloaded', confidence: 0.78, weight: 0.25,
      timestamp: Date.now(), fresh: true
    },
    engineState: { channels: { behavior: { tapCadence: 1.8, backspaceRate: 0.55, errorCorrectionRate: 0.50 } } }
  });
  for (const f of FILES) loadModule(ctx, f);
  window.LIMENOperatorStateUI.mount();
  window.LIMENHumanStatePacket.forceEmit();
  const results = runChecks(window, 'SCENARIO C — biosensor ONLINE / OVERLOAD zone');
  const pkt = window.LIMENHumanStatePacket.getLatestHumanStatePacket();
  console.log('  ↳ derived state:', JSON.stringify(pkt.derivedState));
  console.log('  ↳ classified phase:', pkt.phase, '(confidence', pkt.confidence + ')');

  // Extra check — soft refusal for autofire_high_salience under OVERLOAD
  const soft = window.LIMENHumanContextGate.evaluateHumanContextFit({
    humanStatePacket: pkt,
    proposedAction: { type: 'autofire_high_salience' }
  });
  console.log('  extra soft-refusal autofire under OVERLOAD:', soft.allowed === false && soft.refusalClass === 'soft' ? '✓' : '✗', soft.reason);
  return results;
}

// ── Main ──
console.log('═══ headless test for human-interoception gate modules ═══');
const all = [
  ...scenarioOffline(),
  ...scenarioFocusedFlow(),
  ...scenarioOverload()
];

const passCount = all.filter(r => r.ok).length;
const failCount = all.filter(r => !r.ok).length;
console.log('\n═══ SUMMARY ═══');
console.log(`  pass: ${passCount}`);
console.log(`  fail: ${failCount}`);
console.log(`  total: ${all.length}`);
if (failCount > 0) {
  console.log('\n  failed checks:');
  for (const r of all.filter(x => !x.ok)) console.log(`    ✗ ${r.name}`);
  process.exit(1);
}
process.exit(0);
