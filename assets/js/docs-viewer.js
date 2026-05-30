/**
 * assets/js/docs-viewer.js
 *
 * DOCS-0 — Operator-facing markdown docs viewer.
 *
 * Behavior:
 *   - Renders an allowlisted set of repo markdown files (research/planning
 *     artifacts written by Claude Code) inside a protected LIMEN page.
 *   - Auth is provided upstream by assets/js/auth-gate.js, which must be
 *     included before this script in the host HTML.
 *   - Allowlist is hardcoded below. Query param `?doc=<key>` is matched
 *     ONLY against allowlist keys; arbitrary paths are not honored.
 *   - Markdown rendering is in-browser, dependency-free, HTML-escape-first.
 *   - The Raw Markdown toggle exists so imperfect rendering does not block
 *     review.
 *
 * Out-of-scope (do not add to this file):
 *   - Filesystem browsing
 *   - Directory listing
 *   - Editing / save / upload
 *   - External AI calls
 *   - External CDN dependencies
 *   - Public unauthenticated viewing (auth-gate.js is mandatory upstream)
 */
(function () {
  'use strict';

  // ─── Allowlist (key → label + repo-relative path) ───────────────────
  //
  // Add entries here as new operator-readable docs are produced. Keys are
  // strict — only these strings are valid `?doc=` values.
  //
  // DOCS-0.1: source content is no longer fetched as a public static
  // asset. The viewer POSTs to /api/fetch-doc which mediates the read
  // and enforces the X-LIMEN-Access header. Path strings remain here
  // for display purposes (the meta strip shows the operator the file
  // path) but are NEVER used as fetch URLs.
  //
  // The same allowlist is mirrored in api/fetch-doc.js. Both must be
  // kept in sync. Adding a new doc also requires a per-document
  // rewrite in vercel.json so direct /docs/<key>.md fetches are
  // intercepted.
  var DOC_ALLOWLIST = {
    'D3-E-NSF-RESEARCH': {
      label: 'D3-E NSF Project Pitch — outbound research',
      path:  'api/protected-docs/D3-E-NSF-RESEARCH.md'
    },
    'D3-E-PLAN': {
      label: 'D3-E NSF Project Pitch — implementation plan',
      path:  'api/protected-docs/D3-E-PLAN.md'
    }
  };

  // Order in which docs appear in the sidebar. Docs not in this list still
  // appear — appended in object-key order.
  var DOC_ORDER = ['D3-E-NSF-RESEARCH', 'D3-E-PLAN'];

  var DEFAULT_KEY = 'D3-E-NSF-RESEARCH';

  // ─── Tiny DOM helpers ────────────────────────────────────────────────

  function _el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class')      node.className = attrs[k];
        else if (k === 'style') node.setAttribute('style', attrs[k]);
        else if (k === 'text')  node.textContent = attrs[k];
        else                    node.setAttribute(k, attrs[k]);
      });
    }
    if (children && children.length) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else                       node.appendChild(c);
      }
    }
    return node;
  }

  // ─── HTML escape ─────────────────────────────────────────────────────

  function _escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  // ─── Minimal markdown renderer ───────────────────────────────────────
  //
  // Pipeline: escape HTML, then process line-based block structures, then
  // process inline spans within each block. We never accept raw HTML from
  // the markdown source — escape happens first.

  function _renderInline(escapedLine) {
    // At this point the input has already been HTML-escaped, so any
    // markdown punctuation we recognize was authored as such.
    var s = escapedLine;

    // Inline code: `code` (no backticks inside)
    s = s.replace(/`([^`]+)`/g, function (m, code) {
      return '<code class="mdv-icode">' + code + '</code>';
    });

    // Bold: **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* (single asterisk; avoid empty)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    // Links: [text](url) — url is escaped, only allow http(s)/relative
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, txt, url) {
      var safe = _safeLinkUrl(url);
      if (!safe) return txt; // drop link, keep text
      return '<a href="' + safe + '" rel="noopener noreferrer" target="_blank">' + txt + '</a>';
    });

    return s;
  }

  function _safeLinkUrl(url) {
    // url is already HTML-escaped (& became &amp;, etc). Decide whether
    // to allow it as an href. Permit http://, https://, and relative paths
    // that don't start with javascript:, data:, or vbscript:.
    var lowered = url.toLowerCase();
    if (lowered.indexOf('javascript:') === 0) return null;
    if (lowered.indexOf('data:')       === 0) return null;
    if (lowered.indexOf('vbscript:')   === 0) return null;
    return url;
  }

  function _renderTable(rows) {
    // rows: array of { cells: [string, ...] } already HTML-escaped.
    // Treat first row as header. Skip the alignment-row (|---|---|).
    if (!rows.length) return '';
    var header = rows[0];
    var body = rows.slice(1).filter(function (r) {
      // alignment row is all dashes/colons
      return !r.cells.every(function (c) { return /^[\s\-:]+$/.test(c); });
    });
    var html = '<div class="mdv-table-wrap"><table class="mdv-table">';
    html += '<thead><tr>';
    for (var i = 0; i < header.cells.length; i++) {
      html += '<th>' + _renderInline(header.cells[i].trim()) + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var r = 0; r < body.length; r++) {
      html += '<tr>';
      for (var c = 0; c < body[r].cells.length; c++) {
        html += '<td>' + _renderInline(body[r].cells[c].trim()) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function _splitTableRow(line) {
    // line is a markdown table row like "| a | b | c |"
    var trimmed = line.trim();
    if (trimmed.charAt(0) === '|') trimmed = trimmed.slice(1);
    if (trimmed.charAt(trimmed.length - 1) === '|') trimmed = trimmed.slice(0, -1);
    return trimmed.split('|');
  }

  function _isTableLine(line) {
    var t = line.trim();
    return t.length > 0 && t.charAt(0) === '|' && t.charAt(t.length - 1) === '|' && t.indexOf('|', 1) > 0;
  }

  function renderMarkdown(src) {
    if (typeof src !== 'string' || src.length === 0) return '';
    // 1. Escape all HTML entities in the source first.
    var escaped = _escapeHtml(src);
    // 2. Split into lines for block parsing.
    var lines = escaped.split(/\r?\n/);
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      // Fenced code block
      if (/^```/.test(trimmed)) {
        var fence = trimmed.match(/^```\s*(\S+)?/);
        var lang = fence && fence[1] ? fence[1] : '';
        i++;
        var codeBuf = [];
        while (i < lines.length && !/^```/.test(lines[i].trim())) {
          codeBuf.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip closing fence
        out.push('<pre class="mdv-pre"><code class="mdv-code' +
                 (lang ? ' lang-' + lang : '') + '">' +
                 codeBuf.join('\n') + '</code></pre>');
        continue;
      }

      // Horizontal rule (---, ***, ___)
      if (/^(\-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
        out.push('<hr class="mdv-hr" />');
        i++;
        continue;
      }

      // Headings
      var hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        var level = hMatch[1].length;
        out.push('<h' + level + ' class="mdv-h mdv-h' + level + '">' +
                 _renderInline(hMatch[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // Table block
      if (_isTableLine(line)) {
        var rows = [];
        while (i < lines.length && _isTableLine(lines[i])) {
          rows.push({ cells: _splitTableRow(lines[i]) });
          i++;
        }
        out.push(_renderTable(rows));
        continue;
      }

      // Blockquote
      if (/^>\s?/.test(trimmed)) {
        var quoteBuf = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quoteBuf.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="mdv-quote">' +
                 _renderInline(quoteBuf.join(' ')) + '</blockquote>');
        continue;
      }

      // Unordered list
      if (/^[\-*+]\s+/.test(trimmed)) {
        var ulBuf = [];
        while (i < lines.length && /^[\-*+]\s+/.test(lines[i].trim())) {
          ulBuf.push(lines[i].trim().replace(/^[\-*+]\s+/, ''));
          i++;
        }
        var ulHtml = '<ul class="mdv-list">';
        for (var u = 0; u < ulBuf.length; u++) {
          ulHtml += '<li>' + _renderInline(ulBuf[u]) + '</li>';
        }
        ulHtml += '</ul>';
        out.push(ulHtml);
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        var olBuf = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          olBuf.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        var olHtml = '<ol class="mdv-list">';
        for (var o = 0; o < olBuf.length; o++) {
          olHtml += '<li>' + _renderInline(olBuf[o]) + '</li>';
        }
        olHtml += '</ol>';
        out.push(olHtml);
        continue;
      }

      // Blank line
      if (trimmed.length === 0) {
        i++;
        continue;
      }

      // Paragraph: gather consecutive non-blank, non-special lines.
      var pBuf = [];
      while (i < lines.length) {
        var ln = lines[i];
        var lt = ln.trim();
        if (lt.length === 0) break;
        if (/^```/.test(lt)) break;
        if (/^(\-{3,}|\*{3,}|_{3,})\s*$/.test(lt)) break;
        if (/^#{1,6}\s+/.test(lt)) break;
        if (_isTableLine(ln)) break;
        if (/^>\s?/.test(lt)) break;
        if (/^[\-*+]\s+/.test(lt)) break;
        if (/^\d+\.\s+/.test(lt)) break;
        pBuf.push(ln);
        i++;
      }
      if (pBuf.length > 0) {
        out.push('<p class="mdv-p">' + _renderInline(pBuf.join(' ')) + '</p>');
      }
    }

    return out.join('\n');
  }

  // ─── State ──────────────────────────────────────────────────────────

  var state = {
    currentKey:  null,
    rawText:     '',
    rendered:    true,        // true = rendered view, false = raw view
    loadedAt:    null,
    lineCount:   0,
    fetchError:  null
  };

  // ─── Element refs (assigned in init) ────────────────────────────────

  var refs = {};

  // ─── CSS (injected once) ────────────────────────────────────────────

  var STYLE_TEXT = [
    /* Layout */
    'body.mdv-body { margin: 0; background: #0a0e14; color: #d8e1ec; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }',
    '.mdv-app { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }',
    '.mdv-header { grid-column: 1 / -1; padding: 14px 22px; border-bottom: 1px solid #1c2733; background: #0d141d; display: flex; align-items: center; justify-content: space-between; }',
    '.mdv-header h1 { margin: 0; font-size: 17px; letter-spacing: 0.04em; color: #cfd8e3; font-weight: 600; }',
    '.mdv-header .mdv-sub { color: #6c7a89; font-size: 12px; margin-left: 14px; }',

    /* Sidebar */
    '.mdv-side { background: #0c1218; border-right: 1px solid #1c2733; padding: 14px 0; position: sticky; top: 0; align-self: start; }',
    '.mdv-side h2 { margin: 0 16px 8px; font-size: 11px; letter-spacing: 0.18em; color: #6c7a89; text-transform: uppercase; }',
    '.mdv-side ul { list-style: none; margin: 0; padding: 0; }',
    '.mdv-side li { margin: 0; }',
    '.mdv-side a { display: block; padding: 9px 16px; color: #b9c4d2; text-decoration: none; border-left: 3px solid transparent; font-size: 13px; line-height: 1.35; }',
    '.mdv-side a:hover { background: #131c26; color: #e3eaf2; }',
    '.mdv-side a.active { background: #14202c; color: #ffffff; border-left-color: #4f8edc; }',

    /* Main pane */
    '.mdv-main { padding: 18px 28px 60px; max-width: 980px; }',
    '.mdv-meta { display: flex; flex-wrap: wrap; gap: 14px 22px; padding: 10px 14px; margin: 0 0 16px; background: #0e1620; border: 1px solid #1c2733; border-radius: 6px; font-size: 12px; color: #8c98a6; }',
    '.mdv-meta b { color: #cfd8e3; font-weight: 600; }',
    '.mdv-actions { display: flex; gap: 8px; margin: 0 0 18px; flex-wrap: wrap; }',
    '.mdv-btn { background: #14202c; border: 1px solid #25364a; color: #cfd8e3; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; }',
    '.mdv-btn:hover { background: #1a2a3a; }',
    '.mdv-btn.active { background: #1f3550; border-color: #4f8edc; color: #ffffff; }',
    '.mdv-status { margin-left: auto; font-size: 11px; color: #6c7a89; align-self: center; }',

    /* Rendered markdown body */
    '.mdv-content { line-height: 1.65; font-size: 14.5px; }',
    '.mdv-content .mdv-h { color: #ffffff; line-height: 1.25; margin: 1.4em 0 0.5em; }',
    '.mdv-content .mdv-h1 { font-size: 26px; border-bottom: 1px solid #1c2733; padding-bottom: 8px; }',
    '.mdv-content .mdv-h2 { font-size: 20px; border-bottom: 1px solid #1c2733; padding-bottom: 6px; }',
    '.mdv-content .mdv-h3 { font-size: 17px; }',
    '.mdv-content .mdv-h4 { font-size: 15px; color: #cfd8e3; }',
    '.mdv-content p.mdv-p { margin: 0.6em 0; color: #d8e1ec; }',
    '.mdv-content ul.mdv-list, .mdv-content ol.mdv-list { margin: 0.6em 0 0.6em 1.4em; padding: 0; }',
    '.mdv-content ul.mdv-list li, .mdv-content ol.mdv-list li { margin: 0.25em 0; }',
    '.mdv-content blockquote.mdv-quote { margin: 0.9em 0; padding: 6px 14px; border-left: 3px solid #4f8edc; background: #0e1620; color: #b9c4d2; }',
    '.mdv-content hr.mdv-hr { border: 0; border-top: 1px solid #1c2733; margin: 1.4em 0; }',
    '.mdv-content code.mdv-icode { background: #0e1620; padding: 1px 6px; border-radius: 3px; color: #ffd388; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12.5px; }',
    '.mdv-content pre.mdv-pre { background: #0a1018; border: 1px solid #1c2733; border-radius: 4px; padding: 12px 14px; overflow-x: auto; margin: 0.8em 0; }',
    '.mdv-content pre.mdv-pre code.mdv-code { color: #d8e1ec; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12.5px; line-height: 1.55; background: transparent; padding: 0; white-space: pre; }',
    '.mdv-content a { color: #6cb0ff; }',
    '.mdv-content strong { color: #ffffff; }',

    /* Tables */
    '.mdv-content .mdv-table-wrap { overflow-x: auto; margin: 0.9em 0; }',
    '.mdv-content table.mdv-table { border-collapse: collapse; width: 100%; font-size: 13px; }',
    '.mdv-content table.mdv-table th, .mdv-content table.mdv-table td { border: 1px solid #1c2733; padding: 6px 10px; text-align: left; vertical-align: top; }',
    '.mdv-content table.mdv-table th { background: #0e1620; color: #cfd8e3; }',
    '.mdv-content table.mdv-table tr:nth-child(even) td { background: #0c121a; }',

    /* Raw view */
    '.mdv-raw { background: #0a1018; border: 1px solid #1c2733; border-radius: 4px; padding: 14px; white-space: pre; overflow-x: auto; font-family: "JetBrains Mono", Consolas, monospace; font-size: 12.5px; line-height: 1.55; color: #d8e1ec; }',

    /* Error state */
    '.mdv-error { background: #2a1818; border: 1px solid #5a2a2a; padding: 14px 16px; border-radius: 4px; color: #ffb0b0; }'
  ].join('\n');

  // ─── Allowlist resolution ───────────────────────────────────────────

  function resolveKey(rawKey) {
    if (typeof rawKey !== 'string') return null;
    if (!Object.prototype.hasOwnProperty.call(DOC_ALLOWLIST, rawKey)) return null;
    return rawKey;
  }

  function getKeyFromQuery() {
    var qs = window.location.search || '';
    var m = qs.match(/[?&]doc=([^&]+)/);
    if (!m) return null;
    var raw;
    try { raw = decodeURIComponent(m[1]); } catch (e) { return null; }
    return resolveKey(raw);
  }

  // ─── Fetch + render ─────────────────────────────────────────────────

  // DOCS-0.1: route through /api/fetch-doc. The viewer reads the same
  // sessionStorage key that auth-gate.js checks (limen_access) and
  // forwards it as an X-LIMEN-Access header. The server mirrors the
  // client-side check. 401/403 responses redirect the user to the
  // landing page just like auth-gate.js would.
  var DOCS_API_ENDPOINT = '/api/fetch-doc';

  function _redirectToAuth() {
    try {
      window.location.replace('/?return=' + encodeURIComponent(location.pathname + location.search));
    } catch (e) { /* non-fatal */ }
  }

  function loadDoc(key) {
    var resolved = resolveKey(key);
    if (!resolved) {
      state.currentKey = null;
      state.rawText    = '';
      state.fetchError = 'Document not available (key not in allowlist).';
      renderApp();
      return;
    }
    var entry = DOC_ALLOWLIST[resolved];
    state.currentKey = resolved;
    state.rawText    = '';
    state.fetchError = null;
    state.loadedAt   = null;
    state.lineCount  = 0;
    renderApp(); // reflect "loading" state

    var auth = '';
    try { auth = sessionStorage.getItem('limen_access') || ''; } catch (e) { /* non-fatal */ }

    fetch(DOCS_API_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type':    'application/json',
        'X-LIMEN-Access':  auth,
        'Cache-Control':   'no-store'
      },
      body: JSON.stringify({ docKey: resolved })
    })
      .then(function (resp) {
        // Auth failures fall back to the same redirect flow auth-gate.js uses.
        if (resp.status === 401 || resp.status === 403) {
          _redirectToAuth();
          return Promise.reject({ silent: true });
        }
        if (resp.status === 404) {
          state.fetchError = 'Document not available.';
          renderApp();
          return Promise.reject({ silent: true });
        }
        if (!resp.ok) {
          throw new Error('HTTP ' + resp.status);
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true || typeof data.content !== 'string') {
          throw new Error('Malformed API response');
        }
        state.rawText   = data.content;
        state.loadedAt  = new Date();
        state.lineCount = (typeof data.charCount === 'number')
          ? ((data.content.match(/\n/g) || []).length + 1)
          : ((data.content.match(/\n/g) || []).length + 1);
        renderApp();
        // Update history without scroll.
        try {
          var url2 = window.location.pathname + '?doc=' + encodeURIComponent(resolved);
          window.history.replaceState(null, '', url2);
        } catch (e) { /* non-fatal */ }
      })
      .catch(function (err) {
        if (err && err.silent) return;
        state.fetchError = 'Failed to load ' + entry.path + ': ' +
                           (err && err.message ? err.message : 'unknown error');
        renderApp();
      });
  }

  // ─── App render ─────────────────────────────────────────────────────

  function renderApp() {
    if (!refs.sidebarList) return;

    // Sidebar
    refs.sidebarList.innerHTML = '';
    var ordered = DOC_ORDER.slice();
    Object.keys(DOC_ALLOWLIST).forEach(function (k) {
      if (ordered.indexOf(k) === -1) ordered.push(k);
    });
    ordered.forEach(function (k) {
      var entry = DOC_ALLOWLIST[k];
      var a = document.createElement('a');
      a.href = '?doc=' + encodeURIComponent(k);
      a.textContent = entry.label;
      if (k === state.currentKey) a.className = 'active';
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        loadDoc(k);
      });
      var li = document.createElement('li');
      li.appendChild(a);
      refs.sidebarList.appendChild(li);
    });

    // Meta strip
    var entry = state.currentKey ? DOC_ALLOWLIST[state.currentKey] : null;
    refs.metaLabel.innerHTML = entry
      ? '<b>Doc:</b> ' + _escapeHtml(entry.label)
      : '<b>Doc:</b> <i>none selected</i>';
    refs.metaPath.innerHTML = entry
      ? '<b>Path:</b> ' + _escapeHtml(entry.path)
      : '';
    refs.metaLoaded.innerHTML = state.loadedAt
      ? '<b>Loaded:</b> ' + state.loadedAt.toISOString()
      : '<b>Loaded:</b> —';
    refs.metaLines.innerHTML = state.lineCount
      ? '<b>Lines:</b> ' + state.lineCount
      : '<b>Lines:</b> —';

    // Action buttons active state
    refs.btnRendered.className = 'mdv-btn' + (state.rendered ? ' active' : '');
    refs.btnRaw.className      = 'mdv-btn' + (!state.rendered ? ' active' : '');

    // Body
    refs.body.innerHTML = '';
    if (state.fetchError) {
      var errBox = _el('div', { class: 'mdv-error' }, [
        _el('b', { text: 'Error: ' }),
        document.createTextNode(state.fetchError)
      ]);
      refs.body.appendChild(errBox);
      return;
    }
    if (!state.currentKey) {
      var msg = _el('div', { class: 'mdv-error' }, [
        document.createTextNode('No allowlisted doc selected. Choose one from the sidebar or use ?doc=<key>.')
      ]);
      refs.body.appendChild(msg);
      return;
    }
    if (!state.rawText) {
      refs.body.appendChild(_el('div', { text: 'Loading…', style: 'color:#6c7a89;font-size:13px;' }));
      return;
    }
    if (state.rendered) {
      var content = _el('div', { class: 'mdv-content' });
      content.innerHTML = renderMarkdown(state.rawText);
      refs.body.appendChild(content);
    } else {
      var raw = _el('pre', { class: 'mdv-raw' });
      raw.textContent = state.rawText;
      refs.body.appendChild(raw);
    }
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    // Inject style
    var style = document.createElement('style');
    style.id = 'mdv-style';
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);

    // Body class for layout
    document.body.classList.add('mdv-body');

    // Build app shell
    var app = _el('div', { class: 'mdv-app' });

    var header = _el('div', { class: 'mdv-header' }, [
      _el('h1', { text: 'LIMEN Operator Docs' }),
      _el('div', { class: 'mdv-sub', text: 'Protected — allowlisted research/planning artifacts' })
    ]);
    app.appendChild(header);

    var side = _el('div', { class: 'mdv-side' });
    side.appendChild(_el('h2', { text: 'Allowlisted Docs' }));
    var sidebarList = _el('ul');
    side.appendChild(sidebarList);
    app.appendChild(side);

    var main = _el('div', { class: 'mdv-main' });

    // Meta strip
    var meta = _el('div', { class: 'mdv-meta' });
    var metaLabel  = _el('div'); meta.appendChild(metaLabel);
    var metaPath   = _el('div'); meta.appendChild(metaPath);
    var metaLoaded = _el('div'); meta.appendChild(metaLoaded);
    var metaLines  = _el('div'); meta.appendChild(metaLines);
    main.appendChild(meta);

    // Action row
    var actions = _el('div', { class: 'mdv-actions' });
    var btnRendered = _el('button', { class: 'mdv-btn active', text: 'Rendered' });
    var btnRaw      = _el('button', { class: 'mdv-btn',        text: 'Raw Markdown' });
    var btnCopy     = _el('button', { class: 'mdv-btn',        text: 'Copy Raw' });
    var btnRefresh  = _el('button', { class: 'mdv-btn',        text: 'Refresh' });
    actions.appendChild(btnRendered);
    actions.appendChild(btnRaw);
    actions.appendChild(btnCopy);
    actions.appendChild(btnRefresh);
    main.appendChild(actions);

    // Body
    var body = _el('div', { class: 'mdv-doc-body' });
    main.appendChild(body);

    app.appendChild(main);
    document.body.appendChild(app);

    // Refs
    refs.sidebarList = sidebarList;
    refs.metaLabel   = metaLabel;
    refs.metaPath    = metaPath;
    refs.metaLoaded  = metaLoaded;
    refs.metaLines   = metaLines;
    refs.btnRendered = btnRendered;
    refs.btnRaw      = btnRaw;
    refs.btnCopy     = btnCopy;
    refs.btnRefresh  = btnRefresh;
    refs.body        = body;

    // Wire actions
    btnRendered.addEventListener('click', function () { state.rendered = true;  renderApp(); });
    btnRaw.addEventListener('click',      function () { state.rendered = false; renderApp(); });
    btnCopy.addEventListener('click', function () {
      if (!state.rawText) return;
      try {
        navigator.clipboard.writeText(state.rawText).then(function () {
          var prev = btnCopy.textContent;
          btnCopy.textContent = 'Copied';
          setTimeout(function () { btnCopy.textContent = prev; }, 1200);
        }).catch(function () { /* ignore — clipboard may be blocked */ });
      } catch (e) { /* old browsers */ }
    });
    btnRefresh.addEventListener('click', function () {
      if (state.currentKey) loadDoc(state.currentKey);
    });

    // Decide initial doc
    var queryKey = getKeyFromQuery();
    var initialKey = queryKey ||
      (Object.prototype.hasOwnProperty.call(DOC_ALLOWLIST, DEFAULT_KEY)
        ? DEFAULT_KEY
        : (Object.keys(DOC_ALLOWLIST)[0] || null));

    if (initialKey) {
      loadDoc(initialKey);
    } else {
      state.fetchError = 'No allowlisted docs available.';
      renderApp();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
