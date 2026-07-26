/**
 * assets/js/domain-offers.js — what each domain SELLS, named for its PHASE.
 *
 * The rungs used to be generic tiers ("The Briefing", "The Playbook", "The Analyst") repeated
 * across every domain. Those name a price point, not a phase, so eleven rungs read as eleven
 * invented tiers rather than one structure. Every rung here is named for what it IS in that
 * domain, and exists only where lib/phase-map.js found a real signal for that phase in that
 * domain's live source.
 *
 * A domain therefore sells the phases it can actually observe and NOTHING ELSE. Law reaches
 * six paid rungs; most reach one or two; Industry reaches none. An incomplete ladder is the
 * correct result, not a gap to be filled with copy.
 *
 * PRICE FOLLOWS THE ARC'S OWN GRAMMAR, not the buyer's wallet:
 *   rhythm  $4  a HOLDING phase — a recurring briefing you subscribe to
 *   trend   $6  a DRIVING phase — something accumulating that you watch build
 *   event   $8  a BREAKING phase — you are told the day it happens; the hardest to
 *               deliver and the only kind that is worthless late
 *
 * Same phase, same price, every domain. The old consumer/pro/business split charged $3, $5 and
 * $9 for identical work depending on who was buying, which aimed the highest price at exactly
 * the people most able to replace us with a chatbot.
 *
 * CADENCE IS HONEST. Each rung states the fastest its SOURCE can truthfully move. Bank Call
 * Reports are quarterly, so Finance does not promise daily. Drought is weekly. Selling a
 * cadence the source cannot support is the fastest way to earn a refund.
 *
 * P0 is free everywhere: it is the live read already on the page.
 */
(function () {

  var PRICE = { rhythm: '$4 / mo', trend: '$6 / mo', event: '$8 / mo' };

  // phase -> alert shape, from the arc's holding/breaking/driving grammar (lib/phase-spec.js)
  var SHAPE = {
    p1: 'event', p2: 'rhythm', p3: 'event', p4: 'trend', p5: 'trend',
    p6: 'rhythm', p7: 'event', p8: 'trend', p9: 'event', p10: 'rhythm'
  };

  var OFFERS = {

    law: {
      who: 'anyone a federal rule can reach: businesses, professionals and filers',
      p1: { name: 'New Rule in Your Sector', line: 'A rule touching the part of the code that governs you is proposed for the first time.', cadence: 'daily, as the Register publishes' },
      p2: { name: 'Your Sector’s Open Docket', line: 'Everything currently open for comment under the CFR titles that apply to you.', cadence: 'daily' },
      p4: { name: 'Deadline Extended', line: 'A comment window that was closing is reopened or extended, and you get the time back.', cadence: 'same day the extension posts' },
      p8: { name: 'The Agency Corrected Itself', line: 'An agency files a correction to its own earlier notice, unforced. Almost nobody watches this.', cadence: 'daily' },
      p9: { name: 'Closing This Week', line: 'Windows shutting within days with the outcome still undecided, while you can still file.', cadence: 'daily' },
      p10: { name: 'Now In Force', line: 'The final rule as published: what changed, and what you have to do differently.', cadence: 'daily' }
    },

    environment: {
      who: 'households, land owners and people who work outdoors',
      p1: { name: 'Fire Discovered Near You', line: 'A new wildfire is first reported within reach of your ZIP.', cadence: 'same day as discovery' },
      p2: { name: 'Your Weekly Ground Read', line: 'Drought, air quality and active fires for your exact location, in one weekly read.', cadence: 'weekly map, fires daily' },
      p3: { name: 'Crossed Into Severe Drought', line: 'Your area crosses the Drought Monitor’s D2 line. Their severity band, not a threshold we chose.', cadence: 'weekly, alert same day' },
      p4: { name: 'Federal Help Switched On', line: 'A disaster declaration covering your county, and which assistance programmes it turns on.', cadence: 'same day FEMA declares' },
      p9: { name: 'Burning Uncontained Near You', line: 'A large fire near you still barely held. Maximum exposure, outcome still open.', cadence: 'daily while it burns' },
      p10: { name: 'Contained', line: 'The fire near you reaches full containment, so you know when it is actually over.', cadence: 'same day' }
    },

    medicine: {
      who: 'patients, caregivers and clinic staff',
      p1: { name: 'Your Drug Went Short', line: 'A medicine you depend on first appears on the FDA shortage list.', cadence: 'daily' },
      p2: { name: 'Your Recall and Shortage Brief', line: 'Recalls and shortages filtered to what you actually take or stock.', cadence: 'daily' },
      p8: { name: 'Pulled Voluntarily', line: 'The maker recalled it themselves before the FDA made them. That difference is the signal.', cadence: 'daily' },
      p10: { name: 'Shortage Resolved', line: 'Your medicine comes off the shortage list, so you know when to stop rationing.', cadence: 'daily' }
    },

    technology: {
      who: 'IT teams, security staff and managed service providers',
      p1: { name: 'Your Stack Hit the Exploited List', line: 'Something you run enters CISA’s actively-exploited catalog for the first time.', cadence: 'near-daily, tracks CISA' },
      p2: { name: 'Your Exposure Brief', line: 'Everything you run under confirmed exploitation, with the federal fix-by dates.', cadence: 'near-daily' },
      p3: { name: 'Now Ransomware-Linked', line: 'A flaw you already run gains a ransomware association. The risk changed; the flaw did not.', cadence: 'same day CISA updates' },
      p9: { name: 'Past the Fix-By Date', line: 'Something you run is past its federal remediation deadline and still unfixed.', cadence: 'daily' }
    },

    finance: {
      who: 'depositors, treasurers and boards',
      p2: { name: 'Your Banks, Each Quarter', line: 'Every institution holding your money, read from its own Call Report as it files.', cadence: 'quarterly, when banks file' },
      p3: { name: 'Under the Well-Capitalised Line', line: 'A bank you rely on files capital below the regulator’s own threshold. Their line, not ours.', cadence: 'quarterly, alert same day as filing' }
    },

    intelligence: {
      who: 'compliance teams, banks and exporters',
      p1: { name: 'Your Counterparty Was Designated', line: 'A name on your list appears on Treasury’s blocked-persons list, which prohibits dealing that day.', cadence: 'same day as designation' },
      p2: { name: 'Your Screening List, Every Update', line: 'Your counterparties re-screened against OFAC every time Treasury republishes.', cadence: 'per Treasury update' }
    },

    defense: {
      who: 'suppliers, analysts and primes',
      p1: { name: 'A New Award Landed', line: 'A contract first appears for an agency, programme or competitor you track.', cadence: 'daily' },
      p2: { name: 'Your Award Flow', line: 'Who won what across the programmes you follow, and what the money actually bought.', cadence: 'daily' }
    },

    governance: {
      who: 'contractors, press and local officials',
      p1: { name: 'A Competitor Won Federal Work', line: 'A firm in your market first wins a federal contract, with the amount and the agency.', cadence: 'daily' },
      p2: { name: 'Public Money Where You Operate', line: 'Federal contract dollars landing in your state, by company, and what they bought.', cadence: 'daily' }
    },

    science: {
      who: 'researchers, institutions and science journalists',
      p1: { name: 'A Grant Landed in Your Field', line: 'A new federally funded project first appears for an institution or investigator you track.', cadence: 'per RePORTER update' },
      p2: { name: 'Your Funding Flow', line: 'What is being funded in your field this year, and by whom.', cadence: 'per update' }
    },

    population: {
      who: 'buyers, movers and local officials',
      p2: { name: 'Your Markets, Monthly', line: 'Price against income for the states you are choosing between, re-cut each month.', cadence: 'monthly' },
      p5: { name: 'The Decade Line', line: 'Whether affordability is still moving the way it has since 2016, or has turned.', cadence: 'monthly' }
    },

    economy: {
      who: 'small business owners, planners and journalists',
      p2: { name: 'Your Monthly Tax Receipt', line: 'Your itemised share of federal spending, re-cut every month as Treasury publishes.', cadence: 'monthly' }
    },

    trade: {
      who: 'importers, buyers and anyone pricing goods',
      p2: { name: 'Your Partners, Monthly', line: 'Goods flow and import prices for the trading partners you depend on.', cadence: 'monthly, about two months behind' }
    },

    education: {
      who: 'parents, students and counsellors',
      p2: { name: 'Your Shortlist, Each Release', line: 'Completion, debt and earnings for your schools, updated on each federal release.', cadence: 'per federal data release' }
    },

    religion: {
      who: 'donors, boards and congregation leaders',
      p2: { name: 'Your Charities, Each Filing', line: 'What the organisations you give to reported to the IRS, as each Form 990 posts.', cadence: 'per annual filing' }
    },

    agriculture: {
      who: 'growers, ag lenders and food buyers',
      p2: { name: 'Your Weekly Drought and Input Read', line: 'Drought across your state with the crops exposed, plus the input costs that set your margin.', cadence: 'weekly map, monthly inputs' }
    },

    industry: {
      // NOTHING SELLABLE. The source answers with a year selector; no phase beyond the free
      // read has a verified signal. Left empty deliberately rather than given a rung it cannot
      // deliver.
      who: 'manufacturers, buyers and plant communities'
    },

    communication: {
      // NO SOURCE. handlers/communication-tools.js does not exist and is not registered, so
      // /api/communication-tools 404s: the free card is broken and a paid watch would have
      // nothing behind it. Clear this when the endpoint answers, not to tidy the ladder.
      noSource: true,
      who: 'publishers, PR and policy staff'
    },

    infrastructure: {
      noSource: true,
      who: 'logistics, facilities and local officials'
    }
  };

  var PHASE_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];

  window.LIMEN_DOMAIN_OFFERS = {
    prices: PRICE,
    shape: SHAPE,
    get: function (domain) {
      var o = OFFERS[domain];
      if (!o) return null;
      var out = { who: o.who, noSource: !!o.noSource };
      if (o.noSource) return out;
      PHASE_KEYS.forEach(function (k) {
        if (!o[k]) return;
        var shape = SHAPE[k] || 'rhythm';
        out[k] = {
          name: o[k].name, line: o[k].line, cadence: o[k].cadence,
          shape: shape, price: PRICE[shape]
        };
      });
      return out;
    }
  };
})();
