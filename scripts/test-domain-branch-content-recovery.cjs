const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const walk = require('acorn-walk');
const domains = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','technology','trade'];
const direct = new Set(['agriculture','infrastructure','trade']);
const flush = () => new Promise(resolve => setImmediate(resolve));
async function check(domain) {
  const source = fs.readFileSync(`assets/js/${domain}-clarity-operator.js`, 'utf8');
  let loader;
  walk.simple(acorn.parse(source, { ecmaVersion: 'latest' }), { FunctionDeclaration(node) { if (node.id.name === '_handleLoadBranch') loader = node; } });
  assert.ok(loader, 'Actual branch consumer must exist');
  const container = { style: { display: 'none' }, innerHTML: '' };
  const calls = [];
  let mode = 'unavailable';
  const context = vm.createContext({ Error, Array, encodeURIComponent,
    esc: s => String(s).replaceAll('<', '&lt;'),
    document: { getElementById: () => container },
    fetch: async path => {
      calls.push(path);
      if (mode === 'network') throw new Error('<network>');
      if (mode === 'unavailable') return { ok: false, status: path.startsWith('/assets/') ? 404 : 500 };
      return { ok: true, json: async () => mode === 'malformed' ? { activations: {} } : mode === 'empty' ? { activations: [] } : { activations: [{ treatments: [{ label: 'Recovered', monitoring: 'Fixture monitoring' }] }] } };
    }
  });
  vm.runInContext(source.slice(loader.start, loader.end), context);
  const open = async () => { context._handleLoadBranch('fixture'); await flush(); };
  const reopen = async () => { await open(); assert.equal(container.style.display, 'none'); await open(); };
  const api = '/api/fetch-portal?domainId=fixture';
  const asset = '/assets/data/domains/fixture.json';
  await open(); assert.deepEqual(calls, direct.has(domain) ? [api] : [asset, api]);
  assert.ok(container.innerHTML.includes(api), 'Failure must identify API location');
  assert.match(container.innerHTML, /HTTP 500/);
  if (!direct.has(domain)) { assert.ok(container.innerHTML.includes(asset)); assert.match(container.innerHTML, /HTTP 404/); }
  assert.doesNotMatch(container.innerHTML, /No deep content/);
  mode = 'success'; await reopen(); assert.match(container.innerHTML, /Recovered/); assert.match(container.innerHTML, /Fixture monitoring/);
  assert.equal(calls.length, direct.has(domain) ? 2 : 3, 'Recovery preserves direct or static-first path');
  mode = 'malformed'; await reopen(); assert.match(container.innerHTML, /invalid branch content/); assert.doesNotMatch(container.innerHTML, /No deep content/);
  mode = 'network'; await reopen(); assert.match(container.innerHTML, /&lt;network>/); assert.doesNotMatch(container.innerHTML, /<network>/);
  mode = 'empty'; await reopen(); assert.match(container.innerHTML, /No deep content/);
  console.log(`PASS ${domain}: request ownership, HTTP evidence, recovery, malformed data, escaped network error, valid empty content`);
}
(async () => {
  let failures = 0;
  for (const domain of domains) { try { await check(domain); } catch (error) { failures++; console.error(`FAIL ${domain}: ${error.message}`); } }
  assert.equal(failures, 0, 'All twenty branch consumers must report availability honestly');
})().catch(error => { console.error(error); process.exitCode = 1; });
