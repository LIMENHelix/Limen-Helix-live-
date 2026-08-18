/**
 * Reviewed publication snapshot for ATS Annual Data Tables 2025-26,
 * Table 2.11: Head Count Enrollment by Degree Program, Age, and Gender,
 * Fall 2025.
 *
 * ATS is reachable in an interactive browser but timed out from both GitHub
 * Actions and Vercel on 2026-08-17. This module therefore does not claim a
 * live source read. It serves the reviewed publication values with the source
 * coordinate and every limitation needed to keep them observational.
 */
'use strict';

var PARSER_VERSION = 'ats-seminary-enrollment/1.0.0';
var TRANSFORM_VERSION = 'ats-table-2.11:published-counts->identity-observations/1.0.0';
var INDEX_URL = 'https://www.ats.edu/Annual-Data-Tables';
var REPORT_URL = 'https://www.ats.edu/files/galleries/2025-2026_Annual_Data_Tables_r1-0001.pdf';
var REPORT_LABEL = '2025-26';
var REPORT_REFERENCE = 'Fall 2025';
var REVIEWED_ON = '2026-08-17';

var DEGREE_ROWS = [
  { id:'mdiv', label:'MDiv', male:18697, female:7333, otherKnown:222, unknown:378, total:26630 },
  { id:'ma', label:'MA subtotal', male:16042, female:13895, otherKnown:108, unknown:254, total:30299 },
  { id:'thm_stm', label:'ThM / STM', male:1001, female:214, otherKnown:7, unknown:13, total:1235 },
  { id:'professional_doctorate', label:'DMin + other professional doctorate subtotal', male:7958, female:3426, otherKnown:62, unknown:62, total:11508 },
  { id:'phd_thd', label:'PhD / ThD', male:3397, female:1174, otherKnown:37, unknown:3, total:4611 },
  { id:'non_degree', label:'Non-degree', male:4245, female:2651, otherKnown:43, unknown:141, total:7080 },
  { id:'total', label:'Total', male:51340, female:28693, otherKnown:479, unknown:851, total:81363 }
];

var AGE_ROWS = [
  { id:'under_25', label:'Under 25', male:4145, female:2586, otherKnown:31, total:6762 },
  { id:'25_29', label:'25-29', male:7856, female:3604, otherKnown:86, total:11546 },
  { id:'30_34', label:'30-34', male:6956, female:2870, otherKnown:88, total:9914 },
  { id:'35_39', label:'35-39', male:7161, female:2995, otherKnown:68, total:10224 },
  { id:'40_49', label:'40-49', male:12040, female:6922, otherKnown:113, total:19075 },
  { id:'50_64', label:'50-64', male:10200, female:7507, otherKnown:62, total:17769 },
  { id:'65_plus', label:'65+', male:2027, female:1761, otherKnown:21, total:3809 },
  { id:'age_not_reported', label:'Age not reported', male:955, female:448, otherKnown:10, total:1413 }
];

function sum(rows, key) { return rows.reduce(function (n, row) { return n + row[key]; }, 0); }
function refuse(message) { var e = new Error(message); e.code = 'ATS_SNAPSHOT_INVALID'; throw e; }

function assertArithmetic() {
  DEGREE_ROWS.forEach(function (row) {
    if (row.male + row.female + row.otherKnown + row.unknown !== row.total) refuse('degree row does not reconcile: ' + row.id);
  });
  AGE_ROWS.forEach(function (row) {
    if (row.male + row.female + row.otherKnown !== row.total) refuse('age row does not reconcile: ' + row.id);
  });
  var total = DEGREE_ROWS[DEGREE_ROWS.length - 1];
  var categories = DEGREE_ROWS.slice(0, -1);
  ['male','female','otherKnown','unknown','total'].forEach(function (key) {
    if (sum(categories, key) !== total[key]) refuse('degree column does not reconcile: ' + key);
  });
  if (sum(AGE_ROWS, 'total') + total.unknown !== total.total) refuse('age rows plus publisher U category do not reconcile');
  return true;
}

function observation(group, row, field, value) {
  return {
    observationId: ['ats', REPORT_LABEL, 'table-2.11', group, row.id, field].join(':'),
    authority: 'ats_seminary_enrollment',
    domain: 'religion',
    variable: group + '.' + row.id + '.' + field,
    publishedLabel: row.label,
    publishedField: field,
    rawValue: value,
    transformedValue: value,
    rawUnits: 'students (head count)',
    transformedUnits: 'students (head count)',
    transformation: 'identity',
    transformationVersion: TRANSFORM_VERSION,
    referencePeriod: REPORT_REFERENCE,
    sourceUpdatedAt: null,
    retrievedAt: null,
    reviewedOn: REVIEWED_ON,
    accessMode: 'reviewed_publication_snapshot',
    sourceIdentity: {
      publisher: 'The Association of Theological Schools',
      indexUrl: INDEX_URL,
      reportUrl: REPORT_URL,
      reportLabel: REPORT_LABEL,
      tableNumber: '2.11',
      tableTitle: 'Head Count Enrollment by Degree Program, Age, and Gender, Fall 2025'
    },
    provenanceAbstentions: [
      'publisher sourceUpdatedAt was not established',
      'report bytes are not mirrored or hash-pinned in this release',
      'server-to-server source refresh was unavailable on 2026-08-17'
    ],
    parserVersion: PARSER_VERSION
  };
}

function buildEvidence() {
  assertArithmetic();
  var observations = [];
  DEGREE_ROWS.forEach(function (row) {
    ['male','female','otherKnown','unknown','total'].forEach(function (field) {
      observations.push(observation('degree', row, field, row[field]));
    });
  });
  AGE_ROWS.forEach(function (row) {
    ['male','female','otherKnown','total'].forEach(function (field) {
      observations.push(observation('age', row, field, row[field]));
    });
  });
  observations.push(observation('age', { id:'publisher_u_total', label:'Publisher U category (not distributed across age bands)' }, 'unknown', 851));
  if (observations.length !== 68) refuse('observation count changed');
  return {
    status: 'PUBLISHED_REVIEWED_SNAPSHOT',
    live: false,
    reviewedOn: REVIEWED_ON,
    referencePeriod: REPORT_REFERENCE,
    report: { label:REPORT_LABEL, indexUrl:INDEX_URL, reportUrl:REPORT_URL, tableNumber:'2.11' },
    degreeRows: DEGREE_ROWS.map(function (row) { return Object.assign({}, row); }),
    ageRows: AGE_ROWS.map(function (row) { return Object.assign({}, row); }),
    publisherUnknownTotal: 851,
    observations: observations,
    arithmetic: { degreeGrandTotal:81363, ageKnownCategoryTotal:80512, publisherUnknownTotal:851, reconciled:true },
    versions: { parser:PARSER_VERSION, transformation:TRANSFORM_VERSION }
  };
}

function descriptor() {
  return {
    authority: 'ats_seminary_enrollment',
    domain: 'religion',
    title: 'ATS seminary enrollment · reviewed publication snapshot',
    measure: 'Fall 2025 head-count enrollment reported in ATS Annual Data Tables 2025-26, Table 2.11',
    cadence: 'ATS says age and enrollment data are collected in odd-numbered years',
    consumedBy: { religionFinding:false, brainChannel:false, thingLayer:null, pathway:false },
    boundaries: [
      'This is a reviewed publication snapshot, not a live ATS read.',
      'One Fall 2025 wave establishes no trend, direction, cause, or forecast.',
      'Enrollment is not clergy supply, ordination, completion, placement, demand, vitality, quality, or resilience.',
      'M, F, O, and U are publisher administrative categories; no identity inference is made.',
      'The publisher U total of 851 is not distributed across the displayed age bands.',
      'Server-to-server source refresh timed out from GitHub Actions and Vercel on 2026-08-17.',
      'No article count, sentiment, single publisher, or this snapshot may directly create stress or activate a pathway.',
      'No Religion finding, brain channel, Thing layer, or pathway reads this evidence.'
    ]
  };
}

module.exports = {
  PARSER_VERSION:PARSER_VERSION,
  TRANSFORM_VERSION:TRANSFORM_VERSION,
  INDEX_URL:INDEX_URL,
  REPORT_URL:REPORT_URL,
  REPORT_LABEL:REPORT_LABEL,
  REPORT_REFERENCE:REPORT_REFERENCE,
  REVIEWED_ON:REVIEWED_ON,
  DEGREE_ROWS:DEGREE_ROWS,
  AGE_ROWS:AGE_ROWS,
  assertArithmetic:assertArithmetic,
  buildEvidence:buildEvidence,
  descriptor:descriptor
};
