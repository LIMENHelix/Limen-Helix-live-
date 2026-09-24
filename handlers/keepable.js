'use strict';

/**
 * keepable.js — "email me my result" for the free desks (THE TWENTY #2).
 *
 *   POST /api/keepable  { email, domain, tool, data }  → { ok } — one email, to the asker only.
 *
 * THE ANTI-SPAM CONTRACT: the visitor supplies STRUCTURED INPUTS, never prose. The email
 * body is rebuilt server-side from a fixed template per tool, so this route cannot be used
 * to send arbitrary text to arbitrary addresses. Rate-limited per email and per IP.
 * Every send still passes crm-send's suppression and CAN-SPAM footer.
 */
var db = require('../lib/limen-db');
var crm = require('../lib/crm-send');

var MAX_PER_EMAIL_PER_DAY = 3;
var MAX_PER_IP_PER_DAY = 10;

function num(v, lo, hi) {
  var x = Number(v);
  return (Number.isFinite(x) && x >= lo && x <= hi) ? x : null;
}
function str(v, max) { return (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max || 60) : null; }
function money(x) { return '$' + Number(x).toFixed(2); }

var TOOLS = {
  'energy.bill-xray': {
    validate: function (d) {
      if (!d || typeof d !== 'object') return null;
      var bill = num(d.bill, 1, 100000), kwh = num(d.kwh, 1, 1000000);
      if (bill === null || kwh === null) return null;
      return {
        utility: str(d.utility, 60) || 'your utility',
        zip: /^\d{5}$/.test(String(d.zip || '')) ? String(d.zip) : null,
        month: /^\d{4}-\d{2}$/.test(String(d.month || '')) ? String(d.month) : null,
        bill: bill, kwh: kwh,
        gas: d.gas == null ? null : num(d.gas, 0, 100000)
      };
    },
    render: function (v) {
      var eff = (v.bill / v.kwh) * 100;
      var vsAvg = ((eff - 17) / 17) * 100;
      var lines = [
        'Your Bill X-Ray' + (v.month ? ' — ' + v.month : ''),
        '',
        'Utility: ' + v.utility + (v.zip ? '  (' + v.zip + ')' : ''),
        'Bill: ' + money(v.bill) + ' for ' + v.kwh.toLocaleString() + ' kWh' +
          (v.gas ? '  (plus ' + money(v.gas) + ' gas)' : ''),
        'Effective rate: ' + eff.toFixed(1) + '¢/kWh — ' +
          (vsAvg >= 0 ? Math.round(vsAvg) + '% above' : Math.round(Math.abs(vsAvg)) + '% below') +
          ' the ~17¢ national average.',
        '',
        'How to read it: your bill is usage × rate. Next month, run the X-Ray again with the',
        'new bill and it splits the change into the part usage explains and the part your',
        'rate or fees explain — so you can see which one moved.',
        '',
        'Check the live figures yourself: https://limenhelix.com/energy'
      ];
      return { subject: 'Your Bill X-Ray' + (v.month ? ' — ' + v.month : ''), text: lines.join('\n') };
    }
  }
};

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 8000) data = data.slice(0, 8000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

async function rateLimited(key, max) {
  var day = new Date().toISOString().slice(0, 10);
  var k = 'keepable:rl:' + key;
  var cur = await db.get(k);
  if (!cur || cur.day !== day) cur = { day: day, count: 0 };
  if (cur.count >= max) return true;
  cur.count++;
  await db.set(k, cur);
  return false;
}

function createHandler(deps) {
  deps = deps || {};
  var transport = deps.send || crm.sendToLead;
  var limit = deps.rateLimited || rateLimited;

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if ((req.method || '').toUpperCase() === 'OPTIONS') return send(res, { ok: true });
    if ((req.method || '').toUpperCase() !== 'POST') return send(res, { ok: false, error: 'POST only' }, 405);

    var body = await readBody(req);
    var email = String(body.email || '').trim().toLowerCase();
    var toolKey = String(body.domain || '') + '.' + String(body.tool || '');
    var tool = TOOLS[toolKey];
    if (!crm.validEmail(email)) return send(res, { ok: false, error: 'A valid email is required.' }, 400);
    if (!tool) return send(res, { ok: false, error: 'Unknown keepable.' }, 400);
    var data = tool.validate(body.data);
    if (!data) return send(res, { ok: false, error: 'Those inputs do not make a readable result.' }, 400);

    var ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'unknown')
      .split(',')[0].trim().slice(0, 64);
    try {
      if (await limit('email:' + email, MAX_PER_EMAIL_PER_DAY) ||
          await limit('ip:' + ip, MAX_PER_IP_PER_DAY)) {
        return send(res, { ok: false, error: 'Limit reached for today — the result stays on the page for you.' }, 429);
      }
    } catch (e) {
      return send(res, { ok: false, error: 'keepable-unavailable' }, 503);   // unreadable store is not a green light
    }

    var rendered = tool.render(data);
    var sent = await transport(email, rendered.subject, rendered.text, { idempotencyKey: 'keepable:' + toolKey + ':' + email + ':' + rendered.text.length });
    if (!sent.ok) return send(res, { ok: false, error: 'Could not send that just now — try again shortly.' }, 502);
    return send(res, { ok: true });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.TOOLS = TOOLS;
