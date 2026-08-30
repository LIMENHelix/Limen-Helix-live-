const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const htmlFile = path.join(__dirname, '../pages/relay-admin-login.html');
    const html = fs.readFileSync(htmlFile, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[relay-admin-login] Error:', err.message);
    return res.status(500).json({ error: 'Page load failed', message: err.message });
  }
};
