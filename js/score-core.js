/* DuoScore v3 — pure match logic. No DOM. Node (require) + browser (window.DuoCore).
   Model: each round records BOTH players' points at once ({n, p1, p2}); they add
   straight to the running TOTALS. Nobody wins a round — the match winner is the
   highest TOTAL at Finish. */
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

  function toPts(v) {
    v = Math.round(Number(v));
    return isFinite(v) && v > 0 ? v : 0;
  }

  function createGame(overrides) {
    var s = {
      version: 3,
      p1: { name: 'Player 1' },
      p2: { name: 'Player 2' },
      score: { p1: 0, p2: 0 },   // running TOTALS
      round: 1,                  // next round number
      history: [],               // [{n, p1, p2}]
      over: null                 // {winner: 1|2|0, score:{p1,p2}} when finished
    };
    if (overrides) {
      if (overrides.p1 && typeof overrides.p1.name === 'string') s.p1.name = cleanName(overrides.p1.name);
      if (overrides.p2 && typeof overrides.p2.name === 'string') s.p2.name = cleanName(overrides.p2.name);
    }
    return s;
  }

  /* One round: BOTH players' points at the same time. A round needs at least one
     positive number (the other side can be 0/empty). */
  function addRound(s, p1pts, p2pts) {
    if (s.over) return s;
    var a = toPts(p1pts), b = toPts(p2pts);
    if (a === 0 && b === 0) return s;
    var next = clone(s);
    next.score.p1 += a;
    next.score.p2 += b;
    next.history.push({ n: next.round, p1: a, p2: b });
    next.round += 1;
    return next;
  }

  /* Lock the match: winner = higher TOTAL (0 = draw). */
  function finish(s) {
    if (s.over) return s;
    var next = clone(s);
    var winner = next.score.p1 > next.score.p2 ? 1 : next.score.p2 > next.score.p1 ? 2 : 0;
    next.over = { winner: winner, score: { p1: next.score.p1, p2: next.score.p2 } };
    return next;
  }

  /* Undo the last round. */
  function undo(s) {
    if (!s.history.length) return s;
    var next = clone(s);
    var last = next.history.pop();
    next.score.p1 -= last.p1;
    next.score.p2 -= last.p2;
    next.round = next.history.length ? next.history[next.history.length - 1].n + 1 : 1;
    next.over = null;
    return next;
  }

  /* Delete one round by its number (any round, not just the last). */
  function deleteRound(s, n) {
    var idx = -1;
    for (var i = 0; i < s.history.length; i++) {
      if (s.history[i].n === n) { idx = i; break; }
    }
    if (idx === -1) return s;
    var next = clone(s);
    var entry = next.history.splice(idx, 1)[0];
    next.score.p1 -= entry.p1;
    next.score.p2 -= entry.p2;
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
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 3 ||
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