'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');

var wrapper = fs.readFileSync('python_runtime/limen_app.py', 'utf8');
var locked = fs.readFileSync('python_runtime/helix_app/thing1/limen_backtest.py', 'utf8');
var fred = fs.readFileSync('python_runtime/helix_app/thing1/fred.py', 'utf8');

assert.match(wrapper, /def _fetch_fred_quiet\(\):/,
  'the production wrapper must provide a request-local secret-safe fetch adapter');
assert.match(wrapper, /fred_result = _fetch_fred_quiet\(\)/,
  'the production score path must use the secret-safe adapter');
assert.doesNotMatch(wrapper, /redirect_stdout|fred_delta = lbt\.fetch_fred\(\)/,
  'production must not mutate process-global stdout or invoke the noisy CLI fetcher');
assert.doesNotMatch(wrapper, /lbt\.FRED_KEY/,
  'production must not fall back to an embedded kernel credential');
assert.match(wrapper, /lbt\.fetch_fred_quiet\(lbt\.requests\.get\)/,
  'the production adapter must delegate to the fingerprinted FRED fetch');
assert.match(wrapper, /FRED fetch unavailable; request details withheld/,
  'the replacement production diagnostic must not contain a request URL');
assert.match(wrapper, /raise HTTPException\(503, "fred-not-configured"\)/,
  'missing FRED configuration must be a named failure before scoring');
assert.match(locked, /def fetch_fred\(\):/,
  'the validated kernel remains present and is not replaced by the wrapper fix');
assert.match(locked, /def fetch_fred_quiet\(/,
  'the kernel must own the fingerprinted FRED fetch');
assert.match(locked, /_fred_delta_from_observations/,
  'the validated FRED input transformation must remain inside the fingerprinted file');
assert.doesNotMatch(fred, /def fetch_quiet/,
  'the configuration module must not own the validated input transformation');
assert.doesNotMatch(locked, /FRED_KEY\s*=\s*["'][A-Fa-f0-9]{20,}["']/,
  'the kernel must not embed a FRED credential');
assert.match(fred, /FRED_API_KEY_ENV = "FRED_API_KEY"/,
  'the FRED adapter must name the environment variable');
assert.match(fred, /def api_key\(/,
  'the FRED adapter must resolve the key from the environment');
assert.doesNotMatch(fred, /[A-Fa-f0-9]{32}/,
  'the FRED adapter must not embed a credential literal');

console.log('limen FRED wrapper: env-only configuration, named missing-config failure, and secret-safe diagnostics');
