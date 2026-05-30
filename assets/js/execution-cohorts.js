/**
 * execution-cohorts.js — Claim Cohort Analysis
 * Analyzes claims in cohorts by month, domain, type, family, policy/agreement version.
 * Exposes: window.LIMENExecution.phase8.cohorts
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _familyOf(item){var fm=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.familyMemory;return fm?fm.inferOpportunityFamily(item).family:'unknown'}
  function _monthKey(ts){var d=new Date(ts||Date.now());return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)}

  function getClaimsByCohort(cohortType){
    var claims=_claims();var cohorts={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];var key;
      switch(cohortType){
        case'month':key=_monthKey(c.claimedAt||c.createdAt);break;
        case'domain':key=c.domain||'unknown';break;
        case'type':key=(c.type||c.path||'unknown').toUpperCase();break;
        case'family':key=_familyOf(c);break;
        case'policyVersion':key=c.policyVersion||'v1';break;
        case'agreementVersion':key=c.agreementVersion||'v1';break;
        default:key='all';
      }
      if(!cohorts[key])cohorts[key]=[];
      cohorts[key].push(c);
    }
    return cohorts;
  }

  function getCohortPerformance(cohortType){
    var cohorts=getClaimsByCohort(cohortType);
    var outcomes=_outcomes();var outcomeMap={};
    for(var j=0;j<outcomes.length;j++){outcomeMap[outcomes[j].claimId]=outcomes[j]}
    var result={};
    for(var key in cohorts){
      var group=cohorts[key];var count=group.length,success=0,totalValue=0,totalCycle=0,cycleCount=0,totalPayout=0;
      for(var i=0;i<group.length;i++){
        var c=group[i];var o=outcomeMap[c.id];
        if(o){
          if(o.result==='success')success++;
          if(o.outcomeValue)totalValue+=parseFloat(o.outcomeValue)||0;
          if(o.cycleTimeDays){totalCycle+=o.cycleTimeDays;cycleCount++}
        }
        if(c.estimatedOperatorPayout)totalPayout+=parseFloat(c.estimatedOperatorPayout)||0;
        else if(c.estimatedValue)totalPayout+=(parseFloat(c.estimatedValue)||0)*0.10;
      }
      var outcomesInCohort=0;for(var k=0;k<group.length;k++){if(outcomeMap[group[k].id])outcomesInCohort++}
      result[key]={
        count:count,
        successRate:outcomesInCohort>0?Math.round((success/outcomesInCohort)*100):0,
        weightedScore:count>0?Math.round((success/count)*100):0,
        avgCycleTime:cycleCount>0?Math.round(totalCycle/cycleCount):0,
        avgPayoutEstimate:count>0?Math.round(totalPayout/count):0,
        avgValueRealization:outcomesInCohort>0?Math.round(totalValue/outcomesInCohort):0,
        lowConfidence:count<3
      };
    }
    return result;
  }

  function getCohortCycleTimes(cohortType){
    var perf=getCohortPerformance(cohortType);var r={};
    for(var k in perf)r[k]={avgCycleTime:perf[k].avgCycleTime,count:perf[k].count,lowConfidence:perf[k].lowConfidence};
    return r;
  }

  function getCohortValueRealization(cohortType){
    var perf=getCohortPerformance(cohortType);var r={};
    for(var k in perf)r[k]={avgValueRealization:perf[k].avgValueRealization,count:perf[k].count,lowConfidence:perf[k].lowConfidence};
    return r;
  }

  function getBestCohorts(cohortType){
    var perf=getCohortPerformance(cohortType);var sorted=[];
    for(var k in perf)sorted.push({cohort:k,data:perf[k]});
    sorted.sort(function(a,b){return b.data.weightedScore-a.data.weightedScore});
    return sorted.slice(0,3);
  }

  function getWorstCohorts(cohortType){
    var perf=getCohortPerformance(cohortType);var sorted=[];
    for(var k in perf)if(perf[k].count>=1)sorted.push({cohort:k,data:perf[k]});
    sorted.sort(function(a,b){return a.data.weightedScore-b.data.weightedScore});
    return sorted.slice(0,3);
  }

  window.LIMENExecution.phase8.cohorts={
    getClaimsByCohort:getClaimsByCohort,
    getCohortPerformance:getCohortPerformance,
    getCohortCycleTimes:getCohortCycleTimes,
    getCohortValueRealization:getCohortValueRealization,
    getBestCohorts:getBestCohorts,
    getWorstCohorts:getWorstCohorts
  };
})();
