/**
 * Versioned reader for the World Justice Project Rule of Law Index 2025
 * historical workbook. It consumes only the named fields below and refuses
 * schema drift rather than accepting a nearby column.
 */
'use strict';

var zlib = require('zlib');
var crypto = require('crypto');

var PARSER_VERSION = 'wjp-rule-of-law/1.0.2';
var TRANSFORM_VERSION = 'xlsx-cell:string->score:number;delta:current-prior/1.0.0';
var SHEET_NAME = 'Historical Data';
var EXPECTED_COLUMN_COUNT = 58;
var EXPECTED_EDITION = 2025;
var EXPECTED_CURRENT_ROWS = 143;

var FIELDS = {
  countryYear: 'Country-Year',
  country: 'Country',
  code: 'Country Code',
  region: 'Region',
  year: 'Year',
  overall: 'WJP Rule of Law Index: Overall Score',
  f1: 'Factor 1: Constraints on Government Powers',
  f2: 'Factor 2: Absence of Corruption',
  f3: 'Factor 3: Open Government',
  f4: 'Factor 4: Fundamental Rights',
  f5: 'Factor 5: Order and Security',
  f6: 'Factor 6: Regulatory Enforcement',
  f7: 'Factor 7: Civil Justice',
  f8: 'Factor 8: Criminal Justice'
};

var METRICS = [
  ['overall', FIELDS.overall],
  ['factor1', FIELDS.f1],
  ['factor2', FIELDS.f2],
  ['factor3', FIELDS.f3],
  ['factor4', FIELDS.f4],
  ['factor5', FIELDS.f5],
  ['factor6', FIELDS.f6],
  ['factor7', FIELDS.f7],
  ['factor8', FIELDS.f8]
];

function refusal(code, detail, extra) {
  var out = { ok: false, code: code, detail: detail };
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function decodeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x0A;/gi, '\n')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&amp;/g, '&');
}

function attrs(s) {
  var out = {}, m, re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  while ((m = re.exec(String(s)))) out[m[1]] = decodeXml(m[2]);
  return out;
}

function scanElements(xml, name) {
  var out = [], re = new RegExp('<' + name + '\\b([^>]*?)(\\/?>)', 'g'), m;
  while ((m = re.exec(xml))) {
    if (m[2] === '/>') { out.push({ attrs: m[1], inner: '' }); continue; }
    var end = xml.indexOf('</' + name + '>', re.lastIndex);
    if (end < 0) throw new Error('unterminated <' + name + '>');
    out.push({ attrs: m[1], inner: xml.slice(re.lastIndex, end) });
    re.lastIndex = end + name.length + 3;
  }
  return out;
}

function unzip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('not a workbook buffer');
  if (buf.readUInt16LE(0) !== 0x4b50) throw new Error('missing PK signature');
  var eocd = -1;
  for (var i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('missing end-of-central-directory');
  var count = buf.readUInt16LE(eocd + 10);
  var off = buf.readUInt32LE(eocd + 16);
  var out = {};
  for (var n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new Error('invalid central directory');
    var method = buf.readUInt16LE(off + 10);
    var csize = buf.readUInt32LE(off + 20);
    var nameLen = buf.readUInt16LE(off + 28);
    var extraLen = buf.readUInt16LE(off + 30);
    var commentLen = buf.readUInt16LE(off + 32);
    var local = buf.readUInt32LE(off + 42);
    var name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error('invalid local header');
    var localName = buf.readUInt16LE(local + 26);
    var localExtra = buf.readUInt16LE(local + 28);
    var start = local + 30 + localName + localExtra;
    var raw = buf.slice(start, start + csize);
    if (method !== 0 && method !== 8) throw new Error('unsupported zip compression method ' + method);
    out[name] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function columnNumber(ref) {
  var m = String(ref).match(/^([A-Z]+)\d+$/);
  if (!m) return null;
  var n = 0;
  for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64;
  return n - 1;
}

function normaliseHeader(s) {
  return String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function readWorkbook(buf) {
  var zip = unzip(buf);
  var workbookXml = zip['xl/workbook.xml'];
  var relsXml = zip['xl/_rels/workbook.xml.rels'];
  if (!workbookXml || !relsXml) throw new Error('workbook relationships are missing');

  var rid = null, sheetNames = [];
  scanElements(workbookXml, 'sheet').forEach(function (s) {
    var a = attrs(s.attrs);
    sheetNames.push(a.name);
    if (a.name === SHEET_NAME) rid = a['r:id'];
  });
  if (!rid) throw new Error('worksheet "' + SHEET_NAME + '" is missing');

  var target = null;
  scanElements(relsXml, 'Relationship').forEach(function (r) {
    var a = attrs(r.attrs);
    if (a.Id === rid) target = a.Target;
  });
  if (!target) throw new Error('worksheet relationship is missing');
  target = String(target).replace(/^\/+/, '').replace(/^xl\//, '');
  var sheetPath = 'xl/' + target;
  var sheetXml = zip[sheetPath];
  if (!sheetXml) throw new Error('worksheet part ' + sheetPath + ' is missing');

  var shared = [];
  scanElements(zip['xl/sharedStrings.xml'] || '', 'si').forEach(function (si) {
    var text = '';
    scanElements(si.inner, 't').forEach(function (t) { text += decodeXml(t.inner); });
    shared.push(text);
  });

  var rows = [];
  scanElements(sheetXml, 'row').forEach(function (r) {
    var ra = attrs(r.attrs);
    var values = [];
    scanElements(r.inner, 'c').forEach(function (c) {
      var ca = attrs(c.attrs);
      var col = columnNumber(ca.r);
      if (col === null) return;
      var v = (c.inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (ca.t === 'inlineStr') {
        var parts = [];
        scanElements(c.inner, 't').forEach(function (t) { parts.push(decodeXml(t.inner)); });
        v = parts.join('');
      } else if (ca.t === 's' && v !== undefined) {
        v = shared[Number(v)];
      }
      values[col] = v === undefined ? '' : decodeXml(v);
    });
    rows.push({ number: Number(ra.r || rows.length + 1), values: values });
  });

  var core = zip['docProps/core.xml'] || '';
  function coreTag(name) {
    var m = core.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>'));
    return m ? decodeXml(m[1]) : null;
  }

  return {
    rows: rows,
    sheetNames: sheetNames,
    sheetPath: sheetPath,
    created: coreTag('dcterms:created'),
    modified: coreTag('dcterms:modified'),
    creator: coreTag('dc:creator'),
    lastModifiedBy: coreTag('cp:lastModifiedBy')
  };
}

function metricValue(raw, label, rowNumber) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return refusal('MISSING_SCORE', label + ' is missing', { row: rowNumber });
  }
  var n = Number(raw);
  if (!isFinite(n) || n < 0 || n > 1) {
    return refusal('INVALID_SCORE', label + ' must be a finite score from 0 through 1', { row: rowNumber, raw: raw });
  }
  return { ok: true, value: n, raw: String(raw) };
}

function parseRows(rows, workbookMeta) {
  if (!Array.isArray(rows) || !rows.length) return refusal('EMPTY_SHEET', 'Historical Data has no rows');
  var header = rows[0].values.map(normaliseHeader);
  while (header.length && !header[header.length - 1]) header.pop();
  if (header.length !== EXPECTED_COLUMN_COUNT) {
    return refusal('COLUMN_COUNT_MISMATCH', 'Historical Data must contain the declared 58-column schema', {
      expected: EXPECTED_COLUMN_COUNT, got: header.length
    });
  }

  var positions = {}, duplicates = [];
  header.forEach(function (h, i) {
    if (!h) return;
    if (positions[h] !== undefined) duplicates.push(h);
    positions[h] = i;
  });
  if (duplicates.length) return refusal('DUPLICATE_HEADER', 'duplicate header names are ambiguous', { headers: duplicates });

  // The publisher's live 2025 workbook does not supply the earlier convenience
  // `Country-Year` column. Identity is the source-supplied Country Code + Year pair;
  // both remain required and duplicate-checked below.
  var required = Object.keys(FIELDS).filter(function (k) { return k !== 'countryYear'; })
    .map(function (k) { return FIELDS[k]; });
  var missing = required.filter(function (h) { return positions[h] === undefined; });
  if (missing.length) return refusal('REQUIRED_HEADER_MISSING', 'one or more consumed headers are absent', { missing: missing });

  var observations = [], problems = [];
  rows.slice(1).forEach(function (r) {
    var v = r.values || [];
    var code = normaliseHeader(v[positions[FIELDS.code]]);
    var country = normaliseHeader(v[positions[FIELDS.country]]);
    var region = normaliseHeader(v[positions[FIELDS.region]]);
    var yearText = normaliseHeader(v[positions[FIELDS.year]]);
    if (!code && !country && !yearText) return;
    if (!/^[A-Z]{3}$/.test(code)) { problems.push({ row: r.number, field: 'Country Code', raw: code }); return; }
    var yearMatch = yearText.match(/^(20\d{2})(?:-(20\d{2}))?$/);
    if (!country || !region || !yearMatch) {
      problems.push({ row: r.number, field: 'identity', country: country, region: region, year: yearText }); return;
    }
    var firstYear = Number(yearMatch[1]);
    var year = Number(yearMatch[2] || yearMatch[1]);
    if (year < firstYear || year - firstYear > 1) {
      problems.push({ row: r.number, field: 'Year range', raw: yearText }); return;
    }
    var metrics = {}, bad = null;
    METRICS.forEach(function (m) {
      if (bad) return;
      var x = metricValue(v[positions[m[1]]], m[1], r.number);
      if (!x.ok) { bad = x; return; }
      metrics[m[0]] = { value: x.value, raw: x.raw, rawUnits: 'published score text', transformedUnits: 'score on 0..1 scale' };
    });
    if (bad) { problems.push(bad); return; }
    observations.push({
      countryYear: positions[FIELDS.countryYear] === undefined ? null
        : normaliseHeader(v[positions[FIELDS.countryYear]]),
      country: country, countryCode: code, region: region,
      publishedYearLabel: yearText, year: year, metrics: metrics
    });
  });
  if (problems.length) return refusal('ROW_VALIDATION_FAILED', 'one or more historical rows failed validation', { problems: problems.slice(0, 20), problemCount: problems.length });
  if (observations.length < 1400) return refusal('ROW_COUNT_MISMATCH', 'the declared edition is missing historical observations', { got: observations.length, minimum: 1400 });

  var maxYear = observations.reduce(function (m, x) { return Math.max(m, x.year); }, 0);
  if (maxYear !== EXPECTED_EDITION) return refusal('EDITION_MISMATCH', 'the workbook is not the reviewed 2025 edition', { expected: EXPECTED_EDITION, got: maxYear });
  var current = observations.filter(function (x) { return x.year === EXPECTED_EDITION; });
  if (current.length !== EXPECTED_CURRENT_ROWS) return refusal('CURRENT_COVERAGE_MISMATCH', 'the 2025 edition must contain 143 current country observations', { expected: EXPECTED_CURRENT_ROWS, got: current.length });

  var seen = {};
  for (var i = 0; i < observations.length; i++) {
    var key = observations[i].countryCode + '|' + observations[i].publishedYearLabel;
    if (seen[key]) return refusal('DUPLICATE_OBSERVATION', 'country-year identity occurs more than once', { identity: key });
    seen[key] = true;
  }

  return {
    ok: true,
    schemaVersion: 'historical-data-2025/v1',
    edition: EXPECTED_EDITION,
    headerCount: header.length,
    rowCount: observations.length,
    currentCountryCount: current.length,
    observations: observations,
    countries: current.map(function (x) { return { code: x.countryCode, name: x.country, region: x.region }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); }),
    workbook: workbookMeta || {}
  };
}

function stampMetrics(parsed, fields) {
  if (!parsed || !parsed.ok) return parsed;
  parsed.observations.forEach(function (o) {
    Object.keys(o.metrics).forEach(function (k) {
      if (!o.metrics[k].provenance) o.metrics[k].provenance = {};
      Object.keys(fields || {}).forEach(function (f) {
        if (fields[f] !== undefined) o.metrics[k].provenance[f] = fields[f];
      });
    });
  });
  return parsed;
}

function parse(buf) {
  var hash = Buffer.isBuffer(buf) ? crypto.createHash('sha256').update(buf).digest('hex') : null;
  var wb;
  try { wb = readWorkbook(buf); }
  catch (e) { return refusal('NOT_A_WORKBOOK', e.message, { sourceSha256: hash, sourceBytes: Buffer.isBuffer(buf) ? buf.length : null }); }
  var out = parseRows(wb.rows, {
    sheetNames: wb.sheetNames, sheetPath: wb.sheetPath, created: wb.created,
    modified: wb.modified, creator: wb.creator, lastModifiedBy: wb.lastModifiedBy
  });
  out.sourceSha256 = hash;
  out.sourceBytes = buf.length;
  if (out.ok) stampMetrics(out, {
    sourceRef: 'WJP-ROL-2025@' + hash.slice(0, 12),
    sourceSha256: hash,
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION
  });
  return out;
}

function countryView(parsed, code) {
  if (!parsed || !parsed.ok) return refusal('UNPARSED_DATA', 'a validated workbook is required');
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return refusal('INVALID_COUNTRY_CODE', 'country must be a three-letter code', { requested: code });
  var history = parsed.observations.filter(function (x) { return x.countryCode === code && x.year >= 2015; })
    .sort(function (a, b) { return a.year - b.year; });
  if (!history.length) return refusal('COUNTRY_NOT_FOUND', 'no observation exists for this country code', { requested: code });
  var current = history[history.length - 1];
  if (current.year !== parsed.edition) return refusal('NO_CURRENT_COUNTRY_OBSERVATION', 'the selected country has no observation in the current edition', { requested: code, lastYear: current.year });
  var prior = history.length > 1 ? history[history.length - 2] : null;
  var changes = {};
  Object.keys(current.metrics).forEach(function (k) {
    changes[k] = prior ? current.metrics[k].value - prior.metrics[k].value : null;
  });
  return { ok: true, current: current, prior: prior, history: history, arithmeticChanges: changes };
}

module.exports = {
  parse: parse,
  parseRows: parseRows,
  readWorkbook: readWorkbook,
  countryView: countryView,
  stampMetrics: stampMetrics,
  FIELDS: FIELDS,
  METRICS: METRICS,
  SHEET_NAME: SHEET_NAME,
  EXPECTED_COLUMN_COUNT: EXPECTED_COLUMN_COUNT,
  EXPECTED_EDITION: EXPECTED_EDITION,
  EXPECTED_CURRENT_ROWS: EXPECTED_CURRENT_ROWS,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION
};
