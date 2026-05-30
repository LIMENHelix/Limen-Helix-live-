/**
 * execution-opportunity-aging.js — Stale Decay Layer
 * Display-only aging adjustment. Does NOT alter domain scoring or kernel.
 * Max decay: -0.10. Applied AFTER adaptive score.
 * Exposes: window.LIMENExecution.phase5.aging
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  var STALE_DAYS=21,SOFT_START=14,MAX_DECAY=-0.10;
  function getAgeDays(o){if(!o.validity||!o.validity.createdAt)return 0;return Math.round((Date.now()-o.validity.createdAt)/864e5)}
  function getAging(o){var age=getAgeDays(o);if(age<SOFT_START)return 0;if(age>=STALE_DAYS)return MAX_DECAY;return Math.round(((age-SOFT_START)/(STALE_DAYS-SOFT_START))*MAX_DECAY*1000)/1000}
  function getLabel(o){var age=getAgeDays(o);if(age<=3)return'NEW';if(age<SOFT_START)return'ACTIVE';if(age<STALE_DAYS)return'AGING';return'STALE'}
  function annotate(o){o._ageDays=getAgeDays(o);o._agingAdj=getAging(o);o._ageLabel=getLabel(o);return o}
  function sortWithAging(opps){for(var i=0;i<opps.length;i++)annotate(opps[i]);opps.sort(function(a,b){var sa=(a._adaptiveScore||a.rank||0)+(a._agingAdj||0);var sb=(b._adaptiveScore||b.rank||0)+(b._agingAdj||0);return sb-sa});return opps}
  window.LIMENExecution.phase5.aging={getAgeDays:getAgeDays,getAgingAdjustment:getAging,getLabel:getLabel,annotate:annotate,sortWithAging:sortWithAging,STALE_DAYS:STALE_DAYS,MAX_DECAY:MAX_DECAY};
})();
