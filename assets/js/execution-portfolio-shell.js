/**
 * execution-portfolio-shell.js — Venture Studio Portfolio Tracking
 *
 * Tracks companies LIMEN creates/supports via domain execution.
 * Local storage only — no backend.
 *
 * Exposes: window.LIMENExecution.phase4.portfolio
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  var STORE_KEY = 'LIMEN_EXECUTION_PORTFOLIO';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }

  function addCompany(data) {
    var all = loadAll();
    var co = {
      id: 'pco_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: data.name || '',
      domain: data.domain || '',
      linkedOpportunityId: data.linkedOpportunityId || '',
      linkedClaimId: data.linkedClaimId || '',
      ownershipPct: data.ownershipPct || 30,
      revenueSharePct: data.revenueSharePct || 0,
      status: data.status || 'forming',
      createdAt: Date.now(),
      notes: data.notes || ''
    };
    all.push(co);
    saveAll(all);
    return co;
  }

  function getAllCompanies() { return loadAll(); }
  function getByDomain(domain) { return loadAll().filter(function (c) { return c.domain === domain; }); }

  function updateCompany(id, updates) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        for (var k in updates) all[i][k] = updates[k];
        all[i].updatedAt = Date.now();
        saveAll(all);
        return all[i];
      }
    }
    return null;
  }

  function getStats() {
    var all = loadAll();
    return {
      total: all.length,
      forming: all.filter(function (c) { return c.status === 'forming'; }).length,
      active: all.filter(function (c) { return c.status === 'active'; }).length,
      exited: all.filter(function (c) { return c.status === 'exited'; }).length,
      totalOwnershipValue: 0 // Placeholder — no valuation engine yet
    };
  }

  window.LIMENExecution.phase4.portfolio = {
    addCompany: addCompany,
    getAllCompanies: getAllCompanies,
    getByDomain: getByDomain,
    updateCompany: updateCompany,
    getStats: getStats
  };
})();
