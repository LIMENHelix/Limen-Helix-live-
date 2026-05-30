/**
 * execution-phase11-dashboard.js — Phase 11 Dashboard + Report Integration
 * Registers Phase 11 modules and renders widgets.
 * Exposes: window.LIMENExecution.phase11.dashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _safe(fn,fb){try{return fn()}catch(e){return fb}}
  function _isExecCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio','operator-onboarding','intake','payout-operations'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function buildDashboardData(){
    var p11=window.LIMENExecution.phase11;var w={};
    if(p11.onboarding)w.onboarding=_safe(function(){return p11.onboarding.getOnboardingStatus()},{});
    if(p11.liveReadiness)w.liveReady=_safe(function(){return p11.liveReadiness.getLiveReadinessStatus()},{});
    if(p11.commercial)w.commercial=_safe(function(){var s=p11.commercial.getCommercialSnapshot();return{streams:s.totalStreams,blockers:s.blockers.length}},{});
    if(p11.revops)w.revops=_safe(function(){var s=p11.revops.getRevenuePipeline();return{pipeline:s.pipeline,realized:s.realized}},{});
    if(p11.payoutOps)w.payoutOps=_safe(function(){return p11.payoutOps.getPayoutSummary()},{});
    if(p11.deployment)w.deployment=_safe(function(){var d=p11.deployment.runDeploymentReadinessCheck();return{score:d.score,status:d.status}},{});
    return w;
  }

  function init(){
    if(!_isExecCapable())return;
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule){
      var p11=window.LIMENExecution.phase11;
      var mods=[['onboarding',p11.onboarding],['liveReadiness',p11.liveReadiness],['integrations',p11.integrations],['checkpoints',p11.checkpoints],['commercial',p11.commercial],['intake',p11.intake],['revops',p11.revops],['payoutOps',p11.payoutOps],['deployment',p11.deployment],['phase11Dashboard',p11.dashboard]];
      for(var i=0;i<mods.length;i++){if(mods[i][1])reg.registerModule('phase11_'+mods[i][0],mods[i][1])}
    }
    console.log('[Phase11Dashboard] Phase 11 active on: '+window.location.pathname);
  }

  setTimeout(init,4500);

  window.LIMENExecution.phase11.dashboard={buildDashboardData:buildDashboardData,init:init};
})();
