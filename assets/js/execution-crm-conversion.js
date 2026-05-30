/**
 * execution-crm-conversion.js — CRM-to-Execution Conversion Intelligence
 * Understand how interest turns into execution and value.
 * Exposes: window.LIMENExecution.phase8.crmConversion
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _leads(){try{var s=localStorage.getItem('LIMEN_PORTAL_LEADS');return s?JSON.parse(s):[]}catch(e){return[]}}

  var STAGES=['lead','qualified','proposal','negotiation','won'];

  function _funnelCounts(){
    var crm=_crm(),leads=_leads();
    var counts={lead:0,qualified:0,proposal:0,negotiation:0,won:0};
    for(var i=0;i<crm.length;i++){
      var stage=(crm[i].stage||'lead').toLowerCase();
      if(counts.hasOwnProperty(stage))counts[stage]++;
      // Count all stages at or above current
      var idx=STAGES.indexOf(stage);
      if(idx>=0){for(var j=0;j<idx;j++)counts[STAGES[j]]++}
    }
    counts.lead+=leads.length;
    return counts;
  }

  function getLeadToQualifiedRate(){
    var c=_funnelCounts();
    if(c.lead===0)return{rate:0,label:'NO DATA'};
    return{rate:Math.round((c.qualified/c.lead)*100),label:c.qualified+'/'+c.lead};
  }

  function getQualifiedToWonRate(){
    var c=_funnelCounts();
    if(c.qualified===0)return{rate:0,label:'NO DATA'};
    return{rate:Math.round((c.won/c.qualified)*100),label:c.won+'/'+c.qualified};
  }

  function getWonToExecutionLinkedRate(){
    var crm=_crm(),claims=_claims();
    var wonCount=0,linkedCount=0;
    for(var i=0;i<crm.length;i++){
      if((crm[i].stage||'').toLowerCase()==='won'){
        wonCount++;
        var domain=crm[i].domain||'';
        for(var j=0;j<claims.length;j++){
          if(claims[j].domain===domain&&claims[j].status!=='rejected'){linkedCount++;break}
        }
      }
    }
    if(wonCount===0)return{rate:0,label:'NO DATA'};
    return{rate:Math.round((linkedCount/wonCount)*100),label:linkedCount+'/'+wonCount};
  }

  function getAverageLeadCycleTime(){
    var crm=_crm();var totalDays=0,count=0;
    for(var i=0;i<crm.length;i++){
      var c=crm[i];
      if(c.stage==='won'&&c.createdAt&&c.wonAt){
        totalDays+=Math.round((c.wonAt-c.createdAt)/864e5);count++;
      }
    }
    return count>0?{avgDays:Math.round(totalDays/count),sampleSize:count}:{avgDays:0,sampleSize:0};
  }

  function getHighestConvertingDomains(){
    var crm=_crm();var byDomain={};
    for(var i=0;i<crm.length;i++){
      var d=crm[i].domain||'unknown';
      if(!byDomain[d])byDomain[d]={total:0,won:0};
      byDomain[d].total++;
      if(crm[i].stage==='won')byDomain[d].won++;
    }
    var sorted=[];
    for(var k in byDomain){
      var rate=byDomain[k].total>0?Math.round((byDomain[k].won/byDomain[k].total)*100):0;
      sorted.push({domain:k,conversionRate:rate,total:byDomain[k].total,won:byDomain[k].won});
    }
    sorted.sort(function(a,b){return b.conversionRate-a.conversionRate});
    return sorted.slice(0,5);
  }

  function getCRMConversionSnapshot(){
    return{
      leadToQualified:getLeadToQualifiedRate(),
      qualifiedToWon:getQualifiedToWonRate(),
      wonToExecution:getWonToExecutionLinkedRate(),
      avgLeadCycle:getAverageLeadCycleTime(),
      topDomains:getHighestConvertingDomains()
    };
  }

  window.LIMENExecution.phase8.crmConversion={
    getCRMConversionSnapshot:getCRMConversionSnapshot,
    getLeadToQualifiedRate:getLeadToQualifiedRate,
    getQualifiedToWonRate:getQualifiedToWonRate,
    getWonToExecutionLinkedRate:getWonToExecutionLinkedRate,
    getAverageLeadCycleTime:getAverageLeadCycleTime,
    getHighestConvertingDomains:getHighestConvertingDomains
  };
})();
