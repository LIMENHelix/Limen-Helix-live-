/**
 * execution-crm-shell.js — Lightweight CRM / Pipeline
 * Tracks portal sales, partnerships, enterprise interest.
 * Exposes: window.LIMENExecution.phase5.crm
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  var K='LIMEN_EXECUTION_CRM';
  function load(){try{return JSON.parse(localStorage.getItem(K)||'[]')}catch(e){return[]}}
  function save(d){try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}}
  function create(r){var all=load();var rec={id:'crm_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),name:r.name||'',company:r.company||'',domain:r.domain||'',pipelineType:r.pipelineType||'portal_sales',status:r.status||'new',valueEstimate:r.valueEstimate||0,source:r.source||'',linkedLeadId:r.linkedLeadId||'',notes:r.notes||'',createdAt:Date.now(),updatedAt:Date.now()};all.push(rec);save(all);return rec}
  function update(id,patch){var all=load();for(var i=0;i<all.length;i++){if(all[i].id===id){for(var k in patch)all[i][k]=patch[k];all[i].updatedAt=Date.now();save(all);return all[i]}}return null}
  function getAll(){return load()}
  function getByStatus(s){return load().filter(function(r){return r.status===s})}
  function getValueTotals(){var all=load();var t={pipeline:0,won:0,lost:0};for(var i=0;i<all.length;i++){if(all[i].status==='won')t.won+=(all[i].valueEstimate||0);else if(all[i].status==='lost')t.lost+=(all[i].valueEstimate||0);else t.pipeline+=(all[i].valueEstimate||0)}return t}
  window.LIMENExecution.phase5.crm={create:create,update:update,getAll:getAll,getByStatus:getByStatus,getValueTotals:getValueTotals};
})();
