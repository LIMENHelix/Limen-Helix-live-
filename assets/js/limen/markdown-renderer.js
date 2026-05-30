/**
 * LIMEN Helix — Minimal Markdown Renderer
 *
 * Dependency-free MD→HTML for the subset Claude produces in draftBody.
 * Handles: ATX headings (# .. ######), **bold**, *italic*, `inline code`,
 * ``` fenced code blocks ```, > blockquotes, - / * / + unordered lists,
 * 1. ordered lists, [link](url), --- horizontal rule, paragraphs,
 * basic | tables |, and LIMEN-specific [CITATION_NEEDED:...],
 * [DATA_NEEDED:...], [VERIFY:...], [NEWS_NEEDED:...] inline placeholders
 * which get a distinguishing visual treatment.
 *
 * HTML is always escaped before any markup is applied.
 *
 * Exposed via window.LIMENMarkdownRenderer.render(text) → htmlString.
 */
(function (root) {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Placeholder pattern: [CITATION_NEEDED: foo], [DATA_NEEDED: x],
  // [VERIFY: y], [NEWS_NEEDED: z]. Rendered as colored badges.
  function decoratePlaceholders(html) {
    return html.replace(
      /\[(CITATION_NEEDED|NEWS_NEEDED|DATA_NEEDED|VERIFY|SPECIALIST_REVIEW):\s*([^\]]+?)\]/g,
      function (_m, kind, body) {
        var cls = 'lbg-ph lbg-ph-' + kind.toLowerCase().replace(/_/g, '-');
        return '<span class="' + cls + '" title="' + escapeHtml(kind) + '">' +
               '<strong>' + escapeHtml(kind) + ':</strong> ' + body.trim() + '</span>';
      }
    );
  }

  // Inline transformations applied AFTER block parsing (to text chunks
  // within paragraphs / list items / blockquotes / table cells).
  function inline(text) {
    // Escape first
    var s = escapeHtml(text);

    // Inline code: `code`
    s = s.replace(/`([^`\n]+)`/g, function (_m, c) {
      return '<code>' + c + '</code>';
    });

    // Bold: **text** or __text__
    s = s.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

    // Italic: *text* or _text_ (after bold so ** isn't confused)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');

    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Placeholders
    s = decoratePlaceholders(s);

    return s;
  }

  // Split a text block into lines and detect block type.
  function parseBlocks(md) {
    var lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    var out = '';
    var i = 0;

    while (i < lines.length) {
      var ln = lines[i];

      // Skip blank lines
      if (/^\s*$/.test(ln)) { i++; continue; }

      // Fenced code block: ```lang ... ```
      var fence = ln.match(/^```(\w*)\s*$/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        i++; // consume closing ```
        out += '<pre><code class="lang-' + escapeHtml(fence[1] || '') + '">' +
               escapeHtml(code.join('\n')) + '</code></pre>\n';
        continue;
      }

      // ATX heading: # .. ######
      var h = ln.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (h) {
        var lvl = h[1].length;
        out += '<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>\n';
        i++;
        continue;
      }

      // Horizontal rule: --- or *** or ___
      if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(ln)) {
        out += '<hr>\n';
        i++;
        continue;
      }

      // Blockquote: > text (may span multiple lines)
      if (/^\s*>\s?/.test(ln)) {
        var quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out += '<blockquote>' + parseBlocks(quoteLines.join('\n')) + '</blockquote>\n';
        continue;
      }

      // Table: | a | b | with separator | --- | --- |
      if (/^\s*\|.*\|\s*$/.test(ln) &&
          i + 1 < lines.length &&
          /^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(lines[i + 1])) {
        var headerCells = ln.replace(/^\s*\||\|\s*$/g, '').split('|').map(function (c) { return c.trim(); });
        i++; // header
        i++; // separator
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(lines[i].replace(/^\s*\||\|\s*$/g, '').split('|').map(function (c) { return c.trim(); }));
          i++;
        }
        out += '<table><thead><tr>';
        for (var hc = 0; hc < headerCells.length; hc++) {
          out += '<th>' + inline(headerCells[hc]) + '</th>';
        }
        out += '</tr></thead><tbody>';
        for (var ri = 0; ri < rows.length; ri++) {
          out += '<tr>';
          for (var ci = 0; ci < rows[ri].length; ci++) {
            out += '<td>' + inline(rows[ri][ci]) + '</td>';
          }
          out += '</tr>';
        }
        out += '</tbody></table>\n';
        continue;
      }

      // Unordered list: -, *, + at line start
      if (/^\s*[-*+]\s+/.test(ln)) {
        var ulItems = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          ulItems.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
          i++;
          // Consume continuation lines (indented but not new bullet)
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i])) {
            ulItems[ulItems.length - 1] += ' ' + lines[i].trim();
            i++;
          }
        }
        out += '<ul>';
        for (var u = 0; u < ulItems.length; u++) {
          out += '<li>' + inline(ulItems[u]) + '</li>';
        }
        out += '</ul>\n';
        continue;
      }

      // Ordered list: 1. text
      if (/^\s*\d+\.\s+/.test(ln)) {
        var olItems = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          olItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
            olItems[olItems.length - 1] += ' ' + lines[i].trim();
            i++;
          }
        }
        out += '<ol>';
        for (var o = 0; o < olItems.length; o++) {
          out += '<li>' + inline(olItems[o]) + '</li>';
        }
        out += '</ol>\n';
        continue;
      }

      // Paragraph: accumulate until blank or block-starter
      var paraLines = [ln];
      i++;
      while (i < lines.length && lines[i].trim() !== '' &&
             !/^(#{1,6})\s+/.test(lines[i]) &&
             !/^\s*[-*+]\s+/.test(lines[i]) &&
             !/^\s*\d+\.\s+/.test(lines[i]) &&
             !/^\s*>\s?/.test(lines[i]) &&
             !/^```/.test(lines[i]) &&
             !/^\s*\|.*\|\s*$/.test(lines[i]) &&
             !/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      out += '<p>' + inline(paraLines.join(' ')) + '</p>\n';
    }

    return out;
  }

  function render(md) {
    if (md == null) return '';
    return parseBlocks(String(md));
  }

  root.LIMENMarkdownRenderer = {
    render: render,
    escapeHtml: escapeHtml,
    inline: inline
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
