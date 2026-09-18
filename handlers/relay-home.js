const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(fs.readFileSync(path.join(__dirname, '../pages/relay-home.html'), 'utf8'));
};
