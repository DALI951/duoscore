/* DuoScore v2 UI — wires the pure core to the DOM. Simple: totals + small rounds. */
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

  function render() {
    document.getElementById('name1').textContent = state.p1.name;
    document.getElementById('name2').textContent = state.p2.name;
    document.getElementById('w1').textContent = state.score.p1;
    document.getElementById('w2').textContent = state.score.p2;

    // lead line + round badge
    var badge = document.getElementById('roundBadge');
    var diff = state.score.p1 - state.score.p2;
    var lead;
    if (diff > 0) lead = esc(state.p1.name) + ' leads by ' + diff;
    else if (diff < 0) lead = esc(state.p2.name) + ' leads by ' + (-diff);
    else lead = 'Tied';
    badge.innerHTML = 'Round <b>' + state.round + '</b> &middot; ' + lead;

    // match banner
    var banner = document.getElementById('matchBanner');
    if (state.over) {
      var title, scoreline;
      if (state.over.winner === 0) { title = 'It\u2019s a draw!'; scoreline = state.over.score.p1 + ' \u2013 ' + state.over.score.p2; }
      else {
        var champ = state.over.winner === 1 ? state.p1.name : state.p2.name;
        title = champ + ' wins the match!';
        scoreline = state.over.score.p1 + ' \u2013 ' + state.over.score.p2;
      }
      document.getElementById('bannerTitle').textContent = title;
      document.getElementById('bannerScore').innerHTML = scoreline;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    renderRoundArea();
    renderHistory();
  }

  function panel(player) {
    var key = player === 1 ? 'p1' : 'p2';
    return '<div class="ppanel ' + (player === 1 ? 'one' : 'two') + '">' +
      '<div class="pp-name">' + esc(state[key].name) + '</div>' +
      '<div class="pp-add">' +
        '<input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="How much?" class="pp-input" data-player="' + player + '">' +
        '<button type="button" class="btn" data-player="' + player + '" data-add>Add</button>' +
      '</div>' +
    '</div>';
  }

  function renderRoundArea() {
    var area = document.getElementById('roundArea');
    if (state.over) {
      area.innerHTML = '';
      return;
    }
    area.innerHTML =
      '<div class="pointsgrid">' + panel(1) + panel(2) + '</div>' +
      '<button type="button" class="btn primary big" id="finishBtn">Finish match \u25B8</button>';
  }

  function renderHistory() {
    var list = document.getElementById('historyList');
    if (!state.history.length) {
      list.innerHTML = '<li class="emptyhist">No rounds yet \u2014 add points to start.</li>';
      document.getElementById('undoBtn').disabled = true;
      return;
    }
    document.getElementById('undoBtn').disabled = false;
    var rows = [];
    for (var i = state.history.length - 1; i >= 0; i--) {
      var h = state.history[i];
      var name = h.player === 1 ? state.p1.name : state.p2.name;
      rows.push(
        '<li class="hrow"><span class="rnum">R' + h.n + '</span>' +
        '<span class="rnames">' + esc(name) + ' <b>+' + h.pts + '</b></span>' +
        '<button type="button" class="hdel" data-del="' + h.n + '" aria-label="Delete round ' + h.n + '">&#10005;</button></li>'
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
    var digits = String(input.value || '').replace(/\D/g, '');
    if (digits !== '') {
      commit(DuoCore.addRound(state, player, Number(digits)));
      input.value = '';
      input.focus();
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-add],[data-del],#finishBtn,#rematchBtn,#undoBtn,#resetBtn,#configBtn') : null;
    if (!t) return;

    if (t.hasAttribute('data-add')) {
      var p = Number(t.getAttribute('data-player'));
      var inp = t.parentElement.querySelector('.pp-input');
      if (inp) addTyped(p, inp);
    }
    else if (t.hasAttribute('data-del')) commit(DuoCore.deleteRound(state, Number(t.getAttribute('data-del'))));
    else if (t.id === 'finishBtn') commit(DuoCore.finish(state));
    else if (t.id === 'rematchBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'undoBtn') commit(DuoCore.undo(state));
    else if (t.id === 'resetBtn') commit(DuoCore.rematch(state));
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

  /* ---------- settings (names only) ---------- */
  var dialog = document.getElementById('configDialog');
  function openConfig() {
    document.getElementById('cfgName1').value = state.p1.name;
    document.getElementById('cfgName2').value = state.p2.name;
    dialog.showModal();
  }
  document.getElementById('configForm').addEventListener('submit', function () {
    commit(DuoCore.setNames(state,
      document.getElementById('cfgName1').value,
      document.getElementById('cfgName2').value));
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