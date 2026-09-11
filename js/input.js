/* ================= SMASH BRO : touch input & on-screen controls ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  function PadState() {
    this.x = 0; this.y = 0;            // analog stick -1..1
    this.jump = false; this.atk = false; this.smash = false; this.sp = false;
    this.pjump = false; this.patk = false; this.psmash = false; this.psp = false; // previous
    this.stickActive = false; this.sx = 0; this.sy = 0; this.bx = 0; this.by = 0; // visual
  }
  PadState.prototype.snapshot = function () {
    this.pjump = this.jump; this.patk = this.atk; this.psmash = this.smash; this.psp = this.sp;
  };
  PadState.prototype.clear = function () {
    this.x = this.y = 0; this.jump = this.atk = this.smash = this.sp = false;
    this.stickActive = false;
  };
  PadState.prototype.copyFrom = function (o) {
    this.x = o.x; this.y = o.y; this.jump = o.jump; this.atk = o.atk; this.smash = o.smash; this.sp = o.sp;
  };

  var Input = SB.input = {
    pads: [new PadState(), new PadState()],
    layout: null,
    mode: 'single',       // 'single' | 'dual'
    enabled: false,
    canvas: null,
    ptr: {},              // pointerId -> {kind, pad, btn}
    W: 0, H: 0, portrait: false,
    hide: false
  };

  var BTN = [
    { id: 'atk', label: '攻撃', c1: '#ff6b5a', c2: '#b52318', gx: -1, gy: 1 },
    { id: 'smash', label: 'スマッシュ', c1: '#ffc14a', c2: '#c47200', gx: -1, gy: -1 },
    { id: 'sp', label: '特殊', c1: '#b26bff', c2: '#5a1fb0', gx: 1, gy: -1 },
    { id: 'jump', label: 'ジャンプ', c1: '#4ad4ff', c2: '#0e6bb5', gx: 1, gy: 1 }
  ];

  Input.setup = function (canvas) {
    this.canvas = canvas;
    var self = this;
    var opts = { passive: false };
    canvas.addEventListener('pointerdown', function (e) { self.onDown(e); }, opts);
    canvas.addEventListener('pointermove', function (e) { self.onMove(e); }, opts);
    canvas.addEventListener('pointerup', function (e) { self.onUp(e); }, opts);
    canvas.addEventListener('pointercancel', function (e) { self.onUp(e); }, opts);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* keyboard (desktop convenience) */
    w.addEventListener('keydown', function (e) { self.key(e, true); });
    w.addEventListener('keyup', function (e) { self.key(e, false); });
  };

  var KEY1 = { a: 'L', d: 'R', w: 'U', s: 'D', j: 'atk', k: 'smash', l: 'sp', ' ': 'jump' };
  var KEY2 = { arrowleft: 'L', arrowright: 'R', arrowup: 'U', arrowdown: 'D', '1': 'atk', '2': 'smash', '3': 'sp', '0': 'jump' };
  var kdown = [{}, {}];
  Input.key = function (e, down) {
    var k = e.key.toLowerCase();
    var maps = [KEY1, KEY2];
    for (var i = 0; i < 2; i++) {
      var m = maps[i][k]; if (!m) continue;
      e.preventDefault();
      kdown[i][m] = down;
      var p = this.pads[i];
      if (m === 'atk' || m === 'smash' || m === 'sp' || m === 'jump') p[m] = down;
      p.x = (kdown[i].R ? 1 : 0) - (kdown[i].L ? 1 : 0);
      p.y = (kdown[i].D ? 1 : 0) - (kdown[i].U ? 1 : 0);
    }
  };

  /* ---------------- layout ---------------- */
  Input.resize = function (W, H, mode) {
    this.W = W; this.H = H; this.mode = mode || this.mode;
    this.portrait = H > W * 1.02;
    var dual = this.mode === 'dual';
    var m = Math.min(W, H);
    var L = { W: W, H: H, portrait: this.portrait, dual: dual, pads: [] };

    if (this.portrait) {
      if (dual) {
        L.view = { x: 0, y: H * 0.255, w: W, h: H * 0.49 };
        L.pads.push(bandPad(0, H * 0.745, W, H * 0.255, m, true, dual, 0));
        L.pads.push(bandPad(0, 0, W, H * 0.255, m, false, dual, 1));
      } else {
        L.view = { x: 0, y: 0, w: W, h: H * 0.60 };
        L.pads.push(bandPad(0, H * 0.60, W, H * 0.40, m, true, dual, 0));
      }
    } else {
      L.view = { x: 0, y: 0, w: W, h: H };
      if (dual) {
        /* each player keeps to their own screen edge so the middle stays readable */
        L.pads.push(cornerPad(W, H, m, 1, 0));
        L.pads.push(cornerPad(W, H, m, -1, 1));
      } else {
        L.pads.push(bandPad(0, H * 0.20, W, H * 0.80, m, true, dual, 0));
      }
    }
    this.layout = L;
    this.releaseAll();
  };

  function mkBtns(cx, cy, r, flip) {
    return BTN.map(function (b) {
      var s = r * 1.12;
      return { id: b.id, label: b.label, c1: b.c1, c2: b.c2, r: r, press: 0,
        x: cx + b.gx * s * flip, y: cy + b.gy * s };
    });
  }

  /* stick on one side of a horizontal band, buttons on the other */
  function bandPad(zx, zy, zw, zh, m, leftStick, dual, idx) {
    var centred = zh > zw * 0.5;                       /* tall control band (portrait) */
    var r = SB.clamp(Math.min(zw * (dual ? 0.085 : 0.108), zh * (dual ? 0.30 : 0.26)), 22, 52);
    var s = r * 1.12;
    var stickR = SB.clamp(Math.min(zw * (dual ? 0.2 : 0.23), zh * (dual ? 0.5 : 0.44)), 38, 108);
    var stickCX = leftStick ? zx + Math.min(zw * 0.26, stickR * 0.9 + 26) : zx + zw - Math.min(zw * 0.26, stickR * 0.9 + 26);
    var clusterCX = leftStick ? zx + zw - (s + r + 14) : zx + s + r + 14;
    var bottomAnchor = zy + zh - s - r - 14;
    var cy = centred ? Math.min(zy + zh * 0.52, bottomAnchor) : bottomAnchor;
    var stickCY = centred ? zy + zh * 0.5 : zy + zh - Math.min(zh * 0.5, stickR * 0.8 + 24);
    return {
      idx: idx,
      zone: { x: zx, y: zy, w: zw, h: zh },
      panel: true,
      stickZone: leftStick ? { x: zx, y: zy, w: zw * 0.5, h: zh } : { x: zx + zw * 0.5, y: zy, w: zw * 0.5, h: zh },
      stick: { cx: stickCX, cy: stickCY, r: stickR, hr: stickR * 0.42 },
      btns: mkBtns(clusterCX, cy, r, leftStick ? 1 : -1),
      leftStick: leftStick
    };
  }

  /* landscape 2P : stick in the outer bottom corner, buttons stacked just above it */
  function cornerPad(W, H, m, side, idx) {
    var r = SB.clamp(m * 0.064, 20, 40);
    var s = r * 1.12;
    var stickR = SB.clamp(m * 0.105, 34, 82);
    var stickCX = side > 0 ? stickR * 0.85 + 12 : W - stickR * 0.85 - 12;
    var stickCY = H - stickR * 0.8 - 14;
    var clusterCX = side > 0 ? W * 0.245 : W * 0.755;
    var clusterCY = H * 0.60;
    var zx = side > 0 ? 0 : W * 0.5;
    return {
      idx: idx,
      zone: { x: zx, y: 0, w: W * 0.5, h: H },
      panel: false,
      stickZone: { x: side > 0 ? 0 : W * 0.62, y: H * 0.28, w: W * 0.38, h: H * 0.72 },
      stick: { cx: stickCX, cy: stickCY, r: stickR, hr: stickR * 0.42 },
      btns: mkBtns(clusterCX, clusterCY, r, side > 0 ? 1 : -1),
      leftStick: side > 0
    };
  }

  /* ---------------- pointer handling ---------------- */
  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  Input.hitBtn = function (pl, x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < pl.btns.length; i++) {
      var b = pl.btns[i], d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * 1.34 && d < bd) { bd = d; best = b; }
    }
    return best;
  };

  Input.onDown = function (e) {
    SB.sfx.unlock();
    if (!this.enabled || !this.layout) return;
    e.preventDefault();
    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var L = this.layout;
    for (var i = 0; i < L.pads.length; i++) {
      var pl = L.pads[i], p = this.pads[i];
      var b = this.hitBtn(pl, x, y);
      if (b) { this.ptr[e.pointerId] = { kind: 'btn', pad: i, btn: b.id }; p[b.id] = true; b.press = 1; return; }
    }
    for (i = 0; i < L.pads.length; i++) {
      pl = L.pads[i]; p = this.pads[i];
      if (inRect(pl.stickZone, x, y) || (L.pads.length === 1 && inRect(pl.zone, x, y))) {
        this.ptr[e.pointerId] = { kind: 'stick', pad: i };
        p.stickActive = true; p.bx = x; p.by = y; p.sx = x; p.sy = y; p.x = 0; p.y = 0;
        return;
      }
    }
  };

  Input.onMove = function (e) {
    var t = this.ptr[e.pointerId]; if (!t) return;
    e.preventDefault();
    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var pl = this.layout.pads[t.pad], p = this.pads[t.pad];
    if (!pl) return;
    if (t.kind === 'stick') {
      var dx = x - p.bx, dy = y - p.by, R = pl.stick.r;
      var d = Math.hypot(dx, dy);
      if (d > R) { /* drag the base along */ p.bx += dx * (1 - R / d); p.by += dy * (1 - R / d); dx *= R / d; dy *= R / d; d = R; }
      p.sx = p.bx + dx; p.sy = p.by + dy;
      var dead = R * 0.16;
      if (d < dead) { p.x = 0; p.y = 0; }
      else {
        var k = Math.min(1, (d - dead) / (R * 0.72 - dead));
        p.x = (dx / d) * k; p.y = (dy / d) * k;
      }
    } else {
      var b = this.hitBtn(pl, x, y);
      var nid = b ? b.id : null;
      if (nid !== t.btn) {
        if (t.btn) { p[t.btn] = false; }
        t.btn = nid;
        if (nid) { p[nid] = true; b.press = 1; }
      }
    }
  };

  Input.onUp = function (e) {
    var t = this.ptr[e.pointerId]; if (!t) return;
    delete this.ptr[e.pointerId];
    var p = this.pads[t.pad];
    if (t.kind === 'stick') { p.stickActive = false; p.x = 0; p.y = 0; }
    else if (t.btn) p[t.btn] = false;
  };

  Input.releaseAll = function () {
    this.ptr = {};
    this.pads.forEach(function (p) { p.clear(); });
  };

  /* ---------------- drawing on-screen controls ---------------- */
  Input.draw = function (c) {
    if (!this.layout || this.hide) return;
    var L = this.layout;
    if (L.portrait) {
      for (var q = 0; q < L.pads.length; q++) {
        var z = L.pads[q].zone;
        var g = c.createLinearGradient(0, z.y, 0, z.y + z.h);
        g.addColorStop(0, q === 0 ? '#141c3c' : '#0d1228');
        g.addColorStop(1, q === 0 ? '#0a0e20' : '#141c3c');
        c.fillStyle = g; c.fillRect(z.x, z.y, z.w, z.h);
        c.save(); c.globalAlpha = .3; c.strokeStyle = '#6f8dd8'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, q === 0 ? z.y + 1 : z.y + z.h - 1); c.lineTo(z.w, q === 0 ? z.y + 1 : z.y + z.h - 1);
        c.stroke(); c.restore();
      }
    }
    for (var i = 0; i < L.pads.length; i++) {
      var pl = L.pads[i], p = this.pads[i];
      drawStick(c, pl, p, i, L.pads.length > 1);
      for (var j = 0; j < pl.btns.length; j++) {
        var b = pl.btns[j];
        drawBtn(c, b, p[b.id]);
        if (b.press > 0) b.press -= 0.08;
      }
    }
    if (L.pads.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 2; c.setLineDash([10, 10]);
      c.beginPath();
      if (L.portrait) { c.moveTo(0, L.view.y); c.lineTo(L.W, L.view.y); c.moveTo(0, L.view.y + L.view.h); c.lineTo(L.W, L.view.y + L.view.h); }
      else { c.moveTo(L.W / 2, L.H * 0.42); c.lineTo(L.W / 2, L.H); }
      c.stroke(); c.restore();
    }
  };

  function drawStick(c, pl, p, idx, dual) {
    var cx = p.stickActive ? p.bx : pl.stick.cx;
    var cy = p.stickActive ? p.by : pl.stick.cy;
    var R = pl.stick.r, hr = pl.stick.hr;
    var a = p.stickActive ? 0.5 : 0.24;
    c.save();
    /* base ring */
    c.globalAlpha = a;
    c.beginPath(); c.arc(cx, cy, R * 0.76, 0, 6.2832);
    c.fillStyle = 'rgba(10,16,38,.55)'; c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    /* direction ticks */
    c.globalAlpha = a * 0.7;
    for (var i = 0; i < 4; i++) {
      var ang = i * Math.PI / 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * R * 0.5, cy + Math.sin(ang) * R * 0.5);
      c.lineTo(cx + Math.cos(ang) * R * 0.66, cy + Math.sin(ang) * R * 0.66);
      c.lineWidth = 3; c.stroke();
    }
    /* knob */
    var kx = p.stickActive ? p.sx : cx, ky = p.stickActive ? p.sy : cy;
    c.globalAlpha = Math.min(1, a + 0.3);
    var g = c.createRadialGradient(kx - hr * 0.3, ky - hr * 0.4, hr * 0.1, kx, ky, hr);
    g.addColorStop(0, idx === 0 ? '#9fd8ff' : '#ffc6a0');
    g.addColorStop(1, idx === 0 ? '#2f6fd0' : '#c9601f');
    c.beginPath(); c.arc(kx, ky, hr, 0, 6.2832); c.fillStyle = g; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
    if (dual) {
      c.globalAlpha = 0.75; c.fillStyle = '#fff';
      c.font = 'bold ' + Math.round(R * 0.26) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('P' + (idx + 1), cx, cy - R * 0.92);
    }
    c.restore();
  }

  function drawBtn(c, b, on) {
    var r = b.r * (on ? 0.93 : 1);
    c.save();
    c.globalAlpha = on ? 0.95 : 0.62;
    var g = c.createRadialGradient(b.x - r * 0.35, b.y - r * 0.45, r * 0.12, b.x, b.y, r);
    g.addColorStop(0, on ? '#ffffff' : b.c1);
    g.addColorStop(0.55, b.c1);
    g.addColorStop(1, b.c2);
    c.beginPath(); c.arc(b.x, b.y + (on ? 2 : 0), r, 0, 6.2832);
    c.fillStyle = g; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
    /* gloss */
    c.globalAlpha = on ? 0.18 : 0.28;
    c.beginPath(); c.ellipse(b.x, b.y - r * 0.42, r * 0.6, r * 0.3, 0, 0, 6.2832);
    c.fillStyle = '#fff'; c.fill();
    /* label */
    c.globalAlpha = 0.98;
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var fs = Math.round(r * (b.label.length > 3 ? 0.30 : 0.40));
    c.font = 'bold ' + fs + 'px "Hiragino Kaku Gothic ProN",sans-serif';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.45)';
    c.strokeText(b.label, b.x, b.y + (on ? 2 : 0));
    c.fillText(b.label, b.x, b.y + (on ? 2 : 0));
    c.restore();
  }

  SB.PadState = PadState;
})(window);
