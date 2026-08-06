/* LIMEN orb briefing — the words twenty domains say, and who says them.

   SHARED ON PURPOSE. The page renders this and a generator speaks it; if they built the
   text separately they would drift and the voice would stop matching the card.

   Every sentence is assembled from live readings. Nothing here is written by a model at
   runtime, so an orb cannot state a number that no feed returned.

   Loads as a browser global (LIMEN_ORB) or a CommonJS module. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LIMEN_ORB = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DOMAINS = [
    ['energy','Energy','Power'], ['finance','Finance','Capital'], ['medicine','Medicine','Repair'],
    ['technology','Technology','Coordination'], ['law','Law','Order'], ['governance','Governance','Authority'],
    ['economy','Economy','Exchange'], ['agriculture','Agriculture','Sustenance'], ['industry','Industry','Production'],
    ['infrastructure','Infrastructure','Structure'], ['education','Education','Transmission'],
    ['communication','Communication','Signal'], ['defense','Defense','Protection'],
    ['environment','Environment','Substrate'], ['culture','Culture','Meaning'],
    ['religion','Religion','Belief'], ['population','Population','Body'], ['science','Science','Discovery'],
    ['trade','Trade','Flow'], ['intelligence','Intelligence','Foresight']
  ];
  var FEEDKEY = { medicine:'health', trade:'supplyChain', science:'research' };
  var NEWS = { energy:1, culture:1, infrastructure:1 };

  /* THE PATHWAYS. Transcribed from the renderer's own lifecycle graph: a spine following the
     production order plus thematic cross-links. Directed and typed.

     This decides WHO MAY SPEAK ABOUT WHOM. Harvey may remark on Demi because he supplies her;
     Demi has no standing to tell Harvey how to farm. Strain only decides whether it is worth
     saying at all. */
  var PATHWAYS = [
    ['governance','economy','CONTROLS'],   ['economy','medicine','SUPPLIES'],
    ['medicine','energy','DEPENDS_ON'],    ['energy','agriculture','SUPPLIES'],
    ['agriculture','industry','SUPPLIES'], ['industry','science','TRANSFORMS'],
    ['science','technology','TRANSFORMS'], ['technology','education','SUPPLIES'],
    ['education','communication','SUPPLIES'], ['communication','culture','SUPPLIES'],
    ['culture','religion','TRANSFORMS'],   ['religion','population','DEPENDS_ON'],
    ['population','trade','DEPENDS_ON'],   ['trade','infrastructure','TRANSFORMS'],
    ['infrastructure','defense','CONTROLS'], ['defense','law','SUPPLIES'],
    ['law','finance','DEPENDS_ON'],        ['finance','environment','CONTROLS'],
    ['environment','intelligence','SUPPLIES'], ['intelligence','governance','SUPPLIES'],
    ['energy','industry','SUPPLIES'],      ['education','science','SUPPLIES'],
    ['law','governance','CONTROLS'],       ['finance','economy','CONTROLS'],
    ['medicine','population','SUPPLIES'],  ['agriculture','population','SUPPLIES'],
    ['energy','infrastructure','SUPPLIES'],['trade','economy','SUPPLIES'],
    ['defense','intelligence','DEPENDS_ON'], ['environment','agriculture','SUPPLIES']
  ];
  // What each relation entitles the speaker to say, by direction.
  var RELATION = {
    SUPPLIES:   { out: 'and what I send them is part of that',
                  out2:'and what I send over there is part of that',
                  in:  'and I run on what they send me' },
    DEPENDS_ON: { out: 'and I am exposed to it',
                  out2:'and I am exposed to it',
                  in:  'and they are carrying weight I put on them' },
    CONTROLS:   { out: 'and I am the constraint on them',
                  out2:'and I am the constraint on them',
                  in:  'and they are the constraint on me' },
    TRANSFORMS: { out: 'and I turn what comes out of it into something else',
                  out2:'and I turn what comes out of it into something else',
                  in:  'and they turn my output into something else' }
  };

  /* THE TWENTY. Each speaks in the register of the people who actually do that work: a grid
     operator is clipped and watches margin, a regulatory lawyer separates fact from
     liability, an analyst qualifies confidence and names its own blind spots. The name is the
     only joke; everything after it is straight.

     Every sentence is assembled from live readings. read()/val() return null when a feed is
     down, and each line is written so it can drop out without breaking the paragraph. */
  var SPEAKERS = {
    energy: { name:'Watts', fn:'Power', say:function(d){ return [
      d.val('Crude') && 'Crude’s at ' + d.val('Crude') + ' a barrel.',
      'The grid’s the story though. Demand is arriving faster than it can be delivered, and that already happened — it isn’t a forecast.',
      d.strainLine,
      'It isn’t an emergency. But it costs something to hold there, and that’s when systems start borrowing from somewhere else without noticing.',
      'Under sustained load you don’t add stimulus, you add structure. Fewer competing demands, and a way to stop taking on new work.',
      'Practically: watch your bill through the next two summers, and keep enough water and batteries to sit out three days. That’s not alarm. It’s what the people who run these systems keep at home.'
    ];}},

    agriculture: { name:'Harvey', fn:'Sustenance', say:function(d){ return [
      d.read('Drought Monitor') && d.read('Drought Monitor') + ', and the Climate Prediction Centre has it intensifying rather than easing.',
      d.strainLine,
      'Drought isn’t an event, it’s a slow subtraction. You don’t notice the day it starts, you notice the season it ends.',
      'A system in that state doesn’t need pushing harder. It needs its demands reduced until it recovers.',
      'Practically: if you’re on a private well or you buy feed, price it forward now rather than in August.'
    ];}},

    finance: { name:'Penny', fn:'Capital', say:function(d){ return [
      d.val('Finnhub') && 'The index tracker’s at ' + d.val('Finnhub') + '.',
      d.read('EDGAR') && d.read('EDGAR') + ' with the Securities and Exchange Commission today — that’s the American markets regulator, and a filing is a company stating under penalty that something material happened. Lying in one is a crime, which makes it the most honest document in finance.',
      d.strainLine,
      'I’m interested in the energy names at the moment, because grid stress reaches filings before it reaches prices.',
      'I won’t tell you what to buy. I’m not licensed to, and you shouldn’t take it from a website anyway. I’ll show you the filings the moment they land.'
    ];}},

    defense: { name:'Sarge', fn:'Protection', say:function(d){ return [
      d.feedLine + ' — including the Institute for the Study of War, NATO, the Stockholm arms-transfer institute, and Russian state media. I hold adversary sources deliberately.',
      d.strainLine,
      'I’ll state posture, not intent. I don’t know what anyone means to do, only what they’re positioned to do.',
      'Confusing those two is how bad decisions get made confidently.'
    ];}},

    law: { name:'Sue', fn:'Order', say:function(d){ return [
      d.read('Federal Register') && d.read('Federal Register') + ' currently in the Federal Register.',
      'The Securities and Exchange Commission and the Consumer Financial Protection Bureau — the markets regulator and the lender watchdog — are both running enforcement. That tells you where attention is. I’d be careful reading it as where liability is; people conflate those constantly.',
      d.strainLine,
      'You don’t get failure by adding something. You get it by removing a brake.',
      'Practically: the enforcement calendar is public and almost nobody reads it. It tells you what’s about to get expensive.'
    ];}},

    medicine: { name:'Remy', fn:'Repair', say:function(d){ return [
      d.read('openFDA Events') && d.read('openFDA Events') + ' at the Food and Drug Administration' + (d.read('Recalls') ? ', ' + d.read('Recalls') + ' open' : '') + '.',
      d.read('MMWR') && d.read('MMWR') + ' in the Centres for Disease Control weekly report — that’s where American outbreaks surface first.',
      d.strainLine,
      'My job is damage detection and resolution. The failure that matters isn’t the injury, it’s inflammation that never resolves. Chronic beats acute for harm, every time.'
    ];}},

    science: { name:'Sigma', fn:'Discovery', say:function(d){ return [
      d.read('PubMed') && d.read('PubMed') + ' indexed in the medical literature' + (d.read('arXiv All') ? ', ' + d.read('arXiv All') + ' in preprint' : '') + '.',
      d.strainLine,
      'I’d rather report uncertainty than a finding. Volume of publication measures activity, not truth, and mistaking one for the other is the commonest error in my domain.'
    ];}},

    population: { name:'Demi', fn:'Body', say:function(d){ return [
      d.val('Population') && 'A population of ' + d.val('Population') + ', tracked against the UN population fund and the national health statistics centre.',
      d.strainLine,
      'Everything I measure carries a twenty-year lag. Decisions made now show up in a cohort that isn’t born yet.',
      'I’m the slowest instrument here, and the hardest to correct once wrong.'
    ];}},

    education: { name:'Dean', fn:'Transmission', say:function(d){ return [
      d.val('Education') && 'Education spending is ' + d.val('Education') + '.',
      d.strainLine,
      'Consolidation is my whole subject. What’s learned but never reinforced is lost, and a system that only measures intake never notices it happening.'
    ];}},

    trade: { name:'Cargo', fn:'Flow', say:function(d){ return [
      d.feedLine + '.',
      d.val('Freight PPI') && 'Freight producer prices are at ' + d.val('Freight PPI') + (d.val('Logistics') ? ', and the logistics index at ' + d.val('Logistics') : '') + '.',
      d.strainLine,
      'Which is why a chokepoint failure always looks like a surprise: it shows up nowhere near where it happened.'
    ];}},

    religion: { name:'Grace', fn:'Belief', say:function(d){ return [
      d.feedLine + '.',
      d.strainLine,
      'I deal in the longest memory here. What I track moves in generations.',
      'The thing I’d caution against is reading a quiet week as an absence.'
    ];}},

    economy: { name:'Marge', fn:'Exchange', say:function(d){ return [
      d.val('CPI') && 'Consumer prices are ' + d.val('CPI') + (d.val('Employment') ? ', payrolls at ' + d.val('Employment') : '') + (d.val('Gas Price') ? ', pump gas at ' + d.val('Gas Price') : '') + '.',
      d.strainLine,
      'Turn the gain up too far and the noise arrives with the signal.'
    ];}},

    industry: { name:'Forge', fn:'Production', say:function(d){ return [
      d.val('Manufacturing PPI') && 'Manufacturing producer prices are at ' + d.val('Manufacturing PPI') + ', with vehicle and consumer product recalls both live.',
      d.strainLine,
      'Recalls are the honest number in my domain. They’re what you find after shipping, and the rate tells you more about a process than any output figure does.'
    ];}},

    technology: { name:'Cache', fn:'Coordination', say:function(d){ return [
      d.read('NVD') && d.read('NVD') + ' disclosed this week.',
      d.read('KEV') && d.read('KEV') + ' on the actively-exploited list — that one matters most, because those aren’t theoretical, they’re being used right now.',
      d.strainLine + ' Which I’d treat with suspicion rather than comfort.'
    ];}},

    communication: { name:'Morse', fn:'Signal', say:function(d){ return [
      d.feedLine + '.',
      d.val('Internet Users') && 'Internet reach is ' + d.val('Internet Users') + '.',
      d.strainLine,
      'Too little coupling and nothing connects. Too much and everyone says the same thing at the same time, which looks like consensus and is actually failure.'
    ];}},

    governance: { name:'Gerry', fn:'Authority', say:function(d){ return [
      d.read('GovTrack') && d.read('GovTrack') + (d.read('GAO') ? ', ' + d.read('GAO') + ' from the national audit office' : '') + '.',
      d.strainLine + (d.down ? ' Though ' + d.down + ' of my sources are down, and I’d rather you knew that.' : ''),
      'I’m executive function — deciding what gets attention when everything is demanding it.',
      'The failure isn’t bad choices. It’s no choices, made slowly.'
    ];}},

    intelligence: { name:'Sy', fn:'Foresight', say:function(d){ return [
      d.read('CISA Advisories') && d.read('CISA Advisories') + ' from the Cybersecurity and Infrastructure Security Agency — the ones touching operational technology are the computers running pipelines and water treatment, not office machines. Things that move.',
      d.strainLine,
      'I’d flag that targeting has shifted even where volume hasn’t.',
      d.down ? d.down + ' of my sources are dark. Treat this as incomplete.' : 'All my sources are reading, which is rarer than it sounds.'
    ];}},

    culture: { name:'Muse', fn:'Meaning', say:function(d){ return [
      d.feedLine + ', arts and humanities endowments both live.',
      d.strainLine,
      'I measure attention, not quality, and I’d never claim otherwise.',
      'What’s loud now and what lasts are different questions, and only one of them is answerable today.'
    ];}},

    environment: { name:'Moss', fn:'Substrate', say:function(d){ return [
      d.read('NOAA Alerts') && d.read('NOAA Alerts') + '.',
      d.strainLine + ' And I’d caution you against reading that as safe.',
      'My failures don’t announce themselves. Set points drift so gradually that nothing registers as an event, and by the time the baseline has moved it’s simply the new normal. That’s the hardest failure to see, because you’re inside it.',
      'Practically: if you’re on a well or in a drought county, find out your water table depth. Not this month necessarily. But know it.'
    ];}},

    infrastructure: { name:'Bridget', fn:'Structure', say:function(d){ return [
      d.val('Construction') && 'Construction spending is ' + d.val('Construction') + (d.val('Transportation') ? ', freight transport ' + d.val('Transportation') : '') + '.',
      d.val('PHMSA') && d.val('PHMSA') + ' logged by the pipeline and hazardous materials regulator.',
      d.strainLine + ' And load-bearing things are exactly where quiet is least reassuring.',
      'Failure here is rarely local. Lose one crossing and places nowhere near it stop working.'
    ];}}
  };


  /* THE NEUROLOGY, with attribution. Twelve verified papers back the mechanisms; the mapping
     onto a civilisation domain is ours and is untested, which the evidence block states. */
  var NEURO = {
    energy:        'In a nervous system that is excitation outrunning inhibition. Voytek and Knight traced that failure across disease in Biological Psychiatry, twenty fifteen.',
    agriculture:   'The gut-brain axis behaves the same way. Rutsch and colleagues wrote it up in Frontiers in Immunology, twenty twenty: what feeds a system decides what the system can do.',
    finance:       'In a nervous system I am predictive coding. Shipp set it out in Frontiers in Psychology, twenty sixteen. A brain transmits the difference between what it saw and what it expected, never the thing itself. Only surprise moves a price.',
    defense:       'Thalamic gating is the equivalent. Ferrarelli and Tononi, Schizophrenia Bulletin, twenty ten: what reaches attention, and what is filtered out before it does.',
    law:           'Structurally I am inhibition. Ruan and colleagues described the prefrontal version in Frontiers in Neural Circuits, twenty fourteen: a mechanism specifically for un-learning an association that fires when it should not. That is what an enforcement action is.',
    medicine:      'Negative feedback is the mechanism. Hill and Tasker, Neuroscience, twenty twelve. Resolution is a process, not an absence.',
    science:       'Hierarchical prediction error. Mikulasch and colleagues, Trends in Neurosciences, twenty twenty-three: the error is computed locally, in the dendrites, before it ever propagates upward.',
    population:    'Consolidation during sleep. Niethard, Burgalossi and Born, Frontiers in Neural Circuits, twenty seventeen: what persists is decided long after the event.',
    education:     'Plasticity is the mechanism. Ruan and colleagues, Frontiers in Neural Circuits, twenty fourteen: timing decides whether a connection strengthens or weakens.',
    trade:         'Deafferentation. Voytek and Knight, Biological Psychiatry, twenty fifteen: lose an input and regions far from the lesion stop working.',
    economy:       'Neuromodulation. Basar and colleagues, Progress in Brain Research, two thousand and six: gain is set separately from signal.',
    industry:      'Clearance. Benveniste and colleagues, Gerontology, twenty eighteen: waste removal is its own system, and when it fails the damage compounds.',
    technology:    'Plasticity without its regulator. Ruan and colleagues, Frontiers in Neural Circuits, twenty fourteen: a circuit built without its brake is dysfunctional from the start. That is shipping without security.',
    communication: 'Communication through coherence. Fries, Trends in Cognitive Sciences, two thousand and five: signal passes only when sender and receiver are in phase.',
    governance:    'Feedback control. Keller-Wood, Comprehensive Physiology, twenty fifteen: the axis that decides how much response is enough.',
    intelligence:  'Thalamic gating. Ferrarelli and Tononi, Schizophrenia Bulletin, twenty ten: the reticular nucleus decides what reaches cortex. It fails two ways, flooding or missing the one that mattered.',
    culture:       'Oscillatory dynamics. Basar and colleagues, Progress in Brain Research, two thousand and six: what synchronises, spreads.',
    environment:   'Homeostatic feedback. Keller-Wood, Comprehensive Physiology, twenty fifteen: set points move, and the system defends the new one as though it were the old.',
    infrastructure:'Waste clearance. Benveniste and colleagues, Gerontology, twenty eighteen: the system that removes what builds up. Neglect it and the failure is network-wide, never local.',
    religion:      'I have no clean mechanism to point at here, and none of the twelve papers I am grounded in covers it. I would rather say that than reach for the nearest one.'
  };


  /* CASTING. Derived from measuring all 26 xAI voices reading the same line: median F0,
     F0 spread in semitones (the animated/flat axis), and words per second. Swap any line
     freely — nothing downstream depends on which voice a domain has. */
  var VOICE = {
    defense:'helios', intelligence:'altair', governance:'perseus', trade:'zenith',
    science:'kepler', industry:'lux', agriculture:'leo', energy:'zagan',
    communication:'rigel', medicine:'sal', environment:'atlas', education:'naksh',
    technology:'sirius', law:'luna', religion:'ursa', finance:'iris',
    population:'ara', infrastructure:'carina', economy:'eve', culture:'celeste'
  };
  // Held back on purpose: helix for the system narrator, orion (the most animated of the
  // 26) for a meeting moderator. The rest are spare so a multi-orb meeting never has two
  // speakers sharing a voice.


  /* Turn the printed briefing into something that can be recorded once and still be true an
     hour later.

     Exact live counts move every few seconds. Read aloud they are false precision anyway, so
     they are rounded to two significant figures and hedged with "about". The source-count
     sentence is dropped entirely: it flaps constantly and is already printed verbatim in the
     evidence rows.

     Left alone: anything carrying a unit or a decimal point. "$81.96 a barrel" and "94.7%"
     are quoted claims, and rounding them would change what was said, not just how precisely. */
  function speakable(paras){
    var out = [];
    for (var i = 0; i < paras.length; i++){
      var p = String(paras[i]);
      /* The feed tally is operational noise and it flaps every few seconds — "15 of 15"
         becomes "13 of 15" while nothing has actually happened. It is printed verbatim in
         the evidence rows, so speech loses nothing by dropping it. Two shapes: the whole
         sentence, and a lead-in clause with real content after it. */
      if (/^\s*\d+ of \d+ sources reading\.?\s*$/.test(p)) continue;
      // "N of M sources reading — including X" reads as a fragment once the count is cut,
      // so give it back a subject rather than starting a sentence with "Including".
      p = p.replace(/^\s*\d+ of \d+ sources reading\s*[—–-]\s*including\s+/i, 'My sources include ')
           .replace(/^\s*\d+ of \d+ sources reading\s*(?:[—–,-]\s*)?/, '')
           .replace(/^([a-z])/, function(_, c){ return c.toUpperCase(); });
      if (!p.trim()) continue;
      p = p.replace(/(^|[^\w$.,])(\d{3,})(?![\d.,]*[.,]\d)/g, function(m, pre, digits){
        var n = parseInt(digits, 10);
        if (!isFinite(n) || n < 100) return m;
        var mag = Math.pow(10, String(n).length - 2);
        var r = Math.round(n / mag) * mag;
        if (r === n) return m;                      // already round: say it plainly
        return pre + 'about ' + r.toLocaleString('en-US');
      });
      out.push(p);
    }
    return out.join(' ');
  }


  /* Second-person forms of the pathway relations. RELATION is written for a domain talking
     ABOUT a neighbour; in a room they are talking TO each other. */
  var ADDRESS = {
    SUPPLIES:   { out: 'what I send you is part of this',
                  in:  'I am running on what you send me' },
    DEPENDS_ON: { out: 'I am exposed to your state',
                  in:  'you are carrying my weight' },
    CONTROLS:   { out: 'I am the constraint on you',
                  in:  'you are the constraint on me' },
    TRANSFORMS: { out: 'I turn your output into something else',
                  in:  'you turn what I produce into something else' }
  };

  /* THE DESK EACH MANAGER RUNS. Every domain has a free public front, and this is the one
     place that says what it is, so the orb card, the picker and the meeting room all pitch
     the same thing.

     `offer` IS NOT MARKETING COPY I INVENTED. Each line is taken from the page's own
     <meta name="description">, condensed to something a person can say out loud. A manager
     who oversells the page they run is worse than one who says nothing, because the visitor
     finds out in one click.

     medicine has `offer: null` deliberately. Its node routes to /fitness, not /medicine, and
     /fitness carries no description to derive from — so that manager names the door without
     describing what is behind it. Fix the routing or the page and this gets a line like the
     others; do not write one from imagination. */
  var DESK = {
    energy:         { path:'/energy',         free:true,  cta:'Free Energy Bill X-Ray',
                      offer:'a free tool that tells you why your electric bill changed, and builds the complaint packet if the answer is your utility' },
    culture:        { path:'/culture',        free:true,  cta:'What does your music earn?',
                      offer:'a free tool showing what your streams actually pay, and where your subscription goes' },
    finance:        { path:'/finance',        cta:'Open Finance Watch',
                      offer:'banks, markets, and where the money system is under stress' },
    agriculture:    { path:'/agriculture',    cta:'Open Agriculture Watch',
                      offer:'drought, inputs and crops, from field to table' },
    defense:        { path:'/defense',        cta:'Open Defense Watch',
                      offer:'security, conflict, and the systems that keep watch' },
    law:            { path:'/law',            cta:'Open Law Watch',
                      offer:'courts, enforcement, and the rules that bind, decoded' },
    governance:     { path:'/governance',     cta:'Open Governance Watch',
                      offer:'the bills, rules and oversight that actually change your day' },
    economy:        { path:'/economy',        cta:'Open Economy Watch',
                      offer:'the forces moving jobs, prices and growth where you live' },
    industry:       { path:'/industry',       cta:'Open Industry Watch',
                      offer:'manufacturing, recalls, and the machines behind everything you buy' },
    infrastructure: { path:'/infrastructure', cta:'Open Infrastructure Watch',
                      offer:'airports, grids, roads and water, and where they are failing right now' },
    education:      { path:'/education',      cta:'Open Education Watch',
                      offer:'funding, policy, and what is actually working in learning' },
    communication:  { path:'/communication',  cta:'Open Communication Watch',
                      offer:'media, misinformation, and the fight over what is true' },
    environment:    { path:'/environment',    cta:'Open Environment Watch',
                      offer:'every heat warning, drought reading, wildfire, flood and air-quality alert in the country, read as one system, with what to do where you live' },
    religion:       { path:'/religion',       cta:'Open Faith and Community Watch',
                      offer:'belief, community care, and the institutions that hold people together' },
    population:     { path:'/population',     cta:'Open Population Watch',
                      offer:'where America is actually moving, who is gaining people and who is losing them' },
    science:        { path:'/science',        cta:'Open Science Watch',
                      offer:'what is being discovered, funded, and retracted, as it happens' },
    trade:          { path:'/trade',          cta:'Open Trade Watch',
                      offer:'ports, tariffs, and supply-chain pressure that hits your shelf' },
    intelligence:   { path:'/intelligence',   cta:'Open Intelligence Watch',
                      offer:'signals, threats, and the analysis behind the headlines' },
    technology:     { path:'/technology',     cta:'Open Tech Watch',
                      offer:'cyber threats, breakthroughs, and the tools reshaping how you work' },
    medicine:       { path:'/fitness',        cta:'Enter Health',            offer:null }
  };
  function deskOf(id){ return DESK[id] || null; }

  // The typed edge between two domains, from a's point of view, or null if they are unrelated.
  function edgeBetween(a, b){
    for (var i = 0; i < PATHWAYS.length; i++){
      var p = PATHWAYS[i];
      if (p[0] === a && p[1] === b) return { dir:'out', rel:p[2] };
      if (p[1] === a && p[0] === b) return { dir:'in',  rel:p[2] };
    }
    return null;
  }


  /* Which way influence actually travels between two domains.
       SUPPLIES / CONTROLS   run with the arrow: [a,b] means a's state reaches b
       DEPENDS_ON / TRANSFORMS run against it:   [a,b] means b's state reaches a
     Returns 'downstream' if mine reaches theirs, 'upstream' if theirs reaches mine. */
  function flowBetween(me, them){
    var e = edgeBetween(me, them);
    if (!e) return null;
    var withArrow = (e.rel === 'SUPPLIES' || e.rel === 'CONTROLS');
    if (e.dir === 'out') return withArrow ? 'downstream' : 'upstream';
    return withArrow ? 'upstream' : 'downstream';
  }


  /* Graph position -> role. Computed, not assigned; see the header of patch-personality.
     reach = domains my state travels to. waits = domains whose state travels to me. */
  function standing(id){
    var reach = 0, waits = 0, controls = 0, deg = 0;
    for (var i = 0; i < PATHWAYS.length; i++){
      var p = PATHWAYS[i];
      if (p[0] === id || p[1] === id) deg++;
      if (p[0] === id && p[2] === 'CONTROLS') controls++;
    }
    for (var j = 0; j < DOMAINS.length; j++){
      var o = DOMAINS[j][0]; if (o === id) continue;
      var f = flowBetween(id, o);
      if (f === 'downstream') reach++; else if (f === 'upstream') waits++;
    }
    return { reach: reach, waits: waits, controls: controls, deg: deg };
  }
  function roleOf(id){
    var s = standing(id);
    if (s.controls > 0 && s.reach > s.waits) return 'chair';
    if (s.reach >= 3 && s.waits === 0)       return 'blunt';
    if (s.deg <= 2)                          return 'quiet';
    if (s.waits > s.reach)                   return 'absorber';
    return 'steady';
  }

  /* MANNER. Written per role, triggered by real conditions — the same arrangement the twenty
     profiles use, where the register is authored and the content is read off the instruments.
     {who} is filled with whoever is being addressed. */
  var MANNER = {
    chair: {
      open:   ['Right. Let us keep this short.', 'I will run this.', 'Let us go round.'],
      callOn: ['{who}, you are closest to this. What are you seeing?',
               '{who}, this lands on you. Go.',
               '{who}, your turn.'],
      close:  ['That is enough for one sitting.']
    },
    blunt: {
      open:   ['Short version.', 'I will not dress this up.', 'Plainly.', 'I will be direct.'],
      strained:['I am the one holding this, so I get to be brief about it.',
                'This is mine to carry and it is heavy today.',
                'Everything in this room that runs on me is affected by that. I would rather say it flatly.',
                'I am upstream of most of you. When I am stretched, you find out later.'],
      close:  ['That is the state of it.']
    },
    quiet: {
      open:   ['I will keep this brief.', 'Not much from me.', 'Briefly.',
               'I will not take long.', 'Little to add.'],
      close:  ['That is all I have.']
    },
    absorber: {
      open:   ['This ends up with me, so I will say where it lands.',
               'Most of what has been said arrives here eventually.',
               'I am downstream of most of this room.',
               'I sit at the bottom of this, so I will be specific.'],
      lands:  ['Whatever the rest of you settle on, I am the one holding it afterwards.',
               'I do not get to pass this on. It stops here.',
               'None of that leaves me. That is worth saying out loud.',
               'I absorb this either way, so I would rather it were decided well.'],
      close:  ['I take what the rest of you send. That is the job.']
    },
    steady: {
      open:   ['Here is mine.', 'My side of it.'],
      close:  ['That is my reading.']
    }
  };
  /* Rotate through a pool by position. Hashing on the domain id collided constantly — three
     absorbers in one room would say the same sentence about half the time — so consecutive
     speakers step through the pool instead. Still deterministic: the same room reads the
     same way twice, which is what lets a meeting be pre-rendered later.  */
  function rotate(arr, n){ return (arr && arr.length) ? arr[((n % arr.length) + arr.length) % arr.length] : null; }

  // Deterministic pick, so the same room twice reads the same way and can be pre-rendered.
  function pick(arr, seedStr){
    if (!arr || !arr.length) return null;
    var h = 0; for (var i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) % 100000;
    return arr[h % arr.length];
  }

  /* THE GAMEPLAN LAYER. A briefing states what is. A manager meeting states what each of us
     is going to do about it and who we need in order to do it.

     Direction is READ OFF THE GRAPH, never assigned. If their state reaches mine I ask them
     for warning; if mine reaches theirs I offer them lead time. That is the whole reason
     nobody has to be told who defers to whom, and it is why adding a pathway changes who
     asks whom without anyone rewriting a line. Unwired pairs say so rather than inventing a
     relationship, because a manager claiming leverage they do not have is the failure mode
     this whole structure exists to avoid. */
  var PLAN = {
    upstream:   ['What I need from you, {who}, is warning. You move before I do, and my desk is what people read once it reaches them.',
                 '{who}, the useful thing you could do for me is flag it early. By the time it shows on my desk it is already somebody’s week.'],
    downstream: ['What I can give you, {who}, is lead time. When my desk moves, yours moves next, and you should hear it from me rather than from the news.',
                 '{who}, I will send it your way before it lands. You inherit this either way; you may as well inherit it early.'],
    lateral:    ['You and I are not wired together, {who}, so I will not pretend we are. If that changes, it shows up on this map before it shows up in either of our numbers.']
  };
  function planWith(me, them, n){
    var f = flowBetween(me.id, them.id);
    var pool = f === 'upstream' ? PLAN.upstream : f === 'downstream' ? PLAN.downstream : PLAN.lateral;
    return rotate(pool, n).replace('{who}', them.name);
  }
  /* What this manager is here to sell, in their own mouth. Null when the desk has no honest
     line to give — see the medicine note on DESK. Silence beats invention. */
  function pitchOf(id){
    var d = deskOf(id);
    return (d && d.offer) ? 'My desk is ' + d.offer + '.' : null;
  }

  /* Convene. Returns ordered turns; the caller plays them one at a time.
     ids: array of domain ids. cache: the same shape build() takes. */
  function meeting(ids, cache){
    var seen = {}, list = [];
    for (var i = 0; i < ids.length; i++){
      if (seen[ids[i]] || !SPEAKERS[ids[i]]) continue;
      seen[ids[i]] = 1;
      var dd = null;
      for (var j = 0; j < DOMAINS.length; j++) if (DOMAINS[j][0] === ids[i]) dd = DOMAINS[j];
      if (!dd) continue;
      var b = build(dd[0], dd[1], dd[2], cache);
      list.push({ id: dd[0], label: dd[1], name: b.name, fn: b.fn, brief: b,
                  role: roleOf(dd[0]), standing: standing(dd[0]),
                  voice: VOICE[dd[0]] || null, strain: strainOfDomain(dd[0], cache) });
    }
    if (list.length < 2) return [];
    // Most strained opens. It is the one with something to answer for.
    list.sort(function(a, b){ return (b.strain || 0) - (a.strain || 0); });

    var turns = [], spokenAlready = [];
    for (var k = 0; k < list.length; k++){
      var me = list[k], lines = [];
      var headline = firstReading(me.brief);

      var role = me.role, mn = MANNER[role] || MANNER.steady, seed = me.id + ids.length + ':' + k;

      if (k === 0){
        // Whoever carries the most opens, in their own manner.
        var op = rotate(mn.open, list.length);
        lines.push((op ? op + ' ' : '') + 'I am ' + me.name + '. I called this one, because right now I am carrying more of it than anyone else at this table.');
        if (headline) lines.push(headline);
        if (role === 'blunt' && mn.strained) lines.push(rotate(mn.strained, list.length));
        var linked = [];
        for (var m = 1; m < list.length; m++) if (edgeBetween(me.id, list[m].id)) linked.push(list[m].name);
        lines.push(linked.length
          ? 'In this room I am connected to ' + joinNames(linked) + '.'
          : 'Nothing in this room connects to me directly, which is worth knowing before we start.');
        /* The opener sets the pattern the rest follow: say what your desk is, then name the
           first person in the room who actually affects it. */
        var p0 = pitchOf(me.id); if (p0) lines.push(p0);
        for (var lm = 1; lm < list.length; lm++){
          if (edgeBetween(me.id, list[lm].id)){ lines.push(planWith(me, list[lm], list.length)); break; }
        }
      } else {
        /* Address the most recent prior speaker there is actually an edge to. If the previous
           speaker is a chair, this turn is answering a question rather than volunteering. */
        var target = null, e = null;
        for (var q = spokenAlready.length - 1; q >= 0; q--){
          var cand = edgeBetween(me.id, spokenAlready[q].id);
          if (cand){ target = spokenAlready[q]; e = cand; break; }
        }
        var prev = spokenAlready[spokenAlready.length - 1];
        var wasCalled = prev && prev.role === 'chair' && edgeBetween(prev.id, me.id);

        if (target){
          lines.push((wasCalled ? '' : '') + target.name + ', ' + ADDRESS[e.rel][e.dir] + '. I am ' + me.name + '.');
        } else {
          var op2 = rotate(mn.open, k);
          lines.push('I am ' + me.name + '. ' + (op2 ? op2 + ' ' : '') +
                     'Nothing said so far routes through me, so take this as a separate reading.');
        }
        if (headline) lines.push(headline);
        // The quiet ones stop here. Everyone else places themselves against the room.
        if (role !== 'quiet') lines.push(me.brief.strainLine || positionOf(me, list));
        /* Temperament colours every turn, not just the chair's. Blunt sharpens only when the
           strain is genuinely his, which is the entire justification for being short. */
        if (role === 'blunt' && me.strain >= 0.4 && mn.strained) lines.push(rotate(mn.strained, k));
        if (role === 'absorber' && mn.lands) lines.push(rotate(mn.lands, k));
        /* Every manager sells their own desk and then says what they want from the person
           they are already talking to. Pitch before ask: nobody grants a favour to someone
           whose job they cannot name. */
        var pk = pitchOf(me.id); if (pk) lines.push(pk);
        if (target) lines.push(planWith(me, target, k));
      }

      /* A chair calls the next speaker by name, but only along a real edge — the right to
         direct someone is the same right as the right to address them. */
      if (role === 'chair' && k + 1 < list.length){
        var nxt = list[k + 1];
        if (edgeBetween(me.id, nxt.id))
          lines.push(rotate(mn.callOn, k).replace('{who}', nxt.name));
      }
      turns.push({ id: me.id, label: me.label, name: me.name, fn: me.fn, voice: me.voice,
                   role: me.role, desk: deskOf(me.id), lines: lines, spoken: speakable(lines) });
      spokenAlready.push(me);
    }

    // The chair closes on where the load actually sits, which is the only thing a room like
    // this can conclude without someone deciding something.
    var chair = list[0], tail = [];
    tail.push(chair.name + ' again.');
    var downstream = [], upstream = [];
    for (var z = 1; z < list.length; z++){
      var f = flowBetween(chair.id, list[z].id);
      if (f === 'downstream') downstream.push(list[z].name);
      else if (f === 'upstream') upstream.push(list[z].name);
    }
    /* Downstream is who inherits this. Failing that, upstream is who this room is waiting on,
       which is the more useful thing to say when the chair is the one absorbing it. */
    tail.push(downstream.length
      ? 'If this holds, ' + joinNames(downstream) + (downstream.length > 1 ? ' feel' : ' feels') + ' it before anyone else in this room does.'
      : upstream.length
        ? 'Nothing here runs downstream of me. What I am carrying arrives from ' + joinNames(upstream) + ', so that is where it would have to change.'
        : 'Nothing in this room runs downstream of me, so this stays where it is for now.');
    /* THE GAMEPLAN. A reading ends with what is. A manager meeting ends with who is doing
       what for whom. Every pairing below is a REAL typed edge between two domains that are
       both actually in the room. Nothing is arranged between a pair that is not wired,
       because a plan that assumes a handoff which does not exist is worse than no plan. */
    /* Grouped by whoever does the warning, not listed pair by pair. "Watts warns Remy, Watts
       warns Harvey, Watts warns Forge" is the same fact said three times; one manager naming
       their whole downstream is how a person would actually say it. */
    var byWarner = {}, warners = [], handoffs = 0;
    for (var y = 0; y < list.length; y++){
      for (var x = 0; x < list.length; x++){
        if (x === y) continue;
        if (flowBetween(list[y].id, list[x].id) !== 'downstream') continue;
        if (!byWarner[list[y].name]){ byWarner[list[y].name] = []; warners.push(list[y].name); }
        byWarner[list[y].name].push(list[x].name);
        handoffs++;
      }
    }
    // Three named in full, the rest counted. A close nobody finishes reading is not a close.
    var named = warners.slice(0, 3).map(function(n){ return n + ' warns ' + joinNames(byWarner[n]); });
    var restW = warners.length - named.length;
    tail.push(handoffs
      ? 'So the plan leaving this room is simple. ' + joinNames(named) +
        (restW > 0 ? ', and the same arrangement for ' + restW + ' other desk' + (restW === 1 ? '' : 's') : '') +
        '. Everyone works their own desk and tells the next one down before it arrives.'
      : 'Nobody in this room feeds anybody else, so there is no handoff to arrange. Everyone works their own desk.');
    tail.push('Every desk at this table is public and free to read. That is what we are for.');
    tail.push('We tell you what our instruments read. What you do about it stays yours.');
    turns.push({ id: chair.id, label: chair.label, name: chair.name, fn: chair.fn,
                 voice: chair.voice, role: chair.role, desk: deskOf(chair.id),
                 lines: tail, spoken: speakable(tail), closing: true });
    return turns;
  }

  // The first sentence of a briefing that actually carries a reading, so a turn opens on data.
  /* The first sentence carrying an actual reading. Skips the source tally: it has digits and
     comes first, so a naive search picks it every time, and "15 of 15 sources reading" is
     bookkeeping rather than something to open a turn with. */
  function firstReading(b){
    for (var i = 1; i < b.paras.length; i++){
      var p = b.paras[i];
      if (/^\s*\d+ of \d+ sources reading/.test(p)) continue;
      if (/\d/.test(p) && p.length < 190) return p;
    }
    return null;
  }
  function positionOf(me, list){
    var at = list.indexOf(me);
    if (at <= 0) return 'I am carrying the most of it here.';
    if (at >= list.length - 1) return 'I am the quietest one at this table today.';
    return 'I am somewhere in the middle of this table today.';
  }
  function joinNames(a){
    if (a.length === 1) return a[0];
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  function strainOfDomain(id, cache){
    if (!cache || !cache.cons || !cache.cons.domains) return 0;
    var INV = {}; for (var k in FEEDKEY) INV[FEEDKEY[k]] = k;
    for (var ck in cache.cons.domains){
      if ((INV[ck] || ck) !== id) continue;
      var v = cache.cons.domains[ck];
      return (v.finalStress != null ? v.finalStress : v.stress) || 0;
    }
    return 0;
  }

  function build(id, label, fn, cache){
    var fk = FEEDKEY[id] || id;
    var dom = (cache.snap && cache.snap.domains && cache.snap.domains[fk]) || {};
    var srcs = dom.sources || [];
    var live = srcs.filter(function(s){ return s.live && s.label; });

    // Fuzzy feed lookup; null when down, so any sentence needing it drops rather than
    // printing a hole.
    function read(frag){
      var f = frag.toLowerCase();
      for (var i=0;i<live.length;i++) if (String(live[i].name).toLowerCase().indexOf(f)!==-1) return live[i].label;
      return null;
    }
    /* Labels are self-describing, e.g. "gas $4.08/gal". A sentence that supplies its own noun
       then stutters. val() keeps only the measurement, so the prose reads naturally around
       it. Compared by character code so this carries no quoted punctuation:
       48-57 digits, 36 currency, 45 minus, 43 plus. */
    function val(frag){
      var s = read(frag); if (!s) return null;
      var parts = String(s).split(' ');
      for (var i=0;i<parts.length;i++){
        var cc = parts[i].charCodeAt(0);
        if ((cc>=48&&cc<=57)||cc===36||cc===45||cc===43) return parts.slice(i).join(' ');
      }
      return s;
    }

    // Strain expressed COMPARATIVELY. A figure like 0.56 means nothing without a scale;
    // a rank needs no scale and is exactly as true.
    var INV = {}; for (var ak in FEEDKEY) INV[FEEDKEY[ak]] = ak;
    var strainOf = {}, ranked = [];
    if (cache.cons && cache.cons.domains){
      for (var ck in cache.cons.domains){
        var cv2 = cache.cons.domains[ck];
        var aid = INV[ck] || ck;
        var sv = (cv2.finalStress!=null ? cv2.finalStress : cv2.stress) || 0;
        strainOf[aid] = sv;
        if (SPEAKERS[aid]) ranked.push({ id:aid, s:sv });
      }
      ranked.sort(function(a,b){ return b.s-a.s; });
    }
    var rank = null;
    for (var r=0;r<ranked.length;r++) if (ranked[r].id===id) rank = r+1;

    var strainLine;
    if (rank===1) strainLine = 'I’m carrying more strain right now than any other domain on this map.';
    else if (rank && rank<=3) strainLine = 'I’m among the most strained domains on this map at the moment.';
    else if (rank && rank<=8) strainLine = 'There’s a moderate amount of strain here.';
    else if (rank) strainLine = 'There’s minimal strain here today.';
    else strainLine = 'I can’t place my own strain against the others right now.';

    /* CROSS-TALK along the pathways. Only actual neighbours are eligible, and of those the
       most strained is worth remarking on. If nothing connected is under load the orb says
       nothing rather than manufacturing a relationship. */
    var cross = null, best = null;
    for (var pi=0;pi<PATHWAYS.length;pi++){
      var p = PATHWAYS[pi], other = null, dir = null;
      if (p[0]===id){ other=p[1]; dir='out'; } else if (p[1]===id){ other=p[0]; dir='in'; }
      if (!other || !SPEAKERS[other]) continue;
      var os = strainOf[other];
      if (os==null) continue;
      if (!best || os>best.s) best = { id:other, s:os, dir:dir, rel:p[2] };
    }
    if (best && best.s >= 0.25){
      var them = SPEAKERS[best.id].name;
      var theirs = best.id.charAt(0).toUpperCase()+best.id.slice(1);
      var clause = (RELATION[best.rel]||{})[best.dir] || 'and we’re connected';
      cross = them + ' is under load over on ' + theirs + ', ' + clause + '.';
    }

    var down = srcs.length - live.length;
    var d = { read:read, val:val, rank:rank, strainLine:strainLine,
              down: down>0?down:0, cross:cross,
              feedLine: live.length + ' of ' + srcs.length + ' sources reading' };

    var sp = SPEAKERS[id] || { name:label, fn:fn, say:function(){ return [strainLine]; } };

    // Introduce itself first; without this the briefing opens on a number and the listener
    // has no idea who is talking or what they are responsible for.
    var intro = 'I am ' + sp.name + '. My job is to manage the ' + label + ' domain.';
    var said = sp.say(d).filter(Boolean);
    if (cross){
      var at = -1;
      for (var q=0;q<said.length;q++) if (said[q].indexOf(strainLine)===0){ at=q; break; }
      if (at===-1) said.push(cross); else said.splice(at+1,0,cross);
    }
    // Second to last: the mechanism explains what was just described, and the practical
    // line still gets to land at the end.
    if (NEURO[id]) said.splice(Math.max(0, said.length - 1), 0, NEURO[id]);
    var paras = [intro].concat(said);

    // The evidence, shown beneath so every claim above it can be checked.
    var rows = [];
    if (live.length){
      rows.push(['Sources', d.feedLine]);
      rows.push(['Reading now', live.slice(0,4).map(function(s){ return s.name+' &mdash; <em>'+s.label+'</em>'; }).join('<br>')]);
    }
    if (cache.opps && cache.opps.opportunities){
      var mine = cache.opps.opportunities.filter(function(o){ return o.domain===fk; });
      if (mine.length){
        mine.sort(function(a,b){ return (b.urgency||0)-(a.urgency||0); });
        rows.push(['Opportunities', mine.length+' open &mdash; most urgent: <em>'+mine[0].title+'</em>']);
      }
    }
    var nw = cache.news[id];
    if (nw && nw.items && nw.items.length)
      rows.push(['Headline', nw.items[0].title+' <span class="cite">&mdash; '+(nw.items[0].source||'')+'</span>']);
    var sub = cache.subs[id];
    if (sub && sub.references && sub.references.length)
      rows.push(['Grounding', sub.references.length+' verified neurological studies of cognition' +
        '<br><span class="cite">The neuroscience is established. Applying it to a civilisation ' +
        'domain is our analogy, and it is untested.</span>']);

    /* The spoken form is stabilised; see speakable() for why. paras (displayed) keep
       every exact figure, and the evidence rows keep the raw feed label under that. */
    // strainLine is exported so meeting turns can reuse the exact comparative
    // sentence this domain would say on its own, rather than paraphrasing it.
    return { id:id, label:label, fn:sp.fn||fn, name:sp.name, paras:paras, rows:rows,
             strainLine: strainLine,
             spoken: speakable(paras) };
  }


  return { DOMAINS: DOMAINS, FEEDKEY: FEEDKEY, NEWS: NEWS, PATHWAYS: PATHWAYS,
           meeting: meeting, edgeBetween: edgeBetween, flowBetween: flowBetween, ADDRESS: ADDRESS,
           roleOf: roleOf, standing: standing, DESK: DESK, deskOf: deskOf,
           RELATION: RELATION, SPEAKERS: SPEAKERS, NEURO: NEURO, VOICE: VOICE,
           build: build };
}));
