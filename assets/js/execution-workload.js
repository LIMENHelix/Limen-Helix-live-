/**
 * execution-workload.js — Operator Workload Management
 * Prevents overload. Shows warning near CLAIM if heavy.
 * Exposes: window.LIMENExecution.phase5.workload
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  function getSnapshot(){
    var ledger=window.LIMENClaimLedger;var tasks=window.LIMENExecution.phase5.tasks;var mon=window.LIMENExecution.phase5.monitoring;
    var activeClaims=0,pendingReviews=0,openTasks=0,overdueItems=0,closable=0;
    if(ledger){var all=ledger.getAllClaims();for(var i=0;i<all.length;i++){var s=all[i].status;if(s!=='closed'&&s!=='rejected')activeClaims++;if(s==='in_review'||s==='submitted')pendingReviews++;if(s==='approved')closable++}}
    if(tasks)openTasks=tasks.getOpenTasks().length;
    if(mon)overdueItems=mon.getOverdue().length;
    var score=activeClaims*2+pendingReviews*3+openTasks+overdueItems*4+closable*2;
    return{activeClaims:activeClaims,pendingReviews:pendingReviews,openTasks:openTasks,overdueItems:overdueItems,closableClaims:closable,score:score}
  }
  function getStatus(){var s=getSnapshot();if(s.score<=5)return'CLEAR';if(s.score<=15)return'LOADED';if(s.score<=30)return'HEAVY';return'OVERCAPACITY'}
  function getWarningHtml(){var st=getStatus();if(st==='HEAVY'||st==='OVERCAPACITY')return'<div style="font-size:0.28rem;color:#C9A94E;padding:3px 6px;border:1px solid rgba(201,169,78,0.15);border-radius:2px;margin:4px 0">High active workload ('+st+') \u2014 review before claiming more.</div>';return''}
  window.LIMENExecution.phase5.workload={getSnapshot:getSnapshot,getStatus:getStatus,getWarningHtml:getWarningHtml};
})();
