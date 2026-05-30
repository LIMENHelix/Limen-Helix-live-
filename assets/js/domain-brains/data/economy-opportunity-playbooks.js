/**
 * economy-opportunity-playbooks.js
 *
 * Canonical Economy domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the economy-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENEconomyOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "recession",
    "title": "Recession Response",
    "type": "invest",
    "domains": [
      "economy",
      "industry"
    ],
    "pattern": "economy_recession",
    "explain": "Employment contraction, GDP decline, and leading-indicator weakness signaling recession onset. Portal diagnosis RECESSION maps through unemployment-rise, gdp-contraction, and LEI-decline signals.",
    "action": "Position defensively in staples, utilities, and Treasuries. Review treatment nodes for recession-resistant sectors and fiscal-stimulus-aligned plays.",
    "valueRange": "Capital preservation + 10–25% on defensive rotation",
    "saturation": "high",
    "trigger": "Economy stress > 0.50 with unemployment_rise, gdp_contraction, or lei_decline conditions active.",
    "validation": "Confirm BLS employment, BEA GDP, Conference Board LEI.",
    "steps": [
      "Drill into Economy portal RECESSION",
      "Review defensive-sector treatments",
      "Rotate to XLP, XLU, TLT",
      "Screen distressed-debt and restructuring firms",
      "Monitor fiscal-stimulus signals (appropriations, CHIPS, BIL)"
    ],
    "branch_up": "Deep recession: extended defensive holds, add hedges.",
    "branch_down": "Soft landing: rotate back to cyclicals early.",
    "outcome": "Defensive sectors outperform. Distressed-debt firms capture M&A opportunities. Stimulus-aligned sectors see fiscal tailwind.",
    "failure": "Data revised upward. Fed pivot rescues cyclicals.",
    "window": "60–540 days",
    "realWorld": {
      "invest": "Defensive: XLP, XLU, XLV. Treasuries: TLT, GOVT. Distressed: Oaktree (public via BX), Apollo (APO).",
      "apply": "N/A (private-sector positioning).",
      "build": "Leading-indicator analytics, recession-probability tooling, fiscal-stimulus tracking."
    },
    "examples": [
      "Consumer staples and utilities ETFs",
      "Long-duration Treasuries",
      "Distressed-debt managers",
      "Recession-resistant business models",
      "Fiscal-stimulus-aligned sectors"
    ],
    "fastPath": [
      "1. Confirm RECESSION with LEI_decline",
      "2. Rotate to XLP/XLU/TLT",
      "3. Screen distressed and stimulus-aligned plays"
    ]
  },
  {
    "id": "hyperinflation",
    "title": "Hyperinflation Response",
    "type": "invest",
    "domains": [
      "economy",
      "finance"
    ],
    "pattern": "economy_inflation",
    "explain": "Inflation expectations unanchored, wage-price spiral accelerating, or monetary regime breakdown. Portal diagnosis HYPERINFLATION maps through cpi-spike, wage-price-spiral, and expectations-unanchor signals.",
    "action": "Position in hard assets, TIPS, commodities, and real-asset platforms. Review treatment nodes for inflation-protected infrastructure.",
    "valueRange": "15–40% hard-asset and TIPS returns",
    "saturation": "medium",
    "trigger": "Economy stress > 0.50 with cpi_spike, wage_price_spiral, or expectations_unanchor conditions active.",
    "validation": "Confirm BLS CPI, Fed 5y5y inflation swap, NY Fed expectations survey.",
    "steps": [
      "Drill into Economy portal HYPERINFLATION",
      "Review inflation-hedge treatments",
      "Position in TIP, GLD, DBC, VNQ (REITs)",
      "Screen pricing-power equities (staples with moats)",
      "Monitor Fed reaction function"
    ],
    "branch_up": "Wage-price spiral persists: sustained inflation-hedge overweight.",
    "branch_down": "Rapid Fed tightening succeeds: rotate out of hedges.",
    "outcome": "Hard assets, TIPS, and pricing-power equities outperform cash-yield assets.",
    "failure": "Demand destruction resolves quickly.",
    "window": "90–1080 days",
    "realWorld": {
      "invest": "TIPS: TIP, SCHP. Commodities: DBC, GSG. Real assets: VNQ, GLD. Pricing power: PG, KO, COST.",
      "apply": "N/A",
      "build": "Inflation-monitoring platforms, commodity-price analytics, wage-growth tracking."
    },
    "examples": [
      "TIPS and inflation-linked securities",
      "Commodity baskets and gold",
      "Real-estate and REITs",
      "Pricing-power equities",
      "Wage-price monitoring platforms"
    ],
    "fastPath": [
      "1. Confirm HYPERINFLATION with expectations_unanchor",
      "2. Position in TIP/GLD/DBC",
      "3. Screen pricing-power equities"
    ]
  },
  {
    "id": "banking_crisis_econ",
    "title": "Banking Crisis (Economy Lens)",
    "type": "invest",
    "domains": [
      "economy",
      "finance"
    ],
    "pattern": "economy_banking",
    "explain": "Bank-sector stress feeding back into real-economy credit contraction. Portal diagnosis BANKING_CRISIS maps through credit-tightening, loan-delinquency, and regional-bank-stress signals.",
    "action": "Position in alternative-credit and credit-resilient large-cap equities. Review treatment nodes for credit-contraction beneficiaries.",
    "valueRange": "10–25% alternative-credit returns",
    "saturation": "medium",
    "trigger": "Economy stress > 0.50 with credit_tightening, loan_delinquency, or regional_bank_stress conditions active.",
    "validation": "Confirm FRB H.8, SLOOS, FDIC problem-bank list.",
    "steps": [
      "Drill into Economy portal BANKING_CRISIS",
      "Review credit-resilience treatments",
      "Position in large-cap quality equities",
      "Screen BDCs and private-credit",
      "Monitor SLOOS and H.8 signals"
    ],
    "branch_up": "Credit contraction deepens: sustained private-credit share gains.",
    "branch_down": "Fed lending-facility deployed: normalize positioning.",
    "outcome": "Large-cap quality equities and private-credit managers capture share from regional banks.",
    "failure": "Fed backstop resolves quickly.",
    "window": "30–360 days",
    "realWorld": {
      "invest": "Quality: MSFT, AAPL, BRK.B. BDCs: ARCC, HTGC. Private credit: BX, APO.",
      "apply": "SBA 7(a) expansion during bank credit tightening.",
      "build": "Credit-contraction monitoring platforms, regional-bank-stress analytics."
    },
    "examples": [
      "Large-cap quality equities",
      "Business Development Companies",
      "Private-credit managers",
      "SBA expansion capture",
      "Credit-contraction monitoring"
    ],
    "fastPath": [
      "1. Confirm BANKING_CRISIS feedback to economy",
      "2. Position in quality + BDCs",
      "3. Monitor SLOOS data"
    ]
  },
  {
    "id": "trade_war_econ",
    "title": "Trade War Economic Response",
    "type": "invest",
    "domains": [
      "economy",
      "trade",
      "governance"
    ],
    "pattern": "economy_trade",
    "explain": "Tariff escalation, retaliatory measures, and supply-chain disruption feeding into inflation and growth drag. Portal diagnosis TRADE_WAR maps through tariff-escalation, retaliatory-measure, and supply-chain-disruption signals.",
    "action": "Position in domestic-content beneficiaries, reshoring operators, and trade-resilience tooling. Review treatment nodes for supply-chain-de-risking and onshoring infrastructure.",
    "valueRange": "10–25% reshoring and domestic-content returns",
    "saturation": "low",
    "trigger": "Economy stress > 0.45 with tariff_escalation, retaliatory_measure, or supply_chain_disruption conditions active.",
    "validation": "Confirm USTR Section 301/232 actions, Commerce BIS rules.",
    "steps": [
      "Drill into Economy portal TRADE_WAR",
      "Review reshoring treatments",
      "Screen domestic-manufacturing primes",
      "Position in PAVE/XLI and industrial REITs",
      "Track CHIPS and BIL domestic-content requirements"
    ],
    "branch_up": "Escalation compounds: multi-year reshoring investment wave.",
    "branch_down": "Trade deal resolves: rotate back to global-growth plays.",
    "outcome": "Domestic-manufacturing and reshoring operators capture structural investment flows.",
    "failure": "Quick resolution. Tariffs walked back.",
    "window": "90 days–5 years",
    "realWorld": {
      "invest": "Reshoring: Caterpillar (CAT), Deere (DE), Eaton (ETN). ETFs: PAVE, XLI. REITs: Prologis (PLD), REXR.",
      "apply": "CHIPS Act funding, BIL domestic-content programs, DPA Title III awards.",
      "build": "Supply-chain-de-risking platforms, tariff-impact analytics, reshoring-finance tooling."
    },
    "examples": [
      "Domestic-manufacturing equities",
      "Industrial REITs",
      "Reshoring analytics",
      "Tariff-impact monitoring",
      "CHIPS/BIL grant positioning"
    ],
    "fastPath": [
      "1. Confirm TRADE_WAR with tariff_escalation",
      "2. Position in PAVE/XLI",
      "3. Pursue CHIPS or BIL domestic-content funding"
    ]
  },
  {
    "id": "debt_crisis",
    "title": "Debt Crisis Response",
    "type": "invest",
    "domains": [
      "economy",
      "finance"
    ],
    "pattern": "economy_debt",
    "explain": "Sovereign or corporate debt distress driving rollover stress and default waves. Portal diagnosis DEBT_CRISIS maps through rollover-stress, default-rate, and spread-widening signals.",
    "action": "Position in Treasuries, distressed-debt, and short-duration credit. Review treatment nodes for debt-restructuring and workout advisory.",
    "valueRange": "15–35% distressed-debt returns over 18–36 months",
    "saturation": "medium",
    "trigger": "Economy stress > 0.50 with rollover_stress, default_rate_rise, or spread_widening conditions active.",
    "validation": "Confirm Moody’s default rates, HY spreads (BofA HYG OAS), rollover-calendar data.",
    "steps": [
      "Drill into Economy portal DEBT_CRISIS",
      "Review restructuring treatments",
      "Rotate to TLT, short-duration IG",
      "Screen distressed managers (OAK, APO)",
      "Monitor HY issuance and default calendars"
    ],
    "branch_up": "Default cascade: sustained distressed-debt opportunity set.",
    "branch_down": "Central-bank backstop: shift to credit-recovery plays.",
    "outcome": "Distressed-debt managers capture workout inventory. Treasuries outperform risk assets.",
    "failure": "Rapid backstop. Distressed deals reprice before entry.",
    "window": "90 days–2 years",
    "realWorld": {
      "invest": "Distressed: Apollo (APO), Blackstone (BX), Oaktree (via BX). Treasuries: TLT. Short IG: VCSH.",
      "apply": "N/A",
      "build": "Default-monitoring platforms, rollover-calendar analytics, restructuring-workflow tooling."
    },
    "examples": [
      "Distressed-debt managers",
      "Treasury positioning",
      "Short-duration IG",
      "Rollover and maturity analytics",
      "Restructuring-workflow platforms"
    ],
    "fastPath": [
      "1. Confirm DEBT_CRISIS with rollover_stress",
      "2. Position in TLT + distressed managers",
      "3. Monitor maturity calendars"
    ]
  },
  {
    "id": "market_crash_econ",
    "title": "Market Crash (Economy Lens)",
    "type": "invest",
    "domains": [
      "economy",
      "finance"
    ],
    "pattern": "economy_crash",
    "explain": "Equity-market crash with negative wealth-effect spillover into consumption and capex. Portal diagnosis MARKET_CRASH maps through drawdown, volatility-spike, and wealth-effect-decline signals.",
    "action": "Position defensively, watch for consumer-spending weakness. Review treatment nodes for wealth-effect analytics and consumer-resilience.",
    "valueRange": "Capital preservation + 10–20% on recovery",
    "saturation": "high",
    "trigger": "Economy stress > 0.55 with drawdown, volatility_spike, or wealth_effect_decline conditions active.",
    "validation": "Confirm VIX > 30 sustained, SPY drawdown > 15%, consumer confidence decline.",
    "steps": [
      "Drill into Economy portal MARKET_CRASH",
      "Review wealth-effect treatments",
      "Rotate to XLP, XLU, TLT",
      "Short luxury/discretionary (XLY exposure)",
      "Monitor for capitulation and Fed response"
    ],
    "branch_up": "Bear market confirmed: extended defensive.",
    "branch_down": "V-recovery: rotate back to growth.",
    "outcome": "Defensive and staples outperform. Wealth-effect analytics platforms see demand.",
    "failure": "Quick Fed pivot. Missed rotation.",
    "window": "14–270 days",
    "realWorld": {
      "invest": "Defensive: XLP, XLU, XLV. Treasuries: TLT. Inverse: SH (caution).",
      "apply": "N/A",
      "build": "Wealth-effect analytics, consumer-resilience monitoring, crash-recovery predictors."
    },
    "examples": [
      "Defensive-sector ETFs",
      "Long-duration Treasuries",
      "Wealth-effect analytics",
      "Consumer-resilience monitoring",
      "Inverse/hedge exposure"
    ],
    "fastPath": [
      "1. Confirm MARKET_CRASH with wealth_effect_decline",
      "2. Rotate to XLP/TLT",
      "3. Monitor for capitulation"
    ]
  },
  {
    "id": "economy_data_gap",
    "title": "Economy Data Gap → Build",
    "type": "build",
    "domains": [
      "economy"
    ],
    "pattern": null,
    "explain": "Economy monitoring has gaps. Build real-time macro-intelligence platforms.",
    "action": "Build real-time economic-indicator platforms.",
    "valueRange": "$500K–$10M macro-data infrastructure",
    "saturation": "low",
    "trigger": "Economy sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Economy feed health",
      "Count OFFLINE sources",
      "Identify gap",
      "Build pipeline",
      "Apply to NSF SBE or Treasury OFR"
    ],
    "branch_up": "Gap persists: build infrastructure.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Macro-intelligence platform serving hedge funds, central banks, policy analysts.",
    "failure": "Bloomberg/Haver absorb gap.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "apply": "NSF SBE, Treasury OFR research partnerships, BEA/BLS data partnerships.",
      "build": "Real-time macro dashboards, nowcasting platforms, alternative-data aggregation."
    },
    "examples": [
      "Real-time GDP nowcasting",
      "Employment and inflation dashboards",
      "Alternative-data aggregation",
      "Consumer-spending intelligence",
      "Macro-correlation analytics"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Pursue NSF SBE or build"
    ]
  }
];

  window.LIMENEconomyOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENEconomyOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
