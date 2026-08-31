/**
 * relay-admin-login.js — serves relay-admin-login.html
 *
 * FIXED 2026-08-30: this handler read '../pages/relay-admin-login.html', but the
 * file lives at the repo root, so the route returned 500 on every request. Both literal
 * paths are tried below, and both are written out in full on purpose: Vercel's file
 * tracer only bundles a file it can see as a static string, so a computed path would
 * deploy a function with no HTML in it.
 */

const fs = require('fs');
const path = require('path');

function load() {
  try {
    return fs.readFileSync(path.join(__dirname, '../relay-admin-login.html'), 'utf8');
  } catch (e) {
    return fs.readFileSync(path.join(__dirname, '../pages/relay-admin-login.html'), 'utf8');
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const html = load();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[relay-admin-login] Error:', err.message);
    return res.status(500).json({ error: 'Page load failed', message: err.message });
  }
};
