/**
 * execution-decision-memory.js — Decision Memory Ledger
 * Persists why major execution decisions happened.
 * Storage: LIMEN_EXECUTION_DECISION_MEMORY
 * Exposes: window.LIMENExecution.phase9.decisionMemory
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};
  var SK='LIMEN_EXECUTION_DECISION_MEMORY';
  var MAX_EVENTS=500;

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{if(d.length>MAX_EVENTS)d=d.slice(d.length-MAX_EVENTS);localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function inferDecisionRationale(entity){
    if(!entity)return'No entity provided';
    var parts=[];
    if(entity.status)parts.push('Status: '+entity.status);
    if(entity.result)parts.push('Result: '+entity.result);
    if(entity.agreementAccepted)parts.push('Agreement accepted');
    if(entity.estimatedValue)parts.push('Est. value: $'+entity.estimatedValue);
    if(entity.severity)parts.push('Severity: '+entity.severity);
    if(entity.disputeType)parts.push('Dispute type: '+entity.disputeType);
    return parts.length>0?parts.join('; '):'Minimal context available';
  }

  function recordDecisionEvent(payload){
    var events=_load();
    var ev={
      id:'DEC-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      entityType:payload.entityType||'unknown',
      entityId:payload.entityId||'',
      domain:payload.domain||'',
      type:payload.type||'',
      decisionType:payload.decisionType||'unknown',
      decidedAt:payload.decidedAt||Date.now(),
      status:payload.status||'',
      rationale:payload.rationale||inferDecisionRationale(payload.entity||payload),
      sourceSignals:payload.sourceSignals||[],
      relatedObjects:payload.relatedObjects||[],
      notes:payload.notes||''
    };
    events.push(ev);_save(events);return ev;
  }

  function getDecisionMemory(){return _load()}

  function getDecisionEventsForEntity(entityType,entityId){
    return _load().filter(function(e){return e.entityType===entityType&&e.entityId===entityId});
  }

  function getRecentDecisionEvents(limit){
    var events=_load();
    var l=limit||20;
    return events.slice(Math.max(0,events.length-l));
  }

  function getDecisionSummary(){
    var events=_load();
    var byType={};var byDecision={};
    for(var i=0;i<events.length;i++){
      var e=events[i];
      var t=e.type||'unknown';var d=e.decisionType||'unknown';
      byType[t]=(byType[t]||0)+1;
      byDecision[d]=(byDecision[d]||0)+1;
    }
    return{totalEvents:events.length,byType:byType,byDecisionType:byDecision,oldestEvent:events.length>0?events[0].decidedAt:null,newestEvent:events.length>0?events[events.length-1].decidedAt:null};
  }

  window.LIMENExecution.phase9.decisionMemory={
    recordDecisionEvent:recordDecisionEvent,
    getDecisionMemory:getDecisionMemory,
    getDecisionEventsForEntity:getDecisionEventsForEntity,
    getRecentDecisionEvents:getRecentDecisionEvents,
    getDecisionSummary:getDecisionSummary,
    inferDecisionRationale:inferDecisionRationale
  };
})();
