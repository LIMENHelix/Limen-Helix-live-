/**
 * execution-operator-pathways.js — Operator Pathway Analytics
 * Understand how the local operator moves through the system.
 * Exposes: window.LIMENExecution.phase8.operatorPathways
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}

  function _lagDays(from,to){return from&&to?Math.round((to-from)/864e5):null}

  function getOperatorLagMetrics(){
    var claims=_claims(),outcomes=_outcomes();
    var createToApproval=[],approvalToOutcome=[],outcomeToClose=[];
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      if(c.approvedAt&&c.claimedAt){var d=_lagDays(c.claimedAt,c.approvedAt);if(d!==null)createToApproval.push(d)}
      if(c.status==='closed'&&c.closedAt&&c.approvedAt){var d2=_lagDays(c.approvedAt,c.closedAt);if(d2!==null)outcomeToClose.push(d2)}
    }
    for(var j=0;j<outcomes.length;j++){
      var o=outcomes[j];
      if(o.createdAt){
        var linked=null;
        for(var k=0;k<claims.length;k++){if(claims[k].id===o.claimId){linked=claims[k];break}}
        if(linked&&linked.approvedAt){var d3=_lagDays(linked.approvedAt,o.createdAt);if(d3!==null)approvalToOutcome.push(d3)}
      }
    }
    function avg(arr){if(arr.length===0)return 0;var s=0;for(var i=0;i<arr.length;i++)s+=arr[i];return Math.round(s/arr.length)}
    return{avgCreateToApproval:avg(createToApproval),avgApprovalToOutcome:avg(approvalToOutcome),avgOutcomeToClose:avg(outcomeToClose),sampleSizes:{createToApproval:createToApproval.length,approvalToOutcome:approvalToOutcome.length,outcomeToClose:outcomeToClose.length}};
  }

  function _typeStats(){
    var claims=_claims(),outcomes=_outcomes();
    var byType={};
    for(var i=0;i<claims.length;i++){
      var t=(claims[i].type||claims[i].path||'unknown').toUpperCase();
      if(!byType[t])byType[t]={claims:0,outcomes:0,success:0,abandoned:0};
      byType[t].claims++;
      if(claims[i].status==='rejected'||claims[i].status==='closed'){
        var hasOutcome=false;
        for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===claims[i].id){hasOutcome=true;if(outcomes[j].result==='success')byType[t].success++;break}}
        if(!hasOutcome&&claims[i].status==='closed')byType[t].abandoned++;
      }
    }
    for(var k=0;k<outcomes.length;k++){var ot=(outcomes[k].type||outcomes[k].path||'unknown').toUpperCase();if(byType[ot])byType[ot].outcomes++}
    return byType;
  }

  function _domainStats(){
    var claims=_claims();var byDomain={};
    for(var i=0;i<claims.length;i++){
      var d=claims[i].domain||'unknown';
      if(!byDomain[d])byDomain[d]={claims:0};
      byDomain[d].claims++;
    }
    return byDomain;
  }

  function getPreferredTypes(){
    var ts=_typeStats();var sorted=[];
    for(var t in ts)sorted.push({type:t,claims:ts[t].claims,success:ts[t].success});
    sorted.sort(function(a,b){return b.claims-a.claims});
    return sorted;
  }

  function getPreferredDomains(){
    var ds=_domainStats();var sorted=[];
    for(var d in ds)sorted.push({domain:d,claims:ds[d].claims});
    sorted.sort(function(a,b){return b.claims-a.claims});
    return sorted;
  }

  function _laneLabel(stats){
    if(stats.claims===0)return'INACTIVE';
    var rate=stats.outcomes>0?(stats.success/stats.outcomes):0;
    if(rate>=0.7&&stats.outcomes>=2)return'FAST / STRONG';
    if(rate>=0.4)return'STABLE';
    if(stats.abandoned>stats.success)return'FRICTION HEAVY';
    return'SLOW';
  }

  function getStrongestLane(){
    var ts=_typeStats();var best=null,bestRate=-1;
    for(var t in ts){
      if(ts[t].outcomes<1)continue;
      var rate=ts[t].success/ts[t].outcomes;
      if(rate>bestRate){bestRate=rate;best=t}
    }
    return best?{type:best,label:_laneLabel(ts[best]),successRate:Math.round(bestRate*100)}:{type:'NONE',label:'INSUFFICIENT DATA',successRate:0};
  }

  function getWeakestLane(){
    var ts=_typeStats();var worst=null,worstRate=Infinity;
    for(var t in ts){
      if(ts[t].claims<1)continue;
      var rate=ts[t].outcomes>0?(ts[t].success/ts[t].outcomes):0;
      if(rate<worstRate){worstRate=rate;worst=t}
    }
    return worst?{type:worst,label:_laneLabel(ts[worst]),successRate:Math.round(worstRate*100)}:{type:'NONE',label:'INSUFFICIENT DATA',successRate:0};
  }

  function getOperatorPathwaySnapshot(){
    return{
      lags:getOperatorLagMetrics(),
      preferredTypes:getPreferredTypes().slice(0,3),
      preferredDomains:getPreferredDomains().slice(0,3),
      strongestLane:getStrongestLane(),
      weakestLane:getWeakestLane()
    };
  }

  window.LIMENExecution.phase8.operatorPathways={
    getOperatorPathwaySnapshot:getOperatorPathwaySnapshot,
    getPreferredTypes:getPreferredTypes,
    getPreferredDomains:getPreferredDomains,
    getStrongestLane:getStrongestLane,
    getWeakestLane:getWeakestLane,
    getOperatorLagMetrics:getOperatorLagMetrics
  };
})();
