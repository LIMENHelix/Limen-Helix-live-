/**
 * api/gazette — one newspaper edition per domain, as JSON.
 *
 * GET /api/gazette            -> the index: 20 editions and their slugs
 * GET /api/gazette?d=energy   -> the Energy edition
 *
 * Consumed at runtime by The LIMEN Helix Gazette (limenhelix.news), which
 * fetches one of these and rewrites itself from it. Contract lives in that
 * repo's EDITION.md. Nothing is rebuilt or deployed to change an edition:
 * this endpoint is read fresh by the reader's browser.
 *
 * NOTHING HERE IS COMPOSED. Every line an edition prints is a headline a
 * feed carried or a number a named source reported, and it is printed with
 * that source attached. The prose in `copy` is counting and attribution -
 * how many feeds answered, which ones, what they said, what failed - and
 * it is assembled from the snapshot, never written about it. There are no
 * fables, no invented byline and no interpretation dressed as reporting;
 * editions set factual:true, which tells the paper to drop its own written
 * miscellany and its three-tongues grid.
 *
 * The one LIMEN-derived figure, finalStress, is labelled in the text as
 * LIMEN's own composite and interpretive. It is never called validated.
 *
 * Deterministic and free. One upstream fetch, no paid AI, nothing on a
 * regulation cycle.
 */
'use strict';

var FLEET = require('../lib/operator-fleet');

var SNAP_TTL = 240000;            // 4 min; the snapshot itself is ~25s edge-cached
var _snap = null, _snapAt = 0;

async function snapshot() {
  if (_snap && (Date.now() - _snapAt) < SNAP_TTL) return _snap;
  var origin = 'https://' + (process.env.SELF_ORIGIN || 'limenhelix.com');
  var r = await fetch(origin + '/api/domain-snapshot');
  var j = await r.json();
  _snap = (j && j.domains) ? j : null;
  _snapAt = Date.now();
  return _snap;
}

function slugOf(d) { return d.id; }

/* "Renewable Capacity (IRENA)" -> keeps its own name; that is the attribution */
function feedName(s) { return String(s.name || 'feed').trim(); }

/* Headlines arrive as "Some headline - Outlet". Left as they came: trimming
   the outlet off would remove the attribution, which is the whole point. */
function cleanHeadline(h) {
  return String(h || '').replace(/\s+/g, ' ').trim();
}

function whenFrom(s) {
  if (s.sourceUpdatedAt) return String(s.sourceUpdatedAt);
  if (s.updated) {
    try { return new Date(s.updated).toISOString().slice(0, 10); } catch (e) {}
  }
  return null;
}

function listPhrase(a) {
  if (!a.length) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

function buildEdition(dom, snap, nowISO) {
  var sd = (snap.domains || {})[dom.runtimeKey] || (snap.domains || {})[dom.id] || null;
  var sources = (sd && Array.isArray(sd.sources)) ? sd.sources : [];

  var figures = sources.filter(function (s) {
    return s.live && s.classification === 'real' && s.value !== null && s.value !== undefined;
  });
  var feeds = sources.filter(function (s) {
    return s.live && Array.isArray(s.headlines) && s.headlines.length;
  });
  var broken = sources.filter(function (s) { return s.classification === 'broken'; });

  /* every headline, with the feed that carried it */
  var items = [];
  feeds.forEach(function (s) {
    s.headlines.forEach(function (h) {
      var t = cleanHeadline(h);
      if (t.length > 12) items.push({ src: feedName(s), txt: t });
    });
  });

  /* de-duplicate: the same story reaches more than one feed */
  var seen = {}, wire = [];
  for (var i = 0; i < items.length; i++) {
    var k = items[i].txt.toLowerCase().slice(0, 90);
    if (seen[k]) continue;
    seen[k] = 1;
    wire.push(items[i]);
  }

  var day = nowISO.slice(0, 10);
  var headlineTotal = wire.length;
  var copy = {};

  /* --- the standfirst and the opening: counting, not describing --- */
  copy.stand = dom.label + ' edition ' + String.fromCharCode(183) + ' ' + day +
    ' ' + String.fromCharCode(183) + ' ' + sources.length + ' feeds read ' +
    String.fromCharCode(183) + ' compiled, not written';

  copy.dek = 'This is the ' + dom.label + ' desk of LIMEN Helix, set as a paper. ' +
    sources.length + ' feeds were read for it on ' + day + '. ' + feeds.length +
    ' carried headlines and ' + figures.length + ' carried figures. Every line ' +
    'below names the feed that reported it, and nothing on this page was ' +
    'composed here.';

  copy.sub = 'Compiled from ' + sources.length + ' public feeds. ' + dom.label +
    ', read on ' + day + '.';

  /* --- the figures, each with its source and the date that source last moved --- */
  if (figures.length) {
    var lines = figures.slice(0, 6).map(function (s) {
      var w = whenFrom(s);
      return (s.signal || s.label) + ' (' + feedName(s) + (w ? ', as of ' + w : '') + ')';
    });
    copy.body1 = 'What the numbers say: ' + listPhrase(lines) + '.';
  } else {
    copy.body1 = 'No feed reported a figure for ' + dom.label + ' on this run. ' +
      'The reporting below is headline traffic only, which is a real reading of ' +
      'attention and not a reading of the thing itself.';
  }

  /* --- the feeds, named --- */
  if (feeds.length) {
    var byVolume = feeds.slice().sort(function (a, b) {
      return b.headlines.length - a.headlines.length;
    });
    copy.body2 = headlineTotal + ' distinct headlines came in across ' + feeds.length +
      ' feeds, the heaviest being ' +
      listPhrase(byVolume.slice(0, 3).map(function (s) {
        return feedName(s) + ' (' + s.headlines.length + ')';
      })) + '. Volume is a measure of coverage, not of importance.';
  }

  /* --- what failed. A paper that hides its gaps is worth less than one that prints them --- */
  if (broken.length) {
    copy.body3 = broken.length + ' ' + (broken.length === 1 ? 'feed' : 'feeds') +
      ' did not answer this run: ' +
      listPhrase(broken.slice(0, 4).map(function (s) {
        return feedName(s) + ' (' + (s.failReason || s.label || 'no reason given') + ')';
      })) + '. ' + (broken.length === 1 ? 'It is' : 'They are') +
      ' listed because a missing source changes what the rest is worth.';
  } else {
    copy.body3 = 'Every feed answered on this run.';
  }

  /* --- LIMEN's own reading, labelled as its own and as interpretive --- */
  if (sd && typeof sd.finalStress === 'number') {
    copy.madder = 'LIMEN Helix reads ' + dom.label + ' at ' +
      Math.round(sd.finalStress * 100) + ' on its own composite stress scale. ' +
      'That number is interpretive: it is this system\'s reading of the feeds ' +
      'above, not a measurement anyone else publishes and not a validated result.';
  }

  /* --- the now-list: the most recently updated sources --- */
  var recent = sources.filter(function (s) { return s.live && s.updated; })
    .sort(function (a, b) { return b.updated - a.updated; }).slice(0, 4);
  recent.forEach(function (s, i) {
    var w = whenFrom(s);
    copy['now' + (i + 1)] = feedName(s) + ': ' + (s.signal || s.label) +
      (w ? ' (as of ' + w + ')' : '');
  });

  /* A domain can be all numbers and no headlines - Economy and Finance read
     that way most days - and an empty register would leave the authored
     paisley headlines standing under a real masthead. So where there are no
     headlines the figures become the reporting; they are just as sourced. */
  if (!wire.length && figures.length) {
    wire = figures.map(function (s) {
      var w = whenFrom(s);
      return { src: feedName(s), txt: (s.signal || s.label) + (w ? ' (as of ' + w + ')' : '') };
    });
  }

  /* --- the register: the lead headlines, each keeping its outlet --- */
  var register = wire.slice(0, 5).map(function (it) {
    return { title: it.txt, meta: it.src };
  });
  for (var ri = 0; ri < register.length && ri < 5; ri++) {
    copy['reg' + (ri + 1)] = 'Carried by ' + register[ri].meta + '.';
  }

  /* the lead story: its own headline, and the opening is the reading */
  if (wire.length) {
    copy.head = wire[0].txt;
    copy.opener = 'The lead above was carried by ' + wire[0].src + ' on ' + day +
      ', one of ' + sources.length + ' feeds read for this edition. What follows ' +
      'is what the rest of them reported, each line kept with the feed that ' +
      'reported it.';
  }

  /* --- the remaining authored slots, so no paisley survives under a real
         masthead. Each is counting and attribution, same as the rest. --- */
  copy.cap = dom.label + ', ' + sources.length + ' feeds, ' + day + '.';

  copy.boteh = feeds.length
    ? 'The feeds behind this edition are ' +
      listPhrase(feeds.slice(0, 6).map(feedName)) +
      (feeds.length > 6 ? ' and ' + (feeds.length - 6) + ' more' : '') +
      '. They are public, and they are named here so any line on this page ' +
      'can be taken back to the thing that reported it.'
    : 'The sources behind this edition are ' +
      listPhrase(figures.slice(0, 6).map(feedName)) +
      '. They are public, and they are named here so any line on this page ' +
      'can be taken back to the thing that reported it.';

  /* the pull quote is a real headline, credited to whatever carried it */
  if (wire.length) {
    var lead = wire[0];
    var cut = lead.txt.lastIndexOf(' - ');
    var outlet = cut > 20 ? lead.txt.slice(cut + 3).trim() : null;
    copy.pull = String.fromCharCode(8220) +
      (cut > 20 ? lead.txt.slice(0, cut).trim() : lead.txt) +
      String.fromCharCode(8221);
    copy.cite = String.fromCharCode(8212) + ' ' + (outlet || lead.src) +
      ', carried by ' + lead.src;
  }

  copy.fn1 = 'Feeds read for this edition: ' +
    listPhrase(sources.slice(0, 10).map(feedName)) +
    (sources.length > 10 ? ' and ' + (sources.length - 10) + ' more' : '') + '.';

  copy.fn2 = 'Figures carry the date their own source last updated, which is ' +
    'often older than this page. Headline counts are counts of articles ' +
    'matched by a feed, not of distinct events.';

  return {
    edition: 'LIMEN Helix - ' + dom.label + ' NEWS',
    slug: slugOf(dom),
    byline: 'Compiled from ' + sources.length + ' public feeds',
    factual: true,
    generated: nowISO,
    sourceCount: sources.length,
    headlineCount: headlineTotal,
    figureCount: figures.length,
    brokenCount: broken.length,
    interpretive: true,
    validated: false,
    copy: copy,
    register: register,
    wire: wire.slice(0, 60)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  /* editions are read by browsers on another origin; let the edge hold one
     for a minute so a burst of readers is one upstream read, not many */
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');

  try {
    var url = req.url || '';
    var m = /[?&]d=([a-zA-Z0-9-]{1,32})/.exec(url);
    var nowISO = new Date().toISOString();

    if (!m) {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        publication: 'The LIMEN Helix Gazette',
        generated: nowISO,
        editions: FLEET.DOMAINS.map(function (d) {
          return {
            slug: slugOf(d),
            edition: 'LIMEN Helix - ' + d.label + ' NEWS',
            url: '/api/gazette?d=' + slugOf(d)
          };
        })
      }));
    }

    var want = m[1].toLowerCase();
    var dom = null;
    for (var i = 0; i < FLEET.DOMAINS.length; i++) {
      if (FLEET.DOMAINS[i].id === want) { dom = FLEET.DOMAINS[i]; break; }
    }
    if (!dom) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'no such edition: ' + want }));
    }

    var snap = await snapshot();
    if (!snap) {
      /* No snapshot means no reporting. Say so and print nothing rather than
         serving an edition with authored filler in it. */
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'snapshot unavailable' }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify(buildEdition(dom, snap, nowISO)));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
  }
};
