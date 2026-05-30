/**
 * execution-live-readiness.js — Live Execution Readiness Layer
 * Determines whether a claim/action is ready for real-world execution.
 * Exposes: window.LIMENExecution.phase11.liveReadiness
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _profile(){var ob=window.LIMENExecution.phase11.onboarding;return ob?ob.getOperatorProfile():null}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}

  function evaluateLiveReadiness(claim){
    var warnings=[];var score=100;
    var profile=_profile();
    if(!profile||!profile.onboardingCompletedAt){warnings.push('Operator not onboarded');score-=30}
    if(!claim.agreementAccepted){warnings.push('Agreement not accepted');score-=20}
    if(claim.status!=='approved'&&claim.status!=='closed'){warnings.push('Claim not yet approved');score-=15}
    // Compliance
    var comp=window.LIMENExecution.phase9&&window.LIMENExecution.phase9.policyCompliance;
    if(comp){var gaps=comp.getComplianceGaps().filter(function(g){return g.entityId===claim.id});if(gaps.length>0){warnings.push(gaps.length+' compliance gaps');score-=gaps.length*5}}
    // Blocking disputes
    var disputes=_disputes();
    for(var i=0;i<disputes.length;i++){if(disputes[i].claimId===claim.id&&(disputes[i].status==='open'||disputes[i].status==='under_review')){warnings.push('Blocking dispute: '+disputes[i].title);score-=15}}
    // Payout pathway
    if(!claim.estimatedOperatorPayout&&!claim.estimatedValue){warnings.push('No payout pathway defined');score-=10}
    score=Math.max(0,score);
    var status='NOT READY';
    if(score>=90)status='READY FOR LIVE EXECUTION';
    else if(score>=70)status='READY FOR LIVE HANDOFF';
    else if(score>=50)status='INTERNAL ONLY';
    return{score:score,status:status,warnings:warnings};
  }

  function getLiveReadinessByClaim(claimId){
    var claims=_claims();
    for(var i=0;i<claims.length;i++){if(claims[i].id===claimId)return evaluateLiveReadiness(claims[i])}
    return{score:0,status:'NOT READY',warnings:['Claim not found']};
  }

  function getLiveReadinessWarnings(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var all=[];
    for(var i=0;i<claims.length;i++){var r=evaluateLiveReadiness(claims[i]);if(r.warnings.length>0)all.push({claimId:claims[i].id,title:claims[i].title,warnings:r.warnings,status:r.status})}
    return all;
  }

  function getLiveReadinessStatus(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var ready=0,handoff=0,internal=0,notReady=0;
    for(var i=0;i<claims.length;i++){
      var r=evaluateLiveReadiness(claims[i]);
      if(r.status==='READY FOR LIVE EXECUTION')ready++;
      else if(r.status==='READY FOR LIVE HANDOFF')handoff++;
      else if(r.status==='INTERNAL ONLY')internal++;
      else notReady++;
    }
    return{total:claims.length,readyForLive:ready,readyForHandoff:handoff,internalOnly:internal,notReady:notReady};
  }

  window.LIMENExecution.phase11.liveReadiness={evaluateLiveReadiness:evaluateLiveReadiness,getLiveReadinessByClaim:getLiveReadinessByClaim,getLiveReadinessWarnings:getLiveReadinessWarnings,getLiveReadinessStatus:getLiveReadinessStatus};
})();
