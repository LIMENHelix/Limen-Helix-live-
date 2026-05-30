/**
 * execution-strategic-memory.js — Strategic Memory Fabric
 * Durable aggregated memory across claims, outcomes, disputes, monitoring, CRM, portfolio, policy.
 * Storage: LIMEN_EXECUTION_STRATEGIC_MEMORY
 * Exposes: window.LIMENExecution.phase8.strategicMemory
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};
  var SK='LIMEN_EXECUTION_STRATEGIC_MEMORY';

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _portfolio(){var p=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;return p&&p.getSummary?p.getSummary():null}
  function _familyOf(item){var fm=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.familyMemory;return fm?fm.inferOpportunityFamily(item).family:'unknown'}

  function _monthKey(ts){var d=new Date(ts);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)}

  function rebuildStrategicMemory(){
    var claims=_claims(),outcomes=_outcomes(),disputes=_disputes(),crm=_crm(),pf=_portfolio();
    var mem={
      summary:{totalClaimsSeen:claims.length,totalOutcomesSeen:outcomes.length,totalClosedSeen:0,totalDisputesSeen:disputes.length,totalCRMWonSeen:0,totalPortfolioCreatedSeen:0},
      byDomain:{},byType:{},byFamily:{},byLifecycleStage:{},byMonth:{},
      recurringPatterns:[],bottleneckPatterns:[],winPatterns:[],failurePatterns:[]
    };
    // Claims
    var stageCount={draft:0,submitted:0,in_review:0,approved:0,rejected:0,closed:0,claimed:0};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      var dom=c.domain||'unknown';var typ=(c.type||c.path||'unknown').toUpperCase();var fam=_familyOf(c);
      if(!mem.byDomain[dom])mem.byDomain[dom]={claims:0,outcomes:0,value:0,success:0};
      mem.byDomain[dom].claims++;
      if(!mem.byType[typ])mem.byType[typ]={claims:0,outcomes:0,value:0,success:0};
      mem.byType[typ].claims++;
      if(!mem.byFamily[fam])mem.byFamily[fam]={claims:0,outcomes:0,value:0,success:0};
      mem.byFamily[fam].claims++;
      if(stageCount.hasOwnProperty(c.status))stageCount[c.status]++;
      if(c.status==='closed')mem.summary.totalClosedSeen++;
      var mk=_monthKey(c.claimedAt||c.createdAt||Date.now());
      if(!mem.byMonth[mk])mem.byMonth[mk]={claims:0,outcomes:0,value:0};
      mem.byMonth[mk].claims++;
    }
    mem.byLifecycleStage=stageCount;
    // Outcomes
    for(var j=0;j<outcomes.length;j++){
      var o=outcomes[j];
      var od=o.domain||'unknown';var ot=(o.type||o.path||'unknown').toUpperCase();var of2=_familyOf(o);
      if(mem.byDomain[od])mem.byDomain[od].outcomes++;
      if(mem.byType[ot])mem.byType[ot].outcomes++;
      if(mem.byFamily[of2])mem.byFamily[of2].outcomes++;
      var val=parseFloat(o.outcomeValue)||0;
      if(mem.byDomain[od])mem.byDomain[od].value+=val;
      if(mem.byType[ot])mem.byType[ot].value+=val;
      if(o.result==='success'){
        if(mem.byDomain[od])mem.byDomain[od].success++;
        if(mem.byType[ot])mem.byType[ot].success++;
        if(mem.byFamily[of2])mem.byFamily[of2].success++;
      }
      var omk=_monthKey(o.closedAt||o.createdAt||Date.now());
      if(mem.byMonth[omk]){mem.byMonth[omk].outcomes++;mem.byMonth[omk].value+=val}
    }
    // CRM won
    for(var k=0;k<crm.length;k++){if(crm[k].stage==='won')mem.summary.totalCRMWonSeen++}
    // Portfolio
    if(pf&&pf.total)mem.summary.totalPortfolioCreatedSeen=pf.total;
    // Patterns
    for(var t in mem.byType){var td=mem.byType[t];if(td.outcomes>=3&&td.success/td.outcomes>=0.7)mem.winPatterns.push({type:t,rate:Math.round((td.success/td.outcomes)*100)});if(td.outcomes>=3&&td.success/td.outcomes<0.3)mem.failurePatterns.push({type:t,rate:Math.round((td.success/td.outcomes)*100)})}
    if(stageCount.in_review>stageCount.approved*2&&stageCount.in_review>2)mem.bottleneckPatterns.push({stage:'in_review',count:stageCount.in_review,note:'Review queue exceeds approvals 2:1'});
    for(var d2 in mem.byDomain){if(mem.byDomain[d2].claims>=5)mem.recurringPatterns.push({domain:d2,claims:mem.byDomain[d2].claims,note:'High activity domain'})}
    try{localStorage.setItem(SK,JSON.stringify(mem))}catch(e){}
    return mem;
  }

  function getStrategicMemory(){try{var s=localStorage.getItem(SK);return s?JSON.parse(s):rebuildStrategicMemory()}catch(e){return rebuildStrategicMemory()}}
  function getRecurringPatterns(){return getStrategicMemory().recurringPatterns}
  function getWinPatterns(){return getStrategicMemory().winPatterns}
  function getFailurePatterns(){return getStrategicMemory().failurePatterns}
  function getBottleneckPatterns(){return getStrategicMemory().bottleneckPatterns}
  function getStrategicMemorySummary(){var m=getStrategicMemory();return m.summary}

  window.LIMENExecution.phase8.strategicMemory={
    rebuildStrategicMemory:rebuildStrategicMemory,
    getStrategicMemory:getStrategicMemory,
    getRecurringPatterns:getRecurringPatterns,
    getWinPatterns:getWinPatterns,
    getFailurePatterns:getFailurePatterns,
    getBottleneckPatterns:getBottleneckPatterns,
    getStrategicMemorySummary:getStrategicMemorySummary
  };
})();
