/* ================= SMASH BRO : items ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  var DEF = {
    heal: {
      name: '回復', jp: 'かいふく', col: '#3ddc84', col2: '#0e7a41', icon: 'heart',
      hold: false, weight: 1.0,
      apply: function (f, g) {
        f.percent = Math.max(0, f.percent - 25);
        g.fx.burst(f.x, f.y - 55 * f.scale, '#6cff9e', 16, 3.2);
        g.fx.text(f.x, f.y - 110 * f.scale, '回復!', '#6cff9e');
        SB.sfx.play('heal');
      }
    },
    bomb: {
      name: '爆弾', jp: 'ばくだん', col: '#3a3f52', col2: '#15171f', icon: 'bomb',
      hold: true, weight: 1.0, fuse: 0
    },
    bat: {
      name: 'バット', jp: 'こうげきUP', col: '#ffb03a', col2: '#a85c00', icon: 'bat',
      hold: true, weight: 1.0,
      apply: function (f, g) {
        f.buff.atk = 12 * 60; f.heldItem = 'bat';
        g.fx.burst(f.x, f.y - 55 * f.scale, '#ffd24a', 16, 3.4);
        g.fx.text(f.x, f.y - 110 * f.scale, '攻撃力UP!', '#ffd24a');
        SB.sfx.play('item');
      }
    },
    barrier: {
      name: 'バリア', jp: 'むてき', col: '#4ad4ff', col2: '#1663b8', icon: 'shield',
      hold: false, weight: 1.0,
      apply: function (f, g) {
        f.buff.barrier = 7 * 60;
        g.fx.ring(f.x, f.y - 55 * f.scale, '#7ee8ff', 30, 120);
        g.fx.text(f.x, f.y - 110 * f.scale, 'バリア!', '#7ee8ff');
        SB.sfx.play('guard');
      }
    },
    speed: {
      name: 'スピードUP', jp: 'そくどUP', col: '#ff5adf', col2: '#8a1668', icon: 'bolt',
      hold: false, weight: 1.0,
      apply: function (f, g) {
        f.buff.speed = 9 * 60;
        g.fx.burst(f.x, f.y - 55 * f.scale, '#ff8ae8', 18, 4);
        g.fx.text(f.x, f.y - 110 * f.scale, 'スピードUP!', '#ff8ae8');
        SB.sfx.play('item');
      }
    }
  };

  SB.ITEMS = DEF;
  SB.ITEM_KEYS = ['heal', 'bomb', 'bat', 'barrier', 'speed'];

  /* weighted random pick */
  SB.randomItemType = function () {
    var t = ['heal', 'heal', 'bomb', 'bomb', 'bat', 'barrier', 'speed', 'speed'];
    return SB.pick(t);
  };
})(window);
