/**
 * application-auditor.js — per-lane routing scorer (investment + research ONLY).
 *
 * RETIRED 2026-06-21: the grant/patent application apparatus (audit / rewrite / approve /
 * submit / adversarial-review + patent-packager) is gone — LIMEN runs only the investment
 * and research lanes. What remains is scoreLanes(card): the "calculus" the pattern-proposals
 * page reads, scoring a brain<->business pattern card for investment/research fit only.
 * Budget-gated via ai-orchestrator.
 */
const orch = require('./ai-orchestrator');

function _extractJson(t) {
  let s = (t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  // repair attempt: balance braces/brackets on a truncated object
  const start = s.indexOf('{');
  if (start > -1) {
    let frag = s.slice(start).replace(/,\s*$/, '').replace(/:\s*"[^"]*$/, ':""');
    const opens = (frag.match(/\{/g) || []).length, closes = (frag.match(/\}/g) || []).length;
    const bo = (frag.match(/\[/g) || []).length, bc = (frag.match(/\]/g) || []).length;
    frag += ']'.repeat(Math.max(0, bo - bc)) + '}'.repeat(Math.max(0, opens - closes));
    try { return JSON.parse(frag); } catch (e) {}
  }
  return null;
}

// SCORE-LANES: score a pattern card for the TWO live lanes (investment + research) only.
async function scoreLanes(card) {
  if (!card || (typeof card === 'object' && !Object.keys(card).length)) return { ok: false, error: 'card required' };
  const system = 'You are the LIMEN per-lane routing scorer. Score a brain<->business pattern card for fit against the TWO live capital lanes — investment and research ONLY. Patent, grant, and loan/SBA lanes are RETIRED: never score, route to, or suggest them. Be specific and skeptical; do not inflate.\n\n'
    + 'PER-LANE CRITERIA (score each 0-10):\n'
    + '- research: publishable methodology with a NAMED design (DiD, Cox PH, event study, panel regression, synthetic control) AND data ON the current stack (SEC EDGAR, FRED, BLS, EIA, Treasury, USASpending, Form 4/13F). Off-stack data (IQVIA, Symphony, Definitive, internal telemetry) lowers the score and must be flagged.\n'
    + '- investment: testable thesis with computable signals on the current stack, a clear direction (long/short/pair), and a catalyst. Vague "mispriced" scores low.\n\n'
    + 'THREE PRE-GATES (each pass/fail + reason):\n'
    + '- existenceAudit: are all named entities, citations, recall numbers, and segment names real/verifiable? Fail if any looks fabricated or unverifiable.\n'
    + '- steelman: does the card rule out the rational, non-pathological explanation? Fail if it commits to a pathology reading without one.\n'
    + '- dataFeasibility: are the indicators computable on the current stack? Fail if core signals need off-stack data with no plan.\n\n'
    + 'DECISION RULE: keep if investment OR research scores >=6; else reject. Route ONLY to lanes scoring >=6.\n\n'
    + 'Output STRICT JSON only: {"lanes":{"research":{"score":0,"rationale":""},"investment":{"score":0,"rationale":""}},"gates":{"existenceAudit":{"pass":true,"reason":""},"steelman":{"pass":true,"reason":""},"dataFeasibility":{"pass":true,"reason":""}},"verdict":"keep","route":["research"],"topFixes":["",""]}';
  const prompt = 'CARD:\n' + (typeof card === 'string' ? card : JSON.stringify(card)).slice(0, 12000);
  const r = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 2500 });
  if (!r.ok) return { ok: false, error: 'lane scoring failed: ' + r.error, budget: r.budget || null };
  let scoring = _extractJson(r.text);
  if (!scoring) scoring = { verdict: 'unknown', raw: r.text.slice(0, 1500) };
  // Enforce the decision rule deterministically (don't trust the model's verdict/route blindly).
  if (scoring.lanes) {
    const route = Object.keys(scoring.lanes).filter(function (k) { return (scoring.lanes[k] && scoring.lanes[k].score) >= 6; });
    scoring.route = route;
    scoring.verdict = route.length ? 'keep' : 'reject';
  }
  return { ok: true, scoring: scoring, provider: r.provider };
}

module.exports = { scoreLanes };
