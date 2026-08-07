/**
 * lib/orb-ledger.js — what was asked for in a meeting, and what the readings said at the time.
 *
 * THE PROBLEM THIS EXISTS FOR. Managers meet, Remy asks Watts for early warning, and the next
 * meeting nobody knows whether it came. That focus is lost by purely deterministic code with
 * no model anywhere in the loop, which means it is not a model-discipline problem. Nothing
 * wrote down what was asked. A plan that lives only in the moment it was said is not a plan.
 *
 * THE ONE DESIGN DECISION THAT MATTERS: an ask records the reading it will be judged against.
 * "Did the warning come" is unanswerable later unless you stored the number you would measure
 * against at the moment of asking. So every entry carries a `witness`: the channel being
 * watched, its value then, and how many points of history existed. Answering it later is then
 * arithmetic on stored numbers, not a judgement call, and certainly not something a model gets
 * to decide after the fact.
 *
 * WHERE IT LIVES. Redis when lib/limen-db reports a redis backend — that is the shared,
 * durable one, and it is what production has. Otherwise a JSONL file on this machine, which is
 * what a developer box gets. It never silently pretends the in-memory fallback is storage:
 * limen-db.get() returns null rather than throwing when redis is absent, so asking it to hold
 * a ledger would lose every entry on the next cold start without ever erroring.
 *
 * The local file deliberately sits OUTSIDE the repo. A ledger inside it would be committed and
 * deployed, and this is operational state, not source.
 */

var path = require('path');
var fs = require('fs');
var db = require('../lib/limen-db');

var REDIS_KEY = 'orb:ledger';
var MAX_ENTRIES = 2000;                    // a rolling window, not an archive

function localPath() {
  if (process.env.ORB_LEDGER_PATH) return process.env.ORB_LEDGER_PATH;
  var home = process.env.USERPROFILE || process.env.HOME || '.';
  return path.join(home, '.limen', 'orb-ledger.jsonl');
}

function usingRedis() {
  try { return typeof db.getBackend === 'function' && db.getBackend() === 'redis'; }
  catch (e) { return false; }
}

function backend() { return usingRedis() ? 'redis' : 'file:' + localPath(); }

/* REDIS IS A LIST, NOT A BLOB, and the difference is a bill rather than a preference.
   Storing the ledger as one JSON value means every append reads the whole thing back and
   writes the whole thing out. Upstash charges bandwidth, so at 2000 entries that is a
   megabyte-and-a-bit moved on each of the cron's runs, forever, and it grows with the ledger.
   LPUSH plus LTRIM moves one entry per append no matter how long the record gets.

   LPUSH puts newest first; everything else here works oldest-first, so reads reverse it. */
async function readAll() {
  if (usingRedis()) {
    var rows = null;
    try { rows = await db.lrange(REDIS_KEY, 0, MAX_ENTRIES - 1); } catch (e) { rows = null; }
    if (!Array.isArray(rows)) return [];
    return rows.slice().reverse();
  }
  var p = localPath();
  if (!fs.existsSync(p)) return [];
  var out = [];
  var lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // A single corrupt line must not take the whole ledger with it.
    try { out.push(JSON.parse(lines[i])); } catch (e) { /* skip */ }
  }
  return out;
}

async function append(entries) {
  var list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) return { written: 0, backend: backend() };

  if (usingRedis()) {
    // Oldest first, so that after LPUSH reverses them the list still reads in time order.
    for (var i = 0; i < list.length; i++) await db.lpush(REDIS_KEY, list[i]);
    await db.ltrim(REDIS_KEY, 0, MAX_ENTRIES - 1);
    return { written: list.length, backend: 'redis' };
  }

  var p = localPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // Append-only: the record of what was asked should not be rewritable by a later run.
  fs.appendFileSync(p, list.map(function (e) { return JSON.stringify(e); }).join('\n') + '\n', 'utf8');
  return { written: list.length, backend: 'file:' + p };
}

/* Open asks between two managers, newest first. `from` asked `to` for something and it has not
   been marked settled. Both directions are kept because an offer is also a commitment. */
async function between(fromId, toId) {
  var all = await readAll();
  return all.filter(function (e) {
    return e && e.from === fromId && e.to === toId;
  }).sort(function (a, b) { return String(b.t).localeCompare(String(a.t)); });
}

/* Did the thing being waited on actually move since the ask?
 *
 * Deliberately NOT a verdict. It returns the two numbers and the delta and lets the caller
 * decide what counts as movement, because "enough" is a domain judgement and this file has no
 * business making it. Returns null when the channel was frozen at record time, since a
 * pinned channel can never answer anything and pretending otherwise would manufacture a
 * result — see the 56 flat channels of the 170 measured. */
function movementSince(entry, currentValue) {
  if (!entry || !entry.witness || entry.witness.value === null || entry.witness.value === undefined) return null;
  if (entry.witness.frozen) return null;
  if (currentValue === null || currentValue === undefined) return null;
  var was = Number(entry.witness.value), now = Number(currentValue);
  if (!isFinite(was) || !isFinite(now)) return null;
  return { channel: entry.witness.channel, was: was, now: now, delta: now - was };
}

module.exports = {
  append: append,
  readAll: readAll,
  between: between,
  movementSince: movementSince,
  backend: backend,
  localPath: localPath,
  REDIS_KEY: REDIS_KEY,
  MAX_ENTRIES: MAX_ENTRIES
};
