/**
 * api/limen-artifact-render.js — Professional document renderer
 *
 * Renders a persisted engine-output artifact as a properly-formatted
 * HTML page styled to mirror the relevant public-domain federal form
 * layout (NIH SF-424 R&R / SBIR Phase I; SBA Form 1919 / SOP 50 10
 * Version 8; FTC 16 CFR Part 436 FDD; USPTO 37 CFR §§ 1.71-1.78; etc.).
 *
 * GET /api/limen-artifact-render?id=<outputId>&format=html|md
 *
 * Format:
 *   html (default) — full HTML page with print-friendly CSS (Helvetica/Arial
 *                    11pt, 0.5in margins, page-break controls). Browser
 *                    print-to-PDF produces publication-quality output.
 *   md             — raw markdown body for offline tooling
 *
 * What renders:
 *   - Lane-specific cover header matching the appropriate federal form
 *   - All sections with proper heading hierarchy + page breaks
 *   - DataRequestMatrix banner when status === DRAFT_NEEDS_DATA
 *   - Fractal-context appendix (portal functionalNetwork summary +
 *     brain-node bindings + Pass 3B counterparties when stage-routed)
 *   - Provenance footer (outputId, content hash, chain sig, kernel snapshot)
 *
 * IP-safe: ONLY uses public-domain federal form STRUCTURE (titles, section
 * orderings, page-limit conventions from agency public guides). No
 * copyrighted private templates, no specific grant-winner prose,
 * no copyrighted citations.
 */

var fs = require('fs');
var path = require('path');

// ── Portal load (bundled per vercel.json includeFiles) ──
var _PORTAL_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'companies'),
  '/var/task/assets/data/companies',
  path.join(process.cwd(), 'assets', 'data', 'companies')
];
function _loadPortal(slug) {
  if (!slug) return null;
  for (var i = 0; i < _PORTAL_PATHS.length; i++) {
    try {
      var fp = path.join(_PORTAL_PATHS[i], slug + '.json');
      if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (_) { /* try next */ }
  }
  return null;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minimal markdown → HTML converter. Handles headings, paragraphs,
// bullet/numbered lists, bold/italic, inline code, line breaks,
// horizontal rules. Sufficient for the engine-output draft format.
function mdToHtml(md) {
  if (!md) return '';
  var lines = String(md).split(/\r?\n/);
  var out = [];
  var inList = null; // 'ul' | 'ol'
  function closeList() { if (inList) { out.push('</' + inList + '>'); inList = null; } }

  function inlineFmt(s) {
    return escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[DATA_NEEDED:?\s*([^\]]*)\]/g, '<span class="data-needed">[DATA_NEEDED: $1]</span>')
      .replace(/\[VERIFY:?\s*([^\]]*)\]/g, '<span class="data-needed">[VERIFY: $1]</span>')
      .replace(/\[TBD[^\]]*\]/g, '<span class="data-needed">[TBD]</span>');
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^\s*$/.test(line)) { closeList(); continue; }
    if (/^---+\s*$/.test(line)) { closeList(); out.push('<hr class="section-break" />'); continue; }
    var h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { closeList(); var lvl = h[1].length; out.push('<h' + lvl + '>' + inlineFmt(h[2]) + '</h' + lvl + '>'); continue; }
    var ol = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (ol) {
      if (inList !== 'ol') { closeList(); inList = 'ol'; out.push('<ol>'); }
      out.push('<li>' + inlineFmt(ol[2]) + '</li>');
      continue;
    }
    var ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      if (inList !== 'ul') { closeList(); inList = 'ul'; out.push('<ul>'); }
      out.push('<li>' + inlineFmt(ul[1]) + '</li>');
      continue;
    }
    closeList();
    out.push('<p>' + inlineFmt(line) + '</p>');
  }
  closeList();
  return out.join('\n');
}

// ── Lane-specific cover blocks ──
// Each cover mirrors the public-domain federal form's first-page
// header. We do NOT copy any specific grant-winner's prose; we only
// encode the form's STANDARD layout published in agency-issued
// public guides (NIH SF-424 R&R Application Guide; SBIR.gov
// Program Solicitation; SBA SOP 50 10 Version 8; FTC 16 CFR 436.5;
// USPTO MPEP § 608).
function laneHeader(record, portal) {
  var lane = record.lane || 'research';
  var catKey = record.payload && record.payload.autofire && record.payload.autofire.catalogKey;
  var title = (record.payload && record.payload.title) || (lane.toUpperCase() + ' draft');
  var entity = (portal && portal.name) || record.slug || record.cik || 'Subject Entity';
  var date = new Date(record.freshness && record.freshness.persistedAt || Date.now())
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  var formId = '';
  var formName = '';
  if (lane === 'patent') {
    formId = 'USPTO 37 CFR §§ 1.71–1.78';
    formName = 'United States Utility Patent Application';
  } else if (catKey === 'grant_sbir_phase_1') {
    formId = 'NIH SBIR/STTR Phase I (SF-424 R&R)';
    formName = 'Small Business Innovation Research Phase I Application';
  } else if (lane === 'grant') {
    formId = 'NIH SF-424 R&R / NSF PAPPG Chapter II';
    formName = 'Federal Research Grant Application';
  } else if (lane === 'sba') {
    formId = 'SBA SOP 50 10 Version 8 + Form 1919';
    formName = 'SBA 7(a) Borrower Information Package';
  } else if (lane === 'franchise') {
    formId = 'FTC 16 CFR Part 436';
    formName = 'Franchise Disclosure Document (FDD)';
  } else if (lane === 'investment') {
    formId = 'Institutional IC Memo (private placement format)';
    formName = 'Multi-Horizon Investment Thesis';
  } else if (lane === 'research') {
    formId = 'Independent Research Brief';
    formName = 'Institutional Research Memorandum';
  } else {
    formId = lane.toUpperCase();
    formName = lane + ' artifact';
  }

  return '' +
    '<div class="lane-cover">' +
      '<div class="lane-cover-form">' + escapeHtml(formName) + '</div>' +
      '<div class="lane-cover-citation">Format reference: ' + escapeHtml(formId) + '</div>' +
      '<h1 class="lane-cover-title">' + escapeHtml(title) + '</h1>' +
      '<table class="lane-cover-meta"><tbody>' +
        '<tr><th>Applicant</th><td>' + escapeHtml(entity) + '</td></tr>' +
        (record.cik ? '<tr><th>CIK / Identifier</th><td>' + escapeHtml(record.cik) + '</td></tr>' : '') +
        (portal && portal.sic ? '<tr><th>NAICS</th><td>' + escapeHtml(portal.sic) + '</td></tr>' : '') +
        (portal && portal.industry ? '<tr><th>Industry</th><td>' + escapeHtml(portal.industry) + '</td></tr>' : '') +
        '<tr><th>Prepared</th><td>' + escapeHtml(date) + '</td></tr>' +
        '<tr><th>Status</th><td><span class="status status-' + escapeHtml(record.status || 'unknown') + '">' + escapeHtml(record.status || 'UNKNOWN') + '</span></td></tr>' +
        (record.payload && record.payload.wordCount ? '<tr><th>Word count</th><td>' + record.payload.wordCount + '</td></tr>' : '') +
      '</tbody></table>' +
    '</div>';
}

function dataRequestMatrixBanner(record) {
  if (record.status !== 'DRAFT_NEEDS_DATA') return '';
  var matrix = record.dataRequestMatrix;
  if (!matrix) return '';
  var samples = (matrix.placeholderSamples || []).slice(0, 20);
  return '' +
    '<div class="data-request-banner">' +
      '<div class="data-request-title">⚠ DRAFT_NEEDS_DATA — ' + matrix.placeholderCount + ' unresolved placeholders</div>' +
      '<div class="data-request-action">' + escapeHtml(matrix.operatorAction || 'Replace placeholders + PATCH to READY_TO_SIGN.') + '</div>' +
      (samples.length ? '<details><summary>Sample placeholders (' + samples.length + ' of ' + matrix.placeholderCount + ')</summary><ul>' +
        samples.map(function (s) { return '<li><code>' + escapeHtml(s) + '</code></li>'; }).join('') +
      '</ul></details>' : '') +
    '</div>';
}

// Fractal context appendix — surfaces the portal's functionalNetwork
// + brain-node bindings + Pass 3B routing. Same information a brain
// would surface about itself: who I depend on (suppliers), who depends
// on me (customers), who threatens me (competitors), who watches me
// (regulators).
function fractalContextAppendix(portal, record) {
  if (!portal) return '';
  var fn = portal.functionalNetwork || {};
  var sections = [];
  var CATS = [
    ['suppliers', 'Suppliers (afferent / inputs)'],
    ['logisticsPartners', 'Logistics Partners (motor cortex / efferent flow)'],
    ['customers', 'Customers (efferent / outputs)'],
    ['competitors', 'Competitors (lateral inhibition)'],
    ['regulators', 'Regulators (executive control / inhibitory)'],
    ['capitalProviders', 'Capital Providers (energy substrate)'],
    ['executiveTeam', 'Executive Team (prefrontal cortex)'],
    ['marketSignals', 'Market Signals (sensory input)']
  ];
  for (var i = 0; i < CATS.length; i++) {
    var key = CATS[i][0]; var label = CATS[i][1];
    var arr = Array.isArray(fn[key]) ? fn[key] : [];
    if (arr.length === 0) continue;
    var rows = arr.map(function (e) {
      var name = escapeHtml(e.name || e.slug || '?');
      var ticker = e.ticker ? '<span class="muted"> · ' + escapeHtml(e.ticker) + '</span>' : '';
      var brainRole = e.brainNodeRole ? '<div class="muted brain-role">' + escapeHtml(e.brainNodeRole) + '</div>' : '';
      var note = e.relationshipNote ? '<div class="rel-note">' + escapeHtml(e.relationshipNote) + '</div>' : '';
      return '<tr><td>' + name + ticker + brainRole + '</td><td>' + note + '</td></tr>';
    }).join('');
    sections.push('<h3>' + escapeHtml(label) + ' <span class="muted">(' + arr.length + ')</span></h3>' +
                  '<table class="fn-table"><tbody>' + rows + '</tbody></table>');
  }
  if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) {
    var aud = fn.auditor;
    sections.push('<h3>Auditor (independent verification layer)</h3>' +
                  '<table class="fn-table"><tbody><tr><td><strong>' + escapeHtml(aud.name || '?') + '</strong></td>' +
                  '<td>' + escapeHtml(aud.relationshipNote || '') + '</td></tr></tbody></table>');
  }

  // Pass 3B stage routing context (when present)
  var stageBlock = '';
  var af = record.payload && record.payload.autofire;
  if (af && af.stageClassification) {
    var sc = af.stageClassification;
    var rt = af.stageRouting || {};
    stageBlock = '<h3>Stage Routing (Pass 3B)</h3>' +
      '<dl class="stage-routing">' +
        '<dt>Classified stage</dt><dd><strong>' + escapeHtml(sc.stage) + '</strong> (confidence ' + (sc.confidence || 0) + ')</dd>' +
        '<dt>Routed template</dt><dd>' + escapeHtml(rt.template || af.catalogKey || record.lane) + '</dd>' +
        (sc.signals && sc.signals.length ? '<dt>Signals</dt><dd>' + sc.signals.map(function (s) { return escapeHtml(s.kind + ': ' + JSON.stringify(s).slice(0, 80)); }).join(' · ') + '</dd>' : '') +
      '</dl>';
  }

  return '' +
    '<section class="appendix">' +
      '<h2>Appendix: Fractal Context</h2>' +
      '<p class="appendix-intro">This artifact was generated from a portal that models the applicant as a mini-brain. ' +
        'The categories below mirror brain-node functions — suppliers as afferent input pathways, ' +
        'regulators as inhibitory executive control, etc. This is the same lens used by the LIMEN ' +
        'kernel to score the applicant\'s phase state and propagate stress through the spider-web.</p>' +
      stageBlock +
      sections.join('') +
    '</section>';
}

function renderHtml(record, portal, draftHtml) {
  var styles = '' +
    'body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; max-width: 7.5in; margin: 0.5in auto; padding: 0 0.25in; }' +
    'h1 { font-size: 18pt; margin: 0 0 8pt; }' +
    'h2 { font-size: 14pt; margin: 18pt 0 8pt; padding-bottom: 3pt; border-bottom: 1px solid #1a1a1a; }' +
    'h3 { font-size: 12pt; margin: 12pt 0 6pt; }' +
    'h4 { font-size: 11pt; margin: 10pt 0 4pt; font-weight: 700; }' +
    'p { margin: 0 0 8pt; text-align: justify; }' +
    'ul, ol { margin: 0 0 8pt 18pt; padding: 0; }' +
    'li { margin-bottom: 3pt; }' +
    'code { font-family: Consolas, Monaco, monospace; font-size: 10pt; background: #f3f3f3; padding: 1pt 3pt; border-radius: 2pt; }' +
    '.lane-cover { border: 2px solid #1a1a1a; padding: 24pt; margin-bottom: 24pt; page-break-after: always; }' +
    '.lane-cover-form { font-size: 10pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #555; }' +
    '.lane-cover-citation { font-size: 9pt; color: #777; margin-bottom: 18pt; }' +
    '.lane-cover-title { font-size: 22pt; line-height: 1.2; margin: 12pt 0 18pt; }' +
    '.lane-cover-meta { width: 100%; border-collapse: collapse; font-size: 10pt; }' +
    '.lane-cover-meta th { text-align: left; width: 30%; padding: 4pt 8pt 4pt 0; vertical-align: top; color: #555; font-weight: 600; }' +
    '.lane-cover-meta td { padding: 4pt 0; }' +
    '.status { display: inline-block; padding: 2pt 8pt; border-radius: 3pt; font-size: 9pt; font-weight: 700; }' +
    '.status-READY_TO_SIGN { background: #d4ead4; color: #1e5e1e; }' +
    '.status-DRAFT_NEEDS_DATA { background: #fff2cc; color: #856404; }' +
    '.status-SUBMITTED { background: #d6e8ff; color: #264a7a; }' +
    '.status-APPROVED { background: #d6f0d6; color: #1e5e1e; }' +
    '.status-REJECTED { background: #ffd6d6; color: #7a2828; }' +
    '.data-request-banner { background: #fff2cc; border: 1px solid #d4a84a; padding: 12pt 16pt; margin-bottom: 18pt; page-break-after: always; }' +
    '.data-request-title { font-weight: 700; font-size: 12pt; margin-bottom: 6pt; }' +
    '.data-request-action { font-size: 10pt; color: #555; margin-bottom: 6pt; }' +
    '.data-needed { background: #fff2cc; color: #856404; padding: 0 3pt; border-radius: 2pt; font-weight: 600; }' +
    '.section-break { page-break-after: always; border: none; margin: 24pt 0; }' +
    '.appendix { page-break-before: always; border-top: 2px solid #1a1a1a; padding-top: 12pt; }' +
    '.appendix-intro { font-style: italic; color: #555; font-size: 10pt; margin-bottom: 18pt; }' +
    '.fn-table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 9.5pt; }' +
    '.fn-table td { padding: 4pt 8pt; border-bottom: 1px solid #ddd; vertical-align: top; }' +
    '.fn-table td:first-child { width: 28%; font-weight: 600; }' +
    '.brain-role { font-size: 8.5pt; font-style: italic; margin-top: 2pt; }' +
    '.rel-note { font-size: 9.5pt; line-height: 1.4; }' +
    '.muted { color: #888; font-weight: 400; }' +
    '.stage-routing dt { font-weight: 700; margin-top: 6pt; }' +
    '.stage-routing dd { margin: 2pt 0 4pt 18pt; }' +
    '.provenance-footer { margin-top: 24pt; padding-top: 12pt; border-top: 1px solid #ccc; font-size: 8.5pt; color: #777; }' +
    '@media print {' +
      'body { margin: 0.5in; max-width: none; }' +
      'h2 { page-break-before: auto; page-break-after: avoid; }' +
      '.lane-cover, .data-request-banner, .appendix { page-break-before: always; }' +
      '.no-print { display: none; }' +
    '}' +
    '.print-toolbar { position: sticky; top: 0; background: #f9f9f9; border-bottom: 1px solid #ddd; padding: 8pt 16pt; margin: -0.5in -0.25in 18pt -0.25in; }' +
    '.print-toolbar button { font-family: inherit; font-size: 10pt; padding: 6pt 12pt; border: 1px solid #555; background: white; cursor: pointer; margin-right: 6pt; border-radius: 3pt; }' +
    '.print-toolbar button:hover { background: #eee; }';

  var title = (record.payload && record.payload.title) || (record.lane.toUpperCase() + ' artifact ' + record.outputId);
  return '' +
    '<!DOCTYPE html>' +
    '<html lang="en"><head>' +
      '<meta charset="UTF-8" />' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' + styles + '</style>' +
    '</head><body>' +
      '<div class="print-toolbar no-print">' +
        '<button onclick="window.print()">🖨 Print / Export PDF</button>' +
        '<button onclick="navigator.clipboard.writeText(document.body.innerText).then(()=>this.textContent=\'Copied\')">📋 Copy Plain Text</button>' +
        '<a href="?id=' + escapeHtml(record.outputId) + '&format=md" style="margin-left:6pt;font-size:10pt">⬇ Markdown</a>' +
        '<span style="float:right;color:#777;font-size:9pt">' + escapeHtml(record.outputId) + '</span>' +
      '</div>' +
      laneHeader(record, portal) +
      dataRequestMatrixBanner(record) +
      '<div class="artifact-body">' + draftHtml + '</div>' +
      fractalContextAppendix(portal, record) +
      '<div class="provenance-footer">' +
        'outputId: ' + escapeHtml(record.outputId || '') + ' · ' +
        'lane: ' + escapeHtml(record.lane || '') + ' · ' +
        'engineId: ' + escapeHtml(record.engineId || '') + ' · ' +
        'contentHash: ' + escapeHtml((record.contentHash || '').slice(0, 12)) + ' · ' +
        'chainSig: ' + escapeHtml((record.provenance && record.provenance.chainSig || '').slice(0, 12)) + ' · ' +
        'sourcePatternSig: ' + escapeHtml((record.sourcePatternSig || '').slice(0, 16)) +
      '</div>' +
    '</body></html>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') {
    res.statusCode = 405; res.setHeader('Allow', 'GET');
    return res.end('method-not-allowed');
  }

  try {
    var url = new URL(req.url, 'http://localhost');
    var outputId = url.searchParams.get('id');
    var format = url.searchParams.get('format') || 'html';
    if (!outputId) {
      res.statusCode = 400; res.setHeader('content-type', 'text/plain');
      return res.end('missing ?id=<outputId>');
    }

    // Fetch the engine-output record
    var base = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://limenhelix.com';
    var rec = null;
    try {
      var r = await fetch(base + '/api/limen-engine-output?id=' + encodeURIComponent(outputId), { signal: AbortSignal.timeout(20000) });
      var j = await r.json();
      if (j && j.ok && j.record) rec = j.record;
    } catch (_) { /* handled below */ }
    if (!rec) {
      res.statusCode = 404; res.setHeader('content-type', 'text/plain');
      return res.end('artifact not found: ' + outputId);
    }

    var portal = _loadPortal(rec.slug);

    if (format === 'md') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      res.setHeader('content-disposition', 'attachment; filename="' + outputId + '.md"');
      return res.end((rec.payload && rec.payload.draftBody) || '# (empty draft)');
    }

    var draftHtml = mdToHtml((rec.payload && rec.payload.draftBody) || '');
    var html = renderHtml(rec, portal, draftHtml);
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=60');
    return res.end(html);

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain');
    return res.end('renderer error: ' + (err && err.message || err));
  }
};
