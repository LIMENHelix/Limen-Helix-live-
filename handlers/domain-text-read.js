/**
 * handlers/domain-text-read.js — READ THE TEXT WE ALREADY FETCH.
 *
 *   GET /api/domain-text-read                → stored readings (open, no spend)
 *   GET /api/domain-text-read?domain=energy  → one stored reading
 *   GET /api/domain-text-read?run=1          → produce fresh readings (spends, token-gated)
 *   GET /api/domain-text-read?run=1&dry=1    → build the prompts, call nothing, show what would go
 *
 * WHY (2026-07-29). handlers/domain-snapshot.js pulls 275 sources and ~490 real headlines every
 * cycle — Vatican News, USCIRF and Pew for religion; DOJ, SEC and CFPB for law — and the system
 * reduces all of it to an INTEGER COUNT of articles. Meanwhile it reconstructs "is this domain
 * stressed" from company fundamentals that update quarterly. Thirteen of twenty domains recorded
 * one distinct value across 202 samples while the text that says what is actually happening was
 * fetched and discarded on every run. That is the waste this closes.
 *
 * THE ARCHITECTURE RULE IS RESPECTED AS WRITTEN. CLAUDE.md keeps paid AI off the 30-second
 * regulation cycle and behind the kill switch. It does not say the afferent layer must be
 * text-blind. This runs on a slow cron, well off that loop, routes through lib/anthropic-call
 * (which checks lib/ai-kill-switch BEFORE the budget and fails closed), and hands the
 * deterministic loop a plain number it can use without ever calling a model itself.
 *
 * CONFABULATION IS THE KNOWN FAILURE MODE, so it is checked mechanically rather than trusted.
 * Earlier work in this repo found attached LLMs inventing causes. Every driver the model returns
 * must carry BOTH a headline index and a VERBATIM quote from that headline. The quote is
 * substring-checked against the actual text before the driver is kept. A driver that cites a
 * headline that does not exist, or quotes words that are not in it, is DROPPED. If nothing
 * survives verification the domain ABSTAINS rather than publishing an unsupported number.
 * Fabrication is therefore detectable and discarded, not merely discouraged by the prompt.
 *
 * The model is Haiku: this is extraction and grading against supplied evidence, not open
 * reasoning, and the small model is the right tool for it at a twentieth of the cost.
 */

var db = require('../lib/limen-db');
var anthropic = require('../lib/anthropic-call');
var DOMAIN_NAMES = require('../lib/domain-names');

var MODEL = 'claude-haiku-4-5-20251001';
var MAX_HEADLINES = 30;          // per domain, newest first
var MIN_HEADLINES = 3;           // below this there is nothing to read — abstain
var MAX_TOKENS = 700;
var STORE_KEY = 'domain:textread';
var HIST_CAP = 120;
var TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || '';   // same operator switch that gates durable learning

var SNAPSHOT_URL = 'https://limenhelix.com/api/domain-snapshot?domain=religion';

function buildPrompt(domain, headlines) {
  var numbered = headlines.map(function (h, i) { return '[' + i + '] ' + h.text + '  (source: ' + h.source + ')'; }).join('\n');
  return 'You are reading news headlines for the "' + domain + '" domain of a monitoring system.\n\n' +
    'HEADLINES:\n' + numbered + '\n\n' +
    'Assess how STRESSED this domain is right now, based ONLY on these headlines.\n\n' +
    'Return ONLY valid JSON, no prose, in exactly this shape:\n' +
    '{"score": <0.0-1.0>, "confidence": <0.0-1.0>, "summary": "<one sentence>",\n' +
    ' "drivers": [{"index": <headline number>, "quote": "<VERBATIM words copied from that headline>", "why": "<short reason>"}],\n' +
    ' "abstain": <true|false>}\n\n' +
    'RULES:\n' +
    '- score 0 = calm, 1 = acute distress. Judge the DOMAIN, not the tone of the writing.\n' +
    '- Every driver MUST cite a headline index that exists above, and "quote" MUST be words copied\n' +
    '  EXACTLY from that headline. Quotes are checked against the source text and any driver whose\n' +
    '  quote does not appear verbatim is discarded.\n' +
    '- Give 1 to 5 drivers. Do not invent events that are not in the headlines.\n' +
    '- If these headlines do not support a stress judgement, set "abstain": true and give no score.\n' +
    '- Routine or promotional coverage is NOT stress. Absence of bad news is low stress, not high.';
}

/** Keep only drivers whose quote actually appears in the headline they cite. */
function verifyDrivers(drivers, headlines) {
  var kept = [], dropped = [];
  (Array.isArray(drivers) ? drivers : []).forEach(function (d) {
    var i = parseInt(d && d.index, 10);
    var q = (d && typeof d.quote === 'string') ? d.quote.trim() : '';
    if (!isFinite(i) || i < 0 || i >= headlines.length) { dropped.push({ reason: 'index out of range', driver: d }); return; }
    if (q.length < 8) { dropped.push({ reason: 'quote too short to verify', driver: d }); return; }
    var hay = String(headlines[i].text || '').toLowerCase().replace(/\s+/g, ' ');
    var needle = q.toLowerCase().replace(/\s+/g, ' ');
    if (hay.indexOf(needle) === -1) { dropped.push({ reason: 'quote not found in cited headline', driver: d, headline: headlines[i].text }); return; }
    kept.push({ index: i, quote: q, why: String(d.why || '').slice(0, 200), headline: headlines[i].text, source: headlines[i].source });
  });
  return { kept: kept, dropped: dropped };
}

function extractJson(text) {
  if (!text) return null;
  var m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

async function readDomain(domain, headlines, dry) {
  if (!headlines || headlines.length < MIN_HEADLINES) {
    return { domain: domain, abstained: true, reason: 'only ' + (headlines ? headlines.length : 0) + ' headlines — below the minimum to read', score: null };
  }
  var prompt = buildPrompt(domain, headlines);
  if (dry) return { domain: domain, dryRun: true, headlines: headlines.length, promptChars: prompt.length, score: null };

  var res = await anthropic.callAnthropic({
    label: 'domain-text-read:' + domain,
    timeoutMs: 40000,
    body: { model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }
  });
  if (!res.ok) {
    return { domain: domain, abstained: true, score: null,
      reason: res.disabled ? 'AI disabled or paused by the operator' : (res.refused ? ('budget refused: ' + res.reason) : ('call failed: ' + (res.detail || 'unknown'))) };
  }
  var parsed = extractJson(res.text);
  if (!parsed) return { domain: domain, abstained: true, score: null, reason: 'model returned unparseable output' };
  if (parsed.abstain === true) return { domain: domain, abstained: true, score: null, reason: 'model abstained: headlines do not support a reading', headlines: headlines.length };

  var v = verifyDrivers(parsed.drivers, headlines);
  if (!v.kept.length) {
    // Every driver failed verification. The score may be right, but nothing supports it, and an
    // unsupported number is exactly what this design exists to refuse.
    return { domain: domain, abstained: true, score: null, reason: 'no driver survived citation verification',
      droppedCount: v.dropped.length, dropped: v.dropped.slice(0, 3), headlines: headlines.length };
  }
  var score = Number(parsed.score);
  if (!isFinite(score)) return { domain: domain, abstained: true, score: null, reason: 'model returned no usable score' };

  return {
    domain: domain, abstained: false,
    score: Math.max(0, Math.min(1, score)),
    confidence: isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : null,
    summary: String(parsed.summary || '').slice(0, 300),
    drivers: v.kept,
    driversDropped: v.dropped.length,
    headlines: headlines.length,
    model: MODEL,
    usage: res.usage ? { in: res.usage.input_tokens, out: res.usage.output_tokens } : null
  };
}

/** Pull the headlines the snapshot already fetched, grouped by domain. */
async function loadHeadlines() {
  var r = await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) return null;
  var j = await r.json();
  var out = {};
  var doms = (j && j.domains) || {};
  for (var d in doms) {
    if (!Object.prototype.hasOwnProperty.call(doms, d)) continue;
    var list = [];
    (doms[d].sources || []).forEach(function (s) {
      (s.headlines || []).forEach(function (h) {
        if (typeof h === 'string' && h.trim()) list.push({ text: h.trim(), source: s.name });
      });
    });
    out[d] = list.slice(0, MAX_HEADLINES);
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('content-type', 'application/json');
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  // READ PATH — open, no spend.
  if (!q.run) {
    var stored = (await db.get(STORE_KEY)) || null;
    if (q.domain) {
      var k = DOMAIN_NAMES.toRuntime(q.domain);
      var one = stored && stored.domains ? stored.domains[k] : null;
      return res.status(200).json({ ok: true, domain: k, reading: one || null, generatedAt: stored ? stored.generatedAt : null });
    }
    return res.status(200).json({ ok: true, stored: stored || null });
  }

  // RUN PATH — spends. Gated on the same operator switch as durable learning.
  var dry = !!q.dry;
  if (!dry && !TOKEN) {
    return res.status(200).json({ ok: false, mode: 'compute-only', reason: 'BRAIN_WEIGHTS_TOKEN not set — refusing to spend' });
  }
  var byDomain;
  try { byDomain = await loadHeadlines(); }
  catch (e) { return res.status(200).json({ ok: false, error: 'could not load headlines: ' + e.message }); }
  if (!byDomain) return res.status(200).json({ ok: false, error: 'snapshot unavailable' });

  var only = q.domain ? [DOMAIN_NAMES.toRuntime(q.domain)] : Object.keys(byDomain);
  var out = {}, read = 0, abstained = 0, inTok = 0, outTok = 0;
  for (var i = 0; i < only.length; i++) {
    var d = only[i];
    var r2;
    try { r2 = await readDomain(d, byDomain[d] || [], dry); }
    catch (e) { r2 = { domain: d, abstained: true, score: null, reason: 'read threw: ' + e.message }; }
    out[d] = r2;
    if (r2.abstained) abstained++; else read++;
    if (r2.usage) { inTok += r2.usage.in || 0; outTok += r2.usage.out || 0; }
  }

  var payload = { generatedAt: Date.now(), model: MODEL, domains: out,
    counts: { read: read, abstained: abstained }, usage: { inputTokens: inTok, outputTokens: outTok } };
  if (!dry) {
    try {
      await db.set(STORE_KEY, payload);
      await db.lpush(STORE_KEY + ':hist', { t: payload.generatedAt, read: read, abstained: abstained });
      await db.ltrim(STORE_KEY + ':hist', 0, HIST_CAP - 1);
    } catch (e) { /* storage failure must not lose the reading in the response */ }
  }
  return res.status(200).json(Object.assign({ ok: true, mode: dry ? 'dry-run' : 'run' }, payload));
};

module.exports = require('../lib/heartbeat').wrap('domain-text-read', module.exports);
