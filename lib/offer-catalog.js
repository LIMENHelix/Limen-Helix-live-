/**
 * lib/offer-catalog.js — GENERATED. Do not edit by hand.
 *
 * Source of truth: assets/js/domain-offers.js
 * Regenerate:     node scripts/gen-offer-catalog.cjs
 *
 * This is the AUTHORITATIVE price list for charging. A checkout never accepts a price from
 * the browser; it looks the rung up here, so a tampered client can only ask for a rung that
 * exists, never for a cheaper one. The browser copy in assets/ is display only, and Vercel
 * excludes assets/** from the function bundle, which is why this file has to exist at all.
 */
var CATALOG = {
  "agriculture": {
    "who": "growers, ag lenders and food buyers",
    "rungs": {
      "p2": {
        "name": "Your Weekly Drought and Input Read",
        "line": "Drought across your state with the crops exposed, plus the input costs that set your margin.",
        "cadence": "weekly map, monthly inputs",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "defense": {
    "who": "suppliers, analysts and primes",
    "rungs": {
      "p1": {
        "name": "A New Award Landed",
        "line": "A contract first appears for an agency, programme or competitor you track.",
        "cadence": "daily",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Award Flow",
        "line": "Who won what across the programmes you follow, and what the money actually bought.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "economy": {
    "who": "small business owners, planners and journalists",
    "rungs": {
      "p2": {
        "name": "Your Monthly Tax Receipt",
        "line": "Your itemised share of federal spending, re-cut every month as Treasury publishes.",
        "cadence": "monthly",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "education": {
    "who": "parents, students and counsellors",
    "rungs": {
      "p2": {
        "name": "Your Shortlist, Each Release",
        "line": "Completion, debt and earnings for your schools, updated on each federal release.",
        "cadence": "per federal data release",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "environment": {
    "who": "households, land owners and people who work outdoors",
    "rungs": {
      "p1": {
        "name": "Fire Discovered Near You",
        "line": "A new wildfire is first reported within reach of your ZIP.",
        "cadence": "same day as discovery",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Weekly Ground Read",
        "line": "Drought, air quality and active fires for your exact location, in one weekly read.",
        "cadence": "weekly map, fires daily",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p3": {
        "name": "Crossed Into Severe Drought",
        "line": "Your area crosses the Drought Monitor’s D2 line. Their severity band, not a threshold we chose.",
        "cadence": "weekly, alert same day",
        "shape": "event",
        "priceCents": 800
      },
      "p4": {
        "name": "Federal Help Switched On",
        "line": "A disaster declaration covering your county, and which assistance programmes it turns on.",
        "cadence": "same day FEMA declares",
        "shape": "trend",
        "priceCents": 600
      },
      "p9": {
        "name": "Burning Uncontained Near You",
        "line": "A large fire near you still barely held. Maximum exposure, outcome still open.",
        "cadence": "daily while it burns",
        "shape": "event",
        "priceCents": 800
      },
      "p10": {
        "name": "Contained",
        "line": "The fire near you reaches full containment, so you know when it is actually over.",
        "cadence": "same day",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "finance": {
    "who": "depositors, treasurers and boards",
    "rungs": {
      "p2": {
        "name": "Your Banks, Each Quarter",
        "line": "Every institution holding your money, read from its own Call Report as it files.",
        "cadence": "quarterly, when banks file",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p3": {
        "name": "Under the Well-Capitalised Line",
        "line": "A bank you rely on files capital below the regulator’s own threshold. Their line, not ours.",
        "cadence": "quarterly, alert same day as filing",
        "shape": "event",
        "priceCents": 800
      }
    }
  },
  "governance": {
    "who": "contractors, press and local officials",
    "rungs": {
      "p1": {
        "name": "A Competitor Won Federal Work",
        "line": "A firm in your market first wins a federal contract, with the amount and the agency.",
        "cadence": "daily",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Public Money Where You Operate",
        "line": "Federal contract dollars landing in your state, by company, and what they bought.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "industry": {
    "who": "manufacturers, buyers and plant communities",
    "rungs": {}
  },
  "intelligence": {
    "who": "compliance teams, banks and exporters",
    "rungs": {
      "p1": {
        "name": "Your Counterparty Was Designated",
        "line": "A name on your list appears on Treasury’s blocked-persons list, which prohibits dealing that day.",
        "cadence": "same day as designation",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Screening List, Every Update",
        "line": "Your counterparties re-screened against OFAC every time Treasury republishes.",
        "cadence": "per Treasury update",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "law": {
    "who": "anyone a federal rule can reach: businesses, professionals and filers",
    "rungs": {
      "p1": {
        "name": "New Rule in Your Sector",
        "line": "A rule touching the part of the code that governs you is proposed for the first time.",
        "cadence": "daily, as the Register publishes",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Sector’s Open Docket",
        "line": "Everything currently open for comment under the CFR titles that apply to you.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p4": {
        "name": "Deadline Extended",
        "line": "A comment window that was closing is reopened or extended, and you get the time back.",
        "cadence": "same day the extension posts",
        "shape": "trend",
        "priceCents": 600
      },
      "p8": {
        "name": "The Agency Corrected Itself",
        "line": "An agency files a correction to its own earlier notice, unforced. Almost nobody watches this.",
        "cadence": "daily",
        "shape": "trend",
        "priceCents": 600
      },
      "p9": {
        "name": "Closing This Week",
        "line": "Windows shutting within days with the outcome still undecided, while you can still file.",
        "cadence": "daily",
        "shape": "event",
        "priceCents": 800
      },
      "p10": {
        "name": "Now In Force",
        "line": "The final rule as published: what changed, and what you have to do differently.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "medicine": {
    "who": "patients, caregivers and clinic staff",
    "rungs": {
      "p1": {
        "name": "Your Drug Went Short",
        "line": "A medicine you depend on first appears on the FDA shortage list.",
        "cadence": "daily",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Recall and Shortage Brief",
        "line": "Recalls and shortages filtered to what you actually take or stock.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p8": {
        "name": "Pulled Voluntarily",
        "line": "The maker recalled it themselves before the FDA made them. That difference is the signal.",
        "cadence": "daily",
        "shape": "trend",
        "priceCents": 600
      },
      "p10": {
        "name": "Shortage Resolved",
        "line": "Your medicine comes off the shortage list, so you know when to stop rationing.",
        "cadence": "daily",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "population": {
    "who": "buyers, movers and local officials",
    "rungs": {
      "p2": {
        "name": "Your Markets, Monthly",
        "line": "Price against income for the states you are choosing between, re-cut each month.",
        "cadence": "monthly",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p5": {
        "name": "The Decade Line",
        "line": "Whether affordability is still moving the way it has since 2016, or has turned.",
        "cadence": "monthly",
        "shape": "trend",
        "priceCents": 600
      }
    }
  },
  "religion": {
    "who": "donors, boards and congregation leaders",
    "rungs": {
      "p2": {
        "name": "Your Charities, Each Filing",
        "line": "What the organisations you give to reported to the IRS, as each Form 990 posts.",
        "cadence": "per annual filing",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "science": {
    "who": "researchers, institutions and science journalists",
    "rungs": {
      "p1": {
        "name": "A Grant Landed in Your Field",
        "line": "A new federally funded project first appears for an institution or investigator you track.",
        "cadence": "per RePORTER update",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Funding Flow",
        "line": "What is being funded in your field this year, and by whom.",
        "cadence": "per update",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  },
  "technology": {
    "who": "IT teams, security staff and managed service providers",
    "rungs": {
      "p1": {
        "name": "Your Stack Hit the Exploited List",
        "line": "Something you run enters CISA’s actively-exploited catalog for the first time.",
        "cadence": "near-daily, tracks CISA",
        "shape": "event",
        "priceCents": 800
      },
      "p2": {
        "name": "Your Exposure Brief",
        "line": "Everything you run under confirmed exploitation, with the federal fix-by dates.",
        "cadence": "near-daily",
        "shape": "rhythm",
        "priceCents": 400
      },
      "p3": {
        "name": "Now Ransomware-Linked",
        "line": "A flaw you already run gains a ransomware association. The risk changed; the flaw did not.",
        "cadence": "same day CISA updates",
        "shape": "event",
        "priceCents": 800
      },
      "p9": {
        "name": "Past the Fix-By Date",
        "line": "Something you run is past its federal remediation deadline and still unfixed.",
        "cadence": "daily",
        "shape": "event",
        "priceCents": 800
      }
    }
  },
  "trade": {
    "who": "importers, buyers and anyone pricing goods",
    "rungs": {
      "p2": {
        "name": "Your Partners, Monthly",
        "line": "Goods flow and import prices for the trading partners you depend on.",
        "cadence": "monthly, about two months behind",
        "shape": "rhythm",
        "priceCents": 400
      }
    }
  }
};

/** Look up one purchasable rung. Returns null for anything not in the catalogue. */
function lookup(domain, rung) {
  var d = CATALOG[String(domain || "").toLowerCase()];
  if (!d) return null;
  var r = d.rungs[String(rung || "").toLowerCase()];
  if (!r) return null;
  return {
    domain: String(domain).toLowerCase(), rung: String(rung).toLowerCase(),
    name: r.name, line: r.line, cadence: r.cadence, priceCents: r.priceCents,
    who: d.who, band: d.band
  };
}

function domains() { return Object.keys(CATALOG); }

module.exports = { CATALOG: CATALOG, lookup: lookup, domains: domains };
