/**
 * energy-agent-box.js — the Energy domain's operator AI box (client side).
 *
 * A floating "Talk to Energy" panel on the energy domain-console. It KNOWS its
 * domain (window.LIMENEnergyBrain.getEnergyStateSummary()) and can make bounded
 * CHANGES to it: STEER (bias) + CONFIG, applied through the brain's clamped methods
 * (applyRequestBias / setEnergyConfig) — never code, capital, or an effector.
 *
 * TWO MODES, auto-selected:
 *  - LOCAL (free, default): answers from live state + recognizes steer/config
 *    commands by keyword. No API call, no token cost.
 *  - AI (Haiku): if an operator passcode is entered AND billing is on, the box
 *    tries /api/energy-agent first and falls back to LOCAL on any failure, so it
 *    upgrades automatically the moment billing returns.
 */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // ── deterministic (free) engine — pure functions, also exposed for tests ──
  function pct(v) { return (typeof v === 'number') ? Math.round(v * 100) + '%' : '?'; }
  function num(v) { return (typeof v === 'number') ? (Math.round(v * 100) / 100) : '?'; }

  function answerQuery(p, s) {
    s = s || {};
    var stressLine = function () { return 'Stress ' + pct(s.stress) + ' (' + (s.stressFlag || '?') + '), regulation ' + (s.regulation || '?') + ', predicted ' + pct(s.predictedStress) + '.'; };
    if (/forecast|predict|coming|ahead|future|next week|trajectory/.test(p) && s.forecast)
      return 'Forecast: stress ' + s.forecast.direction + ' toward ' + pct(s.forecast.projectedStress) + ' (confidence ' + pct(s.forecast.confidence) + '). Falsifier: ' + s.forecast.falsifier;
    if (/diagnos|problem|wrong|issue|distress|what.?s active/.test(p)) {
      var d = s.activeDiagnoses || [];
      return d.length ? ('Active diagnoses: ' + d.map(function (x) { return x.id + ' (' + pct(x.relevance) + (x.blocked ? ', blocked' : '') + ')'; }).join(', ') + '. ' + stressLine()) : ('No active diagnoses. ' + stressLine());
    }
    if (/opportun|money|invest|trade|where.?s the|position|deal|make/.test(p)) {
      var o = s.topOpportunities || [];
      return o.length ? ('Top opportunities: ' + o.slice(0, 5).map(function (x) { return x.title + ' [' + x.path + ', conf ' + x.confidence + (x.held ? ', HELD' : '') + ']'; }).join(' | ')) : 'No opportunities surfaced right now.';
    }
    if (/brake|safe|hold|stop|emit|autonom/.test(p)) {
      var b = s.brake || {}, a = s.autoEmission || {};
      return 'Brake: ' + (b.level || '?') + (b.reasons && b.reasons.length ? (' (' + b.reasons.join(', ') + ')') : '') + '. Autonomous emission: ' + (a.autonomy ? 'on' : 'off') + ', emitted ' + (a.emittedCount || 0) + (a.holdReason ? (', held: ' + a.holdReason) : '') + '.';
    }
    if (/config|setting|lane|concurrent|envelope|how many/.test(p)) {
      var c = s.config || {};
      return 'Config: autonomy ' + (c.autonomy ? 'on' : 'off') + ', max concurrent ' + c.maxConcurrent + ', lanes ' + ((c.lanes || []).join(', ')) + '.';
    }
    if (/steer|steering|bias|focused|focus\b/.test(p)) {
      var st = s.activeSteering || {};
      return st.active ? ('Active steering: focus=[' + (st.attentionFocus || []).join(', ') + '] stressBias=' + num(st.stressBias) + (st.valuationLane ? ' lane=' + st.valuationLane : '') + ' (decay ' + pct(st.decay) + ').') : 'No active steering right now.';
    }
    if (/ledger|hit.?rate|calibrat|right|paid|track record/.test(p) && s.outcomeLedger) {
      var l = s.outcomeLedger;
      return 'Call ledger: hit-rate ' + (l.callHitRate == null ? 'n/a yet' : pct(l.callHitRate)) + ', ' + (l.confirmed || 0) + ' confirmed / ' + (l.falsified || 0) + ' falsified.';
    }
    // default overview
    var dd = (s.activeDiagnoses || [])[0], oo = (s.topOpportunities || [])[0];
    return stressLine() + ' ' + (dd ? ('Top diagnosis ' + dd.id + '.') : 'No active diagnosis.') + ' ' + (oo ? ('Top opportunity: ' + oo.title + ' [' + oo.path + '].') : 'No opportunity surfaced.') + (s.brake ? (' Brake ' + s.brake.level + '.') : '');
  }

  function parseLocal(prompt, state) {
    var p = String(prompt || '').toLowerCase().trim();
    var tools = [];
    // config: autonomy
    if (/\bautonom/.test(p) && /(off|disable|stop|pause|halt)/.test(p)) tools.push({ type: 'config', autonomy: false });
    else if (/\bautonom/.test(p) && /(on|enable|resume|start|arm)/.test(p)) tools.push({ type: 'config', autonomy: true });
    // config: maxConcurrent
    var mN = p.match(/(?:show|only|surface|max|at a time|concurrent|give me)\D*(\d+)/);
    if (mN) { var n = parseInt(mN[1], 10); if (n >= 1 && n <= 8) tools.push({ type: 'config', maxConcurrent: n }); }
    // steer: lane preference
    if (/(prefer|only|just|show|want|switch to).*(research|brief)/.test(p) || /research (only|lane|mode)/.test(p)) tools.push({ type: 'steer', valuationLane: 'RESEARCHABLE' });
    else if (/(prefer|only|just|show|want|switch to).*(invest|position|trade|capital)/.test(p) || /invest(ment|able)?\s*(only|lane|mode)/.test(p)) tools.push({ type: 'steer', valuationLane: 'INVESTABLE' });
    // steer: clear
    if (/(clear|reset|drop|stop).*(steer|focus|bias)/.test(p) || /\bunfocus\b/.test(p) || /stop focusing/.test(p)) tools.push({ type: 'steer', clear: true });
    // steer: focus a topic
    var mF = p.match(/(?:focus on|focus|watch|look at|attend to|keep an eye on|monitor|track)\s+(?:the\s+)?([a-z][a-z \-]{1,40})/);
    if (mF) {
      var topic = mF[1].replace(/\b(please|now|today|this week|domain|energy|closely|carefully)\b/g, '').trim();
      var terms = topic.split(/[\s,]+/).filter(Boolean).slice(0, 3);
      if (terms.length) tools.push({ type: 'steer', attentionFocus: terms });
    }
    // steer: concern raises stress (+ optional topic)
    if (/(worried|worry|concerned|nervous|alarm|scared|risk on)/.test(p)) {
      tools.push({ type: 'steer', stressBias: 0.15 });
      var mW = p.match(/(?:about|over|with)\s+(?:the\s+)?([a-z][a-z \-]{1,30})/);
      if (mW) { var t = mW[1].trim().split(/[\s,]+/).filter(Boolean).slice(0, 2); if (t.length) tools.push({ type: 'steer', attentionFocus: t }); }
    }
    if (tools.length) {
      var kind = tools.some(function (t) { return t.type === 'config'; }) ? 'config' : 'steering';
      return { answer: 'Recognized that as a ' + kind + ' change and applied it.', toolCalls: tools };
    }
    return { answer: answerQuery(p, state), toolCalls: [] };
  }

  if (typeof window !== 'undefined') window.__energyAgentLocal = { parse: parseLocal, query: answerQuery };

  ready(function () {
    if (window.__energyAgentBox) return; window.__energyAgentBox = true;
    var LS_KEY = 'limenEnergyAgentKey';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    function brain() { return window.LIMENEnergyBrain || null; }

    var css = document.createElement('style');
    css.textContent =
      '#eab-toggle{position:fixed;right:18px;bottom:18px;z-index:99998;background:#1a1f33;color:#cdd3ec;border:1px solid rgba(120,140,220,.4);border-radius:22px;padding:9px 15px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4)}' +
      '#eab-toggle:hover{background:#222842}' +
      '#eab{position:fixed;right:18px;bottom:64px;width:360px;max-width:94vw;height:520px;max-height:78vh;z-index:99999;background:#0f1220;border:1px solid rgba(120,140,220,.3);border-radius:14px;display:none;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.55);overflow:hidden}' +
      '#eab.open{display:flex}' +
      '#eab .eab-h{padding:10px 12px;border-bottom:1px solid rgba(120,140,220,.2);color:#aeb6d8;font:600 13px system-ui;display:flex;justify-content:space-between;align-items:center}' +
      '#eab .eab-h b{color:#e0e4f5}' +
      '#eab .eab-x{cursor:pointer;color:#6a7290;font-size:16px}' +
      '#eab .eab-log{flex:1;overflow-y:auto;padding:10px 12px;font:13px/1.5 system-ui;color:#cdd3ec}' +
      '#eab .eab-msg{margin-bottom:12px}' +
      '#eab .eab-you{color:#8fa0d8}' +
      '#eab .eab-ai{color:#d8d2c5;white-space:pre-wrap}' +
      '#eab .eab-tool{margin-top:5px;font:11px/1.45 ui-monospace,monospace;color:#7fbfa0;background:rgba(90,181,160,.08);border:1px solid rgba(90,181,160,.22);border-radius:6px;padding:5px 7px}' +
      '#eab .eab-stamp{margin-top:4px;font:10px/1.4 system-ui;color:#6a6458}' +
      '#eab .eab-in{border-top:1px solid rgba(120,140,220,.2);padding:8px;display:flex;gap:6px}' +
      '#eab textarea{flex:1;resize:none;height:38px;background:#161a2c;border:1px solid rgba(120,140,220,.25);border-radius:8px;color:#e0e4f5;padding:8px;font:13px system-ui}' +
      '#eab button.eab-send{background:#2b3a6b;color:#e0e4f5;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font:600 13px system-ui}' +
      '#eab .eab-key{padding:6px 12px;border-top:1px solid rgba(120,140,220,.15)}' +
      '#eab .eab-key input{width:100%;background:#161a2c;border:1px solid rgba(120,140,220,.25);border-radius:8px;color:#e0e4f5;padding:6px;font:12px system-ui}' +
      '#eab .eab-key label{display:block;color:#6a6458;font:10px system-ui;margin-bottom:3px}';
    document.head.appendChild(css);

    var toggle = document.createElement('div'); toggle.id = 'eab-toggle'; toggle.textContent = '⚡ Talk to Energy';
    var panel = document.createElement('div'); panel.id = 'eab';
    panel.innerHTML =
      '<div class="eab-h"><span><b>Energy</b> · ask or steer</span><span class="eab-x">✕</span></div>' +
      '<div class="eab-log" id="eab-log"></div>' +
      '<div class="eab-key"><label>optional: operator passcode for AI mode (blank = free local mode)</label><input id="eab-key" type="password" placeholder="passcode (optional)"></div>' +
      '<div class="eab-in"><textarea id="eab-t" placeholder="Ask anything, or: focus on grid / prefer research / autonomy off"></textarea><button class="eab-send" id="eab-send">Send</button></div>';
    document.body.appendChild(toggle); document.body.appendChild(panel);

    var log = panel.querySelector('#eab-log');
    var ta = panel.querySelector('#eab-t');
    var keyInput = panel.querySelector('#eab-key');
    var saved = ''; try { saved = localStorage.getItem(LS_KEY) || ''; } catch (e) {}
    if (saved) keyInput.value = saved;

    toggle.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) ta.focus(); };
    panel.querySelector('.eab-x').onclick = function () { panel.classList.remove('open'); };
    function add(html) { var d = document.createElement('div'); d.className = 'eab-msg'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }

    function applyTools(tools) {
      var b = brain(); if (!b || !tools || !tools.length) return '';
      var lines = [];
      tools.forEach(function (t) {
        if (t.type === 'steer' && typeof b.applyRequestBias === 'function') {
          var r = b.applyRequestBias(t);
          lines.push('steer → focus=[' + (r.attentionFocus || []).join(', ') + '] stressBias=' + num(r.stressBias) + (r.valuationLane ? ' lane=' + r.valuationLane : '') + (t.clear ? ' (cleared)' : ''));
        } else if (t.type === 'config' && typeof b.setEnergyConfig === 'function') {
          var c = b.setEnergyConfig(t);
          lines.push('config → autonomy=' + c.autonomy + ' maxConcurrent=' + c.maxConcurrent + ' lanes=[' + (c.lanes || []).join(', ') + ']');
        }
      });
      return lines.join('\n');
    }
    function stampLine(mode, left) {
      var b = brain(); var extra = (mode ? mode : '') + (typeof left === 'number' ? ' · ' + left + ' AI left today' : '');
      if (!b || typeof b.getEnergyStateSummary !== 'function') return extra;
      var s = b.getEnergyStateSummary();
      var conf = (s.predictionError != null) ? Math.round((1 - s.predictionError) * 100) + '%' : '?';
      return extra + ' · confidence ' + conf + ' · brake ' + ((s.brake && s.brake.level) || '?') + ' · ' + s.interoceptionCaveat;
    }
    function renderResult(pending, result, mode, left) {
      var html = '<span class="eab-ai">' + esc(result.answer || '') + '</span>';
      var applied = applyTools(result.toolCalls);
      if (applied) html += '<div class="eab-tool">✓ applied to energy domain:\n' + esc(applied) + '</div>';
      html += '<div class="eab-stamp">' + esc(stampLine(mode, left)) + '</div>';
      pending.innerHTML = html; log.scrollTop = log.scrollHeight;
    }

    function send() {
      var b = brain();
      if (!b) { add('<span class="eab-ai">Energy brain not loaded on this page.</span>'); return; }
      var prompt = (ta.value || '').trim(); if (!prompt) return;
      ta.value = '';
      add('<span class="eab-you">you:</span> ' + esc(prompt));
      var pending = add('<span class="eab-ai">…</span>');
      var state = {}; try { state = b.getEnergyStateSummary(); } catch (e) {}
      var local = parseLocal(prompt, state);   // always computed (free)
      var passcode = (keyInput.value || '').trim();
      if (!passcode) { renderResult(pending, local, 'local (free)', null); return; }
      try { localStorage.setItem(LS_KEY, passcode); } catch (e) {}
      fetch('/api/energy-agent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode: passcode, prompt: prompt, state: state })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) renderResult(pending, { answer: j.answer, toolCalls: j.toolCalls }, 'AI', j.left);
        else renderResult(pending, local, 'local (AI off: ' + esc((j && j.error) || 'unavailable') + ')', null);
      }).catch(function () { renderResult(pending, local, 'local (AI unreachable)', null); });
    }
    panel.querySelector('#eab-send').onclick = send;
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

    add('<span class="eab-ai">Energy domain online (free local mode). Ask about it, or steer it: "focus on grid", "prefer research", "autonomy off", "how is energy doing", "show the forecast". I bias the domain, never force a finding, move capital, or touch code. Add a passcode above for conversational AI once billing is on.</span>');
  });
})();
