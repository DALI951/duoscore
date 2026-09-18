/* DuoScore v2 — pure match logic. No DOM. Node (require) + browser (window.DuoCore).
   Model: each add is a small round that adds to a player's TOTAL. The match winner
   is decided by the whole (highest total) at Finish — no per-round winners. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DuoCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function cleanName(n) {
    n = String(n).trim();
    return n === '' ? 'Player' : n;
  }

  function createGame(overrides) {
    var s = {
      version: 2,
      p1: { name: 'Player 1' },
      p2: { name: 'Player 2' },
      score: { p1: 0, p2: 0 },   // running TOTALS — the whole match score
      round: 1,                  // next small round number
      history: [],               // [{n, player: 1|2, pts}]
      over: null                 // {winner: 1|2|0, score:{p1,p2}} when match finished
    };
    if (overrides) {
      if (overrides.p1 && typeof overrides.p1.name === 'string') s.p1.name = cleanName(overrides.p1.name);
      if (overrides.p2 && typeof overrides.p2.name === 'string') s.p2.name = cleanName(overrides.p2.name);
    }
    return s;
  }

  /* A small round: player (1|2) scores pts — added straight to their total. */
  function addRound(s, player, pts) {
    if (s.over || (player !== 1 && player !== 2)) return s;
    pts = Math.round(Number(pts));
    if (!isFinite(pts) || pts <= 0) return s;
    var next = clone(s);
    var key = player === 1 ? 'p1' : 'p2';
    next.score[key] += pts;
    next.history.push({ n: next.round, player: player, pts: pts });
    next.round += 1;
    return next;
  }

  /* Lock the match: winner = higher total (0 = draw). */
  function finish(s) {
    if (s.over) return s;
    var next = clone(s);
    var winner = next.score.p1 > next.score.p2 ? 1 : next.score.p2 > next.score.p1 ? 2 : 0;
    next.over = { winner: winner, score: { p1: next.score.p1, p2: next.score.p2 } };
    return next;
  }

  /* Undo the last small round. */
  function undo(s) {
    if (!s.history.length) return s;
    var next = clone(s);
    var last = next.history.pop();
    next.score[last.player === 1 ? 'p1' : 'p2'] -= last.pts;
    next.round = next.history.length ? next.history[next.history.length - 1].n + 1 : 1;
    next.over = null;
    return next;
  }

  /* Delete a small round by its number (any round, not just the last). */
  function deleteRound(s, n) {
    var idx = -1;
    for (var i = 0; i < s.history.length; i++) {
      if (s.history[i].n === n) { idx = i; break; }
    }
    if (idx === -1) return s;
    var next = clone(s);
    var entry = next.history.splice(idx, 1)[0];
    next.score[entry.player === 1 ? 'p1' : 'p2'] -= entry.pts;
    next.round = next.history.length ? next.history[next.history.length - 1].n + 1 : 1;
    next.over = null;
    return next;
  }

  function rematch(s) {
    var next = clone(s);
    next.score = { p1: 0, p2: 0 };
    next.round = 1;
    next.history = [];
    next.over = null;
    return next;
  }

  function setNames(s, n1, n2) {
    var next = clone(s);
    next.p1.name = cleanName(n1);
    next.p2.name = cleanName(n2);
    return next;
  }

  function load(raw) {
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 2 ||
          typeof parsed.score !== 'object' || !Array.isArray(parsed.history)) {
        return createGame(null);
      }
      return parsed;
    } catch (e) {
      return createGame(null);
    }
  }

  return {
    createGame: createGame,
    addRound: addRound,
    finish: finish,
    undo: undo,
    deleteRound: deleteRound,
    rematch: rematch,
    setNames: setNames,
    load: load
  };
});