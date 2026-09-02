/**
 * relay-autonomous-scraper.js — the Relay 24/7 tick.
 *
 * Wired to the cron in vercel.json: /api/relay-autonomous-scraper?run=1 at 5,35 * * * *.
 *
 *   GET  ?run=1     run one cycle (cron or operator key)
 *   GET  (no args)  status: mode, today's spend, the last cycles. Safe, read-only, no spend.
 *
 * REWRITTEN 2026-08-30. The previous version built its listings by POSTing to
 * http://localhost:3000/api/relay-marketplace. Inside a Vercel function that address is
 * the function's own loopback with nothing listening on port 3000, so every request
 * failed and the cron had been running twice an hour creating nothing. The pipeline now
 * runs in-process through lib/relay-engine.
 *
 * EXECUTION IS GATED. A cycle calls paid APIs (xAI image generation, SerpAPI search) and
 * can queue real purchases, so an anonymous GET must not be able to trigger one. Cron
 * identity, or RELAY_ADMIN_KEY, or nothing happens.
 */

const engine = require('../lib/relay-engine');
const autonomy = require('../lib/relay-autonomy');

function j(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  let u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }

  // FAILS CLOSED. Per Vercel's own documentation x-vercel-cron is informational only —
  // it names which schedule fired — and the sole trusted mechanism is CRON_SECRET
  // compared against the Authorization: Bearer header Vercel provisions. Any external
  // caller can set x-vercel-cron themselves, so the previous fallback made a cycle that
  // spends on paid APIs and can queue purchases reachable by an unauthenticated POST.
  // No secret configured now means no cron identity, not a free pass.
  const isCron = !!(process.env.CRON_SECRET && req.headers &&
    req.headers['authorization'] === 'Bearer ' + process.env.CRON_SECRET);

  const ADMIN = process.env.RELAY_ADMIN_KEY || process.env.RELAY_MARGIN_KEY || '';
  const key = u.searchParams.get('key') || (req.headers && req.headers['x-relay-key']) || '';
  const isOperator = !!(ADMIN && key === ADMIN);

  const wantsRun = u.searchParams.get('run') === '1' || isCron;

  if (!wantsRun) {
    const st = await autonomy.status();
    return j(res, 200, {
      ok: true,
      surface: 'relay-autonomous-scraper',
      running: false,
      autonomy: st,
      lastCycles: await engine.recentCycles(5)
    });
  }

  if (!isCron && !isOperator) {
    return j(res, 403, {
      ok: false,
      error: 'forbidden: a cycle spends on paid APIs. Needs the Vercel cron identity or ?key=RELAY_ADMIN_KEY.'
    });
  }

  try {
    const report = await engine.runCycle({
      concept: u.searchParams.get('concept') || undefined,
      force: u.searchParams.get('force') === '1'
    });
    return j(res, 200, { ok: report.ok, surface: 'relay-autonomous-scraper', report: report });
  } catch (e) {
    console.error('[relay-autonomous-scraper] cycle failed:', e.message);
    return j(res, 500, { ok: false, error: e.message });
  }
};
