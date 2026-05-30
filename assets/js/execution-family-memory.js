/**
 * execution-family-memory.js — Opportunity Family Memory
 * Tracks performance by opportunity family (grant/federal, patent/provisional, etc.)
 * Exposes: window.LIMENExecution.phase7.familyMemory
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  var FAMILY_MAP={
    'GRANT':['federal','state','foundation','institutional'],
    'PATENT':['provisional','utility','licensing','defensive'],
    'INVEST':['paper_trade','swing_thesis','position','hedge'],
    'BUSINESS':['sba_loan','equipment_loan','starter_sale','enterprise_lead','portal_sale']
  };

  function inferOpportunityFamily(opp){
    var path=(opp.path||opp.type||'').toUpperCase();
    var title=(opp.title||opp.name||'').toLowerCase();
    var sub='general';
    if(path==='GRANT'){
      if(title.indexOf('federal')!==-1||title.indexOf('doe')!==-1||title.indexOf('arpa')!==-1)sub='federal';
      else if(title.indexOf('state')!==-1)sub='state';
      else if(title.indexOf('foundation')!==-1)sub='foundation';
      else sub='institutional';
    }else if(path==='PATENT'){
      if(title.indexOf('provisional')!==-1)sub='provisional';
      else if(title.indexOf('licens')!==-1)sub='licensing';
      else if(title.indexOf('defensive')!==-1)sub='defensive';
      else sub='utility';
    }else if(path==='INVEST'){
      if(title.indexOf('paper')!==-1)sub='paper_trade';
      else if(title.indexOf('swing')!==-1)sub='swing_thesis';
      else if(title.indexOf('hedge')!==-1||title.indexOf('hedg')!==-1)sub='hedge';
      else sub='position';
    }else if(path==='BUSINESS'){
      if(title.indexOf('sba')!==-1||title.indexOf('loan')!==-1)sub='sba_loan';
      else if(title.indexOf('equipment')!==-1)sub='equipment_loan';
      else if(title.indexOf('enterprise')!==-1)sub='enterprise_lead';
      else if(title.indexOf('portal')!==-1||title.indexOf('starter')!==-1)sub='starter_sale';
      else sub='portal_sale';
    }
    return{type:path||'UNKNOWN',subtype:sub,family:((path||'unknown')+'/'+sub).toLowerCase()};
  }

  function _buildFamilyStats(){
    var stats={};
    var outcomes=window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[];
    var claims=window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[];
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      var fam=inferOpportunityFamily(c).family;
      if(!stats[fam])stats[fam]={totalClaims:0,closedOutcomes:0,successCount:0,totalValue:0,totalCycleTime:0,cycleCount:0};
      stats[fam].totalClaims++;
    }
    for(var j=0;j<outcomes.length;j++){
      var o=outcomes[j];
      var ofam=inferOpportunityFamily(o).family;
      if(!stats[ofam])stats[ofam]={totalClaims:0,closedOutcomes:0,successCount:0,totalValue:0,totalCycleTime:0,cycleCount:0};
      stats[ofam].closedOutcomes++;
      if(o.result==='success')stats[ofam].successCount++;
      if(o.outcomeValue)stats[ofam].totalValue+=parseFloat(o.outcomeValue)||0;
      if(o.cycleTimeDays){stats[ofam].totalCycleTime+=o.cycleTimeDays;stats[ofam].cycleCount++}
    }
    return stats;
  }

  function getFamilyPerformance(family){
    var stats=_buildFamilyStats();
    var s=stats[family];
    if(!s)return{totalClaims:0,closedOutcomes:0,weightedScore:0,avgCycleTime:0,avgValueRealization:0,sampleSize:0};
    var ws=s.closedOutcomes>0?(s.successCount/s.closedOutcomes)*100:0;
    var avgCycle=s.cycleCount>0?Math.round(s.totalCycleTime/s.cycleCount):0;
    var avgVal=s.closedOutcomes>0?Math.round(s.totalValue/s.closedOutcomes):0;
    return{totalClaims:s.totalClaims,closedOutcomes:s.closedOutcomes,weightedScore:Math.round(ws),avgCycleTime:avgCycle,avgValueRealization:avgVal,sampleSize:s.closedOutcomes};
  }

  function getFamilyAdjustment(opportunity){
    var fam=inferOpportunityFamily(opportunity).family;
    var perf=getFamilyPerformance(fam);
    if(perf.sampleSize<3)return{family:fam,adjustment:0,reason:'insufficient_data',sampleSize:perf.sampleSize};
    var adj=0;
    if(perf.weightedScore>=80)adj=0.05;
    else if(perf.weightedScore>=60)adj=0.02;
    else if(perf.weightedScore>=40)adj=0;
    else if(perf.weightedScore>=20)adj=-0.03;
    else adj=-0.05;
    return{family:fam,adjustment:adj,reason:perf.weightedScore>=60?'strong_family':'weak_family',sampleSize:perf.sampleSize,weightedScore:perf.weightedScore};
  }

  function rebuildFamilyMemory(){return _buildFamilyStats()}

  window.LIMENExecution.phase7.familyMemory={
    inferOpportunityFamily:inferOpportunityFamily,
    getFamilyPerformance:getFamilyPerformance,
    getFamilyAdjustment:getFamilyAdjustment,
    rebuildFamilyMemory:rebuildFamilyMemory
  };
})();
