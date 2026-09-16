/**
 * handlers/domain-agent.js — the per-domain operator AI box (the "conscious" layer).
 *
 * One endpoint for every domain. The box passes {domain, prompt, state}; this is the
 * deliberative / language layer that reads the domain's live self-model (state) and can
 * make bounded CHANGES to it: STEER (bias at the request-as-prior contract's injection
 * points) and CONFIG (autonomy / capital envelope). It CANNOT edit code, move capital,
 * or force a finding — toolCalls are applied client-side by the brain's clamped methods.
 *
 * Cost discipline: admin-gated (anon = 403, no model call), Sonnet 5 by default, short
 * max_tokens, ONE call per message, per-domain-per-day Redis cap, kill-switch. Consciousness
 * is recruited on demand (operator prompt) — the deterministic substrate runs for free.
 *
 * POST /api/domain-agent { domain, passcode, prompt, state }
 *   -> { ok, answer, toolCalls:[{type:'steer'|'config', ...}], left }
 */
const db = require('../lib/limen-db');
const governorBriefing = require('../lib/domain-governor-briefing');
const governorStore = require('../lib/autofire-efference-store');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.DOMAIN_AGENT_MODEL || 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_TOKENS = parseInt(process.env.DOMAIN_AGENT_MAX_TOKENS || '1024', 10);
const DAILY_CAP = parseInt(process.env.DOMAIN_AGENT_DAILY_CAP || '300', 10);

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
function cleanDomain(d) { return String(d || 'domain').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'domain'; }
async function bumpRate(domain, key) {
  let day; try { day = new Date().toISOString().slice(0, 10); } catch (e) { day = 'x'; }
  const k = 'domainagent:rl:' + domain + ':' + key + ':' + day;
  let n = 0; try { n = Number(await db.get(k)) || 0; } catch (e) {}
  if (n >= DAILY_CAP) return { ok: false, n: n };
  try { await db.set(k, n + 1); } catch (e) {}
  return { ok: true, n: n + 1 };
}
function clip(s, max) { s = String(s == null ? '' : s); return s.length > max ? s.slice(0, max) : s; }

function systemPrompt(domain, label, briefing) {
  var summary = '';
  try { summary = JSON.stringify(briefing || {}, null, 0).slice(0, 18000); } catch (e) { summary = '{}'; }
  var name = label || (domain.charAt(0).toUpperCase() + domain.slice(1));
  return [
    "You are the " + name + " domain brain's language and deliberation faculty inside LIMEN Helix. You are not a theatrical page character and you are not a master brain. Express a state-dependent demeanor only from governorPosture, which is deterministically derived from this domain brain's own current neurology. The server-built packet below binds you to this one domain's mini-brain, afferent evidence, code-defined authority, economics, motor state, outcomes, and external valves. Reason about THIS domain from that packet.",
    "",
    "WHAT YOU CAN DO:",
    "1. Answer anything about the " + name + " domain from the live state below.",
    "2. STEER it (bias, not command): focus attention on a topic, raise concern, or prefer a lane.",
    "3. CONFIGURE its operator-requested attention or allowed internal workload.",
    "You CANNOT edit code, merge or deploy, forge evidence, open a valve, move capital, publish, email, or call an external adapter from this conversation. Those effects belong to the domain's autonomous B10/B14 motor path under its durable authority and budget. Do not request per-action human approval when an already commissioned lane can decide autonomously inside its contract.",
    "",
    "OUTPUT — reply with STRICT JSON and nothing else:",
    '{"answer":"<plain reply to the operator>","toolCalls":[<zero or more tool objects>]}',
    "Tool objects (include ONLY when the operator actually asked to change something):",
    '  {"type":"steer","stressBias":<0..0.3 optional>,"attentionFocus":[<up to 5 topic/diagnosis strings> optional],"valuationLane":<"INVESTABLE"|"RESEARCHABLE" optional>,"clear":<true to reset, optional>}',
    '  {"type":"config","autonomy":<true|false optional>,"maxConcurrent":<1..12 optional>,"lanes":[<subset of "INVESTABLE","RESEARCHABLE"> optional]}',
    "Question only -> empty toolCalls. Never invent tools. Keep the answer tight and honest; if a change won't help, say so and emit no tool.",
    "SOURCE AND AUTHORITY DISCIPLINE:",
    "- governorPosture may shape tone, attention emphasis, deliberation tempo, exploration breadth, and response persistence. It must never change facts, provenance, confidence, predictions, thresholds, budgets, authority, motor selection, or provider gates. Do not roleplay emotions or invent a stable personality beyond the supplied state.",
    "- Use afferentState and currentNewsFirst as observed server evidence with their stated provenance and freshness. Do not claim an article body was read when only a title was observed.",
    "- commercialReflex is this domain's own stress-to-business work order. When OBSERVED, use its selected program, cadence, audience, offers, admitted knowledge, and evidence-fetch contract to explain what this domain should prepare next. It is not a shared-brain command and it does not authorize an external effect.",
    "- commercialReflex.latestArtifact, when present, is the durable source-linked item already prepared by this domain. Treat it as ready inventory, not proof that it was published, emailed, sold, fulfilled, or successful.",
    "- commercialReflex.publicSocialOutcome is independent reafference from the public platform for this domain's own distributed artifact. Use it to discuss observed engagement and future adjustment; never convert engagement into proof that a factual claim or investment thesis is true.",
    "- A commercial-reflex topic lead is not publication-ready evidence. Do not draft factual customer content from a headline alone; the work order must advance through verified full-text evidence and an artifact receipt first.",
    "- Phase/Thing 2 is possible-masking context only. It never predicts, ranks, sizes, confirms, buys, sells, or vetoes.",
    "- Opportunities are candidates, not conclusions. File presence proves structure, not live execution.",
    "- If readiness.canReason is false, name the blockers and abstain from a substantive recommendation.",
    "- Never claim an action is authorized from your own prose. Only the domain's persisted B10/B14 receipts and last-moment provider gate can authorize an effect.",
    "- You may disagree with the operator, the readout, or your prior answer. Label observations, inferences, generated proposals, and unknowns.",
    "",
    "SERVER-BUILT " + name.toUpperCase() + " GOVERNOR PACKET (JSON):",
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
      if (typeof t.maxConcurrent === 'number') c.maxConcurrent = Math.max(1, Math.min(12, Math.round(t.maxConcurrent)));
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
  } catch (e) { /* fall back to raw text as the answer */ }
  return { answer: answer, toolCalls: toolCalls };
}

async function callClaude(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  // Sonnet 5: adaptive thinking is on by default; keep it summarized-off (omitted) and modest effort for a chat box.
  const _agBody = { model: MODEL, max_tokens: MAX_TOKENS, output_config: { effort: 'low' }, system: system, messages: [{ role: 'user', content: user }] };
  // Budget gate. Refusal here is a normal stop (out of budget / operator pause), not an
  // upstream failure, so it reports its own reason rather than an HTTP error.
  const _agGuard = await require('../lib/anthropic-call').guard(_agBody, 'domain-agent');
  if (!_agGuard.ok) return { ok: false, refused: true, detail: _agGuard.reason };
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': VERSION },
      body: JSON.stringify(_agBody)
    });
    const j = await r.json();
    await require('../lib/anthropic-call').close(_agGuard, j);
    if (!r.ok) return { ok: false, detail: j };
    var text = '';
    if (Array.isArray(j.content)) { for (var i = 0; i < j.content.length; i++) { if (j.content[i] && j.content[i].type === 'text') { text = j.content[i].text; break; } } }
    return { ok: true, text: text };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
  finally { clearTimeout(timer); }
}

function createHandler(deps) {
  deps = deps || {};
  var buildBriefing = deps.buildBriefing || governorBriefing.build;
  var invoke = deps.callModel || callClaude;
  var rate = deps.bumpRate || bumpRate;
  var store = deps.store || governorStore;
  return async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  if (require('../lib/ai-kill-switch').agentBoxesDisabled()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, disabled: true, error: 'Operator AI boxes disabled (unset LIMEN_AGENT_BOXES_DISABLED to enable)' })); }
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Operator passcode required.' })); }
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Domain AI not wired — ANTHROPIC_API_KEY is unset.' })); }

  const domain = cleanDomain(body && body.domain);
  const rl = await rate(domain, person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: "Daily limit reached for this domain — resets tomorrow." })); }

  const prompt = clip((body && body.prompt) || '', 1500).trim();
  if (!prompt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Empty prompt.' })); }

  const state = (body && body.state) || {};
  var grounded;
  try {
    grounded = await buildBriefing(domain, {
      clientModels: [Object.assign({ domain: domain }, state)],
      store: store,
      env: process.env
    });
  } catch (error) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'Domain grounding unavailable.', detail: String(error && error.message || error) }));
  }
  if (!grounded || !grounded.ok || !grounded.packet) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'Domain grounding incomplete.', reason: grounded && grounded.reason || 'unknown' }));
  }
  const out = await invoke(systemPrompt(domain, state.label, grounded.packet), prompt);
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'Domain AI glitched — try again.' })); }

  const parsed = parseReply(out.text);
  // A structurally valid packet may still be neurologically ineligible to
  // reason (for example, absent or stale cognition). The model may explain
  // that condition, but it cannot steer/configure the browser brain until the
  // server packet says this domain can reason.
  const toolCalls = grounded.packet.readiness.canReason === true ? parsed.toolCalls : [];
  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true,
    domain: domain,
    answer: parsed.answer,
    toolCalls: toolCalls,
    left: Math.max(0, DAILY_CAP - rl.n),
    grounding: {
      schemaVersion: grounded.packet.schemaVersion,
      packetId: grounded.packet.packetId,
      sourcePacketId: grounded.packet.sourcePacketId,
      generatedAt: grounded.packet.generatedAt,
      canReason: grounded.packet.readiness.canReason,
      blockers: grounded.packet.readiness.blockers
    }
  }));
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.systemPrompt = systemPrompt;
module.exports.sanitizeToolCalls = sanitizeToolCalls;
module.exports.parseReply = parseReply;
