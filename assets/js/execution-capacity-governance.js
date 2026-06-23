/**
 * execution-capacity-governance.js — Capacity-Aware Claim Governance
 * Warns (does not block) when operator workload is high.
 * Exposes: window.LIMENExecution.phase6.governance
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function resolveDomain(opp){
    return (opp&&(opp.domain||opp.domainId))||window.LIMENExecution.currentDomain||'energy'
  }
  function canClaim(opp){
    var warnings=getWarnings(opp);var duplicate=false;
    var l=window.LIMENClaimLedger;if(l){var existing=l.isOpportunityClaimed(opp.id||opp.title,resolveDomain(opp));if(existing)duplicate=true}
    return{allowed:!duplicate,duplicate:duplicate,warnings:warnings}
  }
  function getWarnings(opp){
    var w=[];var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload;
    if(wl){var st=wl.getStatus();if(st==='HEAVY')w.push('HIGH ACTIVE LOAD');if(st==='OVERCAPACITY')w.push('OVERCAPACITY — review before claiming')}
    var l=window.LIMENClaimLedger;if(l){var claims=l.getAllClaims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
      if(claims.length>=10)w.push('HIGH ACTIVE LOAD ('+claims.length+' open claims)');
      if(claims.length>=20)w.push('OVERCAPACITY ('+claims.length+' open claims) — review before claiming');
      var sameType=claims.filter(function(c){return c.type===(opp&&opp.type||opp&&opp.path)});if(sameType.length>=5)w.push('OVERCAPACITY — 5+ same-type claims open')}
    var tasks=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.tasks;if(tasks){var od=tasks.getOpenTasks().filter(function(t){return t.dueAt&&t.dueAt<Date.now()});if(od.length>=3)w.push('OVERDUE BACKLOG ('+od.length+' overdue execution tasks)')}
    return w
  }
  function getStatus(){var w=getWarnings({});if(w.length===0)return'CLEAR';if(w.length<=2)return'CAUTION';return'RESTRICTED'}
  function getLimit(){var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload;if(!wl)return 20;var st=wl.getStatus();if(st==='CLEAR')return 20;if(st==='LOADED')return 10;if(st==='HEAVY')return 5;return 2}
  window.LIMENExecution.phase6.governance={canClaim:canClaim,getWarnings:getWarnings,getStatus:getStatus,getRecommendedLimit:getLimit};
})();
