/**
 * clarity-vitals.js — live vitals waveforms for the civilization clarity console.
 *
 * DECOUPLED enhancement: it does NOT touch console-clarity.js's render logic. After the
 * console paints its domain tiles (.clr-domain-row[data-dh-toggle]), this hooks each one and
 * appends an animated waveform whose character is RELATABLE TO STRESS:
 *   high stress / dysregulated -> erratic, spiky, high-amplitude
 *   low stress / regulated     -> smooth, calm, low-amplitude
 * Tinted by the existing stress colors (red / amber / green). Reads live window.LIMENDomains,
 * re-attaches after re-renders, respects prefers-reduced-motion. Pure client math, no network.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stressOf(dk) {
    var d = (window.LIMENDomains || {})[dk];
    if (!d) return null;
    var s = (typeof d.stress === 'number' && isFinite(d.stress)) ? d.stress
          : (typeof d.brainStress === 'number' && isFinite(d.brainStress)) ? d.brainStress : null;
    if (s == null) return null;
    if (s > 1.5) s = s / 100;                 // accept a 0-100 scale too
    return Math.max(0, Math.min(1, s));
  }
  function col(s) { return s >= 0.68 ? '#ff6a5a' : s >= 0.5 ? '#ffc24b' : '#4fd18e'; }

  var mounts = [];

  function sizeM(m) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = m.cv.clientWidth || 260, h = 34;
    m.cv.width = w * dpr; m.cv.height = h * dpr;
    m.ctx = m.cv.getContext('2d'); m.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.w = w; m.h = h;
    if (!m.buf || !m.buf.length) { m.buf = []; for (var i = 0; i < Math.floor(w / 2); i++) m.buf.push(0); }
  }

  function ensureMounts() {
    var rows = document.querySelectorAll('#clarity-view .clr-domain-row[data-dh-toggle]');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i], dk = row.getAttribute('data-dh-toggle'), cell = row.parentNode;
      if (!cell || cell.querySelector('.clr-vitals')) continue;
      var cv = document.createElement('canvas');
      cv.className = 'clr-vitals';
      cv.style.cssText = 'display:block;width:100%;height:34px;margin-top:7px;border-radius:6px;';
      cell.appendChild(cv);
      var m = { dk: dk, cv: cv, buf: [], spk: 0, ph: dk.length * 1.3 };
      sizeM(m);
      mounts.push(m);
    }
    if (mounts.length) mounts = mounts.filter(function (m) { return document.body.contains(m.cv); });
  }

  var t = 0;
  function sample(m, s) {
    var amp = 0.10 + s * 0.85;                                   // amplitude grows with stress
    var y = Math.sin(t * (0.35 + s * 0.95) + m.ph) * 0.40 + Math.sin(t * 0.13 + m.ph) * 0.12;
    if (!REDUCE) {
      y += (Math.random() - 0.5) * s * s * 1.35;                 // erratic jitter ∝ stress^2
      if (Math.random() < s * s * 0.06) m.spk = (Math.random() < 0.5 ? -1 : 1) * (0.5 + s * 0.6);
      y += m.spk; m.spk *= 0.6;                                  // decaying spike (distress)
    }
    return Math.max(-1, Math.min(1, y)) * amp;
  }
  function draw(m) {
    var s = stressOf(m.dk); if (s == null) s = 0;
    var ctx = m.ctx, w = m.w, h = m.h, mid = h / 2, c = col(s);
    m.buf.push(sample(m, s)); if (m.buf.length > Math.floor(w / 2)) m.buf.shift();
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    var n = m.buf.length, step = w / (n - 1 || 1), i, x, y;
    ctx.beginPath(); ctx.moveTo(0, mid);
    for (i = 0; i < n; i++) ctx.lineTo(i * step, mid - m.buf[i] * (mid - 3));
    ctx.lineTo(w, mid);
    var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c + '2e'); g.addColorStop(1, c + '00');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    for (i = 0; i < n; i++) { x = i * step; y = mid - m.buf[i] * (mid - 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.shadowColor = c; ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
    var ly = mid - m.buf[n - 1] * (mid - 3);
    ctx.beginPath(); ctx.arc(w - 1, ly, 2, 0, 7); ctx.fillStyle = c; ctx.fill();
  }
  function loop() { t += REDUCE ? 0 : 0.2; for (var i = 0; i < mounts.length; i++) { try { draw(mounts[i]); } catch (e) {} } requestAnimationFrame(loop); }

  function boot() {
    try { ensureMounts(); } catch (e) {}
    setInterval(function () { try { ensureMounts(); } catch (e) {} }, 1500);
    window.addEventListener('resize', function () { mounts.forEach(sizeM); });
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
