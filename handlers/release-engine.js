/**
 * handlers/release-engine.js — DMAD's consistency tool: a weekly plan + streak.
 *
 * Consistency is the #1 thing that grows an independent artist, so this is a TOOL,
 * not a readout: a small set of weekly moves he checks off, a streak that only grows
 * if he keeps showing up, and a release log. State persists per-person in Redis,
 * gated to the same admin login as the coach (anon = 403, no work).
 *
 * POST /api/release-engine { passcode, op, ... }
 *   op: get | toggle{id} | add-task{text} | remove-task{id} | set-tasks{tasks:[..]} | log-release{title}
 */
const db = require('../lib/limen-db');
const fs = require('node:fs');
const path = require('node:path');
const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

const DEFAULT_TASKS = ['Write or finish one hook', 'Post one hook-first clip (Reel/TikTok)', 'Pitch 1 playlist or curator'];
const HIST_CAP = 16;

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function people() { try { return (JSON.parse(fs.readFileSync(MAP, 'utf8')).people) || []; } catch (e) { return []; } }
function authorize(passcode) {
  if (!passcode) return null;
  const mk = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  if (mk && passcode === mk) return { key: 'master', name: 'Operator' };
  for (const p of people()) {
    const v = process.env[p.envVar || ('ADMIN_PASS_' + String(p.key || '').toUpperCase())];
    if (v && passcode === v) return p;
  }
  return null;
}

function todayISO() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return '1970-01-01'; } }
function weekStartISO(iso) {
  let d; try { d = iso ? new Date(iso + 'T00:00:00Z') : new Date(); } catch (e) { d = new Date(); }
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  return m.toISOString().slice(0, 10);
}
function freshTasks() { return DEFAULT_TASKS.map((t, i) => ({ id: 't' + i, text: t, done: false })); }
function blank() { return { weekStart: weekStartISO(), tasks: freshTasks(), streak: 0, best: 0, history: [], releases: [], updated: Date.now() }; }

// Roll the plan forward when a new week has started: finalize the old week into history,
// move the streak, and start fresh. A gap of >1 week breaks the streak.
function rollForward(s) {
  const cur = weekStartISO();
  if (!s.weekStart) { s.weekStart = cur; s.tasks = s.tasks && s.tasks.length ? s.tasks : freshTasks(); return s; }
  if (s.weekStart === cur) return s;

  const total = (s.tasks || []).length;
  const done = (s.tasks || []).filter(t => t.done).length;
  const releasedThatWeek = (s.releases || []).some(r => weekStartISO(r.date) === s.weekStart);
  const complete = (total > 0 && done === total) || releasedThatWeek;

  s.history = s.history || [];
  s.history.push({ week: s.weekStart, done: done, total: total, complete: complete });
  if (s.history.length > HIST_CAP) s.history = s.history.slice(-HIST_CAP);

  s.streak = complete ? (s.streak || 0) + 1 : 0;
  const weeksElapsed = Math.round((Date.parse(cur) - Date.parse(s.weekStart)) / (7 * 86400000));
  if (weeksElapsed > 1) s.streak = 0; // a fully-skipped week breaks the chain
  s.best = Math.max(s.best || 0, s.streak || 0);

  s.weekStart = cur;
  s.tasks = freshTasks();
  return s;
}

function view(s) {
  let daysSinceRelease = null;
  if (s.releases && s.releases.length) {
    const last = s.releases[s.releases.length - 1].date;
    daysSinceRelease = Math.max(0, Math.round((Date.now() - Date.parse(last + 'T00:00:00Z')) / 86400000));
  }
  const total = (s.tasks || []).length, done = (s.tasks || []).filter(t => t.done).length;
  return {
    weekStart: s.weekStart, tasks: s.tasks || [], streak: s.streak || 0, best: s.best || 0,
    history: s.history || [], releaseCount: (s.releases || []).length, daysSinceRelease: daysSinceRelease,
    thisWeekComplete: total > 0 && done === total
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Sign in first.' })); }

  const KEY = 'release:' + (person.key || 'x');
  let s = null; try { s = await db.get(KEY); } catch (e) {}
  if (!s || typeof s !== 'object') s = blank();
  s = rollForward(s);

  const op = (body && body.op) || 'get';
  if (op === 'toggle') {
    const t = (s.tasks || []).find(x => x.id === body.id); if (t) t.done = !t.done;
  } else if (op === 'add-task') {
    const text = String((body && body.text) || '').trim().slice(0, 140);
    if (text && (s.tasks || []).length < 8) s.tasks.push({ id: 't' + Date.now().toString(36), text: text, done: false });
  } else if (op === 'remove-task') {
    s.tasks = (s.tasks || []).filter(x => x.id !== body.id);
  } else if (op === 'set-tasks') {
    const arr = Array.isArray(body && body.tasks) ? body.tasks : [];
    const tasks = arr.map((t, i) => ({ id: 't' + i, text: String(t || '').trim().slice(0, 140), done: false })).filter(t => t.text).slice(0, 6);
    if (tasks.length) s.tasks = tasks;
  } else if (op === 'log-release') {
    const title = String((body && body.title) || '').trim().slice(0, 120) || 'Untitled';
    s.releases = s.releases || []; s.releases.push({ date: todayISO(), title: title });
    if (s.releases.length > 50) s.releases = s.releases.slice(-50);
  }

  s.updated = Date.now();
  try { await db.set(KEY, s); } catch (e) {}
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, state: view(s), who: person.name || '' }));
};
