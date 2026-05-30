/**
 * portal-pricing-config.js — Portal Product Pricing Configuration
 *
 * Exposes: window.LIMENExecution.phase4.portalPricing
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  var LEAD_KEY = 'LIMEN_PORTAL_LEADS';

  var tiers = {
    starter: { name: 'Starter', monthlyPrice: 500, annualPrice: 5000, reports: 10, seats: 1, domains: 1, features: ['Helix Report per company', 'Phase + trajectory scoring', 'Kernel-validated diagnostics', 'Printable board reports'] },
    professional: { name: 'Professional', monthlyPrice: 1500, annualPrice: 15000, reports: 50, seats: 5, domains: 5, features: ['Everything in Starter', 'Multi-domain coverage', 'Cross-domain pressure mapping', 'Intervention recommendations', 'API access'] },
    enterprise: { name: 'Enterprise', monthlyPrice: null, annualPrice: null, reports: 'Unlimited', seats: 'Unlimited', domains: 20, features: ['Everything in Professional', 'White-label kernel access', 'Custom domain configuration', 'Dedicated support', 'Priority scoring queue', 'Portfolio monitoring'] }
  };

  function saveLead(data) {
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) {}
    leads.push({ name: data.name, email: data.email, company: data.company, interest: data.interest, domain: data.domain, tier: data.tier, timestamp: Date.now() });
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(leads)); } catch (e) {}
  }

  function getLeads() {
    try { return JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) { return []; }
  }

  window.LIMENExecution.phase4.portalPricing = { tiers: tiers, saveLead: saveLead, getLeads: getLeads };
})();
