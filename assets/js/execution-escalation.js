/**
 * execution-escalation.js — Outcome-Based Escalation Logic
 * Detects repeat failures, abandoned flows, distressed patterns.
 * Exposes: window.LIMENExecution.phase5.escalation
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  function detect(){
    var items=[];var outcomes=window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[];
    // Count recent failures by type
    var byType={};for(var i=0;i<outcomes.length;i++){var o=outcomes[i];var t=o.type||'other';if(!byType[t])byType[t]={fails:0,abandoned:0,recent:[]};if(o.result==='fail')byType[t].fails++;if(o.result==='abandoned')byType[t].abandoned++;if(Date.now()-o.recordedAt<30*864e5)byType[t].recent.push(o)}
    for(var tk in byType){var bt=byType[tk];var recentFails=bt.recent.filter(function(r){return r.result==='fail'}).length;var recentAbandoned=bt.recent.filter(function(r){return r.result==='abandoned'}).length;
      if(recentFails>=3)items.push({id:'esc_'+tk+'_fails',type:tk,trigger:'3+ recent failures',severity:'critical',detail:recentFails+' failures in '+tk+' in last 30 days'});
      if(recentAbandoned>=2)items.push({id:'esc_'+tk+'_abandoned',type:tk,trigger:'2+ abandoned',severity:'elevated',detail:recentAbandoned+' abandoned in '+tk})}
    // Distressed portfolio without review
    var pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio;
    if(pf){var cos=pf.getAllCompanies();for(var j=0;j<cos.length;j++){if(cos[j].status==='distressed')items.push({id:'esc_pf_'+cos[j].id,type:'portfolio',trigger:'distressed without review',severity:'elevated',detail:cos[j].name+' marked distressed'})}}
    return items;
  }
  function getSeverityCounts(){var all=detect();var c={moderate:0,elevated:0,critical:0};for(var i=0;i<all.length;i++)c[all[i].severity]=(c[all[i].severity]||0)+1;return c}
  window.LIMENExecution.phase5.escalation={detect:detect,getSeverityCounts:getSeverityCounts};
})();
