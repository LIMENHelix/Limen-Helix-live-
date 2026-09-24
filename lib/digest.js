/**
 * lib/digest.js — build the email a paying subscriber actually gets.
 *
 * THREE KINDS OF DIGEST, and the difference is stated to the reader rather than hidden:
 *
 *   PERSONAL   The domain's tool takes a query, so we run the subscriber's own watch value
 *              through it. "Your drug", "your bank", "your ZIP" means exactly that.
 *   DOMAIN-WIDE LIVE   The rung sells the domain-wide read, so the content is the domain's
 *              own live figures — the same endpoint the public desk renders.
 *   ARTIFACT   Fallback when the live source is down: the newest durable artifact from the
 *              domain's commercial reflex. Missing/stale inventory still inhibits paid
 *              fulfillment rather than substituting generic social copy.
 *
 * ONLY SENDS ON CHANGE. Each build returns a `key` derived from the salient figures. If it
 * matches what the subscriber last received, nothing goes out. A paid alert that arrives
 * every day saying the same thing trains people to ignore it, and the product promise is
 * "we tell you when it moves", not "we email you daily".
 */
var crypto = require('node:crypto');
var T = require('./tool-fetch');
var commercialStore = require('./autofire-efference-store');
var commercialContracts = require('./domain-commercial-contracts');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
var API = SITE + '/api/';

function enc(v) { return encodeURIComponent(String(v || '').trim().slice(0, 80)); }
function keyOf(parts) { return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16); }
function n(v) { return (v == null ? 0 : v).toLocaleString(); }
function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }

async function get(path) {
  var r = await T.getJSON(API + path, 20000);
  return (r.status === 200 && r.body && r.body.ok !== false) ? r.body : null;
}

/* Domain-wide paths return the same payload for every subscriber; one 60s memo keeps a
   digest run from calling the same endpoint N times when N subscribers share a domain. */
var WIDE_CACHE = new Map(), WIDE_CACHE_TTL_MS = 60000;
async function getWide(path) {
  var hit = WIDE_CACHE.get(path);
  if (hit && Date.now() - hit.at < WIDE_CACHE_TTL_MS) return hit.value;
  var value = await get(path);
  WIDE_CACHE.set(path, { at: Date.now(), value: value });
  return value;
}

/**
 * Per-domain personalisation. The tool endpoints need BOTH tool= and q= — calling them with
 * q= alone silently returns the domain-wide summary instead of a filtered result, which would
 * mean charging for a personal watch and delivering a generic one.
 */
var PERSONAL = {
  medicine: {
    path: function (w) { return 'medicine-tools?tool=shortages&q=' + enc(w); },
    build: function (j, w) {
      var cur = (j.rows || []).filter(function (r) { return r.status === 'Current'; });
      if (!j.found) {
        return { lines: ['No open FDA shortage record for "' + w + '" right now.'], key: keyOf(['med', w, 0]) };
      }
      var lines = [cur.length + ' current shortage record' + (cur.length === 1 ? '' : 's') + ' matching "' + w + '".'];
      cur.slice(0, 6).forEach(function (r) {
        lines.push('  - ' + r.drug + (r.company ? ' (' + r.company + ')' : '') + (r.reason ? ' — ' + r.reason : ''));
      });
      return { lines: lines, key: keyOf(['med', w, cur.length, cur.slice(0, 6).map(function (r) { return r.drug + r.status; })]) };
    }
  },
  technology: {
    path: function (w) { return 'technology-tools?tool=kev&q=' + enc(w); },
    build: function (j, w) {
      if (!j.found) return { lines: ['Nothing you run matches "' + w + '" in CISA\'s exploited catalog right now.'], key: keyOf(['tech', w, 0]) };
      var lines = [n(j.found) + ' exploited flaws match "' + w + '". ' + n(j.ransomware || 0) + ' tied to ransomware, ' + n(j.overdue || 0) + ' past the federal fix-by date.'];
      (j.rows || []).slice(0, 6).forEach(function (r) {
        lines.push('  - ' + r.cve + '  ' + (r.product || r.vendor || '') + (r.due ? '  fix by ' + r.due : ''));
      });
      return { lines: lines, key: keyOf(['tech', w, j.found, j.ransomware, j.overdue]) };
    }
  },
  intelligence: {
    path: function (w) { return 'intelligence-tools?tool=sdn&q=' + enc(w); },
    build: function (j, w) {
      if (!j.found) return { lines: ['No OFAC designation matches "' + w + '" right now.'], key: keyOf(['sdn', w, 0]) };
      var lines = [n(j.found) + ' designated entries match "' + w + '". Dealing with a designated party is prohibited for US persons.'];
      (j.rows || []).slice(0, 6).forEach(function (r) { lines.push('  - ' + (r.name || r.title || JSON.stringify(r).slice(0, 60))); });
      lines.push('This is a name search, not a compliance screen. Confirm on Treasury before acting.');
      return { lines: lines, key: keyOf(['sdn', w, j.found]) };
    }
  },
  finance: {
    path: function (w) { return 'finance-tools?tool=bank&q=' + enc(w); },
    build: function (j, w) {
      var rows = (j.rows || []).filter(function (r) { return r.active !== false; });
      if (!rows.length) return { lines: ['No active bank matches "' + w + '" in the FDIC record.'], key: keyOf(['bank', w, 0]) };
      var lines = [rows.length + ' active institution' + (rows.length === 1 ? '' : 's') + ' matching "' + w + '", from the latest quarterly Call Report.'];
      rows.slice(0, 6).forEach(function (r) {
        lines.push('  - ' + r.name + (r.city ? ', ' + r.city : '') + (r.state ? ' ' + r.state : '') + (r.className ? '  [' + r.className + ']' : ''));
      });
      return { lines: lines, key: keyOf(['bank', w, rows.map(function (r) { return r.cert; })]) };
    }
  },
  law: {
    path: function (w) { return 'law-tools?tool=comments&q=' + enc(w); },
    build: function (j, w) {
      var rows = j.rows || [];
      if (!rows.length) return { lines: ['No open comment period matches "' + w + '" right now.'], key: keyOf(['law', w, 0]) };
      var soon = rows.filter(function (r) { return r.daysLeft != null && r.daysLeft <= 7; });
      var lines = [rows.length + ' proposed rules match "' + w + '". ' + soon.length + ' close for comment within 7 days.'];
      rows.slice(0, 5).forEach(function (r) {
        lines.push('  - ' + String(r.title || '').slice(0, 110) + (r.daysLeft != null ? '  (' + r.daysLeft + ' days left)' : ''));
      });
      return { lines: lines, key: keyOf(['law', w, rows.slice(0, 5).map(function (r) { return r.title + r.closes; })]) };
    }
  },
  education: {
    path: function (w) { return 'education-tools?tool=school&q=' + enc(w); },
    build: function (j, w) {
      var rows = j.rows || [];
      if (!rows.length) return { lines: ['No school matches "' + w + '" in the federal Scorecard.'], key: keyOf(['edu', w, 0]) };
      var lines = [rows.length + ' school' + (rows.length === 1 ? '' : 's') + ' matching "' + w + '".'];
      rows.slice(0, 5).forEach(function (r) { lines.push('  - ' + (r.name || '') + (r.state ? ', ' + r.state : '')); });
      return { lines: lines, key: keyOf(['edu', w, rows.slice(0, 5).map(function (r) { return r.name; })]) };
    }
  },
  religion: {
    path: function (w) { return 'religion-tools?tool=org&q=' + enc(w); },
    build: function (j, w) {
      var rows = j.rows || [];
      if (!rows.length) return { lines: ['No Form 990 filer matches "' + w + '".'], key: keyOf(['rel', w, 0]) };
      var lines = [rows.length + ' organisation' + (rows.length === 1 ? '' : 's') + ' matching "' + w + '", from their own Form 990 filings.'];
      rows.slice(0, 5).forEach(function (r) { lines.push('  - ' + (r.name || '') + (r.state ? ', ' + r.state : '')); });
      return { lines: lines, key: keyOf(['rel', w, rows.slice(0, 5).map(function (r) { return r.name; })]) };
    }
  },
  environment: {
    path: function (w) { return 'environment-tools?tool=air&zip=' + enc(w); },
    build: function (j, w) {
      if (j.aqi == null) return null;
      var lines = ['Air quality at ' + (j.place || w) + (j.state ? ', ' + j.state : '') + ': AQI ' + j.aqi + ' (' + (j.band || '') + ').'];
      if (j.say) lines.push(j.say);
      // Band, not the raw number: AQI 58 -> 60 is not news, Moderate -> Unhealthy is.
      return { lines: lines, key: keyOf(['air', w, j.band]) };
    }
  },
  agriculture: {
    // watch = the state the subscriber farms or buys in; filter the weekly drought map to it
    path: function () { return 'agriculture-tools'; },
    build: function (j, w) {
      var rows = (j && j.drought && j.drought.rows) || [];
      var wl = w.toLowerCase();
      var row = rows.filter(function (r) {
        return String(r.name || '').toLowerCase() === wl || String(r.state || '').toLowerCase() === wl;
      })[0];
      if (!row) return null;
      var lines = [row.name + ' drought read (map dated ' + (row.validStart || 'latest') + '): ' + row.band +
        ', ' + (row.d2 || 0) + '% of the state in D2-or-worse drought.' + (row.crops ? ' Exposed crops: ' + row.crops + '.' : '')];
      if (row.changeD2) lines.push('  - D2+ area moved ' + row.changeD2 + ' points this week.');
      return { lines: lines, key: keyOf(['ag', row.state, row.band, Math.round(row.d2 || 0), Math.round(row.changeD2 || 0)]) };
    }
  },
  industry: {
    // watch = "year make model" free text ("2021 honda accord"); the recall tool is structured
    path: function (w) {
      var m = String(w).toLowerCase().match(/\b(19|20)\d{2}\b/);
      var year = m ? m[0] : '';
      var rest = String(w).toLowerCase().replace(/\b(19|20)\d{2}\b/, '').trim().split(/\s+/).filter(Boolean);
      if (!year || !rest.length) return null;
      return 'industry-tools?tool=recalls&year=' + year + '&make=' + enc(rest[0]) + '&model=' + enc(rest.slice(1).join(' '));
    },
    build: function (j, w) {
      if (!j) return null;
      var rows = j.rows || j.recalls || [];
      if (!rows.length) return { lines: ['No open NHTSA recall for "' + w + '" right now.'], key: keyOf(['veh', w, 0]) };
      var lines = [rows.length + ' open recall' + (rows.length === 1 ? '' : 's') + ' for "' + w + '", from NHTSA.'];
      rows.slice(0, 5).forEach(function (r) {
        lines.push('  - ' + String(r.component || r.title || '').slice(0, 90) + (r.parkIt ? '  PARK IT — do not drive' : ''));
      });
      return { lines: lines, key: keyOf(['veh', w, rows.length, rows.slice(0, 5).map(function (r) { return r.component || r.title; })]) };
    }
  },
  population: {
    path: function (w) { return 'population-tools?tool=mig&q=' + enc(w); },
    build: function (j, w) {
      if (!j || j.ok === false) return null;
      var r = j.row || j;
      var lines = ['County read for "' + w + '" (Census PEP + IRS migration + ACS):'];
      ['name', 'netMigration', 'gainLoss', 'inflow', 'outflow', 'movedIn', 'movedOut'].forEach(function (k) {
        if (r[k] != null && r[k] !== '') lines.push('  - ' + k + ': ' + r[k]);
      });
      if (lines.length < 2 && j.summary) lines.push(String(j.summary));
      if (lines.length < 2) lines.push(JSON.stringify(j).slice(0, 220));
      return { lines: lines, key: keyOf(['mig', w, JSON.stringify(j).length, JSON.stringify(r).slice(0, 80)]) };
    }
  },
  science: {
    path: function (w) { return 'science-tools?tool=org&q=' + enc(w); },
    build: function (j, w) {
      var rows = (j && j.rows) || [];
      if (!rows.length) return { lines: ['No NIH RePORTER match for "' + w + '" this fiscal year.'], key: keyOf(['nih', w, 0]) };
      var lines = [rows.length + ' RePORTER match' + (rows.length === 1 ? '' : 'es') + ' for "' + w + '" (FY' + (j.fiscalYear || 'current') + ').'];
      rows.slice(0, 5).forEach(function (r) {
        lines.push('  - ' + String(r.name || r.title || r.org || '').slice(0, 90) + (r.amount ? '  $' + n(r.amount) : ''));
      });
      return { lines: lines, key: keyOf(['nih', w, rows.length, rows.slice(0, 5).map(function (r) { return r.name || r.title || r.org; })]) };
    }
  },
  governance: {
    path: function (w) { return 'governance-tools?tool=entity&q=' + enc(w); },
    build: function (j, w) {
      var rows = (j && j.rows) || [];
      if (!rows.length) return { lines: ['No federal award record matches "' + w + '" right now.'], key: keyOf(['gov', w, 0]) };
      var lines = [rows.length + ' federal award record' + (rows.length === 1 ? '' : 's') + ' matching "' + w + '" (USAspending).'];
      rows.slice(0, 5).forEach(function (r) {
        lines.push('  - ' + String(r.name || r.recipient || r.title || '').slice(0, 90) + (r.amount ? '  $' + n(r.amount) : ''));
      });
      return { lines: lines, key: keyOf(['gov', w, rows.length, rows.slice(0, 5).map(function (r) { return r.name || r.recipient || r.title; })]) };
    }
  }
};

/** Domains with no per-subject query yet. Named so the email can be honest about it. */
function isPersonal(domain) { return !!PERSONAL[domain]; }

/**
 * DOMAIN-WIDE LIVE READ (2026-09-24, THE TWENTY #1 / DEFECT_LEDGER #28).
 * The catalog's domain rungs sell the domain-wide read itself ("Your Weekly Drought and
 * Input Read", "Your Award Flow") — so the content is the domain's own live data, not a
 * commercial artifact that may not exist. Each builder reads the same endpoint the public
 * desk renders. Only sends on change: keys are built from the salient figures, rounded
 * where the raw number moves more often than a reader would call news.
 */
function statsRead(tag, label) {
  return {
    path: function () { return tag + '-live'; },
    build: function (j) {
      var stats = (j && j.stats) || [];
      if (!stats.length) return null;
      var lines = [label + ' — the live domain read:'];
      stats.slice(0, 5).forEach(function (s) { lines.push('  - ' + s.k + ': ' + s.n + (s.c ? '  (' + s.c + ')' : '')); });
      if (j.wow && j.wow[0]) lines.push('', String(j.wow[0]).slice(0, 220));
      // the key carries the displayed context too: a changed explanation with an unchanged
      // headline number is still a different read
      return { lines: lines, key: keyOf([tag, stats.slice(0, 5).map(function (s) { return s.k + ':' + s.n + ':' + (s.c || ''); }),
        String(j.wow && j.wow[0] || '').slice(0, 80)]) };
    }
  };
}
function quotesRead(tag, label, names) {
  return {
    path: function () { return tag + '-markets'; },
    build: function (j) {
      var q = (j && j.quotes) || {};
      var syms = Object.keys(q);
      if (!syms.length) return null;
      var movers = syms.map(function (s) { return { s: s, c: q[s].changePct }; })
        .sort(function (a, b) { return Math.abs(b.c) - Math.abs(a.c); }).slice(0, 4);
      var lines = [label + ' — the live domain read:'];
      movers.forEach(function (m) {
        lines.push('  - ' + (names[m.s] || m.s) + '  ' + (m.c >= 0 ? '+' : '') + m.c + '%');
      });
      return { lines: lines, key: keyOf([tag, movers.map(function (m) { return m.s + ':' + Math.round(m.c); })]) };
    }
  };
}
var DOMAIN_WIDE = {
  agriculture: {
    path: function () { return 'agriculture-tools'; },
    build: function (j) {
      var rows = (j && j.drought && j.drought.rows) || [];
      if (!rows.length) return null;
      var severe = rows.filter(function (r) { return r.band === 'severe' || r.band === 'extreme' || r.band === 'exceptional'; });
      var movers = rows.slice().sort(function (a, b) { return (b.changeD2 || 0) - (a.changeD2 || 0); }).slice(0, 4);
      var lines = ['The weekly drought and input read — ' + severe.length + ' of ' + rows.length + ' farm states in severe drought or worse (map dated ' + (rows[0].validStart || 'latest') + '):'];
      movers.forEach(function (r) {
        lines.push('  - ' + r.name + '  ' + r.band + ' (' + r.crops + ')' + (r.changeD2 ? '  D2+ area moved ' + r.changeD2 + 'pts' : ''));
      });
      return { lines: lines, key: keyOf(['ag', severe.length, rows[0].validStart, movers.map(function (r) { return r.state + Math.round(r.changeD2 || 0); })]) };
    }
  },
  communication: statsRead('communication', 'FCC and the comms story'),
  defense: statsRead('defense', 'Where the defense money goes'),
  economy: statsRead('economy', 'The U.S. economy by the real numbers'),
  governance: statsRead('governance', 'Where your tax money actually goes'),
  industry: statsRead('industry', 'What just got pulled off the shelves'),
  infrastructure: statsRead('infrastructure', 'Airports, ground stops and closures'),
  science: statsRead('science', 'The sky above and the research frontier'),
  trade: statsRead('trade', 'Who the world sells to, and who it owes'),
  population: {
    path: function () { return 'population-live'; },
    build: function (j) {
      var g = (j && j.global) || {};
      if (!g.worldPop) return null;
      var lines = ['Where America and the world are moving — the live read:',
        '  - World population: ' + n(Math.round(g.worldPop)) + ' (+' + (g.worldGrowth || 0).toFixed(1) + '% this year)'];
      (g.migGainers || []).slice(0, 3).forEach(function (m) { lines.push('  - Gaining most: ' + m.country + '  +' + n(m.value)); });
      (g.migLosers || []).slice(0, 3).forEach(function (m) { lines.push('  - Losing most: ' + m.country + '  ' + n(m.value)); });
      return { lines: lines, key: keyOf(['pop', Math.round(g.worldPop / 100000), (g.migGainers || []).slice(0, 3).map(function (m) { return m.iso; })]) };
    }
  },
  culture: quotesRead('culture', 'The royalty and audience read', { SPOT: 'Spotify', 'UMG.AS': 'Universal Music', WMG: 'Warner Music', SIRI: 'SiriusXM' }),
  energy: quotesRead('energy', 'The utility and power read', { NEE: 'NextEra', SO: 'Southern Co', DUK: 'Duke Energy', CEG: 'Constellation', VST: 'Vistra' })
};

async function latestCommercialArtifact(domain, store, nowValue) {
  var contract = commercialContracts.get(domain);
  if (!contract || !store || typeof store.assertDurable !== 'function' || typeof store.get !== 'function') return null;
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  try {
    store.assertDurable();
    var pair = await Promise.all([store.get(contract.stateKey), store.get(contract.artifactStateKey)]);
    var state = pair[0];
    var artifact = pair[1];
    if (!state || state.schemaVersion !== 'domain-commercial-reflex/1.0' ||
        state.productDomain !== contract.productDomain || state.ownerDomain !== contract.ownerDomain ||
        state.readbackVerified !== true || !text(state.lastPlannedIntentId)) return null;
    if (!artifact || artifact.schemaVersion !== 'domain-commercial-artifact/1.0' ||
        artifact.status !== 'ARTIFACT_PREPARED' || artifact.productDomain !== contract.productDomain ||
        artifact.ownerDomain !== contract.ownerDomain || artifact.externalEffectAuthorized !== false ||
        artifact.intentId !== state.lastPlannedIntentId || !artifact.subject || !artifact.body || !artifact.contentHash ||
        !Number.isFinite(Number(artifact.freshnessExpiresAt)) || now >= Number(artifact.freshnessExpiresAt)) return null;
    return artifact;
  } catch (_) { return null; }
}

/**
 * Build one subscriber's digest.
 * Returns { subject, body, key } or null when there is nothing worth sending.
 */
async function buildFor(sub, options) {
  if (!sub || !sub.domain) return null;
  options = options || {};
  var getJson = options.get || get;          // test seam; production hits the live API
  var domain = sub.domain;
  var watch = sub.watch ? String(sub.watch).trim() : '';
  var link = SITE + '/' + domain;
  var head, key, personal = false, domainWide = false;

  if (PERSONAL[domain] && watch) {
    var p = PERSONAL[domain].path(watch);
    var j = p ? await getJson(p) : null;
    var built = j && PERSONAL[domain].build(j, watch);
    if (!built) {
      // The eight original personal domains keep the hard rule: a personal watch
      // sends the personal read or nothing. The five added for THE TWENTY sell a
      // domain-wide rung with a personal filter on top — if the filter can't run
      // (unparseable vehicle, unknown county), the disclosed domain-wide read is
      // still the honest product, so fall through rather than going silent.
      if (!DOMAIN_WIDE[domain]) return null;
    } else {
      head = built.lines;
      key = built.key;
      personal = true;
    }
  }
  if (!personal && DOMAIN_WIDE[domain]) {
    // The rung sells the domain-wide read, so the content is the domain's own live data.
    // The commercial artifact remains the fallback when the live source is down.
    var dwPath = DOMAIN_WIDE[domain].path();
    var dw = await (options.get ? getJson(dwPath) : getWide(dwPath));   // memoized in production runs
    var builtWide = dw && DOMAIN_WIDE[domain].build(dw);
    if (builtWide) {
      head = builtWide.lines;
      key = builtWide.key;
      domainWide = true;
    } else {
      var artifact = await latestCommercialArtifact(domain, options.store || commercialStore, options.now);
      if (!artifact) return null;
      head = [artifact.body];
      key = artifact.contentHash;
    }
  } else if (!personal) {
    // Domains outside both maps: only the newest durable artifact made by
    // this domain's own stress-to-business reflex. Missing/stale inventory
    // inhibits paid fulfillment rather than substituting generic social copy.
    var art = await latestCommercialArtifact(domain, options.store || commercialStore, options.now);
    if (!art) return null;
    head = [art.body];
    key = art.contentHash;
  }

  var body = [];
  body.push(head.join('\n'));
  body.push('');
  if (personal) {
    body.push('Watching for you: ' + watch);
  } else if (domainWide) {
    body.push('This is the domain-wide ' + domain + ' read, from the same live figures the ' +
              'public desk shows. It only emails you when the numbers move.');
    if (watch) body.push('You named "' + watch + '" at checkout; this domain has no per-subject ' +
              'filter yet, so the read above is the domain-wide one.');
  } else if (watch) {
    body.push('You asked us to watch: ' + watch);
    body.push('This domain does not have a per-subject filter yet, so the read above is the ' +
              'domain-wide one. You are not being charged for anything we are not sending: ' +
              'reply and we will refund or move you to a domain that filters.');
  }
  body.push('');
  body.push('Check any figure yourself: ' + link);
  body.push('');
  body.push('You are subscribed to ' + (sub.offer || sub.rung) + '. Reply to this email to cancel.');

  return {
    subject: (personal ? 'Your ' + domain + ' watch: ' + watch : domain.charAt(0).toUpperCase() + domain.slice(1) + ' briefing'),
    body: body.join('\n'),
    key: key,
    personal: personal
  };
}

module.exports = { buildFor: buildFor, latestCommercialArtifact: latestCommercialArtifact,
  isPersonal: isPersonal, PERSONAL_DOMAINS: Object.keys(PERSONAL), DOMAIN_WIDE_DOMAINS: Object.keys(DOMAIN_WIDE) };
