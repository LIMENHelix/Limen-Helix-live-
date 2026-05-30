/**
 * execution-disputes.js — Dispute and Exception Workflow Shell
 * Handles claims/outcomes needing manual review or special handling.
 * Storage: LIMEN_EXECUTION_DISPUTES
 * Exposes: window.LIMENExecution.phase7.disputes
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};
  var SK='LIMEN_EXECUTION_DISPUTES';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function createDispute(payload){
    var disputes=_load();
    var d={
      id:'DISP-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      relatedType:payload.relatedType||'claim',
      relatedId:payload.relatedId||'',
      domain:payload.domain||'',
      claimId:payload.claimId||'',
      title:payload.title||'Untitled dispute',
      disputeType:payload.disputeType||'other',
      status:'open',
      severity:payload.severity||'moderate',
      openedAt:Date.now(),
      resolvedAt:null,
      summary:payload.summary||'',
      notes:[]
    };
    disputes.push(d);_save(disputes);return d;
  }

  function getDisputes(){return _load()}
  function getDisputesByStatus(status){return _load().filter(function(d){return d.status===status})}
  function getDisputesByDomain(domain){return _load().filter(function(d){return d.domain===domain})}

  function resolveDispute(id,notes){
    var disputes=_load();
    for(var i=0;i<disputes.length;i++){
      if(disputes[i].id===id){
        disputes[i].status='resolved';
        disputes[i].resolvedAt=Date.now();
        if(notes)disputes[i].notes.push({ts:Date.now(),text:notes,action:'resolved'});
        _save(disputes);return disputes[i];
      }
    }
    return null;
  }

  function rejectDispute(id,notes){
    var disputes=_load();
    for(var i=0;i<disputes.length;i++){
      if(disputes[i].id===id){
        disputes[i].status='rejected';
        disputes[i].resolvedAt=Date.now();
        if(notes)disputes[i].notes.push({ts:Date.now(),text:notes,action:'rejected'});
        _save(disputes);return disputes[i];
      }
    }
    return null;
  }

  function reviewDispute(id,notes){
    var disputes=_load();
    for(var i=0;i<disputes.length;i++){
      if(disputes[i].id===id){
        disputes[i].status='under_review';
        if(notes)disputes[i].notes.push({ts:Date.now(),text:notes,action:'under_review'});
        _save(disputes);return disputes[i];
      }
    }
    return null;
  }

  function getOpenDisputeCount(){return _load().filter(function(d){return d.status==='open'||d.status==='under_review'}).length}

  function getSeverityCounts(){
    var disputes=_load().filter(function(d){return d.status!=='resolved'&&d.status!=='rejected'});
    var counts={low:0,moderate:0,elevated:0,critical:0};
    for(var i=0;i<disputes.length;i++){var s=disputes[i].severity;if(counts.hasOwnProperty(s))counts[s]++}
    return counts;
  }

  window.LIMENExecution.phase7.disputes={
    createDispute:createDispute,
    getDisputes:getDisputes,
    getDisputesByStatus:getDisputesByStatus,
    getDisputesByDomain:getDisputesByDomain,
    resolveDispute:resolveDispute,
    rejectDispute:rejectDispute,
    reviewDispute:reviewDispute,
    getOpenDisputeCount:getOpenDisputeCount,
    getSeverityCounts:getSeverityCounts
  };
})();
