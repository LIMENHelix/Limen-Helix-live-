const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/finance-clarity-operator.js', 'utf8');
const start = source.indexOf('  function _handleLoadBranch(');
const end = source.indexOf('  function _handlePortalSource(', start);
const container = { style: { display: 'none' }, innerHTML: '' };
let mode = 'unavailable';
const calls = [];
const context = vm.createContext({ Error, encodeURIComponent,
  esc: s => String(s).replaceAll('<', '&lt;'),
  document: { getElementById: () => container },
  fetch: async path => {
    calls.push(path);
    if (mode === 'network') throw new Error('<network>');
    if (mode === 'success') return { ok: true, json: async () => ({ activations: [{ treatments: [{ label: 'Recovered', monitoring: 'Fixture monitoring' }] }] }) };
    return { ok: false, status: path.startsWith('/assets/') ? 404 : 500 };
  }
});
vm.runInContext(source.slice(start, end), context);
const open = async () => { context._handleLoadBranch('fixture'); await new Promise(resolve => setImmediate(resolve)); };
(async () => {
  await open();
  assert.deepEqual(calls, ['/assets/data/domains/fixture.json', '/api/fetch-portal?domainId=fixture']);
  assert.match(container.innerHTML, /\/assets\/data\/domains\/fixture\.json/);
  assert.match(container.innerHTML, /HTTP 404/);
  assert.match(container.innerHTML, /\/api\/fetch-portal\?domainId=fixture/);
  assert.match(container.innerHTML, /HTTP 500/);
  assert.doesNotMatch(container.innerHTML, /No deep content/);
  mode = 'success'; await open(); await open();
  assert.match(container.innerHTML, /Recovered/);
  assert.match(container.innerHTML, /Fixture monitoring/);
  assert.equal(calls.length, 3, 'Reopen retries and successful static read avoids fallback');
  mode = 'network'; await open(); await open();
  assert.match(container.innerHTML, /&lt;network>/); assert.doesNotMatch(container.innerHTML, /<network>/);
  console.log('PASS Finance branch content: exact static/fallback path and statuses, close/reopen recovery, static success, escaped network failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
