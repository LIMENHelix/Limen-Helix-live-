/**
 * Refusing reader for one official Supreme Court docket page.
 *
 * The Court publishes docket pages as HTML, not as a versioned API. This reader
 * therefore consumes a deliberately small surface and refuses when the page no
 * longer exposes the identity, title, docketed date, or proceedings section.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'scotus-docket/1.0.1';
var TRANSFORM_VERSION = 'official-html:entities+tags->identified-proceedings/1.0.0';
var OFFICIAL_ORIGIN = 'https://www.supremecourt.gov';

var MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
var EVENT_DATE = new RegExp('\\b' + MONTH + '\\s+\\d{1,2}\\s+\\d{4}\\b', 'g');
var DOCKETED_DATE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/;

function refusal(code, detail, extra) {
  var out = { ok: false, code: code, detail: detail };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function decodeEntities(s) {
  var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCodePoint(parseInt(n, 16)); })
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(parseInt(n, 10)); })
    .replace(/&([a-z]+);/gi, function (m, n) { return Object.prototype.hasOwnProperty.call(named, n.toLowerCase()) ? named[n.toLowerCase()] : m; });
}

function textFromHtml(html) {
  return decodeEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<\/td\s*>/gi, '\t')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function normaliseDocket(value) {
  var s = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{2}-\d{1,5}$/.test(s)) return { ok: true, docket: s, term: s.slice(0, 2) };
  if (/^\d{2}A\d{1,4}$/.test(s)) return { ok: true, docket: s, term: s.slice(0, 2) };
  if (/^\d{1,3}O\d{1,4}$/.test(s)) return { ok: true, docket: s, term: null };
  return refusal('INVALID_DOCKET_NUMBER',
    'Use a Court docket identifier such as 25-250 or 25A111. Names and free-text search are not accepted by this endpoint.',
    { requested: s });
}

function officialUrl(docket) {
  var n = normaliseDocket(docket);
  if (!n.ok) return null;
  return OFFICIAL_ORIGIN + '/docket/docketfiles/html/public/' + encodeURIComponent(n.docket) + '.html';
}

function between(text, start, stops) {
  var at = text.indexOf(start);
  if (at < 0) return null;
  var tail = text.slice(at + start.length);
  var end = tail.length;
  (stops || []).forEach(function (stop) {
    var i = tail.indexOf(stop);
    if (i >= 0 && i < end) end = i;
  });
  return tail.slice(0, end).trim();
}

function extractLinks(html) {
  var links = [], seen = {};

  function add(href, label) {
    href = decodeEntities(href).trim();
    label = textFromHtml(label) || 'Official PDF';
    if (!href || /^javascript:/i.test(href) || /^mailto:/i.test(href)) return;
    var absolute;
    try { absolute = new URL(href, OFFICIAL_ORIGIN).toString(); } catch (e) { return; }
    if (!/^https:\/\/www\.supremecourt\.gov\/(?:DocketPDF|opinions)\/.*\.pdf(?:$|[?#])/i.test(absolute)) return;
    if (!seen[absolute]) { seen[absolute] = true; links.push({ label: label, url: absolute }); }
  }

  // The Court has used quoted and unquoted href attributes. Consume either,
  // but retain only official Court PDF paths.
  String(html || '').replace(
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    function (_, dq, sq, bare, label) { add(dq || sq || bare || '', label); return _; }
  );

  // Some docket templates serialize a document URL outside a conventional
  // anchor. The fallback still accepts only the two official Court PDF trees.
  String(html || '').replace(
    /(?:https?:\/\/www\.supremecourt\.gov)?\/(?:DocketPDF|opinions)\/[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?/gi,
    function (href) { add(href, 'Official PDF'); return href; }
  );
  return links;
}

function proceedings(text) {
  var start = text.indexOf('Proceedings and Orders');
  if (start < 0) return refusal('PROCEEDINGS_SECTION_MISSING', 'The official page has no Proceedings and Orders section.');
  var section = text.slice(start + 'Proceedings and Orders'.length);
  var stop = section.indexOf('\nAttorneys');
  if (stop >= 0) section = section.slice(0, stop);
  var marks = [], m;
  EVENT_DATE.lastIndex = 0;
  while ((m = EVENT_DATE.exec(section))) marks.push({ at: m.index, date: m[0] });
  if (!marks.length) return refusal('NO_PROCEEDINGS', 'The official page contains no dated proceeding entries.');
  var out = [];
  marks.forEach(function (mark, i) {
    var end = i + 1 < marks.length ? marks[i + 1].at : section.length;
    var raw = section.slice(mark.at + mark.date.length, end)
      .replace(/\s+/g, ' ').trim();
    if (!raw) return;
    out.push({ date: mark.date, text: raw });
  });
  if (!out.length) return refusal('NO_PROCEEDINGS', 'Dated markers were present but no proceeding text was retained.');
  return { ok: true, items: out };
}

function parse(html, requestedDocket) {
  if (typeof html !== 'string' || html.length < 500) return refusal('NOT_A_DOCKET_PAGE', 'The response is too small to be an official docket page.');
  var normalized = normaliseDocket(requestedDocket);
  if (!normalized.ok) return normalized;
  var sourceSha256 = crypto.createHash('sha256').update(html).digest('hex');
  var text = textFromHtml(html);
  var marker = text.indexOf('Docket for');
  if (marker < 0) return refusal('DOCKET_MARKER_MISSING', 'The official response does not identify itself as a docket page.', { sourceSha256: sourceSha256 });
  var body = text.slice(marker);
  var published = (body.match(/\bNo\.\s*([0-9]{2}-[0-9]{1,5}|[0-9]{2}A[0-9]{1,4}|[0-9]{1,3}O[0-9]{1,4})\b/i) || [])[1];
  if (!published) return refusal('DOCKET_ID_MISSING', 'The official page does not publish a docket identifier.', { sourceSha256: sourceSha256 });
  published = published.toUpperCase();
  if (published !== normalized.docket) return refusal('DOCKET_ID_MISMATCH', 'The returned docket does not match the requested docket.', {
    requested: normalized.docket, published: published, sourceSha256: sourceSha256
  });

  var title = between(body, 'Title:', ['Docketed:']);
  var docketed = between(body, 'Docketed:', ['Linked with:', 'Lower Ct:', 'Case Numbers:', 'Decision Date:', 'Questions Presented', 'Proceedings and Orders']);
  if (!title) return refusal('TITLE_MISSING', 'The official docket title is missing.', { sourceSha256: sourceSha256 });
  if (!docketed || !DOCKETED_DATE.test(docketed)) {
    return refusal('DOCKETED_DATE_MISSING', 'The official docketed date is missing or unrecognised.', { sourceSha256: sourceSha256 });
  }

  var p = proceedings(body);
  if (!p.ok) { p.sourceSha256 = sourceSha256; return p; }
  p.items.forEach(function (item, i) {
    item.observationId = crypto.createHash('sha256')
      .update(normalized.docket + '|' + item.date + '|' + i + '|' + item.text)
      .digest('hex');
  });

  var lowerCourt = between(body, 'Lower Ct:', ['Case Numbers:', 'Decision Date:', 'Questions Presented', 'Proceedings and Orders']);
  var caseNumbers = between(body, 'Case Numbers:', ['Decision Date:', 'Questions Presented', 'Proceedings and Orders']);
  var decisionDate = between(body, 'Decision Date:', ['Questions Presented', 'Proceedings and Orders']);
  var linkedWith = between(body, 'Linked with:', ['Lower Ct:', 'Case Numbers:', 'Decision Date:', 'Questions Presented', 'Proceedings and Orders']);

  return {
    ok: true,
    docket: normalized.docket,
    title: title.replace(/\s+/g, ' ').trim(),
    docketed: docketed.replace(/\s+/g, ' ').trim(),
    linkedWith: linkedWith ? linkedWith.replace(/\s+/g, ' ').trim() : null,
    lowerCourt: lowerCourt ? lowerCourt.replace(/\s+/g, ' ').trim() : null,
    lowerCourtCaseNumbers: caseNumbers ? caseNumbers.replace(/\s+/g, ' ').trim() : null,
    lowerCourtDecisionDate: decisionDate ? decisionDate.replace(/\s+/g, ' ').trim() : null,
    proceedings: p.items,
    documentLinks: extractLinks(html).filter(function (x) { return /DocketPDF|Main Document|Proof of Service|Appendix|Certificate/i.test(x.url + ' ' + x.label); }),
    sourceSha256: sourceSha256,
    sourceBytes: Buffer.byteLength(html, 'utf8'),
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION
  };
}

module.exports = {
  parse: parse,
  normaliseDocket: normaliseDocket,
  officialUrl: officialUrl,
  textFromHtml: textFromHtml,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION,
  OFFICIAL_ORIGIN: OFFICIAL_ORIGIN
};
