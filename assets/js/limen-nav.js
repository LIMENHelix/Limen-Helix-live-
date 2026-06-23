/**
 * limen-nav.js — reusable "Menu ▾" dropdown for any LIMEN page.
 *
 * Drop <script src="/assets/js/limen-nav.js"></script> on a page → a fixed corner
 * menu button appears with every key destination, grouped. Public links always show;
 * admin links appear only when signed in (sessionStorage limen_access / limen_admin).
 * Self-contained (injects its own CSS); themeless so it works on gold or steel pages.
 */
(function () {
  if (window.__limenNav) return; window.__limenNav = true;

  var PUBLIC = [
    { h: 'Home', u: '/' },
    { h: '⚡ Energy Bill X-Ray', u: '/energy' },
    { h: '📈 Energy Markets', u: '/energy-markets' },
    { h: '🔌 Utility Watch', u: '/utility-watch' },
    { h: '🎵 Wave Radar (music)', u: '/wave-radar' },
    { h: '🎭 Culture', u: '/culture' },
    { h: '🏗 Plan Your Project (Infrastructure)', u: '/infrastructure' },
    { h: '◴ Phase Map', u: '/phase-map' },
    { h: '🗺 Site Map (all pages)', u: '/pages' }
  ];
  var ADMIN = [
    { h: '🧭 Mission Control', u: '/admin' },
    { h: '📐 Project Radar', u: '/project-radar' },
    { h: '🛰 Civilization', u: '/civilization' },
    { h: '💰 Capital Engine', u: '/finance-capital-engine' },
    { h: '📥 Leads', u: '/admin-leads' },
    { h: '🛠 Site Requests', u: '/admin-requests' },
    { h: '❤ Vitals', u: '/vitals' }
  ];

  function isAdmin() { try { return sessionStorage.getItem('limen_access') === 'granted' || !!sessionStorage.getItem('limen_admin'); } catch (e) { return false; } }
  function here() { return location.pathname.replace(/\/$/, '') || '/'; }

  var css = '#lmnav-btn{position:fixed;top:11px;left:14px;z-index:99998;font:600 0.62rem/1 "IBM Plex Mono",monospace;letter-spacing:2px;text-transform:uppercase;color:#c9a94e;background:rgba(6,8,12,0.82);border:1px solid rgba(201,169,78,0.4);padding:7px 12px;border-radius:5px;cursor:pointer;backdrop-filter:blur(3px)}'
    + '#lmnav-btn:hover{background:rgba(201,169,78,0.12)}'
    + '#lmnav-panel{position:fixed;top:44px;left:14px;z-index:99999;background:#06080c;border:1px solid rgba(201,169,78,0.3);border-radius:8px;padding:8px;min-width:230px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.6);display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
    + '#lmnav-panel.open{display:block}'
    + '#lmnav-panel .g{font-size:0.55rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.6);padding:8px 9px 4px}'
    + '#lmnav-panel a{display:block;color:#e8e3d9;text-decoration:none;font-size:13px;padding:7px 9px;border-radius:6px}'
    + '#lmnav-panel a:hover{background:rgba(201,169,78,0.1)}'
    + '#lmnav-panel a.here{color:#c9a94e;background:rgba(201,169,78,0.08)}';

  function render() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var btn = document.createElement('button'); btn.id = 'lmnav-btn'; btn.textContent = '☰ Menu';
    var panel = document.createElement('div'); panel.id = 'lmnav-panel';
    function rows(list) { return list.map(function (i) { var cur = here() === i.u.replace(/\/$/, ''); return '<a href="' + i.u + '"' + (cur ? ' class="here"' : '') + '>' + i.h + '</a>'; }).join(''); }
    var html = '<div class="g">Public</div>' + rows(PUBLIC);
    if (isAdmin()) html += '<div class="g">Admin</div>' + rows(ADMIN);
    panel.innerHTML = html;
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.onclick = function (e) { e.stopPropagation(); panel.classList.toggle('open'); };
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); });
  }
  // Admin-only nav: public visitors (homeowners, fans) never see the internal menu.
  function boot() { if (isAdmin()) render(); }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
