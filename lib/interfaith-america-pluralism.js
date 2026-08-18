/**
 * Reviewed provider-output snapshot for Interfaith America's 2025 Annual Report.
 *
 * These are the publisher's program/activity counts. They are not measurements
 * of pluralism, trust, dialogue quality, social cohesion, or downstream impact.
 */
'use strict';

var SNAPSHOT_VERSION = 'interfaith-america-2025/1.0.0';
var TRANSFORM_VERSION = 'published-counts->identity-observations/1.0.0';
var AUTHORITY = 'interfaith_america_pluralism';
var REPORT_URL = 'https://www.interfaithamerica.org/reports-financials/annual-report-2025/';
var REPORT_TITLE = 'Interfaith America 2025 Annual Report';
var REFERENCE_PERIOD = '2025';
var REVIEWED_ON = '2026-08-17';

var ROWS = [
  { id:'summit_full_weekend_registrants', sector:'campus', section:'Interfaith Leadership Summit', label:'Full-weekend Summit registrants', rawValue:550, rawDisplay:'550', units:'registrants', publishedQualifier:'exact' },
  { id:'summit_additional_engaged', sector:'campus', section:'Interfaith Leadership Summit', label:'Additional people engaged overall', rawValue:200, rawDisplay:'200+', units:'people', publishedQualifier:'at_least' },
  { id:'braid_fellows', sector:'campus', section:'BRAID Fellowship', label:'Inaugural undergraduate BRAID Fellows', rawValue:20, rawDisplay:'20', units:'fellows', publishedQualifier:'exact' },
  { id:'braid_institutions', sector:'campus', section:'BRAID Fellowship', label:'Colleges and universities represented by BRAID Fellows', rawValue:15, rawDisplay:'15', units:'institutions', publishedQualifier:'exact' },
  { id:'senior_admin_cohort_campuses', sector:'campus', section:'Advancing Campus Pluralism', label:'Campuses in the senior-administrator cohort', rawValue:11, rawDisplay:'11', units:'campuses', publishedQualifier:'exact' },
  { id:'team_up_affiliate_sites', sector:'civic', section:'The Team Up Project', label:'Second-cohort affiliate sites receiving grants, training, and resources', rawValue:38, rawDisplay:'38', units:'affiliate sites', publishedQualifier:'exact' },
  { id:'civic_fellowship_leaders', sector:'civic', section:'Interfaith Civic Pluralism Fellowship', label:'Leaders in the inaugural fellowship', rawValue:16, rawDisplay:'16', units:'leaders', publishedQualifier:'exact' },
  { id:'rise_companies', sector:'workplace', section:'RISE', label:'Companies participating in RISE', rawValue:8, rawDisplay:'8', units:'companies', publishedQualifier:'exact' },
  { id:'faith_health_campus_grantees', sector:'health', section:'Faith and Health', label:'Faith and Health Campus Grantees', rawValue:15, rawDisplay:'15', units:'grantees', publishedQualifier:'exact' },
  { id:'faith_health_pipeline_grantees', sector:'health', section:'Faith and Health', label:'Faith and Health Pipeline Grantees', rawValue:23, rawDisplay:'23', units:'grantees', publishedQualifier:'exact' },
  { id:'faith_health_states', sector:'health', section:'Faith and Health', label:'States reached by the Faith and Health Network, plus Washington, DC', rawValue:28, rawDisplay:'28 states + Washington, DC', units:'states', publishedQualifier:'exact' },
  { id:'resources_updated', sector:'learning', section:'Expanded Learning Resources', label:'Resources updated during 2025', rawValue:167, rawDisplay:'167', units:'resources', publishedQualifier:'exact' },
  { id:'resources_created', sector:'learning', section:'Expanded Learning Resources', label:'New externally facing resources', rawValue:8, rawDisplay:'8', units:'resources', publishedQualifier:'exact' },
  { id:'unc_convening_leaders', sector:'health', section:'UNC Gillings School of Global Public Health', label:'Leaders convened for the Faith and Public Health Collaborative', rawValue:30, rawDisplay:'30+', units:'leaders', publishedQualifier:'at_least' },
  { id:'shared_table_impressions', sector:'communications', section:'The Team Up Project', label:'Shared Table PSA impressions across platforms', rawValue:2800000000, rawDisplay:'more than 2.8 billion', units:'impressions', publishedQualifier:'at_least' },
  { id:'times_square_social_views', sector:'communications', section:'Impact Metrics', label:'Related social-media views for the public pluralism advertisement', rawValue:250000, rawDisplay:'250,000+', units:'views', publishedQualifier:'at_least' }
];

function refuse(detail) {
  var e = new Error(detail);
  e.code = 'INTERFAITH_SNAPSHOT_INVALID';
  throw e;
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some(function (key) {
    return /^(score|stress|rank|threshold|confidence|activation|pathway)$/i.test(key) || hasForbiddenKey(value[key]);
  });
}

function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 16) refuse('expected exactly 16 reviewed observations');
  var ids = Object.create(null);
  var sectors = { campus:true, civic:true, workplace:true, health:true, learning:true, communications:true };
  rows.forEach(function (row) {
    if (!row || typeof row !== 'object') refuse('observation must be an object');
    if (!/^[a-z0-9_]+$/.test(row.id || '') || ids[row.id]) refuse('observation identity is missing or duplicated');
    ids[row.id] = true;
    if (!sectors[row.sector]) refuse('unknown sector for ' + row.id);
    if (!row.section || !row.label || !row.units || !row.rawDisplay) refuse('published context is incomplete for ' + row.id);
    if (!Number.isInteger(row.rawValue) || row.rawValue <= 0) refuse('raw value must be a positive integer for ' + row.id);
    if (row.publishedQualifier !== 'exact' && row.publishedQualifier !== 'at_least') refuse('unknown qualifier for ' + row.id);
    if (row.publishedQualifier === 'at_least' && !/(\+|more than)/i.test(row.rawDisplay)) refuse('lower bound is not visible for ' + row.id);
    if (hasForbiddenKey(row)) refuse('forbidden scoring or activation field for ' + row.id);
  });
  return true;
}

function observation(row) {
  return {
    observationId: ['interfaith-america', REFERENCE_PERIOD, row.id].join(':'),
    authority: AUTHORITY,
    domain: 'religion',
    sector: row.sector,
    publishedSection: row.section,
    variable: row.id,
    publishedLabel: row.label,
    rawValue: row.rawValue,
    transformedValue: row.rawValue,
    rawDisplay: row.rawDisplay,
    publishedQualifier: row.publishedQualifier,
    rawUnits: row.units,
    transformedUnits: row.units,
    transformation: 'identity',
    transformationVersion: TRANSFORM_VERSION,
    referencePeriod: REFERENCE_PERIOD,
    sourceUpdatedAt: null,
    retrievedAt: null,
    reviewedOn: REVIEWED_ON,
    accessMode: 'reviewed_publication_snapshot',
    selfReportedByPublisher: true,
    sourceIdentity: {
      publisher: 'Interfaith America',
      reportTitle: REPORT_TITLE,
      reportUrl: REPORT_URL,
      publishedSection: row.section
    },
    provenanceAbstentions: [
      'publisher sourceUpdatedAt was not established',
      'report bytes are not mirrored or hash-pinned in this release',
      'the observation is self-reported by one provider and is not independently corroborated'
    ],
    snapshotVersion: SNAPSHOT_VERSION
  };
}

function buildEvidence() {
  validateRows(ROWS);
  return {
    status: 'PUBLISHED_REVIEWED_SNAPSHOT',
    live: false,
    reviewedOn: REVIEWED_ON,
    referencePeriod: REFERENCE_PERIOD,
    report: { title:REPORT_TITLE, url:REPORT_URL },
    observations: ROWS.map(observation),
    sectors: ['campus','civic','workplace','health','learning','communications'],
    versions: { snapshot:SNAPSHOT_VERSION, transformation:TRANSFORM_VERSION }
  };
}

function descriptor() {
  return {
    authority: AUTHORITY,
    domain: 'religion',
    title: 'Interfaith America network activity · 2025 evidence map',
    measure: 'Selected program reach and activity counts published in Interfaith America\'s 2025 Annual Report',
    cadence: 'annual organizational reporting; not a sensor cadence',
    operatorUse: 'Map where Interfaith America reports active institutional reach across campus, civic, workplace, health, learning, and communications programs; identify programs worth direct diligence; and preserve a baseline for later cadence-aligned comparison.',
    consumedBy: { religionFinding:false, brainChannel:false, thingLayer:null, pathway:false },
    boundaries: [
      'These are Interfaith America\'s self-reported program and communications outputs, not an independent impact evaluation.',
      'Program reach is not pluralism, trust, dialogue quality, social cohesion, attitude change, durability, or causal impact.',
      'People, registrants, institutions, sites, grantees, resources, impressions, and views are different units and may overlap; they must not be added into a total.',
      'Impressions and views are exposure counts, not unique people, attention, agreement, or behavior change.',
      'A plus sign or the phrase more than is preserved as a lower bound; no midpoint or exact value is invented.',
      'One 2025 report establishes no trend, direction, forecast, or comparison with another year.',
      'One publisher does not establish independent corroboration, and its program partners do not become independent evidence merely by being named.',
      'The report page is not mirrored or hash-pinned here and publisher sourceUpdatedAt was not established.'
    ]
  };
}

module.exports = {
  SNAPSHOT_VERSION:SNAPSHOT_VERSION,
  TRANSFORM_VERSION:TRANSFORM_VERSION,
  AUTHORITY:AUTHORITY,
  REPORT_URL:REPORT_URL,
  REPORT_TITLE:REPORT_TITLE,
  REFERENCE_PERIOD:REFERENCE_PERIOD,
  REVIEWED_ON:REVIEWED_ON,
  ROWS:ROWS,
  validateRows:validateRows,
  buildEvidence:buildEvidence,
  descriptor:descriptor
};
