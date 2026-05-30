/**
 * execution-action-queue.js — Unified Global Action Queue
 * Aggregates high-value actions from all execution surfaces.
 * Exposes: window.LIMENExecution.phase5.actionQueue
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  function build(){
    var actions=[];
    // Overdue monitoring
    var mon=window.LIMENExecution.phase5.monitoring;
    if(mon){var od=mon.getOverdue();for(var i=0;i<od.length;i++)actions.push({priority:0,type:'overdue_review',label:'OVERDUE: Review '+od[i].title,source:od[i]})}
    // Due monitoring
    if(mon){var due=mon.getDue();for(var j=0;j<due.length;j++)actions.push({priority:1,type:'due_review',label:'DUE: Review '+due[j].title,source:due[j]})}
    // Claims awaiting approval
    var ledger=window.LIMENClaimLedger;
    if(ledger){var claims=ledger.getAllClaims();for(var k=0;k<claims.length;k++){var c=claims[k];if(c.status==='submitted')actions.push({priority:2,type:'approval_blocker',label:'APPROVAL: '+c.title,source:c});if(c.status==='approved'&&!window.LIMENExecution.outcomes.hasOutcomeForClaim(c.id))actions.push({priority:3,type:'outcome_needed',label:'RECORD OUTCOME: '+c.title,source:c})}}
    // Open tasks
    var tasks=window.LIMENExecution.phase5.tasks;
    if(tasks){var open=tasks.getByPriority();for(var m=0;m<Math.min(open.length,5);m++)actions.push({priority:4,type:'task',label:open[m].actionLabel+': '+open[m].title,source:open[m]})}
    // Distressed portfolio
    var pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio;
    if(pf){var cos=pf.getAllCompanies();for(var n=0;n<cos.length;n++){if(cos[n].status==='distressed')actions.push({priority:2,type:'distressed_portfolio',label:'DISTRESSED: '+cos[n].name,source:cos[n]})}}
    // Qualified leads
    var crm=window.LIMENExecution.phase5.crm;
    if(crm){var recs=crm.getByStatus('qualified');for(var p=0;p<recs.length;p++)actions.push({priority:5,type:'qualified_lead',label:'LEAD: '+recs[p].name,source:recs[p]})}
    actions.sort(function(a,b){return a.priority-b.priority});
    return actions;
  }
  function getTop(limit){return build().slice(0,limit||10)}
  function groupByType(){var all=build();var g={};for(var i=0;i<all.length;i++){var t=all[i].type;if(!g[t])g[t]=[];g[t].push(all[i])}return g}
  window.LIMENExecution.phase5.actionQueue={build:build,getTop:getTop,groupByType:groupByType};
})();
