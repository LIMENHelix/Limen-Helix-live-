/**
 * execution-board-snapshot.js — Executive Summary / Board Snapshot Layer
 * Compact executive view of the whole operating system.
 * Exposes: window.LIMENExecution.phase7.snapshot
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}

  function getTopBlockers(){
    var blockers=[];
    // Coherence issues
    var coh=window.LIMENExecution.phase7.coherence;
    if(coh){var broken=coh.getBrokenLinks();for(var i=0;i<Math.min(broken.length,3);i++)blockers.push({source:'coherence',detail:broken[i].detail,severity:broken[i].severity})}
    // Integrity issues
    var integ=window.LIMENExecution.phase7.integrity;
    if(integ){var data=integ.getDataHealth();for(var j=0;j<Math.min(data.length,3);j++)blockers.push({source:'integrity',detail:data[j].detail,type:data[j].type})}
    // Open disputes
    var disp=window.LIMENExecution.phase7.disputes;
    if(disp){var open=disp.getDisputesByStatus('open');for(var k=0;k<Math.min(open.length,3);k++)blockers.push({source:'dispute',detail:open[k].title,severity:open[k].severity})}
    // Escalations
    var esc=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation;
    if(esc&&esc.getActive){var active=esc.getActive();for(var m=0;m<Math.min(active.length,2);m++)blockers.push({source:'escalation',detail:active[m].title||active[m].reason})}
    // Sort by severity
    var sevOrder={critical:0,elevated:1,moderate:2,low:3};
    blockers.sort(function(a,b){return(sevOrder[a.severity]||3)-(sevOrder[b.severity]||3)});
    return blockers.slice(0,3);
  }

  function getTopStrengths(){
    var strengths=[];
    var outcomes=_outcomes();
    var successCount=outcomes.filter(function(o){return o.result==='success'}).length;
    if(successCount>0)strengths.push({area:'Outcomes',detail:successCount+' successful outcomes recorded'});
    // Operator board
    var ob=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.operatorBoard;
    if(ob&&ob.getData){var d=ob.getData();if(d.successRate>=70)strengths.push({area:'Operator',detail:d.successRate+'% success rate'})}
    // Economy
    var eco=window.LIMENExecution.phase7.economyBoard;
    if(eco){var bd=eco.getEconomyBoardData();if(bd.realizedValue>0)strengths.push({area:'Revenue',detail:'$'+bd.realizedValue.toLocaleString()+' realized value'});if(bd.concentrationRisk==='BALANCED')strengths.push({area:'Diversification',detail:'Balanced type concentration'})}
    // Module health
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.getModuleHealth){var h=reg.getModuleHealth();if(h.health==='FULL'||h.health==='GOOD')strengths.push({area:'System',detail:h.active+'/'+h.total+' modules active ('+h.health+')'})}
    return strengths.slice(0,3);
  }

  function buildBoardSnapshot(){
    var claims=_claims();var outcomes=_outcomes();
    var active=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var approved=claims.filter(function(c){return c.status==='approved'});
    var overdue=0;
    var aq=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.actionQueue;
    if(aq&&aq.getOverdue)overdue=aq.getOverdue().length;
    else if(aq&&aq.getAll){var all=aq.getAll();overdue=all.filter(function(a){return a.status==='overdue'}).length}
    var successRate=0;
    if(outcomes.length>0)successRate=Math.round((outcomes.filter(function(o){return o.result==='success'}).length/outcomes.length)*100);
    var opScore=0;
    var ob=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.operatorBoard;
    if(ob&&ob.getData)opScore=ob.getData().weightedScore||0;
    var eco=window.LIMENExecution.phase7.economyBoard;
    var pipeline=0,realized=0;
    if(eco){var bd=eco.getEconomyBoardData();pipeline=bd.estimatedGrossPipeline;realized=bd.realizedValue}
    var portfolioWatch=0;
    var pf=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;
    if(pf&&pf.getSummary){var ps=pf.getSummary();portfolioWatch=ps.watchCount||ps.total||0}
    var disputes=0;
    var disp=window.LIMENExecution.phase7.disputes;
    if(disp)disputes=disp.getOpenDisputeCount();
    var integ=window.LIMENExecution.phase7.integrity;
    var systemStatus='UNKNOWN';
    if(integ){var ir=integ.runIntegrityCheck();systemStatus=ir.status}

    return{
      activeClaims:active.length,
      pendingApprovals:approved.length,
      overdueActions:overdue,
      successRate:successRate+'%',
      weightedOperatorScore:opScore,
      estimatedPipeline:pipeline,
      realizedValue:realized,
      portfolioWatch:portfolioWatch,
      openDisputes:disputes,
      systemStatus:systemStatus,
      topBlockers:getTopBlockers(),
      topStrengths:getTopStrengths(),
      generatedAt:Date.now()
    };
  }

  function getBoardSummary(){
    var snap=buildBoardSnapshot();
    return{
      headline:snap.systemStatus==='HEALTHY'?'System operating normally':snap.systemStatus==='DEGRADED'?'System degraded — review blockers':'System needs attention',
      activeClaims:snap.activeClaims,
      successRate:snap.successRate,
      pipeline:'$'+snap.estimatedPipeline.toLocaleString(),
      realized:'$'+snap.realizedValue.toLocaleString(),
      disputes:snap.openDisputes,
      status:snap.systemStatus
    };
  }

  window.LIMENExecution.phase7.snapshot={
    buildBoardSnapshot:buildBoardSnapshot,
    getTopBlockers:getTopBlockers,
    getTopStrengths:getTopStrengths,
    getBoardSummary:getBoardSummary
  };
})();
