/**
 * execution-repair-queue.js — Recovery / Repair Queue
 * Generates specific repair queue from audit, drift, resilience, compliance findings.
 * Storage: LIMEN_EXECUTION_REPAIR_QUEUE
 * Exposes: window.LIMENExecution.phase9.repairQueue
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};
  var SK='LIMEN_EXECUTION_REPAIR_QUEUE';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function rebuildRepairQueue(){
    var queue=_load();
    var existingIds={};for(var x=0;x<queue.length;x++)existingIds[queue[x].entityId+'_'+queue[x].repairType]=true;

    function _add(type,severity,source,entityType,entityId,title,actionLabel){
      var key=entityId+'_'+type;
      if(existingIds[key])return;
      queue.push({id:'RPR-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),repairType:type,severity:severity,source:source,entityType:entityType,entityId:entityId,title:title,actionLabel:actionLabel,createdAt:Date.now(),status:'open',notes:[]});
      existingIds[key]=true;
    }

    // From coherence
    var coh=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.coherence;
    if(coh){var issues=coh.getCoherenceIssues();for(var i=0;i<issues.length;i++){var is=issues[i];_add(is.type,is.severity,'coherence',is.type.indexOf('outcome')!==-1?'outcome':'claim',is.entityId||'',is.detail,'Fix linkage')}}

    // From compliance
    var comp=window.LIMENExecution.phase9.policyCompliance;
    if(comp){var gaps=comp.getComplianceGaps();for(var j=0;j<gaps.length;j++){var g=gaps[j];_add(g.type,g.severity,'compliance',g.entityType,g.entityId,g.title||g.type,'Complete requirement')}}

    // From drift
    var drift=window.LIMENExecution.phase9.drift;
    if(drift){var df=drift.getDriftFindings();for(var k=0;k<df.length;k++){_add(df[k].type,df[k].severity,'drift','system',df[k].type,df[k].detail,'Address drift')}}

    // From bottlenecks
    var bn=window.LIMENExecution.phase8&&window.LIMENExecution.phase8.bottlenecks;
    if(bn){var bns=bn.getTopBottlenecks();for(var m=0;m<bns.length;m++){_add(bns[m].type,bns[m].severity,'bottleneck','claim',bns[m].claimId||'',bns[m].title||bns[m].detail,'Resolve bottleneck')}}

    // Remove resolved items older than 30 days
    var cutoff=Date.now()-30*864e5;
    queue=queue.filter(function(r){return r.status==='open'||(r.resolvedAt&&r.resolvedAt>cutoff)});

    _save(queue);return queue;
  }

  function getRepairQueue(){return _load()}
  function getOpenRepairs(){return _load().filter(function(r){return r.status==='open'})}

  function resolveRepair(id,notes){
    var queue=_load();
    for(var i=0;i<queue.length;i++){
      if(queue[i].id===id){queue[i].status='resolved';queue[i].resolvedAt=Date.now();if(notes)queue[i].notes.push({ts:Date.now(),text:notes});_save(queue);return queue[i]}
    }
    return null;
  }

  function dismissRepair(id,notes){
    var queue=_load();
    for(var i=0;i<queue.length;i++){
      if(queue[i].id===id){queue[i].status='dismissed';queue[i].resolvedAt=Date.now();if(notes)queue[i].notes.push({ts:Date.now(),text:notes});_save(queue);return queue[i]}
    }
    return null;
  }

  function getTopRepairs(limit){
    var open=getOpenRepairs();
    var so={critical:0,elevated:1,moderate:2,low:3};
    open.sort(function(a,b){return(so[a.severity]||3)-(so[b.severity]||3)});
    return open.slice(0,limit||5);
  }

  window.LIMENExecution.phase9.repairQueue={rebuildRepairQueue:rebuildRepairQueue,getRepairQueue:getRepairQueue,getOpenRepairs:getOpenRepairs,resolveRepair:resolveRepair,dismissRepair:dismissRepair,getTopRepairs:getTopRepairs};
})();
