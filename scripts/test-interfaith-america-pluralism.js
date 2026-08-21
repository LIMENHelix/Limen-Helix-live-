#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var IA = require('../lib/interfaith-america-pluralism');
var handler = require('../handlers/authority-interfaith-america');
var router = require('../handlers/authority-evidence');
var passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
function cloneRows() { return IA.ROWS.map(function (x) { return Object.assign({}, x); }); }
function refuses(mutator, pattern) {
  var rows = cloneRows(); mutator(rows);
  assert.throws(function () { IA.validateRows(rows); }, pattern || /INTERFAITH|/);
}

t('reviewed row contract validates', function () { assert.strictEqual(IA.validateRows(IA.ROWS), true); });
t('there are exactly sixteen published observations', function () { assert.strictEqual(IA.ROWS.length, 16); });
t('every observation identity is unique', function () { assert.strictEqual(new Set(IA.ROWS.map(function(x){return x.id;})).size, 16); });
t('all six operator sectors are represented', function () { assert.deepStrictEqual(Array.from(new Set(IA.ROWS.map(function(x){return x.sector;}))).sort(), ['campus','civic','communications','health','learning','workplace']); });
t('four published lower bounds stay lower bounds', function () { assert.strictEqual(IA.ROWS.filter(function(x){return x.publishedQualifier==='at_least';}).length, 4); });
t('no lower bound is converted to an exact display', function () { IA.ROWS.filter(function(x){return x.publishedQualifier==='at_least';}).forEach(function(x){assert.match(x.rawDisplay, /(\+|more than)/i);}); });
t('official report URL is HTTPS Interfaith America', function () { assert.match(IA.REPORT_URL, /^https:\/\/www\.interfaithamerica\.org\/reports-financials\/annual-report-2025\/$/); });
t('snapshot date is explicit', function () { assert.strictEqual(IA.REVIEWED_ON, '2026-08-17'); });

t('duplicate identity refuses', function () { refuses(function(r){r[1].id=r[0].id;}, /identity/); });
t('unknown sector refuses', function () { refuses(function(r){r[0].sector='religion_score';}, /sector/); });
t('zero refuses', function () { refuses(function(r){r[0].rawValue=0;}, /positive integer/); });
t('fraction refuses', function () { refuses(function(r){r[0].rawValue=1.5;}, /positive integer/); });
t('unknown qualifier refuses', function () { refuses(function(r){r[0].publishedQualifier='about';}, /qualifier/); });
t('hidden lower bound refuses', function () { refuses(function(r){r[1].rawDisplay='200';}, /lower bound/); });
t('missing section refuses', function () { refuses(function(r){r[0].section='';}, /context/); });
t('scoring field refuses', function () { refuses(function(r){r[0].score=0.8;}, /forbidden/); });
t('activation field refuses', function () { refuses(function(r){r[0].activation=true;}, /forbidden/); });

var evidence = IA.buildEvidence();
t('evidence is observational snapshot, never live', function () { assert.strictEqual(evidence.status,'PUBLISHED_REVIEWED_SNAPSHOT'); assert.strictEqual(evidence.live,false); });
t('evidence creates sixteen observation records', function () { assert.strictEqual(evidence.observations.length,16); });
t('all numeric transformations are identity', function () { evidence.observations.forEach(function(o){assert.strictEqual(o.rawValue,o.transformedValue);assert.strictEqual(o.transformation,'identity');}); });
t('every record identifies the published report and section', function () { evidence.observations.forEach(function(o){assert.strictEqual(o.sourceIdentity.reportUrl,IA.REPORT_URL);assert.ok(o.sourceIdentity.publishedSection);}); });
t('every record says it is self-reported', function () { evidence.observations.forEach(function(o){assert.strictEqual(o.selfReportedByPublisher,true);}); });
t('no record claims source freshness', function () { evidence.observations.forEach(function(o){assert.strictEqual(o.sourceUpdatedAt,null);assert.strictEqual(o.retrievedAt,null);}); });
t('units remain heterogeneous', function () { assert.ok(new Set(evidence.observations.map(function(o){return o.rawUnits;})).size > 6); });

var d=IA.descriptor();
t('descriptor refuses pluralism outcome equivalence', function(){assert.ok(d.boundaries.some(function(x){return /not pluralism, trust/i.test(x);}));});
t('descriptor refuses summing unlike units', function(){assert.ok(d.boundaries.some(function(x){return /must not be added/i.test(x);}));});
t('descriptor refuses independence claim', function(){assert.ok(d.boundaries.some(function(x){return /does not establish independent corroboration/i.test(x);}));});
t('descriptor keeps runtime consumers absent', function(){assert.deepStrictEqual([d.consumedBy.religionFinding,d.consumedBy.brainChannel,d.consumedBy.thingLayer,d.consumedBy.pathway],[false,false,null,false]);});

function invoke(query){return new Promise(function(resolve){var res={statusCode:0,headers:{},setHeader:function(k,v){this.headers[k]=v;},end:function(body){resolve({status:this.statusCode,headers:this.headers,body:JSON.parse(body)});}};handler({query:query},res);});}
(async function(){
  var ok=await invoke({authority:IA.AUTHORITY});
  t('handler serves the reviewed evidence',function(){assert.strictEqual(ok.status,200);assert.strictEqual(ok.body.viewKind,'interfaith_america_pluralism');assert.strictEqual(ok.body.evidence.observations.length,16);});
  var no=await invoke({authority:'not_real'});
  t('handler refuses another authority',function(){assert.strictEqual(no.status,404);});
  t('shared router exposes the exact provider',function(){assert.strictEqual(router.PROVIDERS.interfaith_america_pluralism,handler);assert.strictEqual(router.SUPPORTED.length,9);});
  var portal=fs.readFileSync(path.join(__dirname,'..','authority-portal.html'),'utf8');
  t('operator renderer leads with useful actions',function(){var block=portal.slice(portal.indexOf('function renderInterfaithAmerica'),portal.indexOf('function renderAtsEnrollment'));assert.match(block,/Operator brief/);assert.match(block,/What an operator can do/);assert.match(block,/direct outreach or deeper evidence review/);assert.doesNotMatch(block,/Consumed by a Religion finding|Produces stress \/ diagnosis \/ activation/);});
  var source=fs.readFileSync(path.join(__dirname,'..','lib','interfaith-america-pluralism.js'),'utf8')+fs.readFileSync(path.join(__dirname,'..','handlers','authority-interfaith-america.js'),'utf8');
  t('authority implementation imports no brain or Thing code',function(){assert.doesNotMatch(source,/require\([^)]*(brain-v2|thing-formulas|brain-signals|thing1|thing2)/i);});
  t('authority implementation exports no scoring or activation function',function(){assert.doesNotMatch(source,/module\.exports\.(?:score|activate|promote|diagnose)/);});
  console.log(passed+'/'+passed+' passed');
})().catch(function(e){console.error(e.stack||e);process.exit(1);});
