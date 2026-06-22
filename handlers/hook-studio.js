/**
 * handlers/hook-studio.js — DMAD's songwriting tool: hooks on demand + a saved library.
 *
 * A TOOL that produces material he takes to the booth: pick BPM + vibe + theme, get 3
 * distinct hook options (lines, flow note, rhyme scheme), send any to the Beat Lab, and
 * save the keepers. Gated to his login (anon = 403, no model call). Defaults to Sonnet
 * for lyric quality — volume is one artist, so cost stays tiny — env-overridable + capped.
 *
 * POST /api/hook-studio { passcode, op, ... }
 *   op: generate{bpm,vibe,theme} | save{hook} | library | unsave{id}
 */
const db = require('../lib/limen-db');
const fs = require('node:fs');
const path = require('node:path');
const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.STUDIO_MODEL || 'claude-sonnet-4-6';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_TOKENS = parseInt(process.env.STUDIO_MAX_TOKENS || '1000', 10);
const DAILY_CAP = parseInt(process.env.STUDIO_DAILY_CAP || '80', 10);
const SAVE_CAP = 80;

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
async function bumpRate(key) {
  let day; try { day = new Date().toISOString().slice(0, 10); } catch (e) { day = 'x'; }
  const k = 'studio:rl:' + key + ':' + day;
  let n = 0; try { n = Number(await db.get(k)) || 0; } catch (e) {}
  if (n >= DAILY_CAP) return { ok: false };
  try { await db.set(k, n + 1); } catch (e) {}
  return { ok: true };
}
function clip(s, m) { s = String(s == null ? '' : s); return s.length > m ? s.slice(0, m) : s; }

function systemPrompt() {
  return [
    "You are a hitmaking hook writer for the artist DMAD (Drew): independent, melodic rap, NF-adjacent — he also rates Mac Miller, Lecrae, and Kid Cudi.",
    "Write hooks that are singable, emotionally direct, modern, and playlist-ready, in his voice: introspective, melodic, honest, never corny.",
    "No clichés, no filler lines, no forced profanity. Each hook must be able to stand as a chorus on its own.",
    "Return ONLY valid JSON — no preamble, no markdown fences."
  ].join('\n');
}
function userPrompt(bpm, vibe, theme) {
  return [
    "Write 3 DISTINCT hook options for a " + (vibe || 'melodic') + " song at " + (bpm || 140) + " BPM" + (theme ? (" about: " + theme) : " — pick a theme that fits his lane") + ".",
    "Each hook = 2 to 4 short lines that could be sung as a chorus.",
    "For each, add a one-line 'cadence' note (how to ride the beat at this tempo) and the rhyme 'scheme' (e.g. AABB).",
    'Return ONLY this JSON shape: {"hooks":[{"lines":"line one\\nline two","cadence":"...","scheme":"AABB"}]}'
  ].join('\n');
}

async function callClaude(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': VERSION },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: system, messages: [{ role: 'user', content: user }] })
    });
    const j = await r.json();
    if (!r.ok) return { ok: false, detail: j };
    return { ok: true, text: (j.content && j.content[0] && j.content[0].text) || '' };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
  finally { clearTimeout(timer); }
}
function parseHooks(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    const o = JSON.parse(t);
    if (o && Array.isArray(o.hooks)) {
      return o.hooks.slice(0, 4).map(h => ({ lines: clip(h.lines || '', 400), cadence: clip(h.cadence || '', 160), scheme: clip(h.scheme || '', 24) })).filter(h => h.lines);
    }
  } catch (e) {}
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Sign in first.' })); }

  const KEY = 'studio:' + (person.key || 'x');
  const op = (body && body.op) || 'generate';

  // library ops (no model call)
  if (op === 'library' || op === 'save' || op === 'unsave') {
    let s = null; try { s = await db.get(KEY); } catch (e) {}
    if (!s || typeof s !== 'object') s = { saved: [] };
    s.saved = Array.isArray(s.saved) ? s.saved : [];
    if (op === 'save') {
      const h = (body && body.hook) || {};
      s.saved.push({ id: 'h' + Date.now().toString(36), lines: clip(h.lines, 400), cadence: clip(h.cadence, 160), scheme: clip(h.scheme, 24), bpm: parseInt(h.bpm, 10) || 0, theme: clip(h.theme, 120), t: Date.now() });
      if (s.saved.length > SAVE_CAP) s.saved = s.saved.slice(-SAVE_CAP);
    } else if (op === 'unsave') {
      s.saved = s.saved.filter(x => x.id !== (body && body.id));
    }
    try { await db.set(KEY, s); } catch (e) {}
    return res.end(JSON.stringify({ ok: true, saved: s.saved, count: s.saved.length }));
  }

  // generate (model call) — gated + capped
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Studio not wired yet — ANTHROPIC_API_KEY is unset.' })); }
  const rl = await bumpRate(person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: "You've hit today's writing limit — back tomorrow." })); }

  const bpm = parseInt(body && body.bpm, 10) || 140;
  const vibe = clip((body && body.vibe) || 'melodic', 30);
  const theme = clip((body && body.theme) || '', 200).trim();
  const out = await callClaude(systemPrompt(), userPrompt(bpm, vibe, theme));
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'Pen slipped — try that again.' })); }

  const hooks = parseHooks(out.text);
  res.statusCode = 200;
  if (hooks && hooks.length) return res.end(JSON.stringify({ ok: true, hooks: hooks }));
  return res.end(JSON.stringify({ ok: true, raw: clip(out.text, 1200) }));  // fallback: show raw text
};
