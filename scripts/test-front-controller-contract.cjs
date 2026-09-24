'use strict';

/**
 * front controller DOM contract — the #368 regression pin.
 *
 * The shared controller (assets/js/domain-front-app.js) dereferences section ids with
 * EL('...') unconditionally on the generic-live and environment paths. #368's splice
 * removed liveSection/phaseSection from the template while the controller kept
 * dereferencing them — every fixture check passed because none of them load the page.
 * This test pins the contract: every id the controller dereferences on those paths
 * exists in every generated front, and the dead population telescope stays gone.
 */
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var GEN = ['agriculture', 'communication', 'defense', 'economy', 'energy', 'environment',
  'finance', 'industry', 'infrastructure', 'medicine', 'science', 'technology', 'trade'];

// energy.html is hand-owned (Bill X-Ray) but must still satisfy the parts it renders.
var app = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'domain-front-app.js'), 'utf8');
var template = fs.readFileSync(path.join(ROOT, 'domain-front.html'), 'utf8');

// ids dereferenced on the generic-live branch (loadGeneric) and environment branch
var GENERIC_IDS = ['liveSection', 'liveHeadline', 'liveSub', 'liveSections', 'liveUpdated'];
var ENV_IDS = ['phaseSection', 'govSection', 'newsSection', 'heroBg', 'hero', 'photocred'];
var ALL_IDS = GENERIC_IDS.concat(ENV_IDS);

(function () {
  // 1. the controller actually dereferences these (guard against the test going stale)
  ALL_IDS.forEach(function (id) {
    assert.ok(app.indexOf("'" + id + "'") !== -1, 'controller no longer references #' + id + ' — update the contract test');
  });

  // 2. the template carries the containers
  ['liveSection', 'phaseSection', 'govSection', 'pulseSection', 'newsSection', 'heroBg', 'hero'].forEach(function (id) {
    assert.ok(template.indexOf('id="' + id + '"') !== -1, 'template missing #' + id);
  });

  // 3. every generated front carries them, and none carries the dead telescope
  GEN.forEach(function (route) {
    var html = fs.readFileSync(path.join(ROOT, route + '.html'), 'utf8');
    if (route === 'energy') return;   // hand-owned front; covered by its own tests
    ['liveSection', 'phaseSection', 'govSection', 'heroBg'].forEach(function (id) {
      assert.ok(html.indexOf('id="' + id + '"') !== -1, route + '.html missing #' + id);
    });
    assert.ok(html.indexOf('popSection') === -1, route + '.html still carries the dead population telescope');
    assert.ok(html.indexOf('checkout-result.js') !== -1, route + '.html missing checkout-result.js');
    assert.ok(html.indexOf('/privacy') !== -1, route + '.html missing legal footer');
    assert.ok(html.indexOf('domain=' + route) !== -1, route + '.html checkout href missing its domain');
  });

  // 4. no dangling controller reference to the removed section
  assert.ok(app.indexOf('popSection') === -1, 'controller still reveals the removed popSection');

  console.log('front controller DOM contract: ' + GEN.length + ' fronts, ' + ALL_IDS.length + ' ids pinned, telescope gone: PASS');
})();
