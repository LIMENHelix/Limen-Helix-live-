/**
 * domain-agent-box.js — the per-domain operator AI box (client side, all 20 domains).
 *
 * Mounts on any domain console (?domain=X). Reads the domain's live self-model and can
 * make bounded CHANGES to it via the brain's clamped methods (applyRequestBias /
 * setDomainConfig, or energy's richer setEnergyConfig) — never code, capital, or an
 * effector. The deliberative ("conscious") layer over the deterministic substrate.
 *
 * TWO MODES, auto-selected:
 *  - AI (Sonnet 5): passcode entered AND billing on -> POST /api/domain-agent.
 *  - LOCAL (free): no passcode, or the API is unavailable -> deterministic fallback.
 * With a passcode it tries the LLM first and falls back to local on any failure, so it
 * upgrades automatically the moment billing is on.
 */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function pct(v) { return (typeof v === 'number') ? Math.round(v * 100) + '%' : '?'; }
  function num(v) { return (typeof v === 'number') ? (Math.round(v * 100) / 100) : '?'; }

  function answerQuery(p, s) {
    s = s || {};
    var stressLine = function () { return 'Stress ' + pct(s.stress) + ', regulation ' + (s.regulation || '?') + ', predicted ' + pct(s.predictedStress) + '.'; };
    if (/forecast|predict|coming|ahead|future|next week|trajectory/.test(p) && s.forecast)
      return 'Forecast: stress ' + s.forecast.direction + ' toward ' + pct(s.forecast.projectedStress) + ' (confidence ' + pct(s.forecast.confidence) + '). Falsifier: ' + s.forecast.falsifier;
    if (/diagnos|problem|wrong|issue|distress|active/.test(p)) {
      var d = s.activeDiagnoses || [];
      return d.length ? ('Active diagnoses: ' + d.map(function (x) { return x.id + ' (' + pct(x.relevance) + (x.blocked ? ', blocked' : '') + ')'; }).join(', ') + '. ' + stressLine()) : ('No active diagnoses. ' + stressLine());
    }
    if (/opportun|money|invest|trade|where|position|deal|make/.test(p)) {
      var o = s.topOpportunities || [];
      return o.length ? ('Top opportunities: ' + o.slice(0, 5).map(function (x) { return x.title + ' [' + x.path + ', conf ' + x.confidence + ']'; }).join(' | ')) : 'No opportunities surfaced right now.';
    }
    if (/brake|safe|hold|emit|autonom/.test(p) && (s.brake || s.autoEmission)) {
      var b = s.brake || {}, a = s.autoEmission || {};
      return 'Brake: ' + (b.level || '?') + (b.reasons && b.reasons.length ? (' (' + b.reasons.join(', ') + ')') : '') + '. Autonomous emission: ' + (a.autonomy ? 'on' : 'off') + '.';
    }
    if (/config|setting|lane|concurrent|envelope|how many/.test(p)) {
      var c = s.config || {};
      return 'Config: autonomy ' + (c.autonomy ? 'on' : 'off') + ', max concurrent ' + c.maxConcurrent + ', lanes ' + ((c.lanes || []).join(', ')) + '.';
    }
    if (/steer|steering|bias|focus/.test(p)) {
      var st = s.activeSteering || {};
      return st.active ? ('Active steering: focus=[' + (st.attentionFocus || []).join(', ') + '] stressBias=' + num(st.stressBias) + (st.valuationLane ? ' lane=' + st.valuationLane : '') + '.') : 'No active steering right now.';
    }
    var dd = (s.activeDiagnoses || [])[0], oo = (s.topOpportunities || [])[0];
    return stressLine() + ' ' + (dd ? ('Top diagnosis ' + dd.id + '.') : 'No active diagnosis.') + ' ' + (oo ? ('Top opportunity: ' + oo.title + ' [' + oo.path + '].') : 'No opportunity surfaced.');
  }

  function parseLocal(prompt, state) {
    var p = String(prompt || '').toLowerCase().trim();
    var tools = [];
    if (/\bautonom/.test(p) && /(off|disable|stop|pause|halt)/.test(p)) tools.push({ type: 'config', autonomy: false });
    else if (/\bautonom/.test(p) && /(on|enable|resume|start|arm)/.test(p)) tools.push({ type: 'config', autonomy: true });
    var mN = p.match(/(?:show|only|surface|max|at a time|concurrent|give me)\D*(\d+)/);
    if (mN) { var n = parseInt(mN[1], 10); if (n >= 1 && n <= 12) tools.push({ type: 'config', maxConcurrent: n }); }
    if (/(prefer|only|just|show|want|switch to).*(research|brief)/.test(p) || /research (only|lane|mode)/.test(p)) tools.push({ type: 'steer', valuationLane: 'RESEARCHABLE' });
    else if (/(prefer|only|just|show|want|switch to).*(invest|position|trade|capital)/.test(p) || /invest(ment|able)?\s*(only|lane|mode)/.test(p)) tools.push({ type: 'steer', valuationLane: 'INVESTABLE' });
    if (/(clear|reset|drop|stop).*(steer|focus|bias)/.test(p) || /\bunfocus\b/.test(p) || /stop focusing/.test(p)) tools.push({ type: 'steer', clear: true });
    var mF = p.match(/(?:focus on|focus|watch|look at|attend to|keep an eye on|monitor|track)\s+(?:the\s+)?([a-z][a-z \-]{1,40})/);
    if (mF) {
      var topic = mF[1].replace(/\b(please|now|today|this week|domain|closely|carefully)\b/g, '').trim();
      var terms = topic.split(/[\s,]+/).filter(Boolean).slice(0, 3);
      if (terms.length) tools.push({ type: 'steer', attentionFocus: terms });
    }
    if (/(worried|worry|concerned|nervous|alarm|scared)/.test(p)) {
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

  if (typeof window !== 'undefined') window.__domainAgentLocal = { parse: parseLocal, query: answerQuery };

  ready(function () {
    if (window.__domainAgentBox) return; window.__domainAgentBox = true;
    var params = new URLSearchParams(window.location.search);
    var domain = params.get('domain');
    if (!domain) return;   // only on a domain console

    var LS_KEY = 'limenDomainAgentKey';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    function brain() {
      var reg = window.LIMENDomainBrains;
      var b = (reg && reg.get) ? reg.get(domain) : null;
      if (b) return b;
      if (reg && reg.getAll) { var all = reg.getAll(); for (var k in all) { if (all.hasOwnProperty(k)) return all[k]; } }   // single-brain page
      return null;
    }
    function label() { var b = brain(); return (b && b.label) || (domain.charAt(0).toUpperCase() + domain.slice(1)); }
    function summary(b) { if (!b) return {}; try { return (typeof b.getEnergyStateSummary === 'function') ? b.getEnergyStateSummary() : (typeof b.getStateSummary === 'function') ? b.getStateSummary() : {}; } catch (e) { return {}; } }

    var css = document.createElement('style');
    css.textContent =
      '#dab-toggle{position:fixed;right:18px;bottom:18px;z-index:99998;background:#1a1f33;color:#cdd3ec;border:1px solid rgba(120,140,220,.4);border-radius:22px;padding:9px 15px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.4)}' +
      '#dab-toggle:hover{background:#222842}' +
      '#dab{position:fixed;right:18px;bottom:64px;width:360px;max-width:94vw;height:520px;max-height:78vh;z-index:99999;background:#0f1220;border:1px solid rgba(120,140,220,.3);border-radius:14px;display:none;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.55);overflow:hidden}' +
      '#dab.open{display:flex}' +
      '#dab .dab-h{padding:10px 12px;border-bottom:1px solid rgba(120,140,220,.2);color:#aeb6d8;font:600 13px system-ui;display:flex;justify-content:space-between;align-items:center}' +
      '#dab .dab-h b{color:#e0e4f5}' +
      '#dab .dab-x{cursor:pointer;color:#8a90a8;font:600 11px system-ui;letter-spacing:.04em}' +
      '#dab .dab-log{flex:1;overflow-y:auto;padding:10px 12px;font:13px/1.5 system-ui;color:#cdd3ec}' +
      '#dab .dab-msg{margin-bottom:12px}' +
      '#dab .dab-you{color:#8fa0d8}' +
      '#dab .dab-ai{color:#d8d2c5;white-space:pre-wrap}' +
      '#dab .dab-tool{margin-top:5px;font:11px/1.45 ui-monospace,monospace;color:#7fbfa0;background:rgba(90,181,160,.08);border:1px solid rgba(90,181,160,.22);border-radius:6px;padding:5px 7px}' +
      '#dab .dab-stamp{margin-top:4px;font:10px/1.4 system-ui;color:#6a6458}' +
      '#dab .dab-in{border-top:1px solid rgba(120,140,220,.2);padding:8px;display:flex;gap:6px}' +
      '#dab textarea{flex:1;resize:none;height:38px;background:#161a2c;border:1px solid rgba(120,140,220,.25);border-radius:8px;color:#e0e4f5;padding:8px;font:13px system-ui}' +
      '#dab button.dab-send{background:#2b3a6b;color:#e0e4f5;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font:600 13px system-ui}' +
      '#dab .dab-key{padding:6px 12px;border-top:1px solid rgba(120,140,220,.15)}' +
      '#dab .dab-key input{width:100%;background:#161a2c;border:1px solid rgba(120,140,220,.25);border-radius:8px;color:#e0e4f5;padding:6px;font:12px system-ui}' +
      '#dab .dab-key label{display:block;color:#6a6458;font:10px system-ui;margin-bottom:3px}';
    document.head.appendChild(css);

    var lbl = label();
    var toggle = document.createElement('div'); toggle.id = 'dab-toggle'; toggle.textContent = 'Ask ' + lbl;
    var panel = document.createElement('div'); panel.id = 'dab';
    panel.innerHTML =
      '<div class="dab-h"><span><b>' + esc(lbl) + '</b> · ask or steer</span><span class="dab-x">CLOSE</span></div>' +
      '<div class="dab-log" id="dab-log"></div>' +
      '<div class="dab-key"><label>optional: operator passcode for AI mode (blank = free local mode)</label><input id="dab-key" type="password" placeholder="passcode (optional)"></div>' +
      '<div class="dab-in"><textarea id="dab-t" placeholder="Ask anything, or: focus on X / prefer research / autonomy off"></textarea><button class="dab-send" id="dab-send">Send</button></div>';
    document.body.appendChild(toggle); document.body.appendChild(panel);

    var log = panel.querySelector('#dab-log');
    var ta = panel.querySelector('#dab-t');
    var keyInput = panel.querySelector('#dab-key');
    var saved = ''; try { saved = localStorage.getItem(LS_KEY) || ''; } catch (e) {}
    if (saved) keyInput.value = saved;

    toggle.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) ta.focus(); };
    panel.querySelector('.dab-x').onclick = function () { panel.classList.remove('open'); };
    function add(html) { var d = document.createElement('div'); d.className = 'dab-msg'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }

    function applyTools(tools) {
      var b = brain(); if (!b || !tools || !tools.length) return '';
      var lines = [];
      tools.forEach(function (t) {
        if (t.type === 'steer' && typeof b.applyRequestBias === 'function') {
          var r = b.applyRequestBias(t);
          lines.push('steer: focus=[' + (r.attentionFocus || []).join(', ') + '] stressBias=' + num(r.stressBias) + (r.valuationLane ? ' lane=' + r.valuationLane : '') + (t.clear ? ' (cleared)' : ''));
        } else if (t.type === 'config') {
          var setFn = (typeof b.setEnergyConfig === 'function') ? b.setEnergyConfig : (typeof b.setDomainConfig === 'function') ? b.setDomainConfig : null;
          if (setFn) { var c = setFn.call(b, t); lines.push('config: autonomy=' + c.autonomy + ' maxConcurrent=' + c.maxConcurrent + ' lanes=[' + (c.lanes || []).join(', ') + ']'); }
        }
      });
      return lines.join('\n');
    }
    function stampLine(mode, left) {
      var s = summary(brain());
      var conf = (s.predictionError != null) ? Math.round((1 - s.predictionError) * 100) + '%' : '?';
      var gov = (s.brake && s.brake.level) || s.immune || '?';
      return (mode || '') + (typeof left === 'number' ? ' · ' + left + ' AI left today' : '') + ' · confidence ' + conf + ' · ' + gov + ' · ' + (s.interoceptionCaveat || 'single-channel interoception');
    }
    function renderResult(pending, result, mode, left) {
      var html = '<span class="dab-ai">' + esc(result.answer || '') + '</span>';
      var applied = applyTools(result.toolCalls);
      if (applied) html += '<div class="dab-tool">applied to ' + esc(domain) + ':\n' + esc(applied) + '</div>';
      html += '<div class="dab-stamp">' + esc(stampLine(mode, left)) + '</div>';
      pending.innerHTML = html; log.scrollTop = log.scrollHeight;
    }

    function send() {
      var b = brain();
      if (!b) { add('<span class="dab-ai">' + esc(lbl) + ' brain not loaded on this page yet — try again in a moment.</span>'); return; }
      var prompt = (ta.value || '').trim(); if (!prompt) return;
      ta.value = '';
      add('<span class="dab-you">you:</span> ' + esc(prompt));
      var pending = add('<span class="dab-ai">…</span>');
      var state = summary(b);
      var local = parseLocal(prompt, state);
      var passcode = (keyInput.value || '').trim();
      if (!passcode) { renderResult(pending, local, 'local (free)', null); return; }
      try { localStorage.setItem(LS_KEY, passcode); } catch (e) {}
      fetch('/api/domain-agent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: domain, passcode: passcode, prompt: prompt, state: state })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) renderResult(pending, { answer: j.answer, toolCalls: j.toolCalls }, 'AI', j.left);
        else renderResult(pending, local, 'local (AI off: ' + esc((j && j.error) || 'unavailable') + ')', null);
      }).catch(function () { renderResult(pending, local, 'local (AI unreachable)', null); });
    }
    panel.querySelector('#dab-send').onclick = send;
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

    add('<span class="dab-ai">' + esc(lbl) + ' domain online (free local mode). Ask about it, or steer it: "focus on X", "prefer research", "autonomy off", "how is it doing", "show the forecast". I bias the domain, never force a finding, move capital, or touch code. Add a passcode above for conversational AI once billing is on.</span>');
  });
})();
