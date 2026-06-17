/* AUTO-GENERATED finance taxonomy data (C6 pilot, gen.cjs). Extracted verbatim
 * from the original finance engine constants. Loaded before the shims. */
window.LIMENTaxData = window.LIMENTaxData || {};
window.LIMENTaxData.finance = {
  "directiveRanker": {
    "EVIDENCE_SCORE": {
      "Strong": 1,
      "A": 1,
      "Moderate": 0.7,
      "B": 0.7,
      "Emerging": 0.4,
      "C": 0.4,
      "Limited": 0.2,
      "D": 0.2
    },
    "TYPE_ACTION_MAP": {
      "STRUCTURAL": {
        "paths": [
          "INVESTABLE",
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.9
      },
      "DIAGNOSTIC": {
        "paths": [
          "PATENTABLE",
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.7
      },
      "STRATEGY": {
        "paths": [
          "INVESTABLE",
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.85
      },
      "strategy": {
        "paths": [
          "INVESTABLE",
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.85
      },
      "regulatory": {
        "paths": [
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.8
      },
      "tools": {
        "paths": [
          "PATENTABLE",
          "INVESTABLE"
        ],
        "weight": 0.75
      },
      "coaching": {
        "paths": [
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.5
      },
      "COACHING": {
        "paths": [
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.5
      },
      "culture": {
        "paths": [
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.4
      },
      "diplomatic": {
        "paths": [
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.45
      },
      "structural": {
        "paths": [
          "INVESTABLE",
          "GRANT-ELIGIBLE"
        ],
        "weight": 0.9
      }
    },
    "ROLE_WEIGHT": {
      "executor": 1,
      "router": 0.9,
      "allocator": 0.85,
      "gatekeeper": 0.8,
      "signal_detector": 0.75,
      "buffer": 0.7,
      "amplifier": 0.65,
      "stabilizer": 0.6,
      "arbitrator": 0.55
    },
    "DEPTH_FACTOR": [
      1,
      0.97,
      0.92,
      0.85,
      0.75,
      0.65,
      0.55
    ],
    "MECHANISMS": {
      "credit_contraction": {
        "label": "Credit Contraction",
        "signals": [
          "credit",
          "lending",
          "loan",
          "mortgage",
          "underwriting",
          "default",
          "delinquency",
          "npl"
        ]
      },
      "market_dislocation": {
        "label": "Market Dislocation",
        "signals": [
          "market",
          "equity",
          "index",
          "correction",
          "crash",
          "bubble",
          "valuation",
          "multiple"
        ]
      },
      "liquidity_crisis": {
        "label": "Liquidity Crisis",
        "signals": [
          "liquidity",
          "redemption",
          "margin",
          "collateral",
          "repo",
          "interbank",
          "funding",
          "cash"
        ]
      },
      "currency_stress": {
        "label": "Currency Stress",
        "signals": [
          "currency",
          "fx",
          "exchange rate",
          "devaluation",
          "peg",
          "reserves",
          "capital flight"
        ]
      },
      "systemic_contagion": {
        "label": "Systemic Contagion",
        "signals": [
          "systemic",
          "contagion",
          "counterparty",
          "interconnect",
          "cascad",
          "domino",
          "too big"
        ]
      },
      "regulatory_shock": {
        "label": "Regulatory Shock",
        "signals": [
          "regulatory",
          "regulation",
          "compliance",
          "enforcement",
          "fine",
          "penalty",
          "sanction",
          "ban"
        ]
      },
      "interest_rate_impact": {
        "label": "Interest Rate Impact",
        "signals": [
          "interest rate",
          "yield",
          "duration",
          "spread",
          "inversion",
          "basis point",
          "fed fund"
        ]
      },
      "insurance_disruption": {
        "label": "Insurance Disruption",
        "signals": [
          "insurance",
          "underwriting",
          "claims",
          "reinsurance",
          "actuarial",
          "catastrophe",
          "loss ratio"
        ]
      },
      "fraud_exposure": {
        "label": "Fraud Exposure",
        "signals": [
          "fraud",
          "accounting",
          "misrepresent",
          "ponzi",
          "embezzle",
          "insider",
          "manipulat",
          "scandal"
        ]
      },
      "capital_structure": {
        "label": "Capital Structure",
        "signals": [
          "capital",
          "equity",
          "debt",
          "leverage",
          "restructuring",
          "bankruptcy",
          "covenant",
          "tier 1"
        ]
      }
    },
    "DX_VALID_MECHANISMS": {
      "BANKING_CRISIS": [
        "credit_contraction",
        "liquidity_crisis",
        "systemic_contagion",
        "capital_structure",
        "regulatory_shock",
        "interest_rate_impact"
      ],
      "CREDIT_FREEZE": [
        "credit_contraction",
        "liquidity_crisis",
        "interest_rate_impact",
        "capital_structure",
        "market_dislocation"
      ],
      "MARKET_CRASH": [
        "market_dislocation",
        "liquidity_crisis",
        "systemic_contagion",
        "interest_rate_impact",
        "capital_structure"
      ],
      "CURRENCY_COLLAPSE": [
        "currency_stress",
        "liquidity_crisis",
        "capital_structure",
        "systemic_contagion",
        "regulatory_shock"
      ],
      "SYSTEMIC_CONTAGION": [
        "systemic_contagion",
        "liquidity_crisis",
        "credit_contraction",
        "market_dislocation",
        "capital_structure",
        "currency_stress"
      ],
      "FRAUD_SCANDAL": [
        "fraud_exposure",
        "regulatory_shock",
        "capital_structure",
        "market_dislocation",
        "credit_contraction"
      ]
    },
    "DRIFT_SIGNALS": [
      "equity program",
      "assistance program",
      "social program",
      "community engagement",
      "stakeholder alignment",
      "workforce development",
      "cultural program",
      "certification program",
      "training curriculum",
      "coaching program",
      "onboarding",
      "outreach",
      "awareness campaign"
    ]
  },
  "targetingEngine": {
    "SEGMENTS": {
      "commercial_banking": {
        "label": "Commercial & retail banking institutions",
        "keywords": [
          "banking",
          "deposit",
          "lending",
          "loan",
          "credit facility",
          "commercial bank",
          "retail bank",
          "checking",
          "savings",
          "branch",
          "consumer credit"
        ],
        "tier3": [
          {
            "name": "JPMorgan Chase",
            "ticker": "JPM"
          },
          {
            "name": "Bank of America",
            "ticker": "BAC"
          },
          {
            "name": "Wells Fargo",
            "ticker": "WFC"
          },
          {
            "name": "Citigroup",
            "ticker": "C"
          },
          {
            "name": "U.S. Bancorp",
            "ticker": "USB"
          }
        ]
      },
      "investment_banking": {
        "label": "Investment banks & capital markets firms",
        "keywords": [
          "investment bank",
          "capital markets",
          "M&A",
          "merger",
          "acquisition",
          "underwriting",
          "IPO",
          "advisory",
          "deal",
          "syndication",
          "structured finance"
        ],
        "tier3": [
          {
            "name": "Goldman Sachs",
            "ticker": "GS"
          },
          {
            "name": "Morgan Stanley",
            "ticker": "MS"
          },
          {
            "name": "Charles Schwab",
            "ticker": "SCHW"
          },
          {
            "name": "Raymond James",
            "ticker": "RJF"
          }
        ]
      },
      "insurance": {
        "label": "Insurance carriers & reinsurers",
        "keywords": [
          "insurance",
          "underwrite",
          "premium",
          "claims",
          "actuarial",
          "reinsurance",
          "casualty",
          "property",
          "life insurance",
          "annuity",
          "loss ratio"
        ],
        "tier3": [
          {
            "name": "Berkshire Hathaway",
            "ticker": "BRK.B"
          },
          {
            "name": "Progressive",
            "ticker": "PGR"
          },
          {
            "name": "Allstate",
            "ticker": "ALL"
          },
          {
            "name": "MetLife",
            "ticker": "MET"
          },
          {
            "name": "AIG",
            "ticker": "AIG"
          }
        ]
      },
      "asset_management": {
        "label": "Asset managers & wealth management firms",
        "keywords": [
          "asset management",
          "wealth",
          "portfolio",
          "fund",
          "AUM",
          "allocation",
          "fiduciary",
          "ETF",
          "mutual fund",
          "index",
          "passive",
          "active management"
        ],
        "tier3": [
          {
            "name": "BlackRock",
            "ticker": "BLK"
          },
          {
            "name": "Charles Schwab",
            "ticker": "SCHW"
          },
          {
            "name": "T. Rowe Price",
            "ticker": "TROW"
          },
          {
            "name": "Invesco",
            "ticker": "IVZ"
          },
          {
            "name": "Franklin Templeton",
            "ticker": "BEN"
          }
        ]
      },
      "fintech": {
        "label": "Financial technology & digital finance platforms",
        "keywords": [
          "fintech",
          "digital",
          "neobank",
          "blockchain",
          "crypto",
          "DeFi",
          "robo-advisor",
          "embedded finance",
          "open banking",
          "API banking",
          "digital wallet",
          "BNPL"
        ],
        "tier3": [
          {
            "name": "Block (Square)",
            "ticker": "SQ"
          },
          {
            "name": "PayPal",
            "ticker": "PYPL"
          },
          {
            "name": "Affirm",
            "ticker": "AFRM"
          },
          {
            "name": "SoFi Technologies",
            "ticker": "SOFI"
          },
          {
            "name": "Upstart",
            "ticker": "UPST"
          }
        ]
      },
      "private_equity": {
        "label": "Private equity & alternative investment firms",
        "keywords": [
          "private equity",
          "buyout",
          "leveraged",
          "LBO",
          "portfolio company",
          "carried interest",
          "fund of funds",
          "secondary",
          "co-invest",
          "GP",
          "LP"
        ],
        "tier3": [
          {
            "name": "KKR",
            "ticker": "KKR"
          },
          {
            "name": "Apollo Global",
            "ticker": "APO"
          },
          {
            "name": "Blackstone",
            "ticker": "BX"
          },
          {
            "name": "Carlyle Group",
            "ticker": "CG"
          },
          {
            "name": "Ares Management",
            "ticker": "ARES"
          }
        ]
      },
      "venture_capital": {
        "label": "Venture capital & growth equity firms",
        "keywords": [
          "venture capital",
          "seed",
          "series A",
          "series B",
          "startup",
          "growth equity",
          "early stage",
          "pre-IPO",
          "angel",
          "incubator",
          "accelerator"
        ],
        "tier3": [
          {
            "name": "Andreessen Horowitz (a16z)",
            "ticker": null
          },
          {
            "name": "Sequoia Capital",
            "ticker": null
          },
          {
            "name": "Accel Partners",
            "ticker": null
          },
          {
            "name": "Benchmark Capital",
            "ticker": null
          },
          {
            "name": "Lightspeed Venture Partners",
            "ticker": null
          }
        ]
      },
      "exchanges_clearing": {
        "label": "Exchanges, clearinghouses & market infrastructure",
        "keywords": [
          "exchange",
          "clearing",
          "settlement",
          "market structure",
          "order book",
          "matching engine",
          "CCP",
          "central counterparty",
          "listing",
          "dark pool",
          "ATS"
        ],
        "tier3": [
          {
            "name": "Intercontinental Exchange",
            "ticker": "ICE"
          },
          {
            "name": "CME Group",
            "ticker": "CME"
          },
          {
            "name": "Nasdaq",
            "ticker": "NDAQ"
          },
          {
            "name": "Cboe Global Markets",
            "ticker": "CBOE"
          }
        ]
      },
      "rating_agencies": {
        "label": "Credit rating agencies & financial data providers",
        "keywords": [
          "rating",
          "credit rating",
          "sovereign",
          "bond rating",
          "credit score",
          "FICO",
          "analytics",
          "benchmark",
          "financial data",
          "credit assessment"
        ],
        "tier3": [
          {
            "name": "S&P Global",
            "ticker": "SPGI"
          },
          {
            "name": "Moody's",
            "ticker": "MCO"
          }
        ]
      },
      "payments": {
        "label": "Payment networks & processing firms",
        "keywords": [
          "payment",
          "transaction",
          "card",
          "interchange",
          "merchant",
          "acquiring",
          "issuing",
          "POS",
          "contactless",
          "wire",
          "ACH",
          "real-time payment",
          "remittance"
        ],
        "tier3": [
          {
            "name": "Visa",
            "ticker": "V"
          },
          {
            "name": "Mastercard",
            "ticker": "MA"
          },
          {
            "name": "American Express",
            "ticker": "AXP"
          },
          {
            "name": "Discover Financial",
            "ticker": "DFS"
          }
        ]
      },
      "mortgage": {
        "label": "Mortgage lenders & real estate finance",
        "keywords": [
          "mortgage",
          "home loan",
          "origination",
          "servicing",
          "MBS",
          "agency",
          "conforming",
          "non-conforming",
          "REIT",
          "housing",
          "refinance",
          "securitization"
        ],
        "tier3": [
          {
            "name": "Rocket Companies",
            "ticker": "RKT"
          },
          {
            "name": "UWM Holdings",
            "ticker": "UWMC"
          },
          {
            "name": "Annaly Capital",
            "ticker": "NLY"
          },
          {
            "name": "AGNC Investment",
            "ticker": "AGNC"
          }
        ]
      },
      "regulatory": {
        "label": "Financial regulators & oversight bodies",
        "keywords": [
          "regulatory",
          "compliance",
          "supervision",
          "examination",
          "enforcement",
          "capital requirement",
          "Basel",
          "Dodd-Frank",
          "stress test",
          "AML",
          "KYC",
          "BSA",
          "sanction"
        ],
        "tier3": [
          {
            "name": "SEC",
            "ticker": null
          },
          {
            "name": "FDIC",
            "ticker": null
          },
          {
            "name": "OCC",
            "ticker": null
          },
          {
            "name": "FINRA",
            "ticker": null
          },
          {
            "name": "CFPB",
            "ticker": null
          }
        ]
      }
    },
    "NODE_SEGMENTS": {
      "STRI": [
        "commercial_banking",
        "mortgage"
      ],
      "FORN": [
        "payments",
        "exchanges_clearing"
      ],
      "OFC": [
        "exchanges_clearing",
        "investment_banking"
      ],
      "S1": [
        "commercial_banking",
        "regulatory"
      ],
      "vmPFC": [
        "regulatory",
        "rating_agencies"
      ],
      "CBLM": [
        "asset_management",
        "private_equity"
      ],
      "M1": [
        "investment_banking",
        "private_equity"
      ],
      "THAL": [
        "commercial_banking",
        "fintech"
      ],
      "VTA": [
        "fintech",
        "payments"
      ],
      "PAG": [
        "insurance",
        "mortgage"
      ],
      "NTS": [
        "asset_management",
        "venture_capital"
      ],
      "HIPP": [
        "fintech",
        "exchanges_clearing"
      ],
      "CC": [
        "payments",
        "commercial_banking"
      ],
      "dlPFC": [
        "regulatory",
        "rating_agencies"
      ],
      "dACC": [
        "insurance",
        "rating_agencies"
      ],
      "ENS": [
        "regulatory",
        "commercial_banking"
      ],
      "CAUD": [
        "venture_capital",
        "fintech"
      ],
      "FEF": [
        "private_equity",
        "venture_capital"
      ],
      "BNST": [
        "mortgage",
        "insurance"
      ],
      "EMP": [
        "asset_management",
        "exchanges_clearing"
      ]
    },
    "EXCLUSIONS": {
      "commercial_banking": [
        "SQ",
        "PYPL",
        "AFRM",
        "SOFI",
        "UPST",
        "KKR",
        "APO",
        "BX"
      ],
      "investment_banking": [
        "RKT",
        "UWMC",
        "PYPL",
        "SQ",
        "AFRM"
      ],
      "insurance": [
        "SQ",
        "PYPL",
        "GS",
        "MS",
        "KKR",
        "ICE",
        "CME"
      ],
      "asset_management": [
        "RKT",
        "UWMC",
        "AFRM",
        "UPST",
        "SQ"
      ],
      "fintech": [
        "JPM",
        "BAC",
        "WFC",
        "BRK.B",
        "NLY",
        "AGNC",
        "MCO",
        "SPGI"
      ],
      "private_equity": [
        "V",
        "MA",
        "RKT",
        "UWMC",
        "PYPL",
        "SQ",
        "PGR",
        "ALL"
      ],
      "venture_capital": [
        "JPM",
        "BAC",
        "WFC",
        "V",
        "MA",
        "BRK.B",
        "NLY",
        "AGNC"
      ],
      "exchanges_clearing": [
        "RKT",
        "UWMC",
        "BRK.B",
        "PGR",
        "ALL",
        "MET"
      ],
      "rating_agencies": [
        "SQ",
        "PYPL",
        "RKT",
        "UWMC",
        "KKR",
        "APO"
      ],
      "payments": [
        "GS",
        "MS",
        "KKR",
        "APO",
        "BX",
        "NLY",
        "AGNC",
        "RKT"
      ],
      "mortgage": [
        "GS",
        "MS",
        "SQ",
        "PYPL",
        "ICE",
        "CME",
        "NDAQ"
      ],
      "regulatory": [
        "SQ",
        "PYPL",
        "KKR",
        "APO",
        "BX",
        "V",
        "MA"
      ]
    }
  },
  "directiveTranslator": {
    "PATH_LABELS": {
      "INVESTABLE": "INVEST",
      "GRANT-ELIGIBLE": "GRANT",
      "PATENTABLE": "PATENT"
    },
    "REJECT_SIGNALS": [
      {},
      {},
      {},
      {},
      {},
      {}
    ],
    "ACTION_VERBS": {
      "STRUCTURAL": [
        "Deploy",
        "Install",
        "Integrate",
        "Procure",
        "Contract"
      ],
      "DIAGNOSTIC": [
        "Audit",
        "Score",
        "Map",
        "Benchmark",
        "Assess"
      ],
      "STRATEGY": [
        "Build",
        "Package",
        "Deliver",
        "Sell",
        "License"
      ],
      "COACHING": [
        "Train",
        "Certify",
        "Brief",
        "Onboard"
      ],
      "tools": [
        "Deploy",
        "Configure",
        "Integrate",
        "License"
      ],
      "regulatory": [
        "File",
        "Submit",
        "Prepare",
        "Package"
      ],
      "trading": [
        "Execute",
        "Hedge",
        "Position",
        "Arbitrage"
      ],
      "compliance": [
        "Audit",
        "Remediate",
        "File",
        "Certify"
      ]
    },
    "REVENUE_MODELS": {
      "INVESTABLE": [
        {
          "model": "advisory",
          "desc": "Build a stress-exposure scorecard for financial institutions. Sell to trading desks and portfolio managers at affected firms. $25K-$100K per engagement."
        },
        {
          "model": "trading",
          "desc": "Buy underpriced financial assets in the disrupted segment. Hold through stress resolution. Target 15-30% sector premium on exit."
        },
        {
          "model": "intelligence",
          "desc": "Build a live monitoring dashboard for this financial disruption. Sell subscriptions to banks and funds. $5K-$50K/mo per seat."
        }
      ],
      "GRANT-ELIGIBLE": [
        {
          "model": "grant award",
          "desc": "Write a grant proposal backed by live stress data. Submit to Treasury CDFI/CFPB/state banking commission. $250K-$5M per award. 60-180 day cycle."
        },
        {
          "model": "consulting",
          "desc": "Win the grant. Deliver the funded compliance or infrastructure project. Bill implementation hours at $250-$500/hr against the award budget."
        },
        {
          "model": "cost recovery",
          "desc": "Implement the solution for a regulated institution. Bill costs through their approved compliance budget. Guaranteed recovery."
        }
      ],
      "PATENTABLE": [
        {
          "model": "licensing",
          "desc": "File a provisional patent on the solution method. License it to every bank and fintech in the affected segment. 5-15% royalty per implementation."
        },
        {
          "model": "SaaS",
          "desc": "Turn the patented method into a compliance/risk platform. Sell subscriptions. $10K-$100K/mo per institution."
        },
        {
          "model": "acquisition",
          "desc": "Build the IP portfolio around financial infrastructure. Position for acquisition by a strategic buyer. $5M-$100M exit depending on coverage."
        }
      ]
    },
    "DELIVERABLE_MAP": {
      "STRUCTURAL": "Finished deployment plan: vendor-scored shortlist, integration timeline, cost model, and procurement-ready RFP",
      "DIAGNOSTIC": "Completed risk scorecard: ranked institution list, exposure heat map, and action-prioritized recommendation matrix",
      "STRATEGY": "Executable strategy deck: market sizing, ranked target list, 90-day execution plan, and financial model",
      "COACHING": "Delivered training program: certified compliance workforce with skills verification and readiness scorecard",
      "tools": "Configured system: integrated platform with monitoring dashboard, alert rules, and operator runbook",
      "regulatory": "Submission-ready filing: complete application with budget narrative, evidence attachments, and compliance checklist",
      "trading": "Trade execution package: entry/exit parameters, risk limits, position sizing model, and monitoring dashboard",
      "compliance": "Compliance audit report: gap analysis, remediation roadmap, filing-ready documentation, and board presentation"
    },
    "TITLE_TEMPLATES": [
      {
        "match": {},
        "titles": [
          "Build credit risk scoring model — sell to banks with portfolio stress"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build loan loss prediction model — sell to commercial banks and servicers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build market risk stress test — sell to trading desks and risk committees"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build currency exposure model — sell to treasurers and FX desks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build claims prediction model — sell to insurance carriers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build underwriting optimization tool — sell to insurance underwriters"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build fintech risk assessment framework — sell to digital lenders"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build capital adequacy optimizer — sell to banks facing stress tests"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build compliance automation platform — sell to banks and fintechs"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build deal flow scoring model — sell to investment banks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build rate sensitivity model — sell to fixed income desks and treasurers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build derivatives pricing engine — sell to trading desks and risk managers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build mortgage prepayment model — sell to MBS traders and servicers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build alpha signal detector — sell to hedge funds and quant desks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build PE deal scoring model — sell to private equity firms"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build startup risk scorecard — sell to VC firms and accelerators"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build debt covenant monitoring tool — sell to leveraged finance desks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build equity screening model — sell to research desks and asset managers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build treasury optimization model — sell to corporate treasurers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build enterprise risk dashboard — sell to CROs and risk committees"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build portfolio optimization engine — sell to asset managers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build payment flow optimizer — sell to processors and merchants"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build fraud detection model — sell to banks and payment networks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build digital asset risk framework — sell to crypto exchanges and custodians"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build stress scenario engine — sell to banks facing regulatory exams"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build securitization analytics tool — sell to structured finance desks"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build margin optimization model — sell to clearinghouses and prime brokers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build credit surveillance tool — sell to rating agencies and credit analysts"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build wealth advisory platform — sell to RIAs and wealth managers"
        ]
      },
      {
        "match": {},
        "titles": [
          "Build financial sector risk scorecard — sell to {target}"
        ]
      }
    ]
  },
  "promotionBridge": {}
};
