/**
 * lib/domain-baskets.js — THE curated ticker basket per domain, single source of truth.
 *
 * These lists were previously duplicated inside each handlers/<domain>-markets.js, which was
 * fine while they only drove display quotes. As of 2026-07-28 they also drive a real ESTIMATOR
 * CHANNEL (lib/domain-market-feed.js builds an equal-weight index from them and scores it with
 * the marketStress function validated on 40y of WTI), so two copies that can drift is no longer
 * an acceptable arrangement: the number the brain learns from and the number the page shows must
 * come from the same list. The handlers now require this module.
 *
 * These baskets are not arbitrary. A prior session tested all 20 against 400 random size-matched
 * baskets drawn from the same universe: 17 of 19 testable domains are GENUINE CLUSTERS at
 * pctile >= 0.98 (within-basket residual correlation 0.11-0.44 vs random median ~0.05), and the
 * common-factor variance share is 0.12-0.46 vs 0.06-0.15 for random. That is the evidence that a
 * domain index means something. It is also why the instrument is the common factor and NOT
 * cross-sectional dispersion, which failed the same placebo.
 *
 * Editing a basket changes BOTH the public quotes and a learning channel. Keep them thematic and
 * keep them liquid.
 */

var BASKETS = {
  agriculture: [
    'ADM', 'BG', 'INGR', 'TSN', 'CAG', 'CTVA', 'NTR', 'MOS',
    'CF', 'FMC', 'DE', 'AGCO', 'CNHI', 'MOO', 'DBA'
  ],
  communication: [
    'VZ', 'T', 'TMUS', 'CMCSA', 'CHTR', 'CSCO', 'ANET', 'AMT',
    'CCI', 'SBAC', 'NWSA', 'NYT', 'META', 'GOOGL', 'XLC', 'IYZ'
  ],
  culture: [
    'SPOT', 'WMG', 'UMG.AS', 'SIRI', 'CSGP', 'NFLX', 'WBD', 'PARA',
    'DIS', 'SONY', 'CMCSA', 'LYV', 'EDR', 'MSGE', 'MSGS', 'WWE',
    'ROKU', 'TTD', 'META', 'GOOGL', 'PINS', 'SNAP', 'TKO', 'MANU',
    'FUBO'
  ],
  defense: [
    'LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX', 'HII', 'LDOS',
    'BAH', 'KTOS', 'AVAV', 'HWM', 'TDG', 'AXON', 'CW', 'HEI',
    'TXT', 'ITA', 'PPA', 'XAR'
  ],
  economy: [
    'SPY', 'DIA', 'QQQ', 'IWM', 'TLT', 'IEF', 'SHY', 'HYG',
    'LQD', 'GLD', 'DBC', 'USO', 'UUP', 'VIXY', 'TIP', 'XLY',
    'XLP'
  ],
  education: [
    'CHGG', 'COUR', 'DUOL', 'TWOU', 'LRN', 'ATGE', 'LOPE', 'STRA',
    'LAUR', 'UTI', 'PSO.L', 'SCHL'
  ],
  energy: [
    'NEE', 'VST', 'CEG', 'GEV', 'ETN', 'PWR', 'SO', 'D',
    'CCJ', 'BWXT', 'SMR', 'OKLO', 'LEU', 'XOM', 'CVX', 'COP',
    'OXY', 'SLB', 'LNG', 'EQT', 'KMI', 'WMB', 'FSLR', 'BEP',
    'ENPH', 'RUN', 'DUK', 'AEP', 'EXC', 'AWK', 'WTRG', 'XYL',
    'XLE', 'XLU', 'URA', 'TAN'
  ],
  environment: [
    'WM', 'RSG', 'WCN', 'CWST', 'CLH', 'DAR', 'AWK', 'WTRG',
    'XYL', 'VLTO', 'ECL', 'TTEK', 'LIN', 'APD', 'FSLR', 'ENPH',
    'ICLN', 'PBW'
  ],
  finance: [
    'JPM', 'BAC', 'WFC', 'C', 'USB', 'PNC', 'TFC', 'GS',
    'MS', 'SCHW', 'RJF', 'BLK', 'BX', 'KKR', 'APO', 'BEN',
    'V', 'MA', 'AXP', 'PYPL', 'COF', 'DFS', 'BRK-B', 'SPGI',
    'MCO', 'ICE', 'CME', 'XLF', 'KRE', 'KBE'
  ],
  governance: [
    'TYL', 'MMS', 'ACN', 'GDIT', 'BAH', 'LDOS', 'CACI', 'SAIC',
    'KBR', 'ICFI', 'NSP'
  ],
  industry: [
    'CAT', 'DE', 'GE', 'HON', 'MMM', 'EMR', 'ITW', 'ETN',
    'PH', 'ROK', 'DOV', 'GEV', 'XLI', 'VIS', 'XAR'
  ],
  infrastructure: [
    'ACM', 'J', 'WSP.TO', 'BSY', 'TRMB', 'HXGBY', 'PWR', 'GVA',
    'MTZ', 'FIX', 'STRL', 'VMC', 'MLM', 'NUE', 'EXP', 'SUM',
    'FTNT', 'PANW', 'SBGSY', 'ROK', 'AWK', 'WTRG', 'XYL', 'WMS',
    'BIP', 'PAVE', 'IFRA', 'IGF'
  ],
  intelligence: [
    'PLTR', 'BAH', 'LDOS', 'CACI', 'SAIC', 'KBR', 'VRNT', 'NICE',
    'VRSK', 'MAXR', 'NPSNY', 'ITA', 'PPA'
  ],
  law: [
    'RELX', 'TRI', 'VERX', 'CSGP', 'VRSK', 'ACN', 'FCN', 'EFX'
  ],
  medicine: [
    'UNH', 'CVS', 'HCA', 'CI', 'ELV', 'JNJ', 'PFE', 'MRK',
    'ABBV', 'LLY', 'AMGN', 'GILD', 'TMO', 'ABT', 'MDT', 'ISRG',
    'DHR', 'XLV', 'IHI', 'IBB'
  ],
  population: [
    'WELL', 'VTR', 'OHI', 'SBRA', 'DHI', 'LEN', 'PHM', 'NVR',
    'AVB', 'INVH', 'XLRE', 'ITB'
  ],
  religion: [
    'BIBL', 'WWJD', 'FOVL', 'KOCG'
  ],
  science: [
    'TMO', 'DHR', 'A', 'MTD', 'WAT', 'ILMN', 'BIO', 'RVTY',
    'BRKR', 'IQV', 'ICLR', 'MEDP', 'XLV', 'ARKG'
  ],
  technology: [
    'NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'AMAT', 'LRCX', 'KLAC',
    'MU', 'INTC', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'ORCL',
    'CRM', 'ADBE', 'NOW', 'PLTR', 'SNOW', 'NET', 'CRWD', 'PANW',
    'ZS', 'FTNT', 'XLK', 'SMH', 'SOXX', 'IGV'
  ],
  trade: [
    'FDX', 'UPS', 'EXPD', 'CHRW', 'XPO', 'GXO', 'ODFL', 'ZIM',
    'MATX', 'AMKBY', 'DSDVY', 'KEX', 'IYT', 'XTN'
  ],
};

function get(domain) {
  var k = String(domain || '');
  return Object.prototype.hasOwnProperty.call(BASKETS, k) ? BASKETS[k].slice() : [];
}

module.exports = { BASKETS: BASKETS, get: get, domains: Object.keys(BASKETS) };
