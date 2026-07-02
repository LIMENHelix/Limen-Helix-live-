/**
 * limen-phase-fractal.js — full-page WebGL fractal background coloured by a domain's
 * LIVE LIMEN phase (Julia / burning-ship hybrid). Reusable across bespoke fronts.
 *
 * Use:  <script src="/assets/js/limen-phase-fractal.js" data-domain="energy"></script>
 *
 * Self-mounts a fixed canvas (z-index:-2) + a light veil (z-1) behind the page, reads the
 * domain's phase from /api/limen-snapshot, and eases the fractal colour + form to that
 * phase (snapping on first read so it sticks to the domain's colour, no neutral start).
 * The page's own body background should be transparent for it to show (this file forces it).
 */
(function () {
  if (window.__limenPhaseFractal) return; window.__limenPhaseFractal = true;
  var scriptEl = document.currentScript;
  var domain = (scriptEl && scriptEl.getAttribute('data-domain')) || '';

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 u_res; uniform float u_time; uniform vec3 u_color; uniform float u_chaos; uniform float u_pow; uniform float u_ship; uniform float u_twist;',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);',
    '  float t=u_time*0.12;',
    '  uv*=(1.35+0.42*sin(u_time*0.13));',
    '  uv*=rot(t*0.25 + length(uv)*u_twist*2.2);',
    '  for(int i=0;i<4;i++){ uv=abs(uv)-(0.42-u_chaos*0.10); uv*=rot(0.38+0.16*sin(t+float(i))+u_chaos*0.55*sin(t*1.9+float(i)*2.1)); }',
    '  vec2 c=0.7885*vec2(cos(t*0.7),sin(t*0.93));',
    '  vec2 z=uv*1.55; float m=0.0; bool esc=false;',
    '  for(int i=0;i<110;i++){ z=mix(z,abs(z),u_ship); vec2 z2=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y); vec2 z3=vec2(z2.x*z.x-z2.y*z.y,z2.x*z.y+z2.y*z.x); z=mix(z2,z3,u_pow)+c; float d=dot(z,z);',
    '    if(d>16.0){ m=float(i)-log2(log2(d))+4.0; esc=true; break; } }',
    '  float n=esc?clamp(m/110.0,0.0,1.0):1.0;',
    '  float core=exp(-3.2*n);',
    '  vec3 base=u_color;',
    '  float shade=pow(n,1.25);',
    '  vec3 col=base*(0.15+1.02*shade);',
    '  col=mix(col, col*(0.65+0.6*sin(n*9.0+length(z)*2.2+t*0.6)), 0.42);',
    '  col+=core*mix(base,vec3(1.0),0.6)*1.3;',
    '  col+=base*pow(1.0-n,4.5)*1.0;',
    '  col=clamp(mix(vec3(dot(col,vec3(0.299,0.587,0.114))), col, 1.30), 0.0, 1.4);',
    '  col+=vec3(1.0)*pow(max(0.0,sin(34.0*length(z)+u_time*2.6)),22.0)*0.15;',
    '  float vig=1.0-0.55*length((gl_FragCoord.xy/u_res)-0.5);',
    '  col*=clamp(vig,0.0,1.0); col=pow(col,vec3(0.86));',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var PHASE_FRACTAL = {
    p0:  { c: [0.957, 0.945, 0.910], ch: 0.08, fx: [0.0, 0.0, 0.10] },
    p1:  { c: [1.000, 0.820, 0.400], ch: 0.50, fx: [0.2, 0.3, 0.25] },
    p2:  { c: [0.176, 0.831, 0.749], ch: 0.28, fx: [0.0, 0.0, 0.55] },
    p3:  { c: [0.616, 0.420, 1.000], ch: 1.00, fx: [0.6, 0.8, 0.12] },
    p4:  { c: [0.561, 0.749, 0.624], ch: 0.25, fx: [0.15, 0.0, 0.30] },
    p5:  { c: [0.961, 0.620, 0.043], ch: 0.42, fx: [0.4, 0.2, 0.45] },
    p6:  { c: [0.145, 0.388, 0.922], ch: 0.12, fx: [1.0, 0.0, 0.0] },
    p7:  { c: [0.863, 0.149, 0.149], ch: 0.80, fx: [0.5, 0.5, 0.6] },
    p8:  { c: [0.427, 0.365, 0.988], ch: 0.40, fx: [0.25, 0.1, 0.5] },
    p9:  { c: [0.659, 0.333, 0.969], ch: 0.72, fx: [0.7, 0.6, 0.9] },
    p10: { c: [0.063, 0.725, 0.506], ch: 0.22, fx: [1.0, 0.0, 0.3] }
  };

  var _pf0 = PHASE_FRACTAL.p6;
  var curColor = _pf0.c.slice(), tgtColor = _pf0.c.slice();
  var curChaos = _pf0.ch, tgtChaos = _pf0.ch;
  var curFx = _pf0.fx.slice(), tgtFx = _pf0.fx.slice();
  var _phaseLocked = false;
  function setPhase(phase) {
    var p = PHASE_FRACTAL[String(phase || '').toLowerCase()]; if (!p) return;
    tgtColor = p.c.slice(); tgtChaos = p.ch; tgtFx = p.fx.slice();
    if (!_phaseLocked) { curColor = p.c.slice(); curChaos = p.ch; curFx = p.fx.slice(); _phaseLocked = true; }
  }
  window.LimenPhaseFractal = { setPhase: setPhase };

  var css = 'html{background:#070b12}body{background:transparent !important}'
    + '#lfx-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:-2;display:block;background:#070b12}'
    + '#lfx-veil{position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(8,11,18,.42),rgba(8,11,18,.12) 46%,rgba(8,11,18,.32))}';

  function init(cv) {
    var gl = null; try { gl = cv.getContext('webgl') || cv.getContext('experimental-webgl'); } catch (e) {}
    if (!gl) { cv.style.background = 'radial-gradient(60% 60% at 50% 35%,#161d33,#05060d)'; return; }
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.style.background = 'radial-gradient(60% 60% at 50% 35%,#161d33,#05060d)'; return; }
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var lc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'u_res'), uT = gl.getUniformLocation(pr, 'u_time'), uC = gl.getUniformLocation(pr, 'u_color'),
        uH = gl.getUniformLocation(pr, 'u_chaos'), uPow = gl.getUniformLocation(pr, 'u_pow'), uShip = gl.getUniformLocation(pr, 'u_ship'), uTwist = gl.getUniformLocation(pr, 'u_twist');
    function sz() { var d = Math.min(window.devicePixelRatio || 1, 1.5); cv.width = Math.max(1, (window.innerWidth * d) | 0); cv.height = Math.max(1, (window.innerHeight * d) | 0); gl.viewport(0, 0, cv.width, cv.height); }
    sz(); window.addEventListener('resize', sz);
    var run = true, tAcc = 0, last = Date.now();
    document.addEventListener('visibilitychange', function () { run = !document.hidden; if (run) loop(); });
    function loop() {
      if (!run) return;
      var now = Date.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; tAcc += dt;
      for (var k = 0; k < 3; k++) curColor[k] += (tgtColor[k] - curColor[k]) * 0.06;
      curChaos += (tgtChaos - curChaos) * 0.06;
      for (var f = 0; f < 3; f++) curFx[f] += (tgtFx[f] - curFx[f]) * 0.06;
      gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, tAcc);
      gl.uniform3f(uC, curColor[0], curColor[1], curColor[2]); gl.uniform1f(uH, curChaos);
      gl.uniform1f(uPow, curFx[0]); gl.uniform1f(uShip, curFx[1]); gl.uniform1f(uTwist, curFx[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3); requestAnimationFrame(loop);
    }
    loop();
  }

  function fetchPhase() {
    if (!domain) return;
    fetch('/api/limen-snapshot').then(function (r) { return r.json(); }).then(function (j) {
      var d = (j.domains || j)[domain] || {}; if (d.phase) setPhase(d.phase);
    }).catch(function () {});
  }

  function mount() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var cv = document.createElement('canvas'); cv.id = 'lfx-canvas';
    var veil = document.createElement('div'); veil.id = 'lfx-veil';
    document.body.appendChild(cv); document.body.appendChild(veil);
    init(cv); fetchPhase();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
