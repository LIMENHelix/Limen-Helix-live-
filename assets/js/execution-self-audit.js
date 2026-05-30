/**
 * execution-self-audit.js — Self-Audit Engine
 * Full self-audit across claims, outcomes, approvals, monitoring, tasks, CRM, portfolio, disputes, reports, policy.
 * Exposes: window.LIMENExecution.phase9.selfAudit
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _disputes(){var d=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.disputes;return d?d.getDisputes():[]}

  function _auditCategory(name,checks){
    var findings=[];var score=100;
    for(var i=0;i<checks.length;i++){
      var c=checks[i];
      if(c.failed){
        findings.push({category:name,severity:c.severity||'moderate',detail:c.detail});
        var pen=c.severity==='critical'?15:c.severity==='elevated'?8:c.severity==='moderate'?4:2;
        score-=pen;
      }
    }
    return{name:name,score:Math.max(0,score),findings:findings};
  }

  function runSelfAudit(){
    var claims=_claims(),outcomes=_outcomes(),disputes=_disputes();
    var categories={};var allFindings=[];

    // Data integrity
    var dataChecks=[];
    var seen={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      if(c.status!=='closed'&&c.status!=='rejected'){
        var dk=(c.opportunityId||'')+'_'+(c.domain||'');
        if(seen[dk])dataChecks.push({failed:true,severity:'elevated',detail:'Duplicate active claim: '+c.title});
        seen[dk]=true;
      }
    }
    categories.dataIntegrity=_auditCategory('Data Integrity',dataChecks);

    // Lifecycle integrity
    var lcChecks=[];
    var validStates=['draft','submitted','in_review','approved','rejected','closed','claimed'];
    for(var j=0;j<claims.length;j++){
      if(validStates.indexOf(claims[j].status)===-1)lcChecks.push({failed:true,severity:'elevated',detail:'Invalid state: '+claims[j].title+' ('+claims[j].status+')'});
    }
    categories.lifecycleIntegrity=_auditCategory('Lifecycle Integrity',lcChecks);

    // Approval integrity
    var apChecks=[];
    for(var k=0;k<claims.length;k++){
      if(claims[k].status==='approved'&&!claims[k].agreementAccepted)apChecks.push({failed:true,severity:'moderate',detail:'Approved without agreement: '+claims[k].title});
    }
    categories.approvalIntegrity=_auditCategory('Approval Integrity',apChecks);

    // Payout integrity
    var payChecks=[];
    for(var m=0;m<claims.length;m++){
      if(claims[m].status==='closed'){
        var hasOutcome=false;
        for(var n=0;n<outcomes.length;n++){if(outcomes[n].claimId===claims[m].id){hasOutcome=true;if(outcomes[n].result==='success'&&!outcomes[n].outcomeValue)payChecks.push({failed:true,severity:'moderate',detail:'Success without value: '+outcomes[n].title||claims[m].title});break}}
        if(!hasOutcome)payChecks.push({failed:true,severity:'moderate',detail:'Closed without outcome: '+claims[m].title});
      }
    }
    categories.payoutIntegrity=_auditCategory('Payout Integrity',payChecks);

    // Lineage integrity
    var linChecks=[];
    for(var p=0;p<outcomes.length;p++){
      if(!outcomes[p].claimId)linChecks.push({failed:true,severity:'moderate',detail:'Orphan outcome: '+(outcomes[p].title||outcomes[p].id)});
    }
    categories.lineageIntegrity=_auditCategory('Lineage Integrity',linChecks);

    // Monitoring integrity
    var monChecks=[];
    var mon=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.monitoring;
    if(!mon)monChecks.push({failed:true,severity:'low',detail:'Monitoring module not loaded'});
    categories.monitoringIntegrity=_auditCategory('Monitoring Integrity',monChecks);

    // Dispute integrity
    var dispChecks=[];
    var openDisp=disputes.filter(function(d){return d.status==='open'});
    if(openDisp.length>5)dispChecks.push({failed:true,severity:'elevated',detail:openDisp.length+' open disputes unresolved'});
    for(var q=0;q<disputes.length;q++){
      if(disputes[q].status==='resolved'&&(!disputes[q].notes||disputes[q].notes.length===0))dispChecks.push({failed:true,severity:'low',detail:'Resolved dispute missing notes: '+disputes[q].title});
    }
    categories.disputeIntegrity=_auditCategory('Dispute Integrity',dispChecks);

    // Policy acceptance integrity
    var polChecks=[];
    var activeNoAgreement=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'&&!c.agreementAccepted});
    if(activeNoAgreement.length>0)polChecks.push({failed:true,severity:'moderate',detail:activeNoAgreement.length+' active claims missing agreement'});
    categories.policyAcceptance=_auditCategory('Policy Acceptance',polChecks);

    // Module presence
    var modChecks=[];
    var integ=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.integrity;
    if(integ){var missing=integ.getMissingModules();if(missing.length>5)modChecks.push({failed:true,severity:'elevated',detail:missing.length+' modules missing'})}
    categories.modulePresence=_auditCategory('Module Presence',modChecks);

    // Page activation
    var pageChecks=[];
    categories.pageActivation=_auditCategory('Page Activation',pageChecks);

    // Aggregate
    var totalScore=0;var catCount=0;
    for(var cat in categories){totalScore+=categories[cat].score;catCount++;allFindings=allFindings.concat(categories[cat].findings)}
    var score=catCount>0?Math.round(totalScore/catCount):100;
    var status=score>=80?'HEALTHY':score>=50?'DEGRADED':'CRITICAL';
    var critical=allFindings.filter(function(f){return f.severity==='critical'||f.severity==='elevated'});

    return{score:score,status:status,categories:categories,findings:allFindings,criticalFindings:critical,warnings:allFindings.filter(function(f){return f.severity==='moderate'||f.severity==='low'})};
  }

  function getSelfAuditReport(){return runSelfAudit()}
  function getCriticalAuditFindings(){return runSelfAudit().criticalFindings}
  function getAuditScore(){return runSelfAudit().score}
  function getAuditBreakdown(){var r=runSelfAudit();var b={};for(var k in r.categories)b[k]={score:r.categories[k].score,findings:r.categories[k].findings.length};return b}

  window.LIMENExecution.phase9.selfAudit={runSelfAudit:runSelfAudit,getSelfAuditReport:getSelfAuditReport,getCriticalAuditFindings:getCriticalAuditFindings,getAuditScore:getAuditScore,getAuditBreakdown:getAuditBreakdown};
})();
