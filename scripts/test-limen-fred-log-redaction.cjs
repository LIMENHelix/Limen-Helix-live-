'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

var wrapper = fs.readFileSync('api/limen.py', 'utf8');
var locked = fs.readFileSync('api/helix_app/thing1/limen_backtest.py', 'utf8');

assert.match(wrapper, /with contextlib\.redirect_stdout\(io\.StringIO\(\)\):\s+fred_delta = lbt\.fetch_fred\(\)/,
  'the production wrapper must contain the locked kernel diagnostic output');
assert.match(wrapper, /FRED fetch unavailable; request details withheld/,
  'the replacement production diagnostic must not contain a request URL');
assert.match(locked, /def fetch_fred\(\):/,
  'the validated kernel remains present and is not replaced by the wrapper fix');

console.log('limen FRED wrapper: locked kernel output contained and credential-bearing request details withheld');
