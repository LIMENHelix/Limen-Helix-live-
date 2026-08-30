/**
 * relay-admin-page.js — Serves the admin dashboard
 * GET /api/relay-admin-page
 */

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const htmlPath = path.join(__dirname, '../pages/relay-admin.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    console.error('[relay-admin-page] Failed to read HTML:', e.message, 'path:', path.join(__dirname, '../pages/relay-admin.html'));
    res.status(500).json({ error: 'Admin page not found', details: e.message });
  }
};
