/**
 * relay-checkout-page.js — Serves the checkout confirmation page
 * GET /api/relay-checkout-page
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../pages/relay-checkout.html');
let html;

try {
  html = fs.readFileSync(htmlPath, 'utf8');
} catch (e) {
  console.error('[relay-checkout-page] Failed to read HTML:', e.message);
  html = '<h1>Error</h1><p>Checkout page not found</p>';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
