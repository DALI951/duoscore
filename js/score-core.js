/* DuoScore — pure score/match logic. No DOM. Works in Node (require) and browsers (window.DuoCore). */
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

  function createGame(overrides) {
    var s = {
      version: 1,
      mode: 'winner',              // 'winner' | 'points'
      target: 3,                   // wins needed to win the match (1-15)
      p1: { name: 'Player 1' },
      p2: { name: 'Player 2' },
      round: 1,                    // current (open) round number
      open: { p1: 0, p2: 0 },      // open-round points (points mode)
      wins: { p1: 0, p2: 0 },
      history: [],                 // closed rounds: {n, p1, p2, winner} winner: 1|2|0(draw)
      over: null                   // {winner: 1|2, score: {p1, p2}} when match finished
    };
    if (overrides) {
      if (overrides.mode === 'winner' || overrides.mode === 'points') s.mode = overrides.mode;
      if (typeof overrides.target === 'number') s.target = clampTarget(overrides.target);
      if (overrides.p1 && typeof overrides.p1.name === 'string') s.p1.name = cleanName(overrides.p1.name);
      if (overrides.p2 && typeof overrides.p2.name === 'string') s.p2.name = cleanName(overrides.p2.name);
    }
    return s;
  }

  function cleanName(n) {
    n = String(n).trim();
    return n === '' ? 'Player' : n;
  }

  function clampTarget(t) {
    t = Math.round(Number(t));
    if (!isFinite(t)) return 3;
    return Math.max(1, t); // no upper limit — Dali wants any target
  }

  function recomputeOver(s) {
    if (s.wins.p1 >= s.target) {
      s.over = { winner: 1, score: { p1: s.wins.p1, p2: s.wins.p2 } };
    } else if (s.wins.p2 >= s.target) {
      s.over = { winner: 2, score: { p1: s.wins.p1, p2: s.wins.p2 } };
    } else {
      s.over = null;
    }
    return s;
  }

  /* Winner mode: player (1|2) wins the current round. */
  function closeWinner(s, player) {
    if (s.mode !== 'winner' || s.over || (player !== 1 && player !== 2)) return s;
    var next = clone(s);
    next.history.push({ n: next.round, p1: 0, p2: 0, winner: player });
    next.wins[player === 1 ? 'p1' : 'p2'] += 1;
    next.round += 1;
    next.open = { p1: 0, p2: 0 };
    return recomputeOver(next);
  }

  /* Points mode: add points to a player's open round. */
  function addPoints(s, player, pts) {
    if (s.mode !== 'points' || s.over || (player !== 1 && player !== 2)) return s;
    pts = Math.round(Number(pts));
    if (!isFinite(pts) || pts <= 0) return s;
    var next = clone(s);
    var key = player === 1 ? 'p1' : 'p2';
    next.open[key] += pts;
    return next;
  }

  /* Points mode: lock the open round, award the win. */
  function endRound(s) {
    if (s.mode !== 'points' || s.over) return s;
    var next = clone(s);
    var winner = next.open.p1 > next.open.p2 ? 1 : next.open.p2 > next.open.p1 ? 2 : 0;
    next.history.push({ n: next.round, p1: next.open.p1, p2: next.open.p2, winner: winner });
    if (winner === 1) next.wins.p1 += 1;
    if (winner === 2) next.wins.p2 += 1;
    next.round += 1;
    next.open = { p1: 0, p2: 0 };
    return recomputeOver(next);
  }

  /* Undo the last closed round. Recomputes wins from history (robust). */
  function undo(s) {
    if (!s.history.length) return s;
    var next = clone(s);
    next.history.pop();
    next.round = next.history.length + 1;
    next.open = { p1: 0, p2: 0 };
    next.wins = { p1: 0, p2: 0 };
    next.history.forEach(function (h) {
      if (h.winner === 1) next.wins.p1 += 1;
      if (h.winner === 2) next.wins.p2 += 1;
    });
    return recomputeOver(next);
  }

  function rematch(s) {
    var next = clone(s);
    next.round = 1;
    next.open = { p1: 0, p2: 0 };
    next.wins = { p1: 0, p2: 0 };
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

  function setMode(s, mode) {
    if (mode !== 'winner' && mode !== 'points') return s;
    var next = clone(s);
    next.mode = mode;
    next.open = { p1: 0, p2: 0 };
    return next;
  }

  function setTarget(s, t) {
    var next = clone(s);
    next.target = clampTarget(t);
    return recomputeOver(next);
  }

  function load(raw) {
    try {
      var parsed = JSON.parse(raw);
      var s = createGame(parsed);
      // re-validate the loaded state shape
      if (!parsed || typeof parsed !== 'object' || typeof parsed.wins !== 'object' ||
          typeof parsed.history !== 'object' || !Array.isArray(parsed.history)) {
        return createGame(null);
      }
      return parsed;
    } catch (e) {
      return createGame(null);
    }
  }

  return {
    createGame: createGame,
    closeWinner: closeWinner,
    addPoints: addPoints,
    endRound: endRound,
    undo: undo,
    rematch: rematch,
    setNames: setNames,
    setMode: setMode,
    setTarget: setTarget,
    load: load
  };
});