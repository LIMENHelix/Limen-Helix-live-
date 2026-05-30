(function(){'use strict';window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};
function audit(){var issues=[];var l=window.LIMENClaimLedger,o=window.LIMENExecution.outcomes;
var claims=l?l.getAllClaims():[];var outcomes=o?o.getAllOutcomes():[];
for(var i=0;i<claims.length;i++){var c=claims[i];if(c.status==='closed'&&!(o&&o.hasOutcomeForClaim(c.id)))issues.push({severity:'moderate',type:'closed_no_outcome',detail:'Claim closed without outcome: '+c.title,entityId:c.id});if(!c.agreementAccepted&&c.status!=='closed')issues.push({severity:'low',type:'no_agreement',detail:'Active claim missing agreement: '+c.title,entityId:c.id});if(c.status==='approved'&&!c.estimatedOperatorPayout)issues.push({severity:'low',type:'missing_payout_est',detail:'Approved claim missing payout estimate: '+c.title,entityId:c.id})}
for(var j=0;j<outcomes.length;j++){var oc=outcomes[j];if(!oc.claimId)issues.push({severity:'moderate',type:'orphan_outcome',detail:'Outcome without claim link: '+oc.title,entityId:oc.id});if(oc.result==='success'&&!oc.outcomeValue)issues.push({severity:'moderate',type:'success_no_value',detail:'Success outcome missing value: '+oc.title,entityId:oc.id})}
// Check duplicates
var seen={};for(var k=0;k<claims.length;k++){var ck=claims[k];if(ck.status!=='closed'&&ck.status!=='rejected'){var dk=ck.opportunityId+'_'+ck.domain;if(seen[dk])issues.push({severity:'elevated',type:'duplicate_active',detail:'Duplicate active claim: '+ck.title,entityId:ck.id});seen[dk]=true}}
return issues}
function getScore(){var iss=audit();if(iss.length===0)return 100;var penalty=0;for(var i=0;i<iss.length;i++){if(iss[i].severity==='critical')penalty+=20;else if(iss[i].severity==='elevated')penalty+=10;else if(iss[i].severity==='moderate')penalty+=5;else penalty+=2}return Math.max(0,100-penalty)}
function getBroken(){return audit().filter(function(i){return i.severity==='elevated'||i.severity==='critical'})}
window.LIMENExecution.phase7.coherence={runCoherenceAudit:audit,getCoherenceIssues:audit,getCoherenceScore:getScore,getBrokenLinks:getBroken,getObjectsNeedingRepair:getBroken};})();
