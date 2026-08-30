/**
 * relay-policy.js — Relay's sale terms, as a page and as JSON.
 *
 *   GET /api/relay-policy              the page a customer reads
 *   GET /api/relay-policy?format=json  the same terms + version + hash, for checkout UIs
 *
 * The version and hash are what an order records at the moment of purchase, so a dispute
 * resolves against the exact text that was on screen, not against whatever the policy says
 * today. See lib/relay-policy.js.
 */

const policy = require('../lib/relay-policy');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function page(p) {
  const terms = p.terms.map(function (t) {
    return '<section class="term"><h2>' + esc(t.title) + '</h2><p>' + esc(t.body) + '</p></section>';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relay — Sale Terms</title>
<style>
  :root { --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --bg:#ffffff; --warn:#b45309; --warnbg:#fffbeb; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e2e8f0; --mut:#94a3b8; --line:#1e293b; --bg:#0b1120; --warn:#fbbf24; --warnbg:#1c1408; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:720px; margin:0 auto; padding:48px 24px 96px; }
  .eyebrow { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--mut); margin:0 0 8px; }
  h1 { font-size:32px; line-height:1.2; margin:0 0 20px; letter-spacing:-.02em; }
  .headline { background:var(--warnbg); border:1px solid var(--warn); border-radius:10px;
              padding:16px 18px; color:var(--warn); font-weight:650; margin:0 0 32px; }
  .term { border-top:1px solid var(--line); padding:22px 0 4px; }
  .term h2 { font-size:15px; text-transform:uppercase; letter-spacing:.08em; margin:0 0 8px; color:var(--mut); font-weight:650; }
  .term p { margin:0; }
  .meta { margin-top:40px; padding-top:20px; border-top:1px solid var(--line);
          font-size:13px; color:var(--mut); }
  .meta code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; word-break:break-all; }
  a { color:inherit; }
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Relay &middot; by LIMEN Helix</p>
  <h1>Sale terms</h1>
  <p class="headline">${esc(p.headline)}</p>
  ${terms}
  <p class="meta">
    Questions or a problem with an order: <a href="mailto:${esc(p.contact)}">${esc(p.contact)}</a><br>
    Report a non-delivery or a not-as-described item within ${p.remedyWindowDays} days of delivery.<br><br>
    Policy version <strong>${esc(p.version)}</strong><br>
    Text hash <code>${esc(p.hash)}</code><br>
    Your order records the version and hash in force when you confirmed it.
  </p>
</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let format = 'html';
  try {
    format = new URL(req.url, 'http://h').searchParams.get('format') || 'html';
  } catch (e) { /* default html */ }

  const p = policy.getPolicy();

  if (format === 'json') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify(p));
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(page(p));
};
