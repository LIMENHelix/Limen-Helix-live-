'use strict';

/**
 * /api/keepable (THE TWENTY #2) — visitor-requested keepable emails.
 * The anti-spam contract is the thing under test: structured inputs in, fixed
 * template out; no path lets a caller supply prose; rate limits fail closed.
 */
var assert = require('node:assert/strict');
var K = require('../handlers/keepable.js');

function req(body, ip) {
  return { method: 'POST', body: body, headers: { 'x-forwarded-for': ip || '203.0.113.7' } };
}
function invoke(handler, r) {
  return new Promise(function (resolve, reject) {
    var res = { statusCode: 0, setHeader: function () {}, end: function (b) {
      resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }); } };
    Promise.resolve(handler(r, res)).catch(reject);
  });
}

(async function () {
  var sent = [];
  var ok = { send: async function (to, subject, text) { sent.push({ to: to, subject: subject, text: text }); return { ok: true, id: 'k1' }; } };
  var handler = K.createHandler({ send: ok.send, rateLimited: async function () { return false; } });

  // valid Bill X-Ray keepable: server recomputes the rate from raw inputs
  var r = await invoke(handler, req({ email: 'someone@example.com', domain: 'energy', tool: 'bill-xray',
    data: { utility: 'Evergy', zip: '64111', month: '2026-09', bill: 184.20, kwh: 1120 } }));
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'someone@example.com');
  assert.match(sent[0].subject, /Bill X-Ray — 2026-09/);
  assert.match(sent[0].text, /Evergy/);
  assert.match(sent[0].text, /16\.4¢\/kWh/);           // 184.20/1120*100, recomputed server-side
  assert.match(sent[0].text, /below the ~17¢ national average/);

  // no freeform path: a prose injection attempt lands nowhere in the email
  var r2 = await invoke(handler, req({ email: 'victim@example.com', domain: 'energy', tool: 'bill-xray',
    data: { utility: 'CLICK http://evil.example <b>buy now</b>', zip: '64111', month: '2026-09', bill: 100, kwh: 500,
            subject: 'SPAM SUBJECT', body: 'spam body', html: '<script>1</script>' } }));
  assert.equal(r2.body.ok, true);
  assert.match(sent[1].text, /CLICK http:\/\/evil\.example/);   // utility is plain text, bounded, inert
  assert.equal(sent[1].subject.indexOf('SPAM') < 0, true);
  assert.ok(sent[1].text.indexOf('spam body') < 0);

  // validation: bad email, unknown tool, out-of-range numbers, junk month
  assert.equal((await invoke(handler, req({ email: 'nope', domain: 'energy', tool: 'bill-xray', data: { bill: 1, kwh: 1 } }))).status, 400);
  assert.equal((await invoke(handler, req({ email: 'a@b.co', domain: 'energy', tool: 'shell', data: {} }))).status, 400);
  assert.equal((await invoke(handler, req({ email: 'a@b.co', domain: 'energy', tool: 'bill-xray', data: { bill: -5, kwh: 100 } }))).status, 400);
  assert.equal((await invoke(handler, req({ email: 'a@b.co', domain: 'energy', tool: 'bill-xray', data: { bill: 100, kwh: 100, month: 'Sep' } }))).body.ok, true); // junk month dropped, not fatal

  // rate limit fails the send, transport untouched (3 sends so far: valid, injection, junk-month)
  var limited = K.createHandler({ send: ok.send, rateLimited: async function () { return true; } });
  var r3 = await invoke(limited, req({ email: 'a@b.co', domain: 'energy', tool: 'bill-xray', data: { bill: 100, kwh: 500 } }));
  assert.equal(r3.status, 429); assert.equal(sent.length, 3);

  // transport failure surfaces cleanly
  var down = K.createHandler({ send: async function () { return { ok: false, error: 'resend 500' }; }, rateLimited: async function () { return false; } });
  assert.equal((await invoke(down, req({ email: 'a@b.co', domain: 'energy', tool: 'bill-xray', data: { bill: 100, kwh: 500 } }))).status, 502);

  // GET refused
  assert.equal((await invoke(handler, { method: 'GET', headers: {} })).status, 405);

  console.log('keepable: fixed-template visitor keepable, no prose path, limits fail closed: PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
