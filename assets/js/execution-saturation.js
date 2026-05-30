/**
 * execution-saturation.js — Strategic Saturation Analysis
 * Detects concentration and over-commitment.
 * Exposes: window.LIMENExecution.phase9.saturation
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase9=window.LIMENExecution.phase9||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}

  function _hhi(map){
    var total=0;for(var k in map)total+=map[k];
    if(total===0)return{hhi:0,dominant:null};
    var hhi=0;var dom=null,maxV=0;
    for(var j in map){var s=map[j]/total;hhi+=s*s;if(map[j]>maxV){maxV=map[j];dom=j}}
    return{hhi:Math.round(hhi*10000),dominant:dom};
  }

  function _satLabel(hhi){
    if(hhi<2500)return'BALANCED';
    if(hhi<5000)return'CONCENTRATED';
    if(hhi<7500)return'SATURATED';
    return'OVEREXPOSED';
  }

  function getDomainSaturation(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var map={};for(var i=0;i<claims.length;i++){var d=claims[i].domain||'unknown';map[d]=(map[d]||0)+1}
    var h=_hhi(map);return{distribution:map,hhi:h.hhi,dominant:h.dominant,label:_satLabel(h.hhi)};
  }

  function getTypeSaturation(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var map={};for(var i=0;i<claims.length;i++){var t=(claims[i].type||claims[i].path||'unknown').toUpperCase();map[t]=(map[t]||0)+1}
    var h=_hhi(map);return{distribution:map,hhi:h.hhi,dominant:h.dominant,label:_satLabel(h.hhi)};
  }

  function getFamilySaturation(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var fm=window.LIMENExecution.phase7&&window.LIMENExecution.phase7.familyMemory;
    var map={};
    for(var i=0;i<claims.length;i++){
      var fam=fm?fm.inferOpportunityFamily(claims[i]).family:'unknown';
      map[fam]=(map[fam]||0)+1;
    }
    var h=_hhi(map);return{distribution:map,hhi:h.hhi,dominant:h.dominant,label:_satLabel(h.hhi)};
  }

  function getOperatorSaturation(){
    var claims=_claims().filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var totalValue=0;var byType={};
    for(var i=0;i<claims.length;i++){
      var val=parseFloat(claims[i].estimatedValue)||0;
      totalValue+=val;
      var t=(claims[i].type||claims[i].path||'unknown').toUpperCase();
      byType[t]=(byType[t]||0)+val;
    }
    var h=_hhi(byType);
    return{activeClaims:claims.length,totalProjectedValue:Math.round(totalValue),valueConcentration:h,label:claims.length>20?'OVEREXPOSED':claims.length>10?'SATURATED':claims.length>5?'CONCENTRATED':'BALANCED'};
  }

  function getSaturationWarnings(){
    var warnings=[];
    var dom=getDomainSaturation();if(dom.hhi>=5000)warnings.push({area:'domain',label:dom.label,dominant:dom.dominant,hhi:dom.hhi});
    var typ=getTypeSaturation();if(typ.hhi>=5000)warnings.push({area:'type',label:typ.label,dominant:typ.dominant,hhi:typ.hhi});
    var fam=getFamilySaturation();if(fam.hhi>=5000)warnings.push({area:'family',label:fam.label,dominant:fam.dominant,hhi:fam.hhi});
    var op=getOperatorSaturation();if(op.activeClaims>10)warnings.push({area:'operator',label:op.label,activeClaims:op.activeClaims});
    // CRM concentration
    var crm=_crm();var crmDom={};
    for(var i=0;i<crm.length;i++){var d=crm[i].domain||'unknown';crmDom[d]=(crmDom[d]||0)+1}
    var ch=_hhi(crmDom);if(ch.hhi>=5000)warnings.push({area:'crm',label:_satLabel(ch.hhi),dominant:ch.dominant,hhi:ch.hhi});
    return warnings;
  }

  function getSaturationSnapshot(){
    return{domain:getDomainSaturation(),type:getTypeSaturation(),family:getFamilySaturation(),operator:getOperatorSaturation(),warnings:getSaturationWarnings()};
  }

  window.LIMENExecution.phase9.saturation={getSaturationSnapshot:getSaturationSnapshot,getDomainSaturation:getDomainSaturation,getTypeSaturation:getTypeSaturation,getFamilySaturation:getFamilySaturation,getOperatorSaturation:getOperatorSaturation,getSaturationWarnings:getSaturationWarnings};
})();
