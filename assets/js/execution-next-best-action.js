/**
 * execution-next-best-action.js — Next-Best-Action Synthesis
 * Determines the single most important next action globally, per domain, per type, per operator.
 * Exposes: window.LIMENExecution.phase10.nextAction
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _getAll(){
    var rec=window.LIMENExecution.phase10.recommendations;
    return rec?rec.buildRecommendedActions():[];
  }

  function _boost(action){
    var score=action.priorityScore||50;
    // Overdue boost
    if(action.overdueDays&&action.overdueDays>14)score+=10;
    if(action.overdueDays&&action.overdueDays>30)score+=10;
    // Dispute boost
    if(action.sourceType==='dispute')score+=8;
    // High risk penalty for next-best (prefer safe actions)
    if(action.riskLevel==='CRITICAL')score-=10;
    if(action.riskLevel==='HIGH')score-=5;
    // Bottleneck boost
    var bn=window.LIMENExecution.phase8&&window.LIMENExecution.phase8.bottlenecks;
    if(bn){var bns=bn.getTopBottlenecks();for(var i=0;i<bns.length;i++){if(bns[i].claimId===action.sourceId)score+=8}}
    // Exception pressure boost
    var ep=window.LIMENExecution.phase9&&window.LIMENExecution.phase9.exceptionPressure;
    if(ep){var status=ep.getPressureStatus();if(status==='OVERLOADED'&&action.sourceType==='dispute')score+=10}
    return Math.max(0,Math.min(100,Math.round(score)));
  }

  function getGlobalNextBestAction(){
    var all=_getAll();
    if(all.length===0)return null;
    for(var i=0;i<all.length;i++)all[i]._boostedScore=_boost(all[i]);
    all.sort(function(a,b){return b._boostedScore-a._boostedScore});
    return all[0];
  }

  function getNextBestActionByDomain(domain){
    var all=_getAll().filter(function(a){return a.domain===domain});
    if(all.length===0)return null;
    for(var i=0;i<all.length;i++)all[i]._boostedScore=_boost(all[i]);
    all.sort(function(a,b){return b._boostedScore-a._boostedScore});
    return all[0];
  }

  function getNextBestActionByType(type){
    var t=type.toUpperCase();
    var all=_getAll().filter(function(a){return a.type===t});
    if(all.length===0)return null;
    for(var i=0;i<all.length;i++)all[i]._boostedScore=_boost(all[i]);
    all.sort(function(a,b){return b._boostedScore-a._boostedScore});
    return all[0];
  }

  function getNextBestActionForOperator(){return getGlobalNextBestAction()}

  function explainNextBestAction(){
    var nba=getGlobalNextBestAction();
    if(!nba)return{action:null,explanation:'No recommended actions available'};
    return{action:nba,explanation:'Priority: '+nba._boostedScore+'. '+nba.rationale+'. Risk: '+nba.riskLevel+'.'};
  }

  window.LIMENExecution.phase10.nextAction={getGlobalNextBestAction:getGlobalNextBestAction,getNextBestActionByDomain:getNextBestActionByDomain,getNextBestActionByType:getNextBestActionByType,getNextBestActionForOperator:getNextBestActionForOperator,explainNextBestAction:explainNextBestAction};
})();
