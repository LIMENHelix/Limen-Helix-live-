/**
 * execution-phase9-dashboard.js — Phase 9 Dashboard + Report Integration
 * Renders compact Phase 9 widgets, registers in module registry.
 * Exposes: window.LIMENExecution.phase9.dashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _isExecutionCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function _safe(fn,fallback){try{return fn()}catch(e){return fallback}}

  function buildDashboardData(){
    var p9=window.LIMENExecution.phase9;var widgets={};
    if(p9.selfAudit)widgets.selfAudit=_safe(function(){var a=p9.selfAudit.runSelfAudit();return{score:a.score,status:a.status,findings:a.findings.length}},{});
    if(p9.decisionMemory)widgets.decisionMemory=_safe(function(){var s=p9.decisionMemory.getDecisionSummary();return{totalEvents:s.totalEvents}},{});
    if(p9.resilience)widgets.resilience=_safe(function(){return{status:p9.resilience.getResilienceStatus(),risks:p9.resilience.getResilienceSnapshot().totalRisks}},{});
    if(p9.drift)widgets.drift=_safe(function(){return{score:p9.drift.getDriftScore(),findings:p9.drift.getDriftFindings().length}},{});
    if(p9.policyCompliance)widgets.policyCompliance=_safe(function(){var c=p9.policyCompliance.getPolicyComplianceSnapshot();return{score:c.score,status:c.status,gaps:c.totalGaps}},{});
    if(p9.exceptionPressure)widgets.exceptionPressure=_safe(function(){return{status:p9.exceptionPressure.getPressureStatus(),drivers:p9.exceptionPressure.getPressureDrivers().length}},{});
    if(p9.repairQueue)widgets.repairQueue=_safe(function(){return{open:p9.repairQueue.getOpenRepairs().length,top:p9.repairQueue.getTopRepairs(3).length}},{});
    if(p9.saturation)widgets.saturation=_safe(function(){var s=p9.saturation.getSaturationSnapshot();return{domainLabel:s.domain.label,typeLabel:s.type.label,warnings:s.warnings.length}},{});
    if(p9.digest)widgets.operatingDigest=_safe(function(){return p9.digest.getDigestSummary()},{});
    return widgets;
  }

  function init(){
    if(!_isExecutionCapable())return;
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule){
      var p9=window.LIMENExecution.phase9;
      var mods=[['selfAudit',p9.selfAudit],['decisionMemory',p9.decisionMemory],['resilience',p9.resilience],['drift',p9.drift],['policyCompliance',p9.policyCompliance],['exceptionPressure',p9.exceptionPressure],['repairQueue',p9.repairQueue],['saturation',p9.saturation],['digest',p9.digest],['phase9Dashboard',p9.dashboard]];
      for(var i=0;i<mods.length;i++){if(mods[i][1])reg.registerModule('phase9_'+mods[i][0],mods[i][1])}
    }
    // Rebuild repair queue on load
    if(window.LIMENExecution.phase9.repairQueue){
      try{window.LIMENExecution.phase9.repairQueue.rebuildRepairQueue()}catch(e){console.warn('[Phase9] Repair queue rebuild failed:',e.message)}
    }
    console.log('[Phase9Dashboard] Phase 9 active on: '+window.location.pathname);
  }

  setTimeout(init,3500);

  window.LIMENExecution.phase9.dashboard={buildDashboardData:buildDashboardData,init:init};
})();
