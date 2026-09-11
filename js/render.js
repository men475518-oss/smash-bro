/* ================= SMASH BRO : renderer (anime / painted 2D, no pixel art) ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  /* ---------- per-context gradient cache ---------- */
  function gc(c, key, make) {
    var m = c.__gc || (c.__gc = {});
    var g = m[key]; if (!g) g = m[key] = make(c);
    return g;
  }
  function lg(c, key, x0, y0, x1, y1, stops) {
    return gc(c, key, function (cc) {
      var g = cc.createLinearGradient(x0, y0, x1, y1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    });
  }
  function rg(c, key, x0, y0, r0, x1, y1, r1, stops) {
    return gc(c, key, function (cc) {
      var g = cc.createRadialGradient(x0, y0, r0, x1, y1, r1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    });
  }
  function parseCol(c) {
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = c.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0] | 0, +m[1] | 0, +m[2] | 0];
  }
  function shade(col, f) {
    var p = parseCol(col);
    return 'rgb(' + SB.clamp(Math.round(p[0] * f), 0, 255) + ',' +
      SB.clamp(Math.round(p[1] * f), 0, 255) + ',' + SB.clamp(Math.round(p[2] * f), 0, 255) + ')';
  }
  function mix(a, b, t) {
    var p = parseCol(a), q = parseCol(b);
    return 'rgb(' + Math.round(p[0] * (1 - t) + q[0] * t) + ',' +
      Math.round(p[1] * (1 - t) + q[1] * t) + ',' + Math.round(p[2] * (1 - t) + q[2] * t) + ')';
  }
  SB.shade = shade;

  var R = SB.render = {
    cam: { x: 0, y: -120, z: 0.72, tz: 0.72 },
    view: { x: 0, y: 0, w: 100, h: 100 },
    t: 0
  };

  /* ============================================================ camera ============ */
  R.updateCam = function (g, view) {
    var cam = this.cam;
    var vh = view.h - (this.hudPad || 0);
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, n = 0;
    for (var i = 0; i < g.fighters.length; i++) {
      var f = g.fighters[i];
      if (f.stocks <= 0 && f.dead > 0) continue;
      if (f.dead > 0) continue;
      minx = Math.min(minx, f.x); maxx = Math.max(maxx, f.x);
      miny = Math.min(miny, f.y - 100); maxy = Math.max(maxy, f.y + 20);
      n++;
    }
    var B = g.stage.blast;
    if (!n) { minx = -200; maxx = 200; miny = -260; maxy = 60; }
    minx = SB.clamp(minx, B.l, B.r); maxx = SB.clamp(maxx, B.l, B.r);
    miny = SB.clamp(miny, B.t, B.b); maxy = SB.clamp(maxy, B.t, B.b);

    var padx = 300, pady = 215;
    var sw = (maxx - minx) + padx * 2, sh = (maxy - miny) + pady * 2;
    var z = Math.min(view.w / sw, vh / sh);
    z = SB.clamp(z, 0.30, 1.05);
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2 + 40;

    cam.tz = z;
    cam.z += (cam.tz - cam.z) * 0.07;
    cam.x += (cx - cam.x) * 0.11;
    cam.y += (cy - cam.y) * 0.11;
    /* keep inside blast area a bit */
    var halfw = view.w / (2 * cam.z), halfh = vh / (2 * cam.z);
    cam.x = SB.clamp(cam.x, B.l - 60 + halfw * 0.35, B.r + 60 - halfw * 0.35);
    cam.y = SB.clamp(cam.y, B.t - 40 + halfh * 0.3, B.b + 30 - halfh * 0.3);
  };

  R.applyCam = function (c, view, fx) {
    var cam = this.cam;
    var z = cam.z * (1 + (fx ? fx.zoomPunch : 0));
    var sx = (fx && fx.shake > 0.4) ? (Math.random() - 0.5) * fx.shake : 0;
    var sy = (fx && fx.shake > 0.4) ? (Math.random() - 0.5) * fx.shake : 0;
    c.translate(view.x + view.w / 2 + sx, view.y + (view.h - (this.hudPad || 0)) / 2 + sy);
    c.scale(z, z);
    c.translate(-cam.x, -cam.y);
    return z;
  };
  R.w2s = function (x, y, view) {
    var cam = this.cam;
    return { x: view.x + view.w / 2 + (x - cam.x) * cam.z, y: view.y + (view.h - (this.hudPad || 0)) / 2 + (y - cam.y) * cam.z };
  };

  /* ============================================================ backgrounds ============ */
  var SKY = {
    grass: [[0, '#7fd8ff'], [0.45, '#bfe9ff'], [0.75, '#ffe9b8'], [1, '#ffd08a']],
    ruins: [[0, '#2b1e53'], [0.4, '#7a3f7a'], [0.72, '#e8865a'], [1, '#ffc27a']],
    sky: [[0, '#10306b'], [0.35, '#2f6fc4'], [0.7, '#87c8f0'], [1, '#dff1ff']]
  };

  R.drawBg = function (c, g, view) {
    var th = g.stage.theme, cam = this.cam;
    var sk = lg(c, 'sky_' + th + view.h, 0, view.y, 0, view.y + view.h, SKY[th]);
    c.fillStyle = sk; c.fillRect(view.x, view.y, view.w, view.h);
    var px = -cam.x, py = -cam.y;
    c.save();
    c.translate(view.x + view.w / 2, view.y + view.h / 2);
    if (th === 'grass') bgGrass(c, px, py, view, this.t);
    else if (th === 'ruins') bgRuins(c, px, py, view, this.t);
    else bgSky(c, px, py, view, this.t);
    c.restore();
  };

  function cloud(c, x, y, s, a) {
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(-42, 6, 26, 0, 6.2832); c.arc(-10, -12, 36, 0, 6.2832);
    c.arc(30, 2, 28, 0, 6.2832); c.arc(60, 10, 20, 0, 6.2832);
    c.rect(-42, 6, 104, 22);
    c.fill();
    c.globalAlpha = a * 0.5; c.fillStyle = '#cfe6ff';
    c.beginPath(); c.arc(-10, 6, 30, 0, 3.14); c.fill();
    c.restore();
  }

  function bgGrass(c, px, py, view, t) {
    var s1 = 0.12, s2 = 0.3, s3 = 0.5;
    /* sun */
    c.save();
    c.globalAlpha = .85;
    var sx = px * s1 - 220, sy = py * s1 - 230;
    var sg = rg(c, 'sun', sx, sy, 10, sx, sy, 120, [[0, 'rgba(255,255,220,.95)'], [0.4, 'rgba(255,230,150,.55)'], [1, 'rgba(255,220,120,0)']]);
    c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 120, 0, 6.2832); c.fill();
    c.restore();
    /* far hills */
    c.save(); c.translate(px * s2, py * s2);
    c.fillStyle = lg(c, 'hillF', 0, 40, 0, 320, [[0, '#9fd77f'], [1, '#4b9b63']]);
    hills(c, 700, 120, 5, 0);
    c.restore();
    c.save(); c.translate(px * s3, py * s3);
    c.fillStyle = lg(c, 'hillN', 0, 80, 0, 380, [[0, '#79c46a'], [1, '#2f7d4e']]);
    hills(c, 520, 170, 4, 1);
    c.restore();
    /* clouds */
    for (var i = 0; i < 4; i++) {
      var cx = ((i * 430 + t * 0.22) % 1500) - 750 + px * 0.18;
      cloud(c, cx, -250 + i * 62 + py * 0.18, 0.9 + (i % 2) * 0.4, 0.75);
    }
  }
  function hills(c, wdt, h, n, off) {
    c.beginPath(); c.moveTo(-1400, 460);
    for (var i = -2; i <= n; i++) {
      var x = -1400 + (i + off * 0.5) * wdt;
      c.quadraticCurveTo(x + wdt * 0.5, 120 - h - (i % 2) * 60, x + wdt, 200);
    }
    c.lineTo(1600, 460); c.closePath(); c.fill();
  }

  function bgRuins(c, px, py, view, t) {
    /* moon */
    var mx = px * 0.1 + 260, my = py * 0.1 - 250;
    c.save(); c.globalAlpha = .9;
    c.fillStyle = rg(c, 'moon', mx, my, 6, mx, my, 100, [[0, 'rgba(255,244,214,.95)'], [0.32, 'rgba(255,206,150,.45)'], [1, 'rgba(255,170,110,0)']]);
    c.beginPath(); c.arc(mx, my, 100, 0, 6.2832); c.fill();
    c.fillStyle = '#fff6e2'; c.beginPath(); c.arc(mx, my, 32, 0, 6.2832); c.fill();
    c.restore();

    /* far ruin skyline (low contrast, hazy) */
    c.save(); c.translate(px * 0.22, py * 0.22); c.globalAlpha = .42;
    c.fillStyle = '#4a3560';
    for (var i = -5; i <= 5; i++) {
      var x = i * 190 + 30, h = 150 + ((i * 7) % 5) * 46;
      c.fillRect(x, 250 - h, 34, h);
      c.fillRect(x - 8, 240 - h, 50, 14);
    }
    c.restore();

    /* mid columns : broken tops */
    c.save(); c.translate(px * 0.4, py * 0.4); c.globalAlpha = .55;
    for (i = -3; i <= 3; i++) {
      var cx = i * 265 - 60, ch = 250 + ((i * 5) % 3) * 110, cw = 46;
      c.fillStyle = lg(c, 'colN', 0, -140, 0, 320, [[0, '#6a4e7d'], [0.6, '#432f57'], [1, '#2a1c3c']]);
      c.beginPath();
      c.moveTo(cx, 300);
      c.lineTo(cx, 300 - ch + (i % 2 ? 16 : 0));
      c.lineTo(cx + cw * 0.45, 300 - ch - 10);
      c.lineTo(cx + cw, 300 - ch + (i % 2 ? 0 : 14));
      c.lineTo(cx + cw, 300);
      c.closePath(); c.fill();
      /* fluting */
      c.globalAlpha = .2; c.strokeStyle = '#d9c2ef'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + 12, 296); c.lineTo(cx + 12, 300 - ch + 12); c.stroke();
      c.globalAlpha = .55;
      /* base block */
      c.fillStyle = '#33234a';
      c.fillRect(cx - 10, 292, cw + 20, 16);
    }
    c.restore();

    /* warm haze */
    c.save();
    c.fillStyle = lg(c, 'haze', 0, -120, 0, 340, [[0, 'rgba(255,150,90,0)'], [1, 'rgba(255,150,90,.3)']]);
    c.fillRect(-1400, -200, 2800, 600);
    c.restore();

    for (i = 0; i < 3; i++) cloud(c, ((i * 520 + t * 0.14) % 1600) - 800 + px * 0.2, -300 + i * 70 + py * 0.2, 1.3, 0.22);
  }

  function bgSky(c, px, py, view, t) {
    for (var i = 0; i < 6; i++) {
      var cx = ((i * 340 + t * 0.3) % 1800) - 900 + px * 0.14;
      cloud(c, cx, -300 + (i % 3) * 150 + py * 0.14, 1 + (i % 3) * 0.5, 0.85);
    }
    /* floating rocks */
    c.save(); c.translate(px * 0.35, py * 0.35);
    c.fillStyle = lg(c, 'rockF', 0, -60, 0, 120, [[0, '#9fb4cf'], [1, '#4a5c7a']]);
    var pts = [[-520, -180, 60], [420, -60, 80], [-260, 160, 50], [600, 220, 44]];
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      c.beginPath();
      c.moveTo(p[0] - p[2], p[1]);
      c.quadraticCurveTo(p[0], p[1] - p[2] * 0.7, p[0] + p[2], p[1]);
      c.lineTo(p[0] + p[2] * 0.4, p[1] + p[2] * 1.3);
      c.lineTo(p[0] - p[2] * 0.5, p[1] + p[2] * 0.9);
      c.closePath(); c.fill();
    }
    c.restore();
    for (i = 0; i < 4; i++) cloud(c, ((i * 470 + t * 0.5) % 1700) - 850 + px * 0.5, -60 + (i % 2) * 190 + py * 0.5, 1.4, 0.55);
  }

  /* ============================================================ stage platforms ============ */
  R.drawStage = function (c, g) {
    var th = g.stage.theme;
    var plats = g.stage.plats;
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (p.brk && p.broken > 0) { drawBroken(c, p, th); continue; }
      if (th === 'grass') platGrass(c, p, i === 0);
      else if (th === 'ruins') platRuins(c, p, i === 0, p.brk);
      else platSky(c, p, i === 0);
    }
  };

  function outline(c, path, col, wd) { c.save(); c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = wd; path(); c.stroke(); c.restore(); }

  function platGrass(c, p, main) {
    var x = p.x, y = p.y, wd = p.w, h = p.h;
    c.save();
    /* dirt body */
    c.beginPath();
    c.moveTo(x, y + 10);
    c.lineTo(x + wd, y + 10);
    c.lineTo(x + wd - (main ? 26 : 12), y + h);
    c.quadraticCurveTo(x + wd / 2, y + h + (main ? 22 : 10), x + (main ? 26 : 12), y + h);
    c.closePath();
    c.fillStyle = lg(c, 'dirt' + (main ? 1 : 0) + h, 0, y, 0, y + h, [[0, '#9a6b40'], [0.5, '#7a4f2c'], [1, '#4d3119']]);
    c.fill();
    c.strokeStyle = 'rgba(40,22,10,.85)'; c.lineWidth = 3; c.stroke();
    /* rock speckles */
    c.globalAlpha = .28; c.fillStyle = '#3a2412';
    for (var i = 0; i < Math.floor(wd / 60); i++) {
      var rx = x + 20 + i * 58 + (i % 3) * 9, ry = y + 26 + (i % 4) * 13;
      if (ry < y + h - 4) { c.beginPath(); c.ellipse(rx, ry, 7, 5, i, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
    /* grass top */
    c.beginPath();
    c.moveTo(x, y + 14); c.lineTo(x, y + 4);
    for (var gx = x; gx <= x + wd; gx += 14) {
      c.quadraticCurveTo(gx + 4, y - 9, gx + 8, y + 1);
      c.quadraticCurveTo(gx + 11, y - 5, gx + 14, y + 3);
    }
    c.lineTo(x + wd, y + 16); c.closePath();
    c.fillStyle = lg(c, 'grass', 0, y - 10, 0, y + 18, [[0, '#8ce05f'], [0.5, '#4fb84a'], [1, '#2c7d39']]);
    c.fill();
    c.strokeStyle = 'rgba(24,64,26,.7)'; c.lineWidth = 2.5; c.stroke();
    /* top highlight */
    c.globalAlpha = .5;
    c.fillStyle = '#d6ff9a';
    c.fillRect(x + 4, y - 1, wd - 8, 3);
    c.restore();
  }

  function platRuins(c, p, main, brk) {
    var x = p.x, y = p.y, wd = p.w, h = p.h;
    c.save();
    /* body */
    c.beginPath();
    c.moveTo(x, y + 6);
    c.lineTo(x + wd, y + 6);
    c.lineTo(x + wd - (main ? 18 : 6), y + h);
    c.lineTo(x + (main ? 18 : 6), y + h);
    c.closePath();
    c.fillStyle = lg(c, 'stone' + h, 0, y, 0, y + h, [[0, '#e2cda4'], [0.28, '#c0a87e'], [0.7, '#8a7355'], [1, '#4c3f2d']]);
    c.fill();
    c.strokeStyle = 'rgba(38,28,16,.9)'; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();

    /* carved block seams */
    c.save(); c.globalAlpha = .3; c.strokeStyle = '#3d3120'; c.lineWidth = 2;
    var rows = Math.max(1, Math.floor(h / 42));
    for (var r0 = 1; r0 < rows; r0++) {
      var ry = y + 6 + (h - 6) * (r0 / rows);
      c.beginPath(); c.moveTo(x + 4, ry); c.lineTo(x + wd - 4, ry); c.stroke();
    }
    for (var i = 1; i * 68 < wd; i++) {
      var off = (i % 2) * 34;
      c.beginPath(); c.moveTo(x + i * 68 - off, y + 8); c.lineTo(x + i * 68 - off, y + h - 2); c.stroke();
    }
    c.restore();

    /* cap stone with overhanging lip */
    c.beginPath(); SB.roundRect(c, x - 4, y - 7, wd + 8, 15, 4);
    c.fillStyle = lg(c, 'cap', 0, y - 8, 0, y + 9, [[0, '#f1e2bd'], [0.55, '#cdb68c'], [1, '#94795a']]);
    c.fill(); c.strokeStyle = 'rgba(38,28,16,.9)'; c.lineWidth = 2.6; c.stroke();
    c.save(); c.globalAlpha = .75; c.fillStyle = '#fff6df';
    c.fillRect(x - 1, y - 6, wd + 2, 3); c.restore();

    /* moss tufts */
    c.save(); c.globalAlpha = .5; c.fillStyle = '#6f9b4e';
    for (i = 0; i * 96 < wd; i++) {
      var mxp = x + 22 + i * 96;
      c.beginPath(); c.ellipse(mxp, y - 6, 13, 4.5, 0, 0, 6.2832); c.fill();
    }
    c.restore();

    if (brk) {
      var dmg = 1 - p.hp / p.maxhp;
      c.strokeStyle = 'rgba(46,28,12,' + (0.4 + dmg * 0.55) + ')'; c.lineWidth = 2 + dmg * 2.5;
      c.lineCap = 'round';
      for (i = 0; i < 3; i++) {
        var bx = x + wd * (0.24 + i * 0.26);
        c.beginPath(); c.moveTo(bx, y - 2);
        c.lineTo(bx + 7 * (i - 1) - 5, y + h * 0.55);
        c.lineTo(bx + 4 * (1 - i), y + h + 1); c.stroke();
      }
      if (dmg > 0.15) {
        c.save(); c.globalAlpha = dmg * 0.4;
        c.fillStyle = '#ff6a2b';
        SB.roundRect(c, x - 4, y - 7, wd + 8, h + 8, 5); c.fill(); c.restore();
      }
      /* warning marker */
      c.save(); c.globalAlpha = .5; c.fillStyle = '#ffb03a';
      c.beginPath(); c.moveTo(x + wd / 2 - 7, y - 14); c.lineTo(x + wd / 2 + 7, y - 14); c.lineTo(x + wd / 2, y - 24); c.closePath();
      c.fill(); c.restore();
    }
    c.restore();
  }

  function drawBroken(c, p, th) {
    var k = p.broken / 420;
    c.save();
    c.globalAlpha = 0.10 + (1 - k) * 0.14;
    c.fillStyle = '#e7d3ab';
    SB.roundRect(c, p.x, p.y, p.w, p.h * 0.6, 4); c.fill();
    c.globalAlpha = 0.30;
    c.strokeStyle = '#ffcf8a'; c.lineWidth = 2; c.setLineDash([7, 9]);
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.w, p.y); c.stroke();
    c.restore();
  }

  function platSky(c, p, main) {
    var x = p.x, y = p.y, wd = p.w, h = p.h;
    c.save();
    c.beginPath();
    c.moveTo(x + 6, y);
    c.lineTo(x + wd - 6, y);
    c.quadraticCurveTo(x + wd + 4, y + h * 0.4, x + wd - 22, y + h);
    c.lineTo(x + 22, y + h);
    c.quadraticCurveTo(x - 4, y + h * 0.4, x + 6, y);
    c.closePath();
    c.fillStyle = lg(c, 'metal' + h, 0, y, 0, y + h, [[0, '#dfe9f6'], [0.3, '#9aabc4'], [0.72, '#5c6d8c'], [1, '#36425c']]);
    c.fill();
    c.strokeStyle = 'rgba(20,28,48,.9)'; c.lineWidth = 3; c.stroke();
    /* glowing rune strip */
    c.fillStyle = lg(c, 'rune', 0, y + 2, 0, y + 10, [[0, '#9df0ff'], [1, 'rgba(80,200,255,0)']]);
    c.fillRect(x + 10, y + 2, wd - 20, 9);
    c.globalAlpha = .75; c.fillStyle = '#e9fbff'; c.fillRect(x + 8, y, wd - 16, 3);
    c.globalAlpha = .5; c.fillStyle = '#2ad4ff';
    for (var i = 0; i * 46 < wd - 30; i++) c.fillRect(x + 22 + i * 46, y + h - 7, 18, 3);
    c.restore();
  }

  /* ============================================================ character rig ============ */
  var UP = 21, FA = 20, TH = 25, SH = 25;   /* limb lengths (base scale) */
  var HIP = -46, SHO = -76, NECK = -84, HEADY = -99, HEADR = 15;

  function jt(x, y, a, len) { var r = a * SB.RAD; return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len }; }

  function buildPose(f) {
    var p = {
      hip: HIP, lean: (f.lean || 0), rot: 0, crouch: 0, headA: 0, bob: 0,
      aF: [22, -14], aB: [-24, -14], lF: [6, 6], lB: [-7, 9], stretch: 1, extra: 0
    };
    var st = f.pose || 'idle', T = f.poseT || 0, A = f.animT || 0;
    var e = 0, wnd = 0;
    if (f.act && f.act.m) {
      var m = f.act.m, t = f.act.t;
      if (t < m.st) { wnd = t / Math.max(1, m.st); e = 0; }
      else if (t < m.st + m.ac) { wnd = 1; e = 1; }
      else { wnd = 1; e = Math.max(0, 1 - (t - m.st - m.ac) / Math.max(1, m.rc)); }
    } else if (f.charging) { wnd = 1; e = 0; p.extra = Math.min(1, f.charge / 60); }
    else if (f.act) { var pr = f.act.t / Math.max(1, f.act.dur); e = Math.sin(pr * Math.PI); wnd = Math.min(1, pr * 3); }

    switch (st) {
      case 'run':
        var ph = A * 1.5;
        p.lF = [Math.sin(ph) * 42, 18 + Math.max(0, -Math.sin(ph)) * 52];
        p.lB = [Math.sin(ph + Math.PI) * 42, 18 + Math.max(0, -Math.sin(ph + Math.PI)) * 52];
        p.aF = [-Math.sin(ph) * 46, -30 - Math.abs(Math.cos(ph)) * 18];
        p.aB = [-Math.sin(ph + Math.PI) * 46, -30 - Math.abs(Math.cos(ph + Math.PI)) * 18];
        p.hip = HIP + 3 + Math.abs(Math.sin(ph * 2)) * 4;
        p.lean += 0.20; p.bob = Math.abs(Math.sin(ph * 2)) * 2;
        break;
      case 'crouch':
        p.hip = HIP + 22; p.crouch = 1;
        p.lF = [36, -74]; p.lB = [-30, -74];
        p.aF = [26, -46]; p.aB = [-22, -46];
        p.lean += 0.16;
        break;
      case 'air': case 'djump':
        p.lF = [28, -48]; p.lB = [-24, -34];
        p.aF = [-26, -44]; p.aB = [24, -40];
        p.hip = HIP + 4;
        if (st === 'djump') p.rot = Math.min(1, T / 16) * 0.6;
        if (f.vy > 6) { p.aF = [-42, -26]; p.aB = [36, -24]; p.lF = [16, -26]; p.lB = [-14, -22]; }
        break;
      case 'jab1':
        p.aF = [SB.lerp(-34 * wnd, 86, e), SB.lerp(-50, 4, e)];
        p.aB = [-30, -46]; p.lean += 0.08 * e; p.lF = [12, 8]; p.lB = [-12, 12];
        break;
      case 'jab2':
        p.aB = [SB.lerp(-30 * wnd, 88, e), SB.lerp(-52, 2, e)];
        p.aF = [30 - 50 * e, -44]; p.lean += 0.1 * e; p.rot = -0.06 * e;
        break;
      case 'jab3':
        p.aF = [SB.lerp(-60 * wnd, 62, e), SB.lerp(-70, -10, e)];
        p.aB = [SB.lerp(-40, 40, e), -50];
        p.lF = [SB.lerp(4, 54, e), SB.lerp(8, -44, e)];
        p.lean += 0.12 * e;
        break;
      case 'fsmash':
        var ch = p.extra;
        p.aF = [SB.lerp(-86 - ch * 20, 96, e), SB.lerp(-64, 6, e)];
        p.aB = [SB.lerp(-56, 30, e), -44];
        p.lean += SB.lerp(-0.22 - ch * 0.1, 0.3, e);
        p.lF = [SB.lerp(-6, 44, e), SB.lerp(10, -16, e)];
        p.lB = [SB.lerp(-24, -34, e), 16];
        p.hip = HIP + 8 + ch * 4;
        break;
      case 'usmash':
        p.aF = [SB.lerp(-40 * wnd, 172, e), SB.lerp(-50, -8, e)];
        p.aB = [SB.lerp(-30 * wnd, 176, e), SB.lerp(-50, -6, e)];
        p.hip = HIP + SB.lerp(18, -6, e); p.lF = [SB.lerp(28, 4, e), SB.lerp(-56, 4, e)];
        p.lB = [SB.lerp(-24, -6, e), SB.lerp(-56, 6, e)];
        p.lean += 0.02;
        break;
      case 'dsmash':
        p.hip = HIP + SB.lerp(12, 26, e); p.crouch = e;
        p.aF = [SB.lerp(-30, 104, e), SB.lerp(-50, 8, e)];
        p.aB = [SB.lerp(-30, -104, e), SB.lerp(-50, -8, e)];
        p.lF = [SB.lerp(20, 54, e), -68]; p.lB = [SB.lerp(-20, -54, e), -68];
        break;
      case 'airspin':
        p.rot = (f.act ? f.act.t : T) * 0.42 * (f.char.id === 'rei' ? 1.25 : 1);
        p.lF = [56, -20]; p.lB = [-46, -26];
        p.aF = [104, -10]; p.aB = [-96, -12];
        break;
      case 'airdown':
        p.rot = SB.lerp(-0.3, 0.45, e);
        p.aF = [SB.lerp(-70, 40, e), -30]; p.aB = [SB.lerp(-60, 36, e), -30];
        p.lF = [SB.lerp(24, -18, e), -34]; p.lB = [SB.lerp(-22, -26, e), -30];
        break;
      case 'aircast':
        p.aF = [SB.lerp(-30, 90, e), SB.lerp(-56, 6, e)];
        p.aB = [SB.lerp(-20, 68, e), SB.lerp(-56, -16, e)];
        p.lF = [30, -44]; p.lB = [-26, -36];
        break;
      case 'airswing':
        p.rot = SB.lerp(-0.35, 0.3, e);
        p.aF = [SB.lerp(-110, 92, e), SB.lerp(-40, 4, e)];
        p.aB = [-40, -40]; p.lF = [24, -40]; p.lB = [-22, -30];
        break;
      case 'hit':
        var sp = Math.hypot(f.vx, f.vy);
        if (sp > 7) { p.rot = T * 0.3 * (f.vx >= 0 ? 1 : -1); }
        else p.rot = -0.3;
        p.aF = [-60, -30]; p.aB = [58, -34];
        p.lF = [-34, -20]; p.lB = [40, -24];
        p.lean -= 0.3;
        break;
      case 'throw':
        p.aF = [SB.lerp(-100, 80, e), SB.lerp(-30, 10, e)];
        p.aB = [-30, -40]; p.lean += 0.1 * e;
        break;
      case 'sp_wave':
        p.aF = [SB.lerp(-24, 90, e), SB.lerp(-72, 2, e)];
        p.aB = [SB.lerp(-34, 78, e), SB.lerp(-74, -8, e)];
        p.lF = [SB.lerp(8, 34, e), SB.lerp(8, -10, e)];
        p.lB = [-28, 18]; p.lean += SB.lerp(-0.12, 0.16, e); p.hip = HIP + 6;
        break;
      case 'sp_gouken':
        p.aF = [SB.lerp(-120 * wnd, 92, e), SB.lerp(-66, 2, e)];
        p.aB = [SB.lerp(-70, 20, e), -50];
        p.lean += SB.lerp(-0.3, 0.34, e); p.hip = HIP + 12;
        p.lF = [SB.lerp(-10, 50, e), SB.lerp(4, -20, e)]; p.lB = [-30, 20];
        break;
      case 'sp_dash':
        p.rot = 0.4; p.lean += 0.35;
        p.aF = [110, -6]; p.aB = [-70, -30];
        p.lF = [40, -10]; p.lB = [-46, -14];
        break;
      case 'sp_ice':
        p.aF = [SB.lerp(-10, 88, e), SB.lerp(-40, 0, e)];
        p.aB = [SB.lerp(-60, -10, e), SB.lerp(-70, -60, e)];
        p.lean += 0.06; p.lF = [16, 4]; p.lB = [-24, 14];
        break;
      case 'sp_shadow':
        p.rot = -e * 0.5; p.hip = HIP + 12 * (1 - e);
        p.aF = [SB.lerp(40, -30, e), -80]; p.aB = [SB.lerp(-40, 30, e), -80];
        p.lF = [20, -50]; p.lB = [-20, -50];
        break;
      case 'sp_iron':
        p.aF = [SB.lerp(20, 66, e), SB.lerp(-40, -108, e)];
        p.aB = [SB.lerp(-20, -66, e), SB.lerp(-40, -108, e)];
        p.lF = [26, -18]; p.lB = [-26, -18]; p.hip = HIP + 10;
        break;
      default: /* idle */
        var b = Math.sin(A * 1.7);
        p.hip = HIP + b * 1.6;
        p.aF = [22 + b * 3, -14 - b * 4];
        p.aB = [-24 - b * 3, -14 - b * 4];
        p.bob = b;
        break;
    }
    return p;
  }

  /* draw a tapered limb with outline + highlight */
  function limb(c, x1, y1, x2, y2, r1, r2, col, dark, hi) {
    SB.capsule(c, x1, y1, x2, y2, r1, r2);
    c.fillStyle = col; c.fill();
    c.strokeStyle = dark; c.lineWidth = 2.6; c.lineJoin = 'round'; c.stroke();
    if (hi) {
      c.save(); c.globalAlpha = .38;
      SB.capsule(c, x1 - r1 * .3, y1 - r1 * .25, x2 - r2 * .3, y2 - r2 * .25, r1 * .42, r2 * .42);
      c.fillStyle = hi; c.fill(); c.restore();
    }
  }

  /* ---------------- main character draw ---------------- */
  R.drawFighter = function (c, f, opt) {
    opt = opt || {};
    var C = f.char, col = C.col, L = C.look;
    var P = buildPose(f);
    var s = f.scale * (opt.scale || 1);
    var dark = 'rgba(26,18,40,.9)';

    c.save();
    c.translate(f.x, f.y + (opt.dy || 0));
    if (opt.alpha !== undefined) c.globalAlpha = opt.alpha;
    c.scale(f.facing * s, s);
    if (P.rot) { c.translate(0, HIP); c.rotate(P.rot); c.translate(0, -HIP); }
    if (P.lean) { c.translate(0, 0); c.rotate(P.lean * 0.5); }

    /* squash on land */
    if (f.landT > 0) { var q = f.landT / 6; c.scale(1 + q * .18, 1 - q * .18); }

    var hipY = P.hip, shoY = SHO + (hipY - HIP) * 0.55;
    var skinD = shade(col.skin, 0.72);
    var mainD = shade(col.main, 0.55);
    var mainL = mix(col.main, '#ffffff', 0.35);

    /* ---------- back arm & leg (shaded) ---------- */
    var bl = drawLeg(c, 0, hipY, P.lB, s, shade(col.main2, .68), shade(col.main2, .42), null, L);
    var ba = drawArm(c, 0, shoY, P.aB, s, shade(col.main, .6), shade(col.main, .34), shade(col.skin, .6), L, false);

    /* ---------- torso ---------- */
    drawTorso(c, hipY, shoY, col, L, dark, mainL, mainD, f);

    /* ---------- front leg ---------- */
    drawLeg(c, 0, hipY, P.lF, s, col.main2, shade(col.main2, .55), mix(col.main2, '#fff', .35), L);
    /* ---------- front arm ---------- */
    var fa = drawArm(c, 0, shoY, P.aF, s, col.main, mainD, col.skin, L, true);

    /* ---------- head ---------- */
    drawHead(c, NECK + (hipY - HIP) * 0.5, col, L, f, P);

    /* held item in front hand */
    if (f.heldItem === 'bomb' && fa) drawHeldBomb(c, fa.x, fa.y);
    if (f.heldItem === 'bat' && fa) drawBat(c, fa.x, fa.y, P.aF[0] + P.aF[1]);

    c.restore();

    /* ---- status auras (screen space, unflipped) ---- */
    R.drawAura(c, f);
  };

  function drawLeg(c, x, y, a, s, col, dk, hi, L) {
    var k = jt(x, y, a[0], TH);
    var ft = jt(k.x, k.y, a[0] + a[1], SH);
    limb(c, x, y, k.x, k.y, 9.5, 8, col, dk, hi);
    limb(c, k.x, k.y, ft.x, ft.y, 8, 6.5, col, dk, hi);
    /* boot */
    c.save();
    c.translate(ft.x, ft.y); c.rotate((a[0] + a[1]) * SB.RAD * 0.6);
    c.beginPath(); SB.roundRect(c, -7, -5, 19, 11, 4);
    c.fillStyle = dk; c.fill();
    c.strokeStyle = 'rgba(20,14,30,.9)'; c.lineWidth = 2; c.stroke();
    c.globalAlpha = .35; c.fillStyle = '#fff'; c.fillRect(-5, -4, 15, 2.5);
    c.restore();
    return ft;
  }

  function drawArm(c, x, y, a, s, col, dk, skin, L, front) {
    var el = jt(x, y, a[0], UP);
    var hd = jt(el.x, el.y, a[0] + a[1], FA);
    limb(c, x, y, el.x, el.y, 8.5, 7, col, dk, mix(col, '#ffffff', .3));
    limb(c, el.x, el.y, hd.x, hd.y, 7, 5.5, L.armor ? col : skin, dk, '#ffffff');
    /* glove / fist */
    c.beginPath(); c.arc(hd.x, hd.y, 6.6, 0, 6.2832);
    c.fillStyle = L.armor ? dk : mix(skin, '#ffffff', .1); c.fill();
    c.strokeStyle = 'rgba(20,14,30,.85)'; c.lineWidth = 2; c.stroke();
    return hd;
  }

  function drawTorso(c, hipY, shoY, col, L, dark, mainL, mainD, f) {
    var wS = L.build === 'huge' ? 25 : (L.build === 'heavy' ? 23 : (L.build === 'slim' ? 16 : 19));
    var wH = L.build === 'huge' ? 16 : (L.build === 'heavy' ? 15 : (L.build === 'slim' ? 11 : 13));
    c.beginPath();
    c.moveTo(-wS, shoY + 2);
    c.quadraticCurveTo(-wS - 3, shoY + (hipY - shoY) * .5, -wH, hipY + 3);
    c.quadraticCurveTo(0, hipY + 8, wH, hipY + 3);
    c.quadraticCurveTo(wS + 3, shoY + (hipY - shoY) * .5, wS, shoY + 2);
    c.quadraticCurveTo(0, shoY - 9, -wS, shoY + 2);
    c.closePath();
    c.fillStyle = lg(c, 'torso' + col.main + L.build, -wS, shoY, wS, hipY, [[0, mainL], [0.45, col.main], [1, mainD]]);
    c.fill();
    c.strokeStyle = dark; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();

    /* chest highlight */
    c.save(); c.globalAlpha = .3; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(-wS * .35, shoY + 12, wS * .38, (hipY - shoY) * .3, -0.2, 0, 6.2832); c.fill();
    c.restore();

    /* trim / belt */
    c.fillStyle = col.acc;
    c.beginPath(); SB.roundRect(c, -wH - 2, hipY - 6, (wH + 2) * 2, 7, 3); c.fill();
    c.strokeStyle = dark; c.lineWidth = 1.8; c.stroke();

    /* chest emblem stripe */
    c.save(); c.globalAlpha = .9; c.strokeStyle = col.trim; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-wS * .55, shoY + 4); c.lineTo(wH * .3, hipY - 10); c.stroke();
    c.restore();

    if (L.armor) {
      /* shoulder plates */
      c.fillStyle = lg(c, 'plate' + col.trim, 0, shoY - 14, 0, shoY + 10, [[0, mix(col.trim, '#ffffff', .5)], [1, shade(col.trim, .55)]]);
      [[-1, 0], [1, 0]].forEach(function (d) {
        c.beginPath();
        c.moveTo(d[0] * (wS - 3), shoY - 6);
        c.quadraticCurveTo(d[0] * (wS + 12), shoY - 4, d[0] * (wS + 8), shoY + 12);
        c.quadraticCurveTo(d[0] * (wS - 2), shoY + 8, d[0] * (wS - 3), shoY - 6);
        c.closePath(); c.fill(); c.strokeStyle = dark; c.lineWidth = 2.4; c.stroke();
      });
    }
    if (L.scarf) {
      var fl = Math.sin(f.animT * 2.4) * 7 - (f.vx * 1.4);
      c.beginPath();
      c.moveTo(-7, shoY + 1);
      c.quadraticCurveTo(-24, shoY + 8 + fl * .3, -34 - Math.abs(f.vx) * 1.8, shoY + 24 + fl);
      c.quadraticCurveTo(-30, shoY + 30 + fl, -20, shoY + 26 + fl * .7);
      c.quadraticCurveTo(-16, shoY + 14, -5, shoY + 9);
      c.closePath();
      c.fillStyle = lg(c, 'scarf' + col.acc, -34, shoY, 0, shoY + 26, [[0, shade(col.acc, .72)], [1, col.acc]]);
      c.fill();
      c.strokeStyle = dark; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.ellipse(0, shoY - 1, 12, 6.5, 0, 0, 6.2832);
      c.fillStyle = col.acc; c.fill(); c.stroke();
      c.save(); c.globalAlpha = .35; c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(-3, shoY - 3, 7, 2.6, 0, 0, 6.2832); c.fill(); c.restore();
    }
    if (L.cape) {
      var sw2 = Math.sin(f.animT * 1.8) * 8 - f.vx * 2.2;
      c.beginPath();
      c.moveTo(-wS + 2, shoY);
      c.quadraticCurveTo(-wS - 22 + sw2 * .4, hipY - 6, -wS - 14 + sw2, hipY + 34);
      c.quadraticCurveTo(-2, hipY + 26, wH - 2, hipY + 2);
      c.closePath();
      c.fillStyle = lg(c, 'cape' + col.main2, -40, shoY, 10, hipY + 30, [[0, shade(col.main2, .8)], [1, shade(col.main2, .42)]]);
      c.fill(); c.strokeStyle = dark; c.lineWidth = 2.4; c.stroke();
    }
    if (L.coat) {
      var sw3 = Math.sin(f.animT * 2) * 5 - f.vx * 1.4;
      c.beginPath();
      c.moveTo(-wH - 4, hipY - 4); c.lineTo(wH + 4, hipY - 4);
      c.quadraticCurveTo(wH + 8 + sw3 * .3, hipY + 26, wH - 2 + sw3, hipY + 40);
      c.lineTo(-wH + 2 + sw3 * .6, hipY + 40);
      c.quadraticCurveTo(-wH - 10 + sw3 * .3, hipY + 24, -wH - 4, hipY - 4);
      c.closePath();
      c.fillStyle = lg(c, 'coat' + col.main2, 0, hipY, 0, hipY + 44, [[0, col.main2], [1, shade(col.main2, .4)]]);
      c.fill(); c.strokeStyle = dark; c.lineWidth = 2.4; c.stroke();
    }
  }

  function drawHead(c, neckY, col, L, f, P) {
    var hy = neckY - 15, dark = 'rgba(26,18,40,.9)';
    var h1 = col.hair, h2 = col.hair2;
    var sw = Math.sin(f.animT * 2) * 2.5 - f.vx * 0.5;
    c.save();
    c.translate(0, hy);
    c.rotate((P.headA || 0) * SB.RAD + (P.bob || 0) * 0.02);
    var hg = lg(c, 'hair' + h1, 0, -HEADR - 10, 0, 10, [[0, mix(h1, '#ffffff', .3)], [0.55, h1], [1, h2]]);

    /* ---------- hair behind the head ---------- */
    c.fillStyle = hg; c.strokeStyle = dark; c.lineWidth = 2.4; c.lineJoin = 'round';
    if (L.hair === 'long') {
      c.beginPath();
      c.moveTo(-2, -HEADR - 7);
      c.quadraticCurveTo(-HEADR - 13, -HEADR - 2, -HEADR - 11 + sw * .4, 16);
      c.quadraticCurveTo(-HEADR - 16 + sw, 34, -HEADR - 4 + sw * 1.2, 42);
      c.quadraticCurveTo(HEADR - 6, 40, HEADR + 2, 16);
      c.quadraticCurveTo(HEADR + 5, -4, HEADR - 2, -HEADR - 2);
      c.closePath(); c.fill(); c.stroke();
    } else if (L.hair === 'pony') {
      c.beginPath();
      c.moveTo(-HEADR + 3, -9);
      c.quadraticCurveTo(-HEADR - 20 + sw, -16 + sw, -HEADR - 31 + sw * 1.7, 5 + sw);
      c.quadraticCurveTo(-HEADR - 26 + sw, 12 + sw, -HEADR - 20 + sw * .8, 8);
      c.quadraticCurveTo(-HEADR - 10, 0, -HEADR + 2, -1);
      c.closePath(); c.fill(); c.stroke();
    } else if (L.hair === 'hood') {
      c.beginPath();
      c.moveTo(2, -HEADR - 6);
      c.quadraticCurveTo(-HEADR - 16, -HEADR, -HEADR - 13, 10);
      c.quadraticCurveTo(-HEADR - 10 + sw * .5, 26, -2, 22);
      c.quadraticCurveTo(HEADR - 2, 16, HEADR, -2);
      c.closePath();
      c.fillStyle = lg(c, 'hoodb' + h1, 0, -HEADR, 0, 24, [[0, h1], [1, h2]]);
      c.fill(); c.stroke();
      c.fillStyle = hg;
    } else if (L.hair === 'spike' || L.hair === 'crop') {
      c.beginPath(); c.ellipse(-3, -6, HEADR + 1, HEADR + 2, 0, 0, 6.2832);
      c.fill(); c.stroke();
    }

    /* ---------- neck ---------- */
    c.beginPath(); SB.roundRect(c, -5, 6, 10, 13, 4);
    c.fillStyle = shade(col.skin, .72); c.fill();
    c.strokeStyle = dark; c.lineWidth = 2; c.stroke();

    /* ---------- head shape ---------- */
    c.beginPath();
    c.moveTo(-HEADR, -2);
    c.quadraticCurveTo(-HEADR, -HEADR - 5, 0, -HEADR - 5);
    c.quadraticCurveTo(HEADR, -HEADR - 5, HEADR, -2);
    c.quadraticCurveTo(HEADR - 1, 9, 3, 14);
    c.quadraticCurveTo(-6, 13, -HEADR, -2);
    c.closePath();
    c.fillStyle = rg(c, 'face' + col.skin, -5, -8, 2, 0, 0, 22, [[0, mix(col.skin, '#ffffff', .35)], [0.6, col.skin], [1, shade(col.skin, .78)]]);
    c.fill(); c.strokeStyle = dark; c.lineWidth = 2.6; c.stroke();

    /* ear */
    c.beginPath(); c.ellipse(-10, 1, 3.2, 4.6, 0, 0, 6.2832);
    c.fillStyle = shade(col.skin, .85); c.fill(); c.lineWidth = 1.6; c.stroke();

    /* ---------- face ---------- */
    var blink = (f.blink > 0 && f.blink < 6);
    var angry = (f.pose && f.pose.indexOf('smash') >= 0) || f.pose === 'sp_gouken' || f.charging;
    var hurt = f.pose === 'hit';
    if (!L.visor && L.hair !== 'helm') {
      c.fillStyle = '#1a1428';
      if (blink) {
        c.lineWidth = 2; c.strokeStyle = '#1a1428';
        c.beginPath(); c.moveTo(3, -3); c.lineTo(9.5, -3); c.moveTo(-3.2, -2.6); c.lineTo(-0.2, -2.6); c.stroke();
      } else {
        c.beginPath(); c.ellipse(6.8, -2.6, 2.7, hurt ? 2.2 : 3.7, 0, 0, 6.2832); c.fill();
        c.fillStyle = col.eye;
        c.beginPath(); c.ellipse(6.8, -3.8, 1.6, 1.9, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(7.7, -4.5, 1.05, 0, 6.2832); c.fill();
        c.fillStyle = '#1a1428';
        c.beginPath(); c.ellipse(-1.6, -2.3, 1.9, hurt ? 1.8 : 3.3, 0, 0, 6.2832); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(-1.0, -3.9, 0.8, 0, 6.2832); c.fill();
      }
      c.strokeStyle = shade(h1, .8); c.lineWidth = 2.3; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(2.8, angry ? -7.4 : -8.6); c.lineTo(10.2, angry ? -6.0 : -7.8);
      c.moveTo(-4.4, angry ? -7.0 : -8.2); c.lineTo(-0.6, angry ? -7.6 : -8.4);
      c.stroke();
      c.strokeStyle = 'rgba(40,20,30,.8)'; c.lineWidth = 1.8;
      c.beginPath();
      if (angry || hurt) { c.moveTo(2.6, 5); c.quadraticCurveTo(6.4, 9.6, 10, 5); }
      else { c.moveTo(4, 6); c.lineTo(9, 6); }
      c.stroke();
      /* cheek blush */
      c.save(); c.globalAlpha = .22; c.fillStyle = '#ff7a7a';
      c.beginPath(); c.ellipse(9, 2.5, 3.6, 2.1, 0, 0, 6.2832); c.fill(); c.restore();
    }

    /* ---------- hair / headgear in front ---------- */
    c.fillStyle = hg; c.strokeStyle = dark; c.lineWidth = 2.4; c.lineJoin = 'round';
    if (L.hair === 'spike') {
      c.beginPath();
      c.moveTo(-HEADR - 1, -1);
      c.quadraticCurveTo(-HEADR - 3, -HEADR - 11, -3, -HEADR - 10);
      c.lineTo(1, -HEADR - 17); c.lineTo(7, -HEADR - 8);
      c.lineTo(13, -HEADR - 13); c.lineTo(HEADR + 2, -3);
      c.lineTo(HEADR - 2, -6);
      c.quadraticCurveTo(9, -HEADR + 1, 1, -HEADR + 2);
      c.quadraticCurveTo(-6, -HEADR + 1, -HEADR + 1, -5);
      c.closePath(); c.fill(); c.stroke();
    } else if (L.hair === 'crop') {
      c.beginPath();
      c.moveTo(-HEADR - 1, -2); c.quadraticCurveTo(-HEADR - 2, -HEADR - 8, 0, -HEADR - 8);
      c.quadraticCurveTo(HEADR + 2, -HEADR - 7, HEADR + 1, -4);
      c.quadraticCurveTo(HEADR - 4, -HEADR + 2, -2, -HEADR + 3);
      c.quadraticCurveTo(-HEADR + 2, -HEADR + 2, -HEADR + 1, -6);
      c.closePath(); c.fill(); c.stroke();
      if (L.band) {
        c.fillStyle = col.acc;
        c.beginPath(); SB.roundRect(c, -HEADR - 2, -10, HEADR * 2 + 4, 6, 2); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-HEADR - 1, -8);
        c.quadraticCurveTo(-HEADR - 15 + sw, -3, -HEADR - 12 + sw * 1.4, 12);
        c.quadraticCurveTo(-HEADR - 7, 2, -HEADR - 1, -4); c.closePath(); c.fill(); c.stroke();
      }
    } else if (L.hair === 'pony') {
      c.beginPath();
      c.moveTo(-HEADR - 1, -3); c.quadraticCurveTo(-HEADR - 2, -HEADR - 9, 1, -HEADR - 9);
      c.quadraticCurveTo(HEADR + 3, -HEADR - 6, HEADR + 1, -5);
      c.lineTo(HEADR - 3, -8);
      c.quadraticCurveTo(6, -HEADR + 1, -3, -HEADR + 2);
      c.quadraticCurveTo(-HEADR + 1, -HEADR + 1, -HEADR + 1, -7);
      c.closePath(); c.fill(); c.stroke();
    } else if (L.hair === 'long') {
      c.beginPath();
      c.moveTo(-HEADR - 2, -3);
      c.quadraticCurveTo(-HEADR - 3, -HEADR - 8, 0, -HEADR - 8);
      c.quadraticCurveTo(HEADR + 3, -HEADR - 7, HEADR + 2, -2);
      c.lineTo(HEADR - 1, -7);
      c.quadraticCurveTo(HEADR - 4, -HEADR + 3, 4, -HEADR + 2);
      c.lineTo(0, -6);
      c.quadraticCurveTo(-4, -HEADR + 3, -HEADR + 2, -HEADR + 4);
      c.closePath(); c.fill(); c.stroke();
      /* side lock in front of the shoulder */
      c.beginPath();
      c.moveTo(HEADR, -6);
      c.quadraticCurveTo(HEADR + 5, 10, HEADR - 1, 26);
      c.quadraticCurveTo(HEADR - 6, 12, HEADR - 5, -4);
      c.closePath(); c.fill(); c.stroke();
    } else if (L.hair === 'hood') {
      c.beginPath();
      c.moveTo(-HEADR - 4, 2);
      c.quadraticCurveTo(-HEADR - 8, -HEADR - 13, 2, -HEADR - 12);
      c.quadraticCurveTo(HEADR + 7, -HEADR - 9, HEADR + 4, -7);
      c.lineTo(HEADR - 1, -8);
      c.quadraticCurveTo(HEADR - 5, -HEADR - 1, -1, -HEADR);
      c.quadraticCurveTo(-HEADR + 1, -HEADR + 1, -HEADR - 1, 3);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = col.acc; c.globalAlpha = .85;
      c.beginPath(); c.arc(-HEADR - 2, -HEADR - 3, 3.2, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
    } else if (L.hair === 'helm') {
      c.fillStyle = lg(c, 'helm' + col.trim, 0, -HEADR - 12, 0, 10, [[0, mix(col.trim, '#ffffff', .55)], [0.5, col.trim], [1, shade(col.trim, .5)]]);
      c.beginPath();
      c.moveTo(-HEADR - 3, 4);
      c.quadraticCurveTo(-HEADR - 4, -HEADR - 11, 0, -HEADR - 11);
      c.quadraticCurveTo(HEADR + 4, -HEADR - 10, HEADR + 3, 0);
      c.lineTo(HEADR + 1, 7); c.lineTo(-2, 5);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#141a26';
      c.beginPath(); SB.roundRect(c, -2, -7, HEADR + 5, 7.5, 3); c.fill();
      c.fillStyle = col.acc; c.globalAlpha = .95;
      c.beginPath(); SB.roundRect(c, 1, -5.5, HEADR, 3.4, 1.6); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = col.acc;
      c.beginPath(); c.moveTo(-3, -HEADR - 10); c.lineTo(2, -HEADR - 21); c.lineTo(7, -HEADR - 9); c.closePath();
      c.fill(); c.strokeStyle = dark; c.stroke();
      c.save(); c.globalAlpha = .4; c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(-2, -HEADR - 2, 7, 3.4, -0.3, 0, 6.2832); c.fill(); c.restore();
    }
    if (L.visor) {
      c.fillStyle = 'rgba(40,255,230,.8)';
      c.beginPath(); SB.roundRect(c, -4, -8, HEADR + 8, 7.5, 3.5); c.fill();
      c.strokeStyle = dark; c.lineWidth = 2; c.stroke();
      c.globalAlpha = .65; c.fillStyle = '#fff';
      c.beginPath(); SB.roundRect(c, 0, -6.6, 5, 2.4, 1.2); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(40,20,30,.8)'; c.lineWidth = 1.8;
      c.beginPath();
      if (angry) { c.moveTo(2.6, 5); c.quadraticCurveTo(6.4, 9.6, 10, 5); } else { c.moveTo(4, 6); c.lineTo(9, 6); }
      c.stroke();
    }
    c.restore();
  }

  function drawHeldBomb(c, x, y) {
    c.save(); c.translate(x, y - 8);
    c.beginPath(); c.arc(0, 0, 9, 0, 6.2832);
    c.fillStyle = rg(c, 'bombh', -3, -3, 1, 0, 0, 10, [[0, '#6b7285'], [1, '#171a24']]);
    c.fill(); c.strokeStyle = 'rgba(10,12,20,.9)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#c9a26a'; c.lineWidth = 2; c.beginPath();
    c.moveTo(3, -8); c.quadraticCurveTo(9, -14, 5, -18); c.stroke();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(5, -19, 2.6, 0, 6.2832); c.fill();
    c.restore();
  }
  function drawBat(c, x, y, ang) {
    c.save(); c.translate(x, y); c.rotate(ang * SB.RAD - 0.3);
    c.beginPath(); SB.capsule(c, 0, 0, 0, -40, 4, 8);
    c.fillStyle = lg(c, 'bat', -8, 0, 8, -40, [[0, '#ffd9a0'], [1, '#b57433']]);
    c.fill(); c.strokeStyle = 'rgba(40,24,10,.9)'; c.lineWidth = 2; c.stroke();
    c.restore();
  }

  /* status auras drawn in world space, not mirrored */
  R.drawAura = function (c, f) {
    var cy = f.y - 52 * f.scale, r = 44 * f.scale;
    if (f.buff.barrier > 0) {
      c.save();
      var a = 0.32 + Math.sin(R.t * 0.2) * 0.1;
      c.globalAlpha = a;
      c.fillStyle = rg(c, 'barrier', 0, 0, r * .4, 0, 0, r * 1.25, [[0, 'rgba(120,230,255,0)'], [0.75, 'rgba(120,230,255,.55)'], [1, 'rgba(200,245,255,.9)']]);
      c.translate(f.x, cy); c.beginPath(); c.arc(0, 0, r * 1.25, 0, 6.2832); c.fill();
      c.globalAlpha = a * 1.4; c.strokeStyle = '#bff0ff'; c.lineWidth = 2.5; c.stroke();
      c.restore();
    }
    if (f.armorT > 0) {
      c.save(); c.globalAlpha = .5 + Math.sin(R.t * 0.35) * 0.15;
      c.translate(f.x, cy);
      c.strokeStyle = '#ffb03a'; c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, r * 1.05, 0, 6.2832); c.stroke();
      c.globalAlpha = .25; c.strokeStyle = '#fff0c0'; c.lineWidth = 9;
      c.beginPath(); c.arc(0, 0, r * 1.05, 0, 6.2832); c.stroke();
      c.restore();
    }
    if (f.buff.speed > 0) {
      c.save(); c.globalAlpha = .5;
      c.strokeStyle = '#ff8ae8'; c.lineWidth = 2.5;
      for (var i = 0; i < 3; i++) {
        var o = (R.t * 6 + i * 30) % 90;
        c.beginPath();
        c.moveTo(f.x - f.facing * (20 + o) * f.scale, cy - 20 + i * 18);
        c.lineTo(f.x - f.facing * (46 + o) * f.scale, cy - 20 + i * 18);
        c.stroke();
      }
      c.restore();
    }
    if (f.buff.slow > 0) {
      c.save(); c.globalAlpha = .45; c.fillStyle = '#bff0ff';
      c.translate(f.x, cy);
      for (var j = 0; j < 5; j++) {
        var an = R.t * 0.05 + j * 1.25;
        c.beginPath(); c.arc(Math.cos(an) * r, Math.sin(an) * r * .9, 3.5, 0, 6.2832); c.fill();
      }
      c.restore();
    }
    if (f.invul > 0 && f.dead === 0) { /* blink handled by alpha in caller */ }
  };

  /* ============================================================ effects ============ */
  R.drawFx = function (c, g) {
    var fx = g.fx, i, p;
    c.save();
    /* ghosts (afterimages) */
    for (i = 0; i < fx.ghosts.length; i++) {
      p = fx.ghosts[i];
      c.save(); c.globalAlpha = p.life * 0.5;
      var gf = p.f; gf.act = null; gf.buff = { barrier: 0, atk: 0, speed: 0, slow: 0 }; gf.armorT = 0;
      gf.landT = 0; gf.heldItem = null; gf.invul = 0; gf.blink = 0;
      R.drawFighter(c, gf, { alpha: p.life * 0.5 });
      c.restore();
    }
    /* slashes */
    c.lineCap = 'round';
    for (i = 0; i < fx.slashes.length; i++) {
      p = fx.slashes[i];
      c.save(); c.translate(p.x, p.y); c.rotate(p.a);
      c.globalAlpha = p.life * .85;
      var L2 = p.len * (1.1 - p.life * 0.25);
      c.beginPath();
      c.moveTo(-L2 * .5, -L2 * .55);
      c.quadraticCurveTo(L2 * .75, 0, -L2 * .5, L2 * .55);
      c.quadraticCurveTo(L2 * .2, 0, -L2 * .5, -L2 * .55);
      c.closePath();
      c.fillStyle = p.col; c.fill();
      c.globalAlpha = p.life * .5; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
      c.restore();
    }
    /* rings */
    for (i = 0; i < fx.rings.length; i++) {
      p = fx.rings[i];
      c.save(); c.globalAlpha = p.life * .8;
      c.strokeStyle = p.col; c.lineWidth = p.w * p.life;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.2832); c.stroke();
      c.restore();
    }
    /* particles */
    for (i = 0; i < fx.parts.length; i++) {
      p = fx.parts[i];
      c.globalAlpha = Math.min(1, p.life);
      c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y, p.r * p.life, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
  };

  R.drawFxText = function (c, g, view) {
    var fx = g.fx;
    for (var i = 0; i < fx.texts.length; i++) {
      var p = fx.texts[i];
      var s = R.w2s(p.x, p.y, view);
      if (s.x < -60 || s.x > view.x + view.w + 60) continue;
      c.save();
      c.globalAlpha = Math.min(1, p.life * 1.6);
      var sz = (p.big ? 30 : 19) * (1 + (1 - p.life) * 0.35);
      c.font = '900 ' + sz + 'px "Hiragino Kaku Gothic ProN",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = 'rgba(20,12,30,.85)';
      c.strokeText(p.t, s.x, s.y); c.fillStyle = p.col; c.fillText(p.t, s.x, s.y);
      c.restore();
    }
  };

  /* ============================================================ shots & items ============ */
  R.drawShots = function (c, g) {
    for (var i = 0; i < g.shots.length; i++) {
      var s = g.shots[i];
      c.save(); c.translate(s.x, s.y);
      if (s.kind === 'wave') {
        c.rotate(Math.atan2(s.vy, s.vx));
        c.globalAlpha = .95;
        c.beginPath(); c.ellipse(0, 0, 28, 16, 0, 0, 6.2832);
        c.fillStyle = rg(c, 'wave', 0, 0, 2, 0, 0, 28, [[0, '#ffffff'], [0.45, '#7ee8ff'], [1, 'rgba(60,160,255,0)']]);
        c.fill();
        c.globalAlpha = .8; c.strokeStyle = '#ffffff'; c.lineWidth = 2.5;
        c.beginPath(); c.ellipse(0, 0, 20, 10, 0, 0, 6.2832); c.stroke();
      } else if (s.kind === 'ice') {
        c.rotate(Math.atan2(s.vy, s.vx));
        c.fillStyle = lg(c, 'icearrow', -22, 0, 16, 0, [[0, 'rgba(180,240,255,0)'], [0.6, '#bff0ff'], [1, '#ffffff']]);
        c.beginPath(); c.moveTo(18, 0); c.lineTo(-6, -8); c.lineTo(-22, 0); c.lineTo(-6, 8); c.closePath(); c.fill();
        c.strokeStyle = '#7fd8ff'; c.lineWidth = 2; c.stroke();
      } else if (s.kind === 'bomb') {
        c.rotate(s.t * 0.2);
        c.beginPath(); c.arc(0, 0, 13, 0, 6.2832);
        c.fillStyle = rg(c, 'bombp', -4, -4, 1, 0, 0, 14, [[0, '#6b7285'], [1, '#171a24']]); c.fill();
        c.strokeStyle = 'rgba(10,12,20,.9)'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(7, -12, 3 + Math.sin(s.t) * 1.2, 0, 6.2832); c.fill();
      }
      c.restore();
    }
  };

  R.drawItems = function (c, g) {
    for (var i = 0; i < g.items.length; i++) {
      var it = g.items[i], d = SB.ITEMS[it.type];
      c.save(); c.translate(it.x, it.y - 18);
      if (it.para) {
        c.save(); c.translate(0, -34);
        c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(0, -34, 26, 0);
        c.quadraticCurveTo(13, 8, 0, 0); c.quadraticCurveTo(-13, 8, -26, 0); c.closePath();
        c.fillStyle = lg(c, 'para', -26, -20, 26, 6, [[0, '#ff8a8a'], [0.5, '#fff6d0'], [1, '#8ac9ff']]);
        c.fill(); c.strokeStyle = 'rgba(40,30,50,.75)'; c.lineWidth = 2; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(-22, 2); c.lineTo(-5, 30); c.moveTo(22, 2); c.lineTo(5, 30); c.stroke();
        c.restore();
      }
      var bob = it.onG ? Math.sin(it.t * 0.08) * 2 : 0;
      c.translate(0, bob);
      /* capsule body */
      c.beginPath(); SB.roundRect(c, -16, -16, 32, 32, 10);
      c.fillStyle = lg(c, 'itm' + it.type, -16, -16, 16, 16, [[0, mix(d.col, '#ffffff', .5)], [0.55, d.col], [1, d.col2]]);
      c.fill();
      c.strokeStyle = 'rgba(20,16,30,.85)'; c.lineWidth = 3; c.stroke();
      c.globalAlpha = .35; c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(-5, -8, 8, 5, -0.4, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
      drawIcon(c, d.icon);
      /* glow */
      c.globalAlpha = .35 + Math.sin(it.t * 0.12) * 0.15;
      c.strokeStyle = d.col; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, 22, 0, 6.2832); c.stroke();
      c.restore();
    }
  };

  function drawIcon(c, k) {
    c.save();
    c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
    if (k === 'heart') {
      c.beginPath(); c.moveTo(0, 7);
      c.bezierCurveTo(-12, -2, -7, -11, 0, -5);
      c.bezierCurveTo(7, -11, 12, -2, 0, 7); c.fill();
    } else if (k === 'bomb') {
      c.beginPath(); c.arc(-1, 2, 7, 0, 6.2832); c.fill();
      c.beginPath(); c.moveTo(3, -4); c.quadraticCurveTo(9, -9, 5, -12); c.stroke();
    } else if (k === 'bat') {
      c.beginPath(); SB.capsule(c, -7, 8, 6, -9, 2.6, 5); c.fill();
    } else if (k === 'shield') {
      c.beginPath(); c.moveTo(0, -9); c.lineTo(9, -5); c.lineTo(9, 3);
      c.quadraticCurveTo(6, 9, 0, 11); c.quadraticCurveTo(-6, 9, -9, 3);
      c.lineTo(-9, -5); c.closePath(); c.fill();
    } else if (k === 'bolt') {
      c.beginPath(); c.moveTo(3, -11); c.lineTo(-6, 1); c.lineTo(0, 1); c.lineTo(-3, 11); c.lineTo(7, -2); c.lineTo(1, -2); c.closePath(); c.fill();
    }
    c.restore();
  }

  /* ============================================================ HUD ============ */
  var STOCK_COL = ['#ff5a5a', '#4ab8ff', '#57e07a', '#ffd24a'];
  R.stockCol = function (i) { return STOCK_COL[i % 4]; };

  R.drawHUD = function (c, g, view, L) {
    var n = g.fighters.length;
    var bottom = view.y + view.h;
    var wdt = Math.min(116, (view.w - 24) / n - 8);
    var hgt = wdt * 0.42;
    var gap = 8;
    var total = n * wdt + (n - 1) * gap;
    var x0 = view.x + (view.w - total) / 2;
    var y0 = bottom - hgt - (L && L.portrait ? 6 : 10);
    if (!L || !L.portrait) y0 = bottom - hgt - 8;

    for (var i = 0; i < n; i++) {
      var f = g.fighters[i];
      var x = x0 + i * (wdt + gap);
      c.save();
      c.globalAlpha = f.stocks > 0 ? 0.94 : 0.4;
      /* card */
      c.beginPath(); SB.roundRect(c, x, y0, wdt, hgt, 10);
      c.fillStyle = lg(c, 'hud' + i, x, y0, x, y0 + hgt, [[0, 'rgba(24,32,64,.9)'], [1, 'rgba(10,14,32,.92)']]);
      c.fill();
      c.lineWidth = 2.5; c.strokeStyle = STOCK_COL[i % 4]; c.stroke();
      /* char color chip */
      c.beginPath(); SB.roundRect(c, x + 5, y0 + 5, 16, 16, 5);
      c.fillStyle = f.char.col.main; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.5)'; c.stroke();
      /* name */
      c.fillStyle = '#dbe6ff'; c.textAlign = 'left'; c.textBaseline = 'top';
      c.font = '700 ' + Math.round(hgt * 0.21) + 'px "Hiragino Kaku Gothic ProN",sans-serif';
      c.fillText(f.name, x + 25, y0 + 6);
      /* stocks */
      for (var s = 0; s < Math.min(f.stocks, 5); s++) {
        c.beginPath(); c.arc(x + 29 + s * 11, y0 + hgt - 9, 4, 0, 6.2832);
        c.fillStyle = STOCK_COL[i % 4]; c.fill();
        c.lineWidth = 1.4; c.strokeStyle = 'rgba(255,255,255,.65)'; c.stroke();
      }
      /* percent */
      var pc = f.percent;
      var col = pc < 40 ? '#ffffff' : pc < 80 ? '#ffe36a' : pc < 130 ? '#ff9a3c' : '#ff4a4a';
      c.textAlign = 'right'; c.textBaseline = 'alphabetic';
      var fs = Math.round(hgt * 0.62);
      c.font = '900 italic ' + fs + 'px "Hiragino Kaku Gothic ProN",sans-serif';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.65)';
      var pt = Math.floor(pc) + '';
      c.strokeText(pt, x + wdt - 16, y0 + hgt - 6);
      c.fillStyle = col; c.fillText(pt, x + wdt - 16, y0 + hgt - 6);
      c.font = '900 italic ' + Math.round(fs * 0.5) + 'px sans-serif';
      c.strokeText('%', x + wdt - 4, y0 + hgt - 7);
      c.fillText('%', x + wdt - 4, y0 + hgt - 7);
      c.restore();
    }

    /* offscreen markers */
    for (i = 0; i < n; i++) {
      var ff = g.fighters[i];
      if (ff.dead > 0 || ff.stocks <= 0) continue;
      var p = R.w2s(ff.x, ff.y - 50 * ff.scale, view);
      var pad = 26;
      if (p.x > view.x + pad && p.x < view.x + view.w - pad && p.y > view.y + pad && p.y < view.y + view.h - pad) continue;
      var cx2 = SB.clamp(p.x, view.x + pad, view.x + view.w - pad);
      var cy2 = SB.clamp(p.y, view.y + pad, view.y + view.h - pad - 40);
      var ang = Math.atan2(p.y - cy2, p.x - cx2);
      c.save(); c.translate(cx2, cy2);
      c.globalAlpha = .9;
      c.rotate(ang);
      c.beginPath(); c.moveTo(16, 0); c.lineTo(2, -10); c.lineTo(2, 10); c.closePath();
      c.fillStyle = STOCK_COL[i % 4]; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      c.rotate(-ang);
      c.beginPath(); c.arc(0, 0, 13, 0, 6.2832);
      c.fillStyle = 'rgba(10,14,32,.85)'; c.fill(); c.strokeStyle = STOCK_COL[i % 4]; c.stroke();
      c.fillStyle = '#fff'; c.font = '900 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((i + 1) + 'P', 0, 1);
      c.restore();
    }
  };

  /* big announcements */
  R.drawAnnounce = function (c, g, view) {
    var txt = null, col = '#ffd24a', sc = 1;
    if (g.intro > 110) { txt = 'READY?'; sc = 1 - (g.intro - 110) / 40 * 0.2; }
    else if (g.intro > 20) { txt = '' + SB.clamp(Math.ceil((g.intro - 20) / 30), 1, 3); col = '#ffffff'; }
    else if (g.intro > 0) { txt = 'GO!'; col = '#7ee87e'; sc = 1 + (20 - g.intro) / 20 * 0.5; }
    else if (g.over) { txt = 'GAME SET'; col = '#ffd24a'; }
    if (!txt) return;
    c.save();
    c.translate(view.x + view.w / 2, view.y + view.h * 0.36);
    c.scale(sc, sc);
    c.font = '900 italic ' + Math.round(Math.min(view.w * 0.13, 72)) + 'px "Hiragino Kaku Gothic ProN",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = 'rgba(12,8,26,.8)'; c.strokeText(txt, 0, 0);
    var gr = c.createLinearGradient(0, -40, 0, 40);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, 0.6));
    c.fillStyle = gr; c.fillText(txt, 0, 0);
    c.restore();
  };

  /* ============================================================ full frame ============ */
  R.draw = function (c, g, L) {
    this.t++;
    var view = L.view;
    this.view = view;
    var n = g.fighters.length;
    this.hudPad = Math.min(116, (view.w - 24) / n - 8) * 0.42 + 18;
    this.updateCam(g, view);

    c.save();
    c.beginPath(); c.rect(view.x, view.y, view.w, view.h); c.clip();
    this.drawBg(c, g, view);

    c.save();
    this.applyCam(c, view, g.fx);

    this.drawStage(c, g);
    this.drawItems(c, g);

    /* shadows */
    for (var i = 0; i < g.fighters.length; i++) {
      var f = g.fighters[i];
      if (f.dead > 0) continue;
      var gy = groundBelow(g, f);
      if (gy !== null && gy - f.y < 420) {
        c.save();
        var k = 1 - SB.clamp((gy - f.y) / 420, 0, 1);
        c.globalAlpha = 0.3 * k;
        c.fillStyle = '#000';
        c.beginPath(); c.ellipse(f.x, gy + 3, 22 * f.scale * (0.5 + k * 0.5), 6 * f.scale, 0, 0, 6.2832);
        c.fill(); c.restore();
      }
    }

    this.drawFx(c, g);
    this.drawShots(c, g);

    for (i = 0; i < g.fighters.length; i++) {
      f = g.fighters[i];
      if (f.dead > 0) continue;
      var al = 1;
      if (f.invul > 0 && f.hitstun === 0) al = 0.45 + Math.abs(Math.sin(this.t * 0.4)) * 0.5;
      /* player marker */
      drawMarker(c, f, i);
      this.drawFighter(c, f, { alpha: al });
      if (f.charging) drawChargeAura(c, f);
    }
    c.restore();

    this.drawFxText(c, g, view);
    this.drawHUD(c, g, view, L);
    this.drawAnnounce(c, g, view);

    if (g.fx.flash > 0) {
      c.save(); c.globalAlpha = Math.min(0.8, g.fx.flash);
      c.fillStyle = '#ffffff'; c.fillRect(view.x, view.y, view.w, view.h); c.restore();
    }
    c.restore();
  };

  function groundBelow(g, f) {
    var plats = g.platsActive(), best = null;
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (f.x > p.x - 8 && f.x < p.x + p.w + 8 && p.y >= f.y - 4) {
        if (best === null || p.y < best) best = p.y;
      }
    }
    return best;
  }

  function drawMarker(c, f, i) {
    var y = f.y - 118 * f.scale;
    c.save(); c.globalAlpha = .9;
    c.translate(f.x, y);
    c.beginPath(); c.moveTo(0, 8); c.lineTo(-7, -3); c.lineTo(7, -3); c.closePath();
    c.fillStyle = STOCK_COL[i % 4]; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
    c.restore();
  }

  function drawChargeAura(c, f) {
    var k = f.charge / 60;
    c.save();
    c.translate(f.x, f.y - 50 * f.scale);
    c.globalAlpha = 0.25 + k * 0.4;
    var r = (36 + k * 28) * f.scale;
    c.fillStyle = rg(c, 'chg', 0, 0, r * .2, 0, 0, r, [[0, 'rgba(255,240,160,.9)'], [0.6, 'rgba(255,170,50,.45)'], [1, 'rgba(255,120,20,0)']]);
    c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
    c.globalAlpha = 0.6 + k * 0.3;
    c.strokeStyle = k > 0.85 ? '#fff' : '#ffd24a'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, r * 0.75, -1.57, -1.57 + 6.2832 * k); c.stroke();
    c.restore();
  }

  /* ============================================================ portraits (select UI) ============ */
  R.portrait = function (canvas, charId, sel) {
    var C = SB.charById(charId);
    var dpr = Math.min(2, w.devicePixelRatio || 1);
    var cw = canvas.clientWidth || 90, chh = canvas.clientHeight || 120;
    canvas.width = cw * dpr; canvas.height = chh * dpr;
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, chh);
    /* bg */
    var g = c.createLinearGradient(0, 0, 0, chh);
    g.addColorStop(0, mix(C.col.main, '#ffffff', 0.25));
    g.addColorStop(1, shade(C.col.main2, 0.6));
    c.fillStyle = g; c.fillRect(0, 0, cw, chh);
    c.save(); c.globalAlpha = .14; c.fillStyle = '#fff';
    for (var i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 26, chh); c.lineTo(i * 26 + 16, 0); c.lineTo(i * 26 + 26, 0); c.lineTo(i * 26 + 10, chh); c.closePath(); c.fill(); }
    c.restore();

    var fake = {
      x: 0, y: 0, vx: 0, vy: 0, facing: 1, scale: 1, char: C, charId: C.id,
      pose: 'idle', poseT: 0, animT: 1.1, lean: 0.04, act: null, charging: false,
      buff: { atk: 0, speed: 0, barrier: 0, slow: 0 }, armorT: 0, landT: 0,
      heldItem: null, invul: 0, blink: 0, percent: 0
    };
    var sc = chh / 112;
    c.save();
    c.beginPath(); c.rect(0, 0, cw, chh); c.clip();
    c.translate(cw * 0.5, chh * 1.10);
    c.scale(sc, sc);
    R.drawFighter(c, fake, {});
    c.restore();
    return canvas;
  };

  R.stageThumb = function (canvas, stageId) {
    var st = SB.makeStage(stageId);
    var dpr = Math.min(2, w.devicePixelRatio || 1);
    var cw = canvas.clientWidth || 160, chh = canvas.clientHeight || 100;
    canvas.width = cw * dpr; canvas.height = chh * dpr;
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var sk = c.createLinearGradient(0, 0, 0, chh);
    SKY[st.theme].forEach(function (s) { sk.addColorStop(s[0], s[1]); });
    c.fillStyle = sk; c.fillRect(0, 0, cw, chh);
    var g = { stage: st, fx: null };
    var saveCam = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
    R.cam.x = 0; R.cam.y = -110; R.cam.z = 1;
    c.save();
    c.translate(cw / 2, chh / 2);
    var z = Math.min(cw / 1050, chh / 620);
    c.scale(z, z); c.translate(0, 120);
    /* simple bg silhouettes */
    c.save(); c.globalAlpha = .35;
    if (st.theme === 'grass') { c.fillStyle = '#4b9b63'; hills(c, 700, 120, 5, 0); }
    else if (st.theme === 'ruins') { c.fillStyle = '#3a2c52'; for (var i = -3; i <= 3; i++) c.fillRect(i * 260, -160, 50, 400); }
    else { c.fillStyle = '#ffffff'; for (i = -2; i <= 2; i++) cloud(c, i * 320, -160 + (i % 2) * 90, 1.6, .5); }
    c.restore();
    R.drawStage(c, g);
    c.restore();
    R.cam.x = saveCam.x; R.cam.y = saveCam.y; R.cam.z = saveCam.z;
    return canvas;
  };

})(window);
