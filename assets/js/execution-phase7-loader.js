/**
 * execution-phase7-loader.js — Safe Modular Activation for Phase 7
 * Initializes Phase 7 only on execution-capable pages.
 * Guards every init, fails softly, registers in module registry.
 * Exposes: window.LIMENExecution.phase7.loader
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  var _log=[];
  function log(msg){_log.push({ts:Date.now(),msg:msg});console.log('[Phase7Loader] '+msg)}

  function _isExecutionCapablePage(){
    var path=window.location.pathname.toLowerCase();
    var execPages=['domain-console','execution-reports','execution-framework','policy-procedures','operator-sop','portal-pricing','venture-portfolio','crm-pipeline','disputes-exceptions','energy-workspace'];
    for(var i=0;i<execPages.length;i++){if(path.indexOf(execPages[i])!==-1)return true}
    var params=window.location.search||'';
    if(params.indexOf('mode=operator')!==-1)return true;
    if(document.querySelector('[data-execution-surface]'))return true;
    return false;
  }

  function _tryInit(name,check,initFn){
    try{
      if(check()){initFn();log(name+': OK');return true}
      else{log(name+': skipped (dependency missing)');return false}
    }catch(e){log(name+': FAILED — '+e.message);return false}
  }

  function _registerInRegistry(){
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(!reg||!reg.registerModule)return;
    var p7=window.LIMENExecution.phase7;
    var modules=[
      ['approvalIntelligence',p7.approvalIntel],
      ['coherence',p7.coherence],
      ['portfolioFeedback',p7.portfolioFeedback],
      ['familyMemory',p7.familyMemory],
      ['economyBoard',p7.economyBoard],
      ['disputes',p7.disputes],
      ['incentives',p7.incentives],
      ['integrity',p7.integrity],
      ['snapshot',p7.snapshot]
    ];
    for(var i=0;i<modules.length;i++){
      if(modules[i][1])reg.registerModule('phase7_'+modules[i][0],modules[i][1]);
    }
    log('Registered '+modules.length+' Phase 7 modules in registry');
  }

  function activate(){
    if(!_isExecutionCapablePage()){log('Not an execution-capable page — Phase 7 inactive');return}
    log('Activating Phase 7 on: '+window.location.pathname);

    var p7=window.LIMENExecution.phase7;
    var ready=0,total=9;

    // Verify each module loaded (they self-init as IIFEs, just check presence)
    if(p7.approvalIntel){ready++;log('approvalIntel: present')}else{log('approvalIntel: MISSING')}
    if(p7.coherence){ready++;log('coherence: present')}else{log('coherence: MISSING')}
    if(p7.portfolioFeedback){ready++;log('portfolioFeedback: present')}else{log('portfolioFeedback: MISSING')}
    if(p7.familyMemory){ready++;log('familyMemory: present')}else{log('familyMemory: MISSING')}
    if(p7.economyBoard){ready++;log('economyBoard: present')}else{log('economyBoard: MISSING')}
    if(p7.disputes){ready++;log('disputes: present')}else{log('disputes: MISSING')}
    if(p7.incentives){ready++;log('incentives: present')}else{log('incentives: MISSING')}
    if(p7.integrity){ready++;log('integrity: present')}else{log('integrity: MISSING')}
    if(p7.snapshot){ready++;log('snapshot: present')}else{log('snapshot: MISSING')}

    _registerInRegistry();

    // Run initial diagnostics (non-blocking)
    setTimeout(function(){
      if(p7.integrity){
        var report=p7.integrity.runIntegrityCheck();
        log('Integrity: '+report.status+' ('+report.initialization.present+'/'+report.initialization.total+' modules, '+report.dataIssues.length+' data issues)');
      }
      if(p7.coherence){
        var score=p7.coherence.getCoherenceScore();
        log('Coherence score: '+score);
      }
    },3000);

    log('Phase 7 activation complete: '+ready+'/'+total+' modules ready');
    return{ready:ready,total:total,status:ready===total?'FULL':ready>=7?'GOOD':'PARTIAL'};
  }

  // Auto-activate after all scripts load
  setTimeout(function(){activate()},2500);

  window.LIMENExecution.phase7.loader={
    activate:activate,
    isExecutionCapable:_isExecutionCapablePage,
    getLog:function(){return _log}
  };
})();
