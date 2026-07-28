#!/usr/bin/env node
/**
 * scripts/build-harness-graph.js — derive the wiring harness from the code.
 *
 * WHY THIS IS DERIVED AND NOT DRAWN BY HAND
 * A hand-drawn harness is a picture of what someone believed the system was on
 * the day they drew it. This repo already has one of those (lib/harness-map.js,
 * which restates the cron schedule) and it needs a drift check to stay true.
 * A harness with a thousand conductors cannot be kept true that way. So every
 * conductor here is read out of the source: a require, or a store that one file
 * writes and another reads. Nothing is asserted.
 *
 * WHY A REAL PARSER
 * 433 of the ~590 store call sites in this repo pass a variable, not a string
 * literal: db.get(K.salesAgg), db.set(CACHE_KEY), db.get(KEY[tool]). A regex
 * scanner resolves the 153 literal sites and silently drops the other 74%,
 * producing a harness that looks complete and is not. So this walks the AST and
 * resolves module-scope constants before reading the key off the call.
 *
 * THE TWO KEYSPACES ARE NOT ONE
 * lib/limen-db.js prefixes every key with "limen:" (limen-db.js:57). lib/redis-kv.js
 * does not. db.set('foo') and redisGet('foo') therefore touch DIFFERENT keys, and
 * joining them would draw a conductor between two files that never speak. Each
 * call site is bound to its library through the require that introduced it, and
 * the prefix is applied per library.
 *
 * WHAT IT CANNOT RESOLVE, IT SAYS
 * A key built entirely at runtime (db.get(keys[i]) where keys came from a fetch)
 * has no static value. Those are emitted as unterminated stubs on their pin
 * rather than guessed at, because a guessed conductor is a fabricated one.
 *
 * OUT:  assets/data/harness-graph.json
 * RUN:  node scripts/build-harness-graph.js [--verbose]
 */

'use strict';

var fs = require('fs');
var path = require('path');
var acorn = require('acorn');
var walk = require('acorn-walk');

var ROOT = path.join(__dirname, '..');
var VERBOSE = process.argv.indexOf('--verbose') !== -1;
/**
 * WHERE THIS IS WRITTEN, AND WHY IT IS NOT assets/data
 *
 * This file is a complete internal topology: every handler name, every Redis key,
 * every external dependency. assets/data/*.json is served publicly (verified
 * 2026-07-27: assets/data/brain-node-domains.json returns 200 to anyone), so
 * putting it there would publish the map.
 *
 * api/protected-docs/ is the one location that is both bundled into the Vercel
 * function (vercel.json includeFiles) and not statically served (verified: a file
 * inside it returns 404). The graph is therefore readable by the gated
 * /api/harness endpoint and by nobody else.
 */
var OUT = path.join(ROOT, 'api', 'protected-docs', 'harness-graph.json');

// ── which library, which prefix, which direction ────────────────────────────
// The prefix is the important column. See the header: getting it wrong invents
// conductors between files that share a key NAME but not a key.
var LIBS = {
  'limen-db': {
    prefix: 'limen:',
    ops: { get: 'r', set: 'w', del: 'w', lpush: 'w', lrange: 'r', ltrim: 'w' }
  },
  'redis-kv': {
    prefix: '',
    ops: { redisGet: 'r', redisSet: 'w', redisMGet: 'r' },
    // redisCmd takes a raw Redis command array rather than a key, so the verb
    // has to be read out of position 0 and the key out of position 1. 50 call
    // sites use this form; treating it as opaque would drop them all.
    raw: 'redisCmd'
  }
};

// Redis verbs, by whether they change the key. Reads make a file a consumer,
// writes make it a producer, and that direction is the whole conductor.
var VERBS = {
  GET: 'r', MGET: 'r', LRANGE: 'r', HGET: 'r', HGETALL: 'r', HMGET: 'r',
  SMEMBERS: 'r', ZRANGE: 'r', ZREVRANGE: 'r', EXISTS: 'r', TTL: 'r',
  KEYS: 'r', SCAN: 'r', LLEN: 'r', SCARD: 'r', ZCARD: 'r', TYPE: 'r',
  SET: 'w', SETEX: 'w', DEL: 'w', LPUSH: 'w', RPUSH: 'w', LTRIM: 'w',
  HSET: 'w', HDEL: 'w', SADD: 'w', SREM: 'w', ZADD: 'w', ZREM: 'w',
  INCR: 'w', INCRBY: 'w', DECR: 'w', EXPIRE: 'w', RENAME: 'w', LPOP: 'w', RPOP: 'w'
};

// Files that are themselves the storage layer. Their own calls are plumbing,
// not data flow, and including them would make every store look like it flows
// through one node.
var PLUMBING = ['limen-db.js', 'redis-kv.js'];

/**
 * The twenty domains. Taken from assets/js/domain-brains/, which is the set that
 * actually has a brain, rather than from any prose list.
 */
var DOMAINS = ['agriculture', 'communication', 'culture', 'defense', 'economy',
  'education', 'energy', 'environment', 'finance', 'governance', 'industry',
  'infrastructure', 'intelligence', 'law', 'medicine', 'population', 'religion',
  'science', 'technology', 'trade'];

/**
 * Regions. A wiring diagram groups terminal blocks by what the component DOES,
 * not by what it is called, so these are functional and ordered left to right
 * along the path signal actually takes: world in, through sense and cognition,
 * out to the world, and back round through the return path.
 *
 * Order here IS the sheet order. First match wins, so the list is arranged most
 * specific first. Anything that matches nothing lands in UNFILED and the count
 * is printed, because a misc bucket nobody looks at is how a map starts lying.
 */
var REGIONS = [
  { id: 'INGEST',  label: 'Ingest',        sub: 'world in',            test: /^(limen-worker-ingest|edgar|warn|realauction|energy-distress|fetch-|relay-|ingest|rss|sec-|openfda|pubmed)/ },
  { id: 'RETURN',  label: 'Return',        sub: 'reafference',         test: /^(feed-|outcome|limen-outcome|resolver)/ },
  { id: 'STRESS',  label: 'Stress field',  sub: 'interoception',       test: /^(limen-stress|grounded-|stress)/ },
  { id: 'COGNIT',  label: 'Cognition',     sub: 'brain layer',         test: /^(brain-|phase-|memory-|pattern-|trigger-pattern|consolidat|plasticity|percept|htm-|successor)/ },
  { id: 'SCORE',   label: 'Scoring',       sub: 'kernel',              test: /^(limen-worker-score|kernel|thing1|thing2|company-|score|rescore|portal-score)/ },
  { id: 'REVENUE', label: 'Revenue',       sub: 'money path',          test: /^(sales|crm|lead|leadgen|stripe|deal|autopilot|autoqueue|automail|subscriber|checkout|purchase)/ },
  { id: 'PUBLISH', label: 'Publish',       sub: 'outward motor',       test: /^(social|youtube|music|paper|print|hero-image|expand-|gazette|post-|broadcast)/ },
  { id: 'AI',      label: 'AI orchestr.',  sub: 'metered, gated',      test: /^(ai-|fleet|master-|agent-|claude|anthropic|hook-studio|enrich-)/ },
  { id: 'OPS',     label: 'Operations',    sub: 'operator surface',    test: /^(admin|audit|harness|operator|redis-|health|diag|vitals|status|immune|limen-health)/ },
  { id: 'OPPTY',   label: 'Opportunity',   sub: 'deal finding',        test: /^(opportunit|civil-|wave-radar|market-|asset-quote|skip-trace|ventures|capital-engine|transfer-)/ },
  { id: 'HOME',    label: 'Homestead',     sub: 'venture lane',        test: /^(homestead)/ },
  { id: 'BODY',    label: 'Body',          sub: 'personal interocept.', test: /^(fitness|biosensor)/ },
  { id: 'PLAT',    label: 'Platform',      sub: 'runtime plumbing',    test: /^(spine|infra-|site-request|env-|api-keys|release-|playbook|system-gain|critique-)/ },
  { id: 'DOMAIN',  label: 'Domains',       sub: 'twenty desks',        test: /^domain-/ },
  { id: 'WORKER',  label: 'Core workers',  sub: 'scheduled spine',     test: /^(limen-worker|limen-|cron-|civilization|console|snapshot)/ },
  { id: 'LIB',     label: 'Shared library', sub: 'required by many',   test: null /* by directory */ }
];

function regionOf(rec) {
  if (rec.dir === 'lib') return 'LIB';
  var n = rec.name;
  for (var i = 0; i < REGIONS.length; i++) {
    var r = REGIONS[i];
    if (r.id === 'LIB' || !r.test) continue;
    if (r.test.test(n)) return r.id;
  }
  for (var d = 0; d < DOMAINS.length; d++) {
    if (n.indexOf(DOMAINS[d]) === 0) return 'DOMAIN';
  }
  return 'UNFILED';
}

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

function listJs(dir) {
  var out = [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (f) {
    if (f.slice(-3) === '.js') out.push(path.join(dir, f));
  });
  return out;
}

function parse(src) {
  var opts = { ecmaVersion: 'latest', allowReturnOutsideFunction: true, allowHashBang: true };
  try { return acorn.parse(src, Object.assign({ sourceType: 'script' }, opts)); }
  catch (e1) {
    try { return acorn.parse(src, Object.assign({ sourceType: 'module' }, opts)); }
    catch (e2) { return { __error: e2.message }; }
  }
}

// ── constant resolution ─────────────────────────────────────────────────────
/**
 * Collect every `x = <string>` and `x = { k: <string> }` binding in the file.
 *
 * Deliberately NOT scope-aware. Scope-correct resolution would need a full
 * binding analysis, and the payoff is near zero here: these are module-level
 * key tables by convention (K, KEY, CACHE_KEY). A shadowed local would produce
 * one wrong key, and shadowing a key table is not a thing anyone does. The
 * tradeoff is stated rather than hidden so the next person can revisit it.
 */
function collectConstants(ast) {
  var env = {};
  walk.simple(ast, {
    VariableDeclarator: function (n) {
      if (!n.id || n.id.type !== 'Identifier' || !n.init) return;
      var v = literalOf(n.init);
      if (v !== undefined) { env[n.id.name] = { kind: 'str', value: v }; return; }
      if (n.init.type === 'ObjectExpression') {
        var obj = {};
        n.init.properties.forEach(function (p) {
          if (!p.key || p.computed) return;
          var name = p.key.name || p.key.value;
          var pv = literalOf(p.value);
          if (name != null && pv !== undefined) obj[name] = pv;
        });
        if (Object.keys(obj).length) env[n.id.name] = { kind: 'obj', value: obj };
      }
    }
  });
  return env;
}

function literalOf(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  return undefined;
}

/**
 * Resolve a key argument to the set of key patterns it can produce.
 * Returns [{ key, dynamic }]. `dynamic` means a runtime suffix follows the
 * static part, so the pattern is a prefix and not an exact key.
 */
function resolveKey(node, env) {
  if (!node) return [];
  var lit = literalOf(node);
  if (lit !== undefined) return [{ key: lit, dynamic: false }];

  if (node.type === 'Identifier') {
    var b = env[node.name];
    if (b && b.kind === 'str') return [{ key: b.value, dynamic: false }];
    // An identifier bound to a key TABLE, passed whole, is not a key.
    return [];
  }

  if (node.type === 'MemberExpression') {
    var objName = node.object && node.object.type === 'Identifier' ? node.object.name : null;
    var bo = objName ? env[objName] : null;
    if (!bo || bo.kind !== 'obj') return [];
    if (!node.computed && node.property && node.property.name != null) {
      var v = bo.value[node.property.name];
      return v !== undefined ? [{ key: v, dynamic: false }] : [];
    }
    // KEY[tool] — the index is runtime, so every entry in the table is reachable.
    if (node.computed) {
      return Object.keys(bo.value).map(function (k) { return { key: bo.value[k], dynamic: false }; });
    }
    return [];
  }

  // 'prefix:' + something  → a prefix pattern.
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    var left = resolveKey(node.left, env);
    if (left.length) return left.map(function (l) { return { key: l.key, dynamic: true }; });
    return [];
  }

  // `prefix:${x}` → same, static head only.
  if (node.type === 'TemplateLiteral' && node.quasis.length) {
    var head = node.quasis[0].value.cooked;
    if (head) return [{ key: head, dynamic: true }];
    return [];
  }

  return [];
}

/**
 * Local store wrappers, resolved one hop.
 *
 * Nine files in this repo do not use either shared library. They hold their own
 * Upstash credentials, define a local redisCmd(cmd), and wrap it:
 *
 *     async function redisGet(key)      { return redisCmd(['GET', key]); }
 *     async function redisLpush(key, v) { await redisCmd(['LPUSH', key, ...]); }
 *
 * At the redisCmd site the key is a PARAMETER, so nothing is resolvable there.
 * The real keys sit at the callers of the wrapper. Without this hop, every store
 * in those nine files is invisible and the harness would draw a region of the
 * system as unwired when it is heavily wired.
 *
 * One hop only. A wrapper around a wrapper around a wrapper is not a pattern
 * anyone here writes, and unbounded chasing would resolve keys that a reader of
 * the source could not confirm by eye.
 *
 * Returns { fnName: 'r' | 'w' }.
 */
function collectLocalRedisOps(ast) {
  var fns = [];
  walk.simple(ast, {
    FunctionDeclaration: function (n) { if (n.id) fns.push({ name: n.id.name, node: n }); },
    VariableDeclarator: function (n) {
      if (!n.id || n.id.type !== 'Identifier' || !n.init) return;
      if (n.init.type === 'FunctionExpression' || n.init.type === 'ArrowFunctionExpression') {
        fns.push({ name: n.id.name, node: n.init });
      }
    }
  });

  var ops = {};
  fns.forEach(function (f) {
    var params = f.node.params || [];
    if (!params.length || params[0].type !== 'Identifier') return;
    var keyParam = params[0].name;

    // Command arrays built into a local before the call get the same treatment.
    var arrays = [];
    walk.simple(f.node, {
      ArrayExpression: function (a) { arrays.push(a); }
    });

    arrays.forEach(function (a) {
      if (a.elements.length < 2) return;
      var verb = literalOf(a.elements[0]);
      if (!verb) return;
      var second = a.elements[1];
      if (!second || second.type !== 'Identifier' || second.name !== keyParam) return;
      var dir = VERBS[verb.toUpperCase()];
      if (!dir) return;
      // A wrapper that both reads and writes counts as a write: the write is the
      // edge that creates a dependency for somebody else.
      if (ops[f.name] !== 'w') ops[f.name] = dir;
      if (dir === 'w') ops[f.name] = 'w';
    });
  });
  return ops;
}

/**
 * redisCmd(['SET', key, ...]) — pull the verb from position 0 and the key from
 * position 1. A verb built at runtime is not resolvable and is counted as such
 * rather than assumed to be a read.
 */
function handleRaw(node, lib, env, rec) {
  var arg = node.arguments[0];
  if (!arg || arg.type !== 'ArrayExpression' || arg.elements.length < 2) { rec.unresolved++; return; }
  var verb = literalOf(arg.elements[0]);
  if (!verb) { rec.unresolved++; return; }
  var dir = VERBS[verb.toUpperCase()];
  if (!dir) { rec.unresolved++; return; }
  var keys = resolveKey(arg.elements[1], env);
  if (!keys.length) { rec.unresolved++; return; }
  keys.forEach(function (k) {
    (dir === 'r' ? rec.reads : rec.writes).push({ key: LIBS[lib].prefix + k.key, dynamic: k.dynamic });
  });
}

// ── per-file scan ───────────────────────────────────────────────────────────
function scanFile(file) {
  var src = fs.readFileSync(file, 'utf8');
  var ast = parse(src);
  var id = rel(file);
  var rec = {
    id: id,
    name: path.basename(file, '.js'),
    dir: path.dirname(id),
    bytes: src.length,
    requires: [],
    reads: [],          // [{ key, dynamic }]
    writes: [],
    unresolved: 0,      // call sites whose key could not be read statically
    hosts: [],          // external hosts fetched
    parseError: ast.__error || null
  };
  if (ast.__error) return rec;

  var env = collectConstants(ast);
  var localOps = collectLocalRedisOps(ast);
  rec.localWrappers = Object.keys(localOps);

  // Bind local names to the library they came from, so a call site can be
  // attributed to the right keyspace.
  var binding = {};   // localName -> 'limen-db' | 'redis-kv'
  walk.simple(ast, {
    VariableDeclarator: function (n) {
      if (!n.init || n.init.type !== 'CallExpression') return;
      if (!n.init.callee || n.init.callee.name !== 'require') return;
      var arg = literalOf(n.init.arguments[0]);
      if (!arg) return;
      var base = path.basename(arg).replace(/\.js$/, '');
      if (n.id.type === 'Identifier' && LIBS[base]) binding[n.id.name] = base;
      // Destructured: var { redisGet } = require('./redis-kv')
      if (n.id.type === 'ObjectPattern' && LIBS[base]) {
        n.id.properties.forEach(function (p) {
          if (p.value && p.value.type === 'Identifier') binding[p.value.name] = base;
        });
      }
    }
  });

  walk.simple(ast, {
    CallExpression: function (n) {
      var callee = n.callee;

      // require('...')
      if (callee.type === 'Identifier' && callee.name === 'require') {
        var m = literalOf(n.arguments[0]);
        if (m && (m.charAt(0) === '.' || m.indexOf('/') !== -1)) rec.requires.push(m);
        return;
      }

      // fetch('https://host/...')
      if (callee.type === 'Identifier' && callee.name === 'fetch') {
        var u = literalOf(n.arguments[0]) ||
          (n.arguments[0] && n.arguments[0].type === 'TemplateLiteral' && n.arguments[0].quasis.length
            ? n.arguments[0].quasis[0].value.cooked : null);
        if (u && /^https?:\/\//.test(u)) {
          var h = u.replace(/^https?:\/\//, '').split('/')[0];
          if (rec.hosts.indexOf(h) === -1) rec.hosts.push(h);
        }
        return;
      }

      if (callee.type !== 'MemberExpression' || callee.computed) return;
      var prop = callee.property && callee.property.name;
      if (!prop) return;

      // db.get(...) — object bound to a known library
      var lib = null;
      if (callee.object.type === 'Identifier' && binding[callee.object.name]) {
        lib = binding[callee.object.name];
      }
      if (!lib) return;
      if (LIBS[lib].raw && prop === LIBS[lib].raw) { handleRaw(n, lib, env, rec); return; }
      var dir = LIBS[lib].ops[prop];
      if (!dir) return;

      var keys = resolveKey(n.arguments[0], env);
      if (!keys.length) { rec.unresolved++; return; }
      var pfx = LIBS[lib].prefix;
      keys.forEach(function (k) {
        (dir === 'r' ? rec.reads : rec.writes).push({ key: pfx + k.key, dynamic: k.dynamic });
      });
    },

    // Bare redisGet(...) after destructuring
    Identifier: function () {}
  });

  // Destructured calls appear as plain CallExpressions with an Identifier callee.
  walk.simple(ast, {
    CallExpression: function (n) {
      if (n.callee.type !== 'Identifier') return;
      var fname = n.callee.name;

      // A call to a local wrapper. Its keys are raw: the local helpers in this
      // repo do not add a prefix, the callers spell "limen:" out themselves.
      if (!binding[fname] && localOps[fname]) {
        var lk = resolveKey(n.arguments[0], env);
        if (!lk.length) { rec.unresolved++; return; }
        lk.forEach(function (k) {
          (localOps[fname] === 'r' ? rec.reads : rec.writes).push({ key: k.key, dynamic: k.dynamic });
        });
        return;
      }

      var lib = binding[fname];
      if (!lib) return;
      if (LIBS[lib].raw && fname === LIBS[lib].raw) { handleRaw(n, lib, env, rec); return; }
      var dir = LIBS[lib].ops[fname];
      if (!dir) return;
      var keys = resolveKey(n.arguments[0], env);
      if (!keys.length) { rec.unresolved++; return; }
      keys.forEach(function (k) {
        (dir === 'r' ? rec.reads : rec.writes).push({ key: LIBS[lib].prefix + k.key, dynamic: k.dynamic });
      });
    }
  });

  return rec;
}

// ── build ───────────────────────────────────────────────────────────────────
function main() {
  var files = listJs(path.join(ROOT, 'handlers')).concat(listJs(path.join(ROOT, 'lib')));
  var recs = files.map(scanFile);

  var errs = recs.filter(function (r) { return r.parseError; });
  if (errs.length) {
    console.warn('[harness] ' + errs.length + ' file(s) failed to parse:');
    errs.forEach(function (r) { console.warn('   ' + r.id + ': ' + r.parseError); });
  }

  var scanned = recs.filter(function (r) { return !r.parseError; });
  var live = scanned.filter(function (r) { return PLUMBING.indexOf(path.basename(r.id)) === -1; });

  // Store index: key pattern -> writers / readers
  var stores = {};
  function touch(k, id, dir, dynamic) {
    if (!stores[k]) stores[k] = { key: k, dynamic: false, w: [], r: [] };
    if (dynamic) stores[k].dynamic = true;
    var arr = stores[k][dir];
    if (arr.indexOf(id) === -1) arr.push(id);
  }
  live.forEach(function (r) {
    r.writes.forEach(function (k) { touch(k.key, r.id, 'w', k.dynamic); });
    r.reads.forEach(function (k) { touch(k.key, r.id, 'r', k.dynamic); });
  });

  // Data conductors: writer -> reader, labelled with the store.
  // A file that reads its own write is not a conductor, it is a local.
  var data = [];
  Object.keys(stores).forEach(function (k) {
    var s = stores[k];
    s.w.forEach(function (w) {
      s.r.forEach(function (rd) {
        if (w !== rd) data.push({ from: w, to: rd, via: k, kind: 'data', dynamic: s.dynamic });
      });
    });
  });

  // Module conductors: file -> file it requires (only edges inside the repo).
  var byId = {};
  scanned.forEach(function (r) { byId[r.id] = r; });
  var mod = [];
  scanned.forEach(function (r) {
    r.requires.forEach(function (spec) {
      var abs = path.resolve(ROOT, r.dir, spec);
      var cands = [abs + '.js', abs, path.join(abs, 'index.js')];
      for (var i = 0; i < cands.length; i++) {
        var c = rel(cands[i]);
        if (byId[c]) { mod.push({ from: r.id, to: c, kind: 'module' }); return; }
      }
    });
  });

  // World conductors.
  var world = [];
  live.forEach(function (r) {
    r.hosts.forEach(function (h) { world.push({ from: r.id, to: 'world:' + h, kind: 'world' }); });
  });

  // ── terminal blocks ───────────────────────────────────────────────────────
  // A block holds at most PIN_CAP pins. Past that the pin numbers stop being
  // readable at sheet zoom, which is the only reason the cap exists; a region
  // that overflows is split into -A, -B rather than shrunk.
  var PIN_CAP = 18;
  var byRegion = {};
  scanned.forEach(function (r) {
    var reg = regionOf(r);
    r.region = reg;
    (byRegion[reg] = byRegion[reg] || []).push(r);
  });

  var blocks = [];
  var pinOf = {};                 // file id -> { block, pin }
  var order = REGIONS.map(function (r) { return r.id; }).concat(['UNFILED']);
  order.forEach(function (regId) {
    var members = byRegion[regId];
    if (!members || !members.length) return;
    // Busiest first inside a block: the pins that carry conductors sit at the
    // top of the terminal strip where they are easiest to trace.
    members.sort(function (a, b) {
      return (b.reads.length + b.writes.length) - (a.reads.length + a.writes.length) ||
             a.name.localeCompare(b.name);
    });
    var meta = REGIONS.filter(function (r) { return r.id === regId; })[0] ||
               { id: 'UNFILED', label: 'Unfiled', sub: 'matched no region rule' };
    var nParts = Math.ceil(members.length / PIN_CAP);
    for (var p = 0; p < nParts; p++) {
      var slice = members.slice(p * PIN_CAP, (p + 1) * PIN_CAP);
      var bid = regId + (nParts > 1 ? '-' + String.fromCharCode(65 + p) : '');
      var pins = slice.map(function (m, i) {
        pinOf[m.id] = { block: bid, pin: i + 1 };
        return {
          n: i + 1, file: m.id, name: m.name,
          r: m.reads.length, w: m.writes.length,
          unresolved: m.unresolved, hosts: m.hosts
        };
      });
      blocks.push({
        id: bid, region: regId, label: meta.label + (nParts > 1 ? ' ' + String.fromCharCode(65 + p) : ''),
        sub: meta.sub, pins: pins
      });
    }
  });

  // Resolve every conductor to block+pin at both ends so the renderer never has
  // to guess where a wire lands.
  var terminated = 0, unterminated = 0;
  var conductors = data.concat(mod).concat(world).map(function (c) {
    var a = pinOf[c.from], b = pinOf[c.to];
    if (a) { c.fromBlock = a.block; c.fromPin = a.pin; }
    if (b) { c.toBlock = b.block; c.toPin = b.pin; }
    if (a && b) terminated++; else unterminated++;
    return c;
  });

  var unfiled = (byRegion.UNFILED || []).length;

  var graph = {
    generated: null,               // stamped by the caller; see header of harness-graph handler
    counts: {
      blocks: blocks.length,
      pins: Object.keys(pinOf).length,
      unfiled: unfiled,
      terminatedConductors: terminated,
      unterminatedConductors: unterminated,
      filesScanned: scanned.length,
      parseFailed: errs.length,
      stores: Object.keys(stores).length,
      conductorsData: data.length,
      conductorsModule: mod.length,
      conductorsWorld: world.length,
      unresolvedCallSites: live.reduce(function (a, r) { return a + r.unresolved; }, 0)
    },
    files: scanned.map(function (r) {
      return {
        id: r.id, name: r.name, dir: r.dir, bytes: r.bytes,
        reads: r.reads.length, writes: r.writes.length,
        unresolved: r.unresolved, hosts: r.hosts
      };
    }),
    stores: Object.keys(stores).sort().map(function (k) { return stores[k]; }),
    blocks: blocks,
    regions: REGIONS.map(function (r) { return { id: r.id, label: r.label, sub: r.sub }; })
      .concat([{ id: 'UNFILED', label: 'Unfiled', sub: 'matched no region rule' }]),
    conductors: conductors
  };

  fs.writeFileSync(OUT, JSON.stringify(graph, null, 1));

  console.log('[harness] scanned ' + scanned.length + ' files (' + errs.length + ' parse failures)');
  console.log('[harness] stores: ' + graph.counts.stores);
  console.log('[harness] conductors: ' + data.length + ' data, ' + mod.length + ' module, ' + world.length + ' world');
  console.log('[harness] unresolved key call sites: ' + graph.counts.unresolvedCallSites + ' (drawn as stubs, never guessed)');
  console.log('[harness] blocks: ' + blocks.length + ', pins: ' + graph.counts.pins +
              (unfiled ? ', UNFILED: ' + unfiled : ', unfiled: 0'));
  console.log('[harness] wrote ' + rel(OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');

  if (VERBOSE) {
    var top = graph.stores.slice().sort(function (a, b) {
      return (b.w.length + b.r.length) - (a.w.length + a.r.length);
    }).slice(0, 25);
    console.log('\n[harness] busiest stores:');
    top.forEach(function (s) {
      console.log('  ' + (s.w.length + 'w/' + s.r.length + 'r').padEnd(9) + s.key + (s.dynamic ? '*' : ''));
    });
  }
}

main();
