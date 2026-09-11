/* ================= SMASH BRO : CPU AI ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  var LV = [
    { think: 26, aggr: 0.42, smashP: 0.07, spP: 0.05, chase: 0.75, airP: 0.25, edge: 0.25, chg: 12, idleP: 0.30, name: '簡単' },
    { think: 13, aggr: 0.76, smashP: 0.20, spP: 0.15, chase: 0.95, airP: 0.5, edge: 0.6, chg: 22, idleP: 0.10, name: '普通' },
    { think: 6, aggr: 0.96, smashP: 0.34, spP: 0.26, chase: 1.0, airP: 0.75, edge: 0.95, chg: 34, idleP: 0.02, name: '難しい' }
  ];

  function AI(f, lv) {
    this.f = f;
    this.lv = SB.clamp(lv | 0, 0, 2);
    this.p = LV[this.lv];
    this.t = 0;
    this.plan = 'wait';
    this.dir = 1;
    this.holdSmash = 0;
    this.holdJump = 0;
    this.press = { atk: 0, sp: 0 };
    this.target = null;
    this.itemGoal = null;
    this.wander = 0;
  }

  /* is there floor under (x) around the fighter's height? */
  function groundAt(g, x, y) {
    var plats = g.platsActive(), best = null;
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (x > p.x - 6 && x < p.x + p.w + 6 && p.y >= y - 20 && (best === null || p.y < best)) best = p.y;
    }
    return best;
  }

  /* nearest landable spot ahead within jumping range; null when the pit is unjumpable */
  function reachAhead(g, f, dir) {
    for (var d = 70; d <= 330; d += 20) {
      var y = groundAt(g, f.x + dir * d, f.y - 220);
      if (y !== null && y > f.y - 200 && y < f.y + 430) return d;
    }
    return null;
  }

  AI.prototype.think = function (g, inp) {
    this.decide(g, inp);
    this.safety(g, inp);
  };

  /* final guard : never walk off a ledge on purpose */
  AI.prototype.safety = function (g, inp) {
    var f = this.f;
    if (!f.onGround || !inp.x || inp.jump) return;
    var dir = inp.x > 0 ? 1 : -1;
    var gnd = groundAt(g, f.x + dir * 46 * f.scale, f.y - 4);
    if (gnd === null || Math.abs(gnd - f.y) > 70) {
      if (reachAhead(g, f, dir) === null) inp.x = 0;
    }
  };

  AI.prototype.decide = function (g, inp) {
    var f = this.f;
    inp.x = 0; inp.y = 0; inp.jump = false; inp.atk = false; inp.smash = false; inp.sp = false;
    if (f.dead > 0 || g.over) return;
    this.t++;
    var P = this.p;

    /* ---- choose target ---- */
    if (this.t % P.think === 0 || !this.target || this.target.dead > 0 || this.target.stocks <= 0) {
      var best = null, bd = 1e9;
      for (var i = 0; i < g.fighters.length; i++) {
        var o = g.fighters[i];
        if (o === f || o.stocks <= 0 || o.dead > 0) continue;
        var d = SB.dist(f.x, f.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      this.target = best;
      this.wander = Math.random() < P.idleP ? SB.randi(18, 40) : 0;
    }
    var t = this.target;
    if (!t) return;

    var dx = t.x - f.x, dy = t.y - f.y;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    var dir = dx >= 0 ? 1 : -1;

    /* ================= 1. recovery : get back to the stage ================= */
    var main = g.stage.plats[0];
    var edgeL = main.x, edgeR = main.x + main.w;
    var offStage = (f.x < edgeL - 10 || f.x > edgeR + 10);
    var lowDown = f.y > main.y - 70;
    if (!f.onGround && offStage && lowDown && groundAt(g, f.x, f.y - 4) === null) {
      var home = f.x < 0 ? edgeL + 60 : edgeR - 60;
      inp.x = SB.clamp((home - f.x) * 0.02, -1, 1);
      if (f.vy > 1.2 && f.jumps > 0) inp.jump = (this.t % 8 < 2);
      if (f.char.special.key === 'dash' && f.cool <= 0 && Math.abs(f.x) > Math.abs(home) + 40 && f.vy > 0) {
        f.facing = f.x < 0 ? 1 : -1; inp.sp = (this.t % 20 < 2);
      }
      return;
    }
    /* below the stage but under it : head to the side then up */
    if (!f.onGround && lowDown && !offStage) {
      inp.x = f.x < 0 ? -0.9 : 0.9;
      if (f.vy > 1 && f.jumps > 0) inp.jump = (this.t % 8 < 2);
      return;
    }

    /* ================= 2. flinch / danger ================= */
    if (f.hitstun > 0) {
      /* survival DI toward the stage centre */
      inp.x = f.x > 0 ? -1 : 1;
      inp.y = -0.4;
      return;
    }

    /* ================= 3. item hunting ================= */
    if (this.lv >= 1 && g.items.length) {
      var it = null, id = 1e9;
      for (i = 0; i < g.items.length; i++) {
        var d2 = SB.dist(f.x, f.y, g.items[i].x, g.items[i].y);
        if (d2 < id) { id = d2; it = g.items[i]; }
      }
      if (it && id < 260 && !it.para) {
        inp.x = SB.clamp((it.x - f.x) * 0.03, -1, 1);
        if (it.y < f.y - 70 && f.onGround) inp.jump = (this.t % 14 < 2);
        if (id < 42) { inp.x = 0; }
        if (id > 40) return;
      }
    }

    /* ================= 4. idle wander ================= */
    if (this.wander > 0) {
      this.wander--;
      inp.x = Math.sin(this.t * 0.05) * 0.4;
      return;
    }

    /* ================= 5. approach & attack ================= */
    var range = (34 + f.char.moves.jab1.hx) * f.scale;
    var smashRange = (40 + f.char.moves.fsmash.hx) * f.scale;
    var want = adx;

    /* edge safety : is there floor ahead? */
    if (this.jumpCd > 0) this.jumpCd--;
    var ahead = f.x + dir * 54 * f.scale;
    var gnd = groundAt(g, ahead, f.y - 4);
    var gap = f.onGround && (gnd === null || Math.abs(gnd - f.y) > 70);
    var reach = gap ? reachAhead(g, f, dir) : 0;

    /* ---- different heights : close the vertical gap first ---- */
    if (ady > 74) {
      if (adx > 30) {
        if (!f.onGround || !gap || reach !== null) inp.x = dir * P.chase;
        else inp.x = 0;
      }
      if (dy < -74) {
        /* target above : jump up to their level */
        if (this.jumpCd <= 0 && (f.onGround || f.jumps > 0) && f.vy > -4) {
          inp.jump = true; this.jumpCd = 16;
        }
      } else {
        /* target below : drop down */
        if (f.onGround && f.plat && f.plat.pass && this.jumpCd <= 0 && adx < 120) {
          inp.y = 1; inp.jump = true; this.jumpCd = 22;
        } else if (!f.onGround) inp.y = 0.7;
      }
    } else {
      /* ---- same level : walk in / space out ---- */
      if (want > range * 0.8) {
        if (!f.onGround) {
          var toStage = (f.x < edgeL + 10) ? 1 : ((f.x > edgeR - 10) ? -1 : dir);
          inp.x = (f.y > main.y - 40 && toStage !== dir) ? toStage : dir * P.chase;
        } else if (!gap) {
          inp.x = dir * P.chase;
        } else if (reach !== null && this.jumpCd <= 0) {
          inp.jump = true; inp.x = dir; this.jumpCd = 24;   /* hop the gap */
        } else if (reach !== null) {
          inp.x = dir * 0.35;
        } else {
          inp.x = 0;                                        /* unjumpable pit : hold position */
        }
      } else if (want < range * 0.45 && f.onGround) {
        inp.x = -dir * 0.3;           /* spacing */
      }
      if (dy < -50 && !f.onGround && f.jumps > 0 && Math.random() < P.airP * 0.25) inp.jump = true;
      if (dy > 60 && !f.onGround && !gap) inp.y = 0.8;     /* fast fall onto them */
    }

    /* release a charged smash */
    if (this.holdSmash > 0) {
      this.holdSmash--;
      inp.smash = this.holdSmash > 0;
      inp.x = 0;
      return;
    }
    if (this.press.atk > 0) { this.press.atk--; inp.atk = true; return; }
    if (this.press.sp > 0) { this.press.sp--; inp.sp = true; return; }

    /* thrown bomb ? */
    if (f.heldItem === 'bomb' && adx < 300 && adx > 60 && this.t % 5 === 0) {
      f.facing = dir; inp.atk = true; return;
    }

    /* decide an attack */
    if (this.t % Math.max(3, (P.think >> 1)) === 0 && Math.random() < P.aggr) {
      var inFront = (dir === f.facing) || adx < 20;
      /* special at mid range (projectiles) */
      var sk = f.char.special.key;
      var wantSp = (sk === 'wave' || sk === 'ice') ? (adx > 150 && adx < 560 && ady < 90)
        : (sk === 'iron') ? (adx < 160 && f.percent > 60)
          : (sk === 'dash') ? (adx > 130 && adx < 420 && ady < 70)
            : (sk === 'gouken') ? (adx < 90 && ady < 60)
              : (adx < 120 && f.percent > 40);
      if (f.cool <= 0 && wantSp && Math.random() < P.spP * 3) {
        f.facing = dir; this.press.sp = 2; inp.sp = true; return;
      }
      if (!f.onGround && adx < range * 1.5 && ady < 100) { this.press.atk = 2; inp.atk = true; return; }
      if (f.onGround && adx < smashRange && ady < 80 && Math.random() < P.smashP * (t.percent > 70 ? 2.2 : 1)) {
        f.facing = dir;
        this.holdSmash = 2 + (Math.random() * P.chg | 0);
        inp.smash = true;
        inp.y = (dy < -60) ? -1 : (adx < 40 ? 1 : 0);   /* up-smash / down-smash */
        return;
      }
      if (f.onGround && adx < range * 1.15 && ady < 70) {
        f.facing = dir; this.press.atk = 2; inp.atk = true; return;
      }
    }

    /* jump over incoming projectiles */
    if (this.lv >= 1) {
      for (i = 0; i < g.shots.length; i++) {
        var s = g.shots[i];
        if (s.owner === f.idx) continue;
        if (Math.abs(s.y - f.cy()) < 60 && Math.abs(s.x - f.x) < 220 && SB.sign(s.vx) === SB.sign(f.x - s.x) * -1) {
          if (f.onGround && Math.random() < 0.5) inp.jump = true;
        }
      }
    }
  };

  SB.makeAI = function (f, lv) { return new AI(f, lv); };
  SB.AI_NAMES = ['簡単', '普通', '難しい'];
})(window);
