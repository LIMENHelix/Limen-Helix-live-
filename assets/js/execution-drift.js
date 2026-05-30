/**
 * execution-drift.js — Execution Drift Detection
 * Detects when the operating layer drifts from policy, workflow, or historical norms.
 * Exposes: window.LIMENExecution.phase9.drift
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}
  function _ageDays(ts){return ts?Math.round((Date.now()-ts)/864e5):0}

  function _recentClaims(days){
    var cutoff=Date.now()-days*864e5;
    return _claims().filter(function(c){return(c.claimedAt||c.createdAt||0)>cutoff});
  }
  function _olderClaims(days){
    var cutoff=Date.now()-days*864e5;
    return _claims().filter(function(c){return(c.claimedAt||c.createdAt||0)<=cutoff});
  }

  function detectExecutionDrift(){
    var findings=[];
    var recent=_recentClaims(30);var older=_olderClaims(30);
    var outcomes=_outcomes();var disputes=_disputes();

    // Approval lag drift
    var recentReview=recent.filter(function(c){return c.status==='in_review'||c.status==='submitted'});
    var olderReview=older.filter(function(c){return c.status==='in_review'||c.status==='submitted'});
    if(recentReview.length>olderReview.length*1.5&&recentReview.length>=3){
      findings.push({type:'approval_lag_drift',severity:'moderate',detail:'Review queue growing: '+recentReview.length+' recent vs '+olderReview.length+' older'});
    }

    // Outcome delay drift
    var recentApproved=recent.filter(function(c){return c.status==='approved'});
    var noOutcome=0;
    for(var i=0;i<recentApproved.length;i++){
      var has=false;for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===recentApproved[i].id){has=true;break}}
      if(!has&&_ageDays(recentApproved[i].approvedAt||recentApproved[i].claimedAt)>14)noOutcome++;
    }
    if(noOutcome>=2)findings.push({type:'outcome_delay_drift',severity:'elevated',detail:noOutcome+' approved claims awaiting outcome >14d'});

    // Rising abandonment
    var recentClosed=recent.filter(function(c){return c.status==='closed'});
    var abandoned=0;
    for(var k=0;k<recentClosed.length;k++){
      var hasO=false;for(var m=0;m<outcomes.length;m++){if(outcomes[m].claimId===recentClosed[k].id){hasO=true;break}}
      if(!hasO)abandoned++;
    }
    if(abandoned>=2)findings.push({type:'rising_abandonment_drift',severity:'moderate',detail:abandoned+' recent claims closed without outcome'});

    // Rising dispute drift
    var recentDisputes=disputes.filter(function(d){return _ageDays(d.openedAt)<30});
    if(recentDisputes.length>=3)findings.push({type:'rising_dispute_drift',severity:'moderate',detail:recentDisputes.length+' disputes opened in last 30 days'});

    // Policy acceptance drift
    var noAgreement=recent.filter(function(c){return!c.agreementAccepted&&c.status!=='closed'&&c.status!=='rejected'});
    if(noAgreement.length>=2)findings.push({type:'policy_acceptance_drift',severity:'moderate',detail:noAgreement.length+' recent claims missing agreement'});

    // Monitoring neglect
    var mon=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.monitoring;
    if(!mon)findings.push({type:'monitoring_neglect_drift',severity:'low',detail:'Monitoring module not available'});

    return findings;
  }

  function getDriftFindings(){return detectExecutionDrift()}
  function getDriftScore(){
    var f=detectExecutionDrift();if(f.length===0)return 100;
    var pen=0;for(var i=0;i<f.length;i++){pen+=f[i].severity==='critical'?20:f[i].severity==='elevated'?12:f[i].severity==='moderate'?6:3}
    return Math.max(0,100-pen);
  }
  function getDriftByType(){
    var f=detectExecutionDrift();var byType={};
    for(var i=0;i<f.length;i++){byType[f[i].type]=f[i]}
    return byType;
  }
  function getDriftByDomain(){
    var claims=_claims();var byDomain={};
    for(var i=0;i<claims.length;i++){
      var d=claims[i].domain||'unknown';
      if(!byDomain[d])byDomain[d]={stale:0,noOutcome:0};
      if((claims[i].status==='in_review'||claims[i].status==='submitted')&&_ageDays(claims[i].claimedAt)>14)byDomain[d].stale++;
    }
    return byDomain;
  }

  window.LIMENExecution.phase9.drift={detectExecutionDrift:detectExecutionDrift,getDriftFindings:getDriftFindings,getDriftScore:getDriftScore,getDriftByType:getDriftByType,getDriftByDomain:getDriftByDomain};
})();
