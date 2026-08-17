/**
 * Closed reader for the ATS 2025-26 Annual Data Tables publication boundary
 * and a reviewed extract of Table 2.11 (Fall 2025 enrollment).
 *
 * The PDF is not interpreted by an unconstrained runtime parser. Its bytes are
 * pinned to the reviewed report; a different revision withholds every value.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'ats-seminary-enrollment/1.0.0';
var TRANSFORM_VERSION = 'ats-table-2.11:published-counts->identity-observations/1.0.0';
var INDEX_URL = 'https://www.ats.edu/Annual-Data-Tables';
var REPORT_URL = 'https://www.ats.edu/files/galleries/2025-2026_Annual_Data_Tables_r1-0001.pdf';
var REPORT_LABEL = '2025-26';
var REPORT_REFERENCE = 'Fall 2025';
var EXPECTED_PDF_SHA256 = '__PIN_ME__';

var DEGREE_ROWS = [
  { id:'mdiv', label:'MDiv', male:18697, female:7333, otherKnown:222, unknown:378, total:26630 },
  { id:'ma', label:'MA subtotal', male:16042, female:13895, otherKnown:108, unknown:254, total:30299 },
  { id:'thm_stm', label:'ThM/STM', male:1001, female:214, otherKnown:7, unknown:13, total:1235 },
  { id:'professional_doctorate', label:'DMin and other professional doctorate subtotal', male:7958, female:3426, otherKnown:62, unknown:62, total:11508 },
  { id:'phd_thd', label:'PhD/ThD', male:3397, female:1174, otherKnown:37, unknown:3, total:4611 },
  { id:'non_degree', label:'Non-degree', male:4245, female:2651, otherKnown:43, unknown:141, total:7080 }
];
var TOTAL_ROW = { id:'all_programs', label:'All published program categories', male:51340, female:28693, otherKnown:479, unknown:851, total:81363 };
var AGE_ROWS = [
  { id:'under_25', label:'Under 25', male:4145, female:2586, otherKnown:31, totalKnownGender:6762 },
  { id:'25_29', label:'25-29', male:7856, female:3604, otherKnown:86, totalKnownGender:11546 },
  { id:'30_34', label:'30-34', male:6956, female:2870, otherKnown:88, totalKnownGender:9914 },
  { id:'35_39', label:'35-39', male:7161, female:2995, otherKnown:68, totalKnownGender:10224 },
  { id:'40_49', label:'40-49', male:12040, female:6922, otherKnown:113, totalKnownGender:19075 },
  { id:'50_64', label:'50-64', male:10200, female:7507, otherKnown:62, totalKnownGender:17769 },
  { id:'65_plus', label:'65 and over', male:2027, female:1761, otherKnown:21, totalKnownGender:3809 },
  { id:'not_reported', label:'Age not reported', male:955, female:448, otherKnown:10, totalKnownGender:1413 }
];

function refusal(code, detail, extra) {
  var out = { ok:false, code:code, detail:detail };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function decode(s) {
  var named = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', ndash:'-', mdash:'-' };
  return String(s || '').replace(/&#x([0-9a-f]+);/gi,function(_,n){return String.fromCodePoint(parseInt(n,16));})
    .replace(/&#(\d+);/g,function(_,n){return String.fromCodePoint(parseInt(n,10));})
    .replace(/&([a-z]+);/gi,function(m,n){return Object.prototype.hasOwnProperty.call(named,n.toLowerCase())?named[n.toLowerCase()]:m;});
}
function plain(s) {
  return decode(String(s || '').replace(/<[^>]+>/g,' ')).replace(/[\u2012-\u2015]/g,'-').replace(/\s+/g,' ').trim();
}
function absoluteAtsUrl(href) {
  var value = decode(href);
  if (/^https:\/\/www\.ats\.edu\//i.test(value)) return value;
  if (/^\//.test(value)) return 'https://www.ats.edu' + value;
  return null;
}

function parseIndex(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html,'utf8') < 10000) {
    return refusal('NOT_AN_ATS_INDEX','The response is too small to be the reviewed ATS Annual Data Tables index.');
  }
  var text = plain(html);
  var required = [
    'Annual Data Tables',
    'summarizing institutional-level data submitted each year by all member schools',
    'published annually since 1969',
    'Beginning in 2003, the data has been published in its current format'
  ];
  for (var i=0;i<required.length;i++) {
    if (text.indexOf(required[i]) < 0) return refusal('INDEX_MARKER_MISSING','A reviewed ATS index marker is absent.',{marker:required[i]});
  }
  var found = [], m;
  var re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = re.exec(html))) {
    var label = plain(m[2]);
    if (label === REPORT_LABEL) found.push({label:label,url:absoluteAtsUrl(m[1])});
  }
  if (found.length !== 1) return refusal('CURRENT_REPORT_NOT_UNIQUE','Exactly one reviewed 2025-26 report link is required.',{matches:found});
  if (found[0].url !== REPORT_URL) return refusal('CURRENT_REPORT_URL_CHANGED','The current ATS report URL changed and requires review.',{expected:REPORT_URL,actual:found[0].url});
  if (text.indexOf('2003-04') < 0 || text.indexOf('2024-25') < 0) {
    return refusal('ARCHIVE_BOUNDARY_CHANGED','The reviewed current-format archive boundary is absent.');
  }
  return { ok:true, reportLabel:REPORT_LABEL, reportUrl:REPORT_URL, sourceSha256:sha256(html), sourceBytes:Buffer.byteLength(html,'utf8') };
}

function verifyPdf(buffer, expectedSha) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100000 || buffer.slice(0,5).toString('ascii') !== '%PDF-') {
    return refusal('NOT_AN_ATS_PDF','The response is not a substantial PDF publication.',{bytes:Buffer.isBuffer(buffer)?buffer.length:null});
  }
  var actual = sha256(buffer);
  var expected = expectedSha || EXPECTED_PDF_SHA256;
  if (expected === '__PIN_ME__') return refusal('PDF_REVISION_UNREVIEWED','The ATS report bytes have not yet been pinned to a reviewed revision.',{actualSha256:actual,bytes:buffer.length});
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    return refusal('PDF_REVISION_CHANGED','The ATS report bytes differ from the reviewed publication.',{expectedSha256:expected,actualSha256:actual,bytes:buffer.length});
  }
  return { ok:true, sourceSha256:actual, sourceBytes:buffer.length };
}

function validateRows() {
  var keys = ['male','female','otherKnown','unknown'];
  for (var i=0;i<DEGREE_ROWS.length;i++) {
    var r = DEGREE_ROWS[i];
    if (keys.reduce(function(n,k){return n+r[k];},0) !== r.total) return refusal('DEGREE_ROW_ARITHMETIC','A reviewed degree row no longer sums.',{row:r.id});
  }
  for (var k=0;k<keys.length;k++) {
    var key = keys[k];
    if (DEGREE_ROWS.reduce(function(n,r){return n+r[key];},0) !== TOTAL_ROW[key]) return refusal('DEGREE_COLUMN_ARITHMETIC','Reviewed degree columns no longer sum.',{column:key});
  }
  if (DEGREE_ROWS.reduce(function(n,r){return n+r.total;},0) !== TOTAL_ROW.total) return refusal('DEGREE_TOTAL_ARITHMETIC','Reviewed degree totals no longer sum.');
  for (var j=0;j<AGE_ROWS.length;j++) {
    var a=AGE_ROWS[j];
    if (a.male+a.female+a.otherKnown !== a.totalKnownGender) return refusal('AGE_ROW_ARITHMETIC','A reviewed age row no longer sums.',{row:a.id});
  }
  var ageKnown = AGE_ROWS.reduce(function(n,r){return n+r.totalKnownGender;},0);
  if (ageKnown !== TOTAL_ROW.male+TOTAL_ROW.female+TOTAL_ROW.otherKnown || ageKnown+TOTAL_ROW.unknown !== TOTAL_ROW.total) {
    return refusal('AGE_TOTAL_ARITHMETIC','Reviewed age totals no longer reconcile with the published grand total.',{knownGenderAgeTotal:ageKnown});
  }
  return {ok:true,knownGenderAgeTotal:ageKnown};
}

function buildEvidence(pdf, provenance) {
  if (!pdf || !pdf.ok) return refusal('VERIFIED_PDF_REQUIRED','A byte-verified ATS report is required before values may be emitted.');
  var arithmetic = validateRows();
  if (!arithmetic.ok) return arithmetic;
  var src = provenance || {};
  function observation(kind, identity, value, units) {
    return {
      observationId:sha256(kind+'|'+identity+'|'+REPORT_REFERENCE+'|'+value+'|'+units+'|'+pdf.sourceSha256),
      referencePeriod:REPORT_REFERENCE,
      rawValue:value,
      transformedValue:value,
      rawUnits:units,
      transformedUnits:units,
      transformation:'identity: published ATS Table 2.11 count retained without normalization, ratio, ranking, interpolation, or scoring',
      provenance:{sourceUrl:REPORT_URL,sourceSha256:pdf.sourceSha256,sourceUpdatedAt:src.sourceUpdatedAt||null,retrievedAt:src.retrievedAt||null,parserVersion:PARSER_VERSION,transformVersion:TRANSFORM_VERSION,publishedTable:'2.11'}
    };
  }
  var degrees=DEGREE_ROWS.concat([TOTAL_ROW]).map(function(row){
    var x=Object.assign({},row); x.observations={};
    ['male','female','otherKnown','unknown','total'].forEach(function(k){x.observations[k]=observation('degree-program',row.id+':'+k,row[k],'students (head count)');});
    return x;
  });
  var ages=AGE_ROWS.map(function(row){
    var x=Object.assign({},row); x.observations={};
    ['male','female','otherKnown','totalKnownGender'].forEach(function(k){x.observations[k]=observation('age-band',row.id+':'+k,row[k],'students (head count)');});
    return x;
  });
  var unknownGender=observation('gender-total','unknown',TOTAL_ROW.unknown,'students (head count)');
  var count=degrees.reduce(function(n,r){return n+Object.keys(r.observations).length;},0)+ages.reduce(function(n,r){return n+Object.keys(r.observations).length;},0)+1;
  return {ok:true,referencePeriod:REPORT_REFERENCE,publishedTable:'2.11',grandTotal:TOTAL_ROW.total,knownGenderAgeTotal:arithmetic.knownGenderAgeTotal,unknownGenderTotal:TOTAL_ROW.unknown,degreeRows:degrees,ageRows:ages,unknownGenderObservation:unknownGender,observationCount:count,pdfSourceSha256:pdf.sourceSha256,pdfSourceBytes:pdf.sourceBytes};
}

module.exports={parseIndex:parseIndex,verifyPdf:verifyPdf,validateRows:validateRows,buildEvidence:buildEvidence,DEGREE_ROWS:DEGREE_ROWS,TOTAL_ROW:TOTAL_ROW,AGE_ROWS:AGE_ROWS,INDEX_URL:INDEX_URL,REPORT_URL:REPORT_URL,REPORT_LABEL:REPORT_LABEL,REPORT_REFERENCE:REPORT_REFERENCE,EXPECTED_PDF_SHA256:EXPECTED_PDF_SHA256,PARSER_VERSION:PARSER_VERSION,TRANSFORM_VERSION:TRANSFORM_VERSION};
