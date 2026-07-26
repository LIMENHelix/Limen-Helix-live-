/**
 * assets/js/domain-offers.js — what each domain actually SELLS at each rung.
 *
 * The problem this fixes: all 18 fronts showed the identical 11 rungs ("The Briefing",
 * "Early Warning", "The Fork") at identical prices. Nothing told an Agriculture visitor what
 * P3 gives THEM versus a Finance visitor, so the ladder read as invented tiers.
 *
 * THE RULE THAT MAKES IT CONCRETE: every paid rung is built from a tool that already exists
 * and already works on the free page. P0 is the tool you just used. P1 is that same tool
 * watching YOUR state / drug / bank / vehicle / vendor. Nothing here is a capability we do
 * not have; if a rung cannot be delivered from a live source it does not get written.
 *
 * CADENCE IS HONEST. Each rung states the fastest it can truthfully move, measured from the
 * real sources on 2026-07-25. Bank Call Reports are QUARTERLY, so a Finance alert cannot
 * promise daily and does not. Drought is weekly. CISA KEV is near-daily. Selling a cadence
 * the source cannot support is the fastest way to earn a refund and lose the account.
 *
 * PRICING is flat across domains for the three chargeable rungs. Same mechanic, same price.
 * The competitor is not another vendor, it is "I will just ask an AI", so the price has to
 * stay under the point where someone substitutes a chatbot that cannot see today's data.
 */
(function () {

  // ONE PRICE EVERYWHERE for the three chargeable rungs.
  //
  // The competitor is not another data vendor, it is "I will just ask an AI". A chatbot can
  // explain what a rule means; it cannot tell you that YOUR drug went short today or that
  // YOUR comment window shuts on Thursday. That gap is the whole product, and it is only
  // worth paying for while the price sits below the point where someone shrugs and asks a
  // chatbot instead. Price too high and they substitute something worse and never come back.
  //
  // Delivery costs almost nothing: the federal sources are free, and a subscriber is a few
  // API calls and one email a month. The real cost is Stripe, which takes $0.30 + 2.9% per
  // charge. That is 13% of a $3 subscription but 10% of a $4 one, so the old $3 floor was the
  // worst of both worlds: it looked cheapest and handed Stripe the largest share.
  //
  // The old consumer/pro/business split charged $3, $5 and $9 for the SAME mechanic depending
  // on who was buying. That is willingness-to-pay, and it aims the highest price at exactly
  // the people most able to replace us with a chatbot. Same work, same price.
  var PRICES = { p1: '$4 / mo', p2: '$6 / mo', p3: '$8 / mo' };

  // Rungs P4-P9 are ENQUIRE-ONLY, deliberately.
  //
  // They are shown and priced so the ladder is legible, but they cannot be bought with a
  // click, because nothing in this system delivers them yet. Delivery is lib/digest.js, which
  // produces watches and briefings: that is P1-P3. There is no mechanism that produces "deep,
  // tailored what-to-do plans" or "a custom, expert read on your exact situation" — those are
  // human work, and their copy is still generic placeholder text repeated across all 18
  // domains.
  //
  // Taking a card for a monthly product that no code and no scheduled human step delivers is
  // how you earn refunds and chargebacks. `enquire: true` routes them to a conversation
  // instead. Flip one to a Subscribe rung the day it has a real delivery path, not before.
  //
  // P0 is free and P10 is priced per engagement, so neither is a checkout either.
  var GENERIC = {
    p4: { name: 'The Playbook',  line: 'Turn the signal into steadiness: deep, tailored what-to-do plans.',            price: '$9 / mo',  cadence: 'on request', enquire: true },
    p5: { name: 'The Record',    line: 'The long view: history, trends, and the trajectory of this domain over time.', price: '$9 / mo',  cadence: 'monthly', enquire: true },
    p6: { name: 'Command',       line: 'Coordinate the whole: every place or asset you track, in one dashboard.',      price: '$12 / mo', cadence: 'live', enquire: true },
    p7: { name: 'The Fork',      line: 'At a decision point: compare paths and model which way to go.',                price: '$12 / mo', cadence: 'on request', enquire: true },
    p8: { name: 'The Analyst',   line: 'Step back and understand: a custom, expert read on your exact situation.',     price: '$19 / mo', cadence: 'monthly', enquire: true },
    p9: { name: 'Live Edge',     line: 'When timing is everything: real-time, instant alerts, poised to act.',         price: '$14 / mo', cadence: 'as it happens', enquire: true }
  };

  var OFFERS = {
    agriculture: {
      band: 'consumer', who: 'growers, ag lenders and food buyers',
      p1: { name: 'Your County Watch', line: 'The drought map, watched for your state. We tell you the week it crosses into severe (D2), not when you happen to check.', cadence: 'weekly map, alert same day' },
      p2: { name: 'The Input Brief', line: 'Nitrogen, phosphate, diesel and gas moves that hit your cost of production, with the direction called.', cadence: 'monthly, when the index publishes' },
      p3: { name: 'Margin Warning', line: 'Your break-even against the live board price. We tell you when the crop stops penciling, not after harvest.', cadence: 'daily on market moves' }
    },
    environment: {
      band: 'consumer', who: 'households, land owners and outdoor workers',
      p1: { name: 'Your Air & Hazard Watch', line: 'Air quality and every federal hazard at your exact ZIP, pushed when it changes rather than looked up.', cadence: 'hourly' },
      p2: { name: 'The Fire & Water Brief', line: 'Active wildfires near you and your state\'s drought trajectory, in one weekly read.', cadence: 'weekly, fires daily' },
      p3: { name: 'Smoke & Evacuation Warning', line: 'When a fire crosses containment thresholds near you, or air quality crosses the line where it hurts to be outside.', cadence: 'same day' }
    },
    medicine: {
      band: 'consumer', who: 'patients, caregivers and clinic staff',
      p1: { name: 'Your Prescription Watch', line: 'Name the drugs you or your patients depend on. We tell you the day the FDA logs a shortage, and the day it clears.', cadence: 'daily' },
      p2: { name: 'The Recall Brief', line: 'Food, drug and device recalls filtered to what you actually have, with the Class explained in plain language.', cadence: 'daily' },
      p3: { name: 'Outbreak Early Warning', line: 'WHO outbreak reports and CDC signals for the regions you travel to or serve, before it reaches general news.', cadence: 'same day as WHO publishes' }
    },
    education: {
      band: 'consumer', who: 'parents, students and counselors',
      p1: { name: 'Your Shortlist Watch', line: 'Track the schools your family is considering. Completion rate, debt and earnings, side by side, updated when the Scorecard releases.', cadence: 'per federal data release' },
      p2: { name: 'The Payback Brief', line: 'Programme-level debt against earnings for the majors on your list, so you see which ones do not pay back before you sign.', cadence: 'per release' },
      p3: { name: 'Aid & Policy Warning', line: 'Federal rules on student aid, loan forgiveness and accreditation that change what your school costs you.', cadence: 'daily, from the Federal Register' }
    },
    population: {
      band: 'consumer', who: 'buyers, movers and local officials',
      p1: { name: 'Your Market Watch', line: 'Price-to-income for the states you are choosing between, so you can see where you can actually afford to live.', cadence: 'monthly', enquire: true },
      p2: { name: 'The Affordability Brief', line: 'Listing counts, price moves and how far your income goes, tracked across your shortlist.', cadence: 'monthly', enquire: true },
      p3: { name: 'Priced-Out Warning', line: 'When a market you are watching crosses the multiple where a household on the local median can no longer buy.', cadence: 'monthly' }
    },
    religion: {
      band: 'consumer', who: 'donors, boards and congregation leaders',
      p1: { name: 'Your Charity Watch', line: 'Track the organisations you give to. Revenue, spending and reserves as each new Form 990 posts.', cadence: 'per annual filing' },
      p2: { name: 'The Stewardship Brief', line: 'Multi-year trend for every organisation on your list, so a single bad year reads as what it is.', cadence: 'per filing' },
      p3: { name: 'Red-Flag Warning', line: 'When a charity you support files a year that breaks its own pattern: spending past revenue, or reserves falling fast.', cadence: 'per filing' }
    },
    economy: {
      band: 'pro', who: 'small business owners, planners and journalists',
      p1: { name: 'Your Tax Receipt', line: 'Your itemised share of federal spending, re-cut every month as Treasury publishes, including what you paid toward debt interest.', cadence: 'monthly', enquire: true },
      p2: { name: 'The Fiscal Brief', line: 'Where the money went this month, which agencies moved, and how far spending ran past collection.', cadence: 'monthly', enquire: true },
      p3: { name: 'Deficit & Rate Warning', line: 'When the gap between what Washington collects and spends breaks its own trend, and what that has historically meant for rates.', cadence: 'monthly' }
    },
    law: {
      band: 'pro', who: 'small firms, advocates and compliance staff',
      p1: { name: 'Your Docket Watch', line: 'Name your topics. We tell you the day a federal rule opens for comment on them, with the deadline and the filing link.', cadence: 'daily' },
      p2: { name: 'The Comment Brief', line: 'Everything open in your subject areas, ranked by how soon the window shuts.', cadence: 'daily' },
      p3: { name: 'Closing-Window Warning', line: 'A direct alert when a rule that affects you is inside seven days of closing and you have not filed.', cadence: 'daily' }
    },
    industry: {
      band: 'pro', who: 'fleet owners, shops and safety managers',
      p1: { name: 'Your Fleet Watch', line: 'Every vehicle you own or service, watched for new NHTSA recalls, including the do-not-drive and park-outside flags.', cadence: 'daily' },
      p2: { name: 'The Recall Brief', line: 'New campaigns across your makes and models with the risk and the remedy in full, not a headline.', cadence: 'daily' },
      p3: { name: 'Do-Not-Drive Warning', line: 'An immediate alert the day a vehicle in your fleet gets a park-it or fire-risk recall.', cadence: 'same day' }
    },
    science: {
      band: 'pro', who: 'researchers, journalists and grant writers',
      p1: { name: 'Your Funding Watch', line: 'Track institutions or subject areas and see the federal awards as they post, with amounts and investigators.', cadence: 'per RePORTER update' },
      p2: { name: 'The Money Brief', line: 'Who is funding your field, how much, and which institutions are gaining or losing share.', cadence: 'monthly', enquire: true },
      p3: { name: 'Conflict Warning', line: 'When a study making news is funded by a party with an interest in its result, surfaced from the award record.', cadence: 'on publication' }
    },
    trade: {
      band: 'pro', who: 'importers, buyers and manufacturers',
      p1: { name: 'Your Lane Watch', line: 'The partners you buy from, tracked monthly: volume, direction and what imported goods now cost.', cadence: 'monthly', enquire: true },
      p2: { name: 'The Import Cost Brief', line: 'Import price moves separated from fuel noise, so you see what is really happening to landed cost.', cadence: 'monthly', enquire: true },
      p3: { name: 'Supply Shift Warning', line: 'When trade with a partner you depend on breaks its trend, months before it shows up in your invoices.', cadence: 'monthly' }
    },
    infrastructure: {
      band: 'pro', who: 'logistics, facilities and local officials',
      p1: { name: 'Your Route Watch', line: 'Airports, grids and corridors you depend on, watched for delays, ground stops and closures.', cadence: 'minute to minute' },
      p2: { name: 'The Disruption Brief', line: 'What failed this week across the systems you rely on, and how long it took to come back.', cadence: 'daily' },
      p3: { name: 'Cascade Warning', line: 'When a single failure starts propagating across connected systems rather than staying local.', cadence: 'same day' }
    },
    communication: {
      band: 'pro', who: 'publishers, PR and policy staff',
      p1: { name: 'Your Proceeding Watch', line: 'FCC filings and proceedings that touch your spectrum, broadband or licence, as they post.', cadence: 'daily' },
      p2: { name: 'The Filing Brief', line: 'Who is petitioning on the rules that govern your channel, and what they are asking for.', cadence: 'daily' },
      p3: { name: 'Rule-Change Warning', line: 'When a proceeding you track moves toward an order that changes what you are allowed to do.', cadence: 'daily' }
    },
    finance: {
      band: 'business', who: 'depositors, treasurers and boards',
      p1: { name: 'Your Bank Watch', line: 'The banks holding your money or your company\'s, checked against each new Call Report: capital, assets and profitability.', cadence: 'quarterly, when banks file' },
      p2: { name: 'The Counterparty Brief', line: 'Every institution you bank with, ranked by capital cushion, with the direction of travel across quarters.', cadence: 'quarterly' },
      p3: { name: 'Capital Warning', line: 'When a bank you rely on files a quarter with a materially thinner cushion than the last.', cadence: 'quarterly, alert same day as filing' }
    },
    technology: {
      band: 'business', who: 'IT, security and MSPs',
      p1: { name: 'Your Stack Watch', line: 'List your vendors and products. We tell you the day one lands in CISA\'s actively-exploited catalog, with the federal fix-by date.', cadence: 'near-daily, tracks CISA' },
      p2: { name: 'The Exposure Brief', line: 'Everything in your stack under confirmed attack, ranked by ransomware linkage and how overdue the fix is.', cadence: 'near-daily' },
      p3: { name: 'Zero-Day Warning', line: 'Immediate alert when something you run is added to the exploited catalog, which is the signal that it is being used against people now.', cadence: 'same day as CISA adds it' }
    },
    defense: {
      band: 'business', who: 'suppliers, analysts and primes',
      p1: { name: 'Your Contract Watch', line: 'Track awarding agencies, programmes or competitors and see obligations as they post.', cadence: 'daily' },
      p2: { name: 'The Award Brief', line: 'Who won what this period, at what ceiling, and how the money is concentrating.', cadence: 'weekly' },
      p3: { name: 'Recompete Warning', line: 'When a contract you depend on, or one you want, approaches its option or recompete window.', cadence: 'daily' }
    },
    governance: {
      band: 'business', who: 'contractors, press and local officials',
      p1: { name: 'Your State Watch', line: 'Federal contract dollars landing in your state or district, by the company collecting them.', cadence: 'daily' },
      p2: { name: 'The Award Brief', line: 'Who is being paid with public money where you operate, and how that is shifting between firms.', cadence: 'weekly' },
      p3: { name: 'Competitor Warning', line: 'When a firm in your market wins federal work, with the amount and the awarding agency.', cadence: 'daily' }
    },
    intelligence: {
      band: 'business', who: 'compliance, banks and exporters',
      p1: { name: 'Your Name Watch', line: 'Your counterparties, screened against the OFAC blocked-persons list every time Treasury updates it.', cadence: 'per Treasury update' },
      p2: { name: 'The Designation Brief', line: 'Who was added, under which programme, and which of your relationships are affected.', cadence: 'per update' },
      p3: { name: 'Sanctions Hit Warning', line: 'An immediate alert if anyone on your list is designated, because dealing with them becomes prohibited that day.', cadence: 'same day as designation' }
    }
  };

  window.LIMEN_DOMAIN_OFFERS = {
    prices: PRICES,
    get: function (domain) {
      var o = OFFERS[domain];
      if (!o) return null;
      return {
        who: o.who, band: o.band,
        p1: { name: o.p1.name, line: o.p1.line, cadence: o.p1.cadence, price: 'from ' + PRICES.p1 },
        p2: { name: o.p2.name, line: o.p2.line, cadence: o.p2.cadence, price: 'from ' + PRICES.p2 },
        p3: { name: o.p3.name, line: o.p3.line, cadence: o.p3.cadence, price: 'from ' + PRICES.p3 },
        p4: GENERIC.p4, p5: GENERIC.p5, p6: GENERIC.p6,
        p7: GENERIC.p7, p8: GENERIC.p8, p9: GENERIC.p9
      };
    }
  };
})();
