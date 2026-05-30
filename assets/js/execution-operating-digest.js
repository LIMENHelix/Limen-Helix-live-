/**
 * execution-operating-digest.js — Executive Operating Digest
 * Compact executive summary of execution system health.
 * Exposes: window.LIMENExecution.phase9.digest
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _safe(fn,fallback){try{return fn()}catch(e){return fallback}}

  function getTopRisks(){
    var risks=[];
    var p9=window.LIMENExecution.phase9;
    if(p9.drift){var df=p9.drift.getDriftFindings();for(var i=0;i<Math.min(df.length,2);i++)risks.push({source:'drift',detail:df[i].detail,severity:df[i].severity})}
    if(p9.resilience){var spf=p9.resilience.getSinglePointFailures();for(var j=0;j<Math.min(spf.length,2);j++)risks.push({source:'resilience',detail:spf[j].detail,severity:spf[j].severity})}
    if(p9.exceptionPressure){var dr=p9.exceptionPressure.getPressureDrivers();for(var k=0;k<Math.min(dr.length,2);k++)risks.push({source:'pressure',detail:dr[k].source+' ('+dr[k].count+')',severity:dr[k].weight>10?'elevated':'moderate'})}
    if(p9.saturation){var sw=p9.saturation.getSaturationWarnings();for(var m=0;m<Math.min(sw.length,1);m++)risks.push({source:'saturation',detail:sw[m].area+': '+sw[m].label,severity:'moderate'})}
    var so={critical:0,elevated:1,moderate:2,low:3};
    risks.sort(function(a,b){return(so[a.severity]||3)-(so[b.severity]||3)});
    return risks.slice(0,3);
  }

  function getTopRepairs(){
    var rq=window.LIMENExecution.phase9.repairQueue;
    if(!rq)return[];
    return rq.getTopRepairs(3);
  }

  function getTopWins(){
    var wins=[];
    var p7=window.LIMENExecution.phase7;
    if(p7&&p7.snapshot){var s=_safe(function(){return p7.snapshot.getTopStrengths()},[]); wins=wins.concat(s)}
    var p9=window.LIMENExecution.phase9;
    if(p9.policyCompliance){var score=_safe(function(){return p9.policyCompliance.getComplianceScore()},0);if(score>=80)wins.push({area:'Compliance',detail:'Score: '+score+'%'})}
    if(p9.drift){var ds=_safe(function(){return p9.drift.getDriftScore()},0);if(ds>=80)wins.push({area:'Stability',detail:'Drift score: '+ds})}
    return wins.slice(0,3);
  }

  function buildOperatingDigest(){
    var p9=window.LIMENExecution.phase9;
    return{
      selfAudit:_safe(function(){var a=p9.selfAudit.runSelfAudit();return{score:a.score,status:a.status}},{score:0,status:'UNKNOWN'}),
      drift:_safe(function(){return{score:p9.drift.getDriftScore(),findings:p9.drift.getDriftFindings().length}},{score:0,findings:0}),
      compliance:_safe(function(){var c=p9.policyCompliance.getPolicyComplianceSnapshot();return{score:c.score,status:c.status}},{score:0,status:'UNKNOWN'}),
      resilience:_safe(function(){return{status:p9.resilience.getResilienceStatus(),risks:p9.resilience.getResilienceSnapshot().totalRisks}},{status:'UNKNOWN',risks:0}),
      exceptionPressure:_safe(function(){return{status:p9.exceptionPressure.getPressureStatus(),drivers:p9.exceptionPressure.getPressureDrivers().length}},{status:'UNKNOWN',drivers:0}),
      repairQueue:_safe(function(){return{open:p9.repairQueue.getOpenRepairs().length}},{open:0}),
      saturation:_safe(function(){var s=p9.saturation.getSaturationSnapshot();return{domain:s.domain.label,type:s.type.label,warnings:s.warnings.length}},{domain:'UNKNOWN',type:'UNKNOWN',warnings:0}),
      topRisks:getTopRisks(),
      topWins:getTopWins(),
      topRepairs:getTopRepairs(),
      generatedAt:Date.now()
    };
  }

  function getDigestSummary(){
    var d=buildOperatingDigest();
    var overall='HEALTHY';
    if(d.selfAudit.status==='CRITICAL'||d.resilience.status==='HIGHLY FRAGILE'||d.exceptionPressure.status==='OVERLOADED')overall='CRITICAL';
    else if(d.selfAudit.status==='DEGRADED'||d.resilience.status==='FRAGILE'||d.compliance.status==='NON-COMPLIANT')overall='DEGRADED';
    return{overall:overall,auditScore:d.selfAudit.score,driftScore:d.drift.score,complianceScore:d.compliance.score,pressureStatus:d.exceptionPressure.status,resilienceStatus:d.resilience.status,openRepairs:d.repairQueue.open};
  }

  window.LIMENExecution.phase9.digest={buildOperatingDigest:buildOperatingDigest,getTopRisks:getTopRisks,getTopRepairs:getTopRepairs,getTopWins:getTopWins,getDigestSummary:getDigestSummary};
})();
