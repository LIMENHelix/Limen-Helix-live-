/**
 * execution-recommended-actions.js — Recommended Action Engine
 * Generates recommended actions from opportunities, claims, approvals, monitoring, disputes, CRM, portfolio.
 * Exposes: window.LIMENExecution.phase10.recommendations
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _ageDays(ts){return ts?Math.round((Date.now()-ts)/864e5):0}

  function scoreRecommendedAction(action){
    var s=50;
    if(action.riskLevel==='LOW')s+=10;else if(action.riskLevel==='MODERATE')s+=5;else if(action.riskLevel==='HIGH')s-=5;else if(action.riskLevel==='CRITICAL')s-=15;
    if(action.readinessScore)s+=Math.min(30,action.readinessScore/3);
    if(action.overdueDays&&action.overdueDays>7)s+=10;
    if(action.overdueDays&&action.overdueDays>21)s+=10;
    return Math.max(0,Math.min(100,Math.round(s)));
  }

  function _riskLabel(claim){
    if(!claim)return'LOW';
    var val=parseFloat(claim.estimatedValue)||0;
    if(val>100000)return'HIGH';if(val>10000)return'MODERATE';return'LOW';
  }

  function buildRecommendedActions(){
    var actions=[];var claims=_claims(),outcomes=_outcomes(),disputes=_disputes(),crm=_crm();
    var now=Date.now();

    // Claims blocked but fixable (missing agreement)
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      if(c.status!=='closed'&&c.status!=='rejected'&&!c.agreementAccepted){
        actions.push({id:'REC-agr-'+c.id,domain:c.domain||'',type:(c.type||c.path||'').toUpperCase(),sourceType:'claim',sourceId:c.id,title:'Accept agreement: '+c.title,recommendedAction:'Complete framework agreement acceptance',rationale:'Claim cannot advance without agreement',readinessScore:80,priorityScore:0,riskLevel:'LOW',requiresHumanConfirm:true,createdAt:now});
      }
      // Approvals ready for decision
      if(c.status==='in_review'&&c.agreementAccepted){
        actions.push({id:'REC-apr-'+c.id,domain:c.domain||'',type:(c.type||c.path||'').toUpperCase(),sourceType:'claim',sourceId:c.id,title:'Decision needed: '+c.title,recommendedAction:'Review and approve or reject claim',rationale:'Claim ready for decision (in_review with agreement)',readinessScore:90,priorityScore:0,riskLevel:_riskLabel(c),requiresHumanConfirm:true,createdAt:now});
      }
      // Claims ready for closeout
      if(c.status==='approved'&&_ageDays(c.approvedAt||c.claimedAt)>7){
        var hasO=false;for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===c.id){hasO=true;break}}
        if(!hasO){
          actions.push({id:'REC-cls-'+c.id,domain:c.domain||'',type:(c.type||c.path||'').toUpperCase(),sourceType:'claim',sourceId:c.id,title:'Record outcome: '+c.title,recommendedAction:'Record execution outcome for approved claim',rationale:'Approved '+_ageDays(c.approvedAt||c.claimedAt)+' days ago, no outcome yet',readinessScore:70,priorityScore:0,riskLevel:'MODERATE',requiresHumanConfirm:true,overdueDays:_ageDays(c.approvedAt||c.claimedAt),createdAt:now});
        }
      }
    }

    // Disputes needing review
    for(var k=0;k<disputes.length;k++){
      var dp=disputes[k];
      if(dp.status==='open'){
        actions.push({id:'REC-dsp-'+dp.id,domain:dp.domain||'',type:'DISPUTE',sourceType:'dispute',sourceId:dp.id,title:'Review dispute: '+dp.title,recommendedAction:'Move dispute to under_review or resolve',rationale:'Open dispute awaiting attention',readinessScore:85,priorityScore:0,riskLevel:dp.severity==='critical'?'CRITICAL':dp.severity==='elevated'?'HIGH':'MODERATE',requiresHumanConfirm:true,createdAt:now});
      }
    }

    // CRM records ready to advance
    for(var m=0;m<crm.length;m++){
      var cr=crm[m];
      if(cr.stage==='qualified'||cr.stage==='proposal'){
        actions.push({id:'REC-crm-'+cr.id,domain:cr.domain||'',type:'CRM',sourceType:'crm',sourceId:cr.id,title:'Advance CRM: '+(cr.name||cr.title||cr.id),recommendedAction:'Move to next pipeline stage',rationale:'CRM record at '+cr.stage+' stage',readinessScore:60,priorityScore:0,riskLevel:'LOW',requiresHumanConfirm:true,createdAt:now});
      }
    }

    // Score all
    for(var n=0;n<actions.length;n++){actions[n].priorityScore=scoreRecommendedAction(actions[n])}
    actions.sort(function(a,b){return b.priorityScore-a.priorityScore});
    return actions;
  }

  function getRecommendedActions(){return buildRecommendedActions()}
  function getTopRecommendedActions(limit){return buildRecommendedActions().slice(0,limit||5)}
  function getRecommendedActionsByDomain(domain){return buildRecommendedActions().filter(function(a){return a.domain===domain})}
  function getRecommendedActionsByType(type){return buildRecommendedActions().filter(function(a){return a.type===type.toUpperCase()})}

  window.LIMENExecution.phase10.recommendations={buildRecommendedActions:buildRecommendedActions,getRecommendedActions:getRecommendedActions,getTopRecommendedActions:getTopRecommendedActions,getRecommendedActionsByDomain:getRecommendedActionsByDomain,getRecommendedActionsByType:getRecommendedActionsByType,scoreRecommendedAction:scoreRecommendedAction};
})();
