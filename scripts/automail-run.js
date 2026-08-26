/**
 * Legacy-compatible automail trigger. The only production effect path lives in
 * handlers/homestead-automail.js, where Law's B10/B14 and budget gates run.
 */
'use strict';
var BASE = process.env.AUTOMAIL_BASE || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
(async function () {
  if (!KEY) { console.error('automail: LEAD_ADMIN_KEY missing'); process.exit(2); }
  var response = await fetch(BASE + '/api/homestead-automail', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, action: 'send' }) });
  var result = await response.json().catch(function () { return null; });
  if (!response.ok || !result || result.ok !== true) { console.error('automail: sovereign endpoint failed', result); process.exit(1); }
  console.log('automail:', result.mode, '| candidates', result.candidates || 0, '| accepted', result.count || 0,
    '| held', result.held || 0, '| failed', result.fails || 0);
})().catch(function (error) { console.error('automail FATAL', error && error.stack || error); process.exit(1); });
