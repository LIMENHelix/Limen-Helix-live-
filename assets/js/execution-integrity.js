/**
 * execution-integrity.js — System Integrity Diagnostics
 * One place to verify global execution layer health.
 * Exposes: window.LIMENExecution.phase7.integrity
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  var REQUIRED_MODULES=[
    {ns:'LIMENExecution.outcomes',label:'outcomes'},
    {ns:'LIMENExecution.feedback',label:'feedback'},
    {ns:'LIMENExecution.policy',label:'policy'},
    {ns:'LIMENClaimLedger',label:'claimLedger'},
    {ns:'LIMENCompensation',label:'compensation'},
    {ns:'LIMENExecution.phase4.approval',label:'approvalAuthority'},
    {ns:'LIMENExecution.phase4.payoutFinalizer',label:'payoutFinalizer'},
    {ns:'LIMENExecution.phase5.monitoring',label:'monitoring'},
    {ns:'LIMENExecution.phase5.lifecycle',label:'lifecycle'},
    {ns:'LIMENExecution.phase5.aging',label:'aging'},
    {ns:'LIMENExecution.phase5.tasks',label:'tasks'},
    {ns:'LIMENExecution.phase5.actionQueue',label:'actionQueue'},
    {ns:'LIMENExecution.phase5.escalation',label:'escalation'},
    {ns:'LIMENExecution.phase5.crm',label:'crm'},
    {ns:'LIMENExecution.phase5.portfolioMonitor',label:'portfolioMonitor'},
    {ns:'LIMENExecution.phase6.approvals',label:'approvalRouting'},
    {ns:'LIMENExecution.phase6.economicMemory',label:'economicMemory'},
    {ns:'LIMENExecution.phase6.operatorBoard',label:'operatorBoard'},
    {ns:'LIMENExecution.phase6.lineage',label:'lineage'},
    {ns:'LIMENExecution.phase6.registry',label:'moduleRegistry'},
    {ns:'LIMENExecution.phase6.reports',label:'reports'},
    {ns:'LIMENExecution.phase7.approvalIntel',label:'approvalIntelligence'},
    {ns:'LIMENExecution.phase7.coherence',label:'coherence'},
    {ns:'LIMENExecution.phase7.portfolioFeedback',label:'portfolioFeedback'},
    {ns:'LIMENExecution.phase7.familyMemory',label:'familyMemory'},
    {ns:'LIMENExecution.phase7.economyBoard',label:'economyBoard'},
    {ns:'LIMENExecution.phase7.disputes',label:'disputes'},
    {ns:'LIMENExecution.phase7.incentives',label:'incentives'},
    {ns:'LIMENExecution.phase7.snapshot',label:'boardSnapshot'}
  ];

  function _resolve(ns){
    var parts=ns.split('.');var obj=window;
    for(var i=0;i<parts.length;i++){if(!obj)return null;obj=obj[parts[i]]}
    return obj||null;
  }

  function getMissingModules(){
    var missing=[];
    for(var i=0;i<REQUIRED_MODULES.length;i++){
      if(!_resolve(REQUIRED_MODULES[i].ns))missing.push(REQUIRED_MODULES[i].label);
    }
    return missing;
  }

  var STORAGE_KEYS=['LIMEN_EXECUTION_CLAIMS','LIMEN_EXECUTION_OUTCOMES','LIMEN_EXECUTION_OPERATOR_STATS','LIMEN_EXECUTION_MONITORING','LIMEN_EXECUTION_TASKS','LIMEN_EXECUTION_CRM','LIMEN_EXECUTION_PORTFOLIO','LIMEN_PORTAL_LEADS','LIMEN_EXECUTION_ECONOMIC_MEMORY','LIMEN_EXECUTION_POLICY_AUDIT','LIMEN_EXECUTION_DISPUTES'];

  function getStorageHealth(){
    var results={};
    for(var i=0;i<STORAGE_KEYS.length;i++){
      var k=STORAGE_KEYS[i];
      try{var v=localStorage.getItem(k);results[k]=v===null?'empty':'ok ('+v.length+' chars)'}catch(e){results[k]='error: '+e.message}
    }
    return results;
  }

  function getInitializationHealth(){
    var total=REQUIRED_MODULES.length;var present=0;
    for(var i=0;i<REQUIRED_MODULES.length;i++){if(_resolve(REQUIRED_MODULES[i].ns))present++}
    return{total:total,present:present,missing:total-present,pct:Math.round((present/total)*100)};
  }

  function getDataHealth(){
    var issues=[];
    var claims=window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[];
    var seen={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      if(c.status!=='closed'&&c.status!=='rejected'){
        var dk=(c.opportunityId||'')+'_'+(c.domain||'');
        if(seen[dk])issues.push({type:'duplicate_active_claim',detail:'Duplicate: '+c.title,id:c.id});
        seen[dk]=true;
      }
      if(c.status==='approved'&&!c.agreementAccepted)issues.push({type:'approved_no_agreement',detail:c.title,id:c.id});
      var validStates=['draft','submitted','in_review','approved','rejected','closed','claimed'];
      if(validStates.indexOf(c.status)===-1)issues.push({type:'impossible_state',detail:c.title+' has state: '+c.status,id:c.id});
    }
    return issues;
  }

  function runIntegrityCheck(){
    var init=getInitializationHealth();
    var missing=getMissingModules();
    var storage=getStorageHealth();
    var data=getDataHealth();
    var coherenceScore=100;
    var coh=window.LIMENExecution.phase7.coherence;
    if(coh&&coh.getCoherenceScore)coherenceScore=coh.getCoherenceScore();
    var status='HEALTHY';
    if(init.missing>5||data.length>5||coherenceScore<50)status='BROKEN';
    else if(init.missing>2||data.length>2||coherenceScore<75)status='DEGRADED';
    return{status:status,initialization:init,missingModules:missing,storageHealth:storage,dataIssues:data,coherenceScore:coherenceScore,checkedAt:Date.now()};
  }

  function getIntegrityReport(){return runIntegrityCheck()}

  window.LIMENExecution.phase7.integrity={
    runIntegrityCheck:runIntegrityCheck,
    getIntegrityReport:getIntegrityReport,
    getMissingModules:getMissingModules,
    getStorageHealth:getStorageHealth,
    getInitializationHealth:getInitializationHealth,
    getDataHealth:getDataHealth
  };
})();
