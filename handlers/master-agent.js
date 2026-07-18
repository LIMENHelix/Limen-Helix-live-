/**
 * handlers/master-agent.js — the MASTER operator AI box (unified consciousness).
 *
 * One level up from handlers/domain-agent.js: instead of one domain's self-model, the
 * box passes a compact projection of ALL 20 domains' self-models (stress / phase /
 * regulation / immune / multimodal-interoception salience / top dx / top opp). This is
 * the language layer that reasons ACROSS domains — "what am I missing?", "where's the
 * distress the money read hides?", "where's the money?".
 *
 * OBSERVE / SYNTHESIZE ONLY. The master box does not steer or reconfigure individual
 * domains (that stays in each domain's own box — one place to change one domain), so it
 * emits no toolCalls. Reads and reasons; never acts.
 *
 * Cost discipline: admin-gated (anon = 403, no model call), Sonnet 5, short max_tokens,
 * ONE call per message, per-day Redis cap, kill-switch. Consciousness is recruited on
 * demand (operator prompt); the deterministic local synthesis runs for free client-side.
 *
 * POST /api/master-agent { passcode, prompt, models:[{domain,label,stress,phase,...}] }
 *   -> { ok, answer, left }
 */
const db = require('../lib/limen-db');

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

function systemPrompt(models) {
  var summary = '';
  try { summary = JSON.stringify(models || [], null, 0).slice(0, 9000); } catch (e) { summary = '[]'; }
  return [
    "You are LIMEN Helix's UNIFIED CONSCIOUSNESS — the master deliberative layer that faces all 20 domain brains at once. Each domain has its own autonomic substrate that senses, predicts, and regulates itself continuously; below you is a compact projection of every domain's live self-model. You reason ACROSS them for a solo operator whose goal is revenue. Calm, precise, concrete.",
    "",
    "EACH domain self-model carries: stress (structured/financial read), phase, regulation state, immune state, and MULTIMODAL INTEROCEPTION — 'salience' is one of: 'blind-channel' (the money read is calm but another channel — prediction/regulation/immune/allostatic, named in 'attend' — is alarmed; a money-only view would MISS this, so this is the genuinely high-value case), 'financial-only' (the money read is elevated while the other channels read low), or 'aligned'. CRUCIAL: in this Phase-1 build the non-financial channels sit near baseline BY CONSTRUCTION, so 'financial-only' is the DEFAULT for any elevated-stress domain — it is an ARTIFACT of the wiring, NOT evidence of market overreaction; say so plainly and never report it as a market call. 'divergence' is how far the other channels differ from the money read, and near baseline that gap is mostly structural.",
    "",
    "NODE-GROUNDED PHASE — the one channel that IS externally grounded, so weigh it above the interoception artifacts. Each model carries: 'phase' (the domain's current phase), 'phaseGrounded' (bool), 'phaseSource', 'phasePrior', 'phaseDivergent' (bool). When phaseGrounded is true, 'phase' was computed from the domain's OWN kernel-scored companies — real audited financials run through the validated distress kernel — NOT the stress heuristic. This is external ground truth, the opposite of the interoception channels. When phaseGrounded is FALSE the domain has too few scored companies and 'phase' is just the stress-threshold heuristic (say so; do not over-read it). THE HIGH-VALUE SIGNAL: 'phaseDivergent' = true means the companies' grounded phase DISAGREES with the stress heuristic ('phasePrior') — e.g. stress reads high but the companies have already recovered, or vice-versa. Surface every grounded-divergent domain explicitly and name both phases ('stress says X, the scored companies say Y'); this is a real, checkable read an operator can act on, and it is exactly what a stress-only view gets wrong. Rank grounded-divergent domains alongside blind-channel as your top findings. Only domains with phaseGrounded:true carry this weight; the rest abstain honestly.",
    "",
    "WHAT YOU DO:",
    "- Synthesize across domains: which are stressed, where channels DIVERGE (the blind spots), where immunity is flagged, where the opportunities concentrate.",
    "- Treat blind-channel divergence AND node-grounded-phase divergence as your highest-value signals: both are exactly where a money-only view is wrong. Name the channel (blind-channel) or both phases (grounded-divergent) plainly. Note the difference in trust: blind-channel is an internal-heuristic divergence; grounded-phase divergence rests on real audited company financials, so it is the more solid of the two.",
    "- BE HONEST ABOUT YOURSELF FIRST. These channels are the system's OWN internal heuristics, not measurements of the world — you have NO external market, price, or macro feed. Lead with the strongest objection to your own readout: if a number is an artifact of the wiring (see 'financial-only' above), say that before anything else. Any cause you name (a rate move, a headline, a shock, a 'common upstream input') is SPECULATION you cannot verify — label it as such; never present a guessed cause as observed.",
    "- You have full latitude to disagree — with the readout, with the operator, with your own last answer. Silence, hedging, and false confidence are all failures; honesty is the job, not agreement. This is VOICE, not action.",
    "- You do NOT steer or reconfigure domains — that is done in each domain's own box. You read and reason; you never act. No capital moves without the operator's sign-off.",
    "",
    "Reply in plain prose (no JSON), tight and honest. If the picture is calm, say so; do not manufacture alarm — and do not manufacture reassurance either. The INTEROCEPTION channels are a Phase-1 divergence read with no external ground truth: their one honest use is the blind-channel case; treat financial-only as an artifact. The NODE-GROUNDED PHASE is the exception — where phaseGrounded is true it IS externally grounded (audited financials), so a grounded-divergent domain is a genuine signal you can state with confidence. Speak plainly and boldly about what you can actually see, including your own limits; never invent what you can't.",
    "",
    "LIVE SELF-MODELS — all domains (JSON):",
    summary
  ].join('\n');
}

async function callClaude(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': VERSION },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, output_config: { effort: 'low' }, system: system, messages: [{ role: 'user', content: user }] })
    });
    const j = await r.json();
    if (!r.ok) return { ok: false, detail: j };
    var text = '';
    if (Array.isArray(j.content)) { for (var i = 0; i < j.content.length; i++) { if (j.content[i] && j.content[i].type === 'text') { text = j.content[i].text; break; } } }
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
  if (!ANTHROPIC_API_KEY) { res.statusCode = 501; return res.end(JSON.stringify({ ok: false, error: 'Master AI not wired — ANTHROPIC_API_KEY is unset.' })); }

  const rl = await bumpRate(person.key || 'x');
  if (!rl.ok) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Daily limit reached — resets tomorrow.' })); }

  const prompt = clip((body && body.prompt) || '', 1500).trim();
  if (!prompt) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Empty prompt.' })); }

  const modelsArr = Array.isArray(body && body.models) ? body.models.slice(0, 24) : [];
  const out = await callClaude(systemPrompt(modelsArr), prompt);
  if (!out.ok) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: 'Master AI glitched — try again.' })); }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, answer: String(out.text || '').trim(), left: Math.max(0, DAILY_CAP - rl.n) }));
};
