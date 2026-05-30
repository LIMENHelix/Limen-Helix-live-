/**
 * execution-lifecycle.js — Post-Execution Lifecycle States
 * Extends claims/outcomes/portfolio/leads into full lifecycle.
 * Exposes: window.LIMENExecution.phase5.lifecycle
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  var TRANSITIONS={
    claim:['claimed','in_review','approved','rejected','executed','outcome_recorded','monitored','archived'],
    portfolio:['created','active','watch','scaling','distressed','exited','archived'],
    lead:['new','contacted','qualified','proposal','won','lost','archived']
  };
  var K='LIMEN_EXECUTION_LIFECYCLE';
  function load(){try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return{}}}
  function save(d){try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}}
  function getState(entityId,entityType){var a=load();return(a[entityType+'_'+entityId])||null}
  function setState(entityId,entityType,state){var a=load();a[entityType+'_'+entityId]={state:state,updatedAt:Date.now()};save(a);return state}
  function getAllowed(entityType,current){var t=TRANSITIONS[entityType]||TRANSITIONS.claim;var idx=t.indexOf(current);if(idx===-1)return t;return t.slice(idx)}
  window.LIMENExecution.phase5.lifecycle={getState:getState,setState:setState,getAllowedTransitions:getAllowed,TRANSITIONS:TRANSITIONS};
})();
