/**
 * assets/js/command-board-stress.js — Company-level network-stress chip for the
 * Command Board rows. Loaded by each *-command.html page.
 *
 * Reads the slim spider-web stress map (/api/limen-stress-slim, ~tens of KB,
 * Redis-first via limen-worker-stress-refresh) and decorates each company row
 * with a NET STRESS chip (non-hub SEVERE / MODERATE induced stress; HUB_EFFECT
 * skipped — structural connectivity, not distress).
 *
 * Join is robust to sort/filter: it reads the rendered ticker cell and maps
 * ticker -> slug via the page's global DATA array (which carries both), then
 * slug -> stress. No per-page row markup change required; a MutationObserver
 * re-decorates when the table re-renders.
 */
(function () {
  'use strict';

  var _bySlug = null;       // slug -> { induced, total, rank, hub, pushed }
  var _loaded = false;
  var _pending = false;

  function _load() {
    if (typeof fetch !== 'function') return Promise.resolve();
    return fetch('/api/limen-stress-slim')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.bySlug) _bySlug = j.bySlug; _loaded = true; })
      .catch(function () { _loaded = true; /* weighting is additive; absence is fine */ });
  }

  function _tickerToSlug() {
    var map = {};
    var DATA = (typeof window !== 'undefined') ? window.DATA : null;
    if (!Array.isArray(DATA)) return map;
    for (var i = 0; i < DATA.length; i++) {
      var c = DATA[i];
      if (c && c.t && c.s) map[String(c.t).toUpperCase()] = c.s;
    }
    return map;
  }

  function _chip(ns) {
    var col = ns.rank === 'SEVERE' ? '#e85454' : '#e8a054';
    var v = (typeof ns.induced === 'number') ? ' ' + ns.induced.toFixed(1) : '';
    return '<span class="cmd-net-stress" style="margin-left:7px;color:' + col +
      ';font-size:0.82em;letter-spacing:0.5px;white-space:nowrap" ' +
      'title="Spider-web network-induced stress propagated from this company’s stressed counterparties">◉ NET ' +
      ns.rank + v + '</span>';
  }

  function _decorate() {
    if (!_bySlug) return;
    var rows = document.querySelectorAll('tr.expandable');
    if (!rows.length) return;
    var t2s = _tickerToSlug();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.getAttribute('data-ns-done') === '1') continue;
      row.setAttribute('data-ns-done', '1');
      var cells = row.cells;
      if (!cells || cells.length < 3) continue;
      var ticker = (cells[2].textContent || '').trim().toUpperCase();
      var slug = t2s[ticker];
      var ns = slug ? _bySlug[slug] : null;
      if (ns && !ns.hub && (ns.rank === 'SEVERE' || ns.rank === 'MODERATE')) {
        if (!cells[1].querySelector('.cmd-net-stress')) {
          cells[1].insertAdjacentHTML('beforeend', _chip(ns));
        }
      }
    }
  }

  function _schedule() {
    if (_pending) return;
    _pending = true;
    setTimeout(function () { _pending = false; try { _decorate(); } catch (e) {} }, 120);
  }

  function _start() {
    _load().then(_schedule);
    try {
      var obs = new MutationObserver(function () { _schedule(); });
      var body = document.getElementById('tableBody') || document.body;
      obs.observe(body, { childList: true, subtree: true });
    } catch (e) { /* observer unsupported — fall back to delayed passes */ }
    setTimeout(_decorate, 1500);
    setTimeout(_decorate, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _start);
  } else {
    _start();
  }
})();
