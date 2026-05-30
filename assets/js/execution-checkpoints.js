/**
 * execution-checkpoints.js — Enforceable Workflow Checkpoints
 * Turns soft workflow into checkpointed workflow for real use.
 * Exposes: window.LIMENExecution.phase11.checkpoints
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}

  function getCheckpointsForClaim(claim){
    if(!claim)return[];
    var outcomes=_outcomes();
    var hasOutcome=false;for(var i=0;i<outcomes.length;i++){if(outcomes[i].claimId===claim.id){hasOutcome=true;break}}
    var profile=window.LIMENExecution.phase11.onboarding?window.LIMENExecution.phase11.onboarding.getOperatorProfile():null;

    return[
      {id:'onboarding',label:'Onboarding complete',completed:!!(profile&&profile.onboardingCompletedAt),required:true},
      {id:'terms',label:'Terms accepted',completed:!!claim.agreementAccepted,required:true},
      {id:'checklist',label:'Path checklist complete',completed:!!claim.checklistCompleted,required:true},
      {id:'approval',label:'Approval complete',completed:claim.status==='approved'||claim.status==='closed',required:true},
      {id:'live_readiness',label:'Live readiness complete',completed:false,required:false}, // evaluated dynamically
      {id:'outcome_evidence',label:'Outcome evidence complete',completed:hasOutcome,required:true},
      {id:'payout_basis',label:'Payout basis complete',completed:!!(claim.estimatedOperatorPayout||claim.estimatedValue),required:true}
    ];
  }

  function getCheckpointStatus(claim){
    var cps=getCheckpointsForClaim(claim);
    // Evaluate live readiness checkpoint
    var lr=window.LIMENExecution.phase11.liveReadiness;
    if(lr){var r=lr.evaluateLiveReadiness(claim);for(var i=0;i<cps.length;i++){if(cps[i].id==='live_readiness')cps[i].completed=r.score>=70}}
    var total=cps.length,done=0,required=0,requiredDone=0;
    for(var j=0;j<cps.length;j++){if(cps[j].completed)done++;if(cps[j].required){required++;if(cps[j].completed)requiredDone++}}
    return{checkpoints:cps,total:total,completed:done,requiredTotal:required,requiredCompleted:requiredDone,allRequiredMet:requiredDone===required};
  }

  function isCheckpointComplete(claim,checkpointId){
    var cps=getCheckpointsForClaim(claim);
    for(var i=0;i<cps.length;i++){if(cps[i].id===checkpointId)return cps[i].completed}
    return false;
  }

  function getCheckpointBlockers(claim){
    var status=getCheckpointStatus(claim);
    return status.checkpoints.filter(function(c){return c.required&&!c.completed});
  }

  function getCheckpointSummary(){
    var claims=window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[];
    var active=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var allMet=0,blocked=0;
    for(var i=0;i<active.length;i++){
      var s=getCheckpointStatus(active[i]);
      if(s.allRequiredMet)allMet++;else blocked++;
    }
    return{totalActive:active.length,allCheckpointsMet:allMet,blocked:blocked};
  }

  window.LIMENExecution.phase11.checkpoints={getCheckpointsForClaim:getCheckpointsForClaim,getCheckpointStatus:getCheckpointStatus,isCheckpointComplete:isCheckpointComplete,getCheckpointBlockers:getCheckpointBlockers,getCheckpointSummary:getCheckpointSummary};
})();
