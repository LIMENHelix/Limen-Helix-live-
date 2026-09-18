/**
 * lib/homestead-chat.js — on-page Homestead sales agent, deterministic core.
 *
 * Qualify and route without a model. Grok is optional garnish behind the kill
 * switch. Never legal advice. Never invent auction dates. Crisis → human + hotlines.
 */
'use strict';

var FAQ = [
  {
    id: 'what-is-read',
    keys: ['what is homestead read', 'what does this do', 'how does this work', 'free tool', 'stage clock'],
    reply: 'Homestead Read is free. Enter a ZIP or street and what you received (late notice, NOD, sale notice, or not sure). You get an educational stage clock and what people in that stage typically do next, plus official county/state links. We do not invent auction dates and this is not a property-record search.'
  },
  {
    id: 'legal',
    keys: ['legal advice', 'lawyer', 'attorney', 'can you represent', 'is this legal'],
    reply: 'This is educational information, not legal advice. We do not represent you. For legal questions, use legal aid or your state bar lawyer-referral line. A HUD-approved counselor is free: hud.gov/findacounselor.'
  },
  {
    id: 'dates',
    keys: ['auction date', 'when is the sale', 'what day', 'sale date', 'when do i lose'],
    reply: 'We will not invent an auction date. The date that counts is on the notice you received and on the county’s official sale list (sheriff, trustee, or clerk). If it is not on that list, it is not a date we will print.'
  },
  {
    id: 'nod',
    keys: ['what is a nod', 'notice of default', 'lis pendens', 'what does nod mean'],
    reply: 'A Notice of Default (or your state’s equivalent) is the formal public start of many foreclosure paths. The dates on that paper come from the lender and the county. A HUD counselor can read it with you.'
  },
  {
    id: 'price-l1',
    keys: ['$4', '4 / mo', 'tax receipt', 'economy watch', 'l1', 'four dollar'],
    reply: 'Economy Watch L1 is $4 / month: Your Monthly Tax Receipt, re-cut as Treasury publishes. Helix checkout, economy rung only. It is not a foreclosure-alert feed.'
  },
  {
    id: 'desk-alerts',
    keys: ['$19', '19 / mo', 'desk alert', 'alerts', 'waitlist', 'when will you alert'],
    reply: 'Homestead Desk Alerts are planned at about $19 / month. They are not live. We will not take $19 for a feed we cannot send. Join the waitlist on this page. When the county data is honest enough to alert, we will email you first.'
  },
  {
    id: 'chris',
    keys: ['chris', 'human', 'talk to someone', 'call me', 'handoff', 'operator'],
    reply: 'Leave your email on this page and say you want Chris. That is a human handoff, not an outbound blast. We do not text or call you from this chat.'
  },
  {
    id: 'counselor',
    keys: ['counselor', 'hud', 'help paying', 'modification', 'loss mitigation'],
    reply: 'Start with a HUD-approved housing counselor (free): hud.gov/findacounselor. They can talk to servicers with you. This chat will not negotiate a loan.'
  }
];

var CRISIS = /suicid|kill myself|end my life|want to die|self[- ]harm|homeless tonight|no place to sleep|hurt myself|hurt them|violence at home|domestic violence/;

var ROLE = {
  homeowner: /homeowner|i own|my house|my home|we own|i live here|our house/,
  agent: /\bagent\b|realtor|broker|listing/,
  investor: /investor|i buy|cash buyer|wholesale|assignment/
};

var URGENCY = {
  high: /this week|tomorrow|days left|sale is|auction|notice of sale|losing (the )?(house|home)/,
  medium: /this month|nod|notice of default|default notice|behind/,
  low: /just looking|research|curious|maybe later|not urgent/
};

var EQUITY = {
  none: /no equity|underwater|upside down/,
  some: /some equity|a little equity|thin equity/,
  substantial: /lots of equity|plenty of equity|a lot of equity|substantial/
};

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function matchFaq(text) {
  var n = norm(text);
  if (!n) return null;
  for (var i = 0; i < FAQ.length; i++) {
    for (var k = 0; k < FAQ[i].keys.length; k++) {
      if (n.indexOf(FAQ[i].keys[k]) !== -1) return FAQ[i];
    }
  }
  return null;
}

function detectRole(text) {
  var n = norm(text);
  if (ROLE.investor.test(n)) return 'investor';
  if (ROLE.agent.test(n)) return 'agent';
  if (ROLE.homeowner.test(n)) return 'homeowner';
  return null;
}

function detectUrgency(text) {
  var n = norm(text);
  if (URGENCY.high.test(n)) return 'high';
  if (URGENCY.medium.test(n)) return 'medium';
  if (URGENCY.low.test(n)) return 'low';
  return null;
}

function detectEquity(text) {
  var n = norm(text);
  if (EQUITY.none.test(n)) return 'none';
  if (EQUITY.substantial.test(n)) return 'substantial';
  if (EQUITY.some.test(n)) return 'some';
  return null;
}

function isCrisis(text) {
  return CRISIS.test(norm(text));
}

function routeFor(qual) {
  qual = qual || {};
  if (qual.crisis) {
    return {
      id: 'human_crisis',
      label: 'Human handoff + hotlines',
      sku: null,
      url: null,
      why: 'Distress is a human conversation, not a checkout.'
    };
  }
  if (qual.role === 'investor' || qual.role === 'agent') {
    return {
      id: 'waitlist',
      label: 'Homestead Desk waitlist',
      sku: 'desk-alerts-waitlist',
      url: '#deskWaitlist',
      why: 'Desk Alerts are not live. Waitlist is the honest product.'
    };
  }
  if (qual.urgency === 'high') {
    return {
      id: 'human',
      label: 'Talk to Chris',
      sku: null,
      url: '#deskWaitlist',
      why: 'A sale window is a counselor + human path, not a $4 receipt.'
    };
  }
  if (qual.role === 'homeowner' && (qual.urgency === 'medium' || qual.equity)) {
    return {
      id: 'waitlist',
      label: 'Homestead Desk waitlist',
      sku: 'desk-alerts-waitlist',
      url: '#deskWaitlist',
      why: 'When alerts exist they will be about this ZIP. Until then, the list is free.'
    };
  }
  return {
    id: 'l1',
    label: 'Economy Watch · $4 / mo',
    sku: 'economy-p2',
    url: '/api/checkout?start=1&domain=economy&rung=p2',
    why: 'The live paid product today is the $4 Economy L1 receipt. Desk Alerts are waitlist only.'
  };
}

function qualify(messages) {
  var blob = (messages || []).map(function (m) { return m && m.content ? String(m.content) : ''; }).join('\n');
  var crisis = isCrisis(blob);
  var qual = {
    role: detectRole(blob),
    urgency: detectUrgency(blob),
    equity: detectEquity(blob),
    crisis: crisis,
    qualified: false
  };
  qual.qualified = !!(qual.role && (qual.urgency || qual.equity || qual.crisis));
  qual.route = routeFor(qual);
  return qual;
}

function crisisReply() {
  return {
    reply: 'If you are in immediate danger, call 911. If you are in crisis, call or text 988. For housing tonight, call 211. A HUD counselor is free: hud.gov/findacounselor. Leave your email on this page if you want Chris to follow up. This chat will not give legal advice or invent a sale date.',
    crisis: true,
    provider: 'guardrail'
  };
}

function opening() {
  return 'Homestead Desk. Educational only, not legal advice, and I will not invent an auction date.\n\nAre you a homeowner, an agent, or an investor? How soon is this (this week, this month, or just looking)?';
}

function nextQuestion(qual) {
  if (!qual.role) return 'Are you a homeowner, an agent, or an investor?';
  if (!qual.urgency) return 'How soon is this: this week, this month, or just looking?';
  if (qual.role === 'homeowner' && !qual.equity) return 'If you know it, roughly how much equity is left: none, some, or a lot? Skip if you do not know.';
  return null;
}

function replyTo(messages) {
  var last = '';
  for (var i = (messages || []).length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user') { last = String(messages[i].content || ''); break; }
  }
  if (isCrisis(last)) return Object.assign(crisisReply(), { qual: qualify(messages) });

  var qual = qualify(messages);
  if (qual.crisis) return Object.assign(crisisReply(), { qual: qual });

  var faq = matchFaq(last);
  var bits = [];
  if (faq) bits.push(faq.reply);
  var ask = nextQuestion(qual);
  if (ask && !faq) bits.push(ask);
  else if (ask && faq) bits.push(ask);
  if (!bits.length) {
    bits.push('I can explain the free Homestead Read, the $4 Economy Watch, or the $19 Desk waitlist. I will not invent dates or give legal advice.');
    if (qual.qualified) bits.push('Based on what you said, the honest next step is: ' + qual.route.label + '. ' + qual.route.why);
    else bits.push(opening());
  } else if (qual.qualified) {
    bits.push('Honest next step: ' + qual.route.label + '. ' + qual.route.why);
  }

  return {
    reply: bits.join('\n\n'),
    crisis: false,
    provider: 'faq',
    faqId: faq ? faq.id : null,
    qual: qual
  };
}

function systemPrompt() {
  return [
    'You are the on-page Homestead Desk sales agent for LIMEN Helix on limenhelix.com.',
    'Domain: Economy / Homestead only. On-page chat only. No SMS, no voice, no outbound.',
    'You are not a lawyer, not a lender, not a broker. No legal, financial, or tax advice.',
    'Never invent an auction date, filing date, or county calendar entry. If asked for a date, say to read the notice and the official county sale list.',
    'Qualify: homeowner vs agent vs investor; timeline; urgency; equity band if known.',
    'Route: $4 Economy L1 checkout /api/checkout?start=1&domain=economy&rung=p2 ; $19 Desk Alerts are WAITLIST only (not live); human handoff to Chris via the email form.',
    'Crisis or distress (suicide, violence, housing tonight): stop selling. Give 911 / 988 / 211 and HUD counselor. Ask them to leave an email for Chris.',
    'Keep replies short, calm, plain. Killswitch clarity: one free gift (Homestead Read), then an honest paid path.',
    'If you are unsure, say so. Do not fabricate listings, prices, or statutes.'
  ].join(' ');
}

module.exports = {
  FAQ: FAQ,
  matchFaq: matchFaq,
  detectRole: detectRole,
  detectUrgency: detectUrgency,
  detectEquity: detectEquity,
  isCrisis: isCrisis,
  routeFor: routeFor,
  qualify: qualify,
  replyTo: replyTo,
  opening: opening,
  systemPrompt: systemPrompt,
  crisisReply: crisisReply
};
