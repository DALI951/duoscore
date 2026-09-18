/* DuoScore v3 UI — one round form where BOTH players' points go in at the same
   time; history shows both numbers per round. Pure core + thin DOM wiring. */
(function () {
  'use strict';
  var KEY = 'duoscore.v3';
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

  function renderRoundArea() {
    var area = document.getElementById('roundArea');
    if (state.over) { area.innerHTML = ''; return; }
    area.innerHTML =
      '<div class="roundform">' +
        '<div class="rf-title">Round <b>' + state.round + '</b></div>' +
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
    // restore focus to the side that had it (after undo/delete from history)
    var first = area.querySelector('.pp-input');
    if (first && document.activeElement === document.body) first.focus();
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
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: ignore */ }
    render();
  }

  /* ---------- events ---------- */
  function digits(v) { return String(v).replace(/\D/g, ''); }

  function gatherRound(area) {
    var inputs = area.querySelectorAll('.pp-input');
    if (inputs.length === 2 && DuoCore.addRound(state, digits(inputs[0].value), digits(inputs[1].value)) !== state) {
      commit(DuoCore.addRound(state, digits(inputs[0].value), digits(inputs[1].value)));
      inputs[0].value = '';
      inputs[1].value = '';
      inputs[0].focus();
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#addRoundBtn,#finishBtn,#rematchBtn,#undoBtn,#resetBtn,#configBtn,[data-del]') : null;
    if (!t) return;

    if (t.id === 'addRoundBtn') gatherRound(document.getElementById('roundArea'));
    else if (t.id === 'finishBtn') commit(DuoCore.finish(state));
    else if (t.id === 'rematchBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'undoBtn') commit(DuoCore.undo(state));
    else if (t.id === 'resetBtn') commit(DuoCore.rematch(state));
    else if (t.id === 'configBtn') openConfig();
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
    navigator.serviceWorker.register('./js/sw.js').catch(function () { /* progressive enhancement */ });
  }

  render();
})();