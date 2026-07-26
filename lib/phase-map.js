/**
 * lib/phase-map.js — which phases a domain can actually express, and the exact signal.
 *
 * THE RULE, and it is the whole point: a domain earns a phase ONLY when a real signal in that
 * domain IS that phase, as defined in lib/phase-spec.js. Every entry names the concrete field
 * it reads and the value observed live. If a phase is absent, that is the honest answer and the
 * rung is not sold. Loosening a phase definition so more things qualify, or stretching a signal
 * to fill a gap, destroys the only thing that makes the ladder mean anything.
 *
 * No domain supports all eleven. Law reaches seven; most reach two or three. An incomplete
 * ladder is the correct result.
 *
 * THE RECURRING BLOCKER, stated once here rather than repeated in every entry: P1 (first
 * appearance), P3 (the pattern broke) and P5 (endurance) all need to know what a thing looked
 * like LAST time. Where the source itself carries a date or a change field, that is available
 * today and is claimed. Where it does not, we would need to store our own daily snapshot, which
 * we do not do. /api/grounded-stress-history exists but holds bare stress numbers for a single
 * domain, so it cannot answer "did YOUR drug's status change".
 */

var MAP = {

  // ── LAW — Federal Register ────────────────────────────────────────────────
  // The richest domain by far: federal rulemaking already speaks the arc's grammar, because
  // the document TYPE encodes where in its life a rule is.
  law: {
    source: 'Federal Register API',
    phases: {
      p0: { signal: 'every proposed rule currently open for public comment', field: 'type=PRORULE', verified: true, evidence: '237 open' },
      p1: { signal: 'a rule touching your sector is proposed for the first time', field: 'type=PRORULE, first appearance in your CFR title', verified: true, evidence: '171 proposed in 30d' },
      p2: { signal: 'the recurring flow of what is open in your sector', field: 'cfr_references grouped by title', verified: true, evidence: '20 open in alcohol/tobacco/firearms' },
      p4: { signal: 'a comment period EXTENDED or REOPENED, holding open a window that was closing', field: 'action matching extension or reopening', verified: true, evidence: '2 in a 100-doc sample' },
      p8: { signal: 'an agency filing a CORRECTION to its own earlier notice, unforced', field: 'action matching correction', verified: true, evidence: '2 in a 100-doc sample' },
      p9: { signal: 'comment closes within days and no outcome is determined yet', field: 'comments_close_on within 7 days', verified: true, evidence: '28 closing this week' },
      p10: { signal: 'a FINAL rule now in force: what the new normal actually is', field: 'type=RULE', verified: true, evidence: '284 final rules in 30d' }
      // P3 absent: a closing deadline is not a fracture, and nothing marks a rule as breaking
      //   an established pattern. Calling "economically significant" a fracture would be forcing.
      // P5, P6, P7, P7b absent: no signal.
    }
  },

  // ── MEDICINE — openFDA ────────────────────────────────────────────────────
  medicine: {
    source: 'openFDA drug shortages + enforcement',
    phases: {
      p0: { signal: 'every drug currently in FDA-recorded shortage', field: 'status=Current', verified: true, evidence: '73 drugs across 1,175 records' },
      p1: { signal: 'your drug first appears on the shortage list', field: 'generic_name match, status=Current', verified: true, evidence: 'per-drug search live' },
      p2: { signal: 'the recurring recall and shortage briefing for what you stock', field: 'enforcement report_date flow', verified: true, evidence: 'daily source' },
      p8: { signal: 'a firm recalling its OWN product before being made to', field: 'voluntary_mandated = Voluntary: Firm initiated', verified: true, evidence: '17,752 voluntary vs 29 FDA-mandated' },
      p10: { signal: 'a shortage that has RESOLVED: the new settled state', field: 'status=Resolved', verified: true, evidence: '25 resolved' }
      // P3 absent: shortage records carry no severity trajectory.
      // P4 absent: temporary importation would be genuine external scaffolding, but it exists
      //   only as free text inside shortage_reason, not as a structured field.
      // P9 absent: no field expresses a poised, still-open outcome.
    }
  },

  // ── TECHNOLOGY — CISA Known Exploited Vulnerabilities ─────────────────────
  technology: {
    source: 'CISA KEV catalog',
    phases: {
      p0: { signal: 'the full catalogue of flaws with confirmed exploitation', field: 'full KEV', verified: true, evidence: '1,653 entries' },
      p1: { signal: 'something you run enters the exploited catalogue for the first time', field: 'dateAdded matched to your vendor', verified: true, evidence: '26 added in 30d' },
      p2: { signal: 'the recurring exposure brief across your stack', field: 'per-vendor rollup', verified: true, evidence: 'per-vendor search live' },
      p3: { signal: 'a flaw you run gains ransomware linkage: the risk pattern changed', field: 'knownRansomwareCampaignUse', verified: true, evidence: '332 ransomware-linked' },
      p9: { signal: 'past the federal fix-by date and still unfixed: maximal exposure, outcome open', field: 'dueDate in the past', verified: true, evidence: '381 overdue' }
      // P10 absent, and worth stating plainly: KEV has NO remediation field. There is no state
      //   meaning "fixed", so a renewal rung here would be fabricated outright.
    }
  },

  // ── ENVIRONMENT — NIFC fires + US Drought Monitor ─────────────────────────
  // Second-richest after Law, because a fire has a LIFECYCLE the source publishes: discovered,
  // percent contained, fully contained. That is a phase trajectory, not a single number.
  environment: {
    source: 'NIFC WFIGS + US Drought Monitor + Open-Meteo',
    phases: {
      p0: { signal: 'air quality and every active fire at your location right now', field: 'aqi, fires', verified: true, evidence: 'AQI 60 at 66101; 15 fires over 100 acres' },
      p1: { signal: 'a fire is first discovered near you', field: 'discovered', verified: true, evidence: 'discovered date on every row' },
      p2: { signal: 'the weekly drought map and daily fire read for your area', field: 'mapDate weekly, fires daily', verified: true, evidence: 'USDM publishes weekly' },
      p3: { signal: 'your area crosses into severe drought: the established pattern broke', field: 'changeD2, week over week', verified: true, evidence: 'D0-D4 are the Drought Monitor OWN severity bands, not thresholds we invented' },
      p4: { signal: 'a federal disaster declaration covering your county: federal support switched on', field: 'FEMA declarationDate + programmes declared', verified: true, evidence: '36 distinct disasters in 90d, deduped from 189 county rows' },
      p9: { signal: 'a large fire near you still barely contained: maximal exposure, outcome open', field: 'contained under 35', verified: true, evidence: '5 of 15 fires under 35% contained' },
      p10: { signal: 'the fire is fully contained: the new settled state', field: 'contained = 100', verified: true, evidence: '1 of 15 at 100%' }
      // P5 absent: sustained drought is real endurance but needs stored history.
    }
  },

  // ── FINANCE — FDIC BankFind ───────────────────────────────────────────────
  finance: {
    source: 'FDIC BankFind, quarterly Call Reports',
    phases: {
      p0: { signal: 'the current filed condition of the banks holding your money', field: 'assetsUsd, equityUsd, roa, equityToAssets', verified: true, evidence: 'full Call Report fields live' },
      p2: { signal: 'each new quarterly Call Report for your banks', field: 'asOf, quarterly', verified: true, evidence: 'quarterly cadence' },
      p3: { signal: 'capital falls under the regulatory well-capitalised line: a defined threshold crossed', field: 'equityToAssets against the regulatory minimum', verified: true, evidence: 'field present; the threshold is a REGULATORY standard, not one we invented' }
      // P5 absent: sustained profitability across quarters is real endurance, needs history.
      // P7/P10 absent: `active` flips false when a bank ceases to exist, which is the arc's
      //   TERMINAL basin, not renewal. Selling that as P10 would invert its meaning.
    }
  },

  // ── INTELLIGENCE — OFAC SDN ───────────────────────────────────────────────
  intelligence: {
    source: 'OFAC Specially Designated Nationals list',
    phases: {
      p0: { signal: 'the full blocked-persons list', field: 'SDN full', verified: true, evidence: '19,254 entries' },
      p1: { signal: 'a counterparty you screen appears on the list for the first time', field: 'name match against SDN', verified: true, evidence: 'name search live' },
      p2: { signal: 'the recurring screen of your counterparty list, each time Treasury updates', field: 'per-update rollup', verified: true, evidence: '14 programmes tracked' }
      // P10 absent: a DELISTING is exactly renewal, but OFAC publishes only the current list.
      //   Detecting a removal means diffing against yesterday, which needs stored history.
    }
  },

  // ── AWARD FEEDS — defense, governance, science ────────────────────────────
  // All three read award records, so they share a shape: an award carries a start date, which
  // makes first-appearance genuine, but nothing expresses fracture, scaffolding or renewal.
  defense: {
    source: 'USAspending, DoD awards',
    phases: {
      p0: { signal: 'the largest Pentagon awards this fiscal year, and what they bought', field: 'rows, description', verified: true, evidence: '20 rows, $51.3B top award' },
      p1: { signal: 'an award first appears to an agency, programme or competitor you track', field: 'started', verified: true, evidence: 'start date on every row' },
      p2: { signal: 'the recurring award flow for what you track', field: 'fyStart to asOf', verified: true, evidence: 'daily source' }
    }
  },
  governance: {
    source: 'USAspending, federal contracts',
    phases: {
      p0: { signal: 'federal contract dollars landing in your state, and what they bought', field: 'awards, bought', verified: true, evidence: '13 of 15 awards carry a readable description' },
      p1: { signal: 'a firm in your market first wins federal work', field: 'started', verified: true, evidence: 'start date on every award' },
      p2: { signal: 'the recurring award flow where you operate', field: 'fyStart to asOf', verified: true, evidence: 'daily source' }
    }
  },
  science: {
    source: 'NIH RePORTER',
    phases: {
      p0: { signal: 'federally funded research this fiscal year', field: 'rows, total', verified: true, evidence: '39,875 projects' },
      p1: { signal: 'a new grant first awarded to an institution or investigator you track', field: 'projectNum, fiscalYear', verified: true, evidence: 'project number and year on every row' },
      p2: { signal: 'the recurring funding flow in your field', field: 'fiscalYear rollup', verified: true, evidence: 'per-FY source' }
    }
  },

  // ── RHYTHM-ONLY DOMAINS ───────────────────────────────────────────────────
  // These publish a periodic aggregate with no lifecycle states. They support the free read and
  // a genuine recurring briefing, and nothing beyond it. Claiming fracture, scaffolding or
  // renewal here would mean inventing thresholds the source does not declare.
  economy: {
    source: 'Treasury Monthly Treasury Statement',
    phases: {
      p0: { signal: 'receipts, outlays, deficit and interest, fiscal year to date', field: 'receipts, outlays, deficit, interest', verified: true, evidence: 'all present as of 2026-06-30' },
      p2: { signal: 'the monthly re-cut as Treasury publishes, including your itemised share', field: 'asOf, monthly', verified: true, evidence: 'monthly publication' }
    }
  },
  trade: {
    source: 'FRED, from Census trade data and BLS import price indexes',
    phases: {
      p0: { signal: 'goods balance by trading partner and import prices', field: 'partners, prices, totalBalance', verified: true, evidence: '6 partners, 3 price series' },
      p2: { signal: 'the monthly update as each series publishes', field: 'asOf, monthly', verified: true, evidence: 'monthly, roughly two-month lag' }
    }
  },
  population: {
    source: 'FRED listing prices + Census median household income',
    phases: {
      p0: { signal: 'price to income for the states you are comparing', field: 'price, income', verified: true, evidence: 'live for US and per state' },
      p2: { signal: 'the monthly re-cut as the price series publishes', field: 'priceAsOf, monthly', verified: true, evidence: 'monthly' },
      p5: { signal: 'the affordability trajectory holding its direction over a decade', field: 'priceFirst 2016 against price now', verified: true, evidence: '$259k in 2016 to $430k now, carried IN the payload, so no stored history is needed' }
    }
  },
  education: {
    source: 'College Scorecard',
    phases: {
      p0: { signal: 'completion, debt and earnings for the schools on your shortlist', field: 'school search', verified: true, evidence: 'per-school query live' },
      p2: { signal: 'the re-cut on each federal data release', field: 'per release', verified: true, evidence: 'release cadence' }
    }
  },
  religion: {
    source: 'ProPublica Nonprofit Explorer, IRS Form 990',
    phases: {
      p0: { signal: 'what an organisation you support reported to the IRS', field: 'org search', verified: true, evidence: 'per-org lookup live' },
      p2: { signal: 'the read refreshed as each annual Form 990 posts', field: 'per filing', verified: true, evidence: 'annual' }
    }
  },
  agriculture: {
    source: 'US Drought Monitor + FRED input prices',
    phases: {
      p0: { signal: 'drought by state with the crops exposed, plus input costs', field: 'rows d0-d4, crops, inputs', verified: true, evidence: '24 states with D0-D4 bands' },
      p2: { signal: 'the weekly drought map and the monthly input index', field: 'mapDate, weekly', verified: true, evidence: 'USDM weekly' }
      // P3 absent HERE but present in environment from the SAME source: this handler returns
      //   d0-d4 levels without the week-over-week change field that makes a crossing
      //   detectable. Cheap to add, it is the same computation.
    }
  },
  industry: {
    source: 'plant closings and recalls',
    phases: {
      p0: { signal: 'the current year read', field: 'years, defaultYear', verified: true, evidence: '32 years available' }
      // P2 unverified: the default response is a year selector, so the recurring cadence has
      //   not been confirmed. Not claimed until it is.
    }
  }

};

/** Phases a domain can genuinely deliver, in arc order. */
function phasesFor(domain) {
  var d = MAP[String(domain || '').toLowerCase()];
  if (!d) return [];
  var order = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p7b', 'p8', 'p9', 'p10'];
  return order.filter(function (p) { return d.phases[p]; })
              .map(function (p) { return Object.assign({ phase: p }, d.phases[p]); });
}

function get(domain, phase) {
  var d = MAP[String(domain || '').toLowerCase()];
  if (!d) return null;
  return d.phases[String(phase || '').toLowerCase()] || null;
}

function mapped() { return Object.keys(MAP); }

module.exports = { MAP: MAP, phasesFor: phasesFor, get: get, mapped: mapped };
