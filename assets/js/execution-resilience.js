/**
 * execution-resilience.js — Structural Resilience Checks
 * Identifies weak points in the operating fabric.
 * Exposes: window.LIMENExecution.phase9.resilience
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}

  function _concentration(map){
    var total=0;var vals=[];
    for(var k in map){vals.push(map[k]);total+=map[k]}
    if(total===0)return{hhi:0,dominant:null};
    var hhi=0;var dominant=null,maxV=0;
    for(var i=0;i<vals.length;i++){var s=vals[i]/total;hhi+=s*s}
    for(var j in map){if(map[j]>maxV){maxV=map[j];dominant=j}}
    return{hhi:Math.round(hhi*10000),dominant:dominant};
  }

  function getSinglePointFailures(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var failures=[];
    // Type concentration
    var byType={};for(var i=0;i<claims.length;i++){var t=(claims[i].type||claims[i].path||'unknown').toUpperCase();byType[t]=(byType[t]||0)+1}
    var tc=_concentration(byType);
    if(tc.hhi>5000)failures.push({risk:'type_concentration',detail:'HHI '+tc.hhi+', dominant: '+tc.dominant,severity:'elevated'});
    // Domain concentration
    var byDomain={};for(var j=0;j<claims.length;j++){var d=claims[j].domain||'unknown';byDomain[d]=(byDomain[d]||0)+1}
    var dc=_concentration(byDomain);
    if(dc.hhi>5000)failures.push({risk:'domain_concentration',detail:'HHI '+dc.hhi+', dominant: '+dc.dominant,severity:'elevated'});
    return failures;
  }

  function getWeakModules(){
    var integ=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.integrity;
    if(!integ)return[];
    var missing=integ.getMissingModules();
    return missing.map(function(m){return{module:m,risk:'missing',severity:'moderate'}});
  }

  function getStorageDependencyRisks(){
    var keys=['LIMEN_EXECUTION_CLAIMS','LIMEN_EXECUTION_OUTCOMES','LIMEN_EXECUTION_CRM','LIMEN_EXECUTION_PORTFOLIO'];
    var risks=[];
    for(var i=0;i<keys.length;i++){
      try{var v=localStorage.getItem(keys[i]);if(v&&v.length>500000)risks.push({key:keys[i],size:v.length,risk:'large_payload',severity:'moderate'})}catch(e){risks.push({key:keys[i],risk:'read_error',severity:'elevated'})}
    }
    return risks;
  }

  function getRecoveryFragility(){
    var disputes=_disputes().filter(function(d){return d.status==='open'||d.status==='under_review'});
    var byPath={};
    for(var i=0;i<disputes.length;i++){var t=disputes[i].disputeType||'other';byPath[t]=(byPath[t]||0)+1}
    var fragile=[];
    for(var k in byPath){if(byPath[k]>=3)fragile.push({path:k,count:byPath[k],severity:'elevated'})}
    return fragile;
  }

  function getResilienceSnapshot(){
    var spf=getSinglePointFailures();
    var weak=getWeakModules();
    var storage=getStorageDependencyRisks();
    var recovery=getRecoveryFragility();
    var allRisks=spf.length+weak.length+storage.length+recovery.length;
    return{singlePointFailures:spf,weakModules:weak,storageDependencyRisks:storage,recoveryFragility:recovery,totalRisks:allRisks};
  }

  function getResilienceStatus(){
    var snap=getResilienceSnapshot();
    if(snap.totalRisks===0)return'RESILIENT';
    var elevated=snap.singlePointFailures.concat(snap.weakModules,snap.storageDependencyRisks,snap.recoveryFragility).filter(function(r){return r.severity==='elevated'||r.severity==='critical'});
    if(elevated.length>=3)return'HIGHLY FRAGILE';
    if(snap.totalRisks>=3)return'FRAGILE';
    return'RESILIENT';
  }

  window.LIMENExecution.phase9.resilience={getResilienceSnapshot:getResilienceSnapshot,getSinglePointFailures:getSinglePointFailures,getWeakModules:getWeakModules,getStorageDependencyRisks:getStorageDependencyRisks,getRecoveryFragility:getRecoveryFragility,getResilienceStatus:getResilienceStatus};
})();
