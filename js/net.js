/* ================= SMASH BRO : online (placeholder) ================= */
(function (w) {
  'use strict';
  var SB = w.SB;
  SB.net = {
    available: false, active: false, isHost: false, lagWarn: 0,
    on: {},
    create: function () { SB.toast('オンライン機能は準備中です'); },
    join: function () { SB.toast('オンライン機能は準備中です'); },
    random: function () { SB.toast('オンライン機能は準備中です'); },
    leave: function () { },
    send: function () { },
    remotePad: function () { return new SB.PadState(); },
    preStep: function () { }, postStep: function () { }, guestStep: function () { }
  };
})(window);
