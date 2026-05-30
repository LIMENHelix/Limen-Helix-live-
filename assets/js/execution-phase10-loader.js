/**
 * execution-phase10-loader.js — Safe Phase 10 Loader
 * Initializes Phase 10 only on execution-capable pages.
 * Exposes: window.LIMENExecution.phase10.loader
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  var _log=[];
  function log(msg){_log.push({ts:Date.now(),msg:msg});console.log('[Phase10Loader] '+msg)}

  function _isExecutionCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function activate(){
    if(!_isExecutionCapable()){log('Not an execution-capable page — Phase 10 inactive');return}
    log('Activating Phase 10 on: '+window.location.pathname);
    var p10=window.LIMENExecution.phase10;
    var modules=['recommendations','playbooks','confirmation','nextAction','decisionSynthesis','readiness','guided','drafts','autonomyDashboard','dashboard'];
    var ready=0;
    for(var i=0;i<modules.length;i++){
      if(p10[modules[i]]){ready++;log(modules[i]+': present')}else{log(modules[i]+': MISSING')}
    }
    // Register loader
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule)reg.registerModule('phase10_loader',p10.loader);

    // Log next-best-action on load
    setTimeout(function(){
      if(p10.nextAction){
        var nba=p10.nextAction.explainNextBestAction();
        log('Next Best Action: '+(nba.action?nba.action.title:'None')+' — '+nba.explanation);
      }
    },4500);

    log('Phase 10 activation complete: '+ready+'/'+modules.length+' modules ready');
    return{ready:ready,total:modules.length,status:ready===modules.length?'FULL':ready>=8?'GOOD':'PARTIAL'};
  }

  setTimeout(activate,3800);

  window.LIMENExecution.phase10.loader={activate:activate,isExecutionCapable:_isExecutionCapable,getLog:function(){return _log}};
})();
