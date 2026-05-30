/**
 * execution-entity-linking.js — Opportunity-to-Entity Linking
 * Links opportunities→claims→outcomes→portfolio→CRM.
 * Exposes: window.LIMENExecution.phase6.entityLinking
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  function buildLinks(){
    var links={};var l=window.LIMENClaimLedger,o=window.LIMENExecution.outcomes,pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio,crm=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;
    var claims=l?l.getAllClaims():[];var outcomes=o?o.getAllOutcomes():[];var cos=pf?pf.getAllCompanies():[];var recs=crm?crm.getAll():[];
    for(var i=0;i<claims.length;i++){var c=claims[i];if(!links[c.opportunityId])links[c.opportunityId]={opportunity:c.opportunityId,claims:[],outcomes:[],portfolio:[],crm:[]};links[c.opportunityId].claims.push(c.id)}
    for(var j=0;j<outcomes.length;j++){var oc=outcomes[j];var oid=oc.opportunityId;if(links[oid])links[oid].outcomes.push(oc.id)}
    for(var k=0;k<cos.length;k++){if(cos[k].linkedOpportunityId&&links[cos[k].linkedOpportunityId])links[cos[k].linkedOpportunityId].portfolio.push(cos[k].id)}
    for(var m=0;m<recs.length;m++){if(recs[m].linkedLeadId)for(var lid in links){if(links[lid])links[lid].crm.push(recs[m].id)}}
    return links
  }
  function getForOpp(oppId){var all=buildLinks();return all[oppId]||{opportunity:oppId,claims:[],outcomes:[],portfolio:[],crm:[]}}
  function getClaimLineage(claimId){var l=window.LIMENClaimLedger;if(!l)return null;var c=l.getClaimById(claimId);if(!c)return null;var o=window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getOutcomeByClaimId(claimId):null;return{claim:c,outcome:o,opportunityId:c.opportunityId}}
  window.LIMENExecution.phase6.entityLinking={buildLinks:buildLinks,getLinkedObjectsForOpportunity:getForOpp,getClaimLineage:getClaimLineage};
})();
