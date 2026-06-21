/**
 * trade-opportunity-playbooks.js
 *
 * Canonical Trade domain opportunity playbook dataset. Domain-owned.
 * Authored to align with the trade-brain's diagnosis vocabulary.
 *
 * Exposes: window.LIMENTradeOpportunityPlaybooks
 */
(function () {
  'use strict';

  var PLAYBOOKS = [
  {
    "id": "supply_chain_collapse_trade",
    "title": "Supply Chain Collapse Response",
    "type": "invest",
    "domains": [
      "trade",
      "industry"
    ],
    "pattern": "trade_supply_chain",
    "explain": "Multi-node supply-chain disruption affecting inventory, lead times, and working-capital. Portal diagnosis SUPPLY_CHAIN_COLLAPSE maps through disruption, inventory-shock, and lead-time-blowout signals.",
    "action": "Position in supply-chain visibility, nearshoring platforms, and inventory-optimization tooling.",
    "valueRange": "15–30% supply-chain-tech returns",
    "saturation": "medium",
    "trigger": "Trade stress > 0.50 with disruption, inventory_shock, or lead_time_blowout conditions active.",
    "validation": "Confirm ISM, freight rates (Drewry, Baltic Dry), container-throughput data.",
    "steps": [
      "Drill into Trade portal SUPPLY_CHAIN_COLLAPSE",
      "Review visibility treatments",
      "Screen project44, Flexport, Manhattan Associates",
      "Position in supply-chain ETFs (IYT, XTN)",
      "Track CHIPS/BIL domestic-content incentives"
    ],
    "branch_up": "Disruption persists: sustained supply-chain-tech procurement.",
    "branch_down": "Normalization: shift to optimization investment.",
    "outcome": "Visibility and nearshoring platforms capture corporate demand for resilience.",
    "failure": "Quick normalization.",
    "window": "30–540 days",
    "realWorld": {
      "invest": "Manhattan Associates (MANH), Descartes (DSGX), C.H. Robinson (CHRW). Freight: IYT, XTN.",
      "research": "Multi-tier supply-chain visibility research, nearshoring-finance platform analysis, inventory-optimization tooling evaluation."
    },
    "examples": [
      "Supply-chain visibility platforms",
      "Multi-tier supplier mapping",
      "Inventory-optimization tooling",
      "Freight and route analytics",
      "Nearshoring-finance platforms"
    ],
    "fastPath": [
      "1. Confirm SUPPLY_CHAIN_COLLAPSE",
      "2. Screen MANH/DSGX",
      "3. Research CHIPS Act and DPA Title III supply-chain incentive landscape"
    ]
  },
  {
    "id": "port_blockade",
    "title": "Port Blockade Response",
    "type": "invest",
    "domains": [
      "trade",
      "defense"
    ],
    "pattern": "trade_port",
    "explain": "Port closure, chokepoint disruption, or shipping-lane blockade. Portal diagnosis PORT_BLOCKADE maps through chokepoint-disruption, port-closure, and rerouting-cost signals.",
    "action": "Position in alternative-route logistics, tanker operators, and chokepoint-resilience tooling.",
    "valueRange": "15–40% tanker and alternative-route returns",
    "saturation": "medium",
    "trigger": "Trade stress > 0.50 with chokepoint_disruption, port_closure, or rerouting_cost conditions active.",
    "validation": "Confirm MARAD, IMO, Drewry, Clarksons data.",
    "steps": [
      "Drill into Trade portal PORT_BLOCKADE",
      "Review alternative-route treatments",
      "Position in tanker operators (FRO, DHT, TNK)",
      "Screen chokepoint-resilience tooling",
      "Monitor MARAD emergency contracts"
    ],
    "branch_up": "Extended blockade: sustained tanker day-rate premium.",
    "branch_down": "Resolution: rotate out of tanker exposure.",
    "outcome": "Tanker operators capture day-rate surge. Alternative-route operators capture rerouting volume.",
    "failure": "Quick resolution.",
    "window": "7–180 days",
    "realWorld": {
      "invest": "Tankers: Frontline (FRO), DHT Holdings (DHT), Teekay Tankers (TNK). Container: ZIM, Maersk. Drybulk: BDRY.",
      "research": "Chokepoint-monitoring, route-optimization under disruption, maritime-resilience analytics."
    },
    "examples": [
      "Tanker and container operators",
      "Chokepoint-monitoring tooling",
      "Alternative-route optimization",
      "Maritime-resilience analytics",
      "Port-congestion tracking"
    ],
    "fastPath": [
      "1. Confirm PORT_BLOCKADE",
      "2. Position in tanker operators (FRO/DHT)",
      "3. Research MARAD emergency contract landscape"
    ]
  },
  {
    "id": "trade_war_trade",
    "title": "Trade War Response",
    "type": "invest",
    "domains": [
      "trade",
      "governance",
      "industry"
    ],
    "pattern": "trade_trade_war",
    "explain": "Tariff escalation, retaliatory measures, and rules-of-origin complexity. Portal diagnosis TRADE_WAR maps through tariff-escalation, retaliatory-measure, and rules-complexity signals.",
    "action": "Position in trade-compliance tooling, customs-brokerage, and rules-of-origin analytics.",
    "valueRange": "10–25% trade-compliance returns",
    "saturation": "medium",
    "trigger": "Trade stress > 0.45 with tariff_escalation, retaliatory_measure, or rules_complexity conditions active.",
    "validation": "Confirm USTR Section 301/232 actions, Commerce BIS, CBP data.",
    "steps": [
      "Drill into Trade portal TRADE_WAR",
      "Review compliance treatments",
      "Screen Descartes (DSGX), E2open (ETWO), Thomson Reuters Trade",
      "Track USTR/BIS actions",
      "Monitor CHIPS/IRA domestic-content impact"
    ],
    "branch_up": "Escalation compounds: sustained compliance-tech demand.",
    "branch_down": "Trade deal: rotate to open-trade plays.",
    "outcome": "Trade-compliance, customs-brokerage, and rules-of-origin platforms capture corporate demand.",
    "failure": "Quick resolution.",
    "window": "90 days–3 years",
    "realWorld": {
      "invest": "Descartes (DSGX), E2open (ETWO), Thomson Reuters (TRI), Kuehne + Nagel.",
      "research": "Rules-of-origin analytics, tariff-classification automation, customs-compliance AI."
    },
    "examples": [
      "Trade-compliance platforms",
      "Customs-brokerage tooling",
      "Rules-of-origin analytics",
      "Tariff-classification AI",
      "Trade-adjustment advisory"
    ],
    "fastPath": [
      "1. Confirm TRADE_WAR",
      "2. Screen DSGX/ETWO",
      "3. Research CHIPS Act and trade-adjustment landscape"
    ]
  },
  {
    "id": "shipping_crisis",
    "title": "Shipping Crisis Response",
    "type": "invest",
    "domains": [
      "trade",
      "industry"
    ],
    "pattern": "trade_shipping",
    "explain": "Freight-rate spike, container shortage, or shipping-capacity mismatch. Portal diagnosis SHIPPING_CRISIS maps through freight-rate-spike, container-shortage, and capacity-mismatch signals.",
    "action": "Position in shipping operators and freight-rate arbitrage platforms.",
    "valueRange": "15–40% shipping-equity returns",
    "saturation": "medium",
    "trigger": "Trade stress > 0.45 with freight_rate_spike, container_shortage, or capacity_mismatch conditions active.",
    "validation": "Confirm Drewry WCI, Baltic Dry, FBX rates.",
    "steps": [
      "Drill into Trade portal SHIPPING_CRISIS",
      "Review freight treatments",
      "Position in ZIM, Maersk, BDRY",
      "Screen freight-rate arbitrage platforms",
      "Monitor WCI and BDI"
    ],
    "branch_up": "Rates sustained: extended shipping-equity returns.",
    "branch_down": "Capacity returns: rotate out.",
    "outcome": "Shipping operators and freight platforms capture rate-surge returns.",
    "failure": "Capacity returns quickly.",
    "window": "30–360 days",
    "realWorld": {
      "invest": "Shipping: ZIM Integrated (ZIM), Maersk (MAERSK-B.CO), Costamare (CMRE). Drybulk: BDRY.",
      "research": "Freight-rate arbitrage platforms, shipping-capacity analytics, container-tracking tooling."
    },
    "examples": [
      "Container and drybulk shipping equities",
      "Freight-rate arbitrage platforms",
      "Shipping-capacity analytics",
      "Container-tracking tooling",
      "Route-optimization services"
    ],
    "fastPath": [
      "1. Confirm SHIPPING_CRISIS",
      "2. Position in ZIM or BDRY",
      "3. Monitor WCI/BDI for exit"
    ]
  },
  {
    "id": "customs_disruption",
    "title": "Customs Disruption Response",
    "type": "invest",
    "domains": [
      "trade",
      "law"
    ],
    "pattern": "trade_customs",
    "explain": "Customs-system failure, border backlog, or regulatory-compliance breakdown. Portal diagnosis CUSTOMS_DISRUPTION maps through system-failure, border-backlog, and compliance-breakdown signals.",
    "action": "Position in customs-brokerage automation and border-intelligence tooling.",
    "valueRange": "10–20% customs-automation returns",
    "saturation": "low",
    "trigger": "Trade stress > 0.40 with system_failure, border_backlog, or compliance_breakdown conditions active.",
    "validation": "Confirm CBP throughput, WCO data, customs-modernization contracts.",
    "steps": [
      "Drill into Trade portal CUSTOMS_DISRUPTION",
      "Review automation treatments",
      "Screen Descartes, E2open, Avalara (AVLR)",
      "Position in customs-modernization contractors",
      "Track CBP ACE modernization"
    ],
    "branch_up": "Disruption persists: multi-year customs-modernization wave.",
    "branch_down": "Resolution: rotate to optimization investment.",
    "outcome": "Customs-automation vendors capture CBP and corporate demand.",
    "failure": "Quick resolution.",
    "window": "60 days–3 years",
    "realWorld": {
      "invest": "Descartes (DSGX), Avalara (AVLR), Flex (FLEX), E2open (ETWO).",
      "research": "Customs-brokerage automation, border-intelligence tooling, trade-documentation AI."
    },
    "examples": [
      "Customs-brokerage automation",
      "Border-intelligence tooling",
      "Trade-documentation AI",
      "Customs-modernization contracting",
      "Compliance-workflow platforms"
    ],
    "fastPath": [
      "1. Confirm CUSTOMS_DISRUPTION",
      "2. Screen DSGX/AVLR",
      "3. Research CBP ACE modernization and DHS S&T landscape"
    ]
  },
  {
    "id": "trade_data_gap",
    "title": "Trade Data Gap → Research",
    "type": "research",
    "domains": [
      "trade"
    ],
    "pattern": null,
    "explain": "Trade monitoring has gaps. Build trade-intelligence platforms.",
    "action": "Build real-time trade-intelligence platforms.",
    "valueRange": "$500K–$10M trade-data infrastructure",
    "saturation": "low",
    "trigger": "Trade sources showing DEGRADED or FALLBACK status.",
    "validation": "Check feed health.",
    "steps": [
      "Check Trade feed health",
      "Count OFFLINE",
      "Identify gap",
      "Build pipeline",
      "Apply to DoT/CBP or industry partnerships"
    ],
    "branch_up": "Gap persists: build.",
    "branch_down": "Sources recover: monitor.",
    "outcome": "Trade-intelligence platform.",
    "failure": "Panjiva/ImportGenius absorb.",
    "window": "30 days–18 months",
    "realWorld": {
      "invest": "N/A",
      "research": "DoT research, CBP data partnerships, Bureau of Economic Analysis — container-flow analytics, supplier-intelligence, tariff-impact dashboards."
    },
    "examples": [
      "Container-flow analytics",
      "Supplier-intelligence platforms",
      "Tariff-impact dashboards",
      "Freight-rate intelligence",
      "Supply-chain-risk monitoring"
    ],
    "fastPath": [
      "1. Check feed health",
      "2. Identify gap",
      "3. Pursue DoT or CBP partnership"
    ]
  }
];

  window.LIMENTradeOpportunityPlaybooks = PLAYBOOKS;
  window.LIMENTradeOpportunityPlaybooks.byId = function (id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  };
})();
