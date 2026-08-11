/**
 * brain-v2/bind/diagnosis-registry.js — the sixty-three diagnoses, as DATA.
 *
 * WHY THIS FILE IS DATA AND NOT CODE. Each of these was a JavaScript function living beside
 * its domain declaration. Nothing enumerated them, nothing bounded what a new one could
 * express, and answering "what does this system actually test for?" meant reading sixty-three
 * function bodies across twenty files. The predicates themselves turned out to be small and
 * repetitive: mechanically classified, all sixty-three fall into ten forms with zero left
 * over. The library was always this narrow. It just was not written down.
 *
 * So the definitions moved here and the arithmetic moved to bind/diagnosis-forms.js, which is
 * reviewed code. An entry names a form and supplies operands and thresholds. It cannot carry a
 * function, a closure, or an expression string; the interpreter never evaluates text.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS FILE CHANGED NO DIAGNOSIS.
 *
 * It was GENERATED from the predicates it replaces, and brain-v2/test/diagnosis-registry.js
 * proves the equivalence by evaluating both the pre-migration functions (read out of git at
 * the baseline commit) and these entries against the same inputs, requiring identical fired /
 * did-not-fire / could-not-be-judged outcomes. Regenerate the mapping any time with
 * `node scripts/brain-audit/regen-finding-map.js`.
 *
 * Adding a diagnosis, a form, or a threshold is a separate review. This PR moved
 * representation and nothing else.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * KEYED BY (domain, id), NEVER BY id. Four domains declare NEW_KEV_30D_DEPARTURE and three
 * declare each of PHYSICAL_HAZARDS_CO_DEPARTING, SEISMIC_DEPARTURE and WEATHER_ALERT_DEPARTURE.
 * A registry keyed on the id alone would silently collapse eleven entries into four and the
 * domains that lost theirs would report nothing rather than an error.
 */

'use strict';

/** Shape of these records. Bumped when fields are added or retyped. */
var SCHEMA_VERSION = 1;

/**
 * Meaning of these diagnoses. Version 1 is the pre-migration library, unchanged. This moves
 * INDEPENDENTLY of SCHEMA_VERSION: a reformatted record with identical meaning and a
 * re-defined diagnosis in an unchanged shape are opposite events, and one number cannot say
 * which happened.
 */
var DEFINITION_VERSION = 1;

/** Where these entries came from, so a reader can re-derive them rather than trust them. */
var PROVENANCE = { derivedFrom: 'binder FINDINGS[].test predicates', commit: 'ea5923ba',
                   method: 'scripts/brain-audit/regen-finding-map.js' };

function rec(o) {
  o.schemaVersion = SCHEMA_VERSION;
  o.definitionVersion = DEFINITION_VERSION;
  o.provenance = PROVENANCE;
  o.status = 'declared';
  return o;
}

/* 63 entries across 18 domains, in each domain's original declaration order. */
var DIAGNOSES = {
  agriculture: [
    rec({ id: "DROUGHT_AREA_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["droughtArea"],
      requires: ["droughtArea"],
      thresholds: ["SIGMA"],
      basis: "percentage of CONUS in D2-D4 drought departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "CORN_YIELD_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["cornYield"],
      requires: ["cornYield"],
      thresholds: ["SIGMA"],
      basis: "USDA corn yield departing its own baseline"
    }),
    rec({ id: "WHEAT_OUTPUT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["wheatIndex"],
      requires: ["wheatIndex"],
      thresholds: ["SIGMA"],
      basis: "FAO wheat output index departing its own baseline"
    }),
    rec({ id: "FOOD_PRODUCTION_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["foodIndex"],
      requires: ["foodIndex"],
      thresholds: ["SIGMA"],
      basis: "World Bank food production index departing its own baseline"
    }),
    rec({ id: "AG_ALERT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["agAlerts"],
      requires: ["agAlerts"],
      thresholds: ["SIGMA"],
      basis: "agriculture-impact weather alert count departing its own baseline"
    }),
    rec({ id: "DROUGHT_AND_ALERTS_CO_DEPARTING", form: "PAIR_CO_DEPART_ABS_SUM",
      operands: ["droughtArea", "agAlerts"],
      requires: ["droughtArea", "agAlerts"],
      thresholds: [1, 1, 2.5],
      basis: "measured drought area and agriculture-impact alerts both departing their own baselines — a slow area measure and a fast event count moving together, which either alone cannot distinguish from its own noise"
    })
  ],
  communication: [
    rec({ id: "INTERNET_ACCESS_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["internetUsers"],
      requires: ["internetUsers"],
      thresholds: ["SIGMA"],
      basis: "share of individuals using the internet departing its own baseline by >=2sd; annual, direction not interpreted"
    })
  ],
  defense: [
    rec({ id: "WEATHER_ALERT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["nwsAlerts"],
      requires: ["nwsAlerts"],
      thresholds: ["SIGMA"],
      basis: "active NWS alert count departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "SEISMIC_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["earthquakes"],
      requires: ["earthquakes"],
      thresholds: ["SIGMA"],
      basis: "M4.5+ earthquake count departing its own baseline"
    }),
    rec({ id: "NEW_KEV_30D_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["cisaKev"],
      requires: ["cisaKev"],
      thresholds: ["SIGMA"],
      basis: "count of KEV entries added in the last 30 days departing its own baseline"
    }),
    rec({ id: "PHYSICAL_HAZARDS_CO_DEPARTING", form: "PAIR_CO_DEPART_ABS_SUM",
      operands: ["nwsAlerts", "earthquakes"],
      requires: ["nwsAlerts", "earthquakes"],
      thresholds: [1, 1, 2.5],
      basis: "weather alerts and seismic activity both departing their own baselines — two independent hazard counts, which either alone cannot distinguish from its own noise"
    })
  ],
  economy: [
    rec({ id: "PRICE_SHOCK", form: "SINGLE_DEPART_ABS",
      operands: ["cpi"],
      requires: ["cpi"],
      thresholds: ["SIGMA"],
      basis: "monthly CPI change departing its own baseline by >=2sd"
    }),
    rec({ id: "POLICY_RATE_MOVE", form: "SINGLE_DEPART_ABS",
      operands: ["effr"],
      requires: ["effr"],
      thresholds: ["SIGMA"],
      basis: "effective fed funds rate departing its own baseline"
    }),
    rec({ id: "FUEL_PRICE_MOVE", form: "SINGLE_DEPART_ABS",
      operands: ["gasPrice"],
      requires: ["gasPrice"],
      thresholds: ["SIGMA"],
      basis: "retail gasoline price departing its own baseline"
    }),
    rec({ id: "LABOUR_MARKET_SHIFT", form: "SINGLE_DEPART_ABS",
      operands: ["payrolls"],
      requires: ["payrolls"],
      thresholds: ["SIGMA"],
      basis: "nonfarm payrolls departing their own baseline"
    }),
    rec({ id: "FISCAL_STRESS", form: "PAIR_CO_DEPART_ABS",
      operands: ["deficit", "cashBalance"],
      requires: ["deficit", "cashBalance"],
      thresholds: ["SIGMA", 1],
      basis: "the monthly deficit and the operating cash balance both departing their own baselines — two different fiscal quantities moving together, which one of them alone cannot show"
    }),
    rec({ id: "SYSTEMIC_ECONOMIC_STRESS", form: "DOMAIN_DEPART",
      operands: [],
      requires: ["cpi", "effr"],
      thresholds: ["SIGMA"],
      basis: "the fused domain state itself past 2sd, with a price and a rate both live"
    })
  ],
  education: [
    rec({ id: "EDUCATION_SPEND_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["eduSpend"],
      requires: ["eduSpend"],
      thresholds: ["SIGMA"],
      basis: "education expenditure as a share of GDP departing its own baseline by >=2sd; annual, direction not interpreted"
    }),
    rec({ id: "TERTIARY_ENROLMENT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["tertiaryEnrol"],
      requires: ["tertiaryEnrol"],
      thresholds: ["SIGMA"],
      basis: "gross tertiary enrolment ratio departing its own baseline; annual, direction not interpreted"
    })
  ],
  energy: [
    rec({ id: "OIL_SHOCK", form: "SINGLE_DEPART_SIGNED",
      operands: ["fredCrude"],
      requires: ["fredCrude"],
      thresholds: ["SIGMA"],
      basis: "FRED WTI departing its own baseline by >=2sd"
    }),
    rec({ id: "GRID_COLLAPSE", form: "PAIR_CO_DEPART_SIGNED",
      operands: ["gridRel", "electricity"],
      requires: ["gridRel", "electricity"],
      thresholds: ["SIGMA", 1],
      basis: "grid-reliability AND electricity news volume both elevated vs own baseline"
    }),
    rec({ id: "PIPELINE_DISRUPTION", form: "PAIR_EITHER_PLUS_SUM",
      operands: ["natGas", "lng"],
      requires: ["natGas", "lng"],
      thresholds: ["SIGMA", "SIGMA", 2.5],
      basis: "gas and LNG news co-elevated — chokepoint signature"
    }),
    rec({ id: "RENEWABLE_INTERMITTENCY", form: "PAIR_SUM_ONLY",
      operands: ["solar", "wind"],
      requires: ["solar", "wind"],
      thresholds: [2.5],
      basis: "solar and wind coverage elevated together"
    }),
    rec({ id: "NUCLEAR_INCIDENT", form: "PAIR_CO_DEPART_SIGNED",
      operands: ["nuclear", "fedRegNrc"],
      requires: ["nuclear", "fedRegNrc"],
      thresholds: ["SIGMA", 1],
      basis: "nuclear coverage AND NRC filing activity both departing baseline"
    }),
    rec({ id: "SYSTEMIC_ENERGY_STRESS", form: "DOMAIN_DEPART",
      operands: [],
      requires: ["fredCrude", "gridRel"],
      thresholds: ["SIGMA"],
      basis: "the fused domain state itself past 2sd, with price and grid both live"
    })
  ],
  environment: [
    rec({ id: "TEMPERATURE_ANOMALY", form: "SINGLE_DEPART_ABS",
      operands: ["tempAnomaly"],
      requires: ["tempAnomaly"],
      thresholds: ["SIGMA"],
      basis: "temperature anomaly departing its own baseline by >=2sd"
    }),
    rec({ id: "SEISMIC_ACTIVITY", form: "SINGLE_DEPART_SIGNED",
      operands: ["earthquakes"],
      requires: ["earthquakes"],
      thresholds: ["SIGMA"],
      basis: "M4.5+ earthquake count departing its own baseline"
    }),
    rec({ id: "SEVERE_WEATHER", form: "SINGLE_DEPART_SIGNED",
      operands: ["nwsAlerts"],
      requires: ["nwsAlerts"],
      thresholds: ["SIGMA"],
      basis: "active NWS alert count departing its own baseline"
    }),
    rec({ id: "COMPOUND_HAZARD", form: "PAIR_CO_DEPART_SIGNED_SUM",
      operands: ["nwsAlerts", "earthquakes"],
      requires: ["nwsAlerts", "earthquakes"],
      thresholds: [1, 1, 2.5],
      basis: "weather alerts and seismic activity both elevated — two independent hazard counts, which either alone cannot distinguish from its own noise"
    }),
    rec({ id: "SYSTEMIC_ENVIRONMENTAL_STRESS", form: "DOMAIN_DEPART",
      operands: [],
      requires: ["tempAnomaly", "nwsAlerts"],
      thresholds: ["SIGMA"],
      basis: "the fused domain state itself past 2sd, with a physical measure and an event count both live"
    })
  ],
  finance: [
    rec({ id: "MARKET_DISLOCATION", form: "SINGLE_DEPART_ABS",
      operands: ["finnhub"],
      requires: ["finnhub"],
      thresholds: ["SIGMA"],
      basis: "SPY departing its own baseline by >=2sd on a live quote"
    }),
    rec({ id: "FUNDING_STRESS", form: "SINGLE_DEPART_ABS",
      operands: ["sofr"],
      requires: ["sofr"],
      thresholds: ["SIGMA"],
      basis: "overnight secured rate departing its own baseline — a funding-market signal, not a level judgement"
    }),
    rec({ id: "CURVE_SHIFT", form: "SINGLE_DEPART_ABS",
      operands: ["yieldCurve"],
      requires: ["yieldCurve"],
      thresholds: ["SIGMA"],
      basis: "bills-minus-notes spread departing its own baseline"
    }),
    rec({ id: "VENDOR_DISAGREEMENT", form: "PAIR_SIGN_DISAGREE",
      operands: ["massiveSpy", "finnhub"],
      requires: ["massiveSpy", "finnhub"],
      thresholds: ["SIGMA"],
      basis: "two vendors on ONE instrument departing in opposite directions — an instrument cannot do that, so this is an instrumentation fault"
    }),
    rec({ id: "SYSTEMIC_FINANCIAL_STRESS", form: "DOMAIN_DEPART",
      operands: [],
      requires: ["finnhub", "sofr"],
      thresholds: ["SIGMA"],
      basis: "the fused domain state itself past 2sd, with a price and a rate both live"
    })
  ],
  governance: [
    rec({ id: "CORRUPTION_INDEX_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["corruption"],
      requires: ["corruption"],
      thresholds: ["SIGMA"],
      basis: "control-of-corruption index departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "GOV_EFFECTIVENESS_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["govEffect"],
      requires: ["govEffect"],
      thresholds: ["SIGMA"],
      basis: "government-effectiveness index departing its own baseline; direction not interpreted"
    }),
    rec({ id: "RULE_OF_LAW_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["ruleOfLaw"],
      requires: ["ruleOfLaw"],
      thresholds: ["SIGMA"],
      basis: "rule-of-law index departing its own baseline; direction not interpreted"
    })
  ],
  health: [
    rec({ id: "ADVERSE_EVENT_SURGE", form: "SINGLE_DEPART_SIGNED",
      operands: ["adverseEvents"],
      requires: ["adverseEvents"],
      thresholds: ["SIGMA"],
      basis: "openFDA adverse event reports departing their own baseline by >=2sd"
    }),
    rec({ id: "ENFORCEMENT_SURGE", form: "SINGLE_DEPART_SIGNED",
      operands: ["drugRecalls"],
      requires: ["drugRecalls"],
      thresholds: ["SIGMA"],
      basis: "openFDA drug enforcement actions in the 30d window departing their own baseline"
    }),
    rec({ id: "SUPPLY_SHORTAGE", form: "SINGLE_DEPART_SIGNED",
      operands: ["drugShortages"],
      requires: ["drugShortages"],
      thresholds: ["SIGMA"],
      basis: "tracked drug shortages departing their own baseline"
    }),
    rec({ id: "SAFETY_AND_SUPPLY_TOGETHER", form: "PAIR_CO_DEPART_SIGNED_SUM",
      operands: ["drugRecalls", "drugShortages"],
      requires: ["drugRecalls", "drugShortages"],
      thresholds: [1, 1, 2.5],
      basis: "enforcement actions and tracked shortages both elevated — two separately reported quantities moving together, which either alone cannot distinguish from its own noise"
    }),
    rec({ id: "SYSTEMIC_HEALTH_STRESS", form: "DOMAIN_DEPART",
      operands: [],
      requires: ["adverseEvents", "drugShortages"],
      thresholds: ["SIGMA"],
      basis: "the fused domain state itself past 2sd, with two reported quantities live"
    })
  ],
  industry: [
    rec({ id: "MFG_PRICE_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["mfgPpi"],
      requires: ["mfgPpi"],
      thresholds: ["SIGMA"],
      basis: "manufacturing producer price index departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "MFG_VALUE_ADDED_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["mfgValueAdd"],
      requires: ["mfgValueAdd"],
      thresholds: ["SIGMA"],
      basis: "manufacturing value added as a share of GDP departing its own baseline; annual, so it will usually abstain"
    })
  ],
  infrastructure: [
    rec({ id: "CONSTRUCTION_SPEND_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["construction"],
      requires: ["construction"],
      thresholds: ["SIGMA"],
      basis: "construction spending percentage change departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "TRANSPORT_VOLUME_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["transportIndex"],
      requires: ["transportIndex"],
      thresholds: ["SIGMA"],
      basis: "transportation services index percentage change departing its own baseline"
    }),
    rec({ id: "FEDERAL_INVESTMENT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["fedInvestment"],
      requires: ["fedInvestment"],
      thresholds: ["SIGMA"],
      basis: "federal investment percentage change departing its own baseline"
    }),
    rec({ id: "WEATHER_ALERT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["nwsAlerts"],
      requires: ["nwsAlerts"],
      thresholds: ["SIGMA"],
      basis: "active NWS alert count departing its own baseline"
    }),
    rec({ id: "SEISMIC_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["earthquakes"],
      requires: ["earthquakes"],
      thresholds: ["SIGMA"],
      basis: "M4.5+ earthquake count departing its own baseline"
    }),
    rec({ id: "PHYSICAL_HAZARDS_CO_DEPARTING", form: "PAIR_CO_DEPART_ABS_SUM",
      operands: ["nwsAlerts", "earthquakes"],
      requires: ["nwsAlerts", "earthquakes"],
      thresholds: [1, 1, 2.5],
      basis: "weather alerts and seismic activity both departing their own baselines — two independent hazard counts, which either alone cannot distinguish from its own noise"
    })
  ],
  intelligence: [
    rec({ id: "NEW_KEV_30D_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["cisaKev"],
      requires: ["cisaKev"],
      thresholds: ["SIGMA"],
      basis: "count of KEV entries added in the last 30 days departing its own baseline by >=2sd; direction not interpreted"
    })
  ],
  law: [
    rec({ id: "NEW_KEV_30D_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["cisaKev"],
      requires: ["cisaKev"],
      thresholds: ["SIGMA"],
      basis: "count of KEV entries added in the last 30 days departing its own baseline by >=2sd; direction not interpreted"
    })
  ],
  population: [
    rec({ id: "POPULATION_TOTAL_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["populationTotal"],
      requires: ["populationTotal"],
      thresholds: ["SIGMA"],
      basis: "US total population departing its own baseline by >=2sd; annual, direction not interpreted"
    }),
    rec({ id: "FERTILITY_RATE_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["fertilityRate"],
      requires: ["fertilityRate"],
      thresholds: ["SIGMA"],
      basis: "US total fertility rate, births per woman, departing its own baseline; annual, direction not interpreted"
    })
  ],
  research: [
    rec({ id: "RND_INTENSITY_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["rndIntensity"],
      requires: ["rndIntensity"],
      thresholds: ["SIGMA"],
      basis: "R&D spending as a share of GDP departing its own baseline by >=2sd; direction not interpreted"
    })
  ],
  supplyChain: [
    rec({ id: "FREIGHT_PRICE_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["freightPpi"],
      requires: ["freightPpi"],
      thresholds: ["SIGMA"],
      basis: "freight producer price index departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "WEATHER_ALERT_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["nwsAlerts"],
      requires: ["nwsAlerts"],
      thresholds: ["SIGMA"],
      basis: "active NWS alert count departing its own baseline"
    }),
    rec({ id: "SEISMIC_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["earthquakes"],
      requires: ["earthquakes"],
      thresholds: ["SIGMA"],
      basis: "M4.5+ earthquake count departing its own baseline"
    }),
    rec({ id: "PHYSICAL_HAZARDS_CO_DEPARTING", form: "PAIR_CO_DEPART_ABS_SUM",
      operands: ["nwsAlerts", "earthquakes"],
      requires: ["nwsAlerts", "earthquakes"],
      thresholds: [1, 1, 2.5],
      basis: "weather alerts and seismic activity both departing their own baselines — two independent hazard counts, which either alone cannot distinguish from its own noise"
    })
  ],
  technology: [
    rec({ id: "NEW_KEV_30D_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["cisaKev"],
      requires: ["cisaKev"],
      thresholds: ["SIGMA"],
      basis: "count of KEV entries added in the last 30 days departing its own baseline by >=2sd; direction not interpreted"
    }),
    rec({ id: "NEW_CVE_RATE_DEPARTURE", form: "SINGLE_DEPART_ABS",
      operands: ["nvdCves"],
      requires: ["nvdCves"],
      thresholds: ["SIGMA"],
      basis: "count of CVEs published in the last 7 days departing its own baseline; direction not interpreted"
    }),
    rec({ id: "VULNERABILITY_COUNTS_CO_DEPARTING", form: "PAIR_CO_DEPART_ABS_SUM",
      operands: ["cisaKev", "nvdCves"],
      requires: ["cisaKev", "nvdCves"],
      thresholds: [1, 1, 2.5],
      basis: "the 30-day exploited-vulnerability flow and the 7-day publication flow both departing their own baselines — two different populations over two different windows moving together, which either alone cannot distinguish from its own noise"
    })
  ]
};

/**
 * Every entry, flattened, with its domain attached — the (domain, id) key made explicit.
 * Duplicate keys throw here rather than at whichever call site happened to read second.
 */
function allEntries() {
  var out = [], seen = Object.create(null);
  Object.keys(DIAGNOSES).forEach(function (domain) {
    DIAGNOSES[domain].forEach(function (r) {
      var key = domain + '/' + r.id;
      if (seen[key]) throw new Error('diagnosis-registry: duplicate key ' + key);
      seen[key] = true;
      out.push({ domain: domain, entry: r });
    });
  });
  return out;
}

/**
 * The entries a domain declares. Returns a COPY of the array so a caller cannot mutate the
 * registry by holding a reference to it; the entries themselves are shared and frozen below.
 */
function findingsFor(domain) {
  var list = DIAGNOSES[domain];
  return list ? list.slice() : [];
}

/* Frozen because a registry that can be edited at runtime is not a registry. */
Object.keys(DIAGNOSES).forEach(function (d) {
  DIAGNOSES[d].forEach(function (r) { Object.freeze(r.operands); Object.freeze(r.requires); Object.freeze(r.thresholds); Object.freeze(r); });
  Object.freeze(DIAGNOSES[d]);
});
Object.freeze(DIAGNOSES);

module.exports = {
  DIAGNOSES: DIAGNOSES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  DEFINITION_VERSION: DEFINITION_VERSION,
  PROVENANCE: PROVENANCE,
  findingsFor: findingsFor,
  allEntries: allEntries
};
