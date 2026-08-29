const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../relay-margin.html'), 'utf8');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
