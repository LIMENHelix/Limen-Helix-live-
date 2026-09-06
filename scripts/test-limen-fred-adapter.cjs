'use strict';

var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var fs = require('node:fs');
var path = require('node:path');
var childProcess = require('node:child_process');

var root = path.resolve(__dirname, '..');
var apiSource = fs.readFileSync(path.join(root, 'api', 'limen.py'), 'utf8');
assert.match(apiSource, /fetch_fred_delta\(_rq\.get, os\.environ\.get\("FRED_API_KEY"\)\)/);
assert.doesNotMatch(apiSource, /lbt\.fetch_fred\(\)/, 'runtime scorer must not call the legacy secret-logging fetcher');

var kernel = fs.readFileSync(path.join(root, 'api', 'helix_app', 'thing1', 'limen_backtest.py'), 'utf8');
var lock = JSON.parse(fs.readFileSync(path.join(root, 'api', 'helix_app', 'thing1', 'VALIDATION_LOCK.json'), 'utf8'));
var signedBytes = Buffer.from(kernel.replace(/\r?\n/g, '\r\n'), 'utf8');
assert.equal(
  crypto.createHash('sha256').update(signedBytes).digest('hex'),
  lock.sha256,
  'validated kernel canonical CRLF representation must remain identical to its signed lock'
);

var python = String.raw`
from api.fred_delta import FRED_OBSERVATIONS_URL, fetch_fred_delta

secret = "never-print-this-secret"
logs = []
calls = []

class Response:
    status_code = 200
    def json(self):
        return {"observations": [
            {"date": "2014-01-01", "value": "5"},
            {"date": "2014-02-01", "value": "7"},
            {"date": "2014-04-01", "value": "10"},
            {"date": "bad", "value": "."},
        ]}

def success(url, **kwargs):
    calls.append((url, kwargs))
    return Response()

result = fetch_fred_delta(success, secret, logs.append)
assert result == {(2014, 2): 4.0}
assert calls[0][0] == FRED_OBSERVATIONS_URL
assert secret not in calls[0][0]
assert calls[0][1]["params"]["api_key"] == secret
assert logs == ["[limen] FRED FEDFUNDS: 1 quarterly deltas"]

class Rejected:
    status_code = 400

failure_logs = []
result = fetch_fred_delta(lambda url, **kwargs: Rejected(), secret, failure_logs.append)
assert result == {}
assert failure_logs == ["[limen] FRED FEDFUNDS unavailable: HTTP 400"]

network_logs = []
def network_failure(url, **kwargs):
    raise RuntimeError("request failed with api_key=" + secret)
result = fetch_fred_delta(network_failure, secret, network_logs.append)
assert result == {}
assert network_logs == ["[limen] FRED FEDFUNDS unavailable: network error"]

missing_logs = []
result = fetch_fred_delta(lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("must not call")), "", missing_logs.append)
assert result == {}
assert missing_logs == ["[limen] FRED FEDFUNDS unavailable: FRED_API_KEY missing"]

assert all(secret not in message and "api_key=" not in message
           for message in logs + failure_logs + network_logs + missing_logs)
print("limen FRED adapter: env credential used, quarterly delta preserved, logs secret-free")
`;

var result = childProcess.spawnSync('python', ['-c', python], {
  cwd: root,
  encoding: 'utf8',
  timeout: 30000
});
if (result.status !== 0) {
  process.stderr.write((result.stdout || '') + (result.stderr || ''));
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
