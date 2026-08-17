'use strict';

var fs = require('fs');
var path = require('path');
var S = require('../lib/scotus-docket.js');
var H = require('../handlers/authority-scotus.js');
var R = require('../handlers/authority-evidence.js');

var tests = 0, failures = 0;
function assert(name, ok, detail) {
  tests++;
  if (ok) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function fixture(change) {
  var html = '<!doctype html><html><head><title>Docket for 25-250</title></head><body>' +
    '<div>' + 'navigation '.repeat(70) + '</div>' +
    '<h1>Docket for 25-250</h1><div>No. 25-250</div>' +
    '<table><tr><td>Title:</td><td>Donald J. Trump, President of the United States, et al., Petitioners<br>v.<br>V.O.S. Selections, Inc., et al.</td></tr>' +
    '<tr><td>Docketed:</td><td>September 4, 2025</td></tr>' +
    '<tr><td>Lower Ct:</td><td>United States Court of Appeals for the Federal Circuit</td></tr>' +
    '<tr><td>Case Numbers:</td><td>(2025-1812, 2025-1813)</td></tr>' +
    '<tr><td>Decision Date:</td><td>August 29, 2025</td></tr></table>' +
    '<h2>Proceedings and Orders</h2><table>' +
    '<tr><td>Sep 03 2025</td><td>Petition for a writ of certiorari filed. (Response due October 6, 2025) ' +
    '<a href="/DocketPDF/25/25-250/1/petition.pdf">Petition</a> <a href="/DocketPDF/25/25-250/2/proof.pdf">Proof of Service</a> ' +
    '<a href=/opinions/25pdf/24-1287_4gcj.pdf>opinion</a><span data-file="/DocketPDF/25/25-250/3/judgment.pdf"></span></td></tr>' +
    '<tr><td>Nov 05 2025</td><td>Argued. For federal parties: counsel. For private parties: counsel.</td></tr>' +
    '</table><h2>Attorneys</h2><div>Counsel of Record</div></body></html>';
  return change ? change(html) : html;
}

console.log('\n1. DOCKET IDENTITY');
assert('paid docket normalises', S.normaliseDocket(' 25-250 ').docket === '25-250');
assert('application docket normalises', S.normaliseDocket('25a111').docket === '25A111');
assert('invalid free text refuses', S.normaliseDocket('Trump case').code === 'INVALID_DOCKET_NUMBER');
assert('path traversal refuses', S.normaliseDocket('../25-250').code === 'INVALID_DOCKET_NUMBER');
assert('official URL is deterministic', S.officialUrl('25-250') === 'https://www.supremecourt.gov/docket/docketfiles/html/public/25-250.html');

console.log('\n2. REVIEWED PAGE');
var parsed = S.parse(fixture(), '25-250');
assert('fixture parses', parsed.ok === true, parsed.code);
assert('published docket matches request', parsed.docket === '25-250');
assert('title retains both sides', /Donald J\. Trump/.test(parsed.title) && /V\.O\.S\. Selections/.test(parsed.title));
assert('docketed date retained', parsed.docketed === 'September 4, 2025');
assert('lower court retained', /Federal Circuit/.test(parsed.lowerCourt));
assert('lower-court numbers retained', /2025-1812/.test(parsed.lowerCourtCaseNumbers));
assert('lower-court decision date retained', parsed.lowerCourtDecisionDate === 'August 29, 2025');
assert('two dated proceedings retained', parsed.proceedings.length === 2);
assert('first event text remains documentary', /Petition for a writ/.test(parsed.proceedings[0].text));
assert('each event has content identity', parsed.proceedings.every(function (x) { return /^[0-9a-f]{64}$/.test(x.observationId); }));
assert('quoted, unquoted, and serialized official document links are retained', parsed.documentLinks.length === 4);
assert('links are absolute Court URLs', parsed.documentLinks.every(function (x) { return x.url.indexOf('https://www.supremecourt.gov/') === 0; }));
assert('source has immutable content hash', /^[0-9a-f]{64}$/.test(parsed.sourceSha256));
assert('source byte count retained', parsed.sourceBytes === Buffer.byteLength(fixture(), 'utf8'));
assert('parser and transform versions retained', parsed.parserVersion === S.PARSER_VERSION && parsed.transformVersion === S.TRANSFORM_VERSION);

console.log('\n3. REFUSALS');
assert('small response refuses', S.parse('<html>no</html>', '25-250').code === 'NOT_A_DOCKET_PAGE');
assert('missing docket marker refuses', S.parse(fixture(function (x) { return x.replace(/Docket for/g, 'Case for'); }), '25-250').code === 'DOCKET_MARKER_MISSING');
assert('missing published id refuses', S.parse(fixture(function (x) { return x.replace(/No\. 25-250/g, 'Identifier withheld'); }), '25-250').code === 'DOCKET_ID_MISSING');
assert('wrong returned docket refuses', S.parse(fixture(), '25-251').code === 'DOCKET_ID_MISMATCH');
assert('missing title refuses', S.parse(fixture(function (x) { return x.replace('Title:', 'Caption:'); }), '25-250').code === 'TITLE_MISSING');
assert('missing docketed date refuses', S.parse(fixture(function (x) { return x.replace('September 4, 2025', 'date unknown'); }), '25-250').code === 'DOCKETED_DATE_MISSING');
assert('missing proceedings section refuses', S.parse(fixture(function (x) { return x.replace('Proceedings and Orders', 'Activity'); }), '25-250').code === 'PROCEEDINGS_SECTION_MISSING');
assert('no dated proceeding refuses', S.parse(fixture(function (x) { return x.replace(/Sep 03 2025/g, 'date one').replace(/Nov 05 2025/g, 'date two'); }), '25-250').code === 'NO_PROCEEDINGS');
assert('external links are rejected', S.parse(fixture(function (x) { return x.replace('/DocketPDF/25/25-250/1/petition.pdf', 'https://example.com/petition.pdf'); }), '25-250').documentLinks.length === 3);
assert('mailto links would be rejected', S.parse(fixture(function (x) { return x.replace('/DocketPDF/25/25-250/1/petition.pdf', 'mailto:clerk@example.com'); }), '25-250').documentLinks.length === 3);

console.log('\n4. CLAIM BOUNDARY');
var d = H.descriptor();
assert('descriptor names documentary chronology', /docket and filing chronology/.test(d.measureType));
assert('descriptor states no fixed cadence', /does not state a fixed/.test(d.publicationInterval));
assert('descriptor states no Law finding', d.consumedBy.lawFinding === false);
assert('descriptor states no brain channel', d.consumedBy.brainChannel === false);
assert('descriptor states no Thing layer', d.consumedBy.thingLayer === null);
assert('descriptor states no pathway', d.consumedBy.pathway === false);
assert('descriptor denies filing truth', d.boundaries.some(function (x) { return /does not establish the truth/.test(x); }));
assert('descriptor denies filing-volume meaning', d.boundaries.some(function (x) { return /Filing volume is not/.test(x); }));
assert('descriptor refuses case inference', d.boundaries.some(function (x) { return /does not perform party-name search/.test(x); }));
assert('router exposes exactly three implemented authorities', R.SUPPORTED.join(',') === 'scotus_docket,us_courts_caseload,wjp_rol_index', R.SUPPORTED.join(','));

console.log('\n5. SHARED PAGE');
var page = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
assert('page forwards the docket identity', /docket=/.test(page));
assert('page has a SCOTUS search form', /ap-docket/.test(page));
assert('page has a dedicated SCOTUS renderer', /function renderScotus\(d\)/.test(page));
assert('page links the implemented SCOTUS authority', /authority=scotus_docket/.test(page));
assert('page labels docket evidence as non-scoring', /Filing volume is not/.test(page) || /Produces stress \/ diagnosis \/ activation/.test(page));
assert('page contains no hardcoded docket result values', !/September 4, 2025/.test(page) && !/V\.O\.S\. Selections/.test(page));

console.log('\n6. NO RUNTIME CONSUMER');
var handlerSource = fs.readFileSync(path.join(__dirname, '..', 'handlers', 'authority-scotus.js'), 'utf8');
var parserSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'scotus-docket.js'), 'utf8');
assert('provider imports no brain module', !/brain-v2|thing-formulas|brain-signals/.test(handlerSource + parserSource));
assert('provider exports no score or activation function', !/module\.exports\.(?:score|activate|promote|diagnose)/.test(handlerSource + parserSource));
assert('provider requires an exact docket parameter', /NO_DOCKET/.test(handlerSource) && /normaliseDocket/.test(handlerSource));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
