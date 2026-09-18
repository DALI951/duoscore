/* DuoScore v4 UI — both players per round, optional win target with
   auto-party, and bulletproof persistence: every save goes to TWO keys
   (live + backup), old versions migrate instead of wiping, and we store
   on unload too — refreshes / hard refreshes never lose the match. */
(function () {
  'use strict';
  var KEY = 'duoscore.v4';
  var BACKUP = 'duoscore.backup';
  var OLD_KEYS = ['duoscore.v3', 'duoscore.v1']; // try these if main + backup missing
  var DuoCore = window.DuoCore;
  if (!DuoCore) throw new Error('score-core.js must load first');

  var state = (function loadState() {
    var raw = [localStorage.getItem(KEY), localStorage.getItem(BACKUP)];
    var i;
    for (i = 0; i < raw.length; i++) {
      if (raw[i]) return DuoCore.load(raw[i]);
    }
    for (i = 0; i < OLD_KEYS.length; i++) {
      var old = localStorage.getItem(OLD_KEYS[i]);
      if (old) return DuoCore.load(old); // migrates v1..v3 automatically
    }
    return DuoCore.createGame(null);
  })();

  // Ask the browser for permanent storage so data survives eviction.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  function save() {
    try {
      var json = JSON.stringify(state);
      localStorage.setItem(KEY, json);   // live key
      localStorage.setItem(BACKUP, json); // twin copy for hard-refresh safety
    } catch (e) { /* private mode: run in-memory only */ }
  }
  window.addEventListener('pagehide', save);

  /* ---------- render ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    document.getElementById('name1').textContent = state.p1.name;
    document.getElementById('name2').textContent = state.p2.name;
    document.getElementById('w1').textContent = state.score.p1;
    document.getElementById('w2').textContent = state.score.p2;
    document.getElementById('pips1').textContent = state.target ? '/ ' + state.target : '';
    document.getElementById('pips2').textContent = state.target ? '/ ' + state.target : '';

    // lead line + round badge (+ target when set)
    var badge = document.getElementById('roundBadge');
    var diff = state.score.p1 - state.score.p2;
    var bits = [];
    bits.push('Round <b>' + state.round + '</b>');
    if (state.target) bits.push('first to <b>' + state.target + '</b>');
    if (diff > 0) bits.push(esc(state.p1.name) + ' leads by ' + diff);
    else if (diff < 0) bits.push(esc(state.p2.name) + ' leads by ' + (-diff));
    else bits.push('Tied');
    badge.innerHTML = bits.join(' &middot; ');

    // match banner + party
    var banner = document.getElementById('matchBanner');
    if (state.over) {
      var title, scoreline, loserLine = '', confetti = false;
      if (state.over.winner === 0) {
        title = 'It\u2019s a draw!';
        scoreline = state.over.score.p1 + ' \u2013 ' + state.over.score.p2;
      } else {
        var champ = state.over.winner === 1 ? state.p1.name : state.p2.name;
        var loser = state.over.winner === 1 ? state.p2.name : state.p1.name;
        title = champ + ' wins the match! \uD83C\uDF89';
        scoreline = state.over.score.p1 + ' \u2013 ' + state.over.score.p2;
        loserLine = esc(loser) + ' is crying \uD83D\uDE22';
        confetti = true;
      }
      document.getElementById('bannerTitle').textContent = title;
      document.getElementById('bannerScore').innerHTML = scoreline;
      document.getElementById('bannerLoser').innerHTML = loserLine;
      banner.classList.remove('hidden');
      if (confetti) party();
    } else {
      banner.classList.add('hidden');
      document.getElementById('bannerLoser').innerHTML = '';
    }

    renderRoundArea();
    renderHistory();
  }

  /* Confetti — deterministic CSS pieces, removed after the rain. */
  function party() {
    var sign = state.over.winner + ':' + state.over.score.p1 + state.over.score.p2;
    var old = document.getElementById('confetti');
    if (old && old.getAttribute('data-sign') === sign) return; // already rained
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'confetti';
    wrap.setAttribute('data-sign', sign);
    var colors = ['#ef4444', '#ffffff', '#7f1d1d', '#9ca3af', '#f87171'];
    for (var i = 0; i < 72; i++) {
      var c = document.createElement('div');
      c.className = 'conf';
      c.style.left = (Math.random() * 100) + 'vw';
      c.style.backgroundColor = colors[i % colors.length];
      c.style.animationDuration = (2.4 + Math.random() * 2.2) + 's';
      c.style.animationDelay = (Math.random() * 1.4) + 's';
      c.style.width = (6 + Math.random() * 7) + 'px';
      c.style.height = (10 + Math.random() * 8) + 'px';
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 6500);
  }

  function renderRoundArea() {
    var area = document.getElementById('roundArea');
    if (state.over) { area.innerHTML = ''; return; }
    area.innerHTML =
      '<div class="roundform">' +
        '<div class="rf-title">Round <b>' + state.round + '</b>' + (state.target ? ' &middot; first to <b>' + state.target + '</b>' : '') + '</div>' +
        '<div class="rf-grid">' +
          '<label class="rf-side one"><span class="rf-name">' + esc(state.p1.name) + '</span>' +
            '<input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="How much?" class="pp-input" data-side="1" autocomplete="off">' +
          '</label>' +
          '<label class="rf-side two"><span class="rf-name">' + esc(state.p2.name) + '</span>' +
            '<input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="How much?" class="pp-input" data-side="2" autocomplete="off">' +
          '</label>' +
        '</div>' +
        '<button type="button" class="btn primary big" id="addRoundBtn">Add this round</button>' +
        '<button type="button" class="btn primary big" id="finishBtn">Finish match \u25B8</button>' +
      '</div>';
  }

  function renderHistory() {
    var list = document.getElementById('historyList');
    if (!state.history.length) {
      list.innerHTML = '<li class="emptyhist">No rounds yet \u2014 enter both scores and hit Add.</li>';
      document.getElementById('undoBtn').disabled = true;
      return;
    }
    document.getElementById('undoBtn').disabled = false;
    var rows = [];
    for (var i = state.history.length - 1; i >= 0; i--) {
      var h = state.history[i];
      var lead = h.p1 > h.p2 ? 1 : h.p2 > h.p1 ? 2 : 0;
      rows.push(
        '<li class="hrow">' +
          '<span class="rnum">R' + h.n + '</span>' +
          '<span class="rscores">' +
            '<span class="rscore one ' + (lead === 1 ? 'ahead' : '') + '"><span class="psname">' + esc(state.p1.name) + '</span> <b>' + h.p1 + '</b></span>' +
            '<span class="rdash">\u2013</span>' +
            '<span class="rscore two ' + (lead === 2 ? 'ahead' : '') + '"><span class="psname">' + esc(state.p2.name) + '</span> <b>' + h.p2 + '</b></span>' +
          '</span>' +
          '<button type="button" class="hdel" data-del="' + h.n + '" aria-label="Delete round ' + h.n + '">&#10005;</button>' +
        '</li>'
      );
    }
    list.innerHTML = rows.join('');
  }

  /* ---------- persistence ---------- */
  function commit(next) {
    state = next;
    save();
    render();
  }

  /* ---------- events ---------- */
  function digits(v) { return String(v).replace(/\D/g, ''); }

  function gatherRound(area) {
    var inputs = area.querySelectorAll('.pp-input');
    if (inputs.length === 2) {
      var next = DuoCore.addRound(state, digits(inputs[0].value), digits(inputs[1].value));
      if (next !== state) {
        commit(next);
        inputs[0].value = '';
        inputs[1].value = '';
        inputs[0].focus();
      }
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#addRoundBtn,#finishBtn,#rematchBtn,#undoBtn,#resetBtn,#configBtn,[data-del],[data-t]') : null;
    if (!t) return;

    if (t.id === 'addRoundBtn') gatherRound(document.getElementById('roundArea'));
    else if (t.id === 'finishBtn') commit(DuoCore.finish(state));
    else if (t.id === 'rematchBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'undoBtn') commit(DuoCore.undo(state));
    else if (t.id === 'resetBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'configBtn') openConfig();
    else if (t.hasAttribute('data-t')) document.getElementById('cfgTarget').value = t.getAttribute('data-t');
    else if (t.hasAttribute('data-del')) commit(DuoCore.deleteRound(state, Number(t.getAttribute('data-del'))));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var inp = e.target && e.target.closest ? e.target.closest('#roundArea .pp-input') : null;
    if (inp) {
      e.preventDefault();
      gatherRound(document.getElementById('roundArea'));
    }
  });

  /* ---------- settings (names + win target) ---------- */
  var dialog = document.getElementById('configDialog');
  function openConfig() {
    document.getElementById('cfgName1').value = state.p1.name;
    document.getElementById('cfgName2').value = state.p2.name;
    document.getElementById('cfgTarget').value = state.target || '';
    dialog.showModal();
  }
  document.getElementById('configForm').addEventListener('submit', function () {
    commit(DuoCore.setTarget(
      DuoCore.setNames(state,
        document.getElementById('cfgName1').value,
        document.getElementById('cfgName2').value),
      document.getElementById('cfgTarget').value));
  });
  document.getElementById('cfgCancel').addEventListener('click', function () {
    dialog.close();
  });

  /* ---------- service worker (offline) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./js/sw.js').catch(function () { /* progressive enhancement */ });
  }

  render();
  save(); // write the twin backup immediately, even before any edit
})();