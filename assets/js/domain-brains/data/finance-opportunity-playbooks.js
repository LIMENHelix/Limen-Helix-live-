/**
 * finance-opportunity-playbooks.js
 *
 * Canonical Finance domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the finance-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENFinanceOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "banking_crisis",
    "title": "Banking Crisis Response",
    "type": "invest",
    "domains": [
      "finance",
      "economy"
    ],
    "pattern": "finance_banking",
    "explain": "Regional or systemic bank stress triggering deposit runs, FDIC resolution activity, or counterparty fears. Portal diagnosis BANKING_CRISIS maps through deposit-flight, capital-adequacy breach, and counterparty-exposure signals.",
    "action": "Position in large well-capitalized banks, Treasury ETFs, and distressed-assets platforms. Review treatment nodes for FDIC-resolution positioning and capital-flight intermediation.",
    "valueRange": "10–30% returns on quality-flight and distressed-asset rotation",
    "saturation": "medium",
    "trigger": "Finance stress > 0.50 with deposit_flight, capital_inadequacy, or counterparty_exposure conditions active.",
    "validation": "Confirm FDIC, FFIEC, FRB H.8 data. Cross-reference economy domain for macro corroboration.",
    "steps": [
      "Drill into Finance portal BANKING_CRISIS",
      "Review FDIC-resolution and capital-flight treatments",
      "Screen money-center banks (JPM, BAC) for quality flight",
      "Position in TLT/short-duration Treasuries",
      "Monitor distressed-assets managers"
    ],
    "branch_up": "Contagion spreads to multiple institutions: Fed/FDIC intervention, full defensive positioning.",
    "branch_down": "Single-institution resolution via FDIC: shift to quality-bank long positions.",
    "outcome": "Quality-flight benefits money-center banks and Treasuries. Distressed-assets firms capture FDIC-resolution inventory.",
    "failure": "Rapid Fed backstop neutralizes contagion. Quality flight reverses.",
    "window": "7–90 days",
    "realWorld": {
      "invest": "Money-center banks: JPMorgan (JPM), Bank of America (BAC). Treasuries: TLT, SHY, IEF. Distressed: Oaktree Capital, Apollo (APO).",
      "apply": "FDIC loss-share agreements for resolution purchases, SBA bridge-loan programs.",
      "build": "Deposit-flight monitoring, counterparty-exposure analytics, FDIC-resolution workflow platforms."
    },
    "examples": [
      "Money-center banking exposure",
      "Treasury and short-duration bond ETFs",
      "Distressed-asset managers",
      "Deposit-flight monitoring platforms",
      "FDIC-resolution analytics"
    ],
    "fastPath": [
      "1. Confirm BANKING_CRISIS with deposit_flight signals",
      "2. Position in JPM/TLT for quality flight",
      "3. Monitor FDIC resolution inventory"
    ]
  },
  {
    "id": "credit_freeze",
    "title": "Credit Freeze Response",
    "type": "invest",
    "domains": [
      "finance",
      "economy",
      "industry"
    ],
    "pattern": "finance_credit",
    "explain": "Commercial-paper spreads blowing out, bank lending contracting, high-yield issuance stalling. Portal diagnosis CREDIT_FREEZE maps through CP-spread, lending-contraction, and HY-issuance-stall signals.",
    "action": "Position in alternative-credit platforms, private-credit managers, and supply-chain-finance tooling. Review treatment nodes for non-bank credit and invoice-financing.",
    "valueRange": "10–25% alternative-credit and private-credit returns",
    "saturation": "medium",
    "trigger": "Finance stress > 0.50 with cp_spread_blowout, lending_contraction, or hy_issuance_stall conditions active.",
    "validation": "Confirm FRB CP data, SLOOS lending survey, HY-issuance calendars.",
    "steps": [
      "Drill into Finance portal CREDIT_FREEZE",
      "Review non-bank-credit treatments",
      "Screen private-credit and BDC managers",
      "Position in alternative-credit ETFs (BIZD, PSQ)",
      "Monitor supply-chain-finance platforms"
    ],
    "branch_up": "Freeze persists 60+ days: private-credit takes share from banks, platform growth accelerates.",
    "branch_down": "Fed injection thaws credit: shift back to bank-lending beneficiaries.",
    "outcome": "Private-credit managers, BDCs, and supply-chain-finance platforms capture share from banks.",
    "failure": "Fed acts quickly. Banks resume lending. Alternative-credit margins compress.",
    "window": "30–180 days",
    "realWorld": {
      "invest": "BDCs: ARCC, HTGC, OCSL. Private credit: BX, APO, KKR, CG. Supply-chain finance: C2FO, Taulia (private).",
      "apply": "SBA 7(a)/504 lender-match programs, Treasury TALF-style facilities when active.",
      "build": "Alternative-credit matching platforms, supply-chain-finance infrastructure, invoice-factoring tooling."
    },
    "examples": [
      "Business Development Companies (BDCs)",
      "Private-credit and direct-lending managers",
      "Supply-chain finance platforms",
      "Invoice-factoring and working-capital services",
      "Alternative-credit analytics"
    ],
    "fastPath": [
      "1. Confirm CREDIT_FREEZE with cp_spread signals",
      "2. Position in BDC ETFs (BIZD) or private-credit managers",
      "3. Build or invest in supply-chain-finance platform"
    ]
  },
  {
    "id": "market_crash",
    "title": "Market Crash Response",
    "type": "invest",
    "domains": [
      "finance",
      "economy"
    ],
    "pattern": "finance_market",
    "explain": "Sharp index drawdown with volatility spike, margin calls, and forced liquidation. Portal diagnosis MARKET_CRASH maps through volatility-spike, drawdown, and forced-liquidation signals.",
    "action": "Position defensively in gold, Treasuries, and low-volatility equities. Review treatment nodes for hedging infrastructure and risk-parity rebalancing.",
    "valueRange": "Defensive: capital preservation; Tactical: 10–20% on dip-buying",
    "saturation": "high",
    "trigger": "Finance stress > 0.55 with volatility_spike, drawdown, or forced_liquidation conditions active.",
    "validation": "Confirm VIX > 30 sustained, SPY drawdown > 10%, margin-debt data.",
    "steps": [
      "Drill into Finance portal MARKET_CRASH",
      "Review hedging and risk-parity treatments",
      "Rotate to GLD, TLT, defensive equities (XLP, XLU)",
      "Identify quality names at valuation discount",
      "Monitor for capitulation signals"
    ],
    "branch_up": "Crash deepens to bear market: extended defensive positioning.",
    "branch_down": "V-shaped recovery: rotate back to growth at the retrace.",
    "outcome": "Defensive positioning preserves capital. Dip-buyers capture 10–20% on recovery.",
    "failure": "Recovery precedes defensive rotation. Missed entry.",
    "window": "7–180 days",
    "realWorld": {
      "invest": "Gold: GLD, IAU. Treasuries: TLT, GOVT. Defensive: XLU, XLP, VIX derivatives (SVXY/UVXY caution).",
      "apply": "N/A",
      "build": "Volatility-monitoring platforms, risk-parity rebalancing tools, hedging-analytics services."
    },
    "examples": [
      "Gold and precious-metals exposure",
      "Long-duration Treasury ETFs",
      "Defensive-sector ETFs (utilities, staples)",
      "Volatility-monitoring platforms",
      "Risk-parity tooling"
    ],
    "fastPath": [
      "1. Confirm MARKET_CRASH with VIX > 30",
      "2. Rotate to GLD/TLT/XLP",
      "3. Set capitulation-buy triggers"
    ]
  },
  {
    "id": "currency_collapse",
    "title": "Currency Collapse Response",
    "type": "invest",
    "domains": [
      "finance",
      "economy",
      "governance"
    ],
    "pattern": "finance_currency",
    "explain": "Rapid devaluation, capital-controls imposition, or hyperinflation onset. Portal diagnosis CURRENCY_COLLAPSE maps through devaluation, capital-controls, and hyperinflation signals.",
    "action": "Position in hard-asset hedges, USD strength, and cross-border-payment tooling. Review treatment nodes for dollarization support and remittance infrastructure.",
    "valueRange": "15–50% hard-asset and FX returns during collapse",
    "saturation": "low",
    "trigger": "Finance stress > 0.55 with devaluation, capital_controls, or hyperinflation conditions active.",
    "validation": "Confirm central-bank FX reserves, IMF Article IV, capital-controls announcements.",
    "steps": [
      "Drill into Finance portal CURRENCY_COLLAPSE",
      "Review dollarization and remittance treatments",
      "Position in hard assets (gold, commodities, USD) and UUP",
      "Screen cross-border payment platforms",
      "Monitor IMF and multilateral response"
    ],
    "branch_up": "IMF program fails: deeper devaluation, continued hard-asset positioning.",
    "branch_down": "Credible central-bank intervention: rotate out of hedges.",
    "outcome": "Hard-asset hedges and cross-border-payment platforms capture value. Remittance corridors see volume surge.",
    "failure": "Rapid IMF intervention stabilizes currency. Hedges underperform.",
    "window": "30 days–2 years",
    "realWorld": {
      "invest": "Hard assets: GLD, SLV, DBC. USD: UUP, short-local-FX via UDN. Remittance: Wise (WISE.L), Remitly (RELY).",
      "apply": "N/A (private-sector).",
      "build": "Cross-border payment platforms, stablecoin on/off-ramps for dollarization, remittance infrastructure."
    },
    "examples": [
      "Hard-asset and commodity exposure",
      "USD-strength ETFs",
      "Cross-border payment platforms",
      "Stablecoin dollarization rails",
      "Remittance corridor infrastructure"
    ],
    "fastPath": [
      "1. Confirm CURRENCY_COLLAPSE with devaluation signals",
      "2. Position in GLD/UUP or commodity hedges",
      "3. Screen cross-border payment platforms"
    ]
  },
  {
    "id": "systemic_contagion",
    "title": "Systemic Contagion Response",
    "type": "invest",
    "domains": [
      "finance",
      "economy"
    ],
    "pattern": "finance_systemic",
    "explain": "Cross-border or cross-asset contagion triggering global deleveraging. Portal diagnosis SYSTEMIC_CONTAGION maps through cross-border-stress, deleveraging, and correlation-breakdown signals.",
    "action": "Maximum defensive positioning: Treasuries, gold, USD. Review treatment nodes for tail-risk hedging and global-macro rebalancing.",
    "valueRange": "Capital preservation primary; 10–25% on defensive rotation",
    "saturation": "high",
    "trigger": "Finance stress > 0.60 with cross_border_stress, deleveraging, or correlation_breakdown conditions active.",
    "validation": "Confirm BIS credit-stress, IMF FSAP, cross-asset correlation spike.",
    "steps": [
      "Drill into Finance portal SYSTEMIC_CONTAGION",
      "Review tail-hedging and macro treatments",
      "Rotate 100% defensive: TLT, GLD, UUP, XLU",
      "Screen global-macro hedge funds (BN, KKR partnerships)",
      "Monitor central-bank coordinated response"
    ],
    "branch_up": "No coordinated response: extended deleveraging, defensive holds.",
    "branch_down": "G7 central-bank action: rotate back to risk as correlations normalize.",
    "outcome": "Tail-hedging and global-macro vendors capture allocations. Defensive positioning preserves capital.",
    "failure": "Fast coordinated intervention. Rotation back to risk before defensive positions pay.",
    "window": "14–180 days",
    "realWorld": {
      "invest": "TLT, GLD, UUP, XLU, tail-risk funds (UPRO-like inverse). Macro ETFs: QMN, GMOM.",
      "apply": "N/A",
      "build": "Systemic-risk monitoring platforms, cross-asset correlation analytics, tail-hedging tooling."
    },
    "examples": [
      "Long-duration Treasury positioning",
      "Gold and USD defensive allocation",
      "Tail-risk hedging strategies",
      "Global-macro hedge-fund exposure",
      "Systemic-risk monitoring platforms"
    ],
    "fastPath": [
      "1. Confirm SYSTEMIC_CONTAGION with correlation_breakdown signals",
      "2. Maximum defensive: TLT/GLD/UUP",
      "3. Monitor for G7 coordinated response"
    ]
  },
  {
    "id": "fraud_scandal",
    "title": "Financial Fraud Scandal Response",
    "type": "invest",
    "domains": [
      "finance",
      "law"
    ],
    "pattern": "finance_fraud",
    "explain": "High-profile fraud discovery triggering SEC/DOJ investigation and industry-wide compliance demand. Portal diagnosis FRAUD_SCANDAL maps through misconduct-disclosure, enforcement-action, and compliance-gap signals.",
    "action": "Position in compliance-tech, forensic-accounting platforms, and regtech. Review treatment nodes for fraud-detection ML and post-scandal compliance overlays.",
    "valueRange": "15–35% regtech returns",
    "saturation": "medium",
    "trigger": "Finance stress > 0.40 with misconduct_disclosure, enforcement_action, or compliance_gap conditions active.",
    "validation": "Confirm SEC enforcement actions, DOJ announcements, FINRA disciplinary activity.",
    "steps": [
      "Drill into Finance portal FRAUD_SCANDAL",
      "Review fraud-detection ML treatments",
      "Screen compliance-tech (ALTR, MITK) and regtech pure-plays",
      "Monitor SEC enforcement pipeline",
      "Build or invest in forensic-accounting tooling"
    ],
    "branch_up": "Systemic fraud pattern: regulatory tightening across industry.",
    "branch_down": "Isolated case prosecuted: shift to preventive-compliance investment.",
    "outcome": "Compliance-tech, regtech, and forensic-accounting vendors capture post-scandal procurement.",
    "failure": "Case resolves quietly. Industry absorbs compliance overhead internally.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Regtech: Alteryx (AYX), Mitek (MITK), ACI Worldwide (ACIW). Compliance: LogicGate, OneTrust (private).",
      "apply": "SEC Whistleblower Program (for disclosers), OIG grants for oversight tooling.",
      "build": "Fraud-detection ML platforms, forensic-accounting automation, post-scandal compliance overlays."
    },
    "examples": [
      "Regtech and compliance-tech platforms",
      "Forensic-accounting automation",
      "Fraud-detection ML services",
      "AML/KYC infrastructure",
      "Disclosure-monitoring platforms"
    ],
    "fastPath": [
      "1. Confirm FRAUD_SCANDAL with enforcement_action signals",
      "2. Screen regtech (AYX, MITK, ACIW)",
      "3. Build forensic-accounting or fraud-detection tooling"
    ]
  },
  {
    "id": "finance_data_gap",
    "title": "Finance Data Gap → Build",
    "type": "build",
    "domains": [
      "finance"
    ],
    "pattern": null,
    "explain": "Finance monitoring has gaps. Build data infrastructure for market-stress, credit, or institutional coverage.",
    "action": "Build real-time financial-intelligence platforms.",
    "valueRange": "$500K–$10M finance-data infrastructure",
    "saturation": "low",
    "trigger": "Finance sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Finance feed health",
      "Count OFFLINE sources",
      "Identify gap",
      "Build pipeline",
      "Apply to SBA/NSF or partner with exchange"
    ],
    "branch_up": "Gap persists: build permanent infrastructure.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Financial-intelligence platform.",
    "failure": "Incumbents absorb.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "apply": "SBIR for financial-data infrastructure, NSF SBE programs.",
      "build": "Market-stress dashboards, credit-monitoring aggregation, institutional-flow intelligence."
    },
    "examples": [
      "Real-time market-stress dashboards",
      "Credit-monitoring aggregation",
      "Institutional-flow analytics",
      "Regulatory-disclosure intelligence",
      "Cross-asset correlation monitoring"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Build or partner"
    ]
  }
];

  window.LIMENFinanceOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENFinanceOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
