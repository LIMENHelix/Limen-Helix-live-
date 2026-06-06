/**
 * application-auditor.js — the master-brain auditor for grant/patent applications.
 *
 * Multi-AI: Grok RETRIEVES the funder's current hard rules → Anthropic AUDITS against
 * compliance + merit and can REWRITE into a compliant draft → OpenAI independently
 * CROSS-CHECKS for missed issues. Produces a score, categorized findings, a budget-math
 * check, and (on rewrite) a compliant draft — then drops it into an approve/sign queue.
 *
 * ADDITIVE: consumes application text only. Does not touch the doc-generation pipeline.
 *
 * Status pipeline (Redis `applications:audited`):
 *   audited → approved (you sign) → submitted (grants: you file; patents: Gmail outreach)
 */
const orch = require('../api/lib/ai-orchestrator');
const db = require('../api/lib/limen-db');

const KEY = 'applications:audited';

function _now() { return new Date().toISOString(); }
function _slug(s) { return String(s || 'app').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function _extractJson(t) {
  let s = (t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// best-effort deterministic budget check: sum $ line-items, compare to a stated total
function _budgetMath(text) {
  try {
    const nums = (String(text).match(/\$\s?[\d,]{3,}/g) || []).map(function (x) { return parseInt(x.replace(/[^\d]/g, ''), 10); }).filter(function (n) { return n > 0; });
    if (nums.length < 3) return null;
    const stated = Math.max.apply(null, nums);            // largest figure ~ the stated total
    const others = nums.filter(function (n) { return n !== stated; });
    const sum = others.reduce(function (a, b) { return a + b; }, 0);
    // crude: if the sum of the non-max figures is within 5% of the max, totals likely reconcile
    const consistent = Math.abs(sum - stated) <= stated * 0.05 || others.indexOf(stated) > -1;
    return { statedTotalGuess: stated, lineItemSumGuess: sum, likelyConsistent: consistent, note: 'heuristic — confirm against the real budget table' };
  } catch (e) { return null; }
}

// ── AUDIT: score + findings (multi-AI) ─────────────────────────────
async function audit(input) {
  input = input || {};
  if (!input.text || input.text.length < 200) return { ok: false, error: 'application text required' };
  const funder = input.funder || 'NSF';

  // Stage 1 · Grok retrieves current funder rules
  let rules = null, rulesProvider = null;
  try {
    const rr = await orch.call('RETRIEVE', { prompt: 'List the current HARD compliance rules for a ' + funder + ' proposal that cause return-without-review or ineligibility: required documents/sections, page limits, cost-sharing policy, applicant eligibility, indirect-cost (de minimis) rules, submission system, human-subjects/IRB. Terse factual bullets, current.', maxTokens: 700 });
    if (rr.ok) { rules = rr.text.trim().slice(0, 2200); rulesProvider = rr.provider; }
  } catch (e) {}

  // Stage 2 · Anthropic deep audit
  const system = 'You are a senior ' + funder + ' proposal reviewer AND grants administrator. Audit the proposal for BOTH compliance (return-without-review risks) and merit. Be exacting: catch budget-math errors, prohibited cost-share, program/mechanism confusion, applicant eligibility, missing required documents, page/format, human-subjects/IRB, weak team. '
    + 'Keep each issue/fix to ONE sentence so the JSON stays small and valid. '
    + 'Output STRICT JSON only: {"score":0-100,"readiness":"return-without-review|major-revisions|minor-revisions|submittable","recommendedProgram":"","fatal":[{"issue":"","fix":""}],"merit":[{"issue":"","fix":""}],"missingDocs":["",""],"budgetCheck":{"statedTotal":"","computedTotal":"","consistent":true,"notes":""},"strengths":["",""],"humanMustSupply":["e.g. PI credentials, co-PI/IRB, EIN"]}';
  const prompt = 'FUNDER: ' + funder + (rules ? ('\nCURRENT RULES (verify against these):\n' + rules) : '') + '\n\nPROPOSAL:\n' + String(input.text).slice(0, 16000);
  const a = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 4500 });
  if (!a.ok) return { ok: false, error: 'audit failed: ' + a.error, budget: a.budget || null };
  const parsed = _extractJson(a.text) || { score: null, readiness: 'unknown', raw: a.text.slice(0, 2000) };

  // Stage 3 · OpenAI independent cross-check
  let secondPass = null, verifyProvider = null;
  try {
    const vr = await orch.call('VERIFY', { prompt: 'You are a second, independent ' + funder + ' reviewer. List up to 5 MATERIAL compliance/merit issues the first audit MISSED, or reply "NONE". Proposal:\n' + String(input.text).slice(0, 8000) + '\n\nFirst audit findings:\n' + JSON.stringify(parsed).slice(0, 1800), maxTokens: 500 });
    if (vr.ok) { secondPass = vr.text.trim().slice(0, 900); verifyProvider = vr.provider; }
  } catch (e) {}

  const rec = {
    id: input.id || (_slug(input.title || funder) + '-' + Date.now()),
    funder: funder, title: input.title || (parsed.recommendedProgram || funder + ' application'),
    createdAt: _now(), status: 'audited',
    score: parsed.score, readiness: parsed.readiness,
    audit: parsed, secondPass: secondPass, budgetMath: _budgetMath(input.text),
    sourceText: String(input.text).slice(0, 40000),
    provenance: { rules: rulesProvider, audit: a.provider, verify: verifyProvider }
  };
  await db.lpush(KEY, rec);
  await db.ltrim(KEY, 0, 200);
  return { ok: true, application: rec };
}

// ── REWRITE: produce a compliant draft incorporating the fixes (Anthropic) ──
async function rewrite(input) {
  input = input || {};
  if (!input.text || input.text.length < 200) return { ok: false, error: 'application text required' };
  const funder = input.funder || 'NSF';
  const program = input.program || '';
  const system = 'You are an expert ' + funder + ' proposal writer. Rewrite the proposal into a COMPLIANT ' + program + ' draft. '
    + 'Fix: budget math (must total correctly), remove prohibited voluntary cost-share, use the 10% de minimis indirect rate unless told otherwise, restructure into the required sections (Project Summary with explicit Overview/Intellectual Merit/Broader Impacts; Project Description; Data Management Plan; Budget + Budget Justification), and right-size causal claims to exploratory given small N. '
    + 'KEEP the strong core idea and the real citations. Where the human must supply real facts (PI name/credentials, co-PI, partner institution, IRB of record, EIN, exact dollar figures), insert a clearly marked [[PLACEHOLDER: ...]] — never invent credentials. Output clean Markdown.';
  const prompt = 'FUNDER: ' + funder + (program ? ('\nTARGET PROGRAM: ' + program) : '') + (input.fixes ? ('\nFIXES TO APPLY:\n' + input.fixes) : '') + '\n\nORIGINAL PROPOSAL:\n' + String(input.text).slice(0, 16000);
  const r = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 8000 });
  if (!r.ok) return { ok: false, error: 'rewrite failed: ' + r.error, budget: r.budget || null };
  return { ok: true, draft: r.text, provider: r.provider, tokens: { in: r.tokensIn, out: r.tokensOut } };
}

async function list(limit) { return await db.lrange(KEY, 0, (limit || 50) - 1); }

async function setStatus(id, status, extra) {
  const all = await list(200);
  const item = all.find(function (x) { return x.id === id; });
  if (!item) return { ok: false, error: 'application not found' };
  await db.set('applications:status:' + id, Object.assign({ status: status, at: _now() }, extra || {}));
  return { ok: true, id: id, status: status };
}

module.exports = { audit, rewrite, list, setStatus };
