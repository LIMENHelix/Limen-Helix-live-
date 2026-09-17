#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function walkPython(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkPython(full) : (entry.name.endsWith('.py') ? [full] : []);
  });
}

const apiPython = walkPython(path.join(root, 'api')).map((file) => path.relative(root, file).replaceAll('\\', '/'));
assert.deepEqual(apiPython, ['api/python.py'],
  'api/ must expose exactly one Python function; internal modules belong in python_runtime/');

const entry = fs.readFileSync(path.join(root, 'api', 'python.py'), 'utf8');
assert.match(entry, /from python_runtime\.helix_app\.index import app/,
  'the entry point must use a package import so Vercel traces nested Helix modules');
assert.match(entry, /from python_runtime\.limen_app import app as limen_app/,
  'the LIMEN scorer must be statically traceable from the entry point');
assert.match(entry, /from python_runtime\.ddgs_app import app as ddgs_app/,
  'the search adapter must be statically traceable from the entry point');

for (const relative of [
  'python_runtime/helix_app/__init__.py',
  'python_runtime/helix_app/index.py',
  'python_runtime/helix_app/thing1/limen_backtest.py',
  'python_runtime/helix_app/thing1/statsmodels_compat.py',
  'python_runtime/helix_app/thing2/phase_engine.py',
  'python_runtime/limen_app.py',
  'python_runtime/ddgs_app.py',
]) {
  assert.ok(fs.existsSync(path.join(root, relative)), relative + ' must remain available to the unified runtime');
}

const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
assert.ok(config.functions['api/python.py'], 'unified Python function must have an explicit bundle rule');
assert.ok(config.functions['api/**/*.js'], 'Node functions must retain their independent bundle rule');
assert.match(config.functions['api/python.py'].includeFiles, /python_runtime\/\*\*/,
  'unified function must bundle the external Python application modules');
for (const excluded of ['brain-v2', 'node_modules', 'scripts']) {
  assert.ok(config.functions['api/python.py'].excludeFiles.includes(excluded),
    'Python function must exclude unrelated tree: ' + excluded);
}
assert.match(config.functions['api/python.py'].excludeFiles, /assets\/!\(data\)/,
  'Python function must exclude non-data browser assets');
assert.match(config.functions['api/python.py'].excludeFiles, /assets\/data\/!\(companies\|command-board-data\.json\|companies-manifest\.json\)/,
  'Python function must retain only the three runtime data surfaces');

const rewrites = Object.fromEntries((config.rewrites || []).map((row) => [row.source, row.destination]));
for (const source of [
  '/api/limen', '/api/limen/(.*)',
  '/api/helix', '/api/helix/(.*)',
  '/api/ddgs-search', '/api/ddgs-search/(.*)',
]) {
  assert.equal(rewrites[source], '/api/python', source + ' must resolve to the unified Python function');
}

const project = fs.readFileSync(path.join(root, 'api', 'pyproject.toml'), 'utf8');
const lock = fs.readFileSync(path.join(root, 'api', 'uv.lock'), 'utf8');
assert.doesNotMatch(project, /\buvicorn\b/i,
  'Vercel serves ASGI directly; bundling uvicorn duplicates an unused web server stack');
assert.doesNotMatch(project, /\bstatsmodels\b|\bscipy\b/i,
  'the locked scorer uses the bounded NumPy compatibility layer instead of shipping scipy');
assert.doesNotMatch(lock, /^name = "(?:statsmodels|scipy)"$/mi,
  'the resolved production lock must not restore the removed scientific packages');
assert.match(project, /requires-python = "~=3\.12\.0"/,
  'the dependency manifest and function runtime must use the same Python ABI');
assert.equal(fs.readFileSync(path.join(root, 'api', '.python-version'), 'utf8').trim(), '3.12',
  'the Vercel Python runtime must stay pinned to the production-supported 3.12 ABI');

const ignore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
assert.match(ignore, /^node_modules\/$/m,
  'CLI source deployments must not upload the local dependency tree');
const ignoreFile = path.join(root, '.vercelignore').replaceAll('\\', '/');
function ignored(paths) {
  const result = childProcess.spawnSync('git', [
    '-c', 'core.excludesFile=' + ignoreFile,
    'check-ignore', '--no-index', '--stdin',
  ], { cwd: root, encoding: 'utf8', input: paths.join('\n') + '\n' });
  assert.ok(result.status === 0 || result.status === 1,
    'git must be able to evaluate .vercelignore semantics: ' + String(result.stderr || '').trim());
  return String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
}
const runtimeAuditModules = [
  'python_runtime/helix_app/audit/__init__.py',
  'python_runtime/helix_app/audit/reconciliation_log.py',
];
assert.deepEqual(ignored(runtimeAuditModules), [],
  'the effective source-upload rules must retain every imported runtime audit module');
assert.deepEqual(ignored(['python_runtime/helix_app/audit/reconciliation_log.jsonl']),
  ['python_runtime/helix_app/audit/reconciliation_log.jsonl'],
  'generated request audit history must remain outside deployment archives');

console.log('python function layout: one ASGI bundle, external kernel modules, preserved public rewrites');
