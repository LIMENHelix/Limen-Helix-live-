/**
 * energy-agent-box.js — the Energy domain's operator AI box (client side).
 *
 * A floating "Talk to Energy" panel on the energy domain-console. It KNOWS its
 * domain (sends window.LIMENEnergyBrain.getEnergyStateSummary() as context) and can
 * make bounded CHANGES to it: the LLM's returned toolCalls are applied here through
 * the brain's clamped methods (applyRequestBias / setEnergyConfig) — never anything
 * else. Source code and effectors are unreachable from this box by construction.
 *
 * Cost: one admin-gated model call per message (handler enforces Haiku + daily cap).
 */
(function () {
  'use strict';

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    if (window.__energyAgentBox) return; window.__energyAgentBox = true;

    var LS_KEY = 'limenEnergyAgentKey';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    function brain() { return window.LIMENEnergyBrain || null; }

    // ── styles ──
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
      '#eab .eab-key{padding:8px 12px;border-top:1px solid rgba(120,140,220,.15)}' +
      '#eab .eab-key input{width:100%;background:#161a2c;border:1px solid rgba(120,140,220,.25);border-radius:8px;color:#e0e4f5;padding:7px;font:12px system-ui}';
    document.head.appendChild(css);

    // ── dom ──
    var toggle = document.createElement('div'); toggle.id = 'eab-toggle'; toggle.textContent = '⚡ Talk to Energy';
    var panel = document.createElement('div'); panel.id = 'eab';
    panel.innerHTML =
      '<div class="eab-h"><span><b>Energy</b> · ask or steer</span><span class="eab-x">✕</span></div>' +
      '<div class="eab-log" id="eab-log"></div>' +
      '<div class="eab-key" id="eab-keyrow"><input id="eab-key" type="password" placeholder="operator passcode"></div>' +
      '<div class="eab-in"><textarea id="eab-t" placeholder="Ask anything, or: focus on grid / prefer research / turn autonomy off"></textarea><button class="eab-send" id="eab-send">Send</button></div>';
    document.body.appendChild(toggle); document.body.appendChild(panel);

    var log = panel.querySelector('#eab-log');
    var ta = panel.querySelector('#eab-t');
    var keyInput = panel.querySelector('#eab-key');
    var keyRow = panel.querySelector('#eab-keyrow');
    var saved = ''; try { saved = localStorage.getItem(LS_KEY) || ''; } catch (e) {}
    if (saved) { keyInput.value = saved; keyRow.style.display = 'none'; }

    toggle.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) ta.focus(); };
    panel.querySelector('.eab-x').onclick = function () { panel.classList.remove('open'); };

    function add(cls, html) { var d = document.createElement('div'); d.className = 'eab-msg'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }

    // apply the LLM's bounded toolCalls via the brain's clamped methods ONLY
    function applyTools(tools) {
      var b = brain(); if (!b || !tools || !tools.length) return '';
      var lines = [];
      tools.forEach(function (t) {
        if (t.type === 'steer' && typeof b.applyRequestBias === 'function') {
          var r = b.applyRequestBias(t);
          lines.push('steer → focus=[' + (r.attentionFocus || []).join(', ') + '] stressBias=' + (Math.round((r.stressBias || 0) * 100) / 100) + (r.valuationLane ? ' lane=' + r.valuationLane : '') + (t.clear ? ' (cleared)' : ''));
        } else if (t.type === 'config' && typeof b.setEnergyConfig === 'function') {
          var c = b.setEnergyConfig(t);
          lines.push('config → autonomy=' + c.autonomy + ' maxConcurrent=' + c.maxConcurrent + ' lanes=[' + (c.lanes || []).join(', ') + ']');
        }
      });
      return lines.join('\n');
    }

    function stampLine() {
      var b = brain(); if (!b || typeof b.getEnergyStateSummary !== 'function') return '';
      var s = b.getEnergyStateSummary();
      var conf = (s.predictionError != null) ? Math.round((1 - s.predictionError) * 100) + '%' : '?';
      var brakeTxt = s.brake ? s.brake.level : '?';
      return 'confidence ' + conf + ' · brake ' + brakeTxt + ' · ' + s.interoceptionCaveat;
    }

    function send() {
      var b = brain();
      if (!b) { add('', '<span class="eab-ai">Energy brain not loaded on this page.</span>'); return; }
      var passcode = (keyInput.value || '').trim();
      if (!passcode) { keyRow.style.display = 'block'; keyInput.focus(); return; }
      try { localStorage.setItem(LS_KEY, passcode); } catch (e) {}
      keyRow.style.display = 'none';
      var prompt = (ta.value || '').trim(); if (!prompt) return;
      ta.value = '';
      add('', '<span class="eab-you">you:</span> ' + esc(prompt));
      var pending = add('', '<span class="eab-ai">…</span>');
      var state = {}; try { state = b.getEnergyStateSummary(); } catch (e) {}
      fetch('/api/energy-agent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode: passcode, prompt: prompt, state: state })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { pending.innerHTML = '<span class="eab-ai">' + esc((j && j.error) || 'error') + '</span>'; return; }
        var html = '<span class="eab-ai">' + esc(j.answer || '') + '</span>';
        var applied = applyTools(j.toolCalls);
        if (applied) html += '<div class="eab-tool">✓ applied to energy domain:\n' + esc(applied) + '</div>';
        html += '<div class="eab-stamp">' + esc(stampLine()) + (typeof j.left === 'number' ? ' · ' + j.left + ' left today' : '') + '</div>';
        pending.innerHTML = html;
        log.scrollTop = log.scrollHeight;
      }).catch(function () { pending.innerHTML = '<span class="eab-ai">network error</span>'; });
    }

    panel.querySelector('#eab-send').onclick = send;
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

    add('', '<span class="eab-ai">Energy domain online. Ask me anything about it, or tell me to steer it (focus a topic, prefer a lane, turn autonomy on/off). I bias the domain; I never force a finding, move capital, or touch code.</span>');
  });
})();
