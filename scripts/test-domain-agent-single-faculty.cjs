'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var root = path.resolve(__dirname, '..');
var assetDir = path.join(root, 'assets', 'js');
var boxes = fs.readdirSync(assetDir).filter(function (name) { return /-agent-box\.js$/.test(name); }).sort();
assert.deepEqual(boxes, ['domain-agent-box.js'], 'one generic, domain-bound Governor UI must replace per-domain copies');

var routes = fs.readFileSync(path.join(root, 'api', '[...route].js'), 'utf8');
assert.match(routes, /'domain-agent': require\('\.\.\/handlers\/domain-agent'\)/);
assert.doesNotMatch(routes, /'energy-agent'/);

var consoleHtml = fs.readFileSync(path.join(root, 'domain-console.html'), 'utf8');
assert.match(consoleHtml, /assets\/js\/domain-agent-box\.js/);

console.log('domain agent single faculty: one domain-bound UI and one shared inference route serve all twenty sovereign brains');
