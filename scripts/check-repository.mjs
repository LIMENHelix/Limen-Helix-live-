#!/usr/bin/env node
/**
 * scripts/check-repository.mjs — static validation of the whole tracked repo.
 *
 *   node scripts/check-repository.mjs          full check
 *   node scripts/check-repository.mjs --quiet  only report failures
 *
 * Three checks, chosen because each one catches a class of breakage that has
 * actually shipped here before:
 *
 *   1. JS/MJS/CJS PARSE. A syntax error in any handler takes down every route,
 *      not just its own — the Hono catch-all requires them all at boot, so one
 *      bad file returns 500 for the entire /api surface. That has happened.
 *
 *   2. JSON PARSE. The site reads hundreds of generated JSON files at runtime.
 *      A truncated write is invisible until a page renders empty.
 *
 *   3. CRON TARGETS RESOLVE. vercel.json schedules 13 routes. A cron pointed at
 *      a handler that no longer exists fails silently forever — Vercel reports
 *      the invocation, the function 404s, and nothing tells you.
 *
 * PERFORMANCE NOTE. This parses with acorn in-process rather than spawning
 * `node --check` per file. Spawning is ~40x slower here and a previous attempt
 * at the same sweep had to be abandoned partway. acorn is already a devDependency.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { parse } from 'acorn';
import path from 'node:path';

const QUIET = process.argv.includes('--quiet');

/* A very large generated JSON blob is not worth the heap it costs to parse. The
   cap is reported so a skip can never be mistaken for a pass. */
const JSON_MAX_BYTES = 8 * 1024 * 1024;

const failures = [];
const notes = [];
let jsOk = 0, jsonOk = 0, jsonSkipped = 0;

function tracked(...patterns) {
  try {
    return execFileSync('git', ['ls-files', '-z', ...patterns], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024
    }).split('\0').filter(Boolean);
  } catch (e) {
    console.error('git ls-files failed: ' + e.message);
    process.exit(2);
  }
}

// ── 1. JavaScript parses ───────────────────────────────────────────────────
for (const f of tracked('*.js', '*.mjs', '*.cjs')) {
  let src;
  try { src = readFileSync(f, 'utf8'); }
  catch (e) { failures.push({ f, why: 'unreadable: ' + e.message }); continue; }

  /* THE GRAMMAR IS DECIDED BY THE EXTENSION AND THE PATH, because Node decides it
     that way. This used to try module then script for every file and accept either,
     which passed things Node rejects at load: an `import` inside a .cjs, or
     CommonJS-only syntax inside a .mjs. A checker that green-lights a file the runtime
     refuses is worse than no checker.

     .js WAS then left ambiguous, which was still too loose. package.json declares no
     "type", so Node reads every .js it requires as CommonJS — a server-side .js with
     `import` at the top is a boot failure, and the Hono catch-all makes one such
     failure take down the whole /api surface. Accepting either grammar everywhere
     meant the check could not see that.

     Measured: 9 tracked .js files use ESM syntax, and ALL of them sit under assets/ or
     limen-helix-api/ — browser modules loaded via <script type="module">, and a
     separate package. Nothing Node requires from api/, handlers/, lib/ or scripts/
     needs the module grammar. So the ambiguity is confined to the paths that earned
     it, and everything on the server path must parse as the script Node will treat it
     as. */
  const ext = f.slice(f.lastIndexOf('.'));
  const BROWSER_OR_FOREIGN = /^(assets\/|limen-helix-api\/)/;
  const grammars =
    ext === '.mjs' ? ['module'] :
    ext === '.cjs' ? ['script'] :
    BROWSER_OR_FOREIGN.test(f) ? ['module', 'script'] :
    ['script'];

  let err = null;
  for (const sourceType of grammars) {
    try {
      parse(src, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true });
      err = null;
      break;
    } catch (e) { err = e; }
  }
  if (err) {
    failures.push({
      f, why: 'syntax error line ' + (err.loc?.line ?? '?') + ': ' + err.message +
        (grammars.length === 1 ? '  (parsed as ' + grammars[0] + ', which ' + ext + ' requires)' : '')
    });
  } else jsOk++;
}

// ── 2. JSON parses ─────────────────────────────────────────────────────────
for (const f of tracked('*.json')) {
  let size = 0;
  try { size = statSync(f).size; } catch { continue; }
  if (size > JSON_MAX_BYTES) {
    jsonSkipped++;
    notes.push(f + ' skipped, ' + (size / 1048576).toFixed(1) + ' MB exceeds the ' + (JSON_MAX_BYTES / 1048576) + ' MB parse cap');
    continue;
  }
  try { JSON.parse(readFileSync(f, 'utf8')); jsonOk++; }
  catch (e) { failures.push({ f, why: 'invalid JSON: ' + e.message.slice(0, 120) }); }
}

// ── 3. Every scheduled cron resolves to a handler ──────────────────────────
let cronChecked = 0;
try {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const crons = vercel.crons || [];

  // The catch-all registers one route per key of its HANDLERS map.
  const catchAll = 'api/[...route].js';
  let registered = new Set();
  try {
    const src = readFileSync(catchAll, 'utf8');
    const block = src.slice(src.indexOf('const HANDLERS'), src.indexOf('};', src.indexOf('const HANDLERS')));
    for (const m of block.matchAll(/^\s*'([a-z0-9-]+)'\s*:/gim)) registered.add(m[1]);
  } catch { /* no catch-all: fall through to the per-file check below */ }

  /* Both runtimes count. Twelve Python handlers live under api/ (helix.py,
     limen.py, ddgs-search.py and friends). None is a cron target today, but
     resolving only .js would report a future Python cron as missing, and a check
     that cries wolf is a check somebody turns off. */
  const files = new Set([
    ...tracked('api/*.js', 'handlers/*.js').map(p => path.basename(p, '.js')),
    ...tracked('api/*.py').map(p => path.basename(p, '.py'))
  ]);

  for (const c of crons) {
    cronChecked++;
    const name = String(c.path).replace(/^\/api\//, '').split('?')[0];
    if (!registered.has(name) && !files.has(name)) {
      failures.push({ f: 'vercel.json', why: 'cron "' + c.path + '" resolves to no handler (not in HANDLERS, no api/' + name + '.{js,py}, no handlers/' + name + '.js)' });
    }
  }
} catch (e) {
  failures.push({ f: 'vercel.json', why: 'could not read or parse: ' + e.message });
}

// ── report ─────────────────────────────────────────────────────────────────
if (!QUIET) {
  console.log('repository check');
  console.log('  javascript parsed : ' + jsOk);
  console.log('  json parsed       : ' + jsonOk + (jsonSkipped ? '  (' + jsonSkipped + ' skipped over the size cap)' : ''));
  console.log('  cron targets      : ' + cronChecked);
  if (notes.length && notes.length <= 12) notes.forEach(n => console.log('  note: ' + n));
  else if (notes.length) console.log('  note: ' + notes.length + ' files skipped over the size cap');
}

if (failures.length) {
  console.error('\n' + failures.length + ' PROBLEM' + (failures.length > 1 ? 'S' : '') + ':');
  for (const x of failures) console.error('  ' + x.f + '\n      ' + x.why);
  process.exit(1);
}

console.log('\nrepository check passed');
