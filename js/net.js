/* ================= SMASH BRO : online play (PeerJS / WebRTC P2P) =================
   ホスト権威型:
     ホスト … 物理演算を実行し 20Hz でスナップショットを送信
     ゲスト … 自分の入力を 60Hz で送信し、ローカル予測しながら受信状態へ補間
   サーバーを自前で用意する必要がない PeerJS (WebRTC DataChannel) を使用。
================================================================================ */
(function (w) {
  'use strict';
  var SB = w.SB;

  var PREFIX = 'sbro1-';
  var LOBBIES = 8;
  var CDN = [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
  ];

  var N = SB.net = {
    available: false,
    active: false,
    isHost: false,
    connected: false,
    lagWarn: 0,
    on: {},

    peer: null,
    conn: null,
    room: '',
    _pad: null,
    _queue: [],
    _snap: null,
    _tick: 0,
    _lastRecv: 0,
    _sendT: 0,
    _matching: false,
    _tryList: null,
    _timer: null
  };

  function status(t, cls) { if (N.on.status) N.on.status(t, cls); }
  function log(t) { if (N.on.log) N.on.log(t); }

  /* ---------------- library loading ---------------- */
  var loading = false;
  function loadPeer(cb) {
    if (w.Peer) { N.available = true; return cb(true); }
    if (loading) { setTimeout(function () { loadPeer(cb); }, 300); return; }
    loading = true;
    var i = 0;
    (function next() {
      if (i >= CDN.length) { loading = false; return cb(false); }
      var s = document.createElement('script');
      s.src = CDN[i++]; s.async = true;
      s.onload = function () { loading = false; N.available = !!w.Peer; cb(!!w.Peer); };
      s.onerror = function () { next(); };
      document.head.appendChild(s);
    })();
  }

  N.preload = function () {
    loadPeer(function (ok) {
      if (ok) { status('準備完了', ''); log('ルームを作るか、IDを入力して参加してください。'); }
      else { status('利用不可', ''); log('オンライン用ライブラリを読み込めませんでした（通信環境をご確認ください）。'); }
    });
  };

  /* ---------------- peer helpers ---------------- */
  function newPeer(id) {
    var opt = { debug: 0, config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ] } };
    return id ? new w.Peer(id, opt) : new w.Peer(opt);
  }

  function bindConn(conn, asHost) {
    N.conn = conn;
    conn.on('open', function () {
      N.connected = true; N.active = true; N.isHost = asHost;
      N._queue = []; N._snap = null; N._lastRecv = performance.now();
      if (!N._pad) N._pad = new SB.PadState();
      status('接続中', 'ok');
      log('相手と接続しました。');
      if (N.on.open) N.on.open();
    });
    conn.on('data', function (m) { onData(m); });
    conn.on('close', function () { drop('相手が切断しました'); });
    conn.on('error', function () { drop('通信エラーが発生しました'); });
  }

  function drop(msg) {
    if (!N.active && !N.connected && !N.peer) return;
    N.active = false; N.connected = false;
    cleanup();
    status('未接続', '');
    if (N.on.close) N.on.close(msg);
  }

  function cleanup() {
    if (N._timer) { clearTimeout(N._timer); N._timer = null; }
    try { if (N.conn) N.conn.close(); } catch (e) { }
    try { if (N.peer) N.peer.destroy(); } catch (e) { }
    N.conn = null; N.peer = null; N._queue = []; N._snap = null; N._matching = false;
  }

  N.leave = function () {
    var was = N.active;
    N.active = false; N.connected = false;
    cleanup();
    status('未接続', '');
    if (was) log('切断しました。');
  };

  /* ---------------- host : create a room ---------------- */
  N.create = function () {
    loadPeer(function (ok) {
      if (!ok) { SB.toast('オンライン用ライブラリを読み込めませんでした'); return; }
      cleanup();
      var code = SB.roomCode();
      status('ルーム作成中…', 'wait');
      var peer = newPeer(PREFIX + code);
      N.peer = peer;
      peer.on('open', function () {
        N.room = code;
        status('相手を待っています', 'wait');
        log('ルームID「' + code + '」を相手に伝えてください。');
        if (N.on.room) N.on.room(code);
      });
      peer.on('connection', function (conn) {
        if (N.connected) { try { conn.close(); } catch (e) { } return; }
        bindConn(conn, true);
      });
      peer.on('error', function (e) {
        if (e && e.type === 'unavailable-id') { N.create(); return; }   /* code collision : retry */
        status('エラー', '');
        log('接続エラー: ' + (e && e.type ? e.type : e));
      });
      peer.on('disconnected', function () { try { peer.reconnect(); } catch (e) { } });
    });
  };

  /* ---------------- guest : join a room ---------------- */
  N.join = function (code) {
    loadPeer(function (ok) {
      if (!ok) { SB.toast('オンライン用ライブラリを読み込めませんでした'); return; }
      cleanup();
      code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
      status('接続中…', 'wait');
      log('ルーム「' + code + '」へ接続しています…');
      var peer = newPeer(null);
      N.peer = peer;
      peer.on('open', function () {
        var conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json', metadata: { v: 1 } });
        bindConn(conn, false);
        N._timer = setTimeout(function () {
          if (!N.connected) { log('ルームが見つかりませんでした。IDをご確認ください。'); drop(null); }
        }, 12000);
      });
      peer.on('error', function (e) {
        var t = e && e.type ? e.type : '';
        if (t === 'peer-unavailable') { log('そのルームIDは存在しません。'); }
        else log('接続エラー: ' + t);
        status('未接続', '');
      });
    });
  };

  /* ---------------- random match ----------------
     空きロビー枠を順に試す。取得できれば自分がホスト、
     既に使われていれば参加者としてそこへ接続する。          */
  N.random = function () {
    loadPeer(function (ok) {
      if (!ok) { SB.toast('オンライン用ライブラリを読み込めませんでした'); return; }
      cleanup();
      N._matching = true;
      var order = [];
      for (var i = 0; i < LOBBIES; i++) order.push(i);
      order.sort(function () { return Math.random() - 0.5; });
      status('マッチング中…', 'wait');
      log('対戦相手をさがしています…');
      tryLobby(order, 0);
    });
  };

  function tryLobby(order, i) {
    if (!N._matching) return;
    if (i >= order.length) {
      log('空きが見つかりませんでした。ホストとして待機します。');
      N.create(); return;
    }
    var id = PREFIX + 'LOBBY' + order[i];
    /* まず参加を試みる */
    var peer = newPeer(null);
    N.peer = peer;
    var settled = false;
    peer.on('open', function () {
      var conn = peer.connect(id, { reliable: true, serialization: 'json' });
      bindConn(conn, false);
      N._timer = setTimeout(function () {
        if (!N.connected && !settled) { settled = true; try { peer.destroy(); } catch (e) { } hostLobby(order, i); }
      }, 3500);
    });
    peer.on('error', function (e) {
      var t = e && e.type ? e.type : '';
      if (t === 'peer-unavailable' && !settled) {
        settled = true;
        try { peer.destroy(); } catch (er) { }
        hostLobby(order, i);
      }
    });
  }

  /* その枠のホストになって待つ（取られていたら次の枠へ） */
  function hostLobby(order, i) {
    if (!N._matching) return;
    var id = PREFIX + 'LOBBY' + order[i];
    var peer = newPeer(id);
    N.peer = peer;
    peer.on('open', function () {
      N.room = 'LOBBY' + order[i];
      status('相手を待っています', 'wait');
      log('マッチング待機中…（ルーム ' + N.room + '）');
    });
    peer.on('connection', function (conn) {
      if (N.connected) { try { conn.close(); } catch (e) { } return; }
      N._matching = false;
      bindConn(conn, true);
    });
    peer.on('error', function (e) {
      var t = e && e.type ? e.type : '';
      if (t === 'unavailable-id') { try { peer.destroy(); } catch (er) { } tryLobby(order, i + 1); }
      else log('マッチングエラー: ' + t);
    });
  }

  /* ---------------- messaging ---------------- */
  N.send = function (o) {
    if (!N.conn || !N.connected) return;
    try { N.conn.send(o); } catch (e) { }
  };

  function onData(m) {
    if (!m) return;
    N._lastRecv = performance.now();
    N.lagWarn = 0;
    if (m.t === 'i') { N._queue.push(m.p); if (N._queue.length > 8) N._queue.splice(0, N._queue.length - 4); }
    else if (m.t === 's') { N._snap = m.s; }
    else if (m.t === 'bye') { drop('相手が退出しました'); }
    else if (N.on.data) N.on.data(m);
  }

  /* remote fighter input (host side) */
  N.remotePad = function () {
    if (!N._pad) N._pad = new SB.PadState();
    return N._pad;
  };

  function applyPad(p, v) {
    p.x = v[0]; p.y = v[1];
    p.jump = !!(v[2] & 1); p.atk = !!(v[2] & 2); p.smash = !!(v[2] & 4); p.sp = !!(v[2] & 8);
  }
  function encPad(p) {
    return [Math.round(p.x * 50) / 50, Math.round(p.y * 50) / 50,
    (p.jump ? 1 : 0) | (p.atk ? 2 : 0) | (p.smash ? 4 : 0) | (p.sp ? 8 : 0)];
  }

  /* ---------------- per-frame hooks ---------------- */
  N.preStep = function (g, localIdx) {
    if (!N.active) return;
    /* connection health */
    var since = performance.now() - N._lastRecv;
    N.lagWarn = since > 1500 ? 1 : 0;
    if (since > 12000) { drop('相手との通信が切れました'); return; }

    if (N.isHost) {
      if (N._queue.length) {
        if (N._queue.length > 5) N._queue.splice(0, N._queue.length - 3);
        applyPad(N.remotePad(), N._queue.shift());
      }
    }
  };

  N.postStep = function (g) {
    if (!N.active || !N.isHost) return;
    N._tick++;
    if (N._tick % 3 === 0) N.send({ t: 's', s: g.encode() });
  };

  /* guest: predict locally, then blend toward the host's authoritative state */
  N.guestStep = function (g, localIdx, pad) {
    if (!N.active) { g.step(g.inputs); return; }
    N.send({ t: 'i', p: encPad(pad) });

    var inputs = [];
    for (var i = 0; i < g.fighters.length; i++) {
      inputs.push(i === localIdx ? pad : N.remotePad());
    }
    g.step(inputs);

    if (N._snap) { g.applyState(N._snap, localIdx); N._snap = null; }
  };

  /* leave politely when the tab closes */
  w.addEventListener('beforeunload', function () { if (N.active) N.send({ t: 'bye' }); });

  /* start fetching the library early so the lobby is ready when opened */
  w.addEventListener('load', function () { setTimeout(function () { N.preload(); }, 800); });
})(window);
