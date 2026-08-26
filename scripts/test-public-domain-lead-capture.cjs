'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var root = path.resolve(__dirname, '..');
var generated = ['economy','environment','medicine','technology','science','trade','governance','infrastructure','agriculture','industry','education','communication','defense','religion','population','law','finance','intelligence'];

var app = fs.readFileSync(path.join(root, 'assets/js/domain-front-app.js'), 'utf8');
assert.match(app, /name:\s*payload\.name/);
assert.match(app, /domain:\s*DID/);
assert.match(app, /tier:\s*payload\.tier/);
generated.forEach(function (domain) {
  var html = fs.readFileSync(path.join(root, domain + '.html'), 'utf8');
  assert.match(html, /id="capName"/, domain + ' public watch needs a name field');
  assert.match(html, /id="capEmail"/, domain + ' public watch needs an email field');
  assert.match(html, /assets\/js\/domain-front-app\.js/, domain + ' must use the shared durable capture path');
});

var culture = fs.readFileSync(path.join(root, 'culture.html'), 'utf8');
assert.match(culture, /id="cap-name"/); assert.match(culture, /domain:'culture'/); assert.match(culture, /tier:'watchlist'/);
var energy = fs.readFileSync(path.join(root, 'energy.html'), 'utf8');
assert.match(energy, /id="energyLeadName"/); assert.match(energy, /id="energyLeadEmail"/); assert.match(energy, /domain:\s*'energy'/); assert.match(energy, /tier:\s*'watchlist'/);

var handler = fs.readFileSync(path.join(root, 'handlers/lead.js'), 'utf8');
assert.match(handler, /leadPipeline\.capture/);
assert.match(handler, /name:\s*lead\.name/);
console.log('public domain capture: all 20 fronts carry name/email into the canonical Leads + CRM bridge');
