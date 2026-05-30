/**
 * execution-module-registry.js — Scale-Ready Module Registry
 * Tracks which execution modules are present and healthy.
 * Exposes: window.LIMENExecution.phase6.registry
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  var _modules={};
  var EXPECTED=['outcomes','closeout','feedback','operatorStats','reliabilityPanel','policy','compensation','approvalAuthority','investmentControls','payoutFinalizer','monitoring','lifecycle','aging','followupTasks','actionQueue','workload','escalation','crm','portfolioMonitor','opsDashboard','command','approvals','economicMemory','operatorBoard','entityLinking','lineage','policyVersioning','capacityGovernance','reports','approvalIntelligence','coherence','portfolioFeedback','familyMemory','economyBoard','disputes','incentives','integrity','boardSnapshot','phase7Loader'];
  function register(name,ref){_modules[name]={name:name,ref:ref,active:!!ref,registeredAt:Date.now()}}
  function getAll(){return _modules}
  function isActive(name){return _modules[name]&&_modules[name].active}
  function getHealth(){var total=EXPECTED.length,active=0,missing=[];for(var i=0;i<EXPECTED.length;i++){if(_modules[EXPECTED[i]]&&_modules[EXPECTED[i]].active)active++;else missing.push(EXPECTED[i])}return{total:total,active:active,missing:missing,health:active===total?'FULL':active>=total*0.8?'GOOD':active>=total*0.5?'PARTIAL':'DEGRADED'}}
  // Auto-register on load (delayed to let all modules init)
  setTimeout(function(){
    var E=window.LIMENExecution;var p4=E&&E.phase4;var p5=E&&E.phase5;var p6=E&&E.phase6;
    if(E&&E.outcomes)register('outcomes',E.outcomes);if(E&&E.closeout)register('closeout',E.closeout);if(E&&E.feedback)register('feedback',E.feedback);if(E&&E.operatorStats)register('operatorStats',E.operatorStats);if(E&&E.reliabilityPanel)register('reliabilityPanel',E.reliabilityPanel);
    if(E&&E.policy)register('policy',E.policy);if(window.LIMENCompensation)register('compensation',window.LIMENCompensation);
    if(p4){if(p4.approval)register('approvalAuthority',p4.approval);if(p4.investControls)register('investmentControls',p4.investControls);if(p4.payoutFinalizer)register('payoutFinalizer',p4.payoutFinalizer);if(p4.portfolio)register('portfolioMonitor',p4.portfolio)}
    if(p5){if(p5.monitoring)register('monitoring',p5.monitoring);if(p5.lifecycle)register('lifecycle',p5.lifecycle);if(p5.aging)register('aging',p5.aging);if(p5.tasks)register('followupTasks',p5.tasks);if(p5.actionQueue)register('actionQueue',p5.actionQueue);if(p5.workload)register('workload',p5.workload);if(p5.escalation)register('escalation',p5.escalation);if(p5.crm)register('crm',p5.crm);if(p5.portfolioMonitor)register('portfolioMonitor',p5.portfolioMonitor);if(p5.opsDashboard)register('opsDashboard',p5.opsDashboard)}
    if(p6){if(p6.command)register('command',p6.command);if(p6.approvals)register('approvals',p6.approvals);if(p6.economicMemory)register('economicMemory',p6.economicMemory);if(p6.operatorBoard)register('operatorBoard',p6.operatorBoard);if(p6.entityLinking)register('entityLinking',p6.entityLinking);if(p6.lineage)register('lineage',p6.lineage);if(p6.policyAudit)register('policyVersioning',p6.policyAudit);if(p6.governance)register('capacityGovernance',p6.governance);if(p6.reports)register('reports',p6.reports)}
    var p7=E&&E.phase7;
    if(p7){if(p7.approvalIntel)register('approvalIntelligence',p7.approvalIntel);if(p7.coherence)register('coherence',p7.coherence);if(p7.portfolioFeedback)register('portfolioFeedback',p7.portfolioFeedback);if(p7.familyMemory)register('familyMemory',p7.familyMemory);if(p7.economyBoard)register('economyBoard',p7.economyBoard);if(p7.disputes)register('disputes',p7.disputes);if(p7.incentives)register('incentives',p7.incentives);if(p7.integrity)register('integrity',p7.integrity);if(p7.snapshot)register('boardSnapshot',p7.snapshot);if(p7.loader)register('phase7Loader',p7.loader)}
    var h=getHealth();console.log('[ModuleRegistry] '+h.active+'/'+h.total+' modules active ('+h.health+')');if(h.missing.length>0)console.log('[ModuleRegistry] Missing:',h.missing.join(', '));
  },2000);
  window.LIMENExecution.phase6.registry={registerModule:register,getRegisteredModules:getAll,isModuleActive:isActive,getModuleHealth:getHealth};
})();
