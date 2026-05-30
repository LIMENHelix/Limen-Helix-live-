/**
 * execution-bottlenecks.js — Approval Bottleneck Analysis
 * Detects where claims stall in the execution lifecycle.
 * Exposes: window.LIMENExecution.phase8.bottlenecks
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}
  function _ageDays(ts){return ts?Math.round((Date.now()-ts)/864e5):0}

  function getBottleneckReport(){
    var claims=_claims(),outcomes=_outcomes(),disputes=_disputes();
    var bottlenecks=[];

    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      // Stale in review
      if(c.status==='in_review'&&_ageDays(c.submittedAt||c.claimedAt)>14){
        bottlenecks.push({claimId:c.id,title:c.title,type:'stale_review',severity:_ageDays(c.submittedAt||c.claimedAt)>30?'critical':'elevated',detail:'In review for '+_ageDays(c.submittedAt||c.claimedAt)+' days',stage:'in_review'});
      }
      // No decision after submitted
      if(c.status==='submitted'&&_ageDays(c.submittedAt||c.claimedAt)>7){
        bottlenecks.push({claimId:c.id,title:c.title,type:'no_decision',severity:_ageDays(c.submittedAt||c.claimedAt)>21?'elevated':'moderate',detail:'Submitted '+_ageDays(c.submittedAt||c.claimedAt)+' days ago, no decision',stage:'submitted'});
      }
      // No outcome after approval
      if(c.status==='approved'&&_ageDays(c.approvedAt||c.claimedAt)>21){
        var hasOutcome=false;for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===c.id){hasOutcome=true;break}}
        if(!hasOutcome){
          bottlenecks.push({claimId:c.id,title:c.title,type:'no_outcome_after_approval',severity:_ageDays(c.approvedAt||c.claimedAt)>45?'critical':'elevated',detail:'Approved '+_ageDays(c.approvedAt||c.claimedAt)+' days ago, no outcome',stage:'approved'});
        }
      }
      // Missing checklist / notes
      if((c.status==='submitted'||c.status==='in_review')&&!c.agreementAccepted){
        bottlenecks.push({claimId:c.id,title:c.title,type:'missing_agreement',severity:'moderate',detail:'Missing agreement acceptance',stage:c.status});
      }
      // Repeated rejection
      if(c.status==='rejected'&&c.rejectionCount&&c.rejectionCount>=2){
        bottlenecks.push({claimId:c.id,title:c.title,type:'rejection_loop',severity:'elevated',detail:'Rejected '+c.rejectionCount+' times',stage:'rejected'});
      }
    }
    // Dispute blocking closeout
    var openDisputes=disputes.filter(function(d){return d.status==='open'||d.status==='under_review'});
    for(var k=0;k<openDisputes.length;k++){
      var dp=openDisputes[k];
      if(dp.claimId){
        bottlenecks.push({claimId:dp.claimId,title:dp.title,type:'dispute_blocking',severity:dp.severity==='critical'?'critical':'elevated',detail:'Open dispute: '+dp.title,stage:'dispute'});
      }
    }
    bottlenecks.sort(function(a,b){var so={critical:0,elevated:1,moderate:2,low:3};return(so[a.severity]||3)-(so[b.severity]||3)});
    return bottlenecks;
  }

  function getTopBottlenecks(){return getBottleneckReport().slice(0,5)}
  function getClaimsStuckInReview(){return getBottleneckReport().filter(function(b){return b.stage==='in_review'})}
  function getClaimsStuckAfterApproval(){return getBottleneckReport().filter(function(b){return b.type==='no_outcome_after_approval'})}
  function getClaimsStuckInCloseout(){return getBottleneckReport().filter(function(b){return b.type==='dispute_blocking'})}

  window.LIMENExecution.phase8.bottlenecks={
    getBottleneckReport:getBottleneckReport,
    getTopBottlenecks:getTopBottlenecks,
    getClaimsStuckInReview:getClaimsStuckInReview,
    getClaimsStuckAfterApproval:getClaimsStuckAfterApproval,
    getClaimsStuckInCloseout:getClaimsStuckInCloseout
  };
})();
