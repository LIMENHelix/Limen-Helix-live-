'use strict';

// Actual complete shared renderer; injected display state only, no native brain/motor.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = process.env.CONTINUITY_RENDERER_BASELINE === '1'
  ? require('node:child_process').execFileSync('git', ['show', 'c0da0431:assets/js/domain-brains/domain-console-brain.js'], { encoding: 'utf8' })
  : fs.readFileSync('assets/js/domain-brains/domain-console-brain.js', 'utf8');
const domains = ['energy','infrastructure','culture','finance','economy','technology','defense','intelligence','trade','industry',
  'environment','governance','agriculture','communication','medicine','education','population','science','law','religion'];
const aliases = { medicine: 'health', science: 'research', trade: 'supplyChain' };
const flush = () => new Promise(resolve => setImmediate(resolve));

async function check(domain) {
  const dom = new JSDOM('<div class="console-grid"><div id="clarity-view"></div></div>', { runScripts: 'outside-only', url: 'http://localhost/domain-console.html?domain=' + domain });
  const w = dom.window;
  const owner = aliases[domain] || domain;
  let boot;
  w.requestAnimationFrame = cb => { boot = cb; return 1; };
  w.setInterval = () => 1;
  w.console = { log() {}, warn() {}, error() {} };
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  const reads = [];
  w.fetch = async path => { reads.push(path); return { ok: false, status: 404 }; };
  w.LIMENDomainIsolator = { isDomainScoped: () => true, getActiveDomain: () => domain,
    getResolvedKey: () => owner, getDomainLabel: () => domain[0].toUpperCase() + domain.slice(1) };
  const state = { status: 'RUNNING', updated: Date.now(), stress: 0, confidence: 0, maturity: 'EARLY', phase: 'p0',
    feeds: [{ id: 'local-display-fixture', live: false }], diagnoses: [], treatments: [], signals: [], opportunities: [],
    memory: { stressHistory: [0, 0] } };
  const brain = { state, cycleInterval: 30000, getState: () => state };
  w.LIMENDomainBrains = { get: key => key === owner ? brain : null, getAllStates: () => ({}) };
  w.eval(source); boot(); await flush(); await flush();
  const header = () => w.document.querySelector('#dcb-exec').textContent;
  const text = () => w.document.querySelector('#clarity-view').textContent;
  const render = () => {
    const before = JSON.stringify(state);
    w.dispatchEvent(new w.CustomEvent('limen:domain-brain-update', { detail: { domainId: owner, state } }));
    assert.equal(JSON.stringify(state), before, 'display must preserve input state');
  };
  const dark = () => {
    assert.match(header(), /CURRENT STATE UNVERIFIED/);
    assert.match(header(), /TRAJECTORY UNVERIFIED/);
    assert.doesNotMatch(header(), /STABLE|CONTAINED|CLEAR|FIRING/);
    assert.doesNotMatch(text(), /operating within nominal parameters|expect downstream impact|decompression underway/);
    assert.match(text(), /no feeds are live/);
  };
  dark(); assert.match(text(), /ALL FEEDS DARK/);
  state.feeds = []; render(); dark(); assert.match(text(), /NO FEED OBSERVATIONS/);
  state.feeds = [{ id: 'local-display-fixture', live: false }];
  state.stress = 0.9; state.confidence = 0.9; state.maturity = 'STRUCTURAL';
  state.memory.stressHistory = [0.2, 0.3, 0.9];
  state.diagnoses = [{ id: 'fixture-dx', label: 'Retained display diagnosis', active: true, triggers: [], matchedTriggers: [] }];
  state.treatments = [{ id: 'fixture-tx', label: 'Retained display treatment', diagnosisId: 'fixture-dx' }];
  render(); dark(); assert.match(header(), /90%.*1 dx RETAINED ACTIVE/);
  assert.match(text(), /90% stress \(CRITICAL\), 1 active diagnosis pathway/);
  assert.match(text(), /Retained display diagnosis/);
  assert.match(text(), /RETAINED STRESS HISTORY/);
  assert.match(text(), /Retained maturity classification: STRUCTURAL/);
  state.feeds[0].live = true; render();
  assert.match(header(), /CRITICAL.*RISING.*FIRING/);
  assert.doesNotMatch(header(), /UNVERIFIED/);
  state.stress = 0; state.confidence = 0.8; state.memory.stressHistory = [0, 0];
  state.diagnoses = []; state.treatments = []; state.maturity = 'EARLY'; render();
  assert.match(header(), /CONTAINED.*STABLE.*CLEAR/);
  assert.match(text(), /operating within nominal parameters/);
  state.feeds[0].live = false; render(); dark();
  state.feeds[0].live = true; render(); assert.match(header(), /CONTAINED.*STABLE.*CLEAR/);
  assert.equal(reads.length, 3, 'renderer keeps only its existing supplementary reads');
  dom.window.close();
}

(async () => { for (const domain of domains) await check(domain);
  console.log('PASS 20 domain renderers: all-dark, absent feeds, retained critical diagnoses, live recovery and loss; source state unchanged');
})().catch(error => { console.error(error); process.exitCode = 1; });
