/**
 * limen-sparkline.js — reusable live-line component.
 *
 * Used by biosensor-control-panel.js for arousal/coherence/HR traces, and by
 * domain panels and Civilization for stress / phase / activity traces. One
 * canvas, multiple series, rolling time window.
 *
 * API:
 *   var chart = LIMENSparkline.create({
 *     parent:    containerEl,
 *     width:     280,
 *     height:    80,
 *     windowMs:  60000,                         // rolling window
 *     yLabel:    'arousal',                     // optional caption (top-left)
 *     series: [
 *       { id: 'arousal', color: '#df9a9a', range: [0, 1] },
 *       { id: 'coh',     color: '#9adfa1', range: [0, 1] },
 *       { id: 'load',    color: '#c9a94e', range: [0, 1] }
 *     ]
 *   });
 *   chart.push({ arousal: 0.4, coh: 0.7, load: 0.3 });
 *   chart.push(0.42)            // single-series shorthand → first series id
 *   chart.clear();
 *   chart.destroy();
 *
 * Notes:
 *   - Pure canvas, devicePixelRatio-aware. No external deps.
 *   - Series may use a shared range or auto-fit (omit `range`).
 *   - Per CLAUDE.md prime directive: session RAM only.
 */

(function (global) {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var parent   = opts.parent;
    var width    = opts.width    || 280;
    var height   = opts.height   || 80;
    var windowMs = opts.windowMs || 60000;
    var grid     = (opts.grid !== false);
    var yLabel   = opts.yLabel  || '';
    var series   = (opts.series || [{ id: 'v', color: '#c9a94e', range: [0, 1] }]).slice();

    if (!parent) throw new Error('LIMENSparkline: parent element required');

    // Holder
    var holder = document.createElement('div');
    holder.style.cssText = 'position:relative;width:' + width + 'px;height:' + height + 'px;';
    parent.appendChild(holder);

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    holder.appendChild(canvas);

    // Caption
    var caption = null;
    if (yLabel) {
      caption = document.createElement('div');
      caption.style.cssText = 'position:absolute;top:2px;left:4px;font:9px ui-monospace,Menlo,Consolas,monospace;'
        + 'color:#8a7a4a;letter-spacing:0.05em;text-transform:uppercase;pointer-events:none;';
      caption.textContent = yLabel;
      holder.appendChild(caption);
    }

    // Legend (top-right) for multi-series
    var legend = null;
    if (series.length > 1) {
      legend = document.createElement('div');
      legend.style.cssText = 'position:absolute;top:2px;right:4px;display:flex;gap:6px;font:9px ui-monospace,Menlo,Consolas,monospace;'
        + 'color:#8a7a4a;pointer-events:none;';
      for (var li = 0; li < series.length; li++) {
        var s = series[li];
        var sw = document.createElement('span');
        sw.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'
          + s.color + ';margin-right:3px;vertical-align:middle;"></span>' + (s.label || s.id);
        legend.appendChild(sw);
      }
      holder.appendChild(legend);
    }

    // Per-series ring-buffers
    var buffers = {};
    for (var i = 0; i < series.length; i++) buffers[series[i].id] = [];

    // Last-value labels (right edge)
    var valueLabels = document.createElement('div');
    valueLabels.style.cssText = 'position:absolute;right:2px;bottom:2px;display:flex;flex-direction:column;'
      + 'align-items:flex-end;font:9px ui-monospace,Menlo,Consolas,monospace;line-height:1.1;'
      + 'pointer-events:none;text-shadow:0 0 3px rgba(0,0,0,0.8);';
    holder.appendChild(valueLabels);
    var valueEls = {};
    for (var vi = 0; vi < series.length; vi++) {
      var v = document.createElement('div');
      v.style.color = series[vi].color;
      v.textContent = '—';
      valueLabels.appendChild(v);
      valueEls[series[vi].id] = v;
    }

    // DPR scaling
    var ctx = canvas.getContext('2d');
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    function resize() {
      var rect = holder.getBoundingClientRect();
      var w = Math.max(1, Math.floor(rect.width));
      var h = Math.max(1, Math.floor(rect.height));
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    var resizeHandler = function () { resize(); render(); };
    window.addEventListener('resize', resizeHandler);

    function push(values) {
      var now = Date.now();
      var v;
      if (typeof values === 'number') {
        v = {};
        v[series[0].id] = values;
      } else {
        v = values || {};
      }
      for (var k = 0; k < series.length; k++) {
        var sid = series[k].id;
        if (typeof v[sid] === 'number' && !isNaN(v[sid])) {
          buffers[sid].push({ t: now, v: v[sid] });
        }
        // Trim old entries
        var cutoff = now - windowMs;
        var buf = buffers[sid];
        var dropTo = 0;
        while (dropTo < buf.length && buf[dropTo].t < cutoff) dropTo++;
        if (dropTo > 0) buffers[sid].splice(0, dropTo);
      }
      render();
    }

    function clear() {
      for (var k = 0; k < series.length; k++) buffers[series[k].id] = [];
      render();
    }

    function destroy() {
      window.removeEventListener('resize', resizeHandler);
      if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
    }

    // Render
    var rafScheduled = false;
    function render() {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(function () {
        rafScheduled = false;
        draw();
      });
    }

    function draw() {
      var rect = holder.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Grid
      if (grid) {
        ctx.strokeStyle = 'rgba(201,169,78,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gy = 1; gy < 4; gy++) {
          var y = (h * gy) / 4;
          ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
        ctx.stroke();
      }

      var now = Date.now();
      for (var i = 0; i < series.length; i++) {
        var s = series[i];
        var buf = buffers[s.id];
        if (!buf || buf.length === 0) {
          if (valueEls[s.id]) valueEls[s.id].textContent = '—';
          continue;
        }
        // Range
        var minV, maxV;
        if (s.range) {
          minV = s.range[0]; maxV = s.range[1];
        } else {
          minV = Infinity; maxV = -Infinity;
          for (var j = 0; j < buf.length; j++) {
            if (buf[j].v < minV) minV = buf[j].v;
            if (buf[j].v > maxV) maxV = buf[j].v;
          }
          if (minV === maxV) { minV -= 0.5; maxV += 0.5; }
          // Pad 5% top/bottom for headroom
          var pad = (maxV - minV) * 0.05;
          minV -= pad; maxV += pad;
        }
        var span = maxV - minV;
        if (span <= 0) span = 1;

        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        ctx.beginPath();
        var first = true;
        for (var p = 0; p < buf.length; p++) {
          var pt = buf[p];
          var ageFrac = (now - pt.t) / windowMs;        // 0 (now) → 1 (oldest)
          if (ageFrac > 1) continue;
          var x = (1 - ageFrac) * w;
          var y = h - ((pt.v - minV) / span) * h;
          if (first) { ctx.moveTo(x, y); first = false; }
          else        ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Dot at most-recent point
        var last = buf[buf.length - 1];
        if (last && (now - last.t) <= windowMs) {
          var lx = (1 - (now - last.t) / windowMs) * w;
          var ly = h - ((last.v - minV) / span) * h;
          ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();
          if (valueEls[s.id]) {
            valueEls[s.id].textContent = formatVal(last.v, s);
          }
        }
      }
    }

    function formatVal(v, s) {
      if (s.format) return s.format(v);
      if (s.range && s.range[1] - s.range[0] <= 1) return v.toFixed(2);
      return v.toFixed(0);
    }

    return { push: push, clear: clear, destroy: destroy, resize: resize };
  }

  global.LIMENSparkline = { create: create };
})(window);
