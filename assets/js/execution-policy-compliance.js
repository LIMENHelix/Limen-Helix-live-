/**
 * execution-policy-compliance.js — Policy Compliance Visibility
 * Shows how well live execution activity matches stated policy/procedure.
 * Exposes: window.LIMENExecution.phase9.policyCompliance
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}

  function getComplianceGaps(){
    var claims=_claims(),outcomes=_outcomes(),disputes=_disputes();
    var gaps=[];

    // Claims missing agreement
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      if(c.status!=='closed'&&c.status!=='rejected'&&!c.agreementAccepted)
        gaps.push({type:'missing_agreement',entityType:'claim',entityId:c.id,title:c.title,severity:'moderate'});
    }

    // Approvals missing checklist
    var auth=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.approval;
    if(auth&&auth.getChecklistForType){
      for(var j=0;j<claims.length;j++){
        if(claims[j].status==='approved'||claims[j].status==='in_review'){
          var cl=auth.getChecklistForType(claims[j].type||'grant');
          if(cl&&!claims[j].checklistCompleted)
            gaps.push({type:'missing_checklist',entityType:'claim',entityId:claims[j].id,title:claims[j].title,severity:'low'});
        }
      }
    }

    // Outcomes missing closeout notes
    for(var k=0;k<outcomes.length;k++){
      if(!outcomes[k].closeoutNotes&&!outcomes[k].notes)
        gaps.push({type:'missing_closeout_notes',entityType:'outcome',entityId:outcomes[k].id,title:outcomes[k].title||'Outcome',severity:'low'});
    }

    // Payouts missing outcome basis
    for(var m=0;m<claims.length;m++){
      if(claims[m].status==='closed'&&claims[m].estimatedOperatorPayout){
        var hasO=false;for(var n=0;n<outcomes.length;n++){if(outcomes[n].claimId===claims[m].id){hasO=true;break}}
        if(!hasO)gaps.push({type:'payout_without_outcome',entityType:'claim',entityId:claims[m].id,title:claims[m].title,severity:'elevated'});
      }
    }

    // Disputes missing resolution notes
    for(var p=0;p<disputes.length;p++){
      if(disputes[p].status==='resolved'&&(!disputes[p].notes||disputes[p].notes.length===0))
        gaps.push({type:'dispute_missing_notes',entityType:'dispute',entityId:disputes[p].id,title:disputes[p].title,severity:'low'});
    }

    return gaps;
  }

  function getComplianceScore(){
    var gaps=getComplianceGaps();
    if(gaps.length===0)return 100;
    var pen=0;
    for(var i=0;i<gaps.length;i++){pen+=gaps[i].severity==='critical'?15:gaps[i].severity==='elevated'?8:gaps[i].severity==='moderate'?4:2}
    return Math.max(0,100-pen);
  }

  function getPolicyComplianceSnapshot(){
    var gaps=getComplianceGaps();var score=getComplianceScore();
    var status=score>=80?'COMPLIANT':score>=50?'PARTIAL':'NON-COMPLIANT';
    return{score:score,status:status,totalGaps:gaps.length,gaps:gaps};
  }

  function getClaimsMissingRequiredPolicyState(){
    return getComplianceGaps().filter(function(g){return g.type==='missing_agreement'});
  }

  function getApprovalsMissingChecklistCompliance(){
    return getComplianceGaps().filter(function(g){return g.type==='missing_checklist'});
  }

  window.LIMENExecution.phase9.policyCompliance={getPolicyComplianceSnapshot:getPolicyComplianceSnapshot,getComplianceGaps:getComplianceGaps,getComplianceScore:getComplianceScore,getClaimsMissingRequiredPolicyState:getClaimsMissingRequiredPolicyState,getApprovalsMissingChecklistCompliance:getApprovalsMissingChecklistCompliance};
})();
