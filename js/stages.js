/* ================= SMASH BRO : stages ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  /* platform: {x,y,w,h, pass:bool, brk:bool, hp, move:{dx,dy,dist,spd}} 
     (x,y) = top-left of the platform's top surface; y grows downward. */

  var STAGES = [
    {
      id: 'grass', name: '草原', theme: 'grass',
      desc: '平坦な地面と左右の小さな浮島。最も戦いやすい定番ステージ。',
      blast: { l: -840, r: 840, t: -680, b: 540 },
      spawns: [{ x: -200, y: -220 }, { x: 200, y: -220 }, { x: -80, y: -320 }, { x: 80, y: -320 }],
      plats: [
        { x: -370, y: 0, w: 740, h: 120, pass: false },
        { x: -318, y: -170, w: 170, h: 22, pass: true },
        { x: 148, y: -170, w: 170, h: 22, pass: true },
        { x: -85, y: -300, w: 170, h: 22, pass: true }
      ]
    },
    {
      id: 'ruins', name: '遺跡', theme: 'ruins',
      desc: '中央に高い足場。左右の床は攻撃で壊れるので足元に注意。',
      blast: { l: -870, r: 870, t: -720, b: 560 },
      spawns: [{ x: -170, y: -220 }, { x: 170, y: -220 }, { x: 0, y: -400 }, { x: 0, y: -220 }],
      plats: [
        { x: -300, y: 0, w: 600, h: 120, pass: false },
        { x: -120, y: -250, w: 240, h: 26, pass: true },
        { x: -470, y: -90, w: 190, h: 26, pass: true, brk: true, hp: 34 },
        { x: 280, y: -90, w: 190, h: 26, pass: true, brk: true, hp: 34 },
        { x: -60, y: -430, w: 120, h: 22, pass: true }
      ]
    },
    {
      id: 'sky', name: '空中要塞', theme: 'sky',
      desc: '足場が少なく落ちやすい高難度ステージ。復帰力が試される。',
      blast: { l: -720, r: 720, t: -700, b: 470 },
      spawns: [{ x: -150, y: -240 }, { x: 150, y: -240 }, { x: -280, y: -330 }, { x: 280, y: -330 }],
      plats: [
        { x: -190, y: 0, w: 380, h: 90, pass: false },
        { x: -400, y: -140, w: 150, h: 22, pass: true },
        { x: 250, y: -140, w: 150, h: 22, pass: true },
        { x: -85, y: -260, w: 170, h: 22, pass: true, move: { dx: 0, dy: -1, dist: 70, spd: 0.5 } },
        { x: -330, y: -370, w: 130, h: 22, pass: true },
        { x: 200, y: -370, w: 130, h: 22, pass: true }
      ]
    }
  ];

  /* deep clone so a match can mutate (breakable floors, moving platforms) */
  SB.makeStage = function (id) {
    var src = null;
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) src = STAGES[i];
    if (!src) src = STAGES[0];
    var s = JSON.parse(JSON.stringify(src));
    s.plats.forEach(function (p) {
      p.ox = p.x; p.oy = p.y;
      p.vx = 0; p.vy = 0; p.t = 0;
      if (p.brk) { p.maxhp = p.hp; p.broken = 0; }
    });
    s.time = 0;
    return s;
  };

  SB.updateStage = function (s, dt) {
    s.time += dt;
    for (var i = 0; i < s.plats.length; i++) {
      var p = s.plats[i];
      if (p.move) {
        p.t += p.move.spd * dt * 0.02;
        var o = Math.sin(p.t) * p.move.dist;
        var nx = p.ox + (p.move.dx || 0) * o, ny = p.oy + (p.move.dy || 0) * o;
        p.vx = nx - p.x; p.vy = ny - p.y;
        p.x = nx; p.y = ny;
      }
      if (p.brk && p.broken > 0) {
        p.broken -= dt;
        if (p.broken <= 0) { p.broken = 0; p.hp = p.maxhp; }
      }
    }
  };

  SB.STAGES = STAGES;
})(window);
