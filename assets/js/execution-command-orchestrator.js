/**
 * execution-command-orchestrator.js — Command Orchestration Layer
 * Single read-only snapshot of entire execution system state.
 * Exposes: window.LIMENExecution.phase6.command
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function snap(){
    var l=window.LIMENClaimLedger,o=window.LIMENExecution.outcomes,wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload,esc=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation,mon=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.monitoring,pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio,crm=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm,tasks=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.tasks;
    var claims=l?l.getAllClaims():[];var stats=l?l.getStats():{};
    var active=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var pending=claims.filter(function(c){return c.status==='in_review'||c.status==='submitted'});
    var closable=claims.filter(function(c){return c.status==='approved'&&!(o&&o.hasOutcomeForClaim(c.id))});
    var overdue=mon?mon.getOverdue():[];var openTasks=tasks?tasks.getOpenTasks():[];var escalations=esc?esc.detect():[];
    var pfItems=pf?pf.getAllCompanies():[];var crmTotals=crm?crm.getValueTotals():{};
    return{activeClaims:active.length,pendingApprovals:pending.length,closableClaims:closable.length,overdueMonitoring:overdue.length,openTasks:openTasks.length,escalationCount:escalations.length,activePortfolio:pfItems.filter(function(p){return p.status!=='exited'&&p.status!=='archived'}).length,crmPipeline:crmTotals.pipeline||0,crmWon:crmTotals.won||0,estimatedPayoutExposure:stats.totalEstimatedPayout||0,workloadStatus:wl?wl.getStatus():'?',timestamp:Date.now()}
  }
  function health(){var s=snap();if(s.escalationCount>0)return'ESCALATED';if(s.overdueMonitoring>3)return'DEGRADED';if(s.workloadStatus==='OVERCAPACITY')return'STRAINED';if(s.activeClaims===0)return'IDLE';return'OPERATIONAL'}
  function blocked(){var l=window.LIMENClaimLedger;if(!l)return[];return l.getAllClaims().filter(function(c){return c.status==='in_review'||c.status==='submitted'})}
  function ready(){var l=window.LIMENClaimLedger,o=window.LIMENExecution.outcomes;if(!l)return[];return l.getAllClaims().filter(function(c){return c.status==='approved'&&!(o&&o.hasOutcomeForClaim(c.id))})}
  function summary(){var s=snap();return'Claims:'+s.activeClaims+' Pending:'+s.pendingApprovals+' Closable:'+s.closableClaims+' Tasks:'+s.openTasks+' Esc:'+s.escalationCount+' Health:'+health()}
  window.LIMENExecution.phase6.command={getSystemSnapshot:snap,getExecutionHealth:health,getPriorityQueues:function(){return{blocked:blocked(),ready:ready()}},getBlockedItems:blocked,getReadyItems:ready,getEscalatedItems:function(){var e=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation;return e?e.detect():[]},getCommandSummary:summary};
})();
