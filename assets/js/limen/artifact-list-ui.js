/**
 * LIMEN Helix — Artifact List UI
 *
 * Filterable table of all persisted READY-TO-SIGN drafts.
 * Sources: GET /api/limen-engine-output?lane=...&limit=...
 *
 * Filters: lane, status, CIK, free-text search on title.
 * Sort: most recent first; clickable headers for other sorts.
 *
 * Exposed via window.LIMENArtifactListUI.mount(container).
 */
(function (root) {
  'use strict';

  var LANES = ['investment', 'research'];
  var STATUSES = ['READY_TO_SIGN', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

  var _state = {
    container: null,
    records: [],
    filters: {
      lane: '',
      status: '',
      cik: '',
      search: ''
    },
    sort: { col: 'persistedAt', dir: 'desc' },
    loading: false,
    error: null,
    pollTimer: null
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectStyles() {
    if (document.getElementById('lbg-artifact-list-styles')) return;
    var s = document.createElement('style');
    s.id = 'lbg-artifact-list-styles';
    s.textContent = [
      '.lal-root{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f6f6f5;min-height:100vh;padding:24px;box-sizing:border-box}',
      '.lal-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d6d3d1}',
      '.lal-title{font-size:22px;font-weight:600;margin:0;letter-spacing:-0.01em}',
      '.lal-nav{display:flex;gap:14px;font-size:12px}',
      '.lal-nav a{color:#5b73a8;text-decoration:none}',
      '.lal-nav a:hover{text-decoration:underline}',
      '.lal-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px}',
      '.lal-stat{background:#fff;border:1px solid #d6d3d1;padding:10px;border-radius:4px}',
      '.lal-stat-label{font-size:10px;text-transform:uppercase;color:#666;letter-spacing:0.4px}',
      '.lal-stat-val{font-size:18px;font-weight:600;font-family:ui-monospace,Menlo,monospace;margin-top:2px}',
      '.lal-filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}',
      '.lal-filters select,.lal-filters input{font-size:12px;padding:6px 8px;border:1px solid #d6d3d1;border-radius:3px;background:#fff;font-family:inherit}',
      '.lal-filters label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.3px}',
      '.lal-table{width:100%;background:#fff;border:1px solid #d6d3d1;border-collapse:collapse;font-size:12px}',
      '.lal-table th{background:#f0eee9;text-align:left;padding:8px 10px;border-bottom:1px solid #d6d3d1;font-weight:600;cursor:pointer;user-select:none;font-size:11px;text-transform:uppercase;letter-spacing:0.3px}',
      '.lal-table th:hover{background:#e6e3de}',
      '.lal-table td{padding:8px 10px;border-bottom:1px solid #f0eee9;vertical-align:top}',
      '.lal-table tr:hover{background:#fafaf8}',
      '.lal-table tr.clickable{cursor:pointer}',
      '.lal-status{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:0.3px}',
      '.lal-status.READY_TO_SIGN{background:#fff7d6;color:#856404}',
      '.lal-status.SUBMITTED{background:#d6e8ff;color:#264a7a}',
      '.lal-status.UNDER_REVIEW{background:#f0e0ff;color:#5b3577}',
      '.lal-status.APPROVED{background:#d6f0d6;color:#1e5e1e}',
      '.lal-status.REJECTED{background:#ffd6d6;color:#7a2828}',
      '.lal-status.WITHDRAWN{background:#e0e0e0;color:#555}',
      '.lal-lane{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;background:#e6e3de;color:#333}',
      '.lal-lane.patent{background:#d6f0e0;color:#1e5e3e}',
      '.lal-lane.grant{background:#e0d6f0;color:#5b3577}',
      '.lal-lane.sba{background:#d6e8ff;color:#264a7a}',
      '.lal-lane.franchise{background:#f0d6e8;color:#5b2856}',
      '.lal-lane.investment{background:#fff0d6;color:#7a5a18}',
      '.lal-lane.research{background:#f0e8d6;color:#5a4a18}',
      '.lal-empty{padding:48px;text-align:center;color:#666;font-size:14px;background:#fff;border:1px solid #d6d3d1;border-radius:4px}',
      '.lal-mono{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#555}',
      '.lal-refresh{font-size:11px;color:#666;margin-left:auto}'
    ].join('');
    document.head.appendChild(s);
  }

  function applyFilters(records) {
    var f = _state.filters;
    return records.filter(function (r) {
      if (f.lane && r.lane !== f.lane) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.cik && String(r.cik || '').indexOf(f.cik) === -1) return false;
      if (f.search) {
        var t = (r.payload && r.payload.title ? r.payload.title : '').toLowerCase();
        if (t.indexOf(f.search.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function applySort(records) {
    var s = _state.sort;
    var dir = s.dir === 'asc' ? 1 : -1;
    return records.slice().sort(function (a, b) {
      var av, bv;
      if (s.col === 'persistedAt') {
        av = a.freshness && a.freshness.persistedAt || 0;
        bv = b.freshness && b.freshness.persistedAt || 0;
      } else if (s.col === 'lane') {
        av = a.lane || ''; bv = b.lane || '';
      } else if (s.col === 'cik') {
        av = a.cik || ''; bv = b.cik || '';
      } else if (s.col === 'status') {
        av = a.status || ''; bv = b.status || '';
      } else if (s.col === 'title') {
        av = (a.payload && a.payload.title) || '';
        bv = (b.payload && b.payload.title) || '';
      } else { av = 0; bv = 0; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function computeStats(records) {
    var byLane = {}, byStatus = {};
    LANES.forEach(function (l) { byLane[l] = 0; });
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    records.forEach(function (r) {
      if (r.lane && byLane.hasOwnProperty(r.lane)) byLane[r.lane]++;
      if (r.status && byStatus.hasOwnProperty(r.status)) byStatus[r.status]++;
    });
    return { total: records.length, byLane: byLane, byStatus: byStatus };
  }

  function render() {
    if (!_state.container) return;
    injectStyles();

    var filtered = applySort(applyFilters(_state.records));
    var stats = computeStats(_state.records);

    var statsHtml = '<div class="lal-stats">' +
      '<div class="lal-stat"><div class="lal-stat-label">Total</div><div class="lal-stat-val">' + stats.total + '</div></div>' +
      LANES.map(function (l) {
        return '<div class="lal-stat"><div class="lal-stat-label">' + l + '</div>' +
               '<div class="lal-stat-val">' + (stats.byLane[l] || 0) + '</div></div>';
      }).join('') +
      '<div class="lal-stat"><div class="lal-stat-label">Submitted</div><div class="lal-stat-val">' + (stats.byStatus.SUBMITTED || 0) + '</div></div>' +
      '<div class="lal-stat"><div class="lal-stat-label">Approved</div><div class="lal-stat-val">' + (stats.byStatus.APPROVED || 0) + '</div></div>' +
    '</div>';

    var laneOpts = '<option value="">all lanes</option>' +
      LANES.map(function (l) {
        return '<option value="' + l + '"' + (_state.filters.lane === l ? ' selected' : '') + '>' + l + '</option>';
      }).join('');

    var statusOpts = '<option value="">all status</option>' +
      STATUSES.map(function (s) {
        return '<option value="' + s + '"' + (_state.filters.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');

    var filterHtml =
      '<div class="lal-filters">' +
        '<label>Lane</label><select id="lal-lane">' + laneOpts + '</select>' +
        '<label>Status</label><select id="lal-status">' + statusOpts + '</select>' +
        '<label>CIK</label><input id="lal-cik" type="text" placeholder="0001318605" value="' + escapeHtml(_state.filters.cik) + '">' +
        '<label>Search</label><input id="lal-search" type="text" placeholder="title…" value="' + escapeHtml(_state.filters.search) + '">' +
        '<span class="lal-refresh" id="lal-refresh-info"></span>' +
      '</div>';

    var tableHtml;
    if (filtered.length === 0) {
      tableHtml = '<div class="lal-empty">' +
        (_state.records.length === 0 ?
          'No artifacts persisted yet. Master Living Brain produces them via /api/limen-engine-output after the Claude pipeline runs. ' +
          'Force one from <a href="/helix-brain-grid.html" style="color:#5b73a8">/helix-brain-grid.html</a> with ' +
          '<code>LIMEN_HELIX.forceFire(\'grant\', \'0000104169\', \'walmart\')</code>.' :
          'No artifacts match the current filters.') +
        '</div>';
    } else {
      tableHtml = '<table class="lal-table"><thead><tr>' +
        '<th data-col="persistedAt">Date</th>' +
        '<th data-col="lane">Lane</th>' +
        '<th data-col="status">Status</th>' +
        '<th data-col="cik">CIK</th>' +
        '<th data-col="title">Title</th>' +
        '<th>Agency / Format</th>' +
        '<th>Open</th>' +
        '<th>Output ID</th>' +
      '</tr></thead><tbody>' +
        filtered.map(function (r) {
          var ts = r.freshness && r.freshness.persistedAt ?
            new Date(r.freshness.persistedAt).toLocaleString() : '—';
          var lane = r.lane || '—';
          var title = (r.payload && r.payload.title) || (r.lane + ' draft');
          var agency = (r.payload && r.payload.agency_or_office) || '';
          var fmt = (r.payload && r.payload.format_standard) || '';
          var openCount = ((r.payload && r.payload.openItems) || []).length;
          return '<tr class="clickable" data-id="' + escapeHtml(r.outputId) + '">' +
            '<td class="lal-mono">' + escapeHtml(ts) + '</td>' +
            '<td><span class="lal-lane ' + escapeHtml(lane) + '">' + escapeHtml(lane) + '</span></td>' +
            '<td><span class="lal-status ' + escapeHtml(r.status || '') + '">' + escapeHtml(r.status || '—') + '</span></td>' +
            '<td class="lal-mono">' + escapeHtml(r.cik || '—') + '</td>' +
            '<td>' + escapeHtml(title.length > 80 ? title.slice(0, 80) + '…' : title) + '</td>' +
            '<td><div style="font-size:11px">' + escapeHtml(agency) + '</div>' +
                 '<div style="font-size:10px;color:#888">' + escapeHtml(fmt) + '</div></td>' +
            '<td>' + (openCount > 0 ? '<span style="color:#856404;font-weight:600">' + openCount + '</span>' : '—') + '</td>' +
            '<td class="lal-mono">' + escapeHtml((r.outputId || '').slice(0, 24)) + '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table>';
    }

    _state.container.innerHTML = '<div class="lal-root">' +
      '<div class="lal-header">' +
        '<h1 class="lal-title">Persisted Artifacts</h1>' +
        '<div class="lal-nav">' +
          '<a href="/helix-brain-grid.html">← Brain Grid</a>' +
          '<a href="/civilization.html">Civilization</a>' +
        '</div>' +
      '</div>' +
      statsHtml +
      filterHtml +
      tableHtml +
    '</div>';

    // Wire filter handlers
    var laneEl = document.getElementById('lal-lane');
    var statusEl = document.getElementById('lal-status');
    var cikEl = document.getElementById('lal-cik');
    var searchEl = document.getElementById('lal-search');
    if (laneEl) laneEl.addEventListener('change', function () { _state.filters.lane = laneEl.value; render(); });
    if (statusEl) statusEl.addEventListener('change', function () { _state.filters.status = statusEl.value; render(); });
    if (cikEl) cikEl.addEventListener('input', function () { _state.filters.cik = cikEl.value; render(); });
    if (searchEl) searchEl.addEventListener('input', function () { _state.filters.search = searchEl.value; render(); });

    // Wire header sort
    var headers = _state.container.querySelectorAll('th[data-col]');
    headers.forEach(function (h) {
      h.addEventListener('click', function () {
        var col = h.getAttribute('data-col');
        if (_state.sort.col === col) {
          _state.sort.dir = _state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _state.sort.col = col;
          _state.sort.dir = 'desc';
        }
        render();
      });
    });

    // Wire row click → viewer
    var rows = _state.container.querySelectorAll('tr.clickable');
    rows.forEach(function (r) {
      r.addEventListener('click', function () {
        var id = r.getAttribute('data-id');
        if (id) window.location.href = '/helix-artifact.html?id=' + encodeURIComponent(id);
      });
    });

    // Refresh info
    var refreshInfo = document.getElementById('lal-refresh-info');
    if (refreshInfo) {
      refreshInfo.textContent = 'auto-refresh every 10s · ' + filtered.length + ' shown of ' + _state.records.length;
    }
  }

  function fetchAll() {
    if (_state.loading) return;
    _state.loading = true;
    // Pull each lane's records and merge (simpler than a fresh "all" endpoint)
    var fetches = LANES.map(function (lane) {
      return fetch('/api/limen-engine-output?lane=' + lane + '&limit=200', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { return (j && j.ok && Array.isArray(j.records)) ? j.records : []; })
        .catch(function () { return []; });
    });
    return Promise.all(fetches).then(function (laneArrs) {
      var merged = [];
      var seen = {};
      laneArrs.forEach(function (arr) {
        arr.forEach(function (r) {
          if (r && r.outputId && !seen[r.outputId]) {
            seen[r.outputId] = true;
            merged.push(r);
          }
        });
      });
      _state.records = merged;
      _state.loading = false;
      _state.error = null;
      render();
    }).catch(function (err) {
      _state.loading = false;
      _state.error = err.message;
      render();
    });
  }

  function mount(container) {
    if (!container) {
      console.error('[ArtifactListUI] mount() requires container');
      return;
    }
    injectStyles();
    _state.container = container;
    render();
    fetchAll();
    if (_state.pollTimer) clearInterval(_state.pollTimer);
    _state.pollTimer = setInterval(fetchAll, 10000);
  }

  root.LIMENArtifactListUI = {
    mount: mount,
    refresh: fetchAll
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
