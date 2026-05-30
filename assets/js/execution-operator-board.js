/**
 * execution-operator-board.js — Global Operator Performance Board
 * Exposes: window.LIMENExecution.phase6.operatorBoard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function getData(){
    var stats=window.LIMENExecution.operatorStats?window.LIMENExecution.operatorStats.getStats():{};
    var wl=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.workload?window.LIMENExecution.phase5.workload.getSnapshot():{};
    var esc=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation?window.LIMENExecution.phase5.escalation.getSeverityCounts():{};
    return{totalClaims:stats.totalClaims||0,totalClosed:stats.totalClosed||0,successRate:stats.successRate||0,weightedScore:stats.weightedScore||0,avgCycleTime:stats.avgCycleTime||0,avgValue:stats.avgValueRealization||0,byType:stats.byType||{},workload:wl,escalations:esc}
  }
  function getStrengths(){var d=getData();var best=null,bestScore=-Infinity;for(var t in d.byType){if(d.byType[t].avgScore>bestScore){bestScore=d.byType[t].avgScore;best=t}}return best?{type:best,score:bestScore,rate:d.byType[best].successRate}:null}
  function getWeaknesses(){var d=getData();var worst=null,worstScore=Infinity;for(var t in d.byType){if(d.byType[t].total>=2&&d.byType[t].avgScore<worstScore){worstScore=d.byType[t].avgScore;worst=t}}return worst?{type:worst,score:worstScore,rate:d.byType[worst].successRate}:null}
  function getTrend(){var d=getData();if(d.totalClosed<5)return'INSUFFICIENT DATA';if(d.successRate>=70)return'IMPROVING';if(d.successRate>=40)return'STABLE';return'SLIPPING'}
  window.LIMENExecution.phase6.operatorBoard={getData:getData,getStrengths:getStrengths,getWeaknesses:getWeaknesses,getTrend:getTrend};
})();
