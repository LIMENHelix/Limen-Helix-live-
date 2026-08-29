/**
 * relay-marketplace-page.js — Serves the Relay marketplace frontend
 * GET /api/relay-marketplace-page
 */

const fs = require('fs');
const path = require('path');

// Read the HTML file once at startup
const htmlPath = path.join(__dirname, '../pages/relay.html');
let html;

try {
  html = fs.readFileSync(htmlPath, 'utf8');
} catch (e) {
  console.error('[relay-marketplace-page] Failed to read HTML:', e.message);
  html = '<h1>Error</h1><p>Page not found</p>';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
