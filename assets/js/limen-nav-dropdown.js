/* limen-nav-dropdown.js — universal page-navigation dropdown.
 * Injects a fixed "≡ Pages" button (top-right) that opens a panel with EVERY
 * page linked (from window.LIMEN_SITE_INDEX) + the full Appendix + a back-to-
 * Cockpit link. Self-contained: prefixed ids/classes, own styles, high z-index.
 * Add to any page with:  <script src="/assets/js/limen-site-index.js" defer></script>
 *                        <script src="/assets/js/limen-nav-dropdown.js" defer></script>
 */
(function () {
  function init() {
    if (document.getElementById('lnav-btn')) return;            // idempotent
    var IDX = window.LIMEN_SITE_INDEX || { groups: [], total: 0 };

    var css = document.createElement('style');
    css.textContent =
      '#lnav-btn{position:fixed;top:12px;right:12px;z-index:99998;background:#0b1018;color:rgba(201,169,78,1);' +
      'border:1px solid rgba(201,169,78,.45);border-radius:5px;font:600 12px ui-monospace,Menlo,monospace;' +
      'letter-spacing:1px;padding:8px 12px;cursor:pointer}' +
      '#lnav-btn:hover{background:rgba(201,169,78,.12)}' +
      '#lnav-ov{position:fixed;inset:0;z-index:99998;background:rgba(2,4,8,.55);display:none}' +
      '#lnav-panel{position:fixed;top:0;right:0;z-index:99999;width:min(420px,92vw);height:100vh;overflow:auto;' +
      'background:#070b12;border-left:1px solid rgba(201,169,78,.25);box-shadow:-12px 0 40px rgba(0,0,0,.5);' +
      'transform:translateX(100%);transition:transform .18s ease;font-family:ui-monospace,Menlo,monospace;color:#e8e3d9}' +
      '#lnav-panel.open{transform:none}' +
      '#lnav-panel .h{position:sticky;top:0;background:#070b12;padding:14px 16px 10px;border-bottom:1px solid rgba(201,169,78,.16)}' +
      '#lnav-panel .brand{color:rgba(201,169,78,1);letter-spacing:2px;font-size:11px}' +
      '#lnav-panel h3{margin:4px 0 0;font-size:15px;letter-spacing:.5px}' +
      '#lnav-panel .row{display:flex;gap:8px;margin-top:10px}' +
      '#lnav-panel .row a{flex:1;text-align:center;border:1px solid rgba(201,169,78,.4);color:rgba(201,169,78,1);' +
      'text-decoration:none;border-radius:4px;padding:7px;font-size:12px}' +
      '#lnav-panel .row a:hover{background:rgba(201,169,78,.12)}' +
      '#lnav-f{width:100%;margin-top:10px;background:#0b1018;color:#e8e3d9;border:1px solid rgba(201,169,78,.16);' +
      'border-radius:4px;padding:8px 10px;font:inherit;font-size:12px}' +
      '#lnav-x{position:absolute;top:12px;right:14px;cursor:pointer;color:#9aa0ab;font-size:18px;line-height:1}' +
      '#lnav-body{padding:6px 16px 40px}' +
      '#lnav-body .g{color:rgba(201,169,78,1);font-size:11px;letter-spacing:1.5px;margin:16px 0 6px;border-bottom:1px solid rgba(201,169,78,.12);padding-bottom:4px}' +
      '#lnav-body a.p{display:block;color:#e8e3d9;text-decoration:none;font-size:13px;padding:4px 6px;border-radius:3px}' +
      '#lnav-body a.p:hover{background:rgba(201,169,78,.1)}' +
      '#lnav-body a.p .u{color:#9aa0ab;font-size:10px;margin-left:6px}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'lnav-btn'; btn.type = 'button'; btn.textContent = '≡ Pages';
    var ov = document.createElement('div'); ov.id = 'lnav-ov';
    var panel = document.createElement('div'); panel.id = 'lnav-panel';

    var rows = '';
    IDX.groups.forEach(function (g) {
      rows += '<div class="g">' + esc(g.name) + '</div>';
      g.items.forEach(function (it) {
        rows += '<a class="p" href="' + esc(it.url) + '" data-q="' + esc((it.label + ' ' + it.stem + ' ' + g.name).toLowerCase()) + '">' +
          esc(it.label) + '<span class="u">' + esc(it.url) + '</span></a>';
      });
    });
    panel.innerHTML =
      '<div class="h"><span id="lnav-x">✕</span><div class="brand">LIMEN HELIX</div>' +
      '<h3>All Pages <span style="color:#9aa0ab;font-size:12px">(' + (IDX.total || 0) + ')</span></h3>' +
      '<div class="row"><a href="/appendix">▤ Full Appendix</a><a href="/civilization">← Cockpit</a></div>' +
      '<input id="lnav-f" type="search" placeholder="Filter pages…"></div>' +
      '<div id="lnav-body">' + rows + '</div>';

    document.body.appendChild(btn); document.body.appendChild(ov); document.body.appendChild(panel);
    function open() { ov.style.display = 'block'; panel.classList.add('open'); var f = document.getElementById('lnav-f'); if (f) setTimeout(function(){f.focus();}, 60); }
    function close() { ov.style.display = 'none'; panel.classList.remove('open'); }
    btn.addEventListener('click', open);
    ov.addEventListener('click', close);
    panel.querySelector('#lnav-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    var f = document.getElementById('lnav-f');
    f.addEventListener('input', function () {
      var q = f.value.trim().toLowerCase();
      panel.querySelectorAll('#lnav-body a.p').forEach(function (a) { a.style.display = (!q || a.getAttribute('data-q').indexOf(q) >= 0) ? '' : 'none'; });
      panel.querySelectorAll('#lnav-body .g').forEach(function (g) {
        var n = g.nextElementSibling, any = false;
        while (n && n.classList.contains('p')) { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; }
        g.style.display = any ? '' : 'none';
      });
    });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
