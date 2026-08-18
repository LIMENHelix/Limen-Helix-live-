#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var ATS = require('../lib/ats-seminary-enrollment');
var handler = require('../handlers/authority-ats');
var router = require('../handlers/authority-evidence');
var passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }

t('snapshot arithmetic reconciles', function () { assert.strictEqual(ATS.assertArithmetic(), true); });
t('degree grand total is published 81,363', function () { assert.strictEqual(ATS.DEGREE_ROWS.at(-1).total, 81363); });
t('degree categories reconcile to total', function () { assert.strictEqual(ATS.DEGREE_ROWS.slice(0,-1).reduce(function(n,r){return n+r.total;},0), 81363); });
t('age known categories total 80,512', function () { assert.strictEqual(ATS.AGE_ROWS.reduce(function(n,r){return n+r.total;},0), 80512); });
t('age plus publisher U reconciles', function () { assert.strictEqual(80512 + 851, 81363); });
t('report coordinate is exact', function () { assert.strictEqual(ATS.REPORT_LABEL, '2025-26'); assert.match(ATS.REPORT_URL, /2025-2026_Annual_Data_Tables_r1-0001\.pdf$/); });
t('snapshot date is explicit', function () { assert.strictEqual(ATS.REVIEWED_ON, '2026-08-17'); });

var evidence = ATS.buildEvidence();
t('status refuses a live claim', function () { assert.strictEqual(evidence.status, 'PUBLISHED_REVIEWED_SNAPSHOT'); assert.strictEqual(evidence.live, false); });
t('68 observations are emitted', function () { assert.strictEqual(evidence.observations.length, 68); });
t('observation ids are unique', function () { assert.strictEqual(new Set(evidence.observations.map(function(o){return o.observationId;})).size, 68); });
t('every observation carries publication coordinates', function () { evidence.observations.forEach(function(o){ assert.strictEqual(o.sourceIdentity.tableNumber,'2.11'); assert.strictEqual(o.sourceIdentity.reportLabel,'2025-26'); assert.strictEqual(o.referencePeriod,'Fall 2025'); }); });
t('raw and transformed values are identical', function () { evidence.observations.forEach(function(o){ assert.strictEqual(o.rawValue,o.transformedValue); assert.strictEqual(o.rawUnits,o.transformedUnits); assert.strictEqual(o.transformation,'identity'); }); });
t('unknown source timestamp is not invented', function () { evidence.observations.forEach(function(o){ assert.strictEqual(o.sourceUpdatedAt,null); assert.ok(o.provenanceAbstentions.some(function(x){return /sourceUpdatedAt/.test(x);})); }); });
t('server refresh failure is explicit', function () {
  assert.ok(evidence.observations.every(function (o) {
    return o.provenanceAbstentions.some(function (x) {
      return /server-to-server/.test(x);
    });
  }));
});
t('publisher U remains separate from age bands', function () { assert.strictEqual(evidence.publisherUnknownTotal,851); assert.ok(evidence.observations.some(function(o){return o.variable === 'age.publisher_u_total.unknown' && o.rawValue === 851;})); });
t('no score or activation vocabulary enters records', function () { var s=JSON.stringify(evidence.observations); ['score','stress','diagnosis','pathway','activation','confidence','rank'].forEach(function(k){assert.strictEqual(new RegExp('"'+k+'"','i').test(s),false,k);}); });

var descriptor = ATS.descriptor();
t('consumer boundary is all false', function () { assert.deepStrictEqual(descriptor.consumedBy,{religionFinding:false,brainChannel:false,thingLayer:null,pathway:false}); });
t('one wave cannot become trend', function () { assert.ok(descriptor.boundaries.some(function(x){return /establishes no trend/.test(x);})); });
t('enrollment is not clergy supply', function () { assert.ok(descriptor.boundaries.some(function(x){return /not clergy supply/.test(x);})); });
t('publisher categories do not infer identity', function () { assert.ok(descriptor.boundaries.some(function(x){return /no identity inference/.test(x);})); });
t('odd-year cadence is named', function () { assert.match(descriptor.cadence,/odd-numbered years/); });

function invoke(query) { return new Promise(function(resolve){ var res={headers:{},setHeader:function(k,v){this.headers[k]=v;},end:function(body){resolve({status:this.statusCode,headers:this.headers,body:JSON.parse(body)});}}; handler({query:query},res); }); }
(async function () {
  var ok=await invoke({authority:'ats_seminary_enrollment'});
  t('handler serves reviewed evidence',function(){assert.strictEqual(ok.status,200);assert.strictEqual(ok.body.evidence.live,false);assert.strictEqual(ok.body.evidence.observations.length,68);});
  var no=await invoke({authority:'not_real'});
  t('handler refuses another authority',function(){assert.strictEqual(no.status,404);});
  var supported='arda_congregational_trends,ats_seminary_enrollment,gallup_religious_attendance,interfaith_america_pluralism,pew_global_restrictions,scotus_docket,us_courts_caseload,uscirf_annual_report,wjp_rol_index';
  t('shared router exposes exactly nine authorities',function(){assert.strictEqual(router.SUPPORTED.join(','),supported);assert.strictEqual(router.PROVIDERS.ats_seminary_enrollment,handler);});
  var portal=fs.readFileSync(path.join(__dirname,'..','authority-portal.html'),'utf8');
  t('operator renderer exists',function(){assert.match(portal,/function renderAtsEnrollment/);assert.match(portal,/reviewed publication snapshot/i);assert.match(portal,/not clergy supply/i);});
  var runtime=fs.readFileSync(path.join(__dirname,'..','handlers','authority-ats.js'),'utf8');
  t('runtime has no upstream client',function(){assert.doesNotMatch(runtime,/\bfetch\s*\(|https\.get|axios|request\s*\(/);});
  t('authority code imports no brain or Thing layer',function(){var source=fs.readFileSync(path.join(__dirname,'..','lib','ats-seminary-enrollment.js'),'utf8')+runtime;assert.doesNotMatch(source,/brain-v2|thing-formulas|brain-signals/);});
  console.log(passed+'/'+passed+' passed');
})().catch(function(e){console.error(e.stack||e);process.exit(1);});
