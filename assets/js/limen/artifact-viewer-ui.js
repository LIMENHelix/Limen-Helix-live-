/**
 * LIMEN Helix — Artifact Viewer UI
 *
 * Renders a single persisted READY-TO-SIGN draft loaded from
 *   GET /api/limen-engine-output?id={outputId}
 *
 * Layout:
 *   ┌──────────────────────────────┬───────────────────┐
 *   │  Title + meta (lane, agency) │  Open Items       │
 *   │  Rendered Markdown draftBody │  Checklist        │
 *   │                              │  Provenance       │
 *   │                              │  Actions (PATCH)  │
 *   │                              │  Citations Used   │
 *   └──────────────────────────────┴───────────────────┘
 *
 * Exposed via window.LIMENArtifactViewerUI.
 * Requires: LIMENMarkdownRenderer.
 */
(function (root) {
  'use strict';

  var MD = root.LIMENMarkdownRenderer;
  if (!MD) {
    console.error('[ArtifactViewerUI] requires LIMENMarkdownRenderer');
    return;
  }

  var STATUS_OPTIONS = [
    'READY_TO_SIGN',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
  ];

  function injectStyles() {
    if (document.getElementById('lbg-artifact-viewer-styles')) return;
    var s = document.createElement('style');
    s.id = 'lbg-artifact-viewer-styles';
    s.textContent = [
      '.lav-root{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f6f6f5;min-height:100vh;padding:24px;box-sizing:border-box}',
      '.lav-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid #d6d3d1;margin-bottom:24px}',
      '.lav-title{font-size:24px;font-weight:600;margin:0 0 6px;letter-spacing:-0.01em}',
      '.lav-meta{font-size:12px;color:#666;font-family:ui-monospace,Menlo,monospace}',
      '.lav-back{font-size:12px;color:#5b73a8;text-decoration:none}',
      '.lav-back:hover{text-decoration:underline}',
      '.lav-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px}',
      '.lav-main{background:#fff;border:1px solid #d6d3d1;border-radius:6px;padding:32px 40px;line-height:1.6;max-width:none;color:#1a1a1a}',
      '.lav-main h1{font-size:24px;font-weight:700;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid #d6d3d1}',
      '.lav-main h2{font-size:18px;font-weight:600;margin:20px 0 10px;color:#1a1a1a}',
      '.lav-main h3{font-size:15px;font-weight:600;margin:16px 0 8px;color:#333}',
      '.lav-main h4{font-size:13px;font-weight:600;margin:14px 0 6px;color:#444;text-transform:uppercase;letter-spacing:0.4px}',
      '.lav-main p{margin:8px 0;font-size:14px}',
      '.lav-main ul,.lav-main ol{padding-left:24px;margin:8px 0;font-size:14px}',
      '.lav-main li{margin:2px 0}',
      '.lav-main code{background:#f0eee9;padding:1px 5px;border-radius:3px;font-size:12px;font-family:ui-monospace,Menlo,monospace}',
      '.lav-main pre{background:#f0eee9;padding:12px;border-radius:4px;overflow:auto;font-size:12px}',
      '.lav-main pre code{background:transparent;padding:0}',
      '.lav-main blockquote{border-left:3px solid #d6d3d1;padding:4px 12px;margin:12px 0;color:#555}',
      '.lav-main hr{border:none;border-top:1px solid #d6d3d1;margin:20px 0}',
      '.lav-main table{border-collapse:collapse;margin:14px 0;font-size:12px;width:100%}',
      '.lav-main th{background:#f0eee9;text-align:left;padding:6px 10px;border:1px solid #d6d3d1;font-weight:600}',
      '.lav-main td{padding:6px 10px;border:1px solid #d6d3d1;vertical-align:top}',
      '.lav-main a{color:#5b73a8;text-decoration:underline}',
      '.lav-side{display:flex;flex-direction:column;gap:14px}',
      '.lav-card{background:#fff;border:1px solid #d6d3d1;border-radius:6px;padding:14px}',
      '.lav-card-title{font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#666;margin:0 0 10px;font-weight:600}',
      '.lav-status{display:inline-block;padding:3px 8px;border-radius:3px;font-size:11px;font-weight:600;letter-spacing:0.3px}',
      '.lav-status.READY_TO_SIGN{background:#fff7d6;color:#856404}',
      '.lav-status.SUBMITTED{background:#d6e8ff;color:#264a7a}',
      '.lav-status.UNDER_REVIEW{background:#f0e0ff;color:#5b3577}',
      '.lav-status.APPROVED{background:#d6f0d6;color:#1e5e1e}',
      '.lav-status.REJECTED{background:#ffd6d6;color:#7a2828}',
      '.lav-status.WITHDRAWN{background:#e0e0e0;color:#555}',
      '.lav-openitem{padding:8px;border-radius:4px;margin-bottom:6px;font-size:12px;line-height:1.4}',
      '.lav-openitem.CITATION_NEEDED{background:#ffe7d6;color:#7a4a18}',
      '.lav-openitem.NEWS_NEEDED{background:#ffe7d6;color:#7a4a18}',
      '.lav-openitem.DATA_NEEDED{background:#fff7d6;color:#7a5a18}',
      '.lav-openitem.VERIFY{background:#f0e7d6;color:#5a4a28}',
      '.lav-openitem.SPECIALIST_REVIEW{background:#f0d6e0;color:#5a285a}',
      '.lav-openitem .lav-kind{font-weight:700;font-size:10px;text-transform:uppercase}',
      '.lav-check{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0eee9;font-size:12px}',
      '.lav-check:last-child{border-bottom:none}',
      '.lav-check-status{font-size:10px;font-weight:600;letter-spacing:0.3px}',
      '.lav-check-status.DONE{color:#1e5e1e}',
      '.lav-check-status.PENDING{color:#856404}',
      '.lav-check-status.BLOCKED{color:#7a2828}',
      '.lav-provenance{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#555;line-height:1.6}',
      '.lav-action-btn{display:block;width:100%;padding:8px;margin-bottom:6px;background:#1a1a1a;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.3px}',
      '.lav-action-btn:hover{background:#333}',
      '.lav-action-btn.secondary{background:#fff;color:#1a1a1a;border:1px solid #d6d3d1}',
      '.lav-action-btn.secondary:hover{background:#f0eee9}',
      '.lav-action-btn.danger{background:#7a2828}',
      '.lav-action-btn:disabled{opacity:0.5;cursor:not-allowed}',
      '.lav-citation-row{padding:5px 0;border-bottom:1px solid #f0eee9;font-size:11px;line-height:1.4}',
      '.lav-citation-row:last-child{border-bottom:none}',
      '.lav-citation-doi{font-family:ui-monospace,Menlo,monospace;color:#5b73a8;font-size:10px}',
      '.lav-banned{background:#ffd6d6;color:#7a2828;padding:10px;border-radius:4px;margin-bottom:14px;font-size:12px}',
      '.lav-error{background:#ffd6d6;color:#7a2828;padding:14px;border-radius:4px;font-family:ui-monospace,Menlo,monospace;font-size:12px}',
      '.lav-loading{padding:48px;text-align:center;color:#666}',
      // Placeholder badges (from markdown renderer)
      '.lbg-ph{display:inline-block;padding:1px 6px;margin:0 2px;border-radius:3px;font-size:12px;font-family:ui-monospace,Menlo,monospace}',
      '.lbg-ph-citation-needed{background:#ffe7d6;color:#7a4a18}',
      '.lbg-ph-news-needed{background:#ffe7d6;color:#7a4a18}',
      '.lbg-ph-data-needed{background:#fff7d6;color:#7a5a18}',
      '.lbg-ph-verify{background:#f0e7d6;color:#5a4a28}',
      '.lbg-ph-specialist-review{background:#f0d6e0;color:#5a285a}',
      '@media print{.lav-side{display:none}.lav-grid{grid-template-columns:1fr}.lav-back,.lav-action-btn{display:none}.lav-main{border:none;padding:0;box-shadow:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  function renderError(container, message) {
    container.innerHTML = '<div class="lav-root"><div class="lav-error">' +
      MD.escapeHtml(message) + '</div></div>';
  }

  function renderLoading(container) {
    container.innerHTML = '<div class="lav-root"><div class="lav-loading">Loading artifact…</div></div>';
  }

  function renderArtifact(container, record) {
    var payload = record.payload || {};
    var structured = payload.structured || {};
    var title = payload.title || (structured && structured.title) || (record.lane + ' draft');
    var lane = record.lane || 'unknown';
    var agency = payload.agency_or_office || (structured && structured.agency_or_office) || '';
    var format = payload.format_standard || (structured && structured.format_standard) || '';
    var status = record.status || 'READY_TO_SIGN';
    var draftBody = payload.draftBody || '';
    var openItems = payload.openItems || (structured && structured.openItems) || [];
    var checklist = payload.readyToSignChecklist || (structured && structured.readyToSignChecklist) || [];
    var bannedHits = payload.bannedHits || [];
    var citations = payload.citations || [];

    var bannedSection = '';
    if (bannedHits && bannedHits.length) {
      bannedSection = '<div class="lav-banned"><strong>Internal-vocabulary leak detected:</strong> ' +
        bannedHits.map(function (h) { return MD.escapeHtml(h.term || ''); }).join(', ') +
        '. Status forced to non-ready until cleaned. Re-generate or edit before submission.</div>';
    }

    var openItemsHtml = openItems.length ? openItems.map(function (oi) {
      var kind = String(oi.kind || 'VERIFY').replace(/[^A-Z_]/g, '');
      return '<div class="lav-openitem ' + MD.escapeHtml(kind) + '">' +
             '<div class="lav-kind">' + MD.escapeHtml(kind) + (oi.blocking ? ' · BLOCKING' : '') + '</div>' +
             MD.escapeHtml(oi.description || '') + '</div>';
    }).join('') : '<div style="font-size:12px;color:#888">none</div>';

    var checklistHtml = checklist.length ? checklist.map(function (c) {
      var st = String(c.status || 'PENDING').toUpperCase();
      return '<div class="lav-check">' +
             '<div>' + MD.escapeHtml(c.item || '') + '</div>' +
             '<div class="lav-check-status ' + MD.escapeHtml(st) + '">' + MD.escapeHtml(st) + '</div>' +
             '</div>';
    }).join('') : '<div style="font-size:12px;color:#888">none</div>';

    var citationsHtml = citations.length ? citations.map(function (c) {
      var src = c.source || (c.author && c.year ? (c.author + ' (' + c.year + ')') : '');
      return '<div class="lav-citation-row">' +
             MD.escapeHtml(src || c.title || '—') +
             (c.doi ? '<div class="lav-citation-doi">DOI: ' + MD.escapeHtml(c.doi) + '</div>' : '') +
             '</div>';
    }).join('') : '<div style="font-size:12px;color:#888">no traceable citations emitted</div>';

    var statusOptions = STATUS_OPTIONS.map(function (s) {
      return '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s + '</option>';
    }).join('');

    var generatedAt = record.freshness && record.freshness.persistedAt ?
      new Date(record.freshness.persistedAt).toLocaleString() : '—';

    var provenanceHtml =
      '<div>Output ID: <strong>' + MD.escapeHtml(record.outputId || '') + '</strong></div>' +
      '<div>Persisted: ' + MD.escapeHtml(generatedAt) + '</div>' +
      '<div>Content hash: ' + MD.escapeHtml((record.contentHash || '').slice(0, 16)) + '</div>' +
      '<div>Chain sig: ' + MD.escapeHtml((record.provenance && record.provenance.chainSig || '').slice(0, 16)) + '</div>' +
      '<div>Source pattern: ' + MD.escapeHtml((record.sourcePatternSig || '').slice(0, 16)) + '</div>' +
      '<div>Engine: ' + MD.escapeHtml(record.engineId || '') + '</div>' +
      '<div>Lane: ' + MD.escapeHtml(lane) + '</div>' +
      (payload.claudeModel ? '<div>Model: ' + MD.escapeHtml(payload.claudeModel) + '</div>' : '') +
      (payload.claudeUsage ? '<div>Tokens in/out: ' +
        (payload.claudeUsage.input_tokens || '?') + ' / ' +
        (payload.claudeUsage.output_tokens || '?') +
        (payload.claudeUsage.cache_read_input_tokens ?
          ' (cache hit: ' + payload.claudeUsage.cache_read_input_tokens + ')' : '') +
        '</div>' : '');

    container.innerHTML =
      '<div class="lav-root">' +
        '<div class="lav-header">' +
          '<div>' +
            '<a href="/helix-artifacts.html" class="lav-back">← All artifacts</a>' +
            '<h1 class="lav-title">' + MD.escapeHtml(title) + '</h1>' +
            '<div class="lav-meta">' +
              '<span class="lav-status ' + MD.escapeHtml(status) + '">' + MD.escapeHtml(status) + '</span>' +
              '  ·  ' + MD.escapeHtml(lane.toUpperCase()) +
              (agency ? '  ·  ' + MD.escapeHtml(agency) : '') +
              (format ? '  ·  ' + MD.escapeHtml(format) : '') +
              (record.cik ? '  ·  CIK ' + MD.escapeHtml(record.cik) : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="lav-grid">' +
          '<div class="lav-main" id="lav-md-body">' +
            bannedSection +
            MD.render(draftBody) +
          '</div>' +
          '<div class="lav-side">' +
            '<div class="lav-card">' +
              '<div class="lav-card-title">Actions</div>' +
              '<button class="lav-action-btn" id="lav-copy">Copy Markdown</button>' +
              '<button class="lav-action-btn secondary" id="lav-download">Download .md</button>' +
              '<button class="lav-action-btn secondary" id="lav-print">Print / Export PDF</button>' +
              '<div style="margin-top:10px;font-size:11px;color:#666">Promote status (requires human decision):</div>' +
              '<select id="lav-status-sel" style="width:100%;padding:6px;margin:6px 0;font-size:12px">' + statusOptions + '</select>' +
              '<button class="lav-action-btn" id="lav-promote">Save status change</button>' +
              '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#666">Record outcome event (feeds kernel writeback):</div>' +
              '<select id="lav-outcome-type" style="width:100%;padding:6px;margin:6px 0;font-size:12px">' +
                '<option value="">— select outcome —</option>' +
                '<option value="OUTCOME_REVENUE">OUTCOME_REVENUE</option>' +
                '<option value="OUTCOME_PATENT_ISSUED">OUTCOME_PATENT_ISSUED</option>' +
                '<option value="OUTCOME_GRANT_AWARDED">OUTCOME_GRANT_AWARDED</option>' +
                '<option value="OUTCOME_FRANCHISE_SIGNED">OUTCOME_FRANCHISE_SIGNED</option>' +
                '<option value="OUTCOME_INVESTMENT_PNL">OUTCOME_INVESTMENT_PNL</option>' +
              '</select>' +
              '<input type="number" id="lav-outcome-amount" placeholder="amount (USD, optional)" style="width:100%;padding:6px;margin:4px 0;font-size:12px;box-sizing:border-box">' +
              '<input type="text" id="lav-outcome-ref" placeholder="external ref (USPTO no, NOFO id, etc.)" style="width:100%;padding:6px;margin:4px 0;font-size:12px;box-sizing:border-box">' +
              '<button class="lav-action-btn" id="lav-outcome-submit" style="margin-top:4px">Record outcome</button>' +
              '<div id="lav-outcome-status" style="font-size:10px;color:#666;margin-top:6px;min-height:1em"></div>' +
            '</div>' +
            '<div class="lav-card">' +
              '<div class="lav-card-title">Open Items (' + openItems.length + ')</div>' +
              openItemsHtml +
            '</div>' +
            '<div class="lav-card">' +
              '<div class="lav-card-title">Ready-to-Sign Checklist (' + checklist.length + ')</div>' +
              checklistHtml +
            '</div>' +
            '<div class="lav-card">' +
              '<div class="lav-card-title">Citations Used (' + citations.length + ')</div>' +
              citationsHtml +
            '</div>' +
            '<div class="lav-card">' +
              '<div class="lav-card-title">Provenance</div>' +
              '<div class="lav-provenance">' + provenanceHtml + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Wire actions
    var copyBtn = document.getElementById('lav-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(draftBody).then(function () {
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy Markdown'; }, 1200);
        });
      });
    }
    var dlBtn = document.getElementById('lav-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        var blob = new Blob([draftBody], { type: 'text/markdown' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (record.outputId || 'artifact') + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
    var outcomeBtn = document.getElementById('lav-outcome-submit');
    if (outcomeBtn) {
      outcomeBtn.addEventListener('click', function () {
        var typeSel = document.getElementById('lav-outcome-type');
        var amountEl = document.getElementById('lav-outcome-amount');
        var refEl = document.getElementById('lav-outcome-ref');
        var statusEl = document.getElementById('lav-outcome-status');
        var eventType = typeSel && typeSel.value;
        if (!eventType) { statusEl.textContent = 'pick an outcome type'; return; }
        var amount = amountEl && amountEl.value ? parseFloat(amountEl.value) : null;
        var ref = refEl && refEl.value ? refEl.value.trim() : null;
        outcomeBtn.disabled = true;
        statusEl.textContent = 'Recording…';
        var ocHeaders = { 'content-type': 'application/json' };
        if (typeof window !== 'undefined' && window.LIMEN_OPERATOR_TOKEN) {
          ocHeaders.authorization = 'Bearer ' + window.LIMEN_OPERATOR_TOKEN;
        }
        fetch('/api/limen-outcome', {
          method: 'POST',
          headers: ocHeaders,
          body: JSON.stringify({
            outputId: record.outputId,
            eventType: eventType,
            actor: 'viewer-ui',
            amount: amount,
            externalRefId: ref,
            lane: record.lane
          })
        })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            statusEl.textContent = 'Recorded ✓ ' + (j.eventId || '');
            if (typeSel) typeSel.value = '';
            if (amountEl) amountEl.value = '';
            if (refEl) refEl.value = '';
          } else {
            statusEl.textContent = 'Failed: ' + (j && (j.error || j.reason) || 'unknown');
          }
          outcomeBtn.disabled = false;
        })
        .catch(function (err) {
          statusEl.textContent = 'Failed: ' + err.message;
          outcomeBtn.disabled = false;
        });
      });
    }

    var printBtn = document.getElementById('lav-print');
    if (printBtn) {
      printBtn.addEventListener('click', function () { window.print(); });
    }
    var promoteBtn = document.getElementById('lav-promote');
    if (promoteBtn) {
      promoteBtn.addEventListener('click', function () {
        var sel = document.getElementById('lav-status-sel');
        var newStatus = sel.value;
        if (newStatus === status) return;
        promoteBtn.disabled = true;
        promoteBtn.textContent = 'Saving…';
        var patchHeaders = { 'content-type': 'application/json' };
        if (typeof window !== 'undefined' && window.LIMEN_OPERATOR_TOKEN) {
          patchHeaders.authorization = 'Bearer ' + window.LIMEN_OPERATOR_TOKEN;
        }
        fetch('/api/limen-engine-output?id=' + encodeURIComponent(record.outputId), {
          method: 'PATCH',
          headers: patchHeaders,
          body: JSON.stringify({ status: newStatus, actor: 'viewer-ui' })
        })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            promoteBtn.textContent = 'Saved ✓';
            setTimeout(function () { window.location.reload(); }, 600);
          } else {
            promoteBtn.disabled = false;
            promoteBtn.textContent = 'Save status change';
            alert('Save failed: ' + (j && j.error || 'unknown'));
          }
        })
        .catch(function (err) {
          promoteBtn.disabled = false;
          promoteBtn.textContent = 'Save status change';
          alert('Save failed: ' + err.message);
        });
      });
    }
  }

  function loadAndRender(container, outputId) {
    injectStyles();
    if (!outputId) {
      renderError(container, 'No artifact id supplied. Visit /helix-artifact.html?id=<outputId>');
      return;
    }
    renderLoading(container);
    fetch('/api/limen-engine-output?id=' + encodeURIComponent(outputId), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.record) {
          renderError(container, 'Artifact not found: ' + outputId);
          return;
        }
        renderArtifact(container, j.record);
      })
      .catch(function (err) {
        renderError(container, 'Load failed: ' + err.message);
      });
  }

  function mount(container, outputId) {
    if (!container) {
      console.error('[ArtifactViewerUI] mount() requires a container');
      return;
    }
    var id = outputId;
    if (!id) {
      var params = new URLSearchParams(window.location.search);
      id = params.get('id');
    }
    loadAndRender(container, id);
  }

  root.LIMENArtifactViewerUI = {
    mount: mount,
    render: renderArtifact
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
