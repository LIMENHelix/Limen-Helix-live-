/**
 * handlers/master-agent.js — the MASTER operator AI box (unified consciousness).
 *
 * One level up from handlers/domain-agent.js. The browser contributes a display
 * projection, but the server independently reads the authoritative snapshot and
 * durable cognition stores before every provider call. This prevents an omitted,
 * stale, or modified browser projection from becoming the system's world model.
 *
 * OBSERVE / SYNTHESIZE ONLY. The master box does not steer or reconfigure individual
 * domains (that stays in each domain's own box — one place to change one domain), so it
 * emits no toolCalls. Reads and reasons; never acts.
 *
 * Cost discipline: admin-gated (anon = 403, no model call), Sonnet 5, short max_tokens,
 * ONE call per message, per-day Redis cap, kill-switch. Consciousness is recruited on
 * demand (operator prompt); the deterministic local synthesis runs for free client-side.
 *
 * POST /api/master-agent { passcode, prompt, models:[display-advisory summaries] }
 *   -> { ok, answer, left, evidence }
 */
const db = require('../lib/limen-db');
const masterBriefing = require('../lib/master-briefing-packet');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MASTER_AGENT_MODEL || process.env.DOMAIN_AGENT_MODEL || 'claude-sonnet-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_TOKENS = parseInt(process.env.MASTER_AGENT_MAX_TOKENS || '1200', 10);
const DAILY_CAP = parseInt(process.env.MASTER_AGENT_DAILY_CAP || '200', 10);

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
  const k = 'masteragent:rl:' + key + ':' + day;
  let n = 0; try { n = Number(await db.get(k)) || 0; } catch (e) {}
  if (n >= DAILY_CAP) return { ok: false, n: n };
  try { await db.set(k, n + 1); } catch (e) {}
  return { ok: true, n: n + 1 };
}
function clip(s, max) { s = String(s == null ? '' : s); return s.length > max ? s.slice(0, max) : s; }

function promptProjection(packet) {
  packet = packet || {};
  return {
    schemaVersion: packet.schemaVersion,
    packetId: packet.packetId,
    generatedAt: packet.generatedAt,
    authority: packet.authority,
    truthPolicy: packet.truthPolicy,
    freshness: packet.freshness,
    coverage: packet.coverage,
    readErrors: packet.readErrors,
    domains: (packet.domains || []).map(function (d) {
      var c = d.cognition || {};
      var se = c.semanticEvidence || {};
      return {
        domain: d.domain,
        serverObservation: d.serverObservation,
        cognition: {
          present: c.present,
          observedAt: c.observedAt,
          stale: c.stale,
          packetId: c.packetId,
          regulation: c.regulation,
          immune: c.immune,
          interoception: c.interoception,
          feedHealth: c.feedHealth,
          semanticEvidence: {
            status: se.status,
            reason: se.reason,
            observationsRead: se.observationsRead,
            retrievedAt: se.retrievedAt,
            authority: se.authority
          }
        },
        currentNewsFirst: d.investmentNewsReview,
        phaseContext: d.phaseContext,
        opportunities: d.opportunities,
        clientProjection: d.clientProjection
      };
    })
  };
}

function systemPrompt(packet) {
  var summary = '';
  try { summary = JSON.stringify(promptProjection(packet)); } catch (e) { summary = '{}'; }
  return [
    "You are LIMEN Helix's CIVILIZATION BRIEFING LAYER. You synthesize a read-only, server-built afferent packet across 20 sovereign domain brains for the operator. You are not the domains, you do not control them, and you are not evidence of autonomy. Calm, precise, concrete.",
    "",
    "SOURCE DISCIPLINE:",
    "- The packet was assembled on the server from console_snapshot, opportunities_snapshot, and durable per-domain cognition packets. Treat serverObservation and cognition as the available evidence. Treat clientProjection as display-advisory only; explicitly flag material client/server drift.",
    "- A semantic headline is an observed title with publisher/feed provenance, not a verified claim. Never infer that the article body was read. Publisher independence may be unassessed. Report freshness and abstentions.",
    "- A surfaced opportunity is an internal candidate, not a conclusion, investment recommendation, or authorization.",
    "- Never say LIMEN lacks external feeds when semantic evidence or feedHealth is present. Say exactly which domains/evidence are present, stale, absent, or abstaining.",
    "",
    "INTEROCEPTION:",
    "- Salience vocabulary is domain-owned: 'blind-channel', 'primary-only', 'financial-only', or 'aligned'. 'primary-only' means that domain's primary stress channel exceeds its other internal channels; do not relabel it as financial-only. These are observe-only internal divergences, not external truth and not action authority.",
    "- Do not call aligned domains trustworthy merely because internally derived channels agree. Agreement is not external validation.",
    "",
    "THING 2 — HARD AUTHORITY BOUNDARY:",
    "- phaseContext is Thing 2: a long-arc company-pattern snapshot used to identify POSSIBLE masking/alignment relative to the current stress read. Divergence means possible masking, never confirmed masking.",
    "- Thing 2 does not predict, confirm, rank, size, authorize, buy, sell, veto, or add confidence to any decision. Never call it ground truth, audited financials, an actionable signal, or a reason to trade. A grounded/divergent flag is context to inspect, never a decision lever.",
    "- Investment eligibility and distress claims require their own Thing 0/Thing 1 contracts where applicable; ordinary companies may still be researched through current performance, filings, price/market data, and company news without pretending Thing 2 decided anything.",
    "- When an investment candidate exists, present currentNewsFirst.currentNews BEFORE the Thing 2 possible-masking context. Then state whether the news supports, contradicts, or leaves masking unresolved. Domain-level headlines cannot confirm company-specific masking; without fresh exact-company news the result must remain UNCONFIRMED.",
    "",
    "WHAT YOU DO:",
    "- Give a daily or requested briefing from the packet: current stress/source/freshness, corroborating or conflicting observed headlines, internal regulation/immune divergence, candidate opportunities, missing evidence, and client/server drift.",
    "- Separate OBSERVED, INFERRED, CONTEXT-ONLY, and UNOBSERVED statements. Any causal story not present in evidence is an inference and must be labeled.",
    "- You have latitude to disagree with the operator or readout. Honesty is the job. This is voice, not action: you select nothing and trigger nothing.",
    "- Reply in plain prose, tight and useful. Do not manufacture alarm or reassurance.",
    "",
    "SERVER-BUILT CIVILIZATION EVIDENCE PACKET (JSON):",
    summary
  ].join('\n');
}

async function callClaude(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
    const _agBody = { model: MODEL, max_tokens: MAX_TOKENS, output_config: { effort: 'low' }, system: system, messages: [{ role: 'user', content: user }] };
  // Budget gate. Refusal here is a normal stop (out of budget / operator pause),
  // not an upstream failure, so it reports its own reason.
  const _agGuard = await require('../lib/anthropic-call').guard(_agBody, 'master-agent');
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

async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  if (require('../lib/ai-kill-switch').agentBoxesDisabled()) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, disabled: true, error: 'Operator AI boxes disabled (unset LIMEN_AGENT_BOXES_DISABLED to enable)' })); }
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Operator passcode required.' })); }
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Master AI not wired — ANTHROPIC_API_KEY is unset.' })); }

  const prompt = clip((body && body.prompt) || '', 1500).trim();
  if (!prompt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Empty prompt.' })); }

  const rl = await bumpRate(person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Daily limit reached — resets tomorrow.' })); }

  const modelsArr = Array.isArray(body && body.models) ? body.models.slice(0, 24) : [];
  const evidencePacket = await masterBriefing.build({ clientModels: modelsArr });
  const out = await callClaude(systemPrompt(evidencePacket), prompt);
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'Master AI glitched — try again.' })); }

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true,
    answer: String(out.text || '').trim(),
    left: Math.max(0, DAILY_CAP - rl.n),
    evidence: {
      packetId: evidencePacket.packetId,
      generatedAt: evidencePacket.generatedAt,
      freshness: evidencePacket.freshness,
      coverage: evidencePacket.coverage,
      readErrors: evidencePacket.readErrors
    }
  }));
}

module.exports = handler;
module.exports._test = { systemPrompt: systemPrompt, promptProjection: promptProjection };
