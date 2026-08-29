/**
 * relay-source-search.js — Search across Vinted, Poshmark, eBay, Mercari
 * Currently returns mock data; real API integration scaffolded
 */

async function searchVinted(description, maxPrice) {
  // Mock results
  return [
    {
      itemId: 'vinted_' + Math.random().toString(36).substr(2, 9),
      source: 'vinted',
      title: `Levi ${description.match(/\d+/)?.[0] || '505'} Jeans`,
      price: Math.min(maxPrice, 35),
      condition: 'good',
      url: 'https://www.vinted.com/item/mock'
    }
  ];
}

async function searchPoshmark(description, maxPrice) {
  return [
    {
      itemId: 'poshmark_' + Math.random().toString(36).substr(2, 9),
      source: 'poshmark',
      title: `Designer ${description}`,
      price: Math.min(maxPrice, 42),
      condition: 'excellent',
      url: 'https://www.poshmark.com/listing/mock'
    }
  ];
}

async function searchEbay(description, maxPrice) {
  return [
    {
      itemId: 'ebay_' + Math.random().toString(36).substr(2, 9),
      source: 'ebay',
      title: `Vintage ${description}`,
      price: Math.min(maxPrice, 38),
      condition: 'good',
      url: 'https://www.ebay.com/itm/mock'
    }
  ];
}

async function searchMercari(description, maxPrice) {
  return [
    {
      itemId: 'mercari_' + Math.random().toString(36).substr(2, 9),
      source: 'mercari',
      title: description,
      price: Math.min(maxPrice, 33),
      condition: 'fair',
      url: 'https://www.mercari.com/item/mock'
    }
  ];
}

async function searchAllSources(options) {
  const { description, maxPrice = 500, category, condition } = options;

  const all = [];
  all.push(...await searchVinted(description, maxPrice));
  all.push(...await searchPoshmark(description, maxPrice));
  all.push(...await searchEbay(description, maxPrice));
  all.push(...await searchMercari(description, maxPrice));

  // Sort by price ascending (cheapest first)
  all.sort((a, b) => a.price - b.price);

  // Return top 5 results under max price
  return all.filter(item => item.price <= maxPrice).slice(0, 5);
}

module.exports = {
  searchVinted,
  searchPoshmark,
  searchEbay,
  searchMercari,
  searchAllSources
};
