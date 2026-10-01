const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const walk = require('acorn-walk');
const domains = ['culture','education','environment','industry','law','population','religion','science'];
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const { JSDOM } = await import('jsdom');
  let failures = 0;
  for (const domain of domains) {
    try {
      const source = fs.readFileSync(`assets/js/${domain}-clarity-operator.js`, 'utf8');
      const functions = {}; let delegated;
      walk.simple(acorn.parse(source, { ecmaVersion: 'latest' }), {
        FunctionDeclaration(n) { functions[n.id.name] = source.slice(n.start, n.end); },
        CallExpression(n) { if (n.callee.type === 'MemberExpression' && n.callee.object.name === '_operatorView' && n.callee.property.name === 'addEventListener' && n.arguments[0].value === 'click') delegated = source.slice(n.arguments[1].start, n.arguments[1].end); }
      });
      assert.ok(delegated, 'Actual delegated click handler must exist');
      const dom = new JSDOM('<div id="view"><div id="anchor"></div><div id="proof"></div></div>');
      const document = dom.window.document; const calls = [];
      const context = vm.createContext({ document, Array, Error, Promise, encodeURIComponent,
        esc: s => String(s).replaceAll('"', '&quot;'),
        _loadBranchIndex: async () => ({ branches: [{ nodeId: 'node', portalDomainId: 'fixture', treatmentLabel: 'Fixture', depth: 2 }] }),
        fetch: async path => { calls.push(path); return { ok: true, json: async () => ({ activations: [{ treatments: [{ label: 'Result ' + calls.length, monitoring: 'Fixture result' }] }] }) }; }
      });
      vm.runInContext(functions._handleDrillClick + '\n' + functions._handleLoadBranch + `\ndocument.getElementById('view').addEventListener('click', ${delegated});`, context);
      context._handleDrillClick('anchor', 'node', ''); await flush();
      context._handleDrillClick('proof', 'node', ''); await flush();
      const anchor = document.querySelector('#anchor [data-load-branch]');
      const proof = document.querySelector('#proof [data-load-branch]');
      const anchorResult = document.querySelector('#anchor [id^="branch-content-"]');
      const proofResult = document.querySelector('#proof [id^="branch-content-"]');
      assert.notEqual(anchorResult.id, proofResult.id, 'Simultaneous drills need distinct result IDs');
      anchor.click(); await flush(); assert.match(anchorResult.textContent, /Result 1/);
      proof.click(); await flush(); assert.match(proofResult.textContent, /Result 2/);
      assert.equal(anchorResult.style.display, 'block', 'Second load must not close first result');
      assert.match(anchorResult.textContent, /Result 1/);
      proof.click(); await flush(); assert.equal(proofResult.style.display, 'none');
      assert.equal(anchorResult.style.display, 'block');
      proof.click(); await flush(); assert.match(proofResult.textContent, /Result 3/);
      assert.ok(calls.every(path => path === '/assets/data/domains/fixture.json'));
      dom.window.close(); console.log(`PASS ${domain}: actual delegated clicks isolate concurrent branch results and retries`);
    } catch (error) { failures++; console.error(`FAIL ${domain}: ${error.message}`); }
  }
  assert.equal(failures, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
