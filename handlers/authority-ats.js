/** Operator evidence API for ATS seminary enrollment. */
'use strict';

var ATS=require('../lib/ats-seminary-enrollment.js');
var SUPPORTED='ats_seminary_enrollment';
var UA='LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS=12000;

function respond(res,status,cache,body){res.setHeader('Cache-Control',cache);return res.status(status).json(body);}
function descriptor(){return {
  id:SUPPORTED,
  name:'ATS seminary enrollment',
  publisher:'The Association of Theological Schools (ATS)',
  landingPage:ATS.INDEX_URL,
  reportPage:ATS.REPORT_URL,
  measureType:'annual member-school administrative enrollment counts',
  referencePeriod:'Fall 2025; ATS 2025-26 Annual Data Tables, Table 2.11',
  publicationInterval:'annual; age and enrollment cross-tabs are collected in odd-numbered years',
  geographicScope:'ATS member schools in the United States and Canada',
  operatorUse:'Inspect the published composition of ATS graduate theological enrollment by degree program, age band, and publisher gender category. Use the result to ask capacity and training-pipeline questions; do not translate enrollment directly into clergy supply or institutional health.',
  consumedBy:{religionFinding:false,brainChannel:false,thingLayer:null,pathway:false,statement:'This evidence is displayed for an operator only. No Religion finding, brain channel, Thing layer, or pathway reads it, and it produces no stress value, diagnosis, ranking, or activation.'},
  boundaries:[
    'ATS head count is enrollment at ATS member schools, not the number of clergy, ordinands, graduates, placements, congregations served, or future religious leaders.',
    'Enrollment is not institutional vitality, financial health, educational quality, student formation, faith-community resilience, or demand for clergy.',
    'Table 2.11 is a Fall 2025 cross-section. It does not establish a trend, cause, forecast, or pipeline conversion rate.',
    'The published labels M, F, O, and U are retained as ATS categories. This portal does not infer identity beyond those administrative labels.',
    'Age/enrollment cross-tabs are collected in odd-numbered years. Absence in an even year is cadence, not evidence of zero enrollment.',
    'The 851 students in the U category are retained separately because Table 2.11 does not distribute that category across the displayed age bands.',
    'The PDF is byte-pinned to the reviewed revision. A different ATS revision withholds all values until separately reviewed.',
    'No annual value may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
  ]
};}

async function fetchWithBudget(url,accept,binary){
  var ctrl=new AbortController();var timer=setTimeout(function(){ctrl.abort();},FETCH_BUDGET_MS);var started=Date.now();
  try{var r=await fetch(url,{headers:{'User-Agent':UA,'Accept':accept},signal:ctrl.signal});var body=binary?Buffer.from(await r.arrayBuffer()):await r.text();clearTimeout(timer);return {ok:r.status===200,status:r.status,body:body,sourceUpdatedAt:r.headers.get('last-modified')||null,sourceEtag:r.headers.get('etag')||null,elapsedMs:Date.now()-started};}
  catch(e){clearTimeout(timer);return {ok:false,status:null,body:null,timeout:!!(e&&(e.name==='AbortError'||/abort/i.test(String(e.message)))),error:e&&e.message||String(e),elapsedMs:Date.now()-started};}
}

module.exports=async function authorityAts(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  var authority=String((req.query&&req.query.authority)||'').trim();
  if(authority!==SUPPORTED)return respond(res,400,'no-store',{ok:false,code:'AUTHORITY_MISMATCH',detail:'This provider serves only '+SUPPORTED+'.'});
  var retrievedAt=new Date().toISOString();
  var pair=await Promise.all([
    fetchWithBudget(ATS.INDEX_URL,'text/html,application/xhtml+xml',false),
    fetchWithBudget(ATS.REPORT_URL,'application/pdf',true)
  ]);
  var indexFetch=pair[0],pdfFetch=pair[1];
  if(!indexFetch.ok||!pdfFetch.ok)return respond(res,502,'s-maxage=30, stale-while-revalidate=0',{ok:false,code:'ATS_SOURCE_FETCH_FAILED',detail:'One or both official ATS publications could not be fetched.',sources:{index:{status:indexFetch.status,timeout:indexFetch.timeout||false,error:indexFetch.error||null},report:{status:pdfFetch.status,timeout:pdfFetch.timeout||false,error:pdfFetch.error||null}}});
  var index=ATS.parseIndex(indexFetch.body);
  var pdf=ATS.verifyPdf(pdfFetch.body);
  if(!index.ok||!pdf.ok)return respond(res,503,'no-store',{ok:false,code:!index.ok?index.code:pdf.code,detail:!index.ok?index.detail:pdf.detail,diagnostics:{index:index,pdf:pdf}});
  var evidence=ATS.buildEvidence(pdf,{sourceUpdatedAt:pdfFetch.sourceUpdatedAt,retrievedAt:retrievedAt});
  if(!evidence.ok)return respond(res,503,'no-store',evidence);
  return respond(res,200,'s-maxage=3600, stale-while-revalidate=86400',{
    ok:true,viewKind:'ats_seminary_enrollment',authority:descriptor(),evidence:evidence,
    provenance:{retrievedAt:retrievedAt,parser:'lib/ats-seminary-enrollment.js',parserVersion:ATS.PARSER_VERSION,transformVersion:ATS.TRANSFORM_VERSION,validation:'fail closed on index identity, report URL, PDF bytes, table arithmetic, observation identity, and claim boundaries',sources:{index:{url:ATS.INDEX_URL,sourceSha256:index.sourceSha256,sourceBytes:index.sourceBytes,sourceUpdatedAt:indexFetch.sourceUpdatedAt,etag:indexFetch.sourceEtag},report:{url:ATS.REPORT_URL,sourceSha256:pdf.sourceSha256,sourceBytes:pdf.sourceBytes,sourceUpdatedAt:pdfFetch.sourceUpdatedAt,etag:pdfFetch.sourceEtag}}},
    abstentions:descriptor().boundaries
  });
};
module.exports.descriptor=descriptor;
module.exports.SUPPORTED=SUPPORTED;
module.exports.INDEX_URL=ATS.INDEX_URL;
module.exports.REPORT_URL=ATS.REPORT_URL;
