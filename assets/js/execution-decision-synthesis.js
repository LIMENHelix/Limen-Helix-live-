/**
 * execution-decision-synthesis.js — Cross-Queue Decision Prioritization
 * Synthesizes all queues into one decision framework.
 * Exposes: window.LIMENExecution.phase10.decisionSynthesis
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _ageDays(ts){return ts?Math.round((Date.now()-ts)/864e5):0}

  function _bucket(item){
    if(item.riskLevel==='CRITICAL'||item.severity==='critical')return'BLOCKED';
    if(item.readinessScore>=80&&item.riskLevel!=='HIGH')return'EXECUTE NOW';
    if(item.readinessScore>=60||item.overdueDays>7)return'REVIEW TODAY';
    if(item.readinessScore>=40)return'WATCH';
    return'DEFER';
  }

  function buildDecisionQueue(){
    var queue=[];

    // Recommended actions
    var rec=window.LIMENExecution.phase10.recommendations;
    if(rec){var actions=rec.buildRecommendedActions();for(var i=0;i<actions.length;i++){var a=actions[i];queue.push({id:a.id,source:'recommendation',title:a.title,domain:a.domain,type:a.type,readinessScore:a.readinessScore,priorityScore:a.priorityScore,riskLevel:a.riskLevel,bucket:_bucket(a),sourceRef:a})}}

    // Action queue items
    var aq=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.actionQueue;
    if(aq&&aq.getAll){var items=aq.getAll();for(var j=0;j<items.length;j++){var it=items[j];if(it.status==='open'||it.status==='overdue'){queue.push({id:'AQ-'+it.id,source:'actionQueue',title:it.title||it.action||'Action item',domain:it.domain||'',type:it.type||'',readinessScore:it.status==='overdue'?90:60,priorityScore:it.status==='overdue'?85:50,riskLevel:'MODERATE',bucket:it.status==='overdue'?'EXECUTE NOW':'REVIEW TODAY',sourceRef:it})}}}

    // Repair queue items
    var rq=window.LIMENExecution.phase9&&window.LIMENExecution.phase9.repairQueue;
    if(rq){var repairs=rq.getOpenRepairs();for(var k=0;k<repairs.length;k++){var r=repairs[k];queue.push({id:'RPR-'+r.id,source:'repairQueue',title:r.title,domain:'',type:r.repairType,readinessScore:70,priorityScore:r.severity==='critical'?90:r.severity==='elevated'?75:60,riskLevel:r.severity==='critical'?'CRITICAL':r.severity==='elevated'?'HIGH':'MODERATE',bucket:r.severity==='critical'?'BLOCKED':r.severity==='elevated'?'REVIEW TODAY':'WATCH',sourceRef:r})}}

    // Disputes
    var disp=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;
    if(disp){var open=disp.getDisputesByStatus('open');for(var m=0;m<open.length;m++){var dp=open[m];queue.push({id:'DSP-'+dp.id,source:'dispute',title:dp.title,domain:dp.domain||'',type:'DISPUTE',readinessScore:80,priorityScore:dp.severity==='critical'?95:dp.severity==='elevated'?80:65,riskLevel:dp.severity==='critical'?'CRITICAL':'HIGH',bucket:dp.severity==='critical'?'BLOCKED':'REVIEW TODAY',sourceRef:dp})}}

    queue.sort(function(a,b){return b.priorityScore-a.priorityScore});
    return queue;
  }

  function getDecisionQueue(){return buildDecisionQueue()}

  function getDecisionBuckets(){
    var q=buildDecisionQueue();
    var buckets={'EXECUTE NOW':[],'REVIEW TODAY':[],'BLOCKED':[],'WATCH':[],'DEFER':[]};
    for(var i=0;i<q.length;i++){var b=q[i].bucket;if(buckets[b])buckets[b].push(q[i])}
    return buckets;
  }

  function getHighestLeverageDecisions(limit){
    return buildDecisionQueue().filter(function(d){return d.bucket==='EXECUTE NOW'||d.bucket==='REVIEW TODAY'}).slice(0,limit||5);
  }

  function getHighestRiskDecisions(limit){
    return buildDecisionQueue().filter(function(d){return d.riskLevel==='CRITICAL'||d.riskLevel==='HIGH'}).slice(0,limit||5);
  }

  window.LIMENExecution.phase10.decisionSynthesis={buildDecisionQueue:buildDecisionQueue,getDecisionQueue:getDecisionQueue,getDecisionBuckets:getDecisionBuckets,getHighestLeverageDecisions:getHighestLeverageDecisions,getHighestRiskDecisions:getHighestRiskDecisions};
})();
