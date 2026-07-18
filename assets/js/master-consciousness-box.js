/**
 * master-consciousness-box.js — the MASTER operator AI box (the unified consciousness).
 *
 * Each domain has its own "Ask X" box (domain-agent-box.js) that faces ONE domain's
 * self-model. This is the one level up: a single conversational surface that faces
 * ALL 20 domains' self-models at once — the "main brain with new facing logic from
 * every domain." It reads each live brain's getStateSummary()/getEnergyStateSummary()
 * (stress, phase, regulation, immune, active diagnoses, top opportunities, and the new
 * MULTIMODAL INTEROCEPTION channel/divergence), and synthesizes across them.
 *
 * Mounts only on the civilization page (all 20 brains loaded, no ?domain=). The
 * deterministic master-brain readout (unified-consciousness-panel.js) shows the
 * observe-only arbiter; THIS box is the language layer the operator talks to.
 *
 * TWO MODES, auto-selected (mirrors the per-domain box):
 *  - AI (Sonnet 5): passcode entered AND billing on -> POST /api/master-agent.
 *  - LOCAL (free): no passcode, or the API is unavailable -> deterministic synthesis
 *    over the live self-models. Fully works offline; upgrades the moment billing is on.
 *
 * OBSERVE / SYNTHESIZE ONLY. The master box reads and reasons across domains; it does
 * NOT steer or reconfigure individual domains (that stays in each domain's own box, by
 * design — one place to change one domain). No code, no capital, no forced findings.
 */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function pct(v) { return (typeof v === 'number') ? Math.round(v * 100) + '%' : '?'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Gather every domain's live self-model ─────────────────────────────
  function models() {
    var out = [];
    try {
      var reg = window.LIMENDomainBrains;
      var all = (reg && reg.getAll) ? reg.getAll() : null;
      if (!all) return out;
      for (var k in all) {
        if (!all.hasOwnProperty(k)) continue;
        var b = all[k]; if (!b) continue;
        var s = null;
        try { s = (typeof b.getEnergyStateSummary === 'function') ? b.getEnergyStateSummary() : (typeof b.getStateSummary === 'function') ? b.getStateSummary() : null; } catch (e) { s = null; }
        if (s) { s._domain = s.domain || k; s._label = s.label || cap(k); out.push(s); }
      }
    } catch (e) {}
    return out;
  }

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function intero(m) { return (m && m.interoception && typeof m.interoception === 'object') ? m.interoception : null; }

  // ── Deterministic cross-domain synthesis (the free local brain) ───────
  function blindChannels(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) { var it = intero(ms[i]); if (it && it.salience === 'blind-channel') out.push({ label: ms[i]._label, attend: it.attend, divergence: it.divergence }); }
    return out.sort(function (a, b) { return (b.divergence || 0) - (a.divergence || 0); });
  }
  function financialOnly(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) { var it = intero(ms[i]); if (it && it.salience === 'financial-only') out.push({ label: ms[i]._label, divergence: it.divergence }); }
    return out;
  }
  // NODE-GROUNDED PHASE divergence: the domain's own kernel-scored companies disagree with its
  // stress-heuristic phase. A real, checkable signal (audited financials), NOT the wiring artifact.
  function groundedDivergent(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m && m.phaseGrounded && m.phaseDivergent) out.push({ label: m._label, prior: m.phasePrior, grounded: m.phaseLabel || m.phase, stress: num(m.stress) }); }
    return out.sort(function (a, b) { return (b.stress || 0) - (a.stress || 0); });
  }
  function byStress(ms) { return ms.slice().sort(function (a, b) { return (num(b.stress) || 0) - (num(a.stress) || 0); }); }
  function immuneFlags(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) { var im = ms[i].immune; if (im === 'alert' || im === 'active') out.push({ label: ms[i]._label, immune: im }); }
    var rank = { alert: 0, active: 1 };
    return out.sort(function (a, b) { return rank[a.immune] - rank[b.immune]; });
  }
  function allOpportunities(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) {
      var o = ms[i].topOpportunities || [];
      for (var j = 0; j < o.length; j++) out.push({ label: ms[i]._label, title: o[j].title, path: o[j].path, confidence: num(o[j].confidence) });
    }
    return out.sort(function (a, b) { return (b.confidence || 0) - (a.confidence || 0); });
  }
  function activeDx(ms) {
    var out = [];
    for (var i = 0; i < ms.length; i++) {
      var d = ms[i].activeDiagnoses || [];
      for (var j = 0; j < d.length; j++) out.push({ label: ms[i]._label, id: d[j].id, relevance: num(d[j].relevance), blocked: !!d[j].blocked });
    }
    return out.sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
  }
  function meanStress(ms) { if (!ms.length) return null; var s = 0, n = 0; for (var i = 0; i < ms.length; i++) { var v = num(ms[i].stress); if (v != null) { s += v; n++; } } return n ? s / n : null; }

  function overview(ms) {
    if (!ms.length) return 'No domain self-models are live yet — give the brains a moment to cycle, then ask again.';
    var hot = byStress(ms), blind = blindChannels(ms), imm = immuneFlags(ms), ms2 = meanStress(ms);
    var lines = [];
    lines.push(ms.length + ' domains online · mean stress ' + pct(ms2) + '.');
    lines.push('Most stressed: ' + hot.slice(0, 3).map(function (m) { return m._label + ' ' + pct(m.stress); }).join(', ') + '.');
    if (blind.length) lines.push('BLIND-CHANNEL divergence (calm on money, alarmed elsewhere) in ' + blind.length + ': ' + blind.slice(0, 4).map(function (b) { return b.label + '→' + b.attend; }).join(', ') + '. These are where the single financial read would miss the distress.');
    else lines.push('No blind-channel divergence right now — financial reads agree with the other channels.');
    var gdiv = groundedDivergent(ms);
    if (gdiv.length) lines.push('NODE-GROUNDED PHASE divergence in ' + gdiv.length + ': ' + gdiv.slice(0, 4).map(function (g) { return g.label + ' companies read ' + g.grounded + ' vs stress-heuristic ' + g.prior; }).join(', ') + '. The domain\'s own kernel-scored companies disagree with its stress read — a real, checkable signal (audited financials), not the financial-only wiring artifact.');
    if (imm.length) lines.push('Immune: ' + imm.map(function (x) { return x.label + ' ' + x.immune; }).join(', ') + '.');
    var opp = allOpportunities(ms);
    lines.push(opp.length + ' opportunities surfaced across domains' + (opp.length ? '; top: ' + opp[0].label + ' — ' + opp[0].title : '') + '.');
    return lines.join('\n');
  }

  function answerLocal(prompt, ms) {
    var p = String(prompt || '').toLowerCase().trim();
    if (!ms.length) return overview(ms);

    if (/(blind|diverg|missing|ignor|interocep|channel|aware|alexithy|what.*miss)/.test(p)) {
      var blind = blindChannels(ms), fin = financialOnly(ms);
      if (!blind.length && !fin.length) return 'No channel divergence across the 20 domains right now — every domain\'s financial read agrees with its prediction/regulation/immune/allostatic channels.';
      var out = [];
      if (blind.length) out.push('BLIND CHANNEL (financial calm, another channel alarmed — the single-channel read would miss this): ' + blind.map(function (b) { return b.label + ' → ' + b.attend + ' (divergence ' + pct(b.divergence) + ')'; }).join('; ') + '.');
      if (fin.length) out.push('FINANCIAL-ONLY (money alarmed, other channels calm — possible overreaction): ' + fin.map(function (b) { return b.label; }).join(', ') + '.');
      return out.join('\n');
    }
    if (/(stress|hot|worst|most.*(stress|distress)|risk|pressure|tension)/.test(p)) {
      var hot = byStress(ms).slice(0, 8);
      return 'Stress ranking: ' + hot.map(function (m) { return m._label + ' ' + pct(m.stress) + (intero(m) && intero(m).salience !== 'aligned' ? ' [' + intero(m).salience + ']' : ''); }).join(', ') + '.';
    }
    if (/(immune|integrity|antigen|alert|contaminat|quarantine)/.test(p)) {
      var imm = immuneFlags(ms);
      return imm.length ? ('Immune flags: ' + imm.map(function (x) { return x.label + ' — ' + x.immune; }).join(', ') + '.') : 'All domains immune-clear or watch — no active/alert integrity flags.';
    }
    // NB: no bare 'trade' here — it is also a domain name; domain-specific questions
    // ("about trade") fall through to the per-domain branch below.
    if (/(opportun|money|invest|deal|where|position|revenue|profit)/.test(p)) {
      var opp = allOpportunities(ms).slice(0, 8);
      return opp.length ? ('Top opportunities across domains: ' + opp.map(function (o) { return o.label + ' — ' + o.title + ' [' + o.path + ', ' + o.confidence + ']'; }).join(' | ')) : 'No opportunities surfaced across the domains right now.';
    }
    if (/(diagnos|problem|wrong|distress|issue|active|dysreg)/.test(p)) {
      var dx = activeDx(ms).slice(0, 8);
      return dx.length ? ('Active diagnoses (across domains): ' + dx.map(function (d) { return d.label + ':' + d.id + ' (' + pct(d.relevance) + (d.blocked ? ', blocked' : '') + ')'; }).join(', ')) : 'No active diagnoses across the domains right now.';
    }
    if (/(overview|summary|status|how.*(system|everything|things)|state of|all domains|report)/.test(p)) return overview(ms);
    // Name a specific domain?
    for (var i = 0; i < ms.length; i++) {
      if (p.indexOf(String(ms[i]._domain).toLowerCase()) !== -1 || p.indexOf(String(ms[i]._label).toLowerCase()) !== -1) {
        var m = ms[i], it = intero(m);
        return m._label + ': stress ' + pct(m.stress) + ', ' + (m.phaseLabel || m.phase || 'phase ?') + ', regulation ' + (m.regulation || '?') + ', immune ' + (m.immune || '?') + '. ' + (it ? ('Interoception: ' + it.salience + (it.attend ? ' (attend ' + it.attend + ')' : '') + '.') : 'Single-channel read.') + ' Open its own box to steer it.';
      }
    }
    return overview(ms);
  }

  if (typeof window !== 'undefined') window.__masterConsciousnessLocal = { models: models, overview: overview, answer: answerLocal };

  ready(function () {
    if (window.__masterConsciousnessBox) return;
    // Mount only where the whole system is present and no single domain is selected.
    var params = new URLSearchParams(window.location.search);
    if (params.get('domain')) return;                      // a single-domain page uses its own box
    if (!window.LIMENDomainBrains || !window.LIMENDomainBrains.getAll) return;
    window.__masterConsciousnessBox = true;

    var LS_KEY = 'limenMasterAgentKey';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

    var css = document.createElement('style');
    css.textContent =
      '#mcb-toggle{position:fixed;left:18px;bottom:18px;z-index:99998;background:#141a2e;color:#d7c9a0;border:1px solid rgba(201,169,78,.45);border-radius:22px;padding:9px 15px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.45)}' +
      '#mcb-toggle:hover{background:#1b2440}' +
      '#mcb{position:fixed;left:18px;bottom:64px;width:380px;max-width:94vw;height:540px;max-height:80vh;z-index:99999;background:#0c0f1c;border:1px solid rgba(201,169,78,.28);border-radius:14px;display:none;flex-direction:column;box-shadow:0 10px 44px rgba(0,0,0,.6);overflow:hidden}' +
      '#mcb.open{display:flex}' +
      '#mcb .mcb-h{padding:10px 12px;border-bottom:1px solid rgba(201,169,78,.18);color:#c9a94e;font:600 13px system-ui;display:flex;justify-content:space-between;align-items:center}' +
      '#mcb .mcb-h b{color:#e9dcb4;letter-spacing:1px}' +
      '#mcb .mcb-x{cursor:pointer;color:#8a90a8;font:600 11px system-ui;letter-spacing:.04em}' +
      '#mcb .mcb-log{flex:1;overflow-y:auto;padding:10px 12px;font:13px/1.5 system-ui;color:#cdd3ec;-webkit-user-select:text;user-select:text;cursor:auto}' +
      '#mcb .mcb-msg{margin-bottom:12px}' +
      '#mcb .mcb-you{color:#c9a94e}' +
      '#mcb .mcb-ai{color:#d8d2c5;white-space:pre-wrap}' +
      '#mcb .mcb-stamp{margin-top:4px;font:10px/1.4 system-ui;color:#6a6458}' +
      '#mcb .mcb-in{border-top:1px solid rgba(201,169,78,.18);padding:8px;display:flex;gap:6px}' +
      '#mcb textarea{flex:1;resize:none;height:38px;background:#12172a;border:1px solid rgba(201,169,78,.22);border-radius:8px;color:#e0e4f5;padding:8px;font:13px system-ui}' +
      '#mcb button.mcb-send{background:#3a3212;color:#e9dcb4;border:1px solid rgba(201,169,78,.4);border-radius:8px;padding:0 14px;cursor:pointer;font:600 13px system-ui}' +
      '#mcb .mcb-key{padding:6px 12px;border-top:1px solid rgba(201,169,78,.12)}' +
      '#mcb .mcb-key input{width:100%;background:#12172a;border:1px solid rgba(201,169,78,.22);border-radius:8px;color:#e0e4f5;padding:6px;font:12px system-ui}' +
      '#mcb .mcb-key label{display:block;color:#6a6458;font:10px system-ui;margin-bottom:3px}';
    document.head.appendChild(css);

    var toggle = document.createElement('div'); toggle.id = 'mcb-toggle'; toggle.textContent = 'Ask the System';
    var panel = document.createElement('div'); panel.id = 'mcb';
    panel.innerHTML =
      '<div class="mcb-h"><span><b>UNIFIED CONSCIOUSNESS</b> · all 20 domains</span><span class="mcb-x">CLOSE</span></div>' +
      '<div class="mcb-log" id="mcb-log"></div>' +
      '<div class="mcb-key"><label>optional: operator passcode for AI mode (blank = free local synthesis)</label><input id="mcb-key" type="password" placeholder="passcode (optional)"></div>' +
      '<div class="mcb-in"><textarea id="mcb-t" placeholder="Ask across all domains: what am I missing? · most stressed? · where\'s the money? · immune alerts?"></textarea><button class="mcb-send" id="mcb-send">Send</button></div>';
    document.body.appendChild(toggle); document.body.appendChild(panel);

    var log = panel.querySelector('#mcb-log');
    var ta = panel.querySelector('#mcb-t');
    var keyInput = panel.querySelector('#mcb-key');
    var saved = ''; try { saved = localStorage.getItem(LS_KEY) || ''; } catch (e) {}
    if (saved) keyInput.value = saved;

    toggle.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) ta.focus(); };
    panel.querySelector('.mcb-x').onclick = function () { panel.classList.remove('open'); };
    function add(html) { var d = document.createElement('div'); d.className = 'mcb-msg'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
    function stamp(mode, ms, left) { return (mode || '') + (typeof left === 'number' ? ' · ' + left + ' AI left today' : '') + ' · reading ' + ms.length + '/20 self-models · ' + (blindChannels(ms).length) + ' blind-channel'; }
    function renderResult(pending, answer, mode, ms, left) {
      pending.innerHTML = '<span class="mcb-ai">' + esc(answer || '') + '</span><div class="mcb-stamp">' + esc(stamp(mode, ms, left)) + '</div>';
      log.scrollTop = log.scrollHeight;
    }

    function send() {
      var prompt = (ta.value || '').trim(); if (!prompt) return;
      ta.value = '';
      add('<span class="mcb-you">you:</span> ' + esc(prompt));
      var pending = add('<span class="mcb-ai">…</span>');
      var ms = models();
      var localAns = answerLocal(prompt, ms);
      var passcode = (keyInput.value || '').trim();
      if (!passcode) { renderResult(pending, localAns, 'local (free)', ms, null); return; }
      try { localStorage.setItem(LS_KEY, passcode); } catch (e) {}
      // Compact per-domain projection for the model (keep the payload small).
      var compact = ms.map(function (m) { var it = intero(m); return { domain: m._domain, label: m._label, stress: m.stress, phase: m.phaseLabel || m.phase, phaseGrounded: !!m.phaseGrounded, phaseDivergent: !!m.phaseDivergent, phasePrior: m.phasePrior || null, phaseSource: m.phaseSource || null, regulation: m.regulation, immune: m.immune, salience: it && it.salience, attend: it && it.attend, divergence: it && it.divergence, topDx: (m.activeDiagnoses || [])[0] && (m.activeDiagnoses[0].id), topOpp: (m.topOpportunities || [])[0] && (m.topOpportunities[0].title) }; });
      fetch('/api/master-agent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode: passcode, prompt: prompt, models: compact })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) renderResult(pending, j.answer, 'AI', ms, j.left);
        else renderResult(pending, localAns, 'local (AI off: ' + esc((j && j.error) || 'unavailable') + ')', ms, null);
      }).catch(function () { renderResult(pending, localAns, 'local (AI unreachable)', ms, null); });
    }
    panel.querySelector('#mcb-send').onclick = send;
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

    add('<span class="mcb-ai">Unified consciousness online (free local synthesis). I read all 20 domains\' self-models at once — stress, immunity, and the multimodal interoception channels — and reason across them. Ask: "what am I missing?", "most stressed?", "where\'s the money?", "immune alerts?", or name a domain. I synthesize; to steer one domain, open its own box. Add a passcode for conversational AI once billing is on.</span>');
  });
})();
