/* ================= SMASH BRO : characters ================= */
(function (w) {
  'use strict';
  var SB = w.SB;

  /* move = {
       st: startup frames, ac: active frames, rc: recover frames,
       dmg, ang: launch angle deg (0=forward, 90=up, negative=down),
       bkb: base knockback, kbg: knockback growth,
       hx,hy,hr: hitbox offset (x forward, y up is negative) + radius
       pose: animation key, sfx, mv: self horizontal velocity on start,
       sp: 1 = spike-ish, multi: number of repeat hits, armor: super armor during move
     } */

  function M(o) {
    return Object.assign({
      st: 5, ac: 3, rc: 10, dmg: 5, ang: 35, bkb: 16, kbg: 50,
      hx: 40, hy: -52, hr: 24, pose: 'jab1', sfx: 'hit', mv: 0, armor: 0, hits: 1
    }, o);
  }

  var CH = [
    /* ---------------- 1. アキラ : バランス ---------------- */
    {
      id: 'akira', name: 'アキラ', type: 'バランス型',
      desc: '標準的な性能でクセがなく、どんな戦い方にも対応できる万能キャラ。初心者におすすめ。',
      weight: 100, walk: 4.35, air: 3.7, jump: 15.6, djump: 14.6, fallMul: 1.0, scale: 1.0,
      col: {
        main: '#2f8bff', main2: '#134fb8', skin: '#ffd9b6', skin2: '#e5a97d',
        hair: '#28304f', hair2: '#151b32', acc: '#ffd24a', trim: '#f3f7ff', eye: '#1a2a55'
      },
      look: { build: 'normal', hair: 'spike', scarf: true },
      moves: {
        jab1: M({ st: 3, ac: 3, rc: 7, dmg: 2.6, ang: 25, bkb: 11, kbg: 16, hx: 42, hy: -56, hr: 20, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 3, ac: 3, rc: 8, dmg: 2.8, ang: 30, bkb: 12, kbg: 18, hx: 44, hy: -48, hr: 21, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 5, ac: 4, rc: 14, dmg: 5.0, ang: 42, bkb: 22, kbg: 52, hx: 48, hy: -52, hr: 25, pose: 'jab3', sfx: 'hit' }),
        fsmash: M({ st: 12, ac: 4, rc: 24, dmg: 15, ang: 33, bkb: 26, kbg: 92, hx: 62, hy: -52, hr: 32, pose: 'fsmash', sfx: 'smash', mv: 2.4 }),
        usmash: M({ st: 10, ac: 5, rc: 22, dmg: 13, ang: 86, bkb: 24, kbg: 95, hx: 10, hy: -112, hr: 34, pose: 'usmash', sfx: 'smash' }),
        dsmash: M({ st: 9, ac: 5, rc: 22, dmg: 12, ang: 22, bkb: 30, kbg: 78, hx: 0, hy: -18, hr: 46, pose: 'dsmash', sfx: 'smash', both: true }),
        air: M({ st: 5, ac: 6, rc: 12, dmg: 9, ang: 45, bkb: 16, kbg: 72, hx: 36, hy: -50, hr: 34, pose: 'airspin', sfx: 'swing' })
      },
      special: { name: 'エネルギー波', key: 'wave', st: 10, rc: 22, cool: 34 }
    },

    /* ---------------- 2. ゴウ : パワー ---------------- */
    {
      id: 'gou', name: 'ゴウ', type: 'パワー型',
      desc: '重く、動きは遅いが一撃の破壊力が最高クラス。当てれば一気に勝負を決められる。',
      weight: 128, walk: 3.35, air: 2.9, jump: 14.2, djump: 13.0, fallMul: 1.08, scale: 1.14,
      col: {
        main: '#e0452f', main2: '#8c1c14', skin: '#f0bb8e', skin2: '#c98a5c',
        hair: '#3a1f14', hair2: '#221009', acc: '#ffc93c', trim: '#2a2a34', eye: '#4a1b10'
      },
      look: { build: 'heavy', hair: 'crop', band: true },
      moves: {
        jab1: M({ st: 5, ac: 3, rc: 9, dmg: 3.6, ang: 28, bkb: 13, kbg: 20, hx: 46, hy: -58, hr: 23, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 5, ac: 3, rc: 10, dmg: 4.0, ang: 32, bkb: 14, kbg: 22, hx: 48, hy: -50, hr: 24, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 8, ac: 4, rc: 18, dmg: 7.5, ang: 40, bkb: 24, kbg: 62, hx: 52, hy: -54, hr: 28, pose: 'jab3', sfx: 'hit2' }),
        fsmash: M({ st: 18, ac: 5, rc: 30, dmg: 22, ang: 34, bkb: 30, kbg: 104, hx: 70, hy: -54, hr: 38, pose: 'fsmash', sfx: 'smash', mv: 3.0, armor: 1 }),
        usmash: M({ st: 14, ac: 5, rc: 26, dmg: 18, ang: 88, bkb: 26, kbg: 100, hx: 8, hy: -120, hr: 38, pose: 'usmash', sfx: 'smash' }),
        dsmash: M({ st: 12, ac: 6, rc: 28, dmg: 16, ang: 18, bkb: 32, kbg: 86, hx: 0, hy: -20, hr: 52, pose: 'dsmash', sfx: 'smash', both: true }),
        air: M({ st: 8, ac: 6, rc: 16, dmg: 13, ang: -55, bkb: 20, kbg: 60, hx: 30, hy: -22, hr: 36, pose: 'airdown', sfx: 'hit2', spike: true })
      },
      special: { name: '剛拳', key: 'gouken', st: 20, rc: 30, cool: 70 }
    },

    /* ---------------- 3. レイ : スピード ---------------- */
    {
      id: 'rei', name: 'レイ', type: 'スピード型',
      desc: '軽くて非常に素早い。一発は軽いが、手数と機動力で相手をかき乱す。',
      weight: 80, walk: 5.75, air: 4.6, jump: 16.6, djump: 15.8, fallMul: 0.92, scale: 0.93,
      col: {
        main: '#2fe08a', main2: '#0f8a52', skin: '#ffe0c2', skin2: '#e0a87f',
        hair: '#f7e14a', hair2: '#c9a800', acc: '#25f0ff', trim: '#10202a', eye: '#0b4a3a'
      },
      look: { build: 'slim', hair: 'pony', visor: true },
      moves: {
        jab1: M({ st: 2, ac: 2, rc: 5, dmg: 1.9, ang: 22, bkb: 9, kbg: 12, hx: 38, hy: -56, hr: 19, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 2, ac: 2, rc: 6, dmg: 2.1, ang: 26, bkb: 10, kbg: 14, hx: 40, hy: -48, hr: 19, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 4, ac: 3, rc: 11, dmg: 4.0, ang: 48, bkb: 18, kbg: 46, hx: 42, hy: -60, hr: 23, pose: 'jab3', sfx: 'hit' }),
        fsmash: M({ st: 9, ac: 3, rc: 19, dmg: 12, ang: 32, bkb: 22, kbg: 84, hx: 58, hy: -50, hr: 28, pose: 'fsmash', sfx: 'smash', mv: 3.4 }),
        usmash: M({ st: 7, ac: 5, rc: 18, dmg: 10.5, ang: 84, bkb: 20, kbg: 88, hx: 6, hy: -108, hr: 30, pose: 'usmash', sfx: 'smash' }),
        dsmash: M({ st: 7, ac: 4, rc: 18, dmg: 9.5, ang: 20, bkb: 26, kbg: 72, hx: 0, hy: -16, hr: 42, pose: 'dsmash', sfx: 'smash', both: true }),
        air: M({ st: 3, ac: 6, rc: 9, dmg: 6.5, ang: 50, bkb: 13, kbg: 62, hx: 34, hy: -48, hr: 32, pose: 'airspin', sfx: 'swing' })
      },
      special: { name: '疾風ステップ', key: 'dash', st: 5, rc: 16, cool: 40 }
    },

    /* ---------------- 4. ユキ : 遠距離 ---------------- */
    {
      id: 'yuki', name: 'ユキ', type: '遠距離型',
      desc: '飛び道具で相手を寄せ付けずに戦う。間合い管理が得意な人向け。',
      weight: 92, walk: 4.0, air: 3.5, jump: 15.0, djump: 14.4, fallMul: 0.94, scale: 0.98,
      col: {
        main: '#7ad8ff', main2: '#2e7bb5', skin: '#ffe2cc', skin2: '#e2ab8c',
        hair: '#e8f4ff', hair2: '#9dc3dd', acc: '#4a6fff', trim: '#dff3ff', eye: '#2a6a9a'
      },
      look: { build: 'normal', hair: 'long', cape: true },
      moves: {
        jab1: M({ st: 4, ac: 3, rc: 8, dmg: 2.4, ang: 28, bkb: 11, kbg: 16, hx: 42, hy: -56, hr: 21, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 4, ac: 3, rc: 9, dmg: 2.6, ang: 32, bkb: 12, kbg: 18, hx: 44, hy: -50, hr: 21, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 6, ac: 4, rc: 14, dmg: 5.0, ang: 45, bkb: 20, kbg: 50, hx: 46, hy: -56, hr: 26, pose: 'jab3', sfx: 'ice' }),
        fsmash: M({ st: 13, ac: 4, rc: 25, dmg: 14.5, ang: 34, bkb: 25, kbg: 90, hx: 64, hy: -54, hr: 33, pose: 'fsmash', sfx: 'smash', mv: 1.6, ice: true }),
        usmash: M({ st: 11, ac: 5, rc: 23, dmg: 12.5, ang: 87, bkb: 23, kbg: 94, hx: 8, hy: -114, hr: 34, pose: 'usmash', sfx: 'smash', ice: true }),
        dsmash: M({ st: 10, ac: 5, rc: 23, dmg: 11.5, ang: 24, bkb: 28, kbg: 76, hx: 0, hy: -18, hr: 46, pose: 'dsmash', sfx: 'smash', both: true, ice: true }),
        air: M({ st: 6, ac: 6, rc: 12, dmg: 8.5, ang: 48, bkb: 15, kbg: 70, hx: 38, hy: -52, hr: 33, pose: 'aircast', sfx: 'ice' })
      },
      special: { name: '氷の矢', key: 'ice', st: 12, rc: 24, cool: 40 }
    },

    /* ---------------- 5. シオン : テクニカル ---------------- */
    {
      id: 'shion', name: 'シオン', type: 'テクニカル型',
      desc: '変則的な動きとコンボが強力。影分身で相手の攻撃をかわして反撃を狙える上級者向け。',
      weight: 90, walk: 4.9, air: 4.1, jump: 16.0, djump: 15.4, fallMul: 0.97, scale: 0.97,
      col: {
        main: '#a濃', main2: '#4a1f86', skin: '#f5d3bb', skin2: '#d3a184',
        hair: '#6b4bd6', hair2: '#3a2280', acc: '#ff5ad8', trim: '#1a1330', eye: '#6d3fd6'
      },
      look: { build: 'normal', hair: 'hood', coat: true },
      moves: {
        jab1: M({ st: 3, ac: 2, rc: 6, dmg: 2.2, ang: 24, bkb: 10, kbg: 14, hx: 40, hy: -56, hr: 20, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 3, ac: 2, rc: 7, dmg: 2.4, ang: 28, bkb: 11, kbg: 16, hx: 42, hy: -48, hr: 20, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 5, ac: 4, rc: 12, dmg: 4.6, ang: 55, bkb: 19, kbg: 48, hx: 44, hy: -62, hr: 25, pose: 'jab3', sfx: 'hit' }),
        fsmash: M({ st: 11, ac: 4, rc: 22, dmg: 13.5, ang: 30, bkb: 24, kbg: 88, hx: 60, hy: -52, hr: 31, pose: 'fsmash', sfx: 'smash', mv: 3.0 }),
        usmash: M({ st: 9, ac: 6, rc: 20, dmg: 12, ang: 85, bkb: 22, kbg: 92, hx: 8, hy: -110, hr: 33, pose: 'usmash', sfx: 'smash' }),
        dsmash: M({ st: 8, ac: 5, rc: 20, dmg: 11, ang: 16, bkb: 29, kbg: 76, hx: 0, hy: -16, hr: 45, pose: 'dsmash', sfx: 'smash', both: true }),
        air: M({ st: 4, ac: 7, rc: 10, dmg: 7.5, ang: 52, bkb: 14, kbg: 66, hx: 34, hy: -50, hr: 33, pose: 'airspin', sfx: 'swing' })
      },
      special: { name: '影分身', key: 'shadow', st: 4, rc: 14, cool: 60 }
    },

    /* ---------------- 6. テツ : 重量級 ---------------- */
    {
      id: 'tetsu', name: 'テツ', type: '重量級',
      desc: '超重量でスーパーアーマーを持ち、少々の攻撃では怯まない。鉄壁で完全に耐えて反撃する。',
      weight: 145, walk: 3.0, air: 2.7, jump: 13.4, djump: 12.2, fallMul: 1.14, scale: 1.22,
      col: {
        main: '#8d99ad', main2: '#48566b', skin: '#d9c2a8', skin2: '#a98a6c',
        hair: '#2b3140', hair2: '#171c26', acc: '#ff8a2b', trim: '#c9d4e2', eye: '#ff8a2b'
      },
      look: { build: 'huge', hair: 'helm', armor: true },
      moves: {
        jab1: M({ st: 6, ac: 3, rc: 10, dmg: 4.0, ang: 26, bkb: 14, kbg: 20, hx: 48, hy: -60, hr: 25, pose: 'jab1', sfx: 'swing' }),
        jab2: M({ st: 6, ac: 3, rc: 11, dmg: 4.4, ang: 30, bkb: 15, kbg: 22, hx: 50, hy: -52, hr: 26, pose: 'jab2', sfx: 'swing' }),
        jab3: M({ st: 9, ac: 4, rc: 18, dmg: 8.0, ang: 38, bkb: 25, kbg: 60, hx: 54, hy: -56, hr: 30, pose: 'jab3', sfx: 'hit2' }),
        fsmash: M({ st: 20, ac: 5, rc: 32, dmg: 23, ang: 35, bkb: 32, kbg: 100, hx: 74, hy: -56, hr: 40, pose: 'fsmash', sfx: 'smash', mv: 2.2, armor: 1 }),
        usmash: M({ st: 15, ac: 6, rc: 28, dmg: 19, ang: 88, bkb: 27, kbg: 96, hx: 8, hy: -126, hr: 40, pose: 'usmash', sfx: 'smash', armor: 1 }),
        dsmash: M({ st: 13, ac: 6, rc: 28, dmg: 17, ang: 14, bkb: 34, kbg: 84, hx: 0, hy: -20, hr: 56, pose: 'dsmash', sfx: 'smash', both: true, armor: 1 }),
        air: M({ st: 9, ac: 6, rc: 18, dmg: 14, ang: 42, bkb: 22, kbg: 64, hx: 40, hy: -48, hr: 38, pose: 'airswing', sfx: 'hit2' })
      },
      special: { name: '鉄壁', key: 'iron', st: 8, rc: 18, cool: 150 }
    }
  ];

  /* fix a stray char in shion main color */
  CH[4].col.main = '#8a5cff';

  /* stat bars used in the select screen (0..1) */
  CH.forEach(function (c) {
    c.bars = {
      power: SB.clamp((c.moves.fsmash.dmg - 10) / 15, .08, 1),
      speed: SB.clamp((c.walk - 2.7) / 3.3, .08, 1),
      weight: SB.clamp((c.weight - 70) / 85, .08, 1),
      jump: SB.clamp((c.jump - 12.8) / 4.2, .08, 1)
    };
  });

  SB.CHARS = CH;
  SB.charById = function (id) {
    for (var i = 0; i < CH.length; i++) if (CH[i].id === id) return CH[i];
    return CH[0];
  };
  SB.charIndex = function (id) {
    for (var i = 0; i < CH.length; i++) if (CH[i].id === id) return i;
    return 0;
  };
})(window);
