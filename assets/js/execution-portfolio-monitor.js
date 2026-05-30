/**
 * execution-portfolio-monitor.js — Portfolio Intelligence Loop
 * Enriches portfolio items with health labels. No kernel changes.
 * Exposes: window.LIMENExecution.phase5.portfolioMonitor
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  function getHealth(item){if(!item)return'UNKNOWN';if(item.status==='exited')return'EXITED';if(item.status==='distressed')return'DISTRESSED';if(item.status==='watch')return'WATCH';if(item.status==='active')return'STABLE';if(item.status==='scaling')return'STABLE';return'UNKNOWN'}
  function enrich(item){item._healthLabel=getHealth(item);return item}
  function needingReview(){var pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio;if(!pf)return[];return pf.getAllCompanies().filter(function(c){return c.status==='distressed'||c.status==='watch'})}
  function getSummary(){var pf=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio;if(!pf)return{total:0,stable:0,watch:0,distressed:0};var all=pf.getAllCompanies();return{total:all.length,stable:all.filter(function(c){return c.status==='active'||c.status==='scaling'}).length,watch:all.filter(function(c){return c.status==='watch'}).length,distressed:all.filter(function(c){return c.status==='distressed'}).length}}
  window.LIMENExecution.phase5.portfolioMonitor={getHealthLabel:getHealth,enrich:enrich,getItemsNeedingReview:needingReview,getSummary:getSummary};
})();
