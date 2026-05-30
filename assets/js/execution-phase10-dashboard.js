/**
 * execution-phase10-dashboard.js — Phase 10 Report Integration
 * Registers Phase 10 modules and integrates with reports.
 * Exposes: window.LIMENExecution.phase10.dashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _isExecutionCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function init(){
    if(!_isExecutionCapable())return;
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule){
      var p10=window.LIMENExecution.phase10;
      var mods=[['recommendedActions',p10.recommendations],['playbooks',p10.playbooks],['confirmation',p10.confirmation],['nextAction',p10.nextAction],['decisionSynthesis',p10.decisionSynthesis],['readiness',p10.readiness],['guided',p10.guided],['drafts',p10.drafts],['autonomyDashboard',p10.autonomyDashboard],['phase10Dashboard',p10.dashboard]];
      for(var i=0;i<mods.length;i++){if(mods[i][1])reg.registerModule('phase10_'+mods[i][0],mods[i][1])}
    }
    console.log('[Phase10Dashboard] Phase 10 active on: '+window.location.pathname);
  }

  setTimeout(init,4000);

  window.LIMENExecution.phase10.dashboard={init:init};
})();
