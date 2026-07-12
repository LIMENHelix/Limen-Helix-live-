/**
 * structural-parts-panel.js — renders the "asterisk group" on the Observatory:
 * the structural (non-control-organ) brain parts that map to a DIFFERENT KIND of
 * business, grouped by class with the real business family each corresponds to.
 *
 * One-brain / treat-don't-amputate: EVERY part of the brain is on the map. These
 * parts aren't excluded — they're wiring, parameters, views, infrastructure and
 * states, so they map to networks / capital / aggregators / infrastructure /
 * monitors rather than to a control organ. Read-only; sourced from
 * canonical-nodes.json (the class + remapTo authority).
 */
(function () {
  'use strict';

  // structural role (remapTo) -> the real business family it corresponds to.
  var FAM = {
    view:           'Aggregators · holding-cos · indices · platforms',
    edge:           'Networks · rails · logistics · payment-APIs',
    parameter:      'Capital · incentive · trust · signal layers',
    infrastructure: 'Infrastructure · cloud · security · maintenance',
    state:          'Volatility · risk · sentiment monitors',
    effector:       'Execution · operations · delivery'
  };
  var CLASS_LABEL = {
    composite: 'Composites (aggregate views)',
    tract:     'Tracts (wiring / edges)',
    molecule:  'Molecules (signal parameters)',
    glia:      'Glia (infrastructure)',
    construct: 'Constructs (system states)',
    effector:  'Effectors (output / execution)',
    ambiguous: 'Ambiguous (needs classification)'
  };
  var CLASS_ORDER = ['composite', 'tract', 'molecule', 'glia', 'construct', 'effector', 'ambiguous'];

  function famFor(r) { return FAM[r.remapTo] || FAM[r.cls] || 'Structural / support business'; }
  function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }

  function injectStyles() {
    if (document.getElementById('obs-structural-css')) return;
    var s = document.createElement('style'); s.id = 'obs-structural-css';
    s.textContent =
        '#obs-structural{padding:16px 18px 28px;border-top:1px solid rgba(201,169,78,0.12);margin-top:8px}'
      + '#obs-structural .os-head{font-size:0.6rem;letter-spacing:3px;text-transform:uppercase;color:rgba(201,169,78,0.85);margin-bottom:5px}'
      + '#obs-structural .os-sub{font-size:0.62rem;color:rgba(200,195,184,0.55);margin-bottom:14px;line-height:1.55;max-width:780px}'
      + '#obs-structural .os-group{margin-bottom:10px;border:1px solid rgba(201,169,78,0.08);border-radius:4px;background:rgba(8,10,18,0.6);padding:10px 12px}'
      + '#obs-structural .os-group-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:7px}'
      + '#obs-structural .os-class{font-size:0.68rem;color:#e7eef4;letter-spacing:1px}'
      + '#obs-structural .os-fam{font-size:0.58rem;color:rgba(90,181,160,0.9);letter-spacing:1px}'
      + '#obs-structural .os-parts{display:flex;flex-wrap:wrap;gap:5px}'
      + '#obs-structural .os-part{font-size:0.55rem;letter-spacing:0.5px;color:rgba(201,169,78,0.78);border:1px solid rgba(201,169,78,0.14);border-radius:2px;padding:2px 7px;background:rgba(201,169,78,0.03)}'
      + '#obs-structural .os-part .os-full{color:rgba(200,195,184,0.45);margin-left:5px}';
    document.head.appendChild(s);
  }

  function render(nodes) {
    var host = document.getElementById('obs-structural'); if (!host) return;
    var groups = {}, total = 0;
    for (var k in nodes) {
      var r = nodes[k]; if (!r || r.canBindBusiness === true) continue;
      var cls = r.class || r.kind || r.nodeType || 'ambiguous';
      (groups[cls] = groups[cls] || []).push({ id: k, full: r.fullName || r.label || '', remapTo: r.remapTo, cls: cls });
      total++;
    }
    if (!total) { host.innerHTML = ''; return; }
    var h = '<div class="os-head">Structural &middot; Support Businesses</div>';
    h += '<div class="os-sub">Every part of the brain maps to a business. These <b style="color:rgba(201,169,78,0.9)">' + total +
         '</b> parts aren’t control organs — they’re wiring, parameters, views, infrastructure and states, so they map to a different <i>kind</i> of business: a tract is a network, glia is infrastructure, a composite is an aggregator. Kept and labeled here, never excluded.</div>';
    for (var ci = 0; ci < CLASS_ORDER.length; ci++) {
      var c = CLASS_ORDER[ci], arr = groups[c]; if (!arr || !arr.length) continue;
      h += '<div class="os-group"><div class="os-group-head"><span class="os-class">' + esc(CLASS_LABEL[c] || c) +
           ' · ' + arr.length + '</span><span class="os-fam">→ ' + famFor(arr[0]) + '</span></div><div class="os-parts">';
      for (var pi = 0; pi < arr.length; pi++) {
        h += '<span class="os-part">' + esc(arr[pi].id) +
             (arr[pi].full ? '<span class="os-full">' + esc(arr[pi].full) + '</span>' : '') + '</span>';
      }
      h += '</div></div>';
    }
    host.innerHTML = h;
  }

  function boot() {
    if (!document.getElementById('obs-structural')) return;
    injectStyles();
    if (typeof fetch !== 'function') return;
    fetch('assets/data/canonical-nodes.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) render(j.nodes || j); })
      .catch(function () { /* observatory-only, never throw */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
