/**
 * ai-kill-switch.js — global paid-AI billing kill switch.
 *
 * Set 2026-06-26 per operator: STOP all paid-AI (Anthropic / OpenAI / Grok / ElevenLabs) billing.
 *
 * AI is DISABLED by default. It is only enabled when the env var LIMEN_AI_ENABLED === '1'.
 * That env var is NOT set, so every guarded call short-circuits before any provider request —
 * zero tokens, zero billing. No API keys were removed (encrypted keys can be unrecoverable), so
 * re-enabling is a one-step env change in Vercel (set LIMEN_AI_ENABLED=1), no key regeneration.
 *
 * Guarded sites: lib/ai-orchestrator.js (covers capital-engine, pattern-author, long-form-generator,
 * refresh-pipeline, application-auditor, stream-ops, trigger-pattern-author) + the direct callers
 * enrich-portal-claude, expand-artifact-claude, music-coach, hook-studio, limen-reciprocity-prose-rewrite.
 */
function aiDisabled() {
  return process.env.LIMEN_AI_ENABLED !== '1';
}

// Operator AGENT BOXES (domain-agent / master-agent / energy-agent) are a special case:
// each is admin-passcode-gated (anon = 403, no model call) + per-day Redis-capped, so the
// ONLY way to spend is the operator sending a message = pay-per-use, operator-only. They are
// therefore enabled by default and gated SEPARATELY from the global paid-AI kill switch, so
// the operator can use their boxes WITHOUT re-opening autonomous or public artifact-AI spend
// (which stay killed by aiDisabled() with LIMEN_AI_ENABLED unset). Kill the boxes too by
// setting LIMEN_AGENT_BOXES_DISABLED=1. (2026-07-08, per operator: "on if it isn't charged
// unless used" — the boxes satisfy that; the global switch does not.)
function agentBoxesDisabled() {
  return process.env.LIMEN_AGENT_BOXES_DISABLED === '1';
}

var DISABLED_RESPONSE = { ok: false, disabled: true, error: 'AI is disabled (billing stopped per operator). Set LIMEN_AI_ENABLED=1 to re-enable.' };

module.exports = { aiDisabled: aiDisabled, agentBoxesDisabled: agentBoxesDisabled, DISABLED_RESPONSE: DISABLED_RESPONSE };
