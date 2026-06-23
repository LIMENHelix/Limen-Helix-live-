/**
 * limen-collapse.js — collapse any list/grid to N items with a Show all / less toggle.
 * window.__collapse(containerEl, visibleCount) — call after you populate the container.
 * Idempotent + re-runnable. The container should DIRECTLY hold the item children.
 */
(function () {
  window.__collapse = function (el, visible) {
    if (!el) return;
    visible = visible || 6;
    var old = el.querySelector(':scope > .lmn-more'); if (old) old.remove();
    var kids = Array.prototype.filter.call(el.children, function (c) { return !c.classList.contains('lmn-more'); });
    if (kids.length <= visible) { kids.forEach(function (c) { c.style.display = ''; }); return; }
    var expanded = el.getAttribute('data-expanded') === '1';
    kids.forEach(function (c, i) { c.style.display = (expanded || i < visible) ? '' : 'none'; });
    var btn = document.createElement('div');
    btn.className = 'lmn-more';
    btn.style.cssText = 'grid-column:1/-1;text-align:center;font-size:12px;color:#9a9384;cursor:pointer;padding:10px;letter-spacing:.5px;user-select:none;border-top:1px solid rgba(150,150,160,0.12);margin-top:4px';
    btn.textContent = expanded ? '▲ Show less' : ('▼ Show all ' + kids.length);
    btn.onmouseover = function () { btn.style.color = '#c9a94e'; };
    btn.onmouseout = function () { btn.style.color = '#9a9384'; };
    btn.onclick = function () { el.setAttribute('data-expanded', expanded ? '0' : '1'); window.__collapse(el, visible); };
    el.appendChild(btn);
  };
})();
