/**
 * execution-monitoring.js — Recurring Monitoring Layer
 * Tracks items needing review/follow-up. Client-side due/overdue on page load.
 * Exposes: window.LIMENExecution.phase5.monitoring
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  var K='LIMEN_EXECUTION_MONITORING';
  function load(){try{return JSON.parse(localStorage.getItem(K)||'[]')}catch(e){return[]}}
  function save(d){try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}}
  function create(e){var r=load();var m={id:'mon_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),entityType:e.entityType||'claim',entityId:e.entityId||'',domain:e.domain||'',type:e.type||'',title:e.title||'',monitoringStatus:'active',nextReviewAt:Date.now()+(e.reviewIntervalDays||14)*864e5,lastReviewedAt:null,reviewIntervalDays:e.reviewIntervalDays||14,reason:e.reason||'',notes:e.notes||''};r.push(m);save(r);return m}
  function getAll(){return load()}
  function update(id,patch){var r=load();for(var i=0;i<r.length;i++){if(r[i].id===id){for(var k in patch)r[i][k]=patch[k];save(r);return r[i]}}return null}
  function markReviewed(id){return update(id,{lastReviewedAt:Date.now(),nextReviewAt:Date.now()+((load().find(function(m){return m.id===id})||{}).reviewIntervalDays||14)*864e5})}
  function getDue(){var now=Date.now();return load().filter(function(m){return m.monitoringStatus!=='closed'&&m.nextReviewAt&&m.nextReviewAt<=now})}
  function getOverdue(){var now=Date.now();return load().filter(function(m){return m.monitoringStatus!=='closed'&&m.nextReviewAt&&m.nextReviewAt<now-3*864e5})}
  window.LIMENExecution.phase5.monitoring={create:create,getAll:getAll,update:update,markReviewed:markReviewed,getDue:getDue,getOverdue:getOverdue};
})();
