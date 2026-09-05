#!/usr/bin/env node
import assert from 'node:assert/strict';
import { proseFlagsForNote, repairSafeProsePunctuation } from './_prose-quality.mjs';

const complete = 'A complete relationship note names the relevant company and explains the operational dependency with enough context for review.';

assert.deepEqual(
  repairSafeProsePunctuation(complete + '.').repairs,
  ['collapse-duplicate-terminal-period']
);
assert.equal(repairSafeProsePunctuation(complete + '.').value, complete);

assert.deepEqual(
  repairSafeProsePunctuation('. ' + complete + '.').repairs,
  ['remove-leading-period', 'collapse-duplicate-terminal-period']
);
assert.equal(repairSafeProsePunctuation('. ' + complete + '.').value, complete);

assert.equal(repairSafeProsePunctuation(complete).value, complete);
assert.equal(repairSafeProsePunctuation(complete.slice(0, -1) + '...').value, complete.slice(0, -1) + '...');
assert.equal(repairSafeProsePunctuation('An abbreviation such as U.S.. remains internal.').value, 'An abbreviation such as U.S.. remains internal.');
assert.equal(repairSafeProsePunctuation('').value, '');

assert(proseFlagsForNote('. ' + complete).includes('leading-punctuation'));
assert(proseFlagsForNote(complete + '.').includes('trailing-ellipsis'));
assert(proseFlagsForNote('').includes('empty'));

console.log('prose quality healer: deterministic punctuation repairs and abstentions passed');
