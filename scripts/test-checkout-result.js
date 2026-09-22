/**
 * test-checkout-result.js — the post-checkout banner renders on both return paths.
 *
 * WHY. Stripe sends a buyer back to /<domain>?bought=<rung> and a leaver back to
 * /<domain>?checkout=cancelled. Before this script existed, sixteen of the twenty fronts
 * answered both with a page that looked like nothing had happened. The banner is the whole
 * post-purchase surface, so both states are exercised here against the real script in a
 * real DOM (jsdom), including the two host strategies: a page-owned #deskBanner (the
 * civic/soft desks) and a created host (the generated shells).
 *
 * RUN: node scripts/test-checkout-result.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var { JSDOM } = require('jsdom');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'checkout-result.js'), 'utf8');

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

function dom(search, bodyHtml) {
  var d = new JSDOM(
    '<!DOCTYPE html><html><head></head><body>' + (bodyHtml || '<div class="wrap"><h1>x</h1></div>') + '</body></html>',
    { url: 'https://limenhelix.com/finance' + (search || ''), runScripts: 'outside-only' }
  );
  d.window.eval(SRC);   // jsdom is still 'loading' here, so the script waits for DOMContentLoaded
  return new Promise(function (resolve) {
    if (d.window.document.readyState !== 'loading') return resolve(d);
    d.window.document.addEventListener('DOMContentLoaded', function () { resolve(d); });
  });
}

async function main() {
console.log('checkout result banner');

await check('?bought= renders a success banner with what-happens-next and the receipt expectation', async function () {
  var d = await dom('?bought=p2');
  var el = d.window.document.querySelector('.checkout-result');
  assert.ok(el, 'banner element exists');
  assert.ok(/checkout-result ok/.test(el.className) || el.className === 'checkout-result ok', 'success styling');
  assert.ok(/What happens next/.test(el.textContent), 'says what happens next');
  assert.ok(/receipt/i.test(el.textContent), 'sets the receipt expectation');
  assert.ok(el.querySelector('a[href="/cancel"]'), 'points at the self-serve cancel page');
  assert.equal(el.hidden, false);
});

await check('?bought= on a page WITHOUT a .wrap still lands inside <body>', async function () {
  var d = await dom('?bought=p1', '<p>bare page</p>');
  var el = d.window.document.querySelector('.checkout-result');
  assert.ok(el && el.parentElement === d.window.document.body);
});

await check('?checkout=cancelled renders a neutral state, not an error, and nothing was charged', async function () {
  var d = await dom('?checkout=cancelled');
  var el = d.window.document.querySelector('.checkout-result');
  assert.ok(el, 'banner element exists');
  assert.equal(el.className, 'checkout-result', 'neutral styling, not the success class');
  assert.ok(/nothing was charged/i.test(el.textContent));
});

await check('no checkout params → no banner at all', async function () {
  var d = await dom('');
  assert.ok(!d.window.document.querySelector('.checkout-result'), 'no host is created');
  d = await dom('?utm=x');
  assert.ok(!d.window.document.querySelector('.checkout-result'), 'unrelated params do not trigger it');
});

await check('a page-owned #deskBanner host is REUSED with its own classes (civic/soft desks unchanged)', async function () {
  var d = await dom('?bought=p2', '<div class="wrap"><div class="desk-banner" id="deskBanner" hidden></div></div>');
  var el = d.window.document.getElementById('deskBanner');
  assert.ok(el, 'host exists');
  assert.equal(el.className, 'desk-banner ok', 'page-owned classes, not the injected ones');
  assert.equal(el.hidden, false);
  assert.ok(/What happens next/.test(el.textContent));
  assert.ok(!d.window.document.querySelector('.checkout-result'), 'no second banner created');
});

await check('the rung in the banner is sanitized', async function () {
  var d = await dom('?bought=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
  var el = d.window.document.querySelector('.checkout-result');
  assert.ok(!el.querySelector('img'), 'markup in the param cannot inject elements');
});

await check('desk scripts delegate to this one implementation when it is loaded', function () {
  ['assets/js/civic-desk.js', 'assets/js/soft-desk.js'].forEach(function (rel) {
    var src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(/LIMEN_CHECKOUT_RESULT/.test(src), rel + ' delegates to LIMEN_CHECKOUT_RESULT');
  });
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('checkout result banner: all checks passed');
}

main().catch(function (e) { console.error(e); process.exit(1); });
