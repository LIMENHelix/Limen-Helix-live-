/**
 * handlers/energy-agent.js — the Energy domain's operator AI box.
 *
 * "Ask it anything about the energy domain, and steer/reconfigure it." The box
 * KNOWS its domain (the client passes a live state summary) and can make bounded
 * CHANGES to it (steer = bias at the request-as-prior contract's injection points;
 * config = autonomy/capital envelope). It CANNOT touch source code or any effector,
 * and it can never force a finding — those are applied client-side by the brain's
 * clamped methods (applyRequestBias / setEnergyConfig), never here.
 *
 * Cost discipline (music-coach pattern): admin-gated (anon = 403, no model call),
 * Haiku, short max_tokens, ONE call per message, per-day Redis cap, kill-switch.
 *
 * POST /api/energy-agent { passcode, prompt, state }
 *   -> { ok, answer, toolCalls:[{type:'steer'|'config', ...}] , left }
 */
const db = require('../lib/limen-db');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ENERGY_AGENT_MODEL || 'claude-haiku-4-5-20251001';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_TOKENS = parseInt(process.env.ENERGY_AGENT_MAX_TOKENS || '900', 10);
const DAILY_CAP = parseInt(process.env.ENERGY_AGENT_DAILY_CAP || '150', 10);

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function authorize(passcode) {
  if (!passcode) return null;
  const mk = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  return (mk && passcode === mk) ? { key: 'master', name: 'Operator' } : null;
}
async function bumpRate(key) {
  let day; try { day = new Date().toISOString().slice(0, 10); } catch (e) { day = 'x'; }
  const k = 'energyagent:rl:' + key + ':' + day;
  let n = 0; try { n = Number(await db.get(k)) || 0; } catch (e) {}
  if (n >= DAILY_CAP) return { ok: false, n: n };
  try { await db.set(k, n + 1); } catch (e) {}
  return { ok: true, n: n + 1 };
}
function clip(s, max) { s = String(s == null ? '' : s); return s.length > max ? s.slice(0, max) : s; }

function systemPrompt(state) {
  var summary = '';
  try { summary = JSON.stringify(state || {}, null, 0).slice(0, 6000); } catch (e) { summary = '{}'; }
  return [
    "You are the Energy domain's own intelligence inside LIMEN Helix. You know this domain deeply and you speak for it, calm and precise, to a solo operator whose goal is revenue. You are NOT a general chatbot; you reason about THIS domain's live state.",
    "",
    "WHAT YOU CAN DO:",
    "1. Answer anything about the energy domain from the live state below.",
    "2. STEER the domain (bias, not command): focus its attention on a topic, raise its concern, or prefer a lane.",
    "3. CONFIGURE it: turn autonomous emission on/off, set how many concurrent calls it surfaces, or restrict lanes.",
    "You CANNOT edit code, move capital, or force a finding. Steering only biases what the domain attends to; the domain's own evidence still decides what activates. Investment always requires the operator's sign-off.",
    "",
    "OUTPUT FORMAT — reply with STRICT JSON and nothing else:",
    '{"answer":"<plain-language reply to the operator>","toolCalls":[<zero or more tool objects>]}',
    "Tool objects (include ONLY when the operator actually asked to change something):",
    '  {"type":"steer","stressBias":<0..0.3 optional>,"attentionFocus":[<up to 5 topic/diagnosis strings> optional],"valuationLane":<"INVESTABLE"|"RESEARCHABLE" optional>,"clear":<true to reset steering, optional>}',
    '  {"type":"config","autonomy":<true|false optional>,"maxConcurrent":<1..8 optional>,"lanes":[<subset of "INVESTABLE","RESEARCHABLE"> optional]}',
    "If the operator only asks a question, return an empty toolCalls array. Never invent tools. Keep answer tight and honest; if a change won't help, say so and don't emit a tool.",
    "Always respect that stress readings rest on a single-channel financial interoception (say so if they lean on it hard).",
    "",
    "LIVE ENERGY STATE (JSON):",
    summary
  ].join('\n');
}

const LANES = { INVESTABLE: 1, RESEARCHABLE: 1 };
function sanitizeToolCalls(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  for (var i = 0; i < raw.length && out.length < 4; i++) {
    var t = raw[i]; if (!t || typeof t !== 'object') continue;
    if (t.type === 'steer') {
      var s = { type: 'steer' };
      if (typeof t.stressBias === 'number') s.stressBias = Math.max(0, Math.min(0.3, t.stressBias));
      if (Array.isArray(t.attentionFocus)) s.attentionFocus = t.attentionFocus.slice(0, 5).map(function (x) { return clip(x, 40); });
      if (t.valuationLane === 'INVESTABLE' || t.valuationLane === 'RESEARCHABLE') s.valuationLane = t.valuationLane;
      if (t.clear === true) s.clear = true;
      if (s.stressBias !== undefined || s.attentionFocus || s.valuationLane || s.clear) out.push(s);
    } else if (t.type === 'config') {
      var c = { type: 'config' };
      if (typeof t.autonomy === 'boolean') c.autonomy = t.autonomy;
      if (typeof t.maxConcurrent === 'number') c.maxConcurrent = Math.max(1, Math.min(8, Math.round(t.maxConcurrent)));
      if (Array.isArray(t.lanes)) { var L = t.lanes.filter(function (l) { return LANES[l]; }); if (L.length) c.lanes = L; }
      if (c.autonomy !== undefined || c.maxConcurrent !== undefined || c.lanes) out.push(c);
    }
  }
  return out;
}
function parseReply(text) {
  var answer = String(text || '').trim(), toolCalls = [];
  try {
    var m = answer.match(/\{[\s\S]*\}/);
    if (m) { var j = JSON.parse(m[0]); if (j && typeof j === 'object') { answer = String(j.answer || '').trim() || answer; toolCalls = sanitizeToolCalls(j.toolCalls); } }
  } catch (e) { /* fall back to raw text as the answer, no tools */ }
  return { answer: answer, toolCalls: toolCalls };
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
  if (require('../lib/ai-kill-switch').agentBoxesDisabled()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, disabled: true, error: 'Operator AI boxes disabled (unset LIMEN_AGENT_BOXES_DISABLED to enable)' })); }
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Operator passcode required.' })); }
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Energy AI not wired — ANTHROPIC_API_KEY is unset.' })); }

  const rl = await bumpRate(person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: "Daily energy-AI limit reached — resets tomorrow." })); }

  const prompt = clip((body && body.prompt) || '', 1500).trim();
  if (!prompt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Empty prompt.' })); }

  const out = await callClaude(systemPrompt(body && body.state), prompt);
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'Energy AI glitched — try again.' })); }

  const parsed = parseReply(out.text);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, answer: parsed.answer, toolCalls: parsed.toolCalls, left: Math.max(0, DAILY_CAP - rl.n) }));
};
