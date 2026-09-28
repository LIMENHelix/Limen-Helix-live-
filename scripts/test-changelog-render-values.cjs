'use strict';
// Exercise the existing renderer block, with JSON values the POST handler accepts.
// No browser, network, storage writes or production handler invocation.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/domain-brains/domain-console-brain.js'), 'utf8');
const start = source.indexOf('    // Change Log');
const end = source.indexOf("    h += '</div>'; // end left col", start);
assert.ok(start >= 0 && end > start, 'real changelog renderer block');
const block = source.slice(start, end);
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function render(log) {
  const ctx = { _changelog: log === null ? [] : [JSON.parse(JSON.stringify(log))], h: '', esc };
  vm.runInNewContext(block, ctx);
  return ctx.h;
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
for (const value of [42, true, { event: 'updated' }, ['one', 'two'], { toString: 7, valueOf: null }]) {
  test('accepted JSON title renders: ' + JSON.stringify(value), () => {
    const html = render({ type: 'PORTAL_UPDATED', title: value, description: 'older fallback' });
    assert.ok(html.includes(esc(JSON.stringify(value))), html);
    assert.ok(html.includes('PORTAL UPDATED'));
    assert.ok(!html.includes('older fallback'));
  });
}
test('fallback priority and 100-character truncation remain unchanged', () => {
  for (const key of ['message', 'title', 'description', 'summary']) {
    const log = { type: 'EVENT' };
    log[key] = 'x'.repeat(101);
    const html = render(log);
    assert.ok(html.includes('x'.repeat(100))); assert.ok(!html.includes('x'.repeat(101)));
  }
  assert.ok(render({ message: 'MESSAGE', title: 'TITLE', description: 'DESC', summary: 'SUMMARY' }).includes('MESSAGE'));
});
test('JSON values remain HTML-escaped and are never markup', () => {
  const value = ['<img src=x onerror=alert(1)>'];
  const html = render({ title: value });
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img'));
});
test('missing, empty and false-valued titles keep fallback behavior', () => {
  for (const title of [null, '', false, 0]) assert.ok(render({ title, description: 'FALLBACK' }).includes('FALLBACK'));
  assert.ok(render({}).includes('EVENT'));
  assert.ok(render(null).includes('No recent changes recorded'));
});
console.log(passed + '/' + (passed + failed) + ' changelog render checks passed');
process.exitCode = failed ? 1 : 0;
