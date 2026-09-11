/* ================= SMASH BRO : utilities ================= */
(function (w) {
  'use strict';
  var SB = w.SB = w.SB || {};

  /* ---------- math ---------- */
  SB.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SB.lerp = function (a, b, t) { return a + (b - a) * t; };
  SB.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  SB.rand = function (a, b) { return a + Math.random() * (b - a); };
  SB.randi = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  SB.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  SB.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  SB.approach = function (v, t, d) { return v < t ? Math.min(v + d, t) : Math.max(v - d, t); };
  SB.RAD = Math.PI / 180;

  /* ---------- global constants (world units) ---------- */
  SB.K = {
    GRAVITY: 0.68,
    MAX_FALL: 16,
    FAST_FALL: 24,
    FRICTION: 0.58,
    AIR_ACC: 0.42,
    LAUNCH_DECAY: 0.985,
    LAUNCH_GRAV: 0.40,
    KB_TO_SPEED: 0.35,
    HITSTUN: 0.50,
    TUMBLE_KB: 30,
    FPS: 60,
    DT: 1000 / 60
  };

  /* ---------- gradient cache (created once in local space, reused under transforms) ---------- */
  var gcache = {};
  SB.grad = function (key, make) {
    var g = gcache[key];
    if (!g) { g = gcache[key] = make(); }
    return g;
  };
  SB.gctx = null; // offscreen ctx used to build cached gradients

  /* ---------- rounded / capsule helpers ---------- */
  SB.roundRect = function (c, x, y, w, h, r) {
    var m = Math.min(w, h) / 2; if (r > m) r = m;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  };

  /* capsule between two points */
  SB.capsule = function (c, x1, y1, x2, y2, r1, r2) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 0.0001;
    var nx = -dy / len, ny = dx / len;
    var a = Math.atan2(dy, dx);
    c.beginPath();
    c.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2);
    c.lineTo(x2 + nx * r2, y2 + ny * r2);
    c.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
  };

  /* ---------- simple deterministic-ish id ---------- */
  SB.roomCode = function () {
    var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = '';
    for (var i = 0; i < 4; i++) o += s[(Math.random() * s.length) | 0];
    return o;
  };

  /* ================= SFX : tiny WebAudio synth (no assets) ================= */
  var AC = null, master = null, muted = false;
  function ac() {
    if (!AC) {
      var C = w.AudioContext || w.webkitAudioContext; if (!C) return null;
      AC = new C();
      master = AC.createGain(); master.gain.value = 0.32; master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(o) {
    if (muted) return; var a = ac(); if (!a) return;
    var t = a.currentTime;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.d);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.v || 0.25, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + o.d);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + o.d + 0.02);
  }
  function noise(dur, vol, hp) {
    if (muted) return; var a = ac(); if (!a) return;
    var n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 400;
    var g = a.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  SB.sfx = {
    unlock: function () { ac(); },
    mute: function (v) { muted = v; },
    isMuted: function () { return muted; },
    play: function (n) {
      switch (n) {
        case 'jump': tone({ type: 'triangle', f0: 330, f1: 700, d: 0.12, v: 0.2 }); break;
        case 'djump': tone({ type: 'triangle', f0: 440, f1: 900, d: 0.12, v: 0.18 }); break;
        case 'hit': tone({ type: 'square', f0: 220, f1: 90, d: 0.1, v: 0.22 }); noise(0.08, 0.2, 900); break;
        case 'hit2': tone({ type: 'sawtooth', f0: 160, f1: 60, d: 0.16, v: 0.26 }); noise(0.14, 0.3, 500); break;
        case 'smash': tone({ type: 'sawtooth', f0: 120, f1: 40, d: 0.3, v: 0.32 }); noise(0.22, 0.34, 300); break;
        case 'charge': tone({ type: 'sine', f0: 180, f1: 520, d: 0.5, v: 0.1 }); break;
        case 'swing': noise(0.09, 0.13, 1600); break;
        case 'shoot': tone({ type: 'sine', f0: 700, f1: 260, d: 0.18, v: 0.18 }); break;
        case 'ice': tone({ type: 'sine', f0: 1200, f1: 500, d: 0.22, v: 0.16 }); break;
        case 'dash': tone({ type: 'sawtooth', f0: 800, f1: 1600, d: 0.12, v: 0.14 }); break;
        case 'guard': tone({ type: 'square', f0: 90, f1: 160, d: 0.3, v: 0.2 }); break;
        case 'item': tone({ type: 'square', f0: 880, f1: 1320, d: 0.12, v: 0.2 }); break;
        case 'heal': tone({ type: 'sine', f0: 520, f1: 1040, d: 0.3, v: 0.2 }); break;
        case 'explode': tone({ type: 'sawtooth', f0: 90, f1: 25, d: 0.5, v: 0.35 }); noise(0.45, 0.4, 180); break;
        case 'ko': tone({ type: 'square', f0: 900, f1: 120, d: 0.55, v: 0.3 }); noise(0.3, 0.25, 250); break;
        case 'ui': tone({ type: 'square', f0: 620, f1: 900, d: 0.07, v: 0.16 }); break;
        case 'go': tone({ type: 'square', f0: 400, f1: 1200, d: 0.35, v: 0.25 }); break;
        case 'count': tone({ type: 'square', f0: 700, f1: 700, d: 0.12, v: 0.2 }); break;
      }
    }
  };

  /* ---------- toast ---------- */
  var toastEl = null, toastT = 0;
  SB.toast = function (msg, ms) {
    if (!toastEl) toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1800);
  };

})(window);
