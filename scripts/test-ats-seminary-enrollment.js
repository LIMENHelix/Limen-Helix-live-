#!/usr/bin/env node
'use strict';
var assert=require('assert'),crypto=require('crypto'),fs=require('fs'),path=require('path');
var A=require('../lib/ats-seminary-enrollment.js');
var H=require('../handlers/authority-ats.js');
var R=require('../handlers/authority-evidence.js');
var n=0;function t(name,fn){try{fn();n++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+': '+e.message);process.exitCode=1;}}

function indexFixture(options){options=options||{};var current=options.duplicate?
  '<a href="'+A.REPORT_URL+'">2025–26</a><a href="'+A.REPORT_URL+'">2025-26</a>':
  '<a href="'+(options.changedUrl?'https://www.ats.edu/files/galleries/revised.pdf':A.REPORT_URL)+'">2025–26</a>';
  var body='<h1>Annual Data Tables</h1><p>A core responsibility is summarizing institutional-level data submitted each year by all member schools. This data has been published annually since 1969. Beginning in 2003, the data has been published in its current format.</p><a>2003-04</a><a>2024–25</a>'+current;
  return '<!doctype html><html><body>'+body+new Array(400).join('<p>ATS annual publication context</p>')+'</body></html>';
}
function pdfFixture(){return Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(120000,65)]);}
var idx=A.parseIndex(indexFixture());
t('current ATS index identity parses',function(){assert.strictEqual(idx.ok,true);assert.strictEqual(idx.reportUrl,A.REPORT_URL);});
t('duplicate current report refuses',function(){assert.strictEqual(A.parseIndex(indexFixture({duplicate:true})).code,'CURRENT_REPORT_NOT_UNIQUE');});
t('changed current report URL refuses',function(){assert.strictEqual(A.parseIndex(indexFixture({changedUrl:true})).code,'CURRENT_REPORT_URL_CHANGED');});
t('small index refuses',function(){assert.strictEqual(A.parseIndex('<h1>Annual Data Tables</h1>').code,'NOT_AN_ATS_INDEX');});

var pdf=pdfFixture(),hash=crypto.createHash('sha256').update(pdf).digest('hex');
t('substantial PDF verifies only against exact bytes',function(){var x=A.verifyPdf(pdf,hash);assert.strictEqual(x.ok,true);assert.strictEqual(x.sourceBytes,pdf.length);});
t('changed PDF bytes refuse',function(){assert.strictEqual(A.verifyPdf(pdf,'0'.repeat(64)).code,'PDF_REVISION_CHANGED');});
t('unreviewed pin returns only diagnostics',function(){var x=A.verifyPdf(pdf,'__PIN_ME__');assert.strictEqual(x.code,'PDF_REVISION_UNREVIEWED');assert.strictEqual(x.actualSha256,hash);});
t('non-PDF refuses',function(){assert.strictEqual(A.verifyPdf(Buffer.alloc(120000,65),hash).code,'NOT_AN_ATS_PDF');});

var evidence=A.buildEvidence({ok:true,sourceSha256:hash,sourceBytes:pdf.length},{sourceUpdatedAt:null,retrievedAt:'2026-08-17T22:00:00.000Z'});
t('published program totals reconcile to 81,363',function(){assert.strictEqual(evidence.ok,true);assert.strictEqual(evidence.grandTotal,81363);assert.strictEqual(evidence.degreeRows.length,7);});
t('published known-gender ages plus U reconcile',function(){assert.strictEqual(evidence.knownGenderAgeTotal,80512);assert.strictEqual(evidence.unknownGenderTotal,851);assert.strictEqual(80512+851,81363);});
t('68 observations are unique',function(){var obs=[];evidence.degreeRows.forEach(function(r){Object.keys(r.observations).forEach(function(k){obs.push(r.observations[k]);});});evidence.ageRows.forEach(function(r){Object.keys(r.observations).forEach(function(k){obs.push(r.observations[k]);});});obs.push(evidence.unknownGenderObservation);assert.strictEqual(obs.length,68);assert.strictEqual(new Set(obs.map(function(x){return x.observationId;})).size,68);});
t('every observation preserves identity transformation and provenance',function(){var text=JSON.stringify(evidence);assert.ok(text.indexOf('identity: published ATS Table 2.11 count retained')>=0);assert.ok(text.indexOf(A.REPORT_URL)>=0);assert.ok(text.indexOf(hash)>=0);});
t('evidence vocabulary contains no score or activation field',function(){JSON.stringify(evidence).split(/[{}:,\[\]"]+/).forEach(function(x){assert.strictEqual(/^(score|rank|stress|diagnosis|pathway|activation)$/i.test(x.trim()),false);});});
t('evidence cannot build without byte-verified PDF',function(){assert.strictEqual(A.buildEvidence({ok:false}).code,'VERIFIED_PDF_REQUIRED');});

var d=H.descriptor();
t('descriptor refuses clergy and vitality equivalence',function(){assert.ok(d.boundaries.some(function(x){return /not the number of clergy/.test(x);}));assert.ok(d.boundaries.some(function(x){return /not institutional vitality/.test(x);}));});
t('descriptor preserves odd-year cadence',function(){assert.ok(/odd-numbered years/.test(d.publicationInterval));});
t('descriptor declares no brain Thing or pathway consumer',function(){assert.deepStrictEqual([d.consumedBy.religionFinding,d.consumedBy.brainChannel,d.consumedBy.thingLayer,d.consumedBy.pathway],[false,false,null,false]);});
t('official sources are HTTPS ATS URLs',function(){assert.match(H.INDEX_URL,/^https:\/\/www\.ats\.edu\//);assert.match(H.REPORT_URL,/^https:\/\/www\.ats\.edu\//);});
t('shared router exposes exactly eight implemented authorities',function(){assert.strictEqual(R.SUPPORTED.join(','),'arda_congregational_trends,ats_seminary_enrollment,gallup_religious_attendance,pew_global_restrictions,scotus_docket,us_courts_caseload,uscirf_annual_report,wjp_rol_index');assert.strictEqual(R.PROVIDERS.ats_seminary_enrollment,H);});

var page=fs.readFileSync(path.join(__dirname,'..','authority-portal.html'),'utf8');
t('portal has dedicated ATS renderer and claim boundary',function(){assert.ok(page.indexOf('function renderAtsEnrollment(d)')>=0);assert.ok(page.indexOf("d.viewKind === 'ats_seminary_enrollment'")>=0);assert.ok(/authority=ats_seminary_enrollment/.test(page));assert.ok(/not clergy supply/i.test(page));});
var hs=fs.readFileSync(path.join(__dirname,'..','handlers','authority-ats.js'),'utf8'),ps=fs.readFileSync(path.join(__dirname,'..','lib','ats-seminary-enrollment.js'),'utf8');
t('implementation imports no brain or Thing code',function(){[hs,ps].forEach(function(s){assert.strictEqual(/require\([^)]*(brain-v2|thing-formulas|brain-signals|thing1|thing2)/i.test(s),false);});});
if(process.exitCode)process.exit(1);console.log(n+'/'+n+' passed');
