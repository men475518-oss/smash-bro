/* ================= SMASH BRO : menus & screens ================= */
(function (w) {
  'use strict';
  var SB = w.SB;
  var $ = function (id) { return document.getElementById(id); };

  var S = {
    mode: 'cpu',
    slots: [],
    active: 0,
    stageId: 'grass',
    stocks: 3, items: 2, cpuLv: 1, cpuN: 1,
    infoChar: 'akira',
    onlineReady: false
  };

  var UI = SB.ui = { S: S };
  var app = null;

  UI.init = function (a) {
    app = a;
    /* nav buttons */
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { SB.sfx.play('ui'); UI.nav(b.getAttribute('data-go')); });
    });
    $('char-next').addEventListener('click', function () { SB.sfx.play('ui'); UI.charNext(); });
    $('stage-back').addEventListener('click', function () { SB.sfx.play('ui'); UI.go('scr-char'); });
    $('stage-start').addEventListener('click', function () { SB.sfx.play('go'); UI.startMatch(); });

    $('btn-pause').addEventListener('click', function () { UI.pause(true); });
    var sndBtns = [$('btn-sound'), $('pz-sound')];
    function sndLabel() {
      var on = !SB.sfx.isMuted();
      sndBtns.forEach(function (b) { if (b) b.innerHTML = on ? '<span>🔊 音 ON</span>' : '<span>🔇 音 OFF</span>'; });
    }
    sndBtns.forEach(function (b) {
      if (!b) return;
      b.addEventListener('click', function () {
        SB.sfx.mute(!SB.sfx.isMuted()); SB.sfx.play('ui'); sndLabel();
        try { localStorage.setItem('sb_mute', SB.sfx.isMuted() ? '1' : '0'); } catch (e) { }
      });
    });
    try { if (localStorage.getItem('sb_mute') === '1') SB.sfx.mute(true); } catch (e) { }
    sndLabel();
    $('pz-resume').addEventListener('click', function () { UI.pause(false); });
    $('pz-retry').addEventListener('click', function () { UI.hideAll(); app.start(app.cfg); });
    $('pz-quit').addEventListener('click', function () { UI.hideAll(); app.quit(); UI.go('scr-title'); });
    $('rs-retry').addEventListener('click', function () {
      if (SB.net.active) { SB.toast('オンラインではメニューに戻ります'); UI.hideAll(); app.quit(); UI.go('scr-title'); return; }
      UI.hideAll(); app.start(app.cfg);
    });
    $('rs-quit').addEventListener('click', function () { UI.hideAll(); app.quit(); UI.go('scr-title'); });

    /* rules segmented controls */
    document.querySelectorAll('.seg').forEach(function (seg) {
      seg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          SB.sfx.play('ui');
          seg.querySelectorAll('button').forEach(function (o) { o.classList.remove('on'); });
          b.classList.add('on');
          var r = seg.getAttribute('data-rule'), v = parseInt(b.getAttribute('data-v'), 10);
          if (r === 'stocks') S.stocks = v;
          if (r === 'items') S.items = v;
          if (r === 'cpu') S.cpuLv = v;
          if (r === 'cpun') S.cpuN = v;
          if (r === 'cpun' || r === 'cpu') UI.syncOnline();
        });
      });
    });

    UI.buildChars();
    UI.buildStages();
    UI.initOnline();
  };

  UI.nav = function (t) {
    if (t === 'title') {
      SB.net.leave(); UI.setWaiting(false);
      $('roomid-box').hidden = true; $('btn-random').textContent = 'マッチング開始';
      UI.go('scr-title'); return;
    }
    if (t === 'howto') { UI.go('scr-howto'); return; }
    if (t === 'local') { S.mode = 'local'; UI.setupSlots(); UI.go('scr-char'); return; }
    if (t === 'cpu') { S.mode = 'cpu'; UI.setupSlots(); UI.go('scr-char'); return; }
    if (t === 'online') {
      S.mode = 'online'; S.remoteChar = null; UI.setWaiting(false);
      $('roomid-box').hidden = true; $('btn-random').textContent = 'マッチング開始';
      if (!SB.net.available) SB.net.preload();
      UI.go('scr-online'); return;
    }
  };

  UI.go = function (id) {
    document.querySelectorAll('#ui .screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $(id); if (el) el.classList.add('active');
    if (id === 'scr-char') requestAnimationFrame(function () { UI.renderPortraits(); });
    if (id === 'scr-stage') requestAnimationFrame(function () { UI.renderStageThumbs(); });
    UI.syncRules();
  };
  UI.hideAll = function () {
    document.querySelectorAll('#ui .screen').forEach(function (s) { s.classList.remove('active'); });
  };

  UI.pause = function (on) {
    if (!app.game || app.scene !== 'game') return;
    if (SB.net.active) { if (on) SB.toast('オンライン中はポーズできません'); return; }
    app.paused = on;
    if (on) { UI.go('scr-pause'); SB.input.enabled = false; }
    else { UI.hideAll(); SB.input.enabled = true; SB.input.releaseAll(); }
  };

  /* ---------------- slots ---------------- */
  UI.setupSlots = function () {
    if (S.mode === 'local') {
      S.slots = [{ label: '1P', ctrl: 'human', charId: 'akira' }, { label: '2P', ctrl: 'human', charId: 'rei' }];
      $('char-title').textContent = 'キャラクター選択';
    } else if (S.mode === 'cpu') {
      S.slots = [{ label: '1P', ctrl: 'human', charId: 'akira' }, { label: 'CPU', ctrl: 'cpu', charId: 'gou' }];
      $('char-title').textContent = 'キャラクター選択';
    } else {
      S.slots = [{ label: 'あなた', ctrl: 'human', charId: 'akira' }];
      $('char-title').textContent = 'キャラクター選択（オンライン）';
    }
    S.active = 0;
    UI.drawSlots();
  };

  UI.drawSlots = function () {
    var row = $('slot-row'); row.innerHTML = '';
    S.slots.forEach(function (sl, i) {
      var d = document.createElement('div');
      d.className = 'slot' + (i === S.active ? ' on' : '');
      var c = SB.charById(sl.charId);
      d.innerHTML = '<span class="who">' + sl.label + '</span><b>' + c.name + '</b><span class="who">' + c.type + '</span>';
      d.addEventListener('click', function () { S.active = i; UI.drawSlots(); UI.markGrid(); SB.sfx.play('ui'); });
      row.appendChild(d);
    });
    if (S.mode === 'online' && S.remoteChar) {
      var d2 = document.createElement('div');
      d2.className = 'slot';
      var rc = SB.charById(S.remoteChar);
      d2.innerHTML = '<span class="who">あいて</span><b>' + rc.name + '</b><span class="who">' + rc.type + '</span>';
      row.appendChild(d2);
    }
  };

  /* ---------------- character grid ---------------- */
  UI.buildChars = function () {
    var grid = $('char-grid'); grid.innerHTML = '';
    SB.CHARS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'cc'; b.setAttribute('data-id', c.id);
      var cv = document.createElement('canvas');
      b.appendChild(cv);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name;
      b.appendChild(nm);
      b.addEventListener('click', function () {
        SB.sfx.play('ui');
        S.infoChar = c.id;
        if (S.slots[S.active]) S.slots[S.active].charId = c.id;
        if (S.mode === 'online' && SB.net.active) SB.net.send({ t: 'char', c: c.id });
        UI.showInfo(c.id); UI.markGrid(); UI.drawSlots();
        if (S.slots.length > 1) S.active = (S.active + 1) % S.slots.length;
        UI.drawSlots();
      });
      grid.appendChild(b);
    });
    UI.showInfo('akira');
  };

  UI.renderPortraits = function () {
    document.querySelectorAll('#char-grid .cc').forEach(function (b) {
      var cv = b.querySelector('canvas');
      if (cv.clientWidth) SB.render.portrait(cv, b.getAttribute('data-id'));
    });
    UI.markGrid();
  };

  UI.markGrid = function () {
    var cur = S.slots[S.active] ? S.slots[S.active].charId : null;
    document.querySelectorAll('#char-grid .cc').forEach(function (b) {
      b.classList.toggle('sel', b.getAttribute('data-id') === cur);
    });
  };

  UI.showInfo = function (id) {
    var c = SB.charById(id);
    var bar = function (label, v) {
      return '<span class="stat">' + label + '<span class="bar"><i style="width:' + Math.round(v * 100) + '%"></i></span></span>';
    };
    $('char-info').innerHTML =
      '<b>' + c.name + '</b>（' + c.type + '）　特殊技：<b>' + c.special.name + '</b><br>' + c.desc +
      '<div class="stats">' + bar('攻撃', c.bars.power) + bar('速さ', c.bars.speed) + bar('重さ', c.bars.weight) + bar('跳躍', c.bars.jump) + '</div>';
  };

  UI.charNext = function () {
    if (S.mode === 'online') {
      if (!SB.net.active) { SB.toast('接続されていません'); return; }
      SB.net.send({ t: 'char', c: S.slots[0].charId, ready: 1 });
      if (SB.net.isHost) { UI.setWaiting(false); UI.go('scr-stage'); }
      else {
        UI.setWaiting(true);
        SB.toast('ホストがステージを選ぶのを待っています…', 3200);
      }
      return;
    }
    UI.setWaiting(false);
    UI.go('scr-stage');
  };

  UI.setWaiting = function (on) {
    var b = $('char-next');
    b.textContent = on ? '相手を待っています…' : 'つぎへ →';
    b.disabled = !!on;
    b.style.opacity = on ? '.6' : '';
  };

  /* ---------------- stage grid ---------------- */
  UI.buildStages = function () {
    var grid = $('stage-grid'); grid.innerHTML = '';
    SB.STAGES.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'sc' + (s.id === S.stageId ? ' sel' : '');
      b.setAttribute('data-id', s.id);
      var cv = document.createElement('canvas'); b.appendChild(cv);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name;
      b.appendChild(nm);
      b.addEventListener('click', function () {
        SB.sfx.play('ui'); S.stageId = s.id;
        document.querySelectorAll('#stage-grid .sc').forEach(function (o) { o.classList.remove('sel'); });
        b.classList.add('sel');
        SB.toast(s.name + ' : ' + s.desc, 2200);
      });
      grid.appendChild(b);
    });
  };
  UI.renderStageThumbs = function () {
    document.querySelectorAll('#stage-grid .sc').forEach(function (b) {
      var cv = b.querySelector('canvas');
      if (cv.clientWidth) SB.render.stageThumb(cv, b.getAttribute('data-id'));
    });
  };

  UI.syncRules = function () {
    var on = S.mode === 'cpu';
    $('rule-cpu').style.display = on ? '' : 'none';
    $('rule-cpun').style.display = on ? '' : 'none';
  };

  /* ---------------- build the match ---------------- */
  UI.buildCfg = function () {
    var fs = [], localPlayers = 1, localIdx = 0;
    if (S.mode === 'local') {
      fs.push({ charId: S.slots[0].charId, ctrl: 'human', padIndex: 0, name: '1P' });
      fs.push({ charId: S.slots[1].charId, ctrl: 'human', padIndex: 1, name: '2P' });
      localPlayers = 2;
    } else if (S.mode === 'cpu') {
      fs.push({ charId: S.slots[0].charId, ctrl: 'human', padIndex: 0, name: '1P' });
      var pool = SB.CHARS.map(function (c) { return c.id; });
      for (var i = 0; i < S.cpuN; i++) {
        var cid = i === 0 ? S.slots[1].charId : SB.pick(pool);
        fs.push({ charId: cid, ctrl: 'cpu', cpuLv: S.cpuLv, name: 'CPU' + (S.cpuN > 1 ? (i + 1) : '') });
      }
    } else {
      var mine = S.slots[0].charId, theirs = S.remoteChar || 'gou';
      if (SB.net.isHost) {
        fs.push({ charId: mine, ctrl: 'human', padIndex: 0, name: 'あなた' });
        fs.push({ charId: theirs, ctrl: 'remote', name: 'あいて' });
        localIdx = 0;
      } else {
        fs.push({ charId: theirs, ctrl: 'remote', name: 'あいて' });
        fs.push({ charId: mine, ctrl: 'human', padIndex: 0, name: 'あなた' });
        localIdx = 1;
      }
    }
    return {
      stageId: S.stageId, stocks: S.stocks, itemRate: S.items,
      fighters: fs, localPlayers: localPlayers, localIdx: localIdx
    };
  };

  UI.startMatch = function () {
    SB.sfx.unlock();
    if (S.mode === 'online') {
      if (!SB.net.active) { SB.toast('接続されていません'); return; }
      SB.net.send({ t: 'start', stage: S.stageId, stocks: S.stocks, items: S.items, host: S.slots[0].charId, guest: S.remoteChar });
    }
    var cfg = UI.buildCfg();
    app.start(cfg);
  };

  UI.startOnlineFromHost = function (msg) {
    UI.setWaiting(false);
    S.stageId = msg.stage; S.stocks = msg.stocks; S.items = msg.items;
    S.remoteChar = msg.host;
    if (msg.guest) S.slots[0].charId = msg.guest;
    var cfg = UI.buildCfg();
    app.start(cfg);
  };

  /* ---------------- result ---------------- */
  UI.showResult = function (g) {
    var list = g.result || g.buildResult();
    var box = $('res-list'); box.innerHTML = '';
    list.forEach(function (r, i) {
      var d = document.createElement('div');
      d.className = 'res' + (i === 0 ? ' win' : '');
      var c = SB.charById(r.charId);
      d.innerHTML = '<span class="rk">' + (i + 1) + '</span>' +
        '<span class="nm">' + r.name + ' / ' + c.name + '</span>' +
        '<span class="sc2">残' + Math.max(0, r.stocks) + '　撃墜' + r.kos + '　落下' + r.falls + '</span>';
      box.appendChild(d);
    });
    $('res-title').textContent = list[0] ? (list[0].name + ' の勝ち！') : 'GAME SET';
    UI.go('scr-result');
  };

  /* ================= online lobby ================= */
  UI.initOnline = function () {
    $('btn-create').addEventListener('click', function () { SB.sfx.play('ui'); SB.net.create(); });
    $('btn-join').addEventListener('click', function () {
      SB.sfx.play('ui');
      var v = ($('join-id').value || '').trim().toUpperCase();
      if (v.length < 3) { SB.toast('ルームIDを入力してください'); return; }
      SB.net.join(v);
    });
    $('btn-random').addEventListener('click', function () {
      SB.sfx.play('ui');
      if (SB.net._matching || SB.net.peer) {
        SB.net.leave(); $('btn-random').textContent = 'マッチング開始';
        $('roomid-box').hidden = true; return;
      }
      $('btn-random').textContent = 'キャンセル';
      SB.net.random();
    });
    $('btn-copy').addEventListener('click', function () {
      var t = $('roomid').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { SB.toast('コピーしました: ' + t); });
      else SB.toast('ルームID: ' + t);
    });

    SB.net.on = {
      status: function (txt, cls) {
        $('net-state').textContent = txt;
        $('net-state').className = 'net-state' + (cls ? ' ' + cls : '');
      },
      log: function (txt) { $('netlog').textContent = txt; },
      room: function (id) {
        $('roomid-box').hidden = false;
        $('roomid').textContent = id;
      },
      open: function () {
        SB.toast('接続しました！キャラクターを選んでください', 2400);
        S.mode = 'online';
        UI.setupSlots();
        UI.go('scr-char');
      },
      data: function (m) { UI.onNet(m); },
      close: function (reason) {
        UI.setWaiting(false);
        $('btn-random').textContent = 'マッチング開始';
        if (reason) SB.toast(reason, 2600);
        if (app.scene === 'game' || app.scene === 'result') { app.quit(); UI.go('scr-title'); }
        else if (document.querySelector('#scr-char.active')) UI.go('scr-online');
      }
    };
    if (!SB.net.available) $('netlog').textContent = 'オンライン機能を読み込み中…';
  };

  UI.onNet = function (m) {
    if (!m || !m.t) return;
    if (m.t === 'char') {
      S.remoteChar = m.c; S.remoteReady = !!m.ready; UI.drawSlots();
      if (m.ready) SB.toast('あいてが ' + SB.charById(m.c).name + ' を選びました', 1800);
    }
    else if (m.t === 'start') { UI.startOnlineFromHost(m); }
  };

  UI.syncOnline = function () { };
})(window);
