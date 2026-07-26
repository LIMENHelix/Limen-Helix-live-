/**
 * lib/digest.js — build the email a paying subscriber actually gets.
 *
 * TWO KINDS OF DIGEST, and the difference is stated to the reader rather than hidden:
 *
 *   PERSONAL   The domain's tool takes a query, so we run the subscriber's own watch value
 *              through it. "Your drug", "your bank", "your ZIP" means exactly that.
 *   DOMAIN     The domain has no per-subject query yet, so the digest is the domain-wide read
 *              and says so. Selling "Your County Watch" and quietly shipping a generic
 *              newsletter is the one thing that would make every other number untrustworthy.
 *
 * ONLY SENDS ON CHANGE. Each build returns a `key` derived from the salient figures. If it
 * matches what the subscriber last received, nothing goes out. A paid alert that arrives
 * every day saying the same thing trains people to ignore it, and the product promise is
 * "we tell you when it moves", not "we email you daily".
 */
var crypto = require('node:crypto');
var T = require('./tool-fetch');
var gen = require('./social-generator');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
var API = SITE + '/api/';

function enc(v) { return encodeURIComponent(String(v || '').trim().slice(0, 80)); }
function keyOf(parts) { return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16); }
function n(v) { return (v == null ? 0 : v).toLocaleString(); }

async function get(path) {
  var r = await T.getJSON(API + path, 20000);
  return (r.status === 200 && r.body && r.body.ok !== false) ? r.body : null;
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
  }
};

/** Domains with no per-subject query yet. Named so the email can be honest about it. */
function isPersonal(domain) { return !!PERSONAL[domain]; }

/**
 * Build one subscriber's digest.
 * Returns { subject, body, key } or null when there is nothing worth sending.
 */
async function buildFor(sub) {
  if (!sub || !sub.domain) return null;
  var domain = sub.domain;
  var watch = sub.watch ? String(sub.watch).trim() : '';
  var link = SITE + '/' + domain;
  var head, key, personal = false;

  if (PERSONAL[domain] && watch) {
    var j = await get(PERSONAL[domain].path(watch));
    if (!j) return null;                       // source down: send nothing rather than a guess
    var built = PERSONAL[domain].build(j, watch);
    if (!built) return null;
    head = built.lines;
    key = built.key;
    personal = true;
  } else {
    // No per-subject query for this domain yet. Use the verified domain headline and say
    // plainly that it is the domain-wide read.
    var post = await gen.generate({ domain: domain });
    if (!post || post.ok === false || !post.text) return null;
    head = [String(post.text).split('\n\n').slice(0, 2).join('\n')];
    key = keyOf(['dom', domain, head.join('|')]);
  }

  var body = [];
  body.push(head.join('\n'));
  body.push('');
  if (personal) {
    body.push('Watching for you: ' + watch);
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

module.exports = { buildFor: buildFor, isPersonal: isPersonal, PERSONAL_DOMAINS: Object.keys(PERSONAL) };
