/* ================= SMASH BRO : game engine ================= */
(function (w) {
  'use strict';
  var SB = w.SB, K = SB.K;

  /* ============================================================ FX ============ */
  function FX() {
    this.parts = []; this.rings = []; this.texts = []; this.slashes = []; this.ghosts = [];
    this.shake = 0; this.flash = 0; this.zoomPunch = 0;
  }
  FX.prototype.burst = function (x, y, col, n, spd, grav) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, s = spd * (0.4 + Math.random() * 0.9);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, dec: 0.028 + Math.random() * 0.03, col: col, r: 2 + Math.random() * 5, g: grav === undefined ? 0.12 : grav });
    }
  };
  FX.prototype.dir = function (x, y, ang, col, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = ang + (Math.random() - 0.5) * 1.1, s = spd * (0.4 + Math.random());
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, dec: 0.035 + Math.random() * 0.03, col: col, r: 2 + Math.random() * 4, g: 0.08 });
    }
  };
  FX.prototype.ring = function (x, y, col, r0, r1, wdt) {
    this.rings.push({ x: x, y: y, r: r0, r1: r1, life: 1, dec: 0.055, col: col, w: wdt || 6 });
  };
  FX.prototype.text = function (x, y, t, col, big) {
    this.texts.push({ x: x, y: y, t: t, col: col, life: 1, vy: -1.4, big: big ? 1 : 0 });
  };
  FX.prototype.slash = function (x, y, ang, len, col, curve) {
    this.slashes.push({ x: x, y: y, a: ang, len: len, col: col, life: 1, dec: 0.09, curve: curve || 1.5 });
  };
  FX.prototype.ghost = function (f, col, life) {
    this.ghosts.push({ f: snapshotPose(f), col: col, life: life || 1, dec: 0.05 });
  };
  FX.prototype.update = function () {
    var i, p;
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.97; p.life -= p.dec;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (i = this.rings.length - 1; i >= 0; i--) {
      p = this.rings[i]; p.r += (p.r1 - p.r) * 0.25; p.life -= p.dec;
      if (p.life <= 0) this.rings.splice(i, 1);
    }
    for (i = this.texts.length - 1; i >= 0; i--) {
      p = this.texts[i]; p.y += p.vy; p.vy *= 0.94; p.life -= 0.016;
      if (p.life <= 0) this.texts.splice(i, 1);
    }
    for (i = this.slashes.length - 1; i >= 0; i--) {
      p = this.slashes[i]; p.life -= p.dec;
      if (p.life <= 0) this.slashes.splice(i, 1);
    }
    for (i = this.ghosts.length - 1; i >= 0; i--) {
      p = this.ghosts[i]; p.life -= p.dec;
      if (p.life <= 0) this.ghosts.splice(i, 1);
    }
    if (this.shake > 0) this.shake *= 0.86;
    if (this.flash > 0) this.flash -= 0.06;
    if (this.zoomPunch > 0) this.zoomPunch *= 0.88;
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  };
  function snapshotPose(f) {
    return { x: f.x, y: f.y, facing: f.facing, scale: f.scale, char: f.char, pose: f.pose, poseT: f.poseT, animT: f.animT, vx: f.vx, vy: f.vy, lean: f.lean };
  }

  /* ============================================================ Fighter ============ */
  function Fighter(charId, idx, opts) {
    opts = opts || {};
    this.idx = idx;
    this.char = SB.charById(charId);
    this.charId = this.char.id;
    this.scale = this.char.scale;
    this.ctrl = opts.ctrl || 'human';       // human | cpu | remote
    this.padIndex = opts.padIndex === undefined ? 0 : opts.padIndex;
    this.cpuLv = opts.cpuLv === undefined ? 1 : opts.cpuLv;
    this.name = opts.name || this.char.name;
    this.tint = opts.tint || 0;             // palette variation for duplicates

    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.percent = 0;
    this.stocks = opts.stocks || 3;
    this.onGround = false; this.plat = null;
    this.jumps = 2; this.jumpHeld = false; this.jumpCut = false;
    this.state = 'air';
    this.act = null;
    this.hitstun = 0; this.hitlag = 0; this.invul = 60; this.armorT = 0;
    this.charge = 0; this.charging = false; this.chargeDir = 'f';
    this.combo = 0; this.comboT = 0;
    this.buff = { atk: 0, speed: 0, barrier: 0, slow: 0 };
    this.heldItem = null; this.itemT = 0;
    this.cool = 0;
    this.dead = 0; this.koT = 0;
    this.animT = 0; this.pose = 'idle'; this.poseT = 0; this.lean = 0;
    this.dropT = 0;
    this.landT = 0; this.blink = 0;
    this.damageDealt = 0; this.kos = 0; this.falls = 0;
    this.lastHitBy = -1;
    this.w = 17 * this.scale;
    this.h = 104 * this.scale;
    this.ai = null;
  }

  Fighter.prototype.hurtR = function () { return 30 * this.scale; };
  Fighter.prototype.cy = function () { return this.y - 52 * this.scale; };
  Fighter.prototype.alive = function () { return this.stocks > 0; };
  Fighter.prototype.busy = function () { return this.act !== null || this.state === 'jumpsq' || this.hitstun > 0 || this.dead > 0; };

  /* ============================================================ Game ============ */
  function Game(cfg) {
    this.cfg = cfg;
    this.stage = SB.makeStage(cfg.stageId);
    this.fx = new FX();
    this.fighters = [];
    this.items = [];
    this.shots = [];
    this.frame = 0;
    this.itemRate = cfg.itemRate === undefined ? 2 : cfg.itemRate;
    this.itemTimer = this.itemRate ? 240 : 1e9;
    this.over = false; this.result = null;
    this.intro = 150;              // READY / GO countdown
    this.endT = 0;
    this.paused = false;
    this.hitstop = 0;

    var sp = this.stage.spawns;
    for (var i = 0; i < cfg.fighters.length; i++) {
      var fc = cfg.fighters[i];
      var f = new Fighter(fc.charId, i, {
        ctrl: fc.ctrl, padIndex: fc.padIndex, cpuLv: fc.cpuLv,
        stocks: cfg.stocks || 3, name: fc.name, tint: fc.tint || 0
      });
      var s = sp[i % sp.length];
      f.x = s.x; f.y = s.y; f.facing = s.x > 0 ? -1 : 1;
      f.invul = 120;
      if (fc.ctrl === 'cpu') f.ai = SB.makeAI(f, fc.cpuLv);
      this.fighters.push(f);
    }
    this.inputs = [];
    for (i = 0; i < this.fighters.length; i++) this.inputs.push(new SB.PadState());
  }

  /* ---------- knockback math ---------- */
  function calcKB(percent, dmg, bkb, kbg, weight) {
    return (((percent * 0.1 + percent * dmg * 0.005) * (200 / (weight + 100)) * 1.45) + 6) * (kbg / 100) + bkb;
  }
  SB.calcKB = calcKB;

  /* ---------- platform helpers ---------- */
  function platTop(p) { return p.y; }
  function platSolid(p) { return !p.pass; }

  Game.prototype.platsActive = function () {
    var out = [];
    for (var i = 0; i < this.stage.plats.length; i++) {
      var p = this.stage.plats[i];
      if (p.brk && p.broken > 0) continue;
      out.push(p);
    }
    return out;
  };

  /* ============================================================ main step ============ */
  Game.prototype.step = function (inputs) {
    if (this.over && this.endT > 0) { this.endT--; }
    this.frame++;
    if (this.intro > 0) {
      this.intro--;
      if (this.intro === 110) SB.sfx.play('count');
      if (this.intro === 60) SB.sfx.play('count');
      if (this.intro === 20) SB.sfx.play('go');
    }
    SB.updateStage(this.stage, 1);
    this.fx.update();

    var i, f;
    /* AI produces inputs */
    for (i = 0; i < this.fighters.length; i++) {
      f = this.fighters[i];
      var inp = inputs[i] || this.inputs[i];
      if (f.ai && this.intro <= 0) { f.ai.think(this, inp); }
      else if (f.ai) { inp.clear(); }
      if (this.intro > 0 && !f.ai) { inp = this.inputs[i]; inp.clear(); }
      this.inputs[i] = inp;
    }

    if (this.hitstop > 0) { this.hitstop--; }

    for (i = 0; i < this.fighters.length; i++) this.updateFighter(this.fighters[i], this.inputs[i]);
    this.updateShots();
    this.updateItems();
    this.checkHits();
    this.checkBlast();
    for (i = 0; i < this.inputs.length; i++) this.inputs[i].snapshot();

    /* win check */
    if (!this.over) {
      var alive = this.fighters.filter(function (a) { return a.stocks > 0; });
      if (alive.length <= 1 && this.fighters.length > 1) {
        this.over = true; this.endT = 120;
        this.result = this.buildResult();
        SB.sfx.play('ko');
      }
    }
  };

  Game.prototype.buildResult = function () {
    var list = this.fighters.map(function (f) {
      return { idx: f.idx, name: f.name, charId: f.charId, stocks: f.stocks, kos: f.kos, falls: f.falls, ctrl: f.ctrl };
    });
    list.sort(function (a, b) { return (b.stocks - a.stocks) || (b.kos - a.kos) || (a.falls - b.falls); });
    return list;
  };

  /* ============================================================ fighter update ============ */
  Game.prototype.updateFighter = function (f, inp) {
    var C = f.char;

    /* timers that always run */
    if (f.blink > 0) f.blink--;
    if (f.comboT > 0) { f.comboT--; if (f.comboT === 0) f.combo = 0; }

    if (f.dead > 0) {
      f.dead--;
      if (f.dead === 0) this.respawn(f);
      return;
    }

    if (f.hitlag > 0) {
      f.hitlag--;
      f.poseT++;
      return;   /* freeze frames = impact feel */
    }
    if (this.hitstop > 0) { f.poseT++; return; }

    if (f.invul > 0) f.invul--;
    if (f.armorT > 0) f.armorT--;
    if (f.cool > 0) f.cool--;
    for (var b in f.buff) if (f.buff[b] > 0) f.buff[b]--;
    if (f.buff.atk === 0 && f.heldItem === 'bat') f.heldItem = null;
    if (f.dropT > 0) f.dropT--;
    if (f.landT > 0) f.landT--;

    var frozen = this.intro > 0;
    var spdMul = (f.buff.speed > 0 ? 1.45 : 1) * (f.buff.slow > 0 ? 0.55 : 1);

    /* ---------- hitstun ---------- */
    if (f.hitstun > 0) {
      f.hitstun--;
      f.state = 'launch';
      /* slight DI */
      if (inp && Math.abs(inp.x) > 0.3) f.vx += inp.x * 0.10;
      if (inp && Math.abs(inp.y) > 0.3) f.vy += inp.y * 0.08;
      f.vx *= K.LAUNCH_DECAY; f.vy = f.vy * K.LAUNCH_DECAY + K.LAUNCH_GRAV * C.fallMul;
      if (f.vy > K.MAX_FALL * 1.5) f.vy = K.MAX_FALL * 1.5;
      this.moveBody(f, true);
      if (f.hitstun === 0) { f.state = f.onGround ? 'idle' : 'air'; }
      if (Math.abs(f.vx) + Math.abs(f.vy) > 9 && this.frame % 3 === 0)
        this.fx.parts.push({ x: f.x, y: f.cy(), vx: 0, vy: 0, life: .8, dec: .08, col: '#ffffff', r: 5 * f.scale, g: 0 });
      f.poseT++;
      return;
    }

    /* ---------- action (attack / special) in progress ---------- */
    if (f.act) {
      this.updateAct(f, inp);
      this.moveBody(f, false);
      f.poseT++;
      return;
    }

    /* ---------- charging a smash ---------- */
    if (f.charging) {
      f.charge++;
      if (f.charge % 7 === 0) {
        var col = f.charge > 45 ? '#ffe36a' : '#ffb03a';
        this.fx.burst(f.x, f.cy(), col, 3, 2.6, -0.08);
      }
      if (f.charge === 20) SB.sfx.play('charge');
      var rel = !inp.smash || f.charge >= 60;
      if (f.onGround) { f.vx *= 0.7; } else { f.vy += K.GRAVITY * 0.35; }
      this.moveBody(f, false);
      if (rel) {
        f.charging = false;
        var mv = f.chargeDir === 'u' ? C.moves.usmash : (f.chargeDir === 'd' ? C.moves.dsmash : C.moves.fsmash);
        if (f.chargeDir === 'f' && inp && Math.abs(inp.x) > 0.4) f.facing = SB.sign(inp.x);
        this.startMove(f, mv, 1 + 0.55 * (f.charge / 60));
      }
      f.poseT++;
      return;
    }

    if (frozen) { f.vx *= 0.8; f.vy += K.GRAVITY * C.fallMul; this.moveBody(f, false); return; }

    /* ---------- ground / air movement ---------- */
    var ax = inp.x;
    if (Math.abs(ax) > 0.22) {
      if (Math.abs(ax) > 0.45) f.facing = SB.sign(ax);
      var tgt = ax * C.walk * spdMul;
      if (f.onGround) f.vx = SB.approach(f.vx, tgt, 0.85);
      else {
        var maxA = C.air * 1.32 * spdMul;
        f.vx += ax * K.AIR_ACC * spdMul;
        if (f.vx > maxA && ax > 0) f.vx = Math.max(maxA, f.vx * 0.98);
        if (f.vx < -maxA && ax < 0) f.vx = Math.min(-maxA, f.vx * 0.98);
      }
    } else {
      if (f.onGround) f.vx *= K.FRICTION; else f.vx *= 0.99;
    }

    /* crouch / drop through */
    var crouch = f.onGround && inp.y > 0.55;
    if (crouch && f.plat && f.plat.pass && f.dropT === 0 && inp.jump && !inp.pjump) {
      f.y += 6; f.onGround = false; f.plat = null; f.dropT = 12; f.state = 'air'; f.vy = 1;
    }

    /* jump */
    if (inp.jump && !inp.pjump) {
      if (f.onGround) {
        f.state = 'jumpsq'; f.jumpsq = 4; f.jumpCut = false;
        f.act = null;
      } else if (f.jumps > 0) {
        f.jumps--; f.vy = -C.djump; f.jumpCut = false;
        if (Math.abs(inp.x) > 0.4) f.vx = inp.x * C.air * 1.1;
        SB.sfx.play('djump');
        this.fx.ring(f.x, f.y - 30 * f.scale, '#bfe6ff', 10, 60 * f.scale, 4);
        f.state = 'air'; f.pose = 'djump'; f.poseT = 0;
      }
    }
    if (!inp.jump && f.vy < -3 && !f.onGround && !f.jumpCut) { f.vy *= 0.52; f.jumpCut = true; }

    if (f.state === 'jumpsq') {
      f.jumpsq--; f.vx *= 0.8;
      if (f.jumpsq <= 0) {
        f.vy = -C.jump * (inp.y < -0.5 ? 1.04 : 1);
        f.onGround = false; f.plat = null; f.state = 'air'; f.jumps = 1;
        SB.sfx.play('jump');
        this.fx.burst(f.x, f.y, '#ffffff', 6, 2.4, 0.05);
      }
    }

    /* attacks */
    if (inp.atk && !inp.patk) {
      if (f.heldItem === 'bomb') this.throwBomb(f, inp);
      else if (!f.onGround) this.startMove(f, C.moves.air, 1);
      else {
        var jab = f.combo === 0 ? C.moves.jab1 : (f.combo === 1 ? C.moves.jab2 : C.moves.jab3);
        this.startMove(f, jab, 1);
        f.combo = (f.combo + 1) % 3; f.comboT = 28;
      }
    }
    if (inp.smash && !inp.psmash && f.onGround) {
      f.charging = true; f.charge = 0;
      f.chargeDir = inp.y < -0.5 ? 'u' : (inp.y > 0.5 ? 'd' : 'f');
      if (f.chargeDir === 'f' && Math.abs(inp.x) > 0.4) f.facing = SB.sign(inp.x);
      f.pose = f.chargeDir === 'u' ? 'usmash' : (f.chargeDir === 'd' ? 'dsmash' : 'fsmash');
      f.poseT = 0;
    } else if (inp.smash && !inp.psmash && !f.onGround) {
      this.startMove(f, C.moves.air, 1.1);
    }
    if (inp.sp && !inp.psp && f.cool <= 0) this.startSpecial(f, inp);

    /* gravity */
    if (!f.onGround) {
      var g = K.GRAVITY * C.fallMul;
      if (inp.y > 0.65 && f.vy > 0) { f.vy += g * 2.4; if (f.vy > K.FAST_FALL) f.vy = K.FAST_FALL; }
      else { f.vy += g; if (f.vy > K.MAX_FALL) f.vy = K.MAX_FALL; }
    }

    this.moveBody(f, false);

    /* state / pose */
    if (f.state !== 'jumpsq') {
      if (!f.onGround) f.state = 'air';
      else if (crouch) f.state = 'crouch';
      else if (Math.abs(f.vx) > 0.9) f.state = 'run';
      else f.state = 'idle';
    }
    if (!f.act && !f.charging) {
      var np = f.state === 'run' ? 'run'
        : f.state === 'crouch' ? 'crouch'
          : f.state === 'jumpsq' ? 'crouch'
            : f.state === 'air' ? ((f.pose === 'djump' && f.poseT < 20) ? 'djump' : 'air')
              : 'idle';
      if (f.pose !== np) { f.pose = np; f.poseT = 0; }
    }
    f.animT += Math.abs(f.vx) * 0.055 + 0.035;
    f.lean = SB.lerp(f.lean, SB.clamp(f.vx * 0.02, -0.22, 0.22), 0.2);
    f.poseT++;
  };

  /* ---------- body movement + collision ---------- */
  Game.prototype.moveBody = function (f, launched) {
    var wasGround = f.onGround;
    var px = f.x, py = f.y;
    f.x += f.vx; f.y += f.vy;
    var plats = this.platsActive();
    f.onGround = false;
    var i, p;

    /* carried by moving platform */
    if (f.plat && f.plat.move && wasGround) { f.x += f.plat.vx; }

    for (i = 0; i < plats.length; i++) {
      p = plats[i];
      var l = p.x, r = p.x + p.w, t = p.y, bt = p.y + p.h;
      if (f.x + f.w < l || f.x - f.w > r) continue;
      if (p.pass) {
        if (f.vy >= 0 && f.dropT === 0 && py <= t + 2 && f.y >= t && f.y <= t + Math.max(14, f.vy + 8)) {
          f.y = t; f.vy = 0; f.onGround = true; f.plat = p;
        }
      } else {
        if (f.vy >= 0 && py <= t + 2 && f.y >= t && f.y <= t + 40) { f.y = t; f.vy = 0; f.onGround = true; f.plat = p; }
        else if (f.y > t && f.y - f.h < bt) {
          /* side / bottom collision with solid body */
          if (f.y - f.h * 0.5 > t) {
            if (px - f.w >= r - 2 && f.x - f.w < r) { f.x = r + f.w; f.vx = launched ? -f.vx * 0.4 : 0; }
            else if (px + f.w <= l + 2 && f.x + f.w > l) { f.x = l - f.w; f.vx = launched ? -f.vx * 0.4 : 0; }
            else if (f.vy < 0 && f.y - f.h < bt && f.y > bt - 12) { f.y = bt + f.h; f.vy = 1; }
          }
        }
      }
    }
    if (f.onGround) {
      f.jumps = 1; f.jumpCut = false;
      if (!wasGround) {
        f.landT = 6;
        if (f.vy > 6 || true) this.fx.burst(f.x, f.y, '#ffffff', 5, 2.0, 0.08);
      }
    } else if (wasGround) { f.plat = null; }
  };

  /* ---------- start a normal move ---------- */
  Game.prototype.startMove = function (f, m, chg) {
    f.act = { m: m, t: 0, chg: chg || 1, hit: [], key: null, dur: m.st + m.ac + m.rc };
    f.pose = m.pose; f.poseT = 0;
    f.charging = false;
    if (m.mv && f.onGround) f.vx += m.mv * f.facing;
    if (m.sfx === 'smash') this.fx.zoomPunch = 0.05;
  };

  /* ---------- specials ---------- */
  Game.prototype.startSpecial = function (f, inp) {
    var s = f.char.special;
    f.act = { m: null, t: 0, chg: 1, hit: [], key: s.key, dur: s.st + s.rc + (s.key === 'dash' ? 14 : 0) };
    f.pose = 'sp_' + s.key; f.poseT = 0;
    f.cool = s.cool;
    if (inp && Math.abs(inp.x) > 0.4) f.facing = SB.sign(inp.x);
  };

  Game.prototype.updateAct = function (f, inp) {
    var a = f.act, C = f.char;
    a.t++;
    var m = a.m;

    if (m) {
      /* movement during a move */
      if (f.onGround) f.vx *= 0.86; else { f.vy += K.GRAVITY * C.fallMul * 0.92; if (f.vy > K.MAX_FALL) f.vy = K.MAX_FALL; f.vx *= 0.995; }
      if (m.armor && a.t < m.st + m.ac) f.armorT = Math.max(f.armorT, 2);
      if (a.t === m.st) {
        if (m.sfx) SB.sfx.play(m.sfx);
        this.spawnSwingFx(f, m, a.chg);
      }
      if (a.t >= a.dur) { f.act = null; f.pose = f.onGround ? 'idle' : 'air'; f.poseT = 0; }
      return;
    }

    /* ---- special moves ---- */
    var s = C.special;
    switch (a.key) {
      case 'wave':
        if (f.onGround) f.vx *= 0.8; else { f.vy += K.GRAVITY * 0.8; }
        if (a.t === s.st) {
          this.shots.push(mkShot(f, {
            kind: 'wave', x: f.x + 34 * f.facing * f.scale, y: f.cy(),
            vx: 11 * f.facing, vy: 0, r: 20 * f.scale, dmg: 8, ang: 40, bkb: 20, kbg: 58, life: 70, g: 0, col: '#5ad8ff'
          }));
          SB.sfx.play('shoot');
          this.fx.ring(f.x + 34 * f.facing * f.scale, f.cy(), '#7ee8ff', 8, 46, 5);
          f.vx -= f.facing * 1.6;
        }
        break;
      case 'gouken':
        f.vx *= 0.82;
        if (a.t < s.st + 8) f.armorT = Math.max(f.armorT, 2);
        if (a.t === s.st) {
          SB.sfx.play('smash');
          this.fx.ring(f.x + 40 * f.facing * f.scale, f.cy(), '#ff9a3c', 10, 150 * f.scale, 10);
          this.fx.burst(f.x + 40 * f.facing * f.scale, f.cy(), '#ffdd66', 24, 6);
          this.fx.shake = 14; this.fx.zoomPunch = 0.09;
          this.meleeBurst(f, 40 * f.facing * f.scale, -52 * f.scale, 62 * f.scale, 19, 38, 42, 96);
        }
        break;
      case 'dash':
        if (a.t === s.st) { SB.sfx.play('dash'); f.invul = 8; }
        if (a.t >= s.st && a.t < s.st + 14) {
          f.vx = f.facing * 20; f.vy = 0;
          if (a.t % 2 === 0) this.fx.ghost(f, 'rgba(60,255,170,0.5)', 0.8);
          this.meleeBurst(f, 18 * f.facing * f.scale, -52 * f.scale, 40 * f.scale, 5, 55, 12, 40, a);
        }
        if (a.t === s.st + 14) f.vx *= 0.4;
        break;
      case 'ice':
        if (f.onGround) f.vx *= 0.8; else f.vy += K.GRAVITY * 0.8;
        if (a.t === s.st) {
          this.shots.push(mkShot(f, {
            kind: 'ice', x: f.x + 30 * f.facing * f.scale, y: f.cy() - 6,
            vx: 15 * f.facing, vy: 0, r: 13 * f.scale, dmg: 6, ang: 30, bkb: 14, kbg: 40, life: 80, g: 0, col: '#bff0ff', slow: 1
          }));
          SB.sfx.play('ice');
          this.fx.dir(f.x + 30 * f.facing * f.scale, f.cy() - 6, f.facing > 0 ? 0 : Math.PI, '#dff6ff', 8, 3);
        }
        break;
      case 'shadow':
        if (a.t === 1) { f.invul = Math.max(f.invul, 22); }
        if (a.t === s.st) {
          for (var i = 0; i < 4; i++) this.fx.ghost(f, 'rgba(150,90,255,0.45)', 1 - i * 0.15);
          var nx = f.x - f.facing * 110 * f.scale;
          f.x = nx; f.vx = -f.facing * 2; f.vy = Math.min(f.vy, -3);
          this.fx.burst(f.x, f.cy(), '#c08cff', 18, 4);
          this.fx.ring(f.x, f.cy(), '#ff5ad8', 10, 90, 5);
          SB.sfx.play('dash');
          f.buff.atk = Math.max(f.buff.atk, 90);  /* reprisal window */
        }
        break;
      case 'iron':
        f.vx *= 0.8;
        if (a.t === s.st) {
          f.armorT = 260; f.invul = Math.max(f.invul, 6);
          SB.sfx.play('guard');
          this.fx.ring(f.x, f.cy(), '#ffb03a', 14, 130 * f.scale, 9);
          this.fx.text(f.x, f.y - 128 * f.scale, '鉄壁!', '#ffb03a');
        }
        break;
    }
    if (a.t >= a.dur) { f.act = null; f.pose = f.onGround ? 'idle' : 'air'; f.poseT = 0; }
  };

  function mkShot(f, o) {
    o.owner = f.idx; o.face = f.facing; o.t = 0;
    if (o.dmgMul === undefined) o.dmgMul = (f.buff.atk > 0 ? 1.35 : 1);
    return o;
  }

  /* instantaneous radial melee (used by specials/explosions) */
  Game.prototype.meleeBurst = function (f, ox, oy, r, dmg, ang, bkb, kbg, act) {
    var wx = f.x + ox, wy = f.y + oy;
    for (var i = 0; i < this.fighters.length; i++) {
      var t = this.fighters[i];
      if (t === f || t.dead > 0) continue;
      if (act && act.hit.indexOf(t.idx) >= 0) continue;
      if (SB.dist(wx, wy, t.x, t.cy()) < r + t.hurtR()) {
        if (act) act.hit.push(t.idx);
        this.applyHit(f, t, { dmg: dmg, ang: ang, bkb: bkb, kbg: kbg }, wx, wy, 1);
      }
    }
  };

  Game.prototype.spawnSwingFx = function (f, m, chg) {
    var wx = f.x + m.hx * f.facing * f.scale, wy = f.y + m.hy * f.scale;
    var col = m.ice ? '#bff0ff' : (f.buff.atk > 0 ? '#ffd24a' : '#ffffff');
    var ang = f.facing > 0 ? -m.ang * SB.RAD : Math.PI + m.ang * SB.RAD;
    if (m.pose === 'usmash') ang = -Math.PI / 2;
    if (m.both) {
      this.fx.slash(f.x + 30 * f.scale, f.y - 24 * f.scale, 0, 60 * f.scale * chg, col, 1.2);
      this.fx.slash(f.x - 30 * f.scale, f.y - 24 * f.scale, Math.PI, 60 * f.scale * chg, col, 1.2);
    } else {
      this.fx.slash(wx, wy, ang, m.hr * 2.3 * f.scale * chg, col, 1.6);
    }
    if (m.sfx === 'smash') { this.fx.shake = 5 * chg; }
  };

  /* ---------- throwing a bomb ---------- */
  Game.prototype.throwBomb = function (f, inp) {
    f.heldItem = null;
    var up = inp.y < -0.5, dn = inp.y > 0.5;
    this.shots.push(mkShot(f, {
      kind: 'bomb', x: f.x + 26 * f.facing * f.scale, y: f.cy() - 10,
      vx: (dn ? 5 : 13) * f.facing, vy: up ? -13 : (dn ? 4 : -4.5),
      r: 15, dmg: 0, life: 200, g: 0.5, col: '#3a3f52', explode: 1
    }));
    f.pose = 'throw'; f.poseT = 0;
    f.act = { m: null, t: 0, chg: 1, hit: [], key: 'throw', dur: 14 };
    SB.sfx.play('swing');
  };

  /* ============================================================ hit detection ============ */
  Game.prototype.checkHits = function () {
    var i, j;
    for (i = 0; i < this.fighters.length; i++) {
      var f = this.fighters[i];
      if (!f.act || !f.act.m || f.dead > 0 || f.hitlag > 0) continue;
      var a = f.act, m = a.m;
      if (a.t < m.st || a.t >= m.st + m.ac) continue;
      var boxes = [{ x: f.x + m.hx * f.facing * f.scale, y: f.y + m.hy * f.scale }];
      if (m.both) boxes.push({ x: f.x - m.hx * f.facing * f.scale, y: f.y + m.hy * f.scale });
      var r = m.hr * f.scale * (a.chg > 1 ? 1 + (a.chg - 1) * 0.3 : 1);

      for (j = 0; j < this.fighters.length; j++) {
        var t = this.fighters[j];
        if (t === f || t.dead > 0) continue;
        if (a.hit.indexOf(t.idx) >= 0) continue;
        for (var k = 0; k < boxes.length; k++) {
          if (SB.dist(boxes[k].x, boxes[k].y, t.x, t.cy()) < r + t.hurtR()) {
            a.hit.push(t.idx);
            this.applyHit(f, t, {
              dmg: m.dmg * a.chg, ang: m.ang, bkb: m.bkb, kbg: m.kbg * (a.chg > 1 ? 1 + (a.chg - 1) * 0.25 : 1),
              spike: m.spike, ice: m.ice, dirx: boxes[k].x > f.x ? f.facing : -f.facing
            }, boxes[k].x, boxes[k].y, a.chg);
            break;
          }
        }
      }
      /* hitting items */
      for (j = this.items.length - 1; j >= 0; j--) {
        var it = this.items[j];
        if (SB.dist(boxes[0].x, boxes[0].y, it.x, it.y) < r + 20) {
          if (it.type === 'bomb') { this.explode(it.x, it.y, f.idx, 16, 110); this.items.splice(j, 1); }
          else { this.pickup(f, it, j); }
        }
      }
      /* hitting projectiles (reflect-ish: destroy) */
      for (j = this.shots.length - 1; j >= 0; j--) {
        var sh = this.shots[j];
        if (sh.owner === f.idx || sh.kind === 'bomb') continue;
        if (SB.dist(boxes[0].x, boxes[0].y, sh.x, sh.y) < r + sh.r) {
          this.fx.burst(sh.x, sh.y, sh.col, 10, 3.4); this.shots.splice(j, 1);
        }
      }
      /* breaking floors */
      for (j = 0; j < this.stage.plats.length; j++) {
        var p = this.stage.plats[j];
        if (!p.brk || p.broken > 0) continue;
        if (boxes[0].x > p.x - r && boxes[0].x < p.x + p.w + r && boxes[0].y > p.y - r - 10 && boxes[0].y < p.y + p.h + r) {
          if (!a.brokeHit) {
            a.brokeHit = 1; p.hp -= m.dmg * a.chg;
            this.fx.burst(boxes[0].x, p.y, '#c9b58a', 8, 3);
            if (p.hp <= 0) {
              p.broken = 420;
              this.fx.burst(p.x + p.w / 2, p.y, '#b8a07a', 26, 5, 0.35);
              SB.sfx.play('explode');
              this.fx.shake = 8;
            }
          }
        }
      }
    }
  };

  Game.prototype.applyHit = function (src, t, o, hx, hy, chg) {
    if (t.invul > 0 || t.buff.barrier > 0) {
      if (t.buff.barrier > 0) {
        this.fx.ring(t.x, t.cy(), '#7ee8ff', 20, 90 * t.scale, 5);
        SB.sfx.play('guard');
      }
      return;
    }
    var mul = (src && src.buff.atk > 0 ? 1.4 : 1);
    var dmg = o.dmg * mul;
    t.percent = Math.min(999, t.percent + dmg);
    if (src) { src.damageDealt += dmg; t.lastHitBy = src.idx; }

    var dir = o.dirx !== undefined ? o.dirx : (src ? (t.x >= src.x ? 1 : -1) : (t.x >= hx ? 1 : -1));
    if (!o.dirx && src && Math.abs(t.x - src.x) < 4) dir = src.facing;

    var kb = calcKB(t.percent, dmg, o.bkb, o.kbg, t.char.weight);
    var armored = t.armorT > 0;
    var hs = Math.round(kb * K.HITSTUN);

    /* hitlag (impact freeze) */
    var lag = Math.min(16, 3 + dmg * 0.55);
    t.hitlag = lag; if (src) src.hitlag = lag;
    this.hitstop = Math.min(6, Math.floor(dmg * 0.15));

    if (armored && kb < 60) {
      /* super armor : take damage but not knockback */
      t.vx += dir * kb * 0.04;
      this.fx.ring(t.x, t.cy(), '#ffb03a', 16, 70 * t.scale, 5);
      this.fx.burst(hx, hy, '#ffd24a', 8, 3);
      SB.sfx.play('guard');
    } else {
      var ang = (o.ang || 35) * SB.RAD;
      if (o.spike) ang = -Math.abs(ang);
      var spd = kb * K.KB_TO_SPEED;
      t.vx = Math.cos(ang) * spd * dir;
      t.vy = -Math.sin(ang) * spd;
      t.hitstun = Math.max(4, hs);
      t.onGround = false; t.plat = null;
      t.act = null; t.charging = false; t.state = 'launch';
      t.pose = 'hit'; t.poseT = 0;
      t.facing = -dir;
      if (o.ice) t.buff.slow = 130;
    }

    /* fx */
    var big = dmg >= 11;
    this.fx.burst(hx, hy, big ? '#fff0a0' : '#ffffff', big ? 18 : 10, big ? 6 : 3.6);
    this.fx.ring(hx, hy, big ? '#ffd24a' : '#ffffff', 6, big ? 120 : 60, big ? 8 : 4);
    this.fx.text(hx, hy - 20, Math.round(dmg) + '%', big ? '#ffd24a' : '#ffffff', big);
    if (o.ice) this.fx.burst(hx, hy, '#cfefff', 12, 3.4, 0.05);
    this.fx.shake = Math.max(this.fx.shake, big ? 12 : 5);
    this.fx.flash = Math.max(this.fx.flash, big ? 0.35 : 0.12);
    SB.sfx.play(big ? 'hit2' : 'hit');
  };

  /* ============================================================ projectiles ============ */
  Game.prototype.updateShots = function () {
    if (this.hitstop > 0) return;
    for (var i = this.shots.length - 1; i >= 0; i--) {
      var s = this.shots[i];
      s.t++; s.x += s.vx; s.y += s.vy; s.vy += (s.g || 0);
      s.life--;
      var kill = false;

      if (s.kind === 'wave' && s.t % 3 === 0) this.fx.parts.push({ x: s.x, y: s.y, vx: -s.vx * 0.05, vy: 0, life: .7, dec: .07, col: '#7ee8ff', r: 8, g: 0 });
      if (s.kind === 'ice' && s.t % 2 === 0) this.fx.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: .6, dec: .08, col: '#dff6ff', r: 6, g: 0 });

      for (var j = 0; j < this.fighters.length; j++) {
        var t = this.fighters[j];
        if (t.idx === s.owner || t.dead > 0) continue;
        if (SB.dist(s.x, s.y, t.x, t.cy()) < s.r + t.hurtR()) {
          if (s.explode) { this.explode(s.x, s.y, s.owner, 16, 110); kill = true; break; }
          var src = this.fighters[s.owner];
          this.applyHit(src, t, { dmg: s.dmg * (s.dmgMul || 1), ang: s.ang, bkb: s.bkb, kbg: s.kbg, ice: s.slow, dirx: SB.sign(s.vx) || 1 }, s.x, s.y, 1);
          kill = true; break;
        }
      }
      if (!kill) {
        /* stage collision */
        var plats = this.platsActive();
        for (var k = 0; k < plats.length; k++) {
          var p = plats[k];
          if (s.x > p.x - s.r && s.x < p.x + p.w + s.r && s.y > p.y - s.r && s.y < p.y + p.h) {
            if (p.pass && s.g && s.vy < 0) continue;
            if (s.explode) { this.explode(s.x, p.y, s.owner, 16, 110); kill = true; }
            else if (s.g) { s.vy = -s.vy * 0.3; s.y = p.y - s.r; s.vx *= 0.6; }
            else { this.fx.burst(s.x, s.y, s.col, 10, 3); kill = true; }
            break;
          }
        }
      }
      var B = this.stage.blast;
      if (s.life <= 0 || s.x < B.l || s.x > B.r || s.y < B.t - 200 || s.y > B.b) {
        if (s.explode && s.life <= 0) this.explode(s.x, s.y, s.owner, 16, 110);
        kill = true;
      }
      if (kill) this.shots.splice(i, 1);
    }
  };

  Game.prototype.explode = function (x, y, owner, dmg, r) {
    this.fx.ring(x, y, '#ffb03a', 10, r * 2, 12);
    this.fx.ring(x, y, '#fff0a0', 6, r * 1.3, 6);
    this.fx.burst(x, y, '#ff7a2b', 30, 8, 0.2);
    this.fx.burst(x, y, '#ffe36a', 20, 5, 0.15);
    this.fx.shake = 18; this.fx.flash = 0.5; this.fx.zoomPunch = 0.1;
    SB.sfx.play('explode');
    var src = this.fighters[owner] || null;
    for (var i = 0; i < this.fighters.length; i++) {
      var t = this.fighters[i];
      if (t.dead > 0) continue;
      var d = SB.dist(x, y, t.x, t.cy());
      if (d < r + t.hurtR()) {
        var f = 1 - d / (r + t.hurtR()) * 0.45;
        this.applyHit(src, t, { dmg: dmg * f, ang: 45, bkb: 26, kbg: 88 * f, dirx: t.x >= x ? 1 : -1 }, x, y, 1);
      }
    }
  };

  /* ============================================================ items ============ */
  Game.prototype.updateItems = function () {
    if (this.hitstop > 0) return;
    if (this.itemRate > 0 && this.intro <= 0 && !this.over) {
      this.itemTimer--;
      if (this.itemTimer <= 0) {
        this.spawnItem();
        var base = [0, 620, 400, 260][this.itemRate] || 400;
        this.itemTimer = base + SB.randi(-90, 140);
      }
    }
    var plats = this.platsActive();
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      it.t++;
      if (it.para) {
        it.vy = 1.35; it.x += Math.sin(it.t * 0.04) * 0.7;
      } else {
        it.vy += 0.5; if (it.vy > 14) it.vy = 14;
        it.vx *= it.onG ? 0.85 : 0.99;
      }
      it.x += it.vx; it.y += it.vy;
      it.onG = false;
      for (var k = 0; k < plats.length; k++) {
        var p = plats[k];
        if (it.x > p.x - 6 && it.x < p.x + p.w + 6 && it.y > p.y - 4 && it.y < p.y + p.h && it.vy >= 0) {
          it.y = p.y - 2; it.vy = 0; it.onG = true; it.para = 0;
        }
      }
      /* pickup */
      for (var j = 0; j < this.fighters.length; j++) {
        var f = this.fighters[j];
        if (f.dead > 0) continue;
        if (Math.abs(f.x - it.x) < 30 * f.scale && it.y > f.y - 108 * f.scale && it.y < f.y + 14) {
          this.pickup(f, it, i); break;
        }
      }
      var B = this.stage.blast;
      if (it.y > B.b || it.x < B.l || it.x > B.r || it.t > 1800) this.items.splice(i, 1);
    }
  };

  Game.prototype.spawnItem = function () {
    var B = this.stage.blast;
    var p = this.stage.plats[0];
    var x = SB.rand(p.x + 40, p.x + p.w - 40);
    this.items.push({ type: SB.randomItemType(), x: x, y: B.t + 40, vx: 0, vy: 1.2, t: 0, para: 1, onG: false });
  };

  Game.prototype.pickup = function (f, it, idx) {
    var def = SB.ITEMS[it.type];
    if (def.hold) {
      if (f.heldItem && f.heldItem !== null) return;
      if (it.type === 'bomb') { f.heldItem = 'bomb'; SB.sfx.play('item'); this.fx.text(f.x, f.y - 110 * f.scale, '爆弾!', '#ffb03a'); }
      else def.apply(f, this);
    } else def.apply(f, this);
    this.items.splice(idx, 1);
  };

  /* ============================================================ blast zones / KO ============ */
  Game.prototype.checkBlast = function () {
    var B = this.stage.blast;
    for (var i = 0; i < this.fighters.length; i++) {
      var f = this.fighters[i];
      if (f.dead > 0 || f.stocks <= 0) continue;
      if (f.x < B.l || f.x > B.r || f.y < B.t || f.y > B.b) {
        this.ko(f);
      }
    }
  };

  Game.prototype.ko = function (f) {
    f.stocks--; f.falls++;
    f.dead = 105;
    f.percent = 0;
    f.vx = f.vy = 0; f.act = null; f.charging = false; f.hitstun = 0; f.heldItem = null;
    f.buff.atk = f.buff.speed = f.buff.barrier = f.buff.slow = 0;
    var killer = this.fighters[f.lastHitBy];
    if (killer && killer !== f) killer.kos++;
    f.lastHitBy = -1;
    var B = this.stage.blast;
    var ex = SB.clamp(f.x, B.l + 40, B.r - 40), ey = SB.clamp(f.y, B.t + 40, B.b - 40);
    this.fx.ring(ex, ey, '#ffffff', 10, 300, 14);
    this.fx.burst(ex, ey, '#ffd24a', 30, 9);
    this.fx.flash = 0.75; this.fx.shake = 22;
    this.fx.text(ex, ey - 40, 'SMASH!', '#ffd24a', true);
    SB.sfx.play('ko');
    this.hitstop = 8;
    if (f.stocks <= 0) f.dead = 999999;
  };

  Game.prototype.respawn = function (f) {
    if (f.stocks <= 0) return;
    var s = this.stage.spawns[f.idx % this.stage.spawns.length];
    f.x = s.x; f.y = Math.min(s.y, -180) - 120;
    f.vx = 0; f.vy = 0; f.invul = 140; f.state = 'air'; f.hitstun = 0;
    f.facing = f.x > 0 ? -1 : 1; f.jumps = 1;
    f.pose = 'air'; f.poseT = 0;
    this.fx.ring(f.x, f.cy(), '#8fd0ff', 10, 140, 6);
  };

  /* ============================================================ net state ============ */
  Game.prototype.encode = function () {
    var fs = this.fighters.map(function (f) {
      return [
        Math.round(f.x * 4) / 4, Math.round(f.y * 4) / 4,
        Math.round(f.vx * 8) / 8, Math.round(f.vy * 8) / 8,
        f.facing, Math.round(f.percent * 10) / 10, f.stocks,
        f.pose, f.poseT, f.state === 'run' ? 1 : (f.state === 'air' ? 2 : (f.state === 'crouch' ? 3 : 0)),
        f.hitlag, f.dead > 0 ? 1 : 0, f.invul > 0 ? 1 : 0,
        f.charging ? f.charge : 0,
        (f.buff.barrier > 0 ? 1 : 0) | (f.buff.atk > 0 ? 2 : 0) | (f.buff.speed > 0 ? 4 : 0) | (f.armorT > 0 ? 8 : 0) | (f.buff.slow > 0 ? 16 : 0),
        f.heldItem === 'bomb' ? 1 : (f.heldItem === 'bat' ? 2 : 0),
        Math.round(f.animT * 10) / 10, Math.round(f.lean * 100) / 100
      ];
    });
    var sh = this.shots.map(function (s) { return [s.kind, Math.round(s.x), Math.round(s.y), Math.round(s.vx), Math.round(s.vy), s.owner]; });
    var it = this.items.map(function (i) { return [i.type, Math.round(i.x), Math.round(i.y), i.para ? 1 : 0]; });
    var br = this.stage.plats.map(function (p) { return p.brk ? (p.broken > 0 ? 1 : 0) : 0; });
    return { f: this.frame, F: fs, S: sh, I: it, B: br, o: this.over ? 1 : 0, n: this.intro };
  };

  Game.prototype.applyState = function (st, localIdx) {
    this.frame = st.f;
    this.intro = st.n;
    for (var i = 0; i < st.F.length && i < this.fighters.length; i++) {
      var a = st.F[i], f = this.fighters[i];
      var smooth = (i === localIdx) ? 0.34 : 0.55;
      if (Math.abs(f.x - a[0]) > 160 || Math.abs(f.y - a[1]) > 160 || f.stocks !== a[6]) { f.x = a[0]; f.y = a[1]; }
      else { f.x = SB.lerp(f.x, a[0], smooth); f.y = SB.lerp(f.y, a[1], smooth); }
      f.vx = a[2]; f.vy = a[3]; f.facing = a[4]; f.percent = a[5]; f.stocks = a[6];
      f.pose = a[7]; f.poseT = a[8];
      f.state = ['idle', 'run', 'air', 'crouch'][a[9]] || 'idle';
      f.onGround = a[9] !== 2;
      f.hitlag = a[10]; f.dead = a[11] ? 30 : 0; f.invul = a[12] ? 5 : 0;
      f.charging = a[13] > 0; f.charge = a[13];
      var b = a[14];
      f.buff.barrier = (b & 1) ? 10 : 0; f.buff.atk = (b & 2) ? 10 : 0;
      f.buff.speed = (b & 4) ? 10 : 0; f.armorT = (b & 8) ? 10 : 0; f.buff.slow = (b & 16) ? 10 : 0;
      f.heldItem = a[15] === 1 ? 'bomb' : (a[15] === 2 ? 'bat' : null);
      f.animT = a[16]; f.lean = a[17];
    }
    this.shots = st.S.map(function (s) { return { kind: s[0], x: s[1], y: s[2], vx: s[3], vy: s[4], owner: s[5], r: s[0] === 'ice' ? 13 : 18, col: s[0] === 'ice' ? '#bff0ff' : (s[0] === 'bomb' ? '#3a3f52' : '#5ad8ff'), t: 0 }; });
    this.items = st.I.map(function (v) { return { type: v[0], x: v[1], y: v[2], para: v[3], t: 0, vx: 0, vy: 0 }; });
    for (i = 0; i < st.B.length && i < this.stage.plats.length; i++) {
      if (this.stage.plats[i].brk) this.stage.plats[i].broken = st.B[i] ? 300 : 0;
    }
    if (st.o && !this.over) { this.over = true; this.endT = 120; this.result = this.buildResult(); }
  };

  SB.Game = Game;
  SB.Fighter = Fighter;
  SB.FX = FX;
})(window);
