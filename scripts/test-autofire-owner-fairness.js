#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var worker = require('../handlers/limen-worker-autofire.js');

function row(id, lane, domain) {
  return { id: id, cik: id, recommendedLane: lane, domain: domain };
}

var candidates = [
  row('finance-a', 'investment', 'technology'),
  row('finance-b', 'investment', 'energy'),
  row('science-a', 'research', 'science'),
  row('science-b', 'research', 'research'),
  row('medicine-a', 'research', 'medicine'),
  row('medicine-b', 'research', 'health'),
  row('education-a', 'research', 'education'),
  row('education-b', 'research', 'education'),
  row('environment-a', 'research', 'environment'),
  row('environment-b', 'research', 'environment'),
  row('unowned-a', 'research', 'culture')
];
var tick = worker.SCHEDULER_TICK_MS;

assert.equal(worker.schedulerGroup(candidates[0]), 'investment:finance');
assert.equal(worker.schedulerGroup(candidates[2]), 'research:science');
assert.equal(worker.schedulerGroup(candidates[4]), 'research:medicine');
assert.equal(worker.schedulerGroup(candidates[6]), 'research:education');
assert.equal(worker.schedulerGroup(candidates[8]), 'research:environment');
assert.equal(worker.schedulerGroup(candidates[10]), 'unowned');

var at0 = worker.fairCandidateOrder(candidates, 0);
var at1 = worker.fairCandidateOrder(candidates, tick);
var at2 = worker.fairCandidateOrder(candidates, tick * 2);
var at3 = worker.fairCandidateOrder(candidates, tick * 3);
var at4 = worker.fairCandidateOrder(candidates, tick * 4);
var at5 = worker.fairCandidateOrder(candidates, tick * 5);
var at6 = worker.fairCandidateOrder(candidates, tick * 6);
var at7 = worker.fairCandidateOrder(candidates, tick * 7);
var at8 = worker.fairCandidateOrder(candidates, tick * 8);
var at9 = worker.fairCandidateOrder(candidates, tick * 9);

assert.equal(at0[0].id, 'finance-a');
assert.equal(at1[0].id, 'science-a');
assert.equal(at2[0].id, 'medicine-a');
assert.equal(at3[0].id, 'education-a');
assert.equal(at4[0].id, 'environment-a');
assert.equal(at5[0].id, 'finance-b');
assert.equal(at6[0].id, 'science-b');
assert.equal(at7[0].id, 'medicine-b');
assert.equal(at8[0].id, 'education-b');
assert.equal(at9[0].id, 'environment-b');
assert.equal(at0[at0.length - 1].id, 'unowned-a');
assert.deepEqual(
  worker.fairCandidateOrder(candidates, tick * 4).map(function (r) { return r.id; }),
  at4.map(function (r) { return r.id; })
);
assert.equal(new Set(at5.map(function (r) { return r.id; })).size, candidates.length);

var withoutScience = candidates.filter(function (r) { return worker.schedulerGroup(r) !== 'research:science'; });
assert.equal(worker.fairCandidateOrder(withoutScience, tick)[0].id, 'medicine-a');

console.log('autofire owner fairness: Finance, Science, Medicine, Education, and Environment rotate deterministically without dropping candidates');
