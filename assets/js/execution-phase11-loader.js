/**
 * execution-phase11-loader.js — Safe Phase 11 Loader
 * Initializes Phase 11 only on execution-capable pages.
 * Exposes: window.LIMENExecution.phase11.loader
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};
  var _log=[];
  function log(msg){_log.push({ts:Date.now(),msg:msg});console.log('[Phase11Loader] '+msg)}

  function _isExecCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio','operator-onboarding','intake','payout-operations'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function activate(){
    if(!_isExecCapable()){log('Not execution-capable — Phase 11 inactive');return}
    log('Activating Phase 11 on: '+window.location.pathname);
    var p11=window.LIMENExecution.phase11;
    var modules=['onboarding','liveReadiness','integrations','checkpoints','commercial','intake','revops','payoutOps','deployment','dashboard'];
    var ready=0;
    for(var i=0;i<modules.length;i++){if(p11[modules[i]]){ready++;log(modules[i]+': present')}else{log(modules[i]+': MISSING')}}
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule)reg.registerModule('phase11_loader',p11.loader);

    setTimeout(function(){
      if(p11.deployment){
        var report=p11.deployment.runDeploymentReadinessCheck();
        log('Deployment Readiness: '+report.status+' (score: '+report.score+')');
      }
    },5000);

    log('Phase 11 activation: '+ready+'/'+modules.length+' modules ready');
    return{ready:ready,total:modules.length,status:ready===modules.length?'FULL':ready>=8?'GOOD':'PARTIAL'};
  }

  setTimeout(activate,4200);

  window.LIMENExecution.phase11.loader={activate:activate,isExecutionCapable:_isExecCapable,getLog:function(){return _log}};
})();
