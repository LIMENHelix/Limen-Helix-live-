/**
 * execution-phase9-loader.js — Safe Phase 9 Loader
 * Initializes Phase 9 only on execution-capable pages.
 * Exposes: window.LIMENExecution.phase9.loader
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  var _log=[];
  function log(msg){_log.push({ts:Date.now(),msg:msg});console.log('[Phase9Loader] '+msg)}

  function _isExecutionCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function activate(){
    if(!_isExecutionCapable()){log('Not an execution-capable page — Phase 9 inactive');return}
    log('Activating Phase 9 on: '+window.location.pathname);
    var p9=window.LIMENExecution.phase9;
    var modules=['selfAudit','decisionMemory','resilience','drift','policyCompliance','exceptionPressure','repairQueue','saturation','digest','dashboard'];
    var ready=0;
    for(var i=0;i<modules.length;i++){
      if(p9[modules[i]]){ready++;log(modules[i]+': present')}else{log(modules[i]+': MISSING')}
    }
    // Register loader itself
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule)reg.registerModule('phase9_loader',p9.loader);

    // Run initial self-audit (non-blocking)
    setTimeout(function(){
      if(p9.selfAudit){
        var report=p9.selfAudit.runSelfAudit();
        log('Self-Audit: '+report.status+' (score: '+report.score+', findings: '+report.findings.length+')');
      }
      if(p9.digest){
        var digest=p9.digest.getDigestSummary();
        log('Operating Digest: '+digest.overall);
      }
    },4000);

    log('Phase 9 activation complete: '+ready+'/'+modules.length+' modules ready');
    return{ready:ready,total:modules.length,status:ready===modules.length?'FULL':ready>=8?'GOOD':'PARTIAL'};
  }

  setTimeout(activate,3200);

  window.LIMENExecution.phase9.loader={activate:activate,isExecutionCapable:_isExecutionCapable,getLog:function(){return _log}};
})();
