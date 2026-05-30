/**
 * execution-governance-thresholds.js — Governance Threshold System
 * System-level warning thresholds for dashboards and warnings.
 * Exposes: window.LIMENExecution.phase8.thresholds
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  var DEFAULT_THRESHOLDS={
    overdueTasks:{watch:3,elevated:7,critical:15},
    staleApprovals:{watch:2,elevated:5,critical:10},
    unresolvedDisputes:{watch:2,elevated:5,critical:10},
    payoutConcentrationHHI:{watch:3500,elevated:5000,critical:7500},
    claimsInSingleDomain:{watch:10,elevated:20,critical:35},
    failuresInFamily:{watch:3,elevated:6,critical:10},
    portfolioDistress:{watch:1,elevated:3,critical:5},
    missingModules:{watch:3,elevated:8,critical:15}
  };

  function getThresholdConfig(){return JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS))}

  function _status(value,threshold){
    if(value>=threshold.critical)return'CRITICAL';
    if(value>=threshold.elevated)return'ELEVATED';
    if(value>=threshold.watch)return'WATCH';
    return'NORMAL';
  }

  function evaluateThresholds(){
    var results={};
    // Overdue tasks
    var aq=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.actionQueue;
    var overdue=0;
    if(aq&&aq.getOverdue)overdue=aq.getOverdue().length;
    else if(aq&&aq.getAll){var all=aq.getAll();overdue=all.filter(function(a){return a.status==='overdue'}).length}
    results.overdueTasks={value:overdue,status:_status(overdue,DEFAULT_THRESHOLDS.overdueTasks)};

    // Stale approvals
    var claims=window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[];
    var stale=0;
    for(var i=0;i<claims.length;i++){
      if(claims[i].status==='in_review'||claims[i].status==='submitted'){
        var age=Math.round((Date.now()-(claims[i].submittedAt||claims[i].claimedAt||Date.now()))/864e5);
        if(age>14)stale++;
      }
    }
    results.staleApprovals={value:stale,status:_status(stale,DEFAULT_THRESHOLDS.staleApprovals)};

    // Unresolved disputes
    var disp=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;
    var openDisp=disp?disp.getOpenDisputeCount():0;
    results.unresolvedDisputes={value:openDisp,status:_status(openDisp,DEFAULT_THRESHOLDS.unresolvedDisputes)};

    // Payout concentration
    var eco=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.economyBoard;
    var hhi=eco?eco.getConcentrationRisk().hhi:0;
    results.payoutConcentration={value:hhi,status:_status(hhi,DEFAULT_THRESHOLDS.payoutConcentrationHHI)};

    // Claims in single domain
    var domCounts={};
    for(var j=0;j<claims.length;j++){
      if(claims[j].status!=='closed'&&claims[j].status!=='rejected'){
        var d=claims[j].domain||'unknown';domCounts[d]=(domCounts[d]||0)+1;
      }
    }
    var maxDomClaims=0;for(var dk in domCounts){if(domCounts[dk]>maxDomClaims)maxDomClaims=domCounts[dk]}
    results.claimsInSingleDomain={value:maxDomClaims,status:_status(maxDomClaims,DEFAULT_THRESHOLDS.claimsInSingleDomain)};

    // Failures in family
    var fm=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.familyMemory;
    var maxFail=0;
    if(fm){
      var stats=fm.rebuildFamilyMemory();
      for(var fk in stats){var fails=(stats[fk].closedOutcomes||0)-(stats[fk].successCount||0);if(fails>maxFail)maxFail=fails}
    }
    results.failuresInFamily={value:maxFail,status:_status(maxFail,DEFAULT_THRESHOLDS.failuresInFamily)};

    // Portfolio distress
    var pf=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;
    var distressed=0;
    if(pf&&pf.getSummary){var ps=pf.getSummary();distressed=ps.distressed||0}
    results.portfolioDistress={value:distressed,status:_status(distressed,DEFAULT_THRESHOLDS.portfolioDistress)};

    // Missing modules
    var integ=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.integrity;
    var missing=integ?integ.getMissingModules().length:0;
    results.missingModules={value:missing,status:_status(missing,DEFAULT_THRESHOLDS.missingModules)};

    return results;
  }

  function getThresholdWarnings(){
    var ev=evaluateThresholds();var warnings=[];
    for(var k in ev){if(ev[k].status!=='NORMAL')warnings.push({threshold:k,value:ev[k].value,status:ev[k].status})}
    warnings.sort(function(a,b){var so={CRITICAL:0,ELEVATED:1,WATCH:2};return(so[a.status]||3)-(so[b.status]||3)});
    return warnings;
  }

  function getThresholdStatus(){
    var warnings=getThresholdWarnings();
    if(warnings.length===0)return'NORMAL';
    if(warnings.some(function(w){return w.status==='CRITICAL'}))return'CRITICAL';
    if(warnings.some(function(w){return w.status==='ELEVATED'}))return'ELEVATED';
    return'WATCH';
  }

  window.LIMENExecution.phase8.thresholds={
    getThresholdConfig:getThresholdConfig,
    evaluateThresholds:evaluateThresholds,
    getThresholdWarnings:getThresholdWarnings,
    getThresholdStatus:getThresholdStatus
  };
})();
