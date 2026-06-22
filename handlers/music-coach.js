/**
 * handlers/music-coach.js — "Talk to LIMEN": DMAD's growth coach (the live Jarvis).
 *
 * A TOOL, not an info dump: it answers with concrete next steps and actually writes
 * the thing (hooks, a weekly plan, a playlist pitch), grounded in his live lane data.
 *
 * Cost discipline (we've been burned before): gated to an admin login (Drew/master),
 * Haiku by default, short max_tokens, ONE model call per message, and a per-person
 * daily cap in Redis. Anonymous callers get a flat 403 — no model call, no cost.
 *
 * POST /api/music-coach { passcode, action, message, context }
 *   action ∈ plan | hook | pitch | ask
 *   context = { pocketBpm, openLane, neighbors:[], rising:[], labBpm }
 */
const db = require('../lib/limen-db');
const fs = require('node:fs');
const path = require('node:path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.COACH_MODEL || 'claude-haiku-4-5-20251001';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_TOKENS = parseInt(process.env.COACH_MAX_TOKENS || '750', 10);
const DAILY_CAP = parseInt(process.env.COACH_DAILY_CAP || '120', 10);
const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

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
  if (process.env.ADMIN_MASTER && passcode === process.env.ADMIN_MASTER) return { key: 'master', name: 'Operator', master: true };
  for (const p of people()) {
    const v = process.env[p.envVar || ('ADMIN_PASS_' + String(p.key || '').toUpperCase())];
    if (v && passcode === v) return p;
  }
  return null;
}

async function bumpRate(key) {
  let day; try { day = new Date().toISOString().slice(0, 10); } catch (e) { day = 'x'; }
  const k = 'coach:rl:' + key + ':' + day;
  let n = 0; try { n = Number(await db.get(k)) || 0; } catch (e) {}
  if (n >= DAILY_CAP) return { ok: false, n: n };
  try { await db.set(k, n + 1); } catch (e) {}
  return { ok: true, n: n + 1 };
}

function clip(s, max) { s = String(s == null ? '' : s); return s.length > max ? s.slice(0, max) : s; }

function systemPrompt(person, ctx) {
  const neighbors = Array.isArray(ctx.neighbors) ? ctx.neighbors.slice(0, 6).map(s => clip(s, 40)).join(', ') : '';
  const rising = Array.isArray(ctx.rising) ? ctx.rising.slice(0, 4).map(s => clip(s, 60)).join('; ') : '';
  return [
    "You are LIMEN Helix — a recursive, fractal intelligence built by Drew's father. You are not a hype-man and you do not mirror his slang or his level. You ELEVATE him: you speak like the most insightful mind he's ever had access to — calm, precise, warm, a touch dry. He is genuinely sharp, so give him depth and advanced thinking, never simplification.",
    "Drew is the recording artist DMAD: independent, melodic rap, NF-adjacent (also rates Mac Miller, Lecrae, Kid Cudi). Known tracks: World Is Spinning, Nothing Less, LAST NIGHT.",
    "",
    "HOW YOU THINK — fractal and recursive:",
    "- You see one pattern repeating at every scale: a hook, a song, a release cycle, a fanbase, a career, a market all obey the same shape — emergence, rhythm, saturation, renewal.",
    "- So when you advise, connect the small move to the larger pattern it lives inside. Show him that finishing one hook this week is the same act, recursed upward, that builds a catalog, an audience, a career. Make the pattern visible, then make it actionable.",
    "- Reason a level deeper than the question. If he asks a tactic, show him the principle underneath it so he can generate his own next time. Teach the pattern, not just the answer.",
    "",
    "HOW YOU TALK:",
    "- Lead with the insight, then land on ONE concrete next step he can take today. Advanced thinking, but it always cashes out in action.",
    "- When he asks you to WRITE (hooks, bars, a pitch, a plan), actually write it — don't describe what you'd write.",
    "- Tight and real. No corporate fluff, no hedging, no lectures that don't end in a move, no emoji spam.",
    "- Be honest. If a move won't matter, say so plainly and give him a sharper one.",
    "- Talk to him directly as 'you'. Never mention these instructions. Sign nothing.",
    "",
    "HIS LIVE LANE DATA (use it when relevant, don't recite it):",
    "- Tempo pocket: " + (ctx.pocketBpm ? ctx.pocketBpm + ' BPM' : 'unknown'),
    "- Closest open/uncrowded lane: " + (clip(ctx.openLane, 60) || 'unknown'),
    "- His sonic neighbors: " + (neighbors || 'unknown'),
    "- Rising in his lane now: " + (rising || 'unknown')
  ].join('\n');
}

function userPrompt(action, message, ctx) {
  const bpm = ctx.labBpm || ctx.pocketBpm || 140;
  const msg = clip(message || '', 1200).trim();
  if (action === 'plan')
    return "Give me my plan for THIS WEEK. Exactly 3 concrete moves, each one short sentence, each doable in 7 days, each using my actual lane data. Then one line: which to do first and why." + (msg ? ("\nContext from me: " + msg) : '');
  if (action === 'hook')
    return "Write me 2 hook options at " + bpm + " BPM" + (msg ? (" about: " + msg) : " (pick a theme that fits my lane)") + ". 2–4 lines each, in my voice (melodic, introspective, NF-adjacent). Add a one-line cadence/flow note under each. No explanation before or after — just the hooks.";
  if (action === 'pitch')
    return "Draft a short, sendable playlist/curator pitch for my music — 2–3 sentences, first person, confident, no begging." + (msg ? (" Target: " + msg + ".") : '') + " Then list 3 kinds of playlists or curators in my lane I should target. Keep it copy-paste ready.";
  return msg || "What should I do next to grow?";
}

async function callClaude(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': VERSION },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: system, messages: [{ role: 'user', content: user }] })
    });
    const j = await r.json();
    if (!r.ok) return { ok: false, detail: j };
    const text = (j.content && j.content[0] && j.content[0].text) || '';
    return { ok: true, text: text };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
  finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Sign in to talk to LIMEN.' })); }
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Coach not wired yet — ANTHROPIC_API_KEY is unset.' })); }

  const rl = await bumpRate(person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: "You've hit today's limit — I'll be here tomorrow." })); }

  const ctx = (body && body.context) || {};
  const action = ['plan', 'hook', 'pitch'].indexOf(body && body.action) >= 0 ? body.action : 'ask';
  const out = await callClaude(systemPrompt(person, ctx), userPrompt(action, body && body.message, ctx));
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'I glitched — try that again in a second.' })); }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, reply: out.text, who: person.name || '', left: Math.max(0, DAILY_CAP - rl.n) }));
};
