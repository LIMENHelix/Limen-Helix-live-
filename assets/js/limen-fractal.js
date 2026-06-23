/**
 * limen-fractal.js — geometric "fractal connectome" header band for the public fronts.
 *
 * Represents the system itself: recursive trees (fractal / self-similar), cross-linked
 * nodes (connectome / brain), a signal pulse sweeping through (the engine processing),
 * and 11 phase ticks slowly advancing (the P0–P10 arc — phase represented, not labeled).
 * Crisp/blueprint. Accent auto-detected from the page theme (--gold or --steel).
 *
 * Auto-mounts after the first hero <h1> (or into <div id="limen-fractal"> if present).
 */
(function () {
  if (window.__limenFractal) return; window.__limenFractal = true;

  function accent() {
    try {
      var s = getComputedStyle(document.documentElement);
      var g = (s.getPropertyValue('--gold') || '').trim(); if (g) return g;
      var st = (s.getPropertyValue('--steel') || '').trim(); if (st) return st;
    } catch (e) {}
    return '#6aa9e0';
  }
  function target() {
    var ex = document.getElementById('limen-fractal'); if (ex) return ex;
    var h = document.querySelector('.hero h1') || document.querySelector('.hero') || document.querySelector('main h1') || document.querySelector('h1');
    if (!h || !h.parentNode) return null;
    var b = document.createElement('div'); b.id = 'limen-fractal';
    b.style.cssText = 'width:100%;max-width:860px;margin:16px auto 2px;display:block;opacity:0.92;pointer-events:none';
    h.parentNode.insertBefore(b, h.nextSibling);
    return b;
  }

  function start() {
    var el = target(); if (!el) return;
    var AC = accent(), DIM = 'rgba(150,162,178,0.30)', DIM2 = 'rgba(150,162,178,0.5)';
    var c = document.createElement('canvas'); c.style.display = 'block'; el.appendChild(c);
    var x = c.getContext('2d'), W = 0, H = 108, dpr = 1, trees = [];

    function makeTree(x0, y0, ang, len, depth, seed) {
      var nodes = [], edges = [];
      (function rec(px, py, a, l, d) {
        if (d <= 0) return;
        var nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l;
        edges.push([px, py, nx, ny]); nodes.push({ x: nx, y: ny });
        var sp = 0.40 + 0.10 * Math.sin(seed + d);
        rec(nx, ny, a - sp, l * 0.70, d - 1); rec(nx, ny, a + sp, l * 0.70, d - 1);
      })(x0, y0, ang, len, depth);
      return { nodes: nodes, edges: edges };
    }
    function build() {
      W = el.clientWidth || el.offsetWidth || 600;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      trees = []; var n = Math.max(3, Math.round(W / 170)), gap = W / (n + 1);
      for (var i = 0; i < n; i++) trees.push(makeTree((i + 1) * gap, H - 16, -Math.PI / 2, Math.min(27, H * 0.30), 5, i * 1.6));
    }
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts; var t = (ts - t0) / 1000;
      x.clearRect(0, 0, W, H);
      var pulse = (t * 0.42) % 1.3, phase = Math.floor(t / 3.5) % 11;
      // connectome cross-links between adjacent trees (faint)
      for (var i = 0; i < trees.length - 1; i++) {
        var a = trees[i].nodes[0], b = trees[i + 1].nodes[0];
        if (a && b) { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.strokeStyle = 'rgba(150,162,178,0.13)'; x.lineWidth = 1; x.stroke(); }
      }
      for (var ti = 0; ti < trees.length; ti++) {
        var tr = trees[ti];
        x.lineWidth = 1; x.strokeStyle = DIM;
        for (var e = 0; e < tr.edges.length; e++) { var ed = tr.edges[e]; x.beginPath(); x.moveTo(ed[0], ed[1]); x.lineTo(ed[2], ed[3]); x.stroke(); }
        for (var k = 0; k < tr.nodes.length; k++) {
          var nd = tr.nodes[k], near = Math.abs((nd.x / W) - pulse) < 0.05;
          x.fillStyle = near ? AC : DIM2; var s = near ? 3.2 : 1.8;
          x.fillRect(nd.x - s / 2, nd.y - s / 2, s, s);
          if (near) { x.globalAlpha = 0.28; x.fillStyle = AC; x.fillRect(nd.x - 3.5, nd.y - 3.5, 7, 7); x.globalAlpha = 1; }
        }
      }
      // 11 phase ticks (P0–P10) — phase represented, advancing
      var tw = Math.min(W * 0.55, 300), tx = (W - tw) / 2, ty = H - 3, w = tw / 11;
      for (var p = 0; p < 11; p++) { x.fillStyle = p === phase ? AC : 'rgba(150,162,178,0.22)'; x.fillRect(tx + p * w + 1, ty, w - 2, p === phase ? 3 : 1.5); }
      requestAnimationFrame(frame);
    }
    build(); window.addEventListener('resize', build); requestAnimationFrame(frame);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
