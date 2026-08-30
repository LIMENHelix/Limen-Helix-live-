const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const htmlPath = path.join(__dirname, '../pages/relay-marketplace-control.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    console.error('[relay-marketplace-control]', e.message);
    res.status(500).json({ error: 'Page not found', details: e.message });
  }
};
