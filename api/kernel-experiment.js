/**
 * api/kernel-experiment.js
 *
 * REMOVED FROM PUBLIC ROUTING — 410 GONE.
 *
 * This endpoint formerly accepted arbitrary `companyData` POSTs from
 * any origin and ran the validated decision kernel
 * (limen-helix-api/limen_backtest_kernel.js) directly on the input.
 * That made it a public probing oracle: an attacker could submit
 * curated synthetic series and reverse-engineer thresholds, weights,
 * and constants by observing the output.
 *
 * The Helix Report architecture no longer uses this route. The only
 * public scoring path is:
 *
 *     POST /api/helix-report/score   (CIK + safe context only)
 *
 * The server fetches SEC EDGAR + SIC + FRED internally, runs the
 * server-side kernel, and returns a labels-and-bands packet. The
 * browser never submits companyData, raw feature rows, thresholds,
 * weights, or kernel internals to any route.
 *
 * If a future internal-only validated-kernel bridge is needed, build
 * it as a separate non-public route (no Vercel function, or behind a
 * Vercel deployment-protection password) — do NOT re-enable this file.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // No Access-Control-Allow-Origin → preflight from any browser fails.
  return res.status(410).json({
    error: 'gone',
    detail: 'arbitrary-input kernel scoring is no longer a public route. Use POST /api/helix-report/score with a CIK.',
    correct_endpoint: 'POST /api/helix-report/score',
  });
};
