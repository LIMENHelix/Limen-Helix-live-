/**
 * execution-action-readiness.js — Action Readiness Scoring
 * Scores how ready each recommended action is for execution.
 * Exposes: window.LIMENExecution.phase10.readiness
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}

  function getReadinessFactors(action){
    var factors={sourceComplete:true,requiredFieldsPresent:true,policyAccepted:true,checklistDone:true,noBlockingDispute:true,notesExist:true,riskMetadata:true,workloadOk:true};
    var claims=_claims();var disputes=_disputes();

    if(action.sourceType==='claim'){
      var claim=null;
      for(var i=0;i<claims.length;i++){if(claims[i].id===action.sourceId){claim=claims[i];break}}
      if(claim){
        if(!claim.agreementAccepted)factors.policyAccepted=false;
        if(!claim.title&&!claim.opportunityId)factors.requiredFieldsPresent=false;
        if(!claim.estimatedValue)factors.requiredFieldsPresent=false;
        // Check blocking dispute
        for(var j=0;j<disputes.length;j++){
          if(disputes[j].claimId===claim.id&&(disputes[j].status==='open'||disputes[j].status==='under_review'))factors.noBlockingDispute=false;
        }
      }else{factors.sourceComplete=false}
    }

    // Workload check
    var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload;
    if(wl&&wl.getStatus){var st=wl.getStatus();if(st==='overloaded'||st==='OVERLOADED')factors.workloadOk=false}

    return factors;
  }

  function scoreActionReadiness(action){
    var factors=getReadinessFactors(action);
    var score=100;var weights={sourceComplete:20,requiredFieldsPresent:15,policyAccepted:15,checklistDone:10,noBlockingDispute:20,notesExist:5,riskMetadata:5,workloadOk:10};
    for(var k in factors){if(!factors[k])score-=(weights[k]||5)}
    return Math.max(0,score);
  }

  function getReadinessLabel(action){
    var score=scoreActionReadiness(action);
    if(score>=80)return'READY NOW';
    if(score>=60)return'NEAR READY';
    if(score>=40)return'BLOCKED';
    return'NOT READY';
  }

  function getActionsReadyNow(){
    var rec=window.LIMENExecution.phase10.recommendations;
    if(!rec)return[];
    var all=rec.buildRecommendedActions();
    return all.filter(function(a){return scoreActionReadiness(a)>=80});
  }

  window.LIMENExecution.phase10.readiness={scoreActionReadiness:scoreActionReadiness,getReadinessFactors:getReadinessFactors,getReadinessLabel:getReadinessLabel,getActionsReadyNow:getActionsReadyNow};
})();
