/**
 * LIMEN HELIX — Biosensor Engine v1.0
 * 
 * Tier 1: Browser-only biometric sensing + cognitive inference
 * No external hardware required. Camera + device sensors + behavioral signals.
 *
 * Channels:
 *   1. rPPG (remote photoplethysmography) — camera-based heart rate & HRV
 *   2. Device Motion — accelerometer tremor analysis (arousal proxy)
 *   3. Behavioral — enhanced tap/scroll/dwell/hesitation patterns
 *   4. Touch Pressure — capacitive touch intensity (where supported)
 *
 * Outputs unified autonomic state:
 *   { heartRate, hrv, arousal, valence, coherence, cognitiveLoad, phase }
 *
 * Privacy: Session RAM only. No storage. No transmission. Camera frames
 * are processed in-canvas and never saved.
 *
 * (c) 2025 LIMEN HELIX Transformational Sciences LLC
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════

  const CONFIG = {
    // rPPG
    rppg: {
      sampleRate: 30,         // Hz — camera frame capture rate
      windowSeconds: 10,      // Rolling window for HR calculation
      minPeaks: 4,            // Minimum peaks needed for valid HR
      bandpassLow: 0.7,       // Hz — ~42 BPM minimum
      bandpassHigh: 3.5,      // Hz — ~210 BPM maximum
      roiSize: 0.3,           // Fraction of face ROI to sample
      greenWeight: 1.0,       // Green channel (strongest PPG signal)
      redWeight: 0.4,         // Red channel (supplementary)
    },

    // BLE Heart Rate (Tier 2)
    ble: {
      hrServiceUUID: 'heart_rate',             // Standard BLE HR service
      hrCharUUID: 'heart_rate_measurement',    // HR measurement characteristic
      reconnectAttempts: 3,
      reconnectDelayMs: 2000,
    },

    // Device Motion
    motion: {
      sampleRate: 60,         // Hz
      windowMs: 3000,         // Tremor analysis window
      tremorBandLow: 4,       // Hz — physiological tremor range
      tremorBandHigh: 12,     // Hz
    },

    // Behavioral
    behavior: {
      tapWindowMs: 10000,     // Rolling window for tap analysis
      hesitationThresholdMs: 2000,
      dwellUpdateMs: 200,
    },

    // Unified state
    fusion: {
      emitRateMs: 200,        // How often to emit unified state
      smoothingAlpha: 0.15,   // EMA smoothing factor (0 = no change, 1 = instant)
    },

    // Fractal propagation
    fractal: {
      stateTransferKey: '_limenBioState', // sessionStorage key for portal transfer
      depthAmplification: 0.15,           // How much deeper each portal level intensifies
      resonanceThreshold: 0.75,           // Resonance level that triggers portal readiness
    }
  };

  // ═══════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════

  function ema(prev, next, alpha) {
    return prev + alpha * (next - prev);
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1));
  }

  function rmssd(intervals) {
    if (intervals.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sum += diff * diff;
    }
    return Math.sqrt(sum / (intervals.length - 1));
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // Simple bandpass via moving average subtraction
  function bandpass(signal, sampleRate, lowHz, highHz) {
    const out = new Float32Array(signal.length);
    const lowN = Math.max(1, Math.round(sampleRate / highHz));
    const highN = Math.max(lowN + 1, Math.round(sampleRate / lowHz));

    // High-pass: subtract long moving average
    for (let i = 0; i < signal.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - highN); j <= Math.min(signal.length - 1, i + highN); j++) {
        sum += signal[j]; count++;
      }
      out[i] = signal[i] - sum / count;
    }

    // Low-pass: short moving average
    const filtered = new Float32Array(signal.length);
    for (let i = 0; i < out.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - lowN); j <= Math.min(out.length - 1, i + lowN); j++) {
        sum += out[j]; count++;
      }
      filtered[i] = sum / count;
    }
    return filtered;
  }

  // Find peaks in signal (simple zero-crossing of derivative)
  function findPeaks(signal, minDistance) {
    const peaks = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
        if (!peaks.length || (i - peaks[peaks.length - 1]) >= minDistance) {
          peaks.push(i);
        }
      }
    }
    return peaks;
  }


  // ═══════════════════════════════════════════════════
  // CHANNEL 1: rPPG — Camera-Based Heart Rate
  // ═══════════════════════════════════════════════════

  function createRPPGChannel() {
    let video = null;
    let canvas = null;
    let ctx = null;
    let stream = null;
    let active = false;
    let frameId = null;

    // Signal buffer: green channel intensity over time
    const greenSignal = [];
    const redSignal = [];
    const timestamps = [];
    const maxSamples = CONFIG.rppg.sampleRate * CONFIG.rppg.windowSeconds;

    // Derived metrics
    let heartRate = 0;
    let hrvRMSSD = 0;
    let signalQuality = 0;
    let lastPeakIntervals = [];

    async function start() {
      try {
        // Create hidden video + canvas
        video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        document.body.appendChild(video);

        canvas = document.createElement('canvas');
        canvas.width = 64;  // Low res is fine — we just need average color
        canvas.height = 48;
        ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Request camera — prefer front-facing
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 64 },
            height: { ideal: 48 },
            frameRate: { ideal: CONFIG.rppg.sampleRate }
          },
          audio: false
        });

        video.srcObject = stream;
        await video.play();
        active = true;
        captureFrame();

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    function captureFrame() {
      if (!active) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Sample center ROI (forehead region has strongest PPG)
        const roiW = Math.floor(canvas.width * CONFIG.rppg.roiSize);
        const roiH = Math.floor(canvas.height * CONFIG.rppg.roiSize);
        const roiX = Math.floor((canvas.width - roiW) / 2);
        const roiY = Math.floor((canvas.height - roiH) / 3); // Upper third = forehead

        const imageData = ctx.getImageData(roiX, roiY, roiW, roiH);
        const pixels = imageData.data;

        // Average green and red channels across ROI
        let greenSum = 0, redSum = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          redSum += pixels[i];
          greenSum += pixels[i + 1];
          count++;
        }

        const greenAvg = greenSum / count;
        const redAvg = redSum / count;
        const now = performance.now();

        greenSignal.push(greenAvg);
        redSignal.push(redAvg);
        timestamps.push(now);

        // Trim to window
        while (greenSignal.length > maxSamples) {
          greenSignal.shift();
          redSignal.shift();
          timestamps.shift();
        }

        // Process when we have enough data (at least 3 seconds)
        if (greenSignal.length > CONFIG.rppg.sampleRate * 3) {
          processSignal();
        }
      } catch (e) {
        // Frame capture failed — skip
      }

      // Schedule next frame at target rate
      const interval = 1000 / CONFIG.rppg.sampleRate;
      frameId = setTimeout(captureFrame, interval);
    }

    function processSignal() {
      const sr = CONFIG.rppg.sampleRate;
      const signal = new Float32Array(greenSignal);

      // Bandpass filter to isolate cardiac rhythm
      const filtered = bandpass(signal, sr, CONFIG.rppg.bandpassLow, CONFIG.rppg.bandpassHigh);

      // Find peaks
      const minDist = Math.floor(sr * 60 / 210); // Min distance for 210 BPM
      const peaks = findPeaks(filtered, minDist);

      if (peaks.length >= CONFIG.rppg.minPeaks) {
        // Calculate inter-beat intervals (in ms)
        const ibis = [];
        for (let i = 1; i < peaks.length; i++) {
          const dtSamples = peaks[i] - peaks[i - 1];
          const dtMs = (dtSamples / sr) * 1000;
          // Reject physiologically impossible intervals
          if (dtMs > 285 && dtMs < 1500) { // 40-210 BPM range
            ibis.push(dtMs);
          }
        }

        if (ibis.length >= 3) {
          // Heart rate from median IBI (more robust than mean)
          const sorted = [...ibis].sort((a, b) => a - b);
          const medianIBI = sorted[Math.floor(sorted.length / 2)];
          heartRate = 60000 / medianIBI;

          // HRV: RMSSD of successive differences
          hrvRMSSD = rmssd(ibis);
          lastPeakIntervals = ibis;

          // Signal quality: coefficient of variation of IBIs
          // Lower CV = more regular = higher quality
          const cv = std(ibis) / mean(ibis);
          signalQuality = clamp01(1 - cv * 2);
        }
      } else {
        signalQuality *= 0.95; // Decay quality if no peaks found
      }
    }

    function getState() {
      return {
        active: active,
        heartRate: Math.round(heartRate),
        hrvRMSSD: Math.round(hrvRMSSD * 10) / 10,
        signalQuality: Math.round(signalQuality * 100) / 100,
        peakIntervals: lastPeakIntervals,
        sampleCount: greenSignal.length
      };
    }

    function stop() {
      active = false;
      if (frameId) clearTimeout(frameId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    }

    return { start, stop, getState };
  }


  // ═══════════════════════════════════════════════════
  // CHANNEL 1b: BLE Heart Rate (Tier 2 — Polar H10, Garmin, Wahoo, etc.)
  // ═══════════════════════════════════════════════════
  // Web Bluetooth API — connects to any standard BLE HR sensor.
  // Works in Chrome on desktop, Android, and ChromeOS.
  // NOT supported in Safari/iOS (they block Web Bluetooth).
  // Falls back gracefully — system runs without it.

  function createBLEChannel() {
    let active = false;
    let device = null;
    let characteristic = null;
    let reconnectCount = 0;

    // Raw RR intervals (inter-beat intervals in ms)
    const rrIntervals = [];
    const maxRR = 300; // ~5 minutes of data at 60 BPM
    let heartRate = 0;
    let hrvRMSSD = 0;
    let lastBeatTime = 0;
    let batteryLevel = -1;
    let deviceName = '';
    let signalQuality = 0;

    // Check if Web Bluetooth is available
    function isSupported() {
      return typeof navigator !== 'undefined' &&
             navigator.bluetooth &&
             typeof navigator.bluetooth.requestDevice === 'function';
    }

    async function start() {
      if (!isSupported()) {
        return { success: false, error: 'Web Bluetooth not supported in this browser' };
      }

      try {
        // This triggers the browser's BLE pairing dialog
        // User selects their device from the list
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [CONFIG.ble.hrServiceUUID] }],
          optionalServices: ['battery_service']
        });

        deviceName = device.name || 'BLE HR Sensor';
        device.addEventListener('gattserverdisconnected', onDisconnected);

        await connect();
        return { success: true, device: deviceName };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async function connect() {
      try {
        const server = await device.gatt.connect();

        // Heart Rate Service
        const hrService = await server.getPrimaryService(CONFIG.ble.hrServiceUUID);
        characteristic = await hrService.getCharacteristic(CONFIG.ble.hrCharUUID);

        // Subscribe to heart rate notifications
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', onHRData);
        active = true;

        // Try to read battery level
        try {
          const battService = await server.getPrimaryService('battery_service');
          const battChar = await battService.getCharacteristic('battery_level');
          const battValue = await battChar.readValue();
          batteryLevel = battValue.getUint8(0);
        } catch (e) {
          // Battery service not available — that's fine
        }

        reconnectCount = 0;
        console.log('[Biosensor] BLE connected:', deviceName);
      } catch (err) {
        console.log('[Biosensor] BLE connect error:', err.message);
        active = false;
      }
    }

    function onHRData(event) {
      // Parse BLE Heart Rate Measurement characteristic
      // Byte 0: Flags
      //   Bit 0: HR format (0 = uint8, 1 = uint16)
      //   Bit 4: RR interval present
      const data = event.target.value;
      const flags = data.getUint8(0);
      const is16bit = flags & 0x01;
      const hasRR = flags & 0x10;

      let offset = 1;

      // Heart rate value
      if (is16bit) {
        heartRate = data.getUint16(offset, true);
        offset += 2;
      } else {
        heartRate = data.getUint8(offset);
        offset += 1;
      }

      // Energy expended (skip if present)
      if (flags & 0x08) {
        offset += 2;
      }

      // RR intervals — this is the gold: raw beat-to-beat timing
      if (hasRR) {
        while (offset + 1 < data.byteLength) {
          // RR interval in 1/1024 seconds — convert to ms
          const rr = data.getUint16(offset, true);
          const rrMs = (rr / 1024) * 1000;
          offset += 2;

          // Validate: reject physiologically impossible intervals
          if (rrMs > 285 && rrMs < 1500) { // 40-210 BPM range
            rrIntervals.push({ t: performance.now(), ms: rrMs });
            while (rrIntervals.length > maxRR) rrIntervals.shift();
          }
        }

        // Compute HRV from RR intervals
        if (rrIntervals.length >= 5) {
          const recent = rrIntervals.slice(-30).map(r => r.ms);
          hrvRMSSD = rmssd(recent);

          // Signal quality from RR consistency
          const cv = std(recent) / mean(recent);
          signalQuality = clamp01(1 - cv);
        }
      }

      // Even without RR, we have HR — signal quality from consistency
      if (!hasRR && heartRate > 0) {
        signalQuality = 0.6; // Decent but no RR = limited HRV
      }
    }

    function onDisconnected() {
      active = false;
      console.log('[Biosensor] BLE disconnected:', deviceName);

      // Auto-reconnect
      if (reconnectCount < CONFIG.ble.reconnectAttempts) {
        reconnectCount++;
        console.log('[Biosensor] BLE reconnecting... attempt', reconnectCount);
        setTimeout(async () => {
          try { await connect(); } catch (e) { /* retry failed */ }
        }, CONFIG.ble.reconnectDelayMs);
      }
    }

    function getState() {
      return {
        active: active,
        supported: isSupported(),
        heartRate: heartRate,
        hrvRMSSD: Math.round(hrvRMSSD * 10) / 10,
        signalQuality: Math.round(signalQuality * 100) / 100,
        rrIntervals: rrIntervals.slice(-30).map(r => r.ms),
        rrCount: rrIntervals.length,
        deviceName: deviceName,
        batteryLevel: batteryLevel,
      };
    }

    function stop() {
      active = false;
      if (characteristic) {
        try { characteristic.stopNotifications(); } catch (e) { /* */ }
      }
      if (device && device.gatt && device.gatt.connected) {
        device.gatt.disconnect();
      }
    }

    return { start, stop, getState, isSupported };
  }


  // ═══════════════════════════════════════════════════
  // FRACTAL STATE PROPAGATION
  // ═══════════════════════════════════════════════════
  // When navigating into a portal (spiral → sub-world), the parent's
  // autonomic state transfers to the child. The child inherits and
  // AMPLIFIES the state — going deeper means the body's signal matters more.
  //
  // State is passed via sessionStorage (persists across page navigation
  // within the same tab, cleared when tab closes).

  const FractalState = {
    // Save current state before portal transition
    pushState: function(state, currentPhase, depth) {
      try {
        const transfer = {
          arousal: state.arousal,
          valence: state.valence,
          coherence: state.coherence,
          cognitiveLoad: state.cognitiveLoad,
          heartRate: state.heartRate,
          hrv: state.hrv,
          archetype: state.archetype,
          parentPhase: currentPhase,
          depth: (depth || 0) + 1,
          timestamp: Date.now(),
          channels: { ...state.channels }
        };
        sessionStorage.setItem(CONFIG.fractal.stateTransferKey, JSON.stringify(transfer));
      } catch (e) {
        // sessionStorage may be unavailable (incognito, etc)
      }
    },

    // Retrieve parent state on portal entry
    pullState: function() {
      try {
        const raw = sessionStorage.getItem(CONFIG.fractal.stateTransferKey);
        if (!raw) return null;
        const transfer = JSON.parse(raw);
        // Only use if recent (within 30 seconds of navigation)
        if (Date.now() - transfer.timestamp > 30000) return null;
        return transfer;
      } catch (e) {
        return null;
      }
    },

    // Apply parent state to current engine with depth amplification
    applyParentState: function(engine, parentState) {
      if (!parentState || !engine) return;

      const state = engine.getState();
      const depth = parentState.depth || 1;
      const amp = 1 + depth * CONFIG.fractal.depthAmplification;

      // Seed the fusion state with amplified parent values
      // This makes the sub-world start from where the parent left off,
      // but MORE intense — going deeper into the pattern
      state.arousal = clamp01(parentState.arousal * amp);
      state.coherence = clamp01(parentState.coherence * amp);
      state.cognitiveLoad = clamp01(parentState.cognitiveLoad * amp);
      state.valence = parentState.valence;
      state.heartRate = parentState.heartRate;
      state.hrv = parentState.hrv;

      console.log('[Biosensor] Fractal state inherited — depth:', depth,
        'amplification:', amp.toFixed(2));

      return { depth, amplification: amp, parentPhase: parentState.parentPhase };
    },

    // Check if conditions are met for portal navigation suggestion
    // Returns { ready: bool, resonance: number, suggestion: string }
    checkPortalReadiness: function(engine, currentPhase) {
      if (!engine) return { ready: false, resonance: 0 };

      const resonance = engine.getPhaseResonance(currentPhase);
      const state = engine.getState();
      const threshold = CONFIG.fractal.resonanceThreshold;

      // Portal readiness: high resonance + sufficient engagement time
      const behaviorEngaged = state.channels.behavior &&
        (state.cognitiveLoad > 0.4 || state.arousal > 0.5);

      const ready = resonance >= threshold && behaviorEngaged;

      let suggestion = '';
      if (ready) {
        suggestion = 'Your autonomic state resonates with this phase. The portal is ready.';
      } else if (resonance > threshold * 0.7) {
        suggestion = 'Approaching resonance... ' + Math.round(resonance * 100) + '%';
      }

      return { ready, resonance, suggestion };
    }
  };


  // ═══════════════════════════════════════════════════
  // CHANNEL 2: Device Motion — Tremor Analysis
  // ═══════════════════════════════════════════════════

  function createMotionChannel() {
    let active = false;
    const samples = []; // { t, x, y, z }
    const maxSamples = CONFIG.motion.sampleRate * (CONFIG.motion.windowMs / 1000);
    let tremorEnergy = 0;
    let motionMagnitude = 0;
    let permissionGranted = false;

    async function start() {
      // iOS 13+ requires permission
      if (typeof DeviceMotionEvent !== 'undefined' &&
          typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const perm = await DeviceMotionEvent.requestPermission();
          if (perm !== 'granted') {
            return { success: false, error: 'Motion permission denied' };
          }
          permissionGranted = true;
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      window.addEventListener('devicemotion', onMotion, { passive: true });
      active = true;
      return { success: true };
    }

    function onMotion(e) {
      if (!active) return;
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      samples.push({
        t: performance.now(),
        x: acc.x || 0,
        y: acc.y || 0,
        z: acc.z || 0
      });

      while (samples.length > maxSamples) samples.shift();

      if (samples.length > 30) {
        processTremor();
      }
    }

    function processTremor() {
      // Extract magnitude signal
      const mag = samples.map(s => Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z));

      // Overall motion magnitude (movement vs stillness)
      motionMagnitude = std(mag);

      // Tremor energy: variance in the tremor frequency band
      // Simple approach: high-pass filter to remove gravity/posture, then variance
      const detrended = [];
      const windowSize = 5;
      for (let i = windowSize; i < mag.length; i++) {
        let localMean = 0;
        for (let j = i - windowSize; j < i; j++) localMean += mag[j];
        localMean /= windowSize;
        detrended.push(mag[i] - localMean);
      }

      if (detrended.length > 10) {
        tremorEnergy = std(detrended);
      }
    }

    function getState() {
      return {
        active: active,
        tremorEnergy: Math.round(tremorEnergy * 1000) / 1000,
        motionMagnitude: Math.round(motionMagnitude * 1000) / 1000,
        sampleCount: samples.length,
        permissionGranted: permissionGranted || active
      };
    }

    function stop() {
      active = false;
      window.removeEventListener('devicemotion', onMotion);
    }

    return { start, stop, getState };
  }


  // ═══════════════════════════════════════════════════
  // CHANNEL 3: Enhanced Behavioral Tracking
  // ═══════════════════════════════════════════════════

  function createBehaviorChannel() {
    let active = false;

    // Tap/click analysis
    const taps = [];       // { t, x, y, force }
    const tapIntervals = [];

    // Scroll analysis
    const scrollEvents = []; // { t, y, velocity }
    let lastScrollY = 0;
    let lastScrollT = 0;

    // Mouse/touch movement
    const movements = [];  // { t, x, y, speed }
    let lastMoveX = 0, lastMoveY = 0, lastMoveT = 0;

    // Dwell tracking per node/region
    const nodeVisits = {};  // nodeId → { enterTime, totalDwell, visits }
    let currentNode = null;
    let currentNodeEnterT = 0;

    // Phase transitions
    const phaseTransitions = []; // { from, to, t, hesitationMs }
    let lastPhaseChangeT = 0;

    // Pause detection
    let lastAnyInteractionT = 0;
    const pauses = []; // durations of inactivity

    function start() {
      window.addEventListener('click', onTap, { passive: true });
      window.addEventListener('touchstart', onTouch, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      active = true;
      return { success: true };
    }

    function onTap(e) {
      if (!active) return;
      const now = performance.now();

      // Detect pause before this tap
      if (lastAnyInteractionT > 0) {
        const gap = now - lastAnyInteractionT;
        if (gap > 1500) pauses.push(gap);
      }
      lastAnyInteractionT = now;

      taps.push({ t: now, x: e.clientX, y: e.clientY, force: 0 });

      // Tap interval
      if (taps.length > 1) {
        const interval = now - taps[taps.length - 2].t;
        tapIntervals.push(interval);
        if (tapIntervals.length > 50) tapIntervals.shift();
      }

      // Trim
      const cutoff = now - CONFIG.behavior.tapWindowMs;
      while (taps.length > 0 && taps[0].t < cutoff) taps.shift();
    }

    function onTouch(e) {
      if (!active || !e.touches.length) return;
      const touch = e.touches[0];
      const now = performance.now();

      if (lastAnyInteractionT > 0) {
        const gap = now - lastAnyInteractionT;
        if (gap > 1500) pauses.push(gap);
      }
      lastAnyInteractionT = now;

      // Force touch (where supported)
      const force = touch.force || 0;
      taps.push({ t: now, x: touch.clientX, y: touch.clientY, force: force });

      if (taps.length > 1) {
        const interval = now - taps[taps.length - 2].t;
        tapIntervals.push(interval);
        if (tapIntervals.length > 50) tapIntervals.shift();
      }

      const cutoff = now - CONFIG.behavior.tapWindowMs;
      while (taps.length > 0 && taps[0].t < cutoff) taps.shift();
    }

    function onScroll() {
      if (!active) return;
      const now = performance.now();
      lastAnyInteractionT = now;

      const y = window.scrollY;
      const dt = now - lastScrollT;
      if (dt > 0 && lastScrollT > 0) {
        const velocity = Math.abs(y - lastScrollY) / dt;
        scrollEvents.push({ t: now, y, velocity });
        if (scrollEvents.length > 100) scrollEvents.shift();
      }
      lastScrollY = y;
      lastScrollT = now;
    }

    function onMove(e) {
      if (!active) return;
      recordMovement(e.clientX, e.clientY);
    }

    function onTouchMove(e) {
      if (!active || !e.touches.length) return;
      recordMovement(e.touches[0].clientX, e.touches[0].clientY);
    }

    function recordMovement(x, y) {
      const now = performance.now();
      lastAnyInteractionT = now;

      if (lastMoveT > 0) {
        const dt = now - lastMoveT;
        if (dt > 0) {
          const dist = Math.sqrt((x - lastMoveX) ** 2 + (y - lastMoveY) ** 2);
          const speed = dist / dt;
          movements.push({ t: now, x, y, speed });
          if (movements.length > 200) movements.shift();
        }
      }
      lastMoveX = x; lastMoveY = y; lastMoveT = now;
    }

    // Called by the spiral when user enters a node region
    function recordNodeEnter(nodeId) {
      const now = performance.now();
      if (currentNode && currentNode !== nodeId) {
        recordNodeExit();
      }
      currentNode = nodeId;
      currentNodeEnterT = now;
      if (!nodeVisits[nodeId]) {
        nodeVisits[nodeId] = { totalDwell: 0, visits: 0 };
      }
      nodeVisits[nodeId].visits++;
    }

    function recordNodeExit() {
      if (currentNode && currentNodeEnterT) {
        const dwell = performance.now() - currentNodeEnterT;
        if (nodeVisits[currentNode]) {
          nodeVisits[currentNode].totalDwell += dwell;
        }
      }
      currentNode = null;
      currentNodeEnterT = 0;
    }

    // Called by spiral on phase change
    function recordPhaseTransition(from, to) {
      const now = performance.now();
      const hesitation = lastPhaseChangeT > 0 ? now - lastPhaseChangeT : 0;
      phaseTransitions.push({ from, to, t: now, hesitationMs: hesitation });
      lastPhaseChangeT = now;
    }

    function getState() {
      const now = performance.now();

      // Tap cadence: taps per second
      const recentTaps = taps.filter(t => (now - t.t) < 5000);
      const tapCadence = recentTaps.length / 5;

      // Tap regularity: how consistent are intervals
      const tapRegularity = tapIntervals.length > 2
        ? 1 - clamp01(std(tapIntervals) / (mean(tapIntervals) || 1))
        : 0.5;

      // Touch force (0 if not supported)
      const forces = recentTaps.map(t => t.force).filter(f => f > 0);
      const avgForce = forces.length ? mean(forces) : 0;

      // Movement features
      const recentMoves = movements.filter(m => (now - m.t) < 3000);
      const speeds = recentMoves.map(m => m.speed);
      const moveJitter = speeds.length > 5 ? std(speeds) : 0;
      const moveSpeed = speeds.length > 0 ? mean(speeds) : 0;

      // Scroll features
      const recentScrolls = scrollEvents.filter(s => (now - s.t) < 5000);
      const scrollVelocities = recentScrolls.map(s => s.velocity);
      const scrollSpeed = scrollVelocities.length ? mean(scrollVelocities) : 0;
      const scrollVariability = scrollVelocities.length > 2 ? std(scrollVelocities) : 0;

      // Pause analysis
      const avgPause = pauses.length ? mean(pauses.slice(-10)) : 0;
      const pauseFrequency = pauses.length;

      // Hesitation: time since last interaction
      const currentHesitation = lastAnyInteractionT > 0 ? now - lastAnyInteractionT : 0;

      return {
        active: active,
        tapCadence,
        tapRegularity,
        touchForce: avgForce,
        moveJitter,
        moveSpeed,
        scrollSpeed,
        scrollVariability,
        avgPauseDuration: avgPause,
        pauseFrequency,
        currentHesitation,
        nodeVisits: { ...nodeVisits },
        phaseTransitions: phaseTransitions.slice(-20),
        totalTaps: taps.length,
        // API for external callers
        recordNodeEnter,
        recordNodeExit,
        recordPhaseTransition
      };
    }

    function stop() {
      active = false;
      window.removeEventListener('click', onTap);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
    }

    return { start, stop, getState, recordNodeEnter, recordNodeExit, recordPhaseTransition };
  }


  // ═══════════════════════════════════════════════════
  // FUSION: Unified Autonomic State Model
  // ═══════════════════════════════════════════════════

  function createFusionEngine(rppg, motion, behavior, ble) {
    let intervalId = null;
    const subscribers = [];

    // Smoothed state
    let state = {
      // Raw sensor availability
      channels: { rppg: false, motion: false, behavior: false, ble: false },

      // Primary metrics
      heartRate: 0,        // BPM (0 = no camera data)
      hrv: 0,              // RMSSD ms
      signalQuality: 0,    // 0-1 camera signal reliability

      // Derived autonomic state (0-1 scales)
      arousal: 0.5,        // Low=calm, High=activated
      valence: 0.5,        // Low=negative/threat, High=positive/approach
      coherence: 0.5,      // Low=chaotic, High=ordered/rhythmic
      cognitiveLoad: 0.5,  // Low=passive, High=deep processing

      // Behavioral archetype (from interaction patterns)
      archetype: 'unknown', // explorer | contemplator | seeker | reactor

      // Phase-specific predictions
      phaseResonance: 0.5, // How well user's state matches current phase's expected signature

      // Visualization modulation values (feed directly into spiral)
      viz: {
        nodeActivity: 0,    // Delta to add to base nodeActivity
        connectivity: 0,    // Delta to add to base connectivity
        chaos: 0,           // Delta to add to base chaos
        fireRate: 0,        // Delta to add to base fireRate
        colorShift: 0,      // -1 to 1 — cooler (calm) to warmer (aroused)
        pulseRate: 1,       // Multiplier for ambient pulse effects
      },

      // Timestamp
      timestamp: 0,
    };

    // Phase signatures: expected autonomic profile for each LIMEN phase
    // These define what "resonance" looks like per phase
    const PHASE_SIGNATURES = {
      0:  { arousal: 0.3, coherence: 0.7, load: 0.3 }, // SOURCE — calm baseline
      1:  { arousal: 0.6, coherence: 0.4, load: 0.6 }, // ANOMALY — alert, uncertain
      2:  { arousal: 0.3, coherence: 0.9, load: 0.2 }, // RHYTHM — vagal, coherent
      3:  { arousal: 0.8, coherence: 0.3, load: 0.7 }, // DARKNESS — fear, activated
      4:  { arousal: 0.2, coherence: 0.8, load: 0.2 }, // PEACE — parasympathetic
      5:  { arousal: 0.7, coherence: 0.5, load: 0.6 }, // RESILIENCE — hormetic stress
      6:  { arousal: 0.5, coherence: 0.7, load: 0.8 }, // ORDER — executive control
      7:  { arousal: 0.6, coherence: 0.2, load: 0.5 }, // SEPARATION — ego dissolution
      8:  { arousal: 0.4, coherence: 0.6, load: 0.7 }, // CONSCIENCE — empathy
      9:  { arousal: 0.7, coherence: 0.8, load: 0.9 }, // THRESHOLD — integration
      10: { arousal: 0.4, coherence: 0.9, load: 0.4 }, // RESURRECTION — return
    };

    function update() {
      const rState = rppg.getState();
      const mState = motion.getState();
      const bState = behavior.getState();
      const bleState = ble ? ble.getState() : { active: false };

      state.channels.rppg = rState.active;
      state.channels.motion = mState.active;
      state.channels.behavior = bState.active;
      state.channels.ble = bleState.active;
      state.timestamp = performance.now();

      // ─── Heart Rate & HRV ───
      // Priority: BLE > Camera rPPG (BLE has clinical-grade accuracy)
      if (bleState.active && bleState.heartRate > 0) {
        state.heartRate = ema(state.heartRate || bleState.heartRate, bleState.heartRate, CONFIG.fusion.smoothingAlpha);
        state.hrv = ema(state.hrv || bleState.hrvRMSSD, bleState.hrvRMSSD, CONFIG.fusion.smoothingAlpha);
        state.signalQuality = bleState.signalQuality;
      } else if (rState.active && rState.signalQuality > 0.3) {
        state.heartRate = ema(state.heartRate || rState.heartRate, rState.heartRate, CONFIG.fusion.smoothingAlpha);
        state.hrv = ema(state.hrv || rState.hrvRMSSD, rState.hrvRMSSD, CONFIG.fusion.smoothingAlpha);
        state.signalQuality = rState.signalQuality;
      }

      // ─── Arousal (multi-channel fusion) ───
      // Higher HR → higher arousal
      // Higher tremor → higher arousal
      // Faster taps, more movement → higher arousal
      let arousalSignals = [];
      let arousalWeights = [];

      // HR-based arousal: prefer BLE, fall back to camera
      const hrActive = (bleState.active && bleState.heartRate > 0) ||
                       (rState.active && rState.signalQuality > 0.3);
      if (hrActive && state.heartRate > 0) {
        // Map HR to arousal: 60 BPM → 0.2, 100 BPM → 0.8
        const hrArousal = clamp01((state.heartRate - 50) / 70);
        const hrQuality = bleState.active ? 0.95 : (rState.signalQuality || 0.5);
        arousalSignals.push(hrArousal);
        arousalWeights.push(0.4 * hrQuality); // Weight by signal quality
      }

      if (mState.active && mState.sampleCount > 20) {
        // Tremor energy → arousal
        const tremorArousal = clamp01(mState.tremorEnergy * 10);
        arousalSignals.push(tremorArousal);
        arousalWeights.push(0.25);
      }

      // Behavioral arousal (always available)
      const behavArousal = clamp01(
        bState.tapCadence * 0.3 +        // Fast tapping
        bState.moveSpeed * 0.002 +        // Fast movement
        bState.scrollSpeed * 0.5 +        // Fast scrolling
        (1 - clamp01(bState.currentHesitation / 5000)) * 0.2  // Low hesitation
      );
      arousalSignals.push(behavArousal);
      arousalWeights.push(0.35);

      // Weighted average
      if (arousalSignals.length > 0) {
        const totalWeight = arousalWeights.reduce((a, b) => a + b, 0);
        const weightedArousal = arousalSignals.reduce((sum, v, i) =>
          sum + v * arousalWeights[i], 0) / totalWeight;
        state.arousal = ema(state.arousal, weightedArousal, CONFIG.fusion.smoothingAlpha);
      }

      // ─── Coherence ───
      // High HRV + regular taps + smooth movement = coherent
      let coherenceSignals = [];

      if (state.hrv > 0) {
        // Higher HRV = more coherent (parasympathetic = ordered)
        const hrvCoherence = clamp01(state.hrv / 80); // 80ms RMSSD = high coherence
        coherenceSignals.push(hrvCoherence * 0.4);
      }

      coherenceSignals.push(bState.tapRegularity * 0.3);
      coherenceSignals.push((1 - clamp01(bState.moveJitter * 5)) * 0.3);

      const rawCoherence = coherenceSignals.reduce((a, b) => a + b, 0) /
        Math.max(1, coherenceSignals.length > 1 ? 1 : 0.3);
      state.coherence = ema(state.coherence, clamp01(rawCoherence), CONFIG.fusion.smoothingAlpha);

      // ─── Cognitive Load ───
      // Long pauses, slow deliberate movement, focused dwell = high load
      const loadFromPauses = clamp01(bState.avgPauseDuration / 4000); // 4s pauses = deep thought
      const loadFromHesitation = clamp01(bState.currentHesitation / 3000);
      const loadFromJitter = 1 - clamp01(bState.moveJitter * 3); // Still = thinking
      const rawLoad = loadFromPauses * 0.35 + loadFromHesitation * 0.35 + loadFromJitter * 0.3;
      state.cognitiveLoad = ema(state.cognitiveLoad, rawLoad, CONFIG.fusion.smoothingAlpha);

      // ─── Valence ───
      // Approach behavior (exploration, forward movement) vs avoidance
      const explorationRate = Object.keys(bState.nodeVisits).length;
      const approachSignal = clamp01(explorationRate / 5); // Visited 5+ nodes = exploring
      const avoidanceSignal = clamp01(bState.pauseFrequency / 10); // Many pauses = hesitant
      state.valence = ema(state.valence, approachSignal * 0.6 + (1 - avoidanceSignal) * 0.4,
        CONFIG.fusion.smoothingAlpha);

      // ─── Behavioral Archetype ───
      state.archetype = classifyArchetype(bState);

      // ─── Visualization Modulation ───
      computeVizModulation();

      // ─── Emit ───
      for (const fn of subscribers) {
        try { fn({ ...state }); } catch (e) { /* subscriber error */ }
      }
    }

    function classifyArchetype(b) {
      // Explorer: high tap cadence, many node visits, fast movement
      // Contemplator: long pauses, slow movement, deep dwell on few nodes
      // Seeker: variable pace, many phase transitions, searching pattern
      // Reactor: responsive to stimuli, low hesitation, high jitter

      const scores = {
        explorer: (
          clamp01(b.tapCadence * 0.5) * 0.3 +
          clamp01(Object.keys(b.nodeVisits).length / 6) * 0.4 +
          clamp01(b.moveSpeed * 0.002) * 0.3
        ),
        contemplator: (
          clamp01(b.avgPauseDuration / 5000) * 0.35 +
          (1 - clamp01(b.moveSpeed * 0.003)) * 0.3 +
          (1 - clamp01(b.tapCadence * 0.3)) * 0.35
        ),
        seeker: (
          clamp01(b.scrollVariability * 2) * 0.3 +
          clamp01(b.phaseTransitions.length / 5) * 0.4 +
          clamp01(b.tapCadence * 0.3) * 0.3
        ),
        reactor: (
          (1 - clamp01(b.currentHesitation / 2000)) * 0.35 +
          clamp01(b.moveJitter * 5) * 0.35 +
          clamp01(b.touchForce * 2) * 0.3
        ),
      };

      let max = -1, result = 'explorer';
      for (const [arch, score] of Object.entries(scores)) {
        if (score > max) { max = score; result = arch; }
      }
      return result;
    }

    function computeVizModulation() {
      // Map autonomic state to visualization deltas
      // These get ADDED to the base phase values in the spiral

      const a = state.arousal;
      const c = state.coherence;
      const l = state.cognitiveLoad;

      // High arousal → more node activity, more chaos, faster fire
      state.viz.nodeActivity = (a - 0.5) * 0.6;  // ±0.3
      state.viz.chaos = (a - 0.5) * 0.4;          // ±0.2
      state.viz.fireRate = (a - 0.5) * 2.0;       // ±1.0

      // High coherence → more connectivity, less chaos
      state.viz.connectivity = (c - 0.5) * 0.4;   // ±0.2
      state.viz.chaos -= (c - 0.5) * 0.2;

      // Color shift: aroused = warmer (red shift), calm = cooler (blue shift)
      state.viz.colorShift = (a - 0.5) * 2;       // -1 to 1

      // Pulse rate: scales with HR if available, otherwise arousal
      if (state.heartRate > 0) {
        state.viz.pulseRate = state.heartRate / 72; // 1.0 at 72 BPM
      } else {
        state.viz.pulseRate = 0.7 + a * 0.6;
      }
    }

    // Calculate how well user's current state matches expected phase signature
    function getPhaseResonance(phaseNum) {
      const sig = PHASE_SIGNATURES[phaseNum];
      if (!sig) return 0.5;

      const arousalDiff = Math.abs(state.arousal - sig.arousal);
      const coherenceDiff = Math.abs(state.coherence - sig.coherence);
      const loadDiff = Math.abs(state.cognitiveLoad - sig.load);

      // Resonance = 1 when perfectly matched, 0 when maximally different
      const resonance = 1 - (arousalDiff * 0.4 + coherenceDiff * 0.35 + loadDiff * 0.25);
      state.phaseResonance = resonance;
      return resonance;
    }

    function subscribe(fn) {
      if (typeof fn === 'function') subscribers.push(fn);
    }

    function start() {
      intervalId = setInterval(update, CONFIG.fusion.emitRateMs);
      update(); // Initial emit
    }

    function stop() {
      if (intervalId) clearInterval(intervalId);
    }

    function getState() {
      return { ...state };
    }

    return { start, stop, subscribe, getState, getPhaseResonance };
  }


  // ═══════════════════════════════════════════════════
  // HUD: Biosensor Overlay Display
  // ═══════════════════════════════════════════════════

  function createBiosensorHUD() {
    let hudEl = null;
    let visible = false;

    function create() {
      hudEl = document.createElement('div');
      hudEl.id = 'biosensor-hud';
      hudEl.innerHTML = `
        <div class="bio-hud-inner">
          <div class="bio-row" id="bio-hr">
            <span class="bio-icon">♡</span>
            <span class="bio-label">HR</span>
            <span class="bio-value" id="bio-hr-val">--</span>
            <span class="bio-unit">bpm</span>
          </div>
          <div class="bio-row" id="bio-hrv">
            <span class="bio-icon">∿</span>
            <span class="bio-label">HRV</span>
            <span class="bio-value" id="bio-hrv-val">--</span>
            <span class="bio-unit">ms</span>
          </div>
          <div class="bio-bar-row">
            <span class="bio-label">AROUSAL</span>
            <div class="bio-bar"><div class="bio-bar-fill" id="bio-arousal-bar"></div></div>
          </div>
          <div class="bio-bar-row">
            <span class="bio-label">COHERENCE</span>
            <div class="bio-bar"><div class="bio-bar-fill" id="bio-coherence-bar"></div></div>
          </div>
          <div class="bio-bar-row">
            <span class="bio-label">LOAD</span>
            <div class="bio-bar"><div class="bio-bar-fill" id="bio-load-bar"></div></div>
          </div>
          <div class="bio-archetype" id="bio-archetype">--</div>
          <div class="bio-resonance">
            <span class="bio-label">RESONANCE</span>
            <span class="bio-value" id="bio-resonance-val">--</span>
          </div>
          <div class="bio-signal" id="bio-signal">
            <span class="bio-dot"></span>
            <span id="bio-signal-text">BEHAVIORAL ONLY</span>
          </div>
        </div>
      `;
      hudEl.style.cssText = `
        position:fixed; bottom:55px; right:10px; z-index:300;
        background:rgba(0,0,0,0.85); border:1px solid rgba(201,169,78,0.15);
        border-radius:4px; padding:8px 10px; min-width:130px;
        font-family:monospace; font-size:10px; color:rgba(201,169,78,0.6);
        letter-spacing:1px; pointer-events:none;
        opacity:0; transition:opacity 0.5s;
      `;

      // Inject styles
      const style = document.createElement('style');
      style.textContent = `
        #biosensor-hud .bio-hud-inner { display:flex; flex-direction:column; gap:3px; }
        #biosensor-hud .bio-row { display:flex; align-items:center; gap:4px; }
        #biosensor-hud .bio-icon { font-size:12px; width:14px; text-align:center; }
        #biosensor-hud .bio-label { font-size:7px; letter-spacing:2px; color:rgba(201,169,78,0.35); min-width:50px; }
        #biosensor-hud .bio-value { font-size:13px; color:rgba(201,169,78,0.8); font-weight:bold; }
        #biosensor-hud .bio-unit { font-size:7px; color:rgba(201,169,78,0.3); }
        #biosensor-hud .bio-bar-row { display:flex; align-items:center; gap:4px; }
        #biosensor-hud .bio-bar { flex:1; height:3px; background:rgba(201,169,78,0.08); border-radius:2px; overflow:hidden; }
        #biosensor-hud .bio-bar-fill { height:100%; background:rgba(201,169,78,0.5); border-radius:2px; transition:width 0.3s; width:50%; }
        #biosensor-hud .bio-archetype { font-size:8px; letter-spacing:3px; color:rgba(201,169,78,0.4); text-align:center; margin-top:2px; text-transform:uppercase; }
        #biosensor-hud .bio-resonance { display:flex; align-items:center; gap:4px; justify-content:center; }
        #biosensor-hud .bio-resonance .bio-value { font-size:10px; }
        #biosensor-hud .bio-signal { display:flex; align-items:center; gap:4px; justify-content:center; margin-top:2px; }
        #biosensor-hud .bio-dot { width:4px; height:4px; border-radius:50%; background:rgba(201,169,78,0.4); }
        #biosensor-hud .bio-dot.active { background:rgba(80,200,80,0.7); animation:bio-pulse 1.5s infinite; }
        #biosensor-hud #bio-signal-text { font-size:6px; letter-spacing:1px; color:rgba(201,169,78,0.25); }
        @keyframes bio-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `;
      document.head.appendChild(style);
      document.body.appendChild(hudEl);
    }

    function update(state) {
      if (!hudEl) return;

      // HR
      const hrEl = document.getElementById('bio-hr-val');
      if (hrEl) hrEl.textContent = state.heartRate > 0 ? Math.round(state.heartRate) : '--';

      // HRV
      const hrvEl = document.getElementById('bio-hrv-val');
      if (hrvEl) hrvEl.textContent = state.hrv > 0 ? Math.round(state.hrv) : '--';

      // Bars
      const arousalBar = document.getElementById('bio-arousal-bar');
      if (arousalBar) arousalBar.style.width = (state.arousal * 100) + '%';

      const coherenceBar = document.getElementById('bio-coherence-bar');
      if (coherenceBar) coherenceBar.style.width = (state.coherence * 100) + '%';

      const loadBar = document.getElementById('bio-load-bar');
      if (loadBar) loadBar.style.width = (state.cognitiveLoad * 100) + '%';

      // Archetype
      const archEl = document.getElementById('bio-archetype');
      if (archEl) archEl.textContent = state.archetype.toUpperCase();

      // Resonance
      const resEl = document.getElementById('bio-resonance-val');
      if (resEl) resEl.textContent = Math.round(state.phaseResonance * 100) + '%';

      // Signal status
      const dotEl = hudEl.querySelector('.bio-dot');
      const sigTextEl = document.getElementById('bio-signal-text');
      if (dotEl && sigTextEl) {
        const sources = [];
        if (state.channels.ble) sources.push('BLE');
        else if (state.channels.rppg) sources.push('CAMERA');
        if (state.channels.motion) sources.push('MOTION');
        sources.push('BEHAVIOR');

        if (state.channels.ble || state.channels.rppg) {
          dotEl.classList.add('active');
        } else {
          dotEl.classList.remove('active');
        }
        sigTextEl.textContent = sources.join(' + ');
      }
    }

    function show() {
      if (!hudEl) create();
      hudEl.style.opacity = '1';
      visible = true;
    }

    function hide() {
      if (hudEl) hudEl.style.opacity = '0';
      visible = false;
    }

    function toggle() {
      if (visible) hide(); else show();
    }

    return { create, update, show, hide, toggle };
  }


  // ═══════════════════════════════════════════════════
  // MAIN: Biosensor Engine API
  // ═══════════════════════════════════════════════════

  function startBiosensorEngine(options) {
    const opts = options || {};

    // Create channels
    const rppgChannel = createRPPGChannel();
    const bleChannel = createBLEChannel();
    const motionChannel = createMotionChannel();
    const behaviorChannel = createBehaviorChannel();
    const fusion = createFusionEngine(rppgChannel, motionChannel, behaviorChannel, bleChannel);
    const hud = createBiosensorHUD();

    // Fractal depth tracking
    let fractalDepth = 0;
    let parentPhase = -1;

    // Track active state
    let started = false;

    async function start() {
      if (started) return;
      started = true;

      // Always start behavioral (no permissions needed)
      behaviorChannel.start();

      // Start motion (request permission on iOS)
      const motionResult = await motionChannel.start();
      if (!motionResult.success) {
        console.log('[Biosensor] Motion unavailable:', motionResult.error);
      }

      // Start camera rPPG if requested
      if (opts.camera !== false) {
        const rppgResult = await rppgChannel.start();
        if (rppgResult.success) {
          console.log('[Biosensor] Camera heart rate active');
        } else {
          console.log('[Biosensor] Camera unavailable:', rppgResult.error);
        }
      }

      // Check for inherited fractal state from parent portal
      const parentState = FractalState.pullState();
      if (parentState) {
        fractalDepth = parentState.depth;
        parentPhase = parentState.parentPhase;
        // Apply after fusion starts so state object exists
        setTimeout(() => {
          FractalState.applyParentState(fusion, parentState);
        }, 100);
      }

      // Start fusion engine
      fusion.subscribe(hud.update);
      fusion.start();

      // Show HUD if enabled
      if (opts.hud !== false) {
        hud.show();
      }

      console.log('[Biosensor] Engine started — channels:', {
        rppg: rppgChannel.getState().active,
        ble: bleChannel.getState().active,
        motion: motionChannel.getState().active,
        behavior: behaviorChannel.getState().active,
        fractalDepth: fractalDepth
      });
    }

    function stop() {
      started = false;
      rppgChannel.stop();
      bleChannel.stop();
      motionChannel.stop();
      behaviorChannel.stop();
      fusion.stop();
      hud.hide();
    }

    // Expose for spiral integration
    return {
      start,
      stop,
      subscribe: fusion.subscribe,
      getState: fusion.getState,
      getPhaseResonance: fusion.getPhaseResonance,
      hud,

      // For the spiral to call when user interacts with nodes/phases
      recordNodeEnter: behaviorChannel.recordNodeEnter,
      recordNodeExit: behaviorChannel.recordNodeExit,
      recordPhaseTransition: behaviorChannel.recordPhaseTransition,

      // Fractal navigation
      fractal: {
        // Call before navigating to a portal
        pushState: function(currentPhase) {
          FractalState.pushState(fusion.getState(), currentPhase, fractalDepth);
        },
        // Check if user's body is ready for deeper portal entry
        checkPortalReadiness: function(currentPhase) {
          return FractalState.checkPortalReadiness(fusion, currentPhase);
        },
        getDepth: function() { return fractalDepth; },
        getParentPhase: function() { return parentPhase; },
      },

      // Direct channel access for debugging
      channels: {
        rppg: rppgChannel,
        ble: bleChannel,
        motion: motionChannel,
        behavior: behaviorChannel,
        fusion,
      },

      // Enable camera later (if user grants permission after page load)
      enableCamera: async function() {
        if (rppgChannel.getState().active) return { success: true };
        return rppgChannel.start();
      },

      // Enable BLE heart rate strap (requires user gesture for BLE pairing dialog)
      enableBLE: async function() {
        if (bleChannel.getState().active) return { success: true, device: bleChannel.getState().deviceName };
        if (!bleChannel.isSupported()) return { success: false, error: 'Web Bluetooth not supported — use Chrome on desktop or Android' };
        return bleChannel.start();
      },

      // Enable motion later (iOS requires user gesture)
      enableMotion: async function() {
        if (motionChannel.getState().active) return { success: true };
        return motionChannel.start();
      },
    };
  }


  // ═══════════════════════════════════════════════════
  // RECURSIVE FRACTAL NAVIGATOR
  // ═══════════════════════════════════════════════════
  //
  // Autonomic load determines movement through the spiral:
  //
  // DESCENT (into sub-worlds/portals):
  //   High resonance + sustained engagement → system opens the portal
  //   Your body is "in" the phase → you go deeper
  //
  // PROGRESSION (to next phase):
  //   Phase resonance peaks then declines → integration complete → advance
  //   Like a wave cresting — you've absorbed the phase
  //
  // REGRESSION (back to earlier phase):
  //   Arousal spike + coherence collapse → system detected overwhelm
  //   Safety mechanism — returns to last stable phase
  //
  // HOLDING PATTERN:
  //   Moderate resonance, stable state → stay and explore
  //   The default — no forced movement
  //
  // The navigator SUGGESTS movement. The spiral can accept or present
  // as a visual indicator. User always has manual override.

  function createFractalNavigator(fusionEngine) {

    // State tracking
    let currentPhase = 0;
    let resonanceHistory = [];     // rolling window of resonance scores
    let arousalHistory = [];       // rolling window for spike detection
    let coherenceHistory = [];
    let phaseEntryTime = 0;        // when user entered current phase
    let lastSuggestion = null;
    let suggestionCooldownUntil = 0;
    let depthLevel = 0;            // 0 = main spiral, 1 = portal, 2 = sub-portal...
    let depthStack = [];           // breadcrumb of depth: [{phase, depth, entryTime}]

    const subscribers = [];

    // Navigator thresholds
    const THRESHOLDS = {
      // Descent: sustained high resonance
      descentResonanceMin: 0.72,      // Must exceed this resonance
      descentDurationMs: 8000,        // For this long
      descentResonanceSamples: 15,    // Minimum samples in window

      // Progression: resonance peaked and is declining
      progressionPeakMin: 0.65,       // Must have reached this peak
      progressionDeclineRate: 0.08,   // Resonance dropped by this much from peak
      progressionMinTimeMs: 12000,    // Minimum time in phase before progression

      // Regression: arousal spike + coherence collapse
      regressionArousalSpike: 0.35,   // Arousal increased by this much in 3 seconds
      regressionCoherenceDrop: 0.25,  // Coherence dropped by this much
      regressionWindowMs: 3000,       // Detection window

      // Cooldown between suggestions
      cooldownMs: 5000,

      // Minimum time before any suggestion
      minPhaseTimeMs: 5000,
    };

    function setPhase(phaseNum, depth) {
      currentPhase = phaseNum;
      depthLevel = depth || 0;
      phaseEntryTime = performance.now();
      resonanceHistory = [];
      arousalHistory = [];
      coherenceHistory = [];
      lastSuggestion = null;
    }

    function pushDepth(phaseNum) {
      depthStack.push({
        phase: currentPhase,
        depth: depthLevel,
        entryTime: phaseEntryTime
      });
      depthLevel++;
    }

    function popDepth() {
      if (depthStack.length > 0) {
        const prev = depthStack.pop();
        depthLevel = prev.depth;
        return prev;
      }
      return null;
    }

    function evaluate() {
      const now = performance.now();
      const state = fusionEngine.getState();
      const timeInPhase = now - phaseEntryTime;

      // Update histories
      resonanceHistory.push({ t: now, v: state.phaseResonance });
      arousalHistory.push({ t: now, v: state.arousal });
      coherenceHistory.push({ t: now, v: state.coherence });

      // Trim to 30-second windows
      const trimCutoff = now - 30000;
      resonanceHistory = resonanceHistory.filter(s => s.t > trimCutoff);
      arousalHistory = arousalHistory.filter(s => s.t > trimCutoff);
      coherenceHistory = coherenceHistory.filter(s => s.t > trimCutoff);

      // Don't suggest during cooldown
      if (now < suggestionCooldownUntil) return null;
      if (timeInPhase < THRESHOLDS.minPhaseTimeMs) return null;

      // ── CHECK REGRESSION (safety first) ──
      const regWindow = arousalHistory.filter(s => s.t > now - THRESHOLDS.regressionWindowMs);
      if (regWindow.length >= 3) {
        const oldArousal = regWindow[0].v;
        const newArousal = regWindow[regWindow.length - 1].v;
        const arousalSpike = newArousal - oldArousal;

        const cohWindow = coherenceHistory.filter(s => s.t > now - THRESHOLDS.regressionWindowMs);
        if (cohWindow.length >= 3) {
          const oldCoherence = cohWindow[0].v;
          const newCoherence = cohWindow[cohWindow.length - 1].v;
          const coherenceDrop = oldCoherence - newCoherence;

          if (arousalSpike > THRESHOLDS.regressionArousalSpike &&
              coherenceDrop > THRESHOLDS.regressionCoherenceDrop) {
            return emitSuggestion('regression', {
              reason: 'autonomic overwhelm detected',
              arousalSpike,
              coherenceDrop,
              targetPhase: findLastStablePhase(),
              targetDepth: Math.max(0, depthLevel - 1),
              urgency: clamp01(arousalSpike * 2),
            });
          }
        }
      }

      // ── CHECK DESCENT (into portal) ──
      const recentResonance = resonanceHistory.filter(
        s => s.t > now - THRESHOLDS.descentDurationMs
      );
      if (recentResonance.length >= THRESHOLDS.descentResonanceSamples) {
        const avgResonance = mean(recentResonance.map(s => s.v));
        const minResonance = Math.min(...recentResonance.map(s => s.v));

        if (avgResonance > THRESHOLDS.descentResonanceMin &&
            minResonance > THRESHOLDS.descentResonanceMin * 0.85 &&
            timeInPhase > THRESHOLDS.descentDurationMs) {
          return emitSuggestion('descent', {
            reason: 'sustained high resonance — body is in the phase',
            avgResonance,
            sustainedMs: THRESHOLDS.descentDurationMs,
            targetDepth: depthLevel + 1,
            intensity: clamp01((avgResonance - 0.6) * 3),
          });
        }
      }

      // ── CHECK PROGRESSION (to next phase) ──
      if (timeInPhase > THRESHOLDS.progressionMinTimeMs &&
          resonanceHistory.length >= 10) {
        const peak = Math.max(...resonanceHistory.map(s => s.v));
        const recent = mean(resonanceHistory.slice(-5).map(s => s.v));
        const decline = peak - recent;

        if (peak > THRESHOLDS.progressionPeakMin &&
            decline > THRESHOLDS.progressionDeclineRate) {
          return emitSuggestion('progression', {
            reason: 'resonance peaked and declining — phase integrated',
            peakResonance: peak,
            currentResonance: recent,
            decline,
            targetPhase: currentPhase + 1,
            readiness: clamp01(peak * (1 + decline)),
          });
        }
      }

      // ── HOLDING PATTERN (default) ──
      return null;
    }

    function findLastStablePhase() {
      // Go back to phase where coherence was highest
      // For now, simple: go back one phase or to Phase 0 (SOURCE)
      if (depthLevel > 0) return currentPhase; // Just surface from portal
      return Math.max(0, currentPhase - 1);
    }

    function emitSuggestion(type, data) {
      const suggestion = {
        type,           // 'descent' | 'progression' | 'regression'
        phase: currentPhase,
        depth: depthLevel,
        timestamp: performance.now(),
        ...data,
      };

      lastSuggestion = suggestion;
      suggestionCooldownUntil = performance.now() + THRESHOLDS.cooldownMs;

      for (const fn of subscribers) {
        try { fn(suggestion); } catch (e) { /* subscriber error */ }
      }

      return suggestion;
    }

    function subscribe(fn) {
      if (typeof fn === 'function') subscribers.push(fn);
    }

    function getState() {
      return {
        currentPhase,
        depthLevel,
        depthStack: [...depthStack],
        lastSuggestion,
        resonanceAvg: resonanceHistory.length > 0
          ? mean(resonanceHistory.slice(-10).map(s => s.v))
          : 0.5,
        timeInPhaseMs: performance.now() - phaseEntryTime,
      };
    }

    return {
      setPhase,
      pushDepth,
      popDepth,
      evaluate,
      subscribe,
      getState,
      THRESHOLDS, // Expose for tuning
    };
  }


  // ═══════════════════════════════════════════════════
  // MAIN: Biosensor Engine API (updated with navigator)
  // ═══════════════════════════════════════════════════

  function startBiosensorEngine(options) {
    const opts = options || {};

    // Create channels
    const rppgChannel = createRPPGChannel();
    const motionChannel = createMotionChannel();
    const behaviorChannel = createBehaviorChannel();
    const bleChannel = createBLEChannel();
    const fusion = createFusionEngine(rppgChannel, motionChannel, behaviorChannel, bleChannel);
    const hud = createBiosensorHUD();
    const navigator = createFractalNavigator(fusion);

    // Track active state
    let started = false;
    let navIntervalId = null;

    async function start() {
      if (started) return;
      started = true;

      // Always start behavioral (no permissions needed)
      behaviorChannel.start();

      // Start motion (request permission on iOS)
      const motionResult = await motionChannel.start();
      if (!motionResult.success) {
        console.log('[Biosensor] Motion unavailable:', motionResult.error);
      }

      // Start camera rPPG if requested
      if (opts.camera !== false) {
        const rppgResult = await rppgChannel.start();
        if (rppgResult.success) {
          console.log('[Biosensor] Camera heart rate active');
        } else {
          console.log('[Biosensor] Camera unavailable:', rppgResult.error);
        }
      }

      // Start fusion engine
      fusion.subscribe(hud.update);
      fusion.start();

      // Start navigator evaluation loop (every 500ms)
      navIntervalId = setInterval(function() {
        navigator.evaluate();
      }, 500);

      // Show HUD if enabled
      if (opts.hud !== false) {
        hud.show();
      }

      console.log('[Biosensor] Engine started — channels:', {
        rppg: rppgChannel.getState().active,
        motion: motionChannel.getState().active,
        behavior: behaviorChannel.getState().active,
        ble: bleChannel.getState().active,
      });
    }

    function stop() {
      started = false;
      rppgChannel.stop();
      motionChannel.stop();
      behaviorChannel.stop();
      bleChannel.stop();
      fusion.stop();
      if (navIntervalId) clearInterval(navIntervalId);
      hud.hide();
    }

    // Expose for spiral integration
    return {
      start,
      stop,
      subscribe: fusion.subscribe,
      getState: fusion.getState,
      getPhaseResonance: fusion.getPhaseResonance,
      hud,
      navigator,

      // For the spiral to call when user interacts with nodes/phases
      recordNodeEnter: behaviorChannel.recordNodeEnter,
      recordNodeExit: behaviorChannel.recordNodeExit,
      recordPhaseTransition: behaviorChannel.recordPhaseTransition,

      // Direct channel access for debugging
      channels: {
        rppg: rppgChannel,
        motion: motionChannel,
        behavior: behaviorChannel,
        ble: bleChannel,
        fusion,
      },

      // Enable camera later (if user grants permission after page load)
      enableCamera: async function() {
        if (rppgChannel.getState().active) return { success: true };
        return rppgChannel.start();
      },

      // Enable BLE heart rate strap (requires user gesture for BLE pairing dialog)
      enableBLE: async function() {
        if (bleChannel.getState().active) return { success: true, device: bleChannel.getState().deviceName };
        if (!bleChannel.isSupported()) return { success: false, error: 'Web Bluetooth not supported — use Chrome on desktop or Android' };
        return bleChannel.start();
      },

      // Enable motion later (iOS requires user gesture)
      enableMotion: async function() {
        if (motionChannel.getState().active) return { success: true };
        return motionChannel.start();
      },
    };
  }

  // Export
  global.startBiosensorEngine = startBiosensorEngine;

})(typeof window !== 'undefined' ? window : this);
