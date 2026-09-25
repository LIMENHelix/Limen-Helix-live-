'use strict';

var assert = require('node:assert/strict');
var spawnSync = require('node:child_process').spawnSync;

var code = String.raw`
import json
from python_runtime.control_gate import authorize, normalize_record, route_class

def rec(stage):
    return {
        "schemaVersion": "civilization-valve-receipt/1.0",
        "valveId": "global:emergency",
        "runtimeMode": "OPEN" if stage == "OPEN" else "CLOSED",
        "nukeStage": stage,
    }

assert route_class("/api/ddgs-search/health") == "diagnostic"
assert route_class("/api/ddgs-search/search/text") == "sensing"
assert route_class("/api/helix/edgar/facts/1601548") == "sensing"
assert route_class("/api/limen/score", "POST") == "cognition"
assert route_class("/api/new-python-route") == "cognition"
assert normalize_record(None) == "OPEN"

assert authorize("/api/limen/health", "GET", None, control_available=False).allowed
assert not authorize("/api/ddgs-search/search/text", "GET", None, control_available=False).allowed
assert authorize("/api/ddgs-search/search/text", "GET", rec("SENSING_ONLY")).allowed
assert not authorize("/api/limen/score", "POST", rec("SENSING_ONLY")).allowed
assert authorize("/api/limen/score", "POST", rec("INTERNAL_COGNITION")).allowed
assert not authorize("/api/helix/score/1601548", "GET", rec("NUKED")).allowed
assert authorize("/api/helix/score/1601548", "GET", rec("OPEN")).allowed

bad = rec("OPEN")
bad["runtimeMode"] = "CLOSED"
assert not authorize("/api/limen/score", "POST", bad).allowed
print(json.dumps({"ok": True, "assertions": 13}))
`;

var candidates = [process.env.PYTHON, 'python', 'py'].filter(Boolean);
var result = null;
for (var i = 0; i < candidates.length; i++) {
  var args = candidates[i] === 'py' ? ['-3', '-c', code] : ['-c', code];
  result = spawnSync(candidates[i], args, { cwd: process.cwd(), encoding: 'utf8' });
  if (!result.error) break;
}
if (!result || result.error) throw result && result.error || new Error('Python unavailable');
assert.equal(result.status, 0, (result.stderr || result.stdout || '').trim());
var parsed = JSON.parse((result.stdout || '').trim());
assert.equal(parsed.ok, true);
assert.equal(parsed.assertions, 13);
console.log('python staged global control: 13 assertions passed');
