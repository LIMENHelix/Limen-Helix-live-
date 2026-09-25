'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

var ROOT = path.join(__dirname, '..');
var DATA = path.join(ROOT, 'assets', 'data', 'domain-business-ladders.json');
var SCRIPT = path.join(ROOT, 'assets', 'js', 'domain-business-ladder.js');
var config = JSON.parse(fs.readFileSync(DATA, 'utf8'));
var domains = config.domains;
var domainIds = Object.keys(domains).sort();
var expectedDomains = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
  'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'
].sort();
var expectedBands = ['p0-p1', 'p2-p3', 'p4-p5', 'p6-p7', 'p8-p10'];
var expectedPhases = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
var statuses = new Set(config._meta.statusOrder);

assert.equal(config.schemaVersion, 'domain-business-capital-ladders/1.0');
assert.equal(config._meta.expectedDomainCount, 20);
assert.equal(config._meta.phaseNamespace, 'businessCapitalBand');
assert.equal(config._meta.domainStateNamespace, 'domainCyclePhase');
assert.deepEqual(domainIds, expectedDomains, 'business ladder must cover the twenty sovereign public domains');
assert.deepEqual(config._meta.bands.map(function (band) { return band.id; }), expectedBands);
assert.deepEqual(config._meta.bands.flatMap(function (band) { return band.phases; }), expectedPhases,
  'the capital bands must cover P0-P10 exactly once');

var ventureIds = new Set();
domainIds.forEach(function (domainId) {
  var domain = domains[domainId];
  assert.ok(domain.name, domainId + ' needs a display name');
  assert.deepEqual(Object.keys(domain.bands), expectedBands, domainId + ' must carry the five ordered bands');
  expectedBands.forEach(function (bandId) {
    var item = domain.bands[bandId];
    ['venture', 'mechanism', 'status', 'evidence', 'nextGate'].forEach(function (field) {
      assert.equal(typeof item[field], 'string', domainId + '/' + bandId + ' missing ' + field);
      assert.ok(item[field].trim(), domainId + '/' + bandId + ' has blank ' + field);
    });
    assert.ok(statuses.has(item.status), domainId + '/' + bandId + ' uses an unknown evidence status');
    var ventureId = domainId + ':' + bandId;
    assert.equal(ventureIds.has(ventureId), false, ventureId + ' is duplicated');
    ventureIds.add(ventureId);
  });

  var html = fs.readFileSync(path.join(ROOT, domainId + '.html'), 'utf8');
  assert.equal((html.match(/\/assets\/js\/domain-business-ladder\.js/g) || []).length, 1,
    domainId + '.html must load the read-only business ladder exactly once');
});

var template = fs.readFileSync(path.join(ROOT, 'domain-front.html'), 'utf8');
assert.equal((template.match(/\/assets\/js\/domain-business-ladder\.js/g) || []).length, 1,
  'the generated-front template must own exactly one business-ladder script reference');

var renderer = fs.readFileSync(SCRIPT, 'utf8');
assert.ok(renderer.indexOf('data-phase-namespace') !== -1, 'renderer must publish the namespace distinction');
assert.ok(renderer.indexOf('current LIMEN cycle phase') !== -1,
  'renderer must not present capital bands as live domain phase');
assert.ok(renderer.indexOf("fetch(DATA_URL") !== -1, 'renderer must read the one machine registry');
['/api/checkout', '/api/civilization-valves', '/api/civilization-treasury', '/api/agriculture-homestead-cycle'].forEach(function (route) {
  assert.equal(renderer.indexOf(route), -1, 'read-only renderer must not call effect or money route ' + route);
});

var populationHomestead = domains.population.bands['p2-p3'];
var agricultureOperations = domains.agriculture.bands['p4-p5'];
assert.equal(populationHomestead.venture, 'Homestead Deal Desk');
assert.equal(populationHomestead.href, '/home');
assert.equal(populationHomestead.runtimeLane, 'population opportunity + law:automail');
assert.equal(agricultureOperations.venture, 'Farm Operations Desk');
assert.equal(agricultureOperations.runtimeLane, 'agriculture:homestead');
assert.notEqual(populationHomestead.venture, agricultureOperations.venture,
  'Population Homestead and Agriculture farm operations must not collapse into one business');
assert.equal(populationHomestead.status, 'SOURCE_IMPLEMENTED_HELD');
assert.equal(agricultureOperations.status, 'SOURCE_IMPLEMENTED_HELD');

var home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
assert.ok(/Autonomous transaction,\s+closing and profit are <b>UNMEASURED<\/b>/.test(home),
  'Homestead public page must state the unmeasured business outcome');
assert.ok(home.indexOf('It is not this distressed-property business') !== -1,
  'Homestead public page must separate the Agriculture lane');

var intelligence = fs.readFileSync(path.join(ROOT, 'intelligence.html'), 'utf8');
var intelligenceInline = Array.from(intelligence.matchAll(/<script>([\s\S]*?)<\/script>/g));
intelligenceInline.forEach(function (match, index) {
  assert.doesNotThrow(function () { new vm.Script(match[1], { filename: 'intelligence.html#inline-' + (index + 1) }); },
    'Intelligence front inline JavaScript must parse before the shared ladder is appended');
});

console.log('domain business ladders: 20 domains, 100 band records, P0-P10 namespaced, Homestead identities separated: PASS');
