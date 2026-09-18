/* DuoScore v4 — pure match logic. No DOM. Node (require) + browser (window.DuoCore).
   Model: each round records BOTH players' points at once ({n, p1, p2}); they add
   straight to the running TOTALS. Optional TARGET: when set, the match ends
   automatically the moment a player's total reaches it (winner = higher total,
   0 = draw). Without a target, Finish is manual. */
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

  function toTarget(v) {
    v = Math.round(Number(v));
    return isFinite(v) && v >= 1 ? v : 0; // 0 = no target
  }

  function winnerOf(s) {
    return s.score.p1 > s.score.p2 ? 1 : s.score.p2 > s.score.p1 ? 2 : 0;
  }

  /* If a target is set and a player has reached it, lock the match. */
  function autoFinish(next) {
    if (next.target > 0 && (next.score.p1 >= next.target || next.score.p2 >= next.target)) {
      next.over = { winner: winnerOf(next), score: { p1: next.score.p1, p2: next.score.p2 } };
    }
    return next;
  }

  function createGame(overrides) {
    var s = {
      version: 4,
      p1: { name: 'Player 1' },
      p2: { name: 'Player 2' },
      score: { p1: 0, p2: 0 },   // running TOTALS
      target: 0,                 // win at this many points (0 = no target)
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

  /* One round: BOTH players' points at the same time. Needs at least one
     positive number (other side may be 0/empty). Auto-finishes on target. */
  function addRound(s, p1pts, p2pts) {
    if (s.over) return s;
    var a = toPts(p1pts), b = toPts(p2pts);
    if (a === 0 && b === 0) return s;
    var next = clone(s);
    next.score.p1 += a;
    next.score.p2 += b;
    next.history.push({ n: next.round, p1: a, p2: b });
    next.round += 1;
    return autoFinish(next);
  }

  /* Manual finish: winner = higher total (0 = draw). Works with or without target. */
  function finish(s) {
    if (s.over) return s;
    var next = clone(s);
    next.over = { winner: winnerOf(next), score: { p1: next.score.p1, p2: next.score.p2 } };
    return next;
  }

  /* Set (n>=1) or clear (0) the win target. Re-finishes if already reached. */
  function setTarget(s, n) {
    var t = toTarget(n);
    if (t === s.target) return s;
    var next = clone(s);
    next.target = t;
    if (t > 0) autoFinish(next);
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

  /* Load + MIGRATE. Never throws away valid match data:
     - v4  -> as-is (target defaulting to 0)
     - v3  -> v4 (adds target: 0)
     - v2  -> v4 best-effort: totals preserved by rebuilding rounds as
              {n, p1: pts-of-1 else 0, p2: pts-of-2 else 0} in original order
     - anything else (v1, garbage, missing) -> fresh game */
  function load(raw) {
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.history)) {
        return createGame(null);
      }
      if (parsed.version === 4) {
        if (typeof parsed.score !== 'object') return createGame(null);
        if (typeof parsed.target !== 'number') parsed.target = 0;
        return parsed;
      }
      if (parsed.version === 3) {
        if (typeof parsed.score !== 'object') return createGame(null);
        parsed.version = 4;
        parsed.target = 0;
        return parsed;
      }
      if (parsed.version === 2) {
        var out = createGame(parsed);
        out.version = 4;
        out.target = 0;
        for (var i = 0; i < parsed.history.length; i++) {
          var h = parsed.history[i];
          var p1 = h.player === 1 ? toPts(h.pts) : 0;
          var p2 = h.player === 2 ? toPts(h.pts) : 0;
          out.score.p1 += p1;
          out.score.p2 += p2;
          out.history.push({ n: i + 1, p1: p1, p2: p2 });
        }
        out.round = out.history.length ? out.history[out.history.length - 1].n + 1 : 1;
        out.over = null;
        return out;
      }
      return createGame(null);
    } catch (e) {
      return createGame(null);
    }
  }

  return {
    createGame: createGame,
    addRound: addRound,
    finish: finish,
    setTarget: setTarget,
    undo: undo,
    deleteRound: deleteRound,
    rematch: rematch,
    setNames: setNames,
    load: load
  };
});