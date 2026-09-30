'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const document = { createElement() { return { style: {}, appendChild() {}, addEventListener() {} }; }, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, head: { appendChild() {} }, body: {} };
const window = { document, location: { pathname: '/', search: '', href: '/' }, fetch() { return Promise.resolve({ ok: false, status: 404, json: async () => null, text: async () => '' }); }, addEventListener() {}, setTimeout() { return 0; }, setInterval() { return 0; }, clearInterval() {}, console };
const context = { window, document, location: window.location, navigator: { userAgent: 'test' }, console, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, URLSearchParams, Map, Set, fetch: window.fetch, setTimeout: window.setTimeout, setInterval: window.setInterval, clearInterval: window.clearInterval };
context.globalThis = context;
context.self = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/domain-brains/domain-brain-base.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/domain-brains/energy-brain.js'), 'utf8'), context);

const EnergyBrain = window.LIMENEnergyBrain;
assert(EnergyBrain, 'Energy brain loaded');
const brain = EnergyBrain;
brain.state = { energyModel: { regulation: {} }, energyImmune: { immuneMemory: 0 }, _l1DepthCache: null };
brain._energyBundleStates = () => [];
const immune = brain._computeEnergyImmune();

assert.equal(immune.immuneState, 'clear');
assert.equal(immune.severity, 'none');
assert.deepEqual(Array.from(immune.antigens), []);
assert.deepEqual(Array.from(immune.quarantines), ['L2-synthetic-portal-content', 'L1-portal-treatments-madlib', 'L1-L2-mad-lib-treatments']);
assert.deepEqual(Array.from(immune.blockedFromTraversal), ['L2']);
console.log('energy immune parity: no permanent antigen; content quarantine remains preserved');
