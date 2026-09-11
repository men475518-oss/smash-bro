/* ================= SMASH BRO : main loop ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  var App = SB.app = {
    canvas: null, ctx: null, dpr: 1,
    W: 0, H: 0,
    scene: 'menu',
    game: null,
    cfg: null,
    paused: false,
    acc: 0, last: 0,
    layoutMode: 'single',
    localIdx: 0,
    fps: 60, fpsT: 0, fpsN: 0
  };

  App.init = function () {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    SB.input.setup(this.canvas);
    this.resize();
    var self = this;
    w.addEventListener('resize', function () { self.resize(); });
    w.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 250); });
    SB.ui.init(this);
    this.last = performance.now();
    requestAnimationFrame(function (t) { self.loop(t); });
  };

  App.resize = function () {
    var W = w.innerWidth, H = w.innerHeight;
    var dpr = Math.min(2, w.devicePixelRatio || 1);
    if (W * H > 900000) dpr = Math.min(dpr, 1.6);
    this.dpr = dpr; this.W = W; this.H = H;
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SB.input.resize(W, H, this.layoutMode);
  };

  /* ---------------- start a match ---------------- */
  App.start = function (cfg) {
    this.cfg = cfg;
    this.layoutMode = cfg.localPlayers >= 2 ? 'dual' : 'single';
    SB.input.resize(this.W, this.H, this.layoutMode);
    SB.input.enabled = true;
    SB.input.releaseAll();
    this.game = new SB.Game(cfg);
    this.localIdx = cfg.localIdx === undefined ? 0 : cfg.localIdx;
    this.scene = 'game';
    this.paused = false;
    SB.render.cam.z = 0.5;
    SB.render.cam.x = 0; SB.render.cam.y = -140;
    document.getElementById('btn-pause').hidden = false;
    SB.ui.hideAll();
  };

  App.quit = function () {
    this.scene = 'menu';
    this.game = null;
    SB.input.enabled = false;
    document.getElementById('btn-pause').hidden = true;
    if (SB.net && SB.net.active) SB.net.leave();
  };

  /* ---------------- gather inputs ---------------- */
  App.collect = function () {
    var g = this.game, out = [];
    for (var i = 0; i < g.fighters.length; i++) {
      var f = g.fighters[i];
      if (f.ctrl === 'human') out.push(SB.input.pads[f.padIndex] || SB.input.pads[0]);
      else if (f.ctrl === 'remote') out.push(SB.net.remotePad(i));
      else out.push(g.inputs[i]);
    }
    return out;
  };

  /* ---------------- main loop ---------------- */
  var STEP = 1000 / 60;
  App.loop = function (t) {
    var self = this;
    requestAnimationFrame(function (tt) { self.loop(tt); });
    var dt = t - this.last; this.last = t;
    if (dt > 250) dt = 250;

    if (this.scene === 'game' && this.game) {
      if (!this.paused) {
        this.acc += dt;
        var steps = 0;
        while (this.acc >= STEP && steps < 4) {
          this.stepGame();
          this.acc -= STEP; steps++;
        }
        if (this.acc > STEP * 4) this.acc = 0;
      }
      this.render();
    } else {
      this.acc = 0;
    }
  };

  App.stepGame = function () {
    var g = this.game;
    if (SB.net && SB.net.active) {
      SB.net.preStep(g, this.localIdx);
      if (SB.net.isHost) { g.step(this.collect()); SB.net.postStep(g); }
      else { SB.net.guestStep(g, this.localIdx, SB.input.pads[0]); }
    } else {
      g.step(this.collect());
    }
    if (g.over && g.endT === 0 && this.scene === 'game') {
      this.scene = 'result';
      SB.input.enabled = false;
      document.getElementById('btn-pause').hidden = true;
      SB.ui.showResult(g);
    }
  };

  App.render = function () {
    var c = this.ctx, g = this.game;
    var L = SB.input.layout;
    c.fillStyle = '#05070f';
    c.fillRect(0, 0, this.W, this.H);
    SB.render.draw(c, g, L);
    /* control overlay */
    SB.input.draw(c);
    if (this.paused) {
      c.save(); c.fillStyle = 'rgba(4,6,16,.5)'; c.fillRect(0, 0, this.W, this.H); c.restore();
    }
    if (SB.net && SB.net.active && SB.net.lagWarn > 0) {
      c.save();
      c.fillStyle = 'rgba(255,80,80,.9)'; c.font = 'bold 12px sans-serif';
      c.textAlign = 'center';
      c.fillText('通信が不安定です', this.W / 2, 18);
      c.restore();
    }
  };

  w.addEventListener('load', function () { App.init(); });
})(window);
