/**
 * execution-lineage-graph.js — Portfolio-to-Claim Lineage
 * Traces: opportunity→claim→approval→outcome→payout→portfolio/CRM.
 * Exposes: window.LIMENExecution.phase6.lineage
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function build(){
    var linking=window.LIMENExecution.phase6.entityLinking;if(!linking)return{nodes:[],edges:[],summary:{}};
    var all=linking.buildLinks();var nodes=[],edges=[],oppCount=0,claimCount=0,outcomeCount=0,pfCount=0;
    for(var oid in all){var entry=all[oid];oppCount++;nodes.push({id:oid,type:'opportunity'});
      for(var ci=0;ci<entry.claims.length;ci++){claimCount++;var cid=entry.claims[ci];nodes.push({id:cid,type:'claim'});edges.push({from:oid,to:cid,rel:'claimed'})}
      for(var oi=0;oi<entry.outcomes.length;oi++){outcomeCount++;var ocid=entry.outcomes[oi];nodes.push({id:ocid,type:'outcome'});edges.push({from:entry.claims[0]||oid,to:ocid,rel:'produced'})}
      for(var pi=0;pi<entry.portfolio.length;pi++){pfCount++;var pid=entry.portfolio[pi];nodes.push({id:pid,type:'portfolio'});edges.push({from:entry.claims[0]||oid,to:pid,rel:'created'})}}
    return{nodes:nodes,edges:edges,summary:{opportunities:oppCount,claims:claimCount,outcomes:outcomeCount,portfolioItems:pfCount}}
  }
  function getNode(id,type){var g=build();for(var i=0;i<g.nodes.length;i++){if(g.nodes[i].id===id&&(!type||g.nodes[i].type===type))return g.nodes[i]}return null}
  function getSummary(){return build().summary}
  window.LIMENExecution.phase6.lineage={buildGraph:build,getNode:getNode,getEdges:function(){return build().edges},getSummary:getSummary};
})();
