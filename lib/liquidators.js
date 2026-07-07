/**
 * lib/liquidators.js — disposition side for the INDUSTRY domain (plant closings / WARN notices).
 * A closing plant fire-sells tangible assets: machinery, inventory, and the building. These are the
 * standing paying counterparties who buy (or broker the sale of) a closing-plant lead. We own nothing;
 * a licensed auctioneer / appraiser executes. Mirrors lib/buyers.js for real estate.
 *
 * matchLiquidatorsFor(state, scale, assetHint): scale = # employees affected (a proxy for asset size;
 * bigger closures need the full-service liquidators). All players below are national, so state is a
 * pass-through for now (kept in the signature so a regional roll-up can filter later).
 */
'use strict';
var LIQUIDATORS = [
  { name: 'Tiger Group', type: 'Asset liquidator', assets: ['machinery', 'inventory', 'IP'], minScale: 0, note: 'Full-plant liquidation + appraisal + disposition, any size', url: 'https://www.tigergroup.com/' },
  { name: 'Heritage Global Partners', type: 'Industrial auctioneer', assets: ['machinery', 'equipment'], minScale: 0, note: 'Industrial asset auctions, plant-level', url: 'https://www.hgpauction.com/' },
  { name: 'Maynards Industrial', type: 'Industrial auctioneer', assets: ['machinery', 'plant assets'], minScale: 0, note: 'Plant liquidation auctions', url: 'https://www.maynards.com/' },
  { name: 'Ritchie Bros / IronPlanet', type: 'Equipment auctioneer', assets: ['heavy equipment', 'machinery'], minScale: 0, note: 'Global equipment auctions, unreserved', url: 'https://www.rbauction.com/' },
  { name: 'Liquidity Services (AllSurplus)', type: 'Surplus marketplace', assets: ['equipment', 'surplus inventory'], minScale: 0, note: 'Online surplus/asset marketplace', url: 'https://www.liquidityservices.com/' },
  { name: 'Gordon Brothers', type: 'Asset liquidator', assets: ['inventory', 'machinery', 'brands'], minScale: 50, note: 'Inventory + industrial disposition + lending', url: 'https://www.gordonbrothers.com/' },
  { name: 'Great American Group (B. Riley)', type: 'Asset liquidator', assets: ['machinery', 'inventory'], minScale: 50, note: 'Industrial auctions + appraisal', url: 'https://www.brileyfin.com/' },
  { name: 'SB360 Capital', type: 'Asset liquidator', assets: ['inventory', 'real estate'], minScale: 50, note: 'Inventory + industrial real-estate disposition', url: 'https://sb360.com/' },
  { name: 'Hilco Global', type: 'Asset liquidator', assets: ['machinery', 'real estate', 'inventory'], minScale: 150, note: 'Large industrial + real-estate monetization', url: 'https://www.hilcoglobal.com/' },
  { name: 'CBRE Industrial & Logistics', type: 'Industrial CRE broker', assets: ['building', 'real estate'], minScale: 0, note: 'Re-lease / sell the vacated plant + land', url: 'https://www.cbre.com/services/property-types/industrial-and-logistics' }
];
function matchLiquidatorsFor(state, scale, assetHint) {
  scale = parseInt(scale, 10) || 0;
  var hint = String(assetHint || '').toLowerCase();
  return LIQUIDATORS.filter(function (l) {
    if (scale < (l.minScale || 0)) return false;
    if (hint && l.assets.indexOf('building') >= 0 && !/real\s*estate|building|plant|facility/.test(hint)) { /* keep CRE only when relevant, but default include */ }
    return true;
  }).map(function (l) { return { name: l.name, type: l.type, assets: l.assets, note: l.note, url: l.url }; });
}
module.exports = { LIQUIDATORS: LIQUIDATORS, matchLiquidatorsFor: matchLiquidatorsFor };
