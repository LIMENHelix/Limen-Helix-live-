/**
 * limen-topbar.js — single source of truth for the LIMEN HELIX global top bar.
 *
 * Renders the global navigation header on every page that includes this script.
 *
 * Layout (left to right):
 *   1. LIMEN HELIX dropdown          (6 menu items)
 *   2. ANALYST / CLARITY toggle slot (filled by console-clarity.js when present)
 *   3. GENERATE REPORTS slot         (filled by console-clarity.js when present)
 *   4. flex spacer
 *   5. LIMEN BIOSENSOR · LIVE        (subscribes to biosensor-bridge if loaded)
 *   6. {state} · {time} · UTC{tz}    (clock + regulation state)
 *
 * Mount strategy:
 *   - If the page has <div id="limen-topbar"></div> as a placeholder, replace it.
 *   - Otherwise, prepend the topbar to <body>.
 *
 * Public API:
 *   window.LIMENTopbar.getActionsSlot()   → returns the actions container element
 *                                            (where ANALYST + GENERATE REPORTS go).
 *   window.LIMENTopbar.refresh()          → re-renders the clock once.
 *
 * No dependencies. No build step. Plain HTML/CSS/JS.
 */
(function () {
  'use strict';

  if (window.LIMENTopbar && window.LIMENTopbar._mounted) return;

  // ─── Routes (use clean URLs — vercel.json cleanUrls:true) ───────────────
  var ROUTES = [
    { label: 'LIMEN HELIX',        href: '/' },
    { label: '★ OPERATOR GUIDE',   href: '/operator-guide' },
    { label: '⬇ MY DOCUMENTS',     href: '/my-documents' },
    { label: 'PATTERN PROPOSALS',  href: '/pattern-proposals' },
    { label: 'SYSTEM VITALS',      href: '/vitals' },
    { label: 'MASTER BRAIN INBOX', href: '/master-inbox' },
    { label: 'CONSOLE',            href: '/civilization' },
    { label: 'OBSERVATORY',        href: '/civilization-opportunities' },
    { label: 'OPPORTUNITIES',      href: '/opportunities' },
    { label: 'COMMAND BOARD',      href: '/kernel-comparison' },
    { label: 'CONNECTOME',         href: '/connectome' },
    { label: 'MASTER BRAIN',       href: '/master-brain' }
  ];

  // ─── State display map (mirrors biosensor-bridge.js) ────────────────────
  var STATE_DISPLAY = {
    calm:       { label: 'CALM',       color: 'rgba(90,181,160,0.85)' },
    focused:    { label: 'FOCUSED',    color: 'rgba(59,130,246,0.85)' },
    pressured:  { label: 'PRESSURED',  color: 'rgba(212,164,78,0.85)' },
    overloaded: { label: 'OVERLOADED', color: 'rgba(232,84,84,0.85)' },
    recovering: { label: 'RECOVERING', color: 'rgba(139,92,246,0.85)' },
    unknown:    { label: 'CALM',       color: 'rgba(200,195,184,0.55)' }
  };

  // ─── CSS ────────────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('limen-topbar-style')) return;
    var s = document.createElement('style');
    s.id = 'limen-topbar-style';
    s.textContent = [
      '#limen-topbar{',
        'position:sticky;top:0;left:0;right:0;z-index:9000;',
        'display:flex;align-items:center;gap:14px;',
        'height:44px;padding:0 0 0 16px;',
        'background:rgba(5,8,16,0.96);',
        'border-bottom:1px solid rgba(201,169,78,0.12);',
        'font-family:"IBM Plex Mono","SF Mono",monospace;',
        'color:rgba(232,227,217,0.85);',
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
        '-webkit-user-select:none;user-select:none;',
      '}',
      '.ltb-spacer{flex:1 1 auto}',
      '.ltb-dropdown{position:relative;display:flex;align-items:center}',
      '.ltb-dropdown-btn{',
        'background:transparent;border:1px solid rgba(201,169,78,0.18);',
        'color:#C9A94E;font-family:inherit;cursor:pointer;',
        'font-size:0.62rem;letter-spacing:4px;text-transform:uppercase;',
        'padding:6px 14px;line-height:1;',
        'transition:border-color 0.2s,color 0.2s,background 0.2s;',
      '}',
      '.ltb-dropdown-btn:hover,.ltb-dropdown-btn[aria-expanded="true"]{',
        'border-color:rgba(201,169,78,0.5);color:#e8dcb5;',
        'background:rgba(201,169,78,0.06);',
      '}',
      '.ltb-dropdown-caret{display:inline-block;margin-left:8px;font-size:0.7em;opacity:0.7}',
      '.ltb-menu{',
        'position:absolute;top:calc(100% + 4px);left:0;min-width:200px;',
        'background:rgba(5,8,16,0.98);',
        'border:1px solid rgba(201,169,78,0.22);border-radius:2px;',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6);',
        'display:none;flex-direction:column;padding:4px 0;z-index:9001;',
      '}',
      '.ltb-menu[data-open="true"]{display:flex}',
      '.ltb-menu a{',
        'display:block;padding:8px 16px;',
        'font-size:0.55rem;letter-spacing:3px;text-transform:uppercase;',
        'color:rgba(201,169,78,0.7);text-decoration:none;',
        'transition:background 0.15s,color 0.15s;',
      '}',
      '.ltb-menu a:hover,.ltb-menu a:focus{background:rgba(201,169,78,0.1);color:#e8dcb5;outline:none}',
      '.ltb-actions{display:flex;align-items:center;gap:8px}',
      /* Reuse clarity button styles where present; provide minimal fallback */
      '.ltb-actions .clr-analyst-btn,.ltb-actions .clr-refresh-btn{',
        'font-family:inherit;font-size:0.4rem;letter-spacing:2px;text-transform:uppercase;',
        'background:transparent;border:1px solid rgba(201,169,78,0.18);',
        'color:rgba(201,169,78,0.55);padding:5px 10px;cursor:pointer;line-height:1;',
        'transition:border-color 0.2s,color 0.2s,background 0.2s;',
      '}',
      '.ltb-actions .clr-analyst-btn:hover,.ltb-actions .clr-refresh-btn:hover{',
        'border-color:rgba(201,169,78,0.4);color:#C9A94E;',
      '}',
      '.ltb-actions .clr-analyst-btn.active{color:#C9A94E;border-color:rgba(201,169,78,0.4)}',
      '.ltb-bio{',
        'display:inline-flex;align-items:center;gap:6px;',
        'font-size:0.42rem;letter-spacing:2px;text-transform:uppercase;',
        'color:rgba(201,169,78,0.55);',
      '}',
      '.ltb-bio-dot{',
        'width:7px;height:7px;border-radius:50%;background:rgba(232,84,84,0.85);',
        'box-shadow:0 0 6px rgba(232,84,84,0.5);',
        'animation:ltb-pulse 1.6s ease-in-out infinite;',
      '}',
      '@keyframes ltb-pulse{0%,100%{opacity:1}50%{opacity:0.35}}',
      '.ltb-clock{',
        'display:inline-flex;align-items:center;gap:8px;',
        'font-size:0.42rem;letter-spacing:1.8px;text-transform:uppercase;',
        'color:rgba(200,195,184,0.55);',
        'padding-right:24px;',
      '}',
      '.ltb-clock-state{font-weight:500}',
      '.ltb-sep{color:rgba(201,169,78,0.18);margin:0 2px}',
      /* Mobile: collapse action buttons into the dropdown footprint by hiding them.
         The user can toggle via /civilization on small screens. */
      '@media (max-width: 640px){',
        '#limen-topbar{gap:8px;padding-left:10px;height:40px}',
        '.ltb-dropdown-btn{font-size:0.5rem;letter-spacing:2.5px;padding:5px 10px}',
        '.ltb-actions{display:none}',
        '.ltb-bio{display:none}',
        '.ltb-clock{padding-right:14px;font-size:0.36rem}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  // ─── Markup ─────────────────────────────────────────────────────────────
  function buildBar() {
    var bar = document.createElement('header');
    bar.id = 'limen-topbar';
    bar.setAttribute('role', 'banner');

    // Dropdown
    var dd = document.createElement('div');
    dd.className = 'ltb-dropdown';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ltb-dropdown-btn';
    btn.id = 'ltb-dropdown-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ltb-menu');
    btn.innerHTML = 'LIMEN HELIX<span class="ltb-dropdown-caret" aria-hidden="true">▾</span>';
    var menu = document.createElement('div');
    menu.className = 'ltb-menu';
    menu.id = 'ltb-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-labelledby', 'ltb-dropdown-btn');
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      var a = document.createElement('a');
      a.href = r.href;
      a.textContent = r.label;
      a.setAttribute('role', 'menuitem');
      menu.appendChild(a);
    }
    dd.appendChild(btn);
    dd.appendChild(menu);
    bar.appendChild(dd);

    // Action slot (filled by console-clarity.js when present)
    var actions = document.createElement('div');
    actions.className = 'ltb-actions';
    actions.id = 'ltb-actions';
    bar.appendChild(actions);

    // Spacer
    var sp = document.createElement('div');
    sp.className = 'ltb-spacer';
    bar.appendChild(sp);

    // Biosensor LIVE indicator
    var bio = document.createElement('div');
    bio.className = 'ltb-bio';
    bio.id = 'ltb-bio';
    bio.innerHTML = '<span class="ltb-bio-dot" aria-hidden="true"></span>'
      + '<span>LIMEN BIOSENSOR &middot; LIVE</span>';
    bar.appendChild(bio);

    // Clock + state
    var clock = document.createElement('div');
    clock.className = 'ltb-clock';
    clock.id = 'ltb-clock';
    clock.innerHTML =
      '<span class="ltb-clock-state" id="ltb-clock-state">CALM</span>'
      + '<span class="ltb-sep">&middot;</span>'
      + '<span id="ltb-clock-time">--:--:--</span>'
      + '<span class="ltb-sep">&middot;</span>'
      + '<span id="ltb-clock-tz">UTC</span>';
    bar.appendChild(clock);

    return bar;
  }

  // ─── Dropdown wiring ────────────────────────────────────────────────────
  function wireDropdown(bar) {
    var btn = bar.querySelector('#ltb-dropdown-btn');
    var menu = bar.querySelector('#ltb-menu');
    if (!btn || !menu) return;

    function openMenu() {
      menu.setAttribute('data-open', 'true');
      btn.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      menu.setAttribute('data-open', 'false');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggleMenu() {
      var open = menu.getAttribute('data-open') === 'true';
      if (open) closeMenu(); else openMenu();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });
    document.addEventListener('click', function (e) {
      if (menu.getAttribute('data-open') !== 'true') return;
      if (e.target === btn || btn.contains(e.target)) return;
      if (menu.contains(e.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.getAttribute('data-open') === 'true') {
        closeMenu();
        btn.focus();
      }
    });
    // Tab navigation: keep default browser behavior — focus cycles through menu items naturally.
  }

  // ─── Clock ──────────────────────────────────────────────────────────────
  var _clockState = 'unknown';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function tickClock() {
    var t = document.getElementById('ltb-clock-time');
    var z = document.getElementById('ltb-clock-tz');
    var st = document.getElementById('ltb-clock-state');
    if (!t || !z || !st) return;
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    t.textContent = pad2(h) + ':' + pad2(m) + ':' + pad2(s);
    var tzMin = d.getTimezoneOffset();
    var sign = tzMin <= 0 ? '+' : '-';
    var tzH = Math.abs(Math.floor(tzMin / 60));
    z.textContent = 'UTC' + sign + tzH;
    var disp = STATE_DISPLAY[_clockState] || STATE_DISPLAY.unknown;
    st.textContent = disp.label;
    st.style.color = disp.color;
  }

  // ─── Biosensor wiring ───────────────────────────────────────────────────
  function wireBiosensor() {
    // Listen for limen:bio-tick or similar events emitted by biosensor-bridge.
    // Also poll LIMENBiosensorBridge for state.
    function pull() {
      try {
        if (window.LIMENBiosensorBridge && typeof window.LIMENBiosensorBridge.getRegulationState === 'function') {
          var s = window.LIMENBiosensorBridge.getRegulationState();
          if (s && STATE_DISPLAY[s]) _clockState = s;
        }
      } catch (e) { /* ignore */ }
    }
    setInterval(pull, 1000);
    // Also subscribe to common event names if used.
    try {
      window.addEventListener('limen:bio-state', function (e) {
        var s = e && e.detail && e.detail.state;
        if (s && STATE_DISPLAY[s]) _clockState = s;
      });
    } catch (e) { /* ignore */ }
  }

  // ─── Mount ──────────────────────────────────────────────────────────────
  function mount() {
    injectCss();
    var bar = buildBar();

    var existing = document.getElementById('limen-topbar');
    if (existing) {
      existing.parentNode.replaceChild(bar, existing);
    } else if (document.body) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      // body not ready yet
      document.addEventListener('DOMContentLoaded', mount, { once: true });
      return;
    }

    wireDropdown(bar);
    wireBiosensor();
    tickClock();
    setInterval(tickClock, 1000);
  }

  // ─── Public API ─────────────────────────────────────────────────────────
  window.LIMENTopbar = {
    _mounted: false,
    getActionsSlot: function () {
      return document.getElementById('ltb-actions');
    },
    refresh: function () { tickClock(); }
  };

  // Mount as soon as possible.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      mount();
      window.LIMENTopbar._mounted = true;
    }, { once: true });
  } else {
    mount();
    window.LIMENTopbar._mounted = true;
  }
})();
