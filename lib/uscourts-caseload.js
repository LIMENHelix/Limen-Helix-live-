/**
 * lib/uscourts-caseload.js — versioned reader for the Administrative Office of the U.S.
 * Courts "Statistical Tables for the Federal Judiciary", Table B (U.S. Courts of Appeals).
 *
 * WHAT THIS IS FOR. An operator evidence portal needs to show an authoritative number and
 * be able to prove where it came from. That requires refusing to guess. This module parses
 * the published .xlsx, validates it against a DECLARED schema version, and returns either a
 * fully-provenanced record or an explicit refusal. It never returns a partial guess.
 *
 * ── WHY THE SCHEMA IS VERSIONED AND WHY POSITION ALONE IS NOT ENOUGH ────────────────────
 *
 * Two schema versions are published (measured across 14 workbooks, 2018-06-30 to 2026-06-30):
 *
 *   v1  2018-06-30 .. 2021-12-31   headers: Commenced | Terminated | Pending
 *                                  footnote markers present (Percent Change¹, prior Pending²)
 *   v2  2022-06-30 .. present      headers: Filed | Terminated | Pending
 *                                  footnote markers absent
 *
 * The cell POSITIONS and the structural merges are identical in both. So a position-only
 * parser would silently join `Commenced` to `Filed` as if they were one series.
 *
 * THAT EQUIVALENCE IS NOT ESTABLISHED. There is no publisher documentation for it: the
 * "Explanation of Selected Terms" page is a 404 and /glossary carries no statistical
 * variable definitions. The available evidence is circumstantial in both directions —
 * every workbook's TITLE still reads "Cases Commenced, Terminated, and Pending" including
 * the 2026 edition whose column header reads "Filed", and the 13 circuit values are
 * identical across the 2021/2022 label boundary, which shows no level shift but does not
 * establish that the definition did not change going forward.
 *
 * So this module does NOT normalise the two labels into one variable. It carries the
 * PUBLISHED label through to the caller as `commencedOrFiled.label`, and callers are
 * expected to show it rather than assert a joined series. `equivalenceEstablished` is
 * exported as false so nothing downstream can quietly assume otherwise.
 *
 * Validation requires BOTH: normalised headers at expected positions AND the structural
 * merges. An unrecognised combination is REFUSED, never coerced into the nearest version.
 *
 * Pure and deterministic apart from the caller supplying bytes: no clock, no network, no I/O.
 */

'use strict';

var zlib = require('zlib');
var crypto = require('crypto');

/* Commenced and Filed are NOT asserted to be the same variable. See the header. */
var EQUIVALENCE_ESTABLISHED = false;

/* The four merges that are structurally identical in every observed vintage. The title and
   note merges vary (A1:J1 vs A1:K1, A19/A22) so they are informational, not required. */
var REQUIRED_MERGES = ['A3:A4', 'B3:D3', 'E3:G3', 'H3:J3'];

/* Exactly these row labels, in this order. A change here is row-schema drift and is refused. */
var EXPECTED_CIRCUITS = ['Total', 'DC', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th'];

/**
 * Schema versions carry an ERA, and the era is enforced.
 *
 * Headers alone are not sufficient identification. A workbook reporting 2026 whose first
 * group header reads "Commenced" is not a v1 file: v1 ended at the 2021 December edition.
 * It is an anomaly — a republished old template, a hand-edited sheet, or an upstream
 * regression — and accepting it would silently attach a stale variable definition to a
 * current period. Header match plus era match, or refuse.
 *
 * `fromOrdinal` / `toOrdinal` use ordinal(year, endpoint) below. `toOrdinal: null` is open-ended.
 */
var SCHEMAS = [
  {
    version: 'v1',
    span: '2018-06-30 .. 2021-12-31',
    firstVariable: 'commenced',
    groups: { B: 'commenced', E: 'terminated', H: 'pending' },
    footnotesExpected: true,
    priorPendingRevisedMarker: true,   // '²  Revised.' sits on the prior-year Pending header
    fromYear: 2018, fromEndpoint: '0630',
    toYear: 2021, toEndpoint: '1231'
  },
  {
    version: 'v2',
    span: '2022-06-30 .. present',
    firstVariable: 'filed',
    groups: { B: 'filed', E: 'terminated', H: 'pending' },
    footnotesExpected: false,
    priorPendingRevisedMarker: false,
    fromYear: 2022, fromEndpoint: '0630',
    toYear: null, toEndpoint: null      // open-ended
  }
];

/** Version of the parse + transformation contract. Bump when extraction semantics change. */
var PARSER_VERSION = 'uscourts-caseload/1.1.0';
var TRANSFORM_VERSION = 'cells:string->integer;percent:string->float;no-rescaling/1.0.0';

/** Total ordering over reporting periods: June precedes December within a year. */
function ordinal(year, endpointKey) {
  return (year * 2) + (endpointKey === '1231' ? 1 : 0);
}

/**
 * eraContains(schema, year, endpointKey) — is this period inside the schema's published span?
 * When the endpoint is unknown the check degrades to whole years, which is the widest
 * defensible reading and still rejects a 2026 file claiming v1.
 */
function eraContains(schema, year, endpointKey) {
  if (typeof year !== 'number' || !isFinite(year)) return true;   // nothing to check against
  if (endpointKey) {
    var o = ordinal(year, endpointKey);
    if (o < ordinal(schema.fromYear, schema.fromEndpoint)) return false;
    if (schema.toYear !== null && o > ordinal(schema.toYear, schema.toEndpoint)) return false;
    return true;
  }
  if (year < schema.fromYear) return false;
  if (schema.toYear !== null && year > schema.toYear) return false;
  return true;
}

/* Reporting endpoints the publisher actually uses. Anything else is refused rather than
   guessed: a 0331 or 0930 file would be a new cadence, not a variant of this one. */
var ENDPOINTS = { '630': { key: '0630', monthDay: 'June 30' }, '1231': { key: '1231', monthDay: 'December 31' } };

function refusal(code, detail, extra) {
  var r = { ok: false, code: code, detail: detail };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) r[k] = extra[k];
  return r;
}

/* ── ZIP ──────────────────────────────────────────────────────────────────────────────── */

function unzip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('not a buffer');
  if (buf.slice(0, 2).toString('latin1') !== 'PK') throw new Error('missing PK signature');
  var eocd = -1;
  for (var i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  var n = buf.readUInt16LE(eocd + 10);
  var off = buf.readUInt32LE(eocd + 16);
  var out = {};
  for (var k = 0; k < n; k++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    var method = buf.readUInt16LE(off + 10);
    var csize = buf.readUInt32LE(off + 20);
    var nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), cmtLen = buf.readUInt16LE(off + 32);
    var lho = buf.readUInt32LE(off + 42);
    var name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    var lNameLen = buf.readUInt16LE(lho + 26), lExtraLen = buf.readUInt16LE(lho + 28);
    var start = lho + 30 + lNameLen + lExtraLen;
    var raw = buf.slice(start, start + csize);
    out[name] = method === 0 ? raw.toString('utf8') : zlib.inflateRawSync(raw).toString('utf8');
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

/* ── OOXML ────────────────────────────────────────────────────────────────────────────── */

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x0A;/gi, '\n').replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
    .replace(/&amp;/g, '&');
}

/**
 * Rows and cells must be scanned with self-closing elements handled explicitly. A naive
 * `<row ...>(.*?)</row>` regex silently attributes a self-closing spacer row's number to the
 * NEXT row's contents, which shifts every subsequent row by one. That defect produced a
 * wrong header reading during the source survey; it is the reason this is written this way.
 */
function scanElements(xml, tagName) {
  var out = [], re = new RegExp('<' + tagName + '\\b([^>]*?)(\\/>|>)', 'g'), m;
  while ((m = re.exec(xml))) {
    if (m[2] === '/>') { out.push({ attrs: m[1], inner: '' }); continue; }
    var end = xml.indexOf('</' + tagName + '>', re.lastIndex);
    out.push({ attrs: m[1], inner: xml.slice(re.lastIndex, end < 0 ? undefined : end) });
    if (end >= 0) re.lastIndex = end + tagName.length + 3;
  }
  return out;
}

function readWorkbook(buf) {
  var z = unzip(buf);
  var sheetPaths = Object.keys(z).filter(function (p) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(p); }).sort();
  if (!sheetPaths.length) throw new Error('no worksheet part');

  var shared = [];
  var ssXml = z['xl/sharedStrings.xml'] || '';
  scanElements(ssXml, 'si').forEach(function (si) {
    var t = '';
    scanElements(si.inner, 't').forEach(function (tt) { t += tt.inner; });
    shared.push(decodeXml(t));
  });

  var sheetXml = z[sheetPaths[0]];
  var rows = scanElements(sheetXml, 'row').map(function (r) {
    var num = +((r.attrs.match(/\br="(\d+)"/) || [])[1]);
    var cells = {};
    scanElements(r.inner, 'c').forEach(function (c) {
      var ref = (c.attrs.match(/\br="([A-Z]+)(\d+)"/) || []);
      if (!ref[1]) return;
      var v = (c.inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (/t="inlineStr"/.test(c.attrs)) v = (c.inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      else if (/t="s"/.test(c.attrs) && v !== undefined) v = shared[+v];
      cells[ref[1]] = (v === undefined || v === null) ? '' : decodeXml(String(v));
    });
    return { n: num, cells: cells };
  });

  var merges = [];
  var mm, mre = /<mergeCell ref="([^"]+)"/g;
  while ((mm = mre.exec(sheetXml))) merges.push(mm[1]);

  var core = z['docProps/core.xml'] || '';
  function coreTag(t) {
    var m = core.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)<\\/' + t + '>'));
    return m ? decodeXml(m[1]) : null;
  }
  var wbXml = z['xl/workbook.xml'] || '';
  var sheetNames = [];
  var sm, sre = /<sheet [^>]*name="([^"]*)"/g;
  while ((sm = sre.exec(wbXml))) sheetNames.push(decodeXml(sm[1]));

  return {
    rows: rows, merges: merges, shared: shared, sheetNames: sheetNames, sheetCount: sheetPaths.length,
    created: coreTag('dcterms:created'), modified: coreTag('dcterms:modified'),
    creator: coreTag('dc:creator'), lastModifiedBy: coreTag('cp:lastModifiedBy'),
    parts: Object.keys(z).sort()
  };
}

/* ── VALIDATION ───────────────────────────────────────────────────────────────────────── */

/** lowercase, drop footnote superscripts and all whitespace. 'Percent\r\nChange¹' -> 'percentchange' */
function norm(s) {
  return String(s == null ? '' : s).replace(/[¹²³⁰-₟]/g, '').replace(/\s+/g, '').toLowerCase();
}

function rowByNumber(wb, n) {
  for (var i = 0; i < wb.rows.length; i++) if (wb.rows[i].n === n) return wb.rows[i].cells;
  return null;
}

/**
 * detectSchema(wb, opts) — returns { ok:true, schema, ... } or a refusal.
 *
 * Requires ALL of: the structural merges, the normalised header cells at their expected
 * positions, agreement of all three variable groups on the periods they cover, agreement
 * with the filename's reporting year, and the detected version being inside its published
 * era. `opts.year` and `opts.endpoint` come from the filename when one is supplied.
 */
function detectSchema(wb, opts) {
  var missingMerges = REQUIRED_MERGES.filter(function (m) { return wb.merges.indexOf(m) < 0; });
  if (missingMerges.length) {
    return refusal('MERGE_MISMATCH',
      'required merged ranges absent; the sheet is not this table', { missing: missingMerges, found: wb.merges });
  }
  var g = rowByNumber(wb, 3), y = rowByNumber(wb, 4);
  if (!g || !y) return refusal('HEADER_ROWS_MISSING', 'row 3 (group labels) or row 4 (period labels) absent');

  var got = { B: norm(g.B), E: norm(g.E), H: norm(g.H), A: norm(g.A) };
  if (got.A !== 'circuit') {
    return refusal('HEADER_MISMATCH', 'A3 is not the Circuit label', { expected: 'circuit', got: got.A });
  }
  var match = null;
  for (var i = 0; i < SCHEMAS.length; i++) {
    var s = SCHEMAS[i];
    if (got.B === s.groups.B && got.E === s.groups.E && got.H === s.groups.H) { match = s; break; }
  }
  if (!match) {
    return refusal('UNKNOWN_SCHEMA',
      'group headers match no declared schema version; refusing rather than assuming a version',
      { got: [got.B, got.E, got.H], known: SCHEMAS.map(function (s) { return s.version + ':' + [s.groups.B, s.groups.E, s.groups.H].join('|'); }) });
  }
  /* Period labels must be two consecutive four-digit years plus a percent-change column, in
     each of the three groups — AND all three groups must agree. A table whose Pending group
     covers different years from its Filed group is not a table this reader can flatten into
     one record, and quietly taking group B's years would mislabel the other two. */
  var yr = /^(19|20)\d\d$/;
  var trip = [['B', 'C', 'D'], ['E', 'F', 'G'], ['H', 'I', 'J']];
  var groupYears = [];
  for (var t = 0; t < trip.length; t++) {
    var a = String(y[trip[t][0]] || '').replace(/[^\d]/g, '');
    var b = String(y[trip[t][1]] || '').replace(/[^\d]/g, '');
    var p = norm(y[trip[t][2]]);
    if (!yr.test(a) || !yr.test(b)) {
      return refusal('PERIOD_HEADER_MISMATCH', 'group ' + trip[t][0] + ' lacks two four-digit period labels', { got: [y[trip[t][0]], y[trip[t][1]]] });
    }
    if (+b !== +a + 1) {
      return refusal('PERIOD_NOT_CONSECUTIVE', 'group ' + trip[t][0] + ' periods are not consecutive years', { prior: a, current: b });
    }
    if (p !== 'percentchange') {
      return refusal('PERCENT_HEADER_MISMATCH', 'group ' + trip[t][0] + ' third column is not Percent Change', { got: y[trip[t][2]] });
    }
    groupYears.push({ group: trip[t][0], prior: +a, current: +b });
  }
  for (var q = 1; q < groupYears.length; q++) {
    if (groupYears[q].prior !== groupYears[0].prior || groupYears[q].current !== groupYears[0].current) {
      return refusal('GROUP_PERIOD_MISMATCH',
        'the three variable groups do not cover the same periods; they cannot be read as one record',
        { groups: groupYears });
    }
  }

  var priorPeriod = groupYears[0].prior, currentPeriod = groupYears[0].current;

  /* The filename's reporting year is the publisher's own statement of which period this
     workbook is. If the headers disagree with it, one of the two is wrong and neither can
     be preferred without guessing. */
  if (opts && typeof opts.year === 'number' && opts.year !== currentPeriod) {
    return refusal('FILENAME_PERIOD_MISMATCH',
      'the filename reporting year does not match the current-period column header',
      { filenameYear: opts.year, headerCurrentPeriod: currentPeriod });
  }

  /* Header match is necessary but not sufficient: the version must also be in its era. */
  if (!eraContains(match, currentPeriod, opts && opts.endpoint)) {
    return refusal('SCHEMA_ERA_MISMATCH',
      'headers match ' + match.version + ' but the reporting period lies outside that version\'s published span',
      {
        detectedByHeaders: match.version, publishedSpan: match.span,
        currentPeriod: currentPeriod, endpoint: (opts && opts.endpoint) || null,
        headers: [got.B, got.E, got.H]
      });
  }

  return {
    ok: true, schema: match,
    priorPeriod: priorPeriod,
    currentPeriod: currentPeriod,
    groupYears: groupYears,
    publishedFirstVariableLabel: String(g.B || '').trim()
  };
}

/* ── EXTRACTION ───────────────────────────────────────────────────────────────────────── */

function asCount(v) {
  if (v === undefined || v === null || String(v).trim() === '') return { ok: false, reason: 'missing' };
  var s = String(v).trim();
  if (!/^-?\d+$/.test(s)) return { ok: false, reason: 'not an integer count: ' + JSON.stringify(s) };
  var n = Number(s);
  if (!isFinite(n)) return { ok: false, reason: 'not finite' };
  if (n < 0) return { ok: false, reason: 'negative count' };
  return { ok: true, value: n };
}

function asPercent(v) {
  if (v === undefined || v === null || String(v).trim() === '') return { ok: true, value: null, suppressed: true };
  var n = Number(String(v).trim());
  if (!isFinite(n)) return { ok: false, reason: 'not a finite number: ' + JSON.stringify(v) };
  return { ok: true, value: n, suppressed: false };
}

/**
 * parse(buffer, opts) — full pipeline. opts.filename supplies the reporting endpoint.
 * Returns { ok:true, ... } or a refusal object with `code`.
 */
function parse(buf, opts) {
  var wb;
  try { wb = readWorkbook(buf); }
  catch (e) { return refusal('NOT_A_WORKBOOK', e.message); }
  var out = parseWorkbookObject(wb, opts);
  /* The content hash is an immutable identifier for THESE BYTES. It is attached to refusals
     as well as successes, so a rejected upstream file can still be identified exactly. */
  out.sourceSha256 = crypto.createHash('sha256').update(buf).digest('hex');
  out.sourceBytes = buf.length;
  return out;
}

/**
 * parseWorkbookObject(wb, opts) — everything after the bytes are decoded.
 *
 * Split out from parse() so the refusal paths are testable by mutating a REAL parsed
 * workbook (change a header, blank a cell, corrupt a count) rather than hand-forging zip
 * bytes. A hand-forged fixture tests the forger; a mutated real one tests the validator.
 */
function parseWorkbookObject(wb, opts) {
  opts = opts || {};

  /* The endpoint is resolved FIRST: schema-era and filename-period checks both depend on it,
     so detecting a version before knowing the period would decide on partial information. */
  var endpoint = null;
  if (opts.filename) {
    endpoint = parseEndpoint(opts.filename);
    if (!endpoint.ok) return endpoint;
  }

  var det = detectSchema(wb, endpoint ? { year: endpoint.year, endpoint: endpoint.endpoint } : null);
  if (!det.ok) { det.workbook = { sheetNames: wb.sheetNames, merges: wb.merges }; return det; }

  /* Row labels: exactly the expected 13, in order. Drift is refused, not tolerated. */
  var labelled = wb.rows.filter(function (r) {
    var a = String(r.cells.A == null ? '' : r.cells.A).trim();
    return EXPECTED_CIRCUITS.indexOf(a) >= 0;
  });
  var seen = labelled.map(function (r) { return String(r.cells.A).trim(); });
  if (seen.length !== EXPECTED_CIRCUITS.length || seen.join(',') !== EXPECTED_CIRCUITS.join(',')) {
    return refusal('ROW_SCHEMA_DRIFT', 'circuit rows differ from the declared set/order',
      { expected: EXPECTED_CIRCUITS, got: seen });
  }

  var COLS = {
    commencedOrFiled: { prior: 'B', current: 'C', pct: 'D' },
    terminated: { prior: 'E', current: 'F', pct: 'G' },
    pending: { prior: 'H', current: 'I', pct: 'J' }
  };
  var problems = [], circuits = [];
  labelled.forEach(function (r) {
    var rec = { circuit: String(r.cells.A).trim(), variables: {} };
    Object.keys(COLS).forEach(function (v) {
      var c = COLS[v];
      var prior = asCount(r.cells[c.prior]), cur = asCount(r.cells[c.current]), pct = asPercent(r.cells[c.pct]);
      if (!prior.ok) problems.push(rec.circuit + '.' + v + '.prior: ' + prior.reason);
      if (!cur.ok) problems.push(rec.circuit + '.' + v + '.current: ' + cur.reason);
      if (!pct.ok) problems.push(rec.circuit + '.' + v + '.percentChange: ' + pct.reason);
      /* Both the value AS PUBLISHED and the value AS TRANSFORMED are carried. The
         transformation here is only text -> number: no rescaling, no unit conversion, no
         imputation. Keeping the raw string means a reader can audit the transformation
         rather than trust it. */
      rec.variables[v] = {
        prior: prior.ok ? prior.value : null,
        current: cur.ok ? cur.value : null,
        percentChange: pct.ok ? pct.value : null,
        percentChangeSuppressed: pct.ok ? !!pct.suppressed : false,
        units: 'cases',
        raw: {
          prior: r.cells[c.prior] === undefined ? null : String(r.cells[c.prior]),
          current: r.cells[c.current] === undefined ? null : String(r.cells[c.current]),
          percentChange: r.cells[c.pct] === undefined ? null : String(r.cells[c.pct])
        },
        rawUnits: { counts: 'cases, as published integer text', percentChange: 'percent, as published decimal text' },
        transformedUnits: { counts: 'cases (integer)', percentChange: 'percent (float, unrescaled)' }
      };
    });
    circuits.push(rec);
  });
  if (problems.length) {
    return refusal('CELL_VALIDATION_FAILED', 'one or more cells are missing or not valid counts', { problems: problems });
  }

  var noteText = null;
  wb.rows.forEach(function (r) {
    var a = String(r.cells.A == null ? '' : r.cells.A);
    if (/^NOTE:/i.test(a.trim())) noteText = a.trim();
  });

  var title = (rowByNumber(wb, 1) || {}).A || null;

  /* The workbook's own title names its reporting date ("...12-Month Periods Ending June 30,
     2025 and 2026"). The filename names it too. Nothing else in the sheet distinguishes a
     June edition from a December one, so if those two disagree the file is mis-served or
     mis-named and neither statement can be preferred. */
  if (endpoint && title) {
    var want = ENDPOINTS[String(endpoint.endpoint) === '1231' ? '1231' : '630'].monthDay;
    var titleFlat = String(title).replace(/\s+/g, ' ');
    if (!new RegExp('Ending\\s+' + want.replace(/\s+/g, '\\s+'), 'i').test(titleFlat)) {
      return refusal('TITLE_ENDPOINT_MISMATCH',
        'the workbook title does not state the reporting date the filename claims',
        { filenameEndpoint: endpoint.endpoint, expectedInTitle: 'Ending ' + want, title: titleFlat.slice(0, 200) });
    }
  }

  return {
    ok: true,
    table: 'B',
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION,
    tableTitle: title,
    schemaVersion: det.schema.version,
    schemaSpan: det.schema.span,
    firstVariableLabel: det.publishedFirstVariableLabel,        // 'Commenced' or 'Filed', as published
    equivalenceEstablished: EQUIVALENCE_ESTABLISHED,            // false: do NOT join the two as one series
    priorPeriod: det.priorPeriod,
    currentPeriod: det.currentPeriod,
    endpoint: endpoint ? endpoint.endpoint : null,
    endpointLabel: endpoint ? endpoint.label : null,
    circuits: circuits,
    note: noteText,
    revisionMarkerDeclared: det.schema.priorPendingRevisedMarker,
    workbook: {
      sheetNames: wb.sheetNames, sheetCount: wb.sheetCount, merges: wb.merges,
      created: wb.created, modified: wb.modified, creator: wb.creator, lastModifiedBy: wb.lastModifiedBy
    }
  };
}

/** parseEndpoint('stfj_b_630.2026.xlsx') -> { ok, endpoint:'0630', year:2026, label } */
function parseEndpoint(filename) {
  var m = String(filename).match(/stfj_b_(\d{3,4})\.(\d{4})(?:_\d+)?\.xlsx$/i);
  if (!m) return refusal('UNKNOWN_FILENAME', 'filename is not a recognised Table B workbook name', { filename: filename });
  var e = ENDPOINTS[m[1]];
  if (!e) {
    return refusal('UNKNOWN_REPORTING_ENDPOINT',
      'reporting endpoint ' + m[1] + ' is not one this table is known to publish; refusing rather than assuming a cadence',
      { got: m[1], known: Object.keys(ENDPOINTS) });
  }
  return { ok: true, endpoint: e.key, year: +m[2], label: '12-month period ending ' + e.monthDay + ', ' + m[2] };
}

/**
 * supersession(currentEdition, priorEdition) — which values the publisher restated.
 *
 * Both editions carry the same overlapping period: the current edition's PRIOR column and
 * the prior edition's CURRENT column describe the same 12 months. Any difference is the
 * publisher superseding a previously published figure.
 *
 * Applied to ALL THREE variables. In the surveyed sample only Pending differed, but absence
 * of an observed revision in a bounded sample is not finality, so nothing here treats
 * Commenced/Filed or Terminated as final.
 */
function supersession(current, prior) {
  if (!current || !current.ok || !prior || !prior.ok) return { ok: false, code: 'NEED_TWO_PARSED_EDITIONS' };
  if (current.priorPeriod !== prior.currentPeriod) {
    return { ok: false, code: 'NO_OVERLAP', detail: 'current.priorPeriod ' + current.priorPeriod + ' != prior.currentPeriod ' + prior.currentPeriod };
  }
  var vars = ['commencedOrFiled', 'terminated', 'pending'], changes = [], compared = 0;
  current.circuits.forEach(function (c) {
    var p = null;
    prior.circuits.forEach(function (x) { if (x.circuit === c.circuit) p = x; });
    if (!p) return;
    vars.forEach(function (v) {
      var a = c.variables[v].prior, b = p.variables[v].current;
      if (a === null || b === null) return;
      compared++;
      if (a !== b) changes.push({ circuit: c.circuit, variable: v, restatedTo: a, originallyPublished: b, delta: a - b });
    });
  });
  return {
    ok: true, overlapPeriod: current.priorPeriod, comparedCells: compared,
    changes: changes, restatedCount: changes.length,
    labelBoundaryCrossed: current.firstVariableLabel !== prior.firstVariableLabel,
    priorLabel: prior.firstVariableLabel, currentLabel: current.firstVariableLabel
  };
}

module.exports = {
  parse: parse,
  parseWorkbookObject: parseWorkbookObject,
  parseEndpoint: parseEndpoint,
  supersession: supersession,
  readWorkbook: readWorkbook,
  detectSchema: detectSchema,
  SCHEMAS: SCHEMAS,
  REQUIRED_MERGES: REQUIRED_MERGES,
  EXPECTED_CIRCUITS: EXPECTED_CIRCUITS,
  ENDPOINTS: ENDPOINTS,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION,
  ordinal: ordinal,
  eraContains: eraContains,
  EQUIVALENCE_ESTABLISHED: EQUIVALENCE_ESTABLISHED,
  _norm: norm
};
