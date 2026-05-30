/**
 * execution-exception-pressure.js — Exception Pressure Analysis
 * Measures how much exception/dispute/escalation pressure the system is under.
 * Exposes: window.LIMENExecution.phase9.exceptionPressure
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}
  function _ageDays(ts){return ts?Math.round((Date.now()-ts)/864e5):0}

  function _computePressure(){
    var claims=_claims(),outcomes=_outcomes(),disputes=_disputes();
    var pressure=0;var drivers=[];

    // Open disputes
    var openDisp=disputes.filter(function(d){return d.status==='open'||d.status==='under_review'});
    pressure+=openDisp.length*3;
    if(openDisp.length>0)drivers.push({source:'disputes',count:openDisp.length,weight:openDisp.length*3});

    // Escalations
    var esc=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.escalation;
    if(esc&&esc.getActive){var active=esc.getActive();pressure+=active.length*4;if(active.length>0)drivers.push({source:'escalations',count:active.length,weight:active.length*4})}

    // Stale approvals
    var stale=0;
    for(var i=0;i<claims.length;i++){
      if((claims[i].status==='in_review'||claims[i].status==='submitted')&&_ageDays(claims[i].submittedAt||claims[i].claimedAt)>14)stale++;
    }
    pressure+=stale*2;
    if(stale>0)drivers.push({source:'stale_approvals',count:stale,weight:stale*2});

    // Rejected claim loops
    var rejLoops=claims.filter(function(c){return c.rejectionCount&&c.rejectionCount>=2});
    pressure+=rejLoops.length*3;
    if(rejLoops.length>0)drivers.push({source:'rejection_loops',count:rejLoops.length,weight:rejLoops.length*3});

    // Missing outcomes on approved
    var missingOutcome=0;
    for(var j=0;j<claims.length;j++){
      if(claims[j].status==='approved'&&_ageDays(claims[j].approvedAt||claims[j].claimedAt)>21){
        var has=false;for(var k=0;k<outcomes.length;k++){if(outcomes[k].claimId===claims[j].id){has=true;break}}
        if(!has)missingOutcome++;
      }
    }
    pressure+=missingOutcome*2;
    if(missingOutcome>0)drivers.push({source:'missing_outcomes',count:missingOutcome,weight:missingOutcome*2});

    drivers.sort(function(a,b){return b.weight-a.weight});
    return{pressure:pressure,drivers:drivers};
  }

  function getPressureStatus(){
    var p=_computePressure().pressure;
    if(p===0)return'NORMAL';
    if(p<=10)return'ELEVATED';
    if(p<=25)return'HIGH PRESSURE';
    return'OVERLOADED';
  }

  function getPressureByDomain(){
    var claims=_claims();var byDomain={};
    for(var i=0;i<claims.length;i++){
      var d=claims[i].domain||'unknown';
      if(!byDomain[d])byDomain[d]=0;
      if(claims[i].status==='in_review'&&_ageDays(claims[i].claimedAt)>14)byDomain[d]+=2;
      if(claims[i].rejectionCount&&claims[i].rejectionCount>=2)byDomain[d]+=3;
    }
    var disputes=_disputes().filter(function(dp){return dp.status==='open'||dp.status==='under_review'});
    for(var j=0;j<disputes.length;j++){var dd=disputes[j].domain||'unknown';byDomain[dd]=(byDomain[dd]||0)+3}
    return byDomain;
  }

  function getPressureByType(){
    var claims=_claims();var byType={};
    for(var i=0;i<claims.length;i++){
      var t=(claims[i].type||claims[i].path||'unknown').toUpperCase();
      if(!byType[t])byType[t]=0;
      if(claims[i].status==='in_review'&&_ageDays(claims[i].claimedAt)>14)byType[t]+=2;
    }
    return byType;
  }

  function getExceptionPressureSnapshot(){
    var cp=_computePressure();
    return{pressure:cp.pressure,status:getPressureStatus(),drivers:cp.drivers,byDomain:getPressureByDomain(),byType:getPressureByType()};
  }

  function getPressureDrivers(){return _computePressure().drivers}

  window.LIMENExecution.phase9.exceptionPressure={getExceptionPressureSnapshot:getExceptionPressureSnapshot,getPressureByDomain:getPressureByDomain,getPressureByType:getPressureByType,getPressureDrivers:getPressureDrivers,getPressureStatus:getPressureStatus};
})();
