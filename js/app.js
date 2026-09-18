/* DuoScore UI — wires the pure core to the DOM. */
(function () {
  'use strict';
  var KEY = 'duoscore.v1';
  var DuoCore = window.DuoCore;
  if (!DuoCore) throw new Error('score-core.js must load first');

  var state = DuoCore.load(localStorage.getItem(KEY));

  /* ---------- render ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pips(player) {
    if (state.target > 15) return ''; // unlimited target — numbers say it all, no dots
    var key = player === 1 ? 'p1' : 'p2';
    var wins = state.wins[key];
    var out = '';
    for (var i = 0; i < state.target; i++) {
      out += '<span class="pip' + (i < wins ? ' on' : '') + '"></span>';
    }
    return out;
  }

  function render() {
    // scoreboard
    document.getElementById('name1').textContent = state.p1.name;
    document.getElementById('name2').textContent = state.p2.name;
    document.getElementById('w1').textContent = state.wins.p1;
    document.getElementById('w2').textContent = state.wins.p2;
    document.getElementById('pips1').innerHTML = pips(1);
    document.getElementById('pips2').innerHTML = pips(2);

    // round badge
    var badge = document.getElementById('roundBadge');
    if (state.mode === 'points') {
      badge.innerHTML = 'Round <b>' + state.round + '</b> &middot; <b>' +
        state.open.p1 + ' &ndash; ' + state.open.p2 + '</b> &middot; first to ' + state.target;
    } else {
      badge.innerHTML = 'Round <b>' + state.round + '</b> &middot; first to ' + state.target;
    }

    // footer
    document.getElementById('modeTag').textContent = state.mode === 'winner' ? 'Winner mode' : 'Points mode';
    document.getElementById('targetTag').textContent = state.target;

    // match over banner
    var banner = document.getElementById('matchBanner');
    if (state.over) {
      var champ = state.over.winner === 1 ? state.p1.name : state.p2.name;
      var scoreline = state.over.score.p1 + ' &ndash; ' + state.over.score.p2;
      document.getElementById('bannerTitle').textContent = champ + ' wins the match!';
      document.getElementById('bannerScore').innerHTML = scoreline;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    renderRoundArea();
    renderHistory();
  }

  function renderRoundArea() {
    var area = document.getElementById('roundArea');
    var html = '';
    if (!state.over) {
      if (state.mode === 'winner') {
        html =
          '<div class="winnergrid">' +
            '<button type="button" class="btn winbtn one" data-win="1">' +
              '<span class="wb-name">' + esc(state.p1.name) + '</span>' +
              '<span class="wb-label">wins the round</span>' +
            '</button>' +
            '<button type="button" class="btn winbtn two" data-win="2">' +
              '<span class="wb-name">' + esc(state.p2.name) + '</span>' +
              '<span class="wb-label">wins the round</span>' +
            '</button>' +
          '</div>';
      } else {
        var lead = state.open.p1 === 0 && state.open.p2 === 0
          ? '' : (state.open.p1 === state.open.p2 ? ' nolead' : (state.open.p1 > state.open.p2 ? ' live' : ''));
        html =
          '<div class="pointsgrid">' +
            '<div class="ppanel one' + (lead === ' live' ? ' live' : '') + '">' +
              '<div class="pp-name">' + esc(state.p1.name) + '</div>' +
              '<div class="pp-score">' + state.open.p1 + '</div>' +
              '<div class="pp-add">' +
                '<input type="number" inputmode="numeric" min="0" placeholder="How much?" class="pp-input" data-player="1">' +
                '<button type="button" class="btn" data-player="1" data-add>Add</button>' +
              '</div>' +
            '</div>' +
            '<div class="ppanel two">' +
              '<div class="pp-name">' + esc(state.p2.name) + '</div>' +
              '<div class="pp-score">' + state.open.p2 + '</div>' +
              '<div class="pp-add">' +
                '<input type="number" inputmode="numeric" min="0" placeholder="How much?" class="pp-input" data-player="2">' +
                '<button type="button" class="btn" data-player="2" data-add>Add</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn primary big" id="endRoundBtn">End round</button>';
      }
    }
    area.innerHTML = html;
  }

  function renderHistory() {
    var list = document.getElementById('historyList');
    if (!state.history.length) {
      list.innerHTML = '<li class="emptyhist">No rounds yet &mdash; tap a player to start.</li>';
      document.getElementById('undoBtn').disabled = true;
      return;
    }
    document.getElementById('undoBtn').disabled = false;
    var rows = [];
    for (var i = state.history.length - 1; i >= 0; i--) {
      var h = state.history[i];
      var who;
      var cls = 'draw';
      if (h.winner === 1) { who = state.p1.name + ' wins'; cls = 'w1'; }
      else if (h.winner === 2) { who = state.p2.name + ' wins'; cls = 'w2'; }
      else { who = 'draw'; }
      var names = esc(state.p1.name) + ' <span class="rnumx">' + h.p1;
      if (state.mode === 'points') {
        names += ' &ndash; ' + h.p2;
      }
      names += '</span> ' + esc(state.p2.name);
      rows.push(
        '<li class="hrow"><span class="rnum">R' + h.n + '</span>' +
        '<span class="rnames">' + names + '</span>' +
        '<span class="rwin ' + cls + '">' + esc(who) + '</span></li>'
      );
    }
    list.innerHTML = rows.join('');
  }

  /* ---------- persistence ---------- */
  function commit(next) {
    state = next;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: ignore */ }
    render();
  }

  /* ---------- events ---------- */
  function addTyped(player, input) {
    var val = input.value === '' ? 0 : Number(input.value);
    if (isFinite(val) && val > 0) {
      commit(DuoCore.addPoints(state, player, val));
      input.value = '';
      input.focus();
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-win],[data-add],#endRoundBtn,#rematchBtn,#undoBtn,#resetBtn,#configBtn') : null;
    if (!t) return;

    if (t.hasAttribute('data-win')) commit(DuoCore.closeWinner(state, Number(t.getAttribute('data-win'))));
    else if (t.hasAttribute('data-add')) {
      var p = Number(t.getAttribute('data-player'));
      var inp = t.parentElement.querySelector('.pp-input');
      if (inp) addTyped(p, inp);
    }
    else if (t.id === 'endRoundBtn') commit(DuoCore.endRound(state));
    else if (t.id === 'rematchBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'undoBtn') commit(DuoCore.undo(state));
    else if (t.id === 'resetBtn') commit(DuoCore.rematch(DuoCore.setTarget(DuoCore.createGame(null), state.target)));
    else if (t.id === 'configBtn') openConfig();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var inp = e.target.closest ? e.target.closest('.pp-input') : null;
    if (inp) {
      e.preventDefault();
      addTyped(Number(inp.getAttribute('data-player')), inp);
    }
  });

  /* ---------- config dialog ---------- */
  var dialog = document.getElementById('configDialog');
  function openConfig() {
    document.getElementById('cfgName1').value = state.p1.name;
    document.getElementById('cfgName2').value = state.p2.name;
    document.getElementById('cfgMode').value = state.mode;
    document.getElementById('cfgTarget').value = state.target;
    dialog.showModal();
  }
  document.getElementById('configForm').addEventListener('submit', function () {
    commit(DuoCore.setNames(state,
      document.getElementById('cfgName1').value,
      document.getElementById('cfgName2').value));
    commit(DuoCore.setMode(state, document.getElementById('cfgMode').value));
    commit(DuoCore.setTarget(state, Number(document.getElementById('cfgTarget').value)));
  });
  document.getElementById('cfgCancel').addEventListener('click', function () {
    dialog.close();
  });

  /* ---------- service worker (offline) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./js/sw.js').catch(function () { /* offline PWA is progressive enhancement */ });
  }

  render();
})();