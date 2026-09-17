'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

var wrapper = fs.readFileSync('python_runtime/limen_app.py', 'utf8');
var locked = fs.readFileSync('python_runtime/helix_app/thing1/limen_backtest.py', 'utf8');

assert.match(wrapper, /def _fetch_fred_quiet\(\):/,
  'the production wrapper must provide a request-local secret-safe fetch adapter');
assert.match(wrapper, /fred_delta = _fetch_fred_quiet\(\)/,
  'the production score path must use the secret-safe adapter');
assert.doesNotMatch(wrapper, /redirect_stdout|fred_delta = lbt\.fetch_fred\(\)/,
  'production must not mutate process-global stdout or invoke the noisy CLI fetcher');
assert.match(wrapper, /params=\{[\s\S]*"api_key": os\.environ\.get\("FRED_API_KEY"\) or lbt\.FRED_KEY/,
  'credentials must be passed as request parameters without string interpolation into logs');
assert.match(wrapper, /FRED fetch unavailable; request details withheld/,
  'the replacement production diagnostic must not contain a request URL');
assert.match(locked, /def fetch_fred\(\):/,
  'the validated kernel remains present and is not replaced by the wrapper fix');

console.log('limen FRED wrapper: locked kernel output contained and credential-bearing request details withheld');
