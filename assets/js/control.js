/**
 * assets/js/control.js — /control. The operator's board.
 *
 * WHY THE SWITCHES ARE HERE AND NOT IN THE FLEET
 * Every operator mandate in lib/operator-fleet.js ends "I never spend, send, or
 * act on my own", and Kai's ends "I open a human gate; I never walk through it."
 * These levers ARE that gate. Nothing on this page is a metaphor: the twenty
 * operators are forbidden from throwing them, which is exactly why they sit on a
 * screen only the operator can reach.
 *
 * SIX LEVERS, NOT NINE
 * Nine capabilities are wired and working. Only SIX of them are a piece of state
 * a human can flip:
 *
 *   AI spend        a runtime pause in Redis          (lib/ai-kill-switch)
 *   Social posting  a runtime pause in Redis          (lib/social-post)
 *   5 valves        autopilot, automail,              (lib/heartbeat.setValve)
 *                   subscriber-digest, social-cron,
 *                   finance-paper-cycle
 *
 * Email, Bluesky and lead capture are CAPABILITIES, not toggles — they have no
 * on/off of their own, they are exercised by the jobs above. Drawing them as
 * levers would put three dead handles on a live board, which is the one thing
 * this page must never do. They appear as readiness rows naming the lever that
 * actually governs them.
 *
 * EVERY LEVER SHOWS SERVER STATE, NEVER A DEFAULT
 * A switch renders from /api/harness. Before that lands it is DISABLED and reads
 * "reading…". It never sits in a cosmetic ON position while the real state is
 * unknown. A throw is optimistic for one frame, then reconciled against the
 * server's answer; if the write failed the lever springs back and the log says so.
 *
 * THE AI LEVER CANNOT REACH PAST THE ENVIRONMENT
 * LIMEN_AI_ENABLED is an env var and no request can change it. This lever flips
 * the Redis pause only. When the env boundary is closed the lever says so
 * instead of implying the operator can open it from here.
 */
(function () {
  'use strict';

  var KEY_STORE = 'limen.harness.key';
  var POLL_MS = 15000;

  var key = '', board = null, caps = null, roster = [], busy = {}, kai = null;
  var log = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ago(ms) {
    if (ms == null) return 'never';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 90) return s + 's ago';
    if (s < 5400) return Math.round(s / 60) + 'm ago';
    if (s < 172800) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }
  function clock() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0') + ':' +
           String(d.getSeconds()).padStart(2, '0');
  }

  /**
   * The six levers. `read` pulls current state off the board; `write` returns the
   * query string that changes it. A lever with no board yet reads null, which
   * renders disabled rather than off.
   */
  var LEVERS = [
    { id: 'ai', nm: 'AI spend', sub: 'Paid model calls. Runtime pause, instant, no redeploy.',
      read: function (b) { return b.ai ? !b.ai.runtimePaused : null; },
      write: function (on) { return 'ai=' + (on ? 'resume' : 'pause'); },
      blocked: function (b) {
        return (b.ai && !b.ai.envEnabled)
          ? 'LIMEN_AI_ENABLED is not 1 in this environment. This lever pauses and resumes the ' +
            'runtime hold only; it cannot open spend past the environment boundary.'
          : null;
      } },
    { id: 'social', nm: 'Social posting', sub: 'Outward posts. Runtime pause.',
      read: function (b) { return b.social ? !b.social.paused : null; },
      write: function (on) { return 'social=' + (on ? 'resume' : 'pause'); } },
    { id: 'autopilot', valve: 'autopilot', nm: 'Autopilot', sub: 'Valve · 7,37 * * * *' },
    { id: 'automail', valve: 'automail', nm: 'Auto-mail', sub: 'Valve · 45 11 * * *' },
    { id: 'digest', valve: 'subscriber-digest', nm: 'Subscriber digest', sub: 'Valve · 30 13 * * *' },
    { id: 'socialcron', valve: 'social-cron', nm: 'Social cron', sub: 'Valve · 8× a day' },
    { id: 'financepaper', valve: 'finance-paper-cycle', nm: 'Finance paper cycle', sub: 'Valve · Tradier sandbox only · 16,46 * * * *' }
  ];

  // Wired and working, but not a toggle. Each names the lever that governs it, so
  // the board never implies a control that does not exist.
  var CAPS_SHOWN = [
    { id: 'email', nm: 'Send email', via: 'lib/crm-send.js → Resend',
      governedBy: 'Subscriber digest · lead capture · CRM send', need: ['email'] },
    // NOT email. Physical letters, and dormant until armed from /admin-homestead.
    { id: 'lob', nm: 'Post physical mail', via: 'handlers/homestead-automail.js → api.lob.com/v1/letters',
      governedBy: 'Auto-mail — an ARM switch, off by default', need: [] },
    { id: 'bluesky', nm: 'Post to Bluesky', via: 'lib/social-post.js → bsky.social',
      governedBy: 'Social posting · Social cron', need: ['bluesky'] },
    { id: 'leads', nm: 'Capture leads', via: 'handlers/lead.js → limen:leadgen:*',
      governedBy: 'always on — inbound', need: [] }
  ];

  /**
   * Genuinely no code path. Physical mail was on this list and should not have
   * been: handlers/homestead-automail.js POSTs to api.lob.com/v1/letters. I read
   * lib/print-pipeline.js, found no transmit, and stopped instead of grepping for
   * a carrier. The bar for this list is a repo-wide search that finds nothing.
   */
  var UNBUILT = [
    { nm: 'Render a video', why: 'The Gazette pipeline drives Chrome on your machine. No server endpoint renders one.' },
    { nm: 'Send a text', why: 'No SMS provider anywhere in the repo. Autonomous texting is the highest-liability channel; it needs consent tracking before a line of it is written.' },
    { nm: 'Place a call', why: 'No telephony anywhere in the repo. First-strike calling is the operator, by design.' }
  ];

  /**
   * THE DESKS — every venture this deployment actually runs.
   *
   * The board above holds the six controls. This is the rest of the estate: 175
   * routes and 19 scheduled jobs, grouped by the thing they are FOR rather than
   * by handler name. Each desk names the jobs behind it, so its "last run" is
   * read off the same ledger as the levers — observed, never inferred from a
   * schedule.
   *
   * `jobs` are declared job names from lib/harness-map.js. `page` is a surface
   * that exists in this repo. Nothing here is aspirational: a desk with no job
   * says so rather than implying a cadence it does not have.
   */
  var DESKS = [
    { id: 'homestead', nm: 'Homestead', does: 'Real-estate deal desk — auction ingest, per-deal CRM state, revenue tracking.',
      jobs: ['realauction', 'automail'], page: '/admin-homestead.html',
      routes: 'homestead · homestead-status · homestead-validation · homestead-automail' },
    { id: 'companies', nm: 'Companies', does: '796 company portals — scored, enriched, and re-ranked weekly.',
      jobs: ['rescore-portals'], page: '/flow',
      routes: 'fetch-portal · enrich-portal-claude (paid) · expand-artifact' },
    { id: 'sales', nm: 'Sales & CRM', does: 'Lead capture, pipeline, appointments, subscriber billing.',
      jobs: ['autopilot', 'subscriber-digest'], page: '/sales.html',
      routes: 'lead · leadgen · crm · sales · subscribers · checkout · stripe-webhook' },
    { id: 'opportunity', nm: 'Opportunity', does: 'Where the next deal comes from — radar, RFPs, deal and capital engines.',
      jobs: ['warn', 'edgar'], page: '/admin-deals.html',
      routes: 'wave-radar · civil-radar · civil-rfps · deal-engine · capital-engine · ventures · skip-trace' },
    { id: 'distress', nm: 'Distress desks', does: 'Finance, energy and industry distress scoring — the validated Thing 1 path.',
      jobs: ['energy-distress'], page: '/admin-finance.html',
      routes: 'finance-distress · energy-distress · industry-status (+ ingest and status each)' },
    { id: 'relay', nm: 'Relay', does: 'Margin and checkout for the relay lane. Lives here, not elsewhere.',
      jobs: [], page: '/relay-margin',
      routes: 'relay-margin · relay-checkout' },
    { id: 'medicine', nm: 'Medicine', does: 'The medical front — clinical surface, treatment discovery, and 140+ medicine portals.',
      jobs: [], page: '/treatment-discovery',
      routes: 'medicine-live · medicine-markets · medicine-tools · fetch-doc' },
    { id: 'fitness', nm: 'Fitness', does: 'Programming, evidence and the program feed.',
      jobs: [], page: '/fitness.html',
      routes: 'fitness-program · fitness-program-feed · fitness-evidence' },
    { id: 'paper', nm: 'Paper trading', does: 'Simulated positions and orders. No money moves.',
      jobs: [], page: null,
      routes: 'paper-trade · paper-orders · paper-positions' },
    { id: 'publish', nm: 'Publishing', does: 'The Gazette, hero images, music, and print-from-pattern.',
      jobs: ['hero-image', 'social-cron'], page: '/admin-social.html',
      routes: 'gazette · hero-image · music-coach (paid) · music-feed · print-from-pattern' },
    { id: 'health', nm: 'System health', does: 'The immune pulse that audits 14 organs and applies bounded heals.',
      jobs: ['immune-system'], page: '/vitals', routes: 'limen-health · audit-ledger · redis-diag' }
  ];

  /**
   * ELSEWHERE — real properties this board CANNOT reach.
   *
   * Separate deployments with their own credentials, so nothing here can read or
   * change them. They get no switch — that would be the theatre this page exists
   * to avoid — but they are listed, because "not on the board" must never read
   * as "does not exist".
   *
   * THIS LIST STARTED WRONG AND WAS CUT DOWN. Relay and Tension were both on it,
   * both from stale notes, and both are in LIMEN Helix: Relay as relay-margin
   * and relay-checkout with its own page, Tension on the medical front. Only put
   * something here when the repo shows no trace of it, which is a check anyone
   * can run — not a recollection.
   */
  var ELSEWHERE = [
    { nm: 'killswitch.domains', why: 'Separate Vercel project. Deploys by CLI over the whole tree — a git push here does not touch it. No handler, page or route for it exists in this repo.' }
  ];

  // ── boot ──────────────────────────────────────────────────────────────────
  function init() {
    wireGate();
    var stored = '';
    try { stored = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {}
    if (stored) {
      key = stored;
      start(function (ok, msg) {
        if (ok) return;
        try { sessionStorage.removeItem(KEY_STORE); } catch (e) {}
        key = ''; gate(true);
        $('ge').textContent = msg || 'stored key no longer works';
      });
    } else gate(true);
  }
  function gate(show) { $('gate').classList.toggle('hide', !show); }

  function wireGate() {
    var go = function () {
      var v = ($('gk').value || '').trim();
      if (!v) return;
      key = v; $('ge').textContent = 'checking…';
      start(function (ok, msg) {
        if (ok) { try { sessionStorage.setItem(KEY_STORE, key); } catch (e) {} }
        else $('ge').textContent = msg || 'rejected';
      });
    };
    $('gb').addEventListener('click', go);
    $('gk').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function jget(u) {
    return fetch(u, { cache: 'no-store' }).then(function (r) {
      return r.json().then(function (j) { return { s: r.status, j: j }; });
    }).catch(function (e) { return { s: 0, j: { ok: false, error: 'network: ' + e.message } }; });
  }

  function start(cb) {
    jget('/api/harness?key=' + encodeURIComponent(key) + '&limit=40').then(function (r) {
      if (!r.j || !r.j.ok) { if (cb) cb(false, (r.j && r.j.error) || ('http ' + r.s)); return; }
      board = r.j;
      gate(false); document.body.classList.add('opened');
      add('board read · ' + (board.coverage ? board.coverage.observed + '/' + board.coverage.declared + ' jobs observed' : ''), 'g');
      loadCaps();
      loadRoster();
      render();
      setInterval(poll, POLL_MS);
      if (cb) cb(true);
    });
  }

  function poll() {
    jget('/api/harness?key=' + encodeURIComponent(key) + '&limit=40').then(function (r) {
      if (r.j && r.j.ok) { board = r.j; render(); }
    });
  }

  function loadCaps() {
    jget('/api/harness?key=' + encodeURIComponent(key) + '&caps=1').then(function (r) {
      if (r.j && r.j.ok) { caps = r.j.capabilities; render(); }
    });
  }

  /**
   * The floor, from /api/fleet — which returns far more than names. Each operator
   * carries a POSTURE, bounded to abstain | monitor | recommend | open-human-gate.
   *
   * That last one is the whole reason this page and that endpoint belong together:
   * an operator at open-human-gate is asking for the human, and the levers above
   * are the gate. Those stations are pulled to the front and marked, because an
   * operator waiting on you is the single most actionable thing on the screen.
   *
   * No key is sent: /api/fleet is public and free, no paid AI on this path.
   * If it does not answer, the floor stays empty rather than inventing names.
   */
  function loadRoster() {
    jget('/api/fleet').then(function (r) {
      // Kai's own read comes back on the same call. He speaks ONE system
      // decision — posture, bounded action, and which domain currently has the
      // floor — and that belongs above the levers, because it is the thing the
      // levers are an answer to.
      if (r.j && r.j.master) kai = { master: r.j.master, system: r.j.system || null, ranAt: r.j.ranAt || null };
      var list = r.j && r.j.operators;
      if (!Array.isArray(list) || !list.length) return;
      roster = list.map(function (o) {
        return {
          n: o.name || '?', d: o.domain || '',
          posture: o.posture || null,
          live: !!o.hasLiveSignal,
          vetoed: !!o.vetoed,
          situation: o.situation || o.rationale || ''
        };
      }).sort(function (a, b) {
        var R = { 'open-human-gate': 0, recommend: 1, monitor: 2, abstain: 3 };
        return (R[a.posture] == null ? 4 : R[a.posture]) - (R[b.posture] == null ? 4 : R[b.posture]) ||
               a.n.localeCompare(b.n);
      });
      render();
    });
  }

  // ── state ─────────────────────────────────────────────────────────────────
  function valveOf(name) {
    if (!board) return null;
    var j = null;
    (board.jobs || []).forEach(function (x) { if (x.job === name) j = x; });
    if (!j) return null;
    return { on: !(j.valve && j.valve.open === false), job: j };
  }

  function leverState(L) {
    if (!board) return { on: null, note: 'reading…' };
    if (L.valve) {
      var v = valveOf(L.valve);
      if (!v) return { on: null, note: 'job not declared' };
      var o = v.job.observed || {};
      return {
        on: v.on,
        note: o.neverObserved ? 'never run' :
              (o.ok === false ? 'last run FAILED ' + ago(o.at) : 'last run ' + ago(o.at))
      };
    }
    var on = L.read(board);
    var blocked = L.blocked ? L.blocked(board) : null;
    return { on: on, note: blocked ? 'environment boundary' : (on ? 'running' : 'held'), blocked: blocked };
  }

  // ── render ────────────────────────────────────────────────────────────────
  function render() {
    renderKai();
    renderLevers();
    renderCaps();
    renderDesks();
    renderFloor();
    renderLog();
    if (board && board.coverage) {
      $('cov').textContent = board.coverage.observed + ' of ' + board.coverage.declared +
        ' jobs observed' + (board.coverage.neverObserved ? ' · ' + board.coverage.neverObserved + ' never ran' : '');
    }
  }

  /**
   * Kai, above the board.
   *
   * He is the orchestrator: he runs the salience competition and speaks one
   * system decision. His mandate ends "I open a human gate; I never walk through
   * it" — so his line sits directly above the levers, which are that gate. That
   * adjacency is the argument the page is making, and without it the board is
   * just a row of switches.
   *
   * Unmeasured until /api/fleet answers. It says so rather than showing a calm
   * default, same rule as every other reading here.
   */
  var POSTURE_SAY = {
    hold: 'holding', monitor: 'watching', act: 'ready to act',
    escalate: 'escalating', abstain: 'abstaining'
  };
  function renderKai() {
    var host = $('kai');
    if (!host) return;
    if (!kai) {
      host.innerHTML = '<div class="badge">KAI</div><div class="said">' +
        '<div class="n">Orchestrator</div>' +
        '<div class="m">reading the fleet…</div></div>';
      return;
    }
    var s = kai.system || {};
    var say;
    if (!s.ready) {
      say = 'No live signal to compete on yet. <em>' + esc(kai.master.mandate) + '</em>';
    } else {
      var focus = s.focus && s.focus.domain ? s.focus.domain : null;
      say = 'System posture <b>' + esc(POSTURE_SAY[s.posture] || s.posture || '—') + '</b>' +
            (s.boundedAction ? ' · bounded to <b>' + esc(s.boundedAction) + '</b>' : '') +
            (focus ? ' · the floor is with <b>' + esc(focus) + '</b>' : '') +
            (typeof s.systemStress === 'number' ? ' · system stress ' + s.systemStress.toFixed(2) : '') +
            '<em> — I open a human gate; I never walk through it.</em>';
    }
    host.innerHTML =
      '<div class="badge">KAI</div>' +
      '<div class="said"><div class="n">Orchestrator · speaks one system decision</div>' +
      '<div class="m">' + say + '</div></div>';
  }

  function renderLevers() {
    var host = $('board');
    host.innerHTML = '';
    LEVERS.forEach(function (L) {
      var st = leverState(L);
      var d = document.createElement('div');
      d.className = 'sw' + (st.on === true ? ' on' : '') + (st.on === null ? ' pending' : '') +
                    (busy[L.id] ? ' busy' : '');
      d.innerHTML =
        '<button class="lever" ' + (st.on === null || busy[L.id] ? 'disabled ' : '') +
          'aria-pressed="' + (st.on === true ? 'true' : 'false') + '" aria-label="' + esc(L.nm) + '">' +
          '<span class="lbl i">ON</span><span class="knob"></span><span class="lbl o">OFF</span>' +
        '</button>' +
        '<div class="meta">' +
          '<div class="nm">' + esc(L.nm) + '</div>' +
          '<div class="ds">' + esc(L.sub) + '</div>' +
          '<div class="stt' + (st.blocked ? ' warn' : '') + '">' + esc(st.note) + '</div>' +
          (st.blocked ? '<div class="blocked">' + esc(st.blocked) + '</div>' : '') +
        '</div>';
      var lever = d.querySelector('.lever');
      lever.addEventListener('click', function () { throwLever(L, st); });
      host.appendChild(d);
    });
  }

  /**
   * Capabilities render as the SAME tile as a lever, minus the handle.
   *
   * The mock-up had twelve levers and read like a control room; the built page
   * split them into a short board plus two lists and read like a report. But
   * three of those twelve cannot be switched and three more do not exist, so
   * putting handles back would be the lie this page exists to avoid.
   *
   * So the tile shape is shared and only the CONTROL differs: a lever where
   * something flips, a state chip where nothing does. Same density, same
   * scanning, no handle that goes nowhere.
   */
  function renderCaps() {
    var host = $('caps');
    host.innerHTML = '';
    CAPS_SHOWN.forEach(function (c) {
      var state = 'unknown', why = 'reading…';
      if (caps) {
        if (!c.need.length) { state = 'wired'; why = 'no configuration needed'; }
        else {
          var mine = caps.filter(function (x) { return c.need.indexOf(x.id) !== -1; });
          var bad = mine.filter(function (x) { return x.state !== 'wired'; });
          state = bad.length ? 'needsEnv' : 'wired';
          why = bad.length
            ? ('not visible in this environment: ' + bad.map(function (x) { return x.missing.join(', '); }).join(' · '))
            : 'configured in this environment';
        }
      }
      var d = document.createElement('div');
      d.className = 'sw cap-tile s-' + state;
      d.innerHTML =
        '<div class="chip ' + state + '">' +
          (state === 'wired' ? 'ON' : state === 'needsEnv' ? 'ENV' : '—') +
          '<span>no switch</span></div>' +
        '<div class="meta"><div class="nm">' + esc(c.nm) + '</div>' +
        '<div class="ds">' + esc(c.via) + '</div>' +
        '<div class="stt">governed by ' + esc(c.governedBy) + '</div>' +
        '<div class="why">' + esc(why) + '</div></div>';
      host.appendChild(d);
    });

    var u = $('unbuilt');
    u.innerHTML = UNBUILT.map(function (x) {
      return '<div class="sw cap-tile s-none"><div class="chip none">—<span>not built</span></div>' +
        '<div class="meta"><div class="nm">' + esc(x.nm) + '</div>' +
        '<div class="why">' + esc(x.why) + '</div></div></div>';
    }).join('');
  }

  /**
   * A desk's state is the WORST state among its jobs, because a desk with one
   * dead job is not a healthy desk. A desk with no job at all is "on demand" —
   * it runs when something calls it — which is a real answer, not a failure.
   */
  function deskState(d) {
    if (!d.jobs.length) return { s: 'ondemand', note: 'on demand — no schedule' };
    if (!board) return { s: 'unknown', note: 'reading…' };
    var worst = null, notes = [];
    d.jobs.forEach(function (name) {
      var j = null;
      (board.jobs || []).forEach(function (x) { if (x.job === name) j = x; });
      if (!j) { notes.push(name + ': not declared'); rank('unknown'); return; }
      var o = j.observed || {};
      var s = o.neverObserved ? 'none' : (o.ok === false ? 'bad' : (o.overdue ? 'warn' : 'ok'));
      notes.push(name + ': ' + (o.neverObserved ? 'never run' :
        (o.ok === false ? 'FAILED ' + ago(o.at) : ago(o.at))));
      rank(s);
    });
    function rank(s) {
      var R = { bad: 0, none: 1, warn: 2, unknown: 3, ok: 4 };
      if (worst === null || R[s] < R[worst]) worst = s;
    }
    return { s: worst || 'unknown', note: notes.join(' · ') };
  }

  function renderDesks() {
    var host = $('desks');
    if (!host) return;
    host.innerHTML = DESKS.map(function (d) {
      var st = deskState(d);
      return '<div class="desk s-' + st.s + '">' +
        '<div class="dhead"><span class="dnm">' + esc(d.nm) + '</span>' +
        '<span class="dst">' + esc(st.s === 'ondemand' ? 'on demand' :
          (st.s === 'ok' ? 'running' : st.s === 'bad' ? 'failing' :
           st.s === 'none' ? 'never run' : st.s === 'warn' ? 'overdue' : 'reading…')) + '</span></div>' +
        '<div class="ddoes">' + esc(d.does) + '</div>' +
        '<div class="djobs">' + esc(st.note) + '</div>' +
        '<div class="droutes">' + esc(d.routes) + '</div>' +
        (d.page ? '<a class="dgo" href="' + esc(d.page) + '">open ' + esc(d.page) + ' &rarr;</a>' : '') +
        '</div>';
    }).join('');

    var el = $('elsewhere');
    if (el) el.innerHTML = ELSEWHERE.map(function (x) {
      return '<div class="cap unbuilt"><span class="dot"></span><div class="meta">' +
        '<div class="nm">' + esc(x.nm) + '</div><div class="why">' + esc(x.why) + '</div></div></div>';
    }).join('');
  }

  var POSTURE_WORD = {
    'open-human-gate': 'wants you', recommend: 'has a call',
    monitor: 'watching', abstain: 'abstaining'
  };

  function renderFloor() {
    var host = $('floor');
    if (!roster.length) {
      host.innerHTML = '<div class="quiet">The fleet has not answered. Names are not invented here.</div>';
      return;
    }
    var waiting = roster.filter(function (o) { return o.posture === 'open-human-gate'; }).length;
    $('waiting').innerHTML = waiting
      ? '<b>' + waiting + '</b> operator' + (waiting === 1 ? ' is' : 's are') + ' at the gate, waiting on you'
      : 'no operator is waiting on you';
    $('waiting').className = 'waiting' + (waiting ? ' hot' : '');

    host.innerHTML = roster.map(function (o) {
      var cls = 'st' + (o.posture ? ' p-' + o.posture : '') + (o.live ? ' live' : '');
      return '<div class="' + cls + '" title="' + esc(o.situation) + '">' +
        '<span class="lamp"></span>' +
        '<div class="nm">' + esc(o.n) + '</div>' +
        '<div class="dm">' + esc(o.d) + '</div>' +
        '<div class="pst">' + esc(POSTURE_WORD[o.posture] || 'no signal') +
          (o.vetoed ? ' · vetoed' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  function sweep() {
    var sts = $('floor').querySelectorAll('.st');
    Array.prototype.forEach.call(sts, function (s, i) {
      setTimeout(function () {
        s.classList.add('fire');
        setTimeout(function () { s.classList.remove('fire'); }, 800);
      }, i * 24);
    });
  }

  // ── the throw ─────────────────────────────────────────────────────────────
  /**
   * Optimistic for one frame, then reconciled. The server's answer is the truth:
   * if the write failed the lever goes back where it was and the log says why.
   * A control board that shows a throw the system did not accept is worse than
   * one that is slow.
   */
  function throwLever(L, st) {
    if (st.on === null || busy[L.id]) return;
    var want = !st.on;
    var qs = L.valve
      ? 'valve=' + encodeURIComponent(L.valve) + '&open=' + (want ? '1' : '0')
      : L.write(want);

    busy[L.id] = true;
    render();
    sweep();
    add('<b>' + esc(L.nm) + '</b> → ' + (want ? '<span class="g">ON</span>' : '<span class="w">OFF</span>') + ' · sending');

    jget('/api/harness?key=' + encodeURIComponent(key) + '&' + qs).then(function (r) {
      busy[L.id] = false;
      if (!r.j || r.j.ok === false) {
        add('<b>' + esc(L.nm) + '</b> <span class="x">rejected</span> · ' +
            esc((r.j && r.j.error) || ('http ' + r.s)), 'x');
        render();
        return;
      }
      // Re-read rather than trusting the echo, so the lever always shows the
      // state the system is actually in.
      poll();
      var note = (r.j.note || (r.j.ai && r.j.ai.reason) || '');
      add('<b>' + esc(L.nm) + '</b> ' + (want ? '<span class="g">ON</span>' : '<span class="w">OFF</span>') +
          ' · accepted' + (note ? ' · ' + esc(note) : ''), 'g');
    });
  }

  function add(html) {
    log.unshift({ t: clock(), m: html });
    if (log.length > 80) log.pop();
    renderLog();
  }
  function renderLog() {
    var host = $('log');
    if (!log.length) { host.innerHTML = '<div class="quiet">nothing thrown this session</div>'; return; }
    host.innerHTML = log.map(function (e) {
      return '<div class="row"><span class="t">' + e.t + '</span><span class="m">' + e.m + '</span></div>';
    }).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
