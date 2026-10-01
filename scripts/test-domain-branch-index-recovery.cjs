const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const domains = ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence', 'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'];
const flush = () => new Promise(resolve => setImmediate(resolve));
async function check(domain) {
  const source = fs.readFileSync(`assets/js/${domain}-clarity-operator.js`, 'utf8');
  const start = source.indexOf('var _branchIndex = null');
  const end = source.indexOf('function _handleLoadBranch(', start);
  assert.ok(start >= 0 && end > start, `${domain}: actual drill consumer must be found`);
  const container = { innerHTML: '', classList: {
    open: false, contains() { return this.open; }, add() { this.open = true; }, remove() { this.open = false; }
  } };
  const calls = [];
  let response = () => ({ ok: false, status: 404 });
  const context = vm.createContext({ Promise, Array, Error,
    fetch: async path => { calls.push(path); return response(); },
    document: { getElementById: () => container },
    esc: s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  });
  vm.runInContext(source.slice(start, end), context);
  const open = async () => { context._handleDrillClick('drill', 'node', ''); await flush(); };
  const reopen = async () => { await open(); assert.equal(container.classList.open, false); await open(); };
  const path = `/assets/data/deep/${domain === 'agriculture' ? 'p2_agri' : domain}-branch-index.json`;
  await open();
  assert.equal(calls[0], path, 'Preserve the owning domain asset');
  assert.ok(container.innerHTML.includes(path), 'Unavailable display must identify the asset');
  assert.match(container.innerHTML, /HTTP 404/);
  assert.doesNotMatch(container.innerHTML, /No (closely )?related branches/);
  response = () => ({ ok: true, json: async () => ({ branches: [{ nodeId: 'node', portalDomainId: 'fixture', treatmentLabel: 'Recovered branch', depth: 2 }] }) });
  await reopen();
  assert.equal(calls.length, 2, 'Close/reopen retries a failure');
  assert.match(container.innerHTML, /Recovered branch/);
  assert.match(container.innerHTML, /LOAD BRANCH/);
  await reopen(); assert.equal(calls.length, 2, 'Successful index is cached');
  vm.runInContext('_branchIndex = null', context);
  response = () => ({ ok: true, json: async () => ({ branches: {} }) });
  await reopen(); assert.match(container.innerHTML, /invalid branch index/);
  assert.doesNotMatch(container.innerHTML, /No (closely )?related branches/);
  response = () => { throw new Error('<unsafe>'); };
  await reopen(); assert.match(container.innerHTML, /&lt;unsafe>/); assert.doesNotMatch(container.innerHTML, /<unsafe>/);
  response = () => ({ ok: true, json: async () => ({ branches: [] }) });
  await reopen(); assert.match(container.innerHTML, /No (closely )?related branches/);
  console.log(`PASS ${domain}: owning path, 404, close/reopen recovery, populated success/cache, malformed data, escaped failure, valid empty result`);
}
(async () => {
  let failures = 0;
  for (const domain of domains) {
    try { await check(domain); } catch (error) { failures++; console.error(`FAIL ${domain}: ${error.message}`); }
  }
  assert.equal(failures, 0, 'All twenty owning drill consumers must recover honestly');
})().catch(error => { console.error(error); process.exitCode = 1; });
