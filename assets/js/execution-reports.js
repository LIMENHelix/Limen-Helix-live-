/**
 * execution-reports.js — Global Reporting Shell
 * Builds execution system health report from all modules.
 * Exposes: window.LIMENExecution.phase6.reports
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function buildReport(){
    var sections=[];
    var l=window.LIMENClaimLedger;if(l){var s=l.getStats();sections.push({title:'Claims',data:{total:s.total,claimed:s.claimed,approved:s.approved,rejected:s.rejected,closed:s.closed}})}
    var app=window.LIMENExecution.phase6.approvals;if(app)sections.push({title:'Approvals',data:{queue:app.getApprovalQueue().length,blocked:app.getApprovalBlockers().length,awaiting:app.getClaimsAwaitingDecision().length,rejected:app.getRejectedClaimsNeedingAction().length}});
    var o=window.LIMENExecution.outcomes;if(o){var all=o.getAllOutcomes();sections.push({title:'Outcomes',data:{total:all.length,success:all.filter(function(x){return x.result==='success'}).length,partial:all.filter(function(x){return x.result==='partial'}).length,fail:all.filter(function(x){return x.result==='fail'}).length}})}
    var em=window.LIMENExecution.phase6.economicMemory;if(em)sections.push({title:'Economic Memory',data:em.getTotals()});
    var ob=window.LIMENExecution.phase6.operatorBoard;if(ob){var d=ob.getData();sections.push({title:'Operator',data:{closed:d.totalClosed,successRate:d.successRate+'%',score:d.weightedScore,trend:ob.getTrend()}})}
    var crm=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;if(crm)sections.push({title:'Pipeline',data:crm.getValueTotals()});
    var pf=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;if(pf)sections.push({title:'Portfolio',data:pf.getSummary()});
    var esc=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation;if(esc)sections.push({title:'Escalations',data:esc.getSeverityCounts()});
    var lin=window.LIMENExecution.phase6.lineage;if(lin)sections.push({title:'Lineage',data:lin.getSummary()});
    var pa=window.LIMENExecution.phase6.policyAudit;if(pa)sections.push({title:'Audit',data:{policyVersion:pa.getPolicyVersion(),events:pa.getAuditTrail().length}});
    var reg=window.LIMENExecution.phase6.registry;if(reg)sections.push({title:'Modules',data:reg.getModuleHealth()});
    var p7=window.LIMENExecution.phase7;
    if(p7&&p7.snapshot){var snap=p7.snapshot.getBoardSummary();sections.push({title:'Board Snapshot',data:snap})}
    if(p7&&p7.economyBoard){var eco=p7.economyBoard.getEconomyBoardData();sections.push({title:'Economy Board',data:{activeClaims:eco.activeClaims,pipeline:eco.estimatedGrossPipeline,realized:eco.realizedValue,concentration:eco.concentrationRisk}})}
    if(p7&&p7.disputes){var dc=p7.disputes.getSeverityCounts();sections.push({title:'Disputes',data:dc})}
    if(p7&&p7.integrity){var ir=p7.integrity.getInitializationHealth();sections.push({title:'Integrity',data:{present:ir.present,total:ir.total,pct:ir.pct+'%'}})}
    if(p7&&p7.coherence){sections.push({title:'Coherence',data:{score:p7.coherence.getCoherenceScore(),issues:p7.coherence.getCoherenceIssues().length}})}
    var p8=window.LIMENExecution.phase8;
    if(p8&&p8.strategicMemory){var sm=p8.strategicMemory.getStrategicMemorySummary();sections.push({title:'Strategic Memory',data:sm})}
    if(p8&&p8.revenue){var rv=p8.revenue.getRevenueSnapshot();sections.push({title:'Revenue Intelligence',data:{projectedGross:rv.projectedGross,realizedGross:rv.realizedGross,projectedOpPayout:rv.projectedOperatorPayout,projectedPlatformRetained:rv.projectedPlatformRetained,trend:p8.revenue.getRevenueTrend().label}})}
    if(p8&&p8.operatorPathways){var op=p8.operatorPathways.getOperatorPathwaySnapshot();sections.push({title:'Operator Pathways',data:{strongestLane:op.strongestLane.type+' ('+op.strongestLane.label+')',weakestLane:op.weakestLane.type+' ('+op.weakestLane.label+')',avgCreateToApproval:op.lags.avgCreateToApproval+'d'}})}
    if(p8&&p8.bottlenecks){var bn=p8.bottlenecks.getTopBottlenecks();sections.push({title:'Approval Bottlenecks',data:{total:bn.length,top3:bn.slice(0,3).map(function(b){return b.type+': '+b.title})}})}
    if(p8&&p8.cohorts){var best=p8.cohorts.getBestCohorts('type');var worst=p8.cohorts.getWorstCohorts('type');sections.push({title:'Claim Cohorts',data:{bestType:best.length>0?best[0].cohort:'NONE',worstType:worst.length>0?worst[0].cohort:'NONE'}})}
    if(p8&&p8.portfolioMonetization){var pm=p8.portfolioMonetization.getValueLinkedToPortfolio();sections.push({title:'Portfolio Monetization',data:{linkedClaims:pm.linkedClaims,estimatedGross:pm.estimatedGross,operatorPayout:pm.estimatedOperatorPayout}})}
    if(p8&&p8.crmConversion){var cc=p8.crmConversion.getCRMConversionSnapshot();sections.push({title:'CRM Conversion',data:{leadToQualified:cc.leadToQualified.rate+'%',qualifiedToWon:cc.qualifiedToWon.rate+'%',wonToExecution:cc.wonToExecution.rate+'%'}})}
    if(p8&&p8.thresholds){var tw=p8.thresholds.getThresholdWarnings();sections.push({title:'Governance Thresholds',data:{status:p8.thresholds.getThresholdStatus(),warnings:tw.length,details:tw.slice(0,3).map(function(w){return w.threshold+': '+w.status})}})}
    if(p8&&p8.policyPropagation){var pp=p8.policyPropagation.getPolicyChangeSummary();sections.push({title:'Policy Propagation',data:{policyTypes:pp.length,totalDependencies:pp.reduce(function(a,b){return a+b.modulesAffected+b.pagesAffected},0)}})}
    var p9=window.LIMENExecution.phase9;
    if(p9&&p9.selfAudit){try{var sa=p9.selfAudit.runSelfAudit();sections.push({title:'Self-Audit',data:{score:sa.score,status:sa.status,findings:sa.findings.length,critical:sa.criticalFindings.length}})}catch(e){}}
    if(p9&&p9.decisionMemory){try{var dm=p9.decisionMemory.getDecisionSummary();sections.push({title:'Decision Memory',data:{totalEvents:dm.totalEvents}})}catch(e){}}
    if(p9&&p9.resilience){try{sections.push({title:'Resilience',data:{status:p9.resilience.getResilienceStatus(),risks:p9.resilience.getResilienceSnapshot().totalRisks}})}catch(e){}}
    if(p9&&p9.drift){try{sections.push({title:'Execution Drift',data:{score:p9.drift.getDriftScore(),findings:p9.drift.getDriftFindings().length}})}catch(e){}}
    if(p9&&p9.policyCompliance){try{var pc=p9.policyCompliance.getPolicyComplianceSnapshot();sections.push({title:'Policy Compliance',data:{score:pc.score,status:pc.status,gaps:pc.totalGaps}})}catch(e){}}
    if(p9&&p9.exceptionPressure){try{sections.push({title:'Exception Pressure',data:{status:p9.exceptionPressure.getPressureStatus(),drivers:p9.exceptionPressure.getPressureDrivers().length}})}catch(e){}}
    if(p9&&p9.repairQueue){try{sections.push({title:'Repair Queue',data:{open:p9.repairQueue.getOpenRepairs().length}})}catch(e){}}
    if(p9&&p9.saturation){try{var sat=p9.saturation.getSaturationSnapshot();sections.push({title:'Saturation',data:{domain:sat.domain.label,type:sat.type.label,warnings:sat.warnings.length}})}catch(e){}}
    if(p9&&p9.digest){try{var dig=p9.digest.getDigestSummary();sections.push({title:'Operating Digest',data:dig})}catch(e){}}
    var p10=window.LIMENExecution.phase10;
    if(p10&&p10.recommendations){try{var ra=p10.recommendations.getTopRecommendedActions(5);sections.push({title:'Recommended Actions',data:{total:ra.length,top3:ra.slice(0,3).map(function(a){return a.title+' ('+a.riskLevel+')'})}})}catch(e){}}
    if(p10&&p10.nextAction){try{var nba=p10.nextAction.explainNextBestAction();sections.push({title:'Next Best Action',data:{action:nba.action?nba.action.title:'None',explanation:nba.explanation}})}catch(e){}}
    if(p10&&p10.decisionSynthesis){try{var db=p10.decisionSynthesis.getDecisionBuckets();sections.push({title:'Decision Synthesis',data:{executeNow:db['EXECUTE NOW'].length,reviewToday:db['REVIEW TODAY'].length,blocked:db['BLOCKED'].length,watch:db['WATCH'].length,defer:db['DEFER'].length}})}catch(e){}}
    if(p10&&p10.readiness){try{sections.push({title:'Action Readiness',data:{readyNow:p10.readiness.getActionsReadyNow().length}})}catch(e){}}
    if(p10&&p10.guided){try{var gs=p10.guided.getSequenceHistory();var active=p10.guided.getActiveSequence();sections.push({title:'Guided Sequences',data:{total:gs.length,active:active?active.playbookType:'none'}})}catch(e){}}
    if(p10&&p10.drafts){try{sections.push({title:'Draft Actions',data:{pending:p10.drafts.getDraftActions().length}})}catch(e){}}
    if(p10&&p10.confirmation){try{sections.push({title:'Human Confirmation',data:{pending:p10.confirmation.getPendingConfirmations().length}})}catch(e){}}
    var p11=window.LIMENExecution.phase11;
    if(p11&&p11.onboarding){try{var obs=p11.onboarding.getOnboardingStatus();sections.push({title:'Operator Onboarding',data:{status:obs.status,complete:obs.complete}})}catch(e){}}
    if(p11&&p11.liveReadiness){try{var lrs=p11.liveReadiness.getLiveReadinessStatus();sections.push({title:'Live Execution Readiness',data:lrs})}catch(e){}}
    if(p11&&p11.integrations){try{var ints=p11.integrations.getAvailableIntegrations();sections.push({title:'Integration Readiness',data:{available:ints.length}})}catch(e){}}
    if(p11&&p11.checkpoints){try{var cps=p11.checkpoints.getCheckpointSummary();sections.push({title:'Checkpoint Compliance',data:cps})}catch(e){}}
    if(p11&&p11.commercial){try{var cms=p11.commercial.getCommercialSnapshot();sections.push({title:'Commercialization',data:{streams:cms.totalStreams,blockers:cms.blockers.length}})}catch(e){}}
    if(p11&&p11.intake){try{var inr=p11.intake.getIntakeRecords();sections.push({title:'Intake Summary',data:{total:inr.length,new:inr.filter(function(r){return r.status==='new'}).length}})}catch(e){}}
    if(p11&&p11.revops){try{var rvs=p11.revops.getRevenuePipeline();sections.push({title:'Revenue Ops',data:{pipeline:rvs.pipeline,realized:rvs.realized}})}catch(e){}}
    if(p11&&p11.payoutOps){try{var pos=p11.payoutOps.getPayoutSummary();sections.push({title:'Payout Operations',data:pos})}catch(e){}}
    if(p11&&p11.deployment){try{var dep=p11.deployment.runDeploymentReadinessCheck();sections.push({title:'Deployment Readiness',data:{score:dep.score,status:dep.status,blockers:dep.criticalBlockers.length}})}catch(e){}}
    return{sections:sections,generatedAt:Date.now()}
  }
  function getSections(){return buildReport().sections}
  function exportData(){return JSON.stringify(buildReport(),null,2)}
  window.LIMENExecution.phase6.reports={buildReport:buildReport,getSections:getSections,exportData:exportData};
})();
