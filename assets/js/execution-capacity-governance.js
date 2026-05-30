/**
 * execution-capacity-governance.js — Capacity-Aware Claim Governance
 * Warns (does not block) when operator workload is high.
 * Exposes: window.LIMENExecution.phase6.governance
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function canClaim(opp){
    var warnings=getWarnings(opp);var duplicate=false;
    var l=window.LIMENClaimLedger;if(l){var existing=l.isOpportunityClaimed(opp.id||opp.title,'energy');if(existing)duplicate=true}
    return{allowed:!duplicate,duplicate:duplicate,warnings:warnings}
  }
  function getWarnings(opp){
    var w=[];var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload;
    if(wl){var st=wl.getStatus();if(st==='HEAVY')w.push('HIGH ACTIVE LOAD');if(st==='OVERCAPACITY')w.push('OVERCAPACITY — review before claiming')}
    var l=window.LIMENClaimLedger;if(l){var claims=l.getAllClaims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
      if(claims.length>=10)w.push('TOO MANY OPEN CLAIMS ('+claims.length+')');
      var sameType=claims.filter(function(c){return c.type===(opp&&opp.type||opp&&opp.path)});if(sameType.length>=5)w.push('5+ same-type claims open')}
    var tasks=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.tasks;if(tasks){var od=tasks.getOpenTasks().filter(function(t){return t.dueAt&&t.dueAt<Date.now()});if(od.length>=3)w.push('OVERDUE TASK BACKLOG ('+od.length+')')}
    return w
  }
  function getStatus(){var w=getWarnings({});if(w.length===0)return'CLEAR';if(w.length<=2)return'CAUTION';return'RESTRICTED'}
  function getLimit(){var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload;if(!wl)return 20;var st=wl.getStatus();if(st==='CLEAR')return 20;if(st==='LOADED')return 10;if(st==='HEAVY')return 5;return 2}
  window.LIMENExecution.phase6.governance={canClaim:canClaim,getWarnings:getWarnings,getStatus:getStatus,getRecommendedLimit:getLimit};
})();
