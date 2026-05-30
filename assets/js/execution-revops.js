/**
 * execution-revops.js — Revenue Operations Bridge
 * Connects CRM, pricing, leads, claims, outcomes, payouts, portfolio into one view.
 * Exposes: window.LIMENExecution.phase11.revops
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _leads(){try{return JSON.parse(localStorage.getItem('LIMEN_PORTAL_LEADS'))||[]}catch(e){return[]}}

  function getRevenuePipeline(){
    var claims=_claims().filter(function(c){return c.status!=='rejected'});
    var pipeline=0,realized=0,opPay=0,platRetained=0;
    for(var i=0;i<claims.length;i++){
      var val=parseFloat(claims[i].estimatedValue)||0;
      var share=parseFloat(claims[i].operatorSharePct)||10;
      if(claims[i].status==='closed'){realized+=val}else{pipeline+=val}
      opPay+=val*(share/100);platRetained+=val*(1-share/100);
    }
    return{pipeline:Math.round(pipeline),realized:Math.round(realized),operatorPayout:Math.round(opPay),platformRetained:Math.round(platRetained)};
  }

  function getExecutionRevenueBridge(){
    var crm=_crm();var claims=_claims();
    var wonUnlinked=0,wonLinked=0;
    for(var i=0;i<crm.length;i++){
      if(crm[i].stage==='won'){
        var linked=false;
        for(var j=0;j<claims.length;j++){if(claims[j].domain===crm[i].domain&&claims[j].status!=='rejected'){linked=true;break}}
        if(linked)wonLinked++;else wonUnlinked++;
      }
    }
    return{wonTotal:wonLinked+wonUnlinked,wonLinked:wonLinked,wonUnlinked:wonUnlinked};
  }

  function getLeadToRevenueMap(){
    var leads=_leads();var crm=_crm();var claims=_claims();
    return{totalLeads:leads.length,totalCRM:crm.length,totalClaims:claims.filter(function(c){return c.status!=='rejected'}).length,wonCRM:crm.filter(function(c){return c.stage==='won'}).length,closedClaims:claims.filter(function(c){return c.status==='closed'}).length};
  }

  function getRevOpsRisks(){
    var risks=[];
    var bridge=getExecutionRevenueBridge();
    if(bridge.wonUnlinked>0)risks.push({type:'won_unlinked',detail:bridge.wonUnlinked+' won CRM records not linked to execution',severity:'elevated'});
    var pipeline=getRevenuePipeline();
    if(pipeline.pipeline>0&&pipeline.realized===0)risks.push({type:'no_realized',detail:'Pipeline exists but nothing realized yet',severity:'moderate'});
    var claims=_claims().filter(function(c){return c.status==='approved'});
    var outcomes=_outcomes();
    var stalled=0;
    for(var i=0;i<claims.length;i++){var has=false;for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===claims[i].id){has=true;break}}if(!has)stalled++}
    if(stalled>0)risks.push({type:'stalled_execution',detail:stalled+' approved claims without outcomes',severity:'elevated'});
    return risks;
  }

  function getRevOpsSnapshot(){
    return{pipeline:getRevenuePipeline(),bridge:getExecutionRevenueBridge(),leadMap:getLeadToRevenueMap(),risks:getRevOpsRisks()};
  }

  window.LIMENExecution.phase11.revops={getRevOpsSnapshot:getRevOpsSnapshot,getRevenuePipeline:getRevenuePipeline,getExecutionRevenueBridge:getExecutionRevenueBridge,getLeadToRevenueMap:getLeadToRevenueMap,getRevOpsRisks:getRevOpsRisks};
})();
