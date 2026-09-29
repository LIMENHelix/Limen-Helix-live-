/**
 * api/homestead-chat.js — on-page Homestead sales agent.
 *
 *   GET  /api/homestead-chat           → readiness (never the key)
 *   POST /api/homestead-chat           { messages: [{role, content}] }
 *
 * Deterministic FAQ + qualify always run. Grok is used only when
 * LIMEN_AI_ENABLED=1, spend is not paused, and XAI_API_KEY or GROK_API_KEY
 * is set. No secrets in the response. Chat stays on the page.
 */
'use strict';

var kill = require('../lib/ai-kill-switch');
var chat = require('../lib/homestead-chat');

var XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
var DEFAULT_MODEL = 'grok-4';

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.end(JSON.stringify(obj));
}

function queryOf(req) {
  try {
    var u = new URL(req.url, 'http://localhost');
    var out = {};
    u.searchParams.forEach(function (v, k) { out[k] = v; });
    return out;
  } catch (e) { return {}; }
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 20000) data = data.slice(0, 20000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function xaiKey() {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
}

function xaiModel() {
  return process.env.LIMEN_HOMESTEAD_GROK_MODEL || process.env.GROK_MODEL || DEFAULT_MODEL;
}

function clipMessages(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(-12).map(function (m) {
    var role = m && m.role === 'assistant' ? 'assistant' : 'user';
    return { role: role, content: String(m && m.content || '').slice(0, 1200) };
  }).filter(function (m) { return m.content.trim(); });
}

function shape(core, extra) {
  extra = extra || {};
  var qual = core.qual || chat.qualify([]);
  return {
    ok: true,
    reply: core.reply,
    crisis: !!core.crisis,
    provider: extra.provider || core.provider || 'faq',
    model: extra.model || null,
    grokAttempted: !!extra.grokAttempted,
    faqId: core.faqId || null,
    qualified: !!qual.qualified,
    qualification: {
      role: qual.role,
      urgency: qual.urgency,
      equity: qual.equity,
      crisis: !!qual.crisis
    },
    route: qual.route,
    disclaimer: 'Educational only. Not legal or financial advice. We do not invent auction dates.'
  };
}

async function grokReply(messages) {
  var key = xaiKey();
  if (!key) return { ok: false, reason: 'no_key' };
  var body = {
    model: xaiModel(),
    temperature: 0.2,
    max_tokens: 400,
    messages: [{ role: 'system', content: chat.systemPrompt() }].concat(messages)
  };
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 12000);
  try {
    var r = await fetch(XAI_ENDPOINT, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var raw = await r.text();
    var j = null;
    try { j = JSON.parse(raw); } catch (e) { j = null; }
    if (!r.ok || !j) return { ok: false, reason: 'provider_http', status: r.status };
    var text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text: String(text).slice(0, 1600), model: body.model };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'transport' };
  } finally {
    clearTimeout(tid);
  }
}

function readiness() {
  return {
    ok: true,
    chat: true,
    outbound: false,
    grokConfigured: !!xaiKey(),
    grokModel: xaiModel(),
    aiEnabledEnv: process.env.LIMEN_AI_ENABLED === '1',
    env: {
      XAI_API_KEY: 'set on the deployment to enable Grok replies',
      GROK_API_KEY: 'accepted as an alias of XAI_API_KEY',
      LIMEN_AI_ENABLED: 'must be 1 or Grok is not called (kill switch)',
      LIMEN_HOMESTEAD_GROK_MODEL: 'optional; default grok-4',
      GROK_MODEL: 'optional fallback model name'
    },
    note: 'FAQ + routing work with no key. Grok is optional. No secrets are returned.'
  };
}

module.exports = async function handler(req, res) {
  try {
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'GET') return send(res, readiness());
    if (method !== 'POST') return send(res, { ok: false, error: 'GET or POST only' }, 405);

    var body = await readBody(req);
    var messages = clipMessages(body.messages);
    if (!messages.length && body.message) messages = [{ role: 'user', content: String(body.message).slice(0, 1200) }];
    if (!messages.length) {
      return send(res, shape({ reply: chat.opening(), provider: 'faq', qual: chat.qualify([]) }));
    }

    var core = chat.replyTo(messages);
    if (core.crisis) return send(res, shape(core));

    var blocked = await kill.spendDisabled();
    if (blocked || !xaiKey()) return send(res, shape(core, { provider: core.provider, grokAttempted: false }));

    var grok = await grokReply(messages);
    if (!grok.ok) return send(res, shape(core, { provider: core.provider, grokAttempted: true }));

    return send(res, shape({
      reply: grok.text,
      provider: 'xai',
      faqId: core.faqId || null,
      qual: core.qual,
      crisis: false
    }, { provider: 'xai', model: grok.model, grokAttempted: true }));
  } catch (e) {
    return send(res, { ok: false, error: e.message || 'homestead-chat error' }, 500);
  }
};

// exported for tests; not a secret
module.exports._readiness = readiness;
module.exports._queryOf = queryOf;
