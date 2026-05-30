/**
 * execution-payout-ops.js — Payout Operations Shell
 * Makes payout workflow operationally visible.
 * Exposes: window.LIMENExecution.phase11.payoutOps
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}

  function _buildPayoutItem(claim,outcome){
    var val=parseFloat(claim.estimatedValue)||0;
    var share=parseFloat(claim.operatorSharePct)||10;
    var opEst=Math.round(val*(share/100));
    var platEst=Math.round(val*(1-share/100));
    var blockers=[];
    if(!claim.agreementAccepted)blockers.push('Agreement not accepted');
    if(!outcome)blockers.push('No outcome recorded');
    if(outcome&&outcome.result==='fail')blockers.push('Outcome is fail');
    if(!claim.estimatedValue)blockers.push('No estimated value');
    var status='not_eligible';
    if(outcome&&(outcome.result==='success'||outcome.result==='partial')&&claim.agreementAccepted&&claim.estimatedValue){
      status=blockers.length>0?'blocked':'eligible';
    }
    if(claim._payoutPrepared)status='prepared';
    return{claimId:claim.id,outcomeId:outcome?outcome.id:null,title:claim.title,domain:claim.domain,operatorEstimate:opEst,platformRetainedEstimate:platEst,payoutStatus:status,payoutBlockers:blockers,payoutBasis:outcome?outcome.result:'none',preparedAt:claim._payoutPreparedAt||null};
  }

  function getPayoutQueue(){
    var claims=_claims();var outcomes=_outcomes();var queue=[];
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='rejected')continue;
      var outcome=null;
      for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===c.id){outcome=outcomes[j];break}}
      queue.push(_buildPayoutItem(c,outcome));
    }
    return queue;
  }

  function getPayoutEligibleClaims(){return getPayoutQueue().filter(function(p){return p.payoutStatus==='eligible'})}
  function getPayoutBlockedClaims(){return getPayoutQueue().filter(function(p){return p.payoutStatus==='blocked'})}

  function getPayoutSummary(){
    var q=getPayoutQueue();
    var eligible=0,blocked=0,prepared=0,totalOp=0,totalPlat=0;
    for(var i=0;i<q.length;i++){
      if(q[i].payoutStatus==='eligible'){eligible++;totalOp+=q[i].operatorEstimate;totalPlat+=q[i].platformRetainedEstimate}
      if(q[i].payoutStatus==='blocked')blocked++;
      if(q[i].payoutStatus==='prepared')prepared++;
    }
    return{eligible:eligible,blocked:blocked,prepared:prepared,totalOperatorEstimate:totalOp,totalPlatformRetained:totalPlat};
  }

  function markPayoutPrepared(claimId){
    // Mark in localStorage claims
    var claims=_claims();
    for(var i=0;i<claims.length;i++){
      if(claims[i].id===claimId){
        claims[i]._payoutPrepared=true;claims[i]._payoutPreparedAt=Date.now();
        try{localStorage.setItem('LIMEN_EXECUTION_CLAIMS',JSON.stringify(claims))}catch(e){}
        return true;
      }
    }
    return false;
  }

  window.LIMENExecution.phase11.payoutOps={getPayoutQueue:getPayoutQueue,getPayoutEligibleClaims:getPayoutEligibleClaims,getPayoutBlockedClaims:getPayoutBlockedClaims,getPayoutSummary:getPayoutSummary,markPayoutPrepared:markPayoutPrepared};
})();
