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
const fs = require('node:fs');
const path = require('node:path');
const orch = require('./ai-orchestrator');
const db = require('./limen-db');

const KEY = 'applications:audited';
const RUBRIC = path.join(__dirname, '..', 'assets', 'data', 'review-rubric.json');
function _rubric() { try { return JSON.parse(fs.readFileSync(RUBRIC, 'utf8')); } catch (e) { return { lessons: [] }; } }

function _now() { return new Date().toISOString(); }
function _slug(s) { return String(s || 'app').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
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
// last-resort: regex-pull the key fields so the score/findings still render on truncation
function _salvage(text) {
  const out = {};
  const sc = text.match(/"score"\s*:\s*(\d+)/); if (sc) out.score = parseInt(sc[1], 10);
  const rd = text.match(/"readiness"\s*:\s*"([^"]+)"/); if (rd) out.readiness = rd[1];
  const rp = text.match(/"recommendedProgram"\s*:\s*"([^"]*)"/); if (rp) out.recommendedProgram = rp[1];
  const pairs = [];
  const re = /"issue"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"fix"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let mm; while ((mm = re.exec(text)) && pairs.length < 10) pairs.push({ issue: mm[1], fix: mm[2] });
  if (pairs.length) out.fatal = pairs;
  return out;
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
  const a = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 6000 });
  if (!a.ok) return { ok: false, error: 'audit failed: ' + a.error, budget: a.budget || null };
  let parsed = _extractJson(a.text) || {};
  const sal = _salvage(a.text);
  if (parsed.score == null && sal.score != null) parsed.score = sal.score;
  if (!parsed.readiness && sal.readiness) parsed.readiness = sal.readiness;
  if (!parsed.recommendedProgram && sal.recommendedProgram) parsed.recommendedProgram = sal.recommendedProgram;
  if ((!parsed.fatal || !parsed.fatal.length) && sal.fatal) parsed.fatal = sal.fatal;
  if (!parsed.readiness) parsed.readiness = 'unknown';

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
  const r = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 16000 });
  if (!r.ok) return { ok: false, error: 'rewrite failed: ' + r.error, budget: r.budget || null };
  const truncated = (r.raw && r.raw.stop_reason === 'max_tokens') || false;
  return { ok: true, draft: r.text, truncated: truncated, provider: r.provider, tokens: { in: r.tokensIn, out: r.tokensOut } };
}

async function list(limit) { return await db.lrange(KEY, 0, (limit || 50) - 1); }

async function setStatus(id, status, extra) {
  const all = await list(200);
  const item = all.find(function (x) { return x.id === id; });
  if (!item) return { ok: false, error: 'application not found' };
  await db.set('applications:status:' + id, Object.assign({ status: status, at: _now() }, extra || {}));
  return { ok: true, id: id, status: status };
}

// ── ADVERSARIAL REVIEW: a hostile reviewer tears the doc apart vs the lessons rubric ──
// ONE AI call, kept separate from audit() so we never pile calls into one HTTP request (the 504 lesson).
async function adversarialReview(input) {
  input = input || {};
  if (!input.text || input.text.length < 200) return { ok: false, error: 'text required (the document to tear apart)' };
  const funder = input.funder || 'NSF';
  const lane = (input.lane || 'grant').toLowerCase();
  const lessons = (_rubric().lessons || []).filter(function (l) {
    const ln = l.lane || 'all';
    return ln === 'all' || ln.split('|').indexOf(lane) > -1;
  });
  const system = 'You are a HOSTILE, highly experienced ' + funder + ' reviewer who has already decided to DECLINE this proposal and must justify it. Tear it apart. Include a teardown entry ONLY for rubric lessons that ACTUALLY apply to THIS document (skip the ones it passes) — quote the offending text, rate severity, give the exact fix. Keep each finding and fix to ONE sentence. Be uncharitable; assume the worst-case skeptical reviewer. Separately raise any INTEGRITY problem: results stated as validated/proven that are not clearly reproducible. '
    + 'Output ONLY the JSON object — no preamble, no markdown fences: {"gate":"block|major-revise|minor-revise|pass","teardown":[{"lesson":"<id>","severity":"critical|high|medium|low","finding":"","fix":""}],"integrityFlags":["..."],"topThreeFixes":["","",""]}';
  const prompt = 'FUNDER: ' + funder + ' | LANE: ' + lane + '\n\nRUBRIC (apply only the ones that fit):\n'
    + lessons.map(function (l) { return '- [' + l.id + ' / ' + l.severity + '] ' + l.check + '  FIX: ' + l.fix; }).join('\n')
    + '\n\nDOCUMENT:\n' + String(input.text).slice(0, 16000);
  const r = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 8000 });
  if (!r.ok) return { ok: false, error: 'adversarial review failed: ' + r.error, budget: r.budget || null };
  let review = _extractJson(r.text);
  if (!review) {
    // Salvage: pull at least the gate + any fixes from truncated/imperfect output, so the operator
    // still gets a verdict instead of a useless "unknown". Default gate = major-revise (never silently pass).
    const g = (r.text.match(/"gate"\s*:\s*"([^"]+)"/) || [])[1];
    const fixes = (r.text.match(/"fix"\s*:\s*"([^"]{3,200})"/g) || [])
      .map(function (s) { return (s.match(/"fix"\s*:\s*"([^"]+)"/) || [])[1]; }).filter(Boolean).slice(0, 5);
    review = { gate: g || 'major-revise', salvaged: true, topThreeFixes: fixes, raw: r.text.slice(0, 2000),
               note: g ? 'parsed from partial output (response was truncated)' : 'unparseable output — defaulted to major-revise; see raw' };
  }
  return { ok: true, review: review, provider: r.provider, rubricApplied: lessons.length, stopReason: r.stopReason || r.stop_reason || null };
}

// ── LANE-FIT SCORER: the loose gate. Scores a card 0-10 per lane EXACTLY like the
// operator's manual rubric, runs the 3 pre-gates, types the card, and routes to the
// qualifying lanes (>=6/10). ONE AI call (separate, per the 504 lesson). It SHOWS which
// gate(s) to go through; the per-lane rendering happens downstream (print-from-pattern).
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

module.exports = { audit, rewrite, list, setStatus, adversarialReview, scoreLanes, _rubric };
