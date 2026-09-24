'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var config = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'calcstack-domain-tools.json'), 'utf8'));
var domains = config.domains;
var routes = Object.keys(domains);

assert.equal(routes.length, config._meta.expectedDomainCount, 'CalcStack map must cover the 20 public civilization fronts');
assert.equal(Object.prototype.hasOwnProperty.call(domains, 'intelligence'), false, 'intelligence intentionally stays standalone');

routes.forEach(function (route) {
  var tool = domains[route];
  var html = fs.readFileSync(path.join(ROOT, route + '.html'), 'utf8');
  assert.equal((html.match(/CALCSTACK:BEGIN/g) || []).length, 1, route + ' must have exactly one CalcStack block');
  assert.equal((html.match(/CALCSTACK:END/g) || []).length, 1, route + ' must close exactly one CalcStack block');
  assert.ok(html.indexOf('data-calcstack-domain="' + route + '"') !== -1, route + ' CalcStack block is not route-scoped');
  assert.ok(html.indexOf(config._meta.catalogUrl) !== -1, route + ' must link to the CalcStack catalog');

  if (tool.slug) {
    var expectedUrl = config._meta.embedBaseUrl + tool.slug;
    assert.ok(html.indexOf('src="' + expectedUrl + '"') !== -1, route + ' has the wrong CalcStack embed');
    assert.ok(html.indexOf('title="' + tool.title + ' - CalcStack"') !== -1, route + ' embed needs the mapped title');
    assert.ok(html.indexOf('loading="lazy"') !== -1, route + ' embed must lazy-load');
  } else {
    assert.ok(tool.gap, route + ' gap must say what CalcStack still needs to build');
    var block = html.slice(html.indexOf('<!-- CALCSTACK:BEGIN'), html.indexOf('<!-- CALCSTACK:END'));
    assert.equal(block.indexOf('<iframe'), -1, route + ' must not paper over a real mapping gap with an unrelated tool');
    assert.equal(block.indexOf('Run the numbers - free'), -1, route + ' must not promise a calculator that does not exist');
    assert.equal(block.indexOf('a free calculator that runs'), -1, route + ' must use honest gap-specific introductory copy');
    assert.ok(block.indexOf(tool.gap) !== -1, route + ' must render its recorded gap');
  }
});

var intelligence = fs.readFileSync(path.join(ROOT, 'intelligence.html'), 'utf8');
assert.equal(intelligence.indexOf('CALCSTACK:BEGIN'), -1, 'intelligence must remain standalone');

var template = fs.readFileSync(path.join(ROOT, 'domain-front.html'), 'utf8');
assert.equal((template.match(/CALCSTACK:DOMAIN-TOOL/g) || []).length, 1, 'front template must carry one generator marker');

console.log('CalcStack domain tools: ' + routes.length + ' fronts mapped, ' + routes.filter(function (r) { return domains[r].slug; }).length + ' live embeds, ' + routes.filter(function (r) { return !domains[r].slug; }).length + ' explicit gaps: PASS');
