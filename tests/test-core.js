/* DuoScore v2 core tests — run: node tests/test-core.js */
'use strict';
var DuoCore = require('../js/score-core.js');

var pass = 0, fail = 0;
function eq(name, got, want) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> got ' + g + ' want ' + w); }
}

// defaults + names
var s = DuoCore.createGame(null);
eq('defaults', [s.version, s.score, s.round, s.history.length, s.over], [2, { p1: 0, p2: 0 }, 1, 0, null]);

// small rounds accumulate into totals
s = DuoCore.addRound(s, 1, 5);
s = DuoCore.addRound(s, 2, 3);
s = DuoCore.addRound(s, 1, 2);
eq('accumulate totals', [s.score.p1, s.score.p2], [7, 3]);
eq('rounds numbered', s.history.map(function (h) { return h.n; }), [1, 2, 3]);
eq('next round', s.round, 4);

// guards
eq('add 0 no-op', DuoCore.addRound(s, 1, 0), s);
eq('add negative no-op', DuoCore.addRound(s, 2, -4), s);
eq('add junk no-op', DuoCore.addRound(s, 1, 'abc'), s);

// finish: winner by whole totals + draw
var f = DuoCore.finish(s);
eq('finish winner', [f.over.winner, f.over.score], [1, { p1: 7, p2: 3 }]);
eq('finish locks', DuoCore.addRound(f, 2, 10), f);
var t = DuoCore.finish(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 1, 4), 2, 4));
eq('finish draw', t.over.winner, 0);

// undo pops last round, restores totals, unlocks
var u = DuoCore.undo(f);
eq('undo restores', [u.score.p1, u.score.p2, u.round, u.over], [5, 3, 3, null]);
var uAll = DuoCore.undo(DuoCore.undo(u));
eq('undo empty guard', [uAll.history.length, DuoCore.undo(uAll).history.length], [0, 0]);

// delete any round, recount handled by sums
var d = DuoCore.addRound(DuoCore.addRound(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 1, 5), 2, 3), 1, 2), 2, 7); // P1 7, P2 10
d = DuoCore.deleteRound(d, 2); // remove P2's +3
eq('delete recomputes', [d.score.p1, d.score.p2], [7, 7]);
eq('delete missing no-op', DuoCore.deleteRound(d, 999), d);
var dEmpty = DuoCore.deleteRound(DuoCore.addRound(DuoCore.createGame(null), 2, 9), 1);
eq('delete to empty', [dEmpty.history.length, dEmpty.score, dEmpty.round], [0, { p1: 0, p2: 0 }, 1]);

// rematch
var r = DuoCore.rematch(f);
eq('rematch clean', [r.score, r.round, r.history.length, r.over], [{ p1: 0, p2: 0 }, 1, 0, null]);
eq('rematch keeps names', [r.p1.name, r.p2.name], ['Player 1', 'Player 2']);

// names
var n = DuoCore.setNames(DuoCore.createGame(null), '  Adam  ', '');
eq('names cleaned', [n.p1.name, n.p2.name], ['Adam', 'Player']);

// persistence: v2 roundtrip, junk/null -> fresh
var saved = DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 1, 2), 2, 4);
var loaded = DuoCore.load(JSON.stringify(saved));
eq('load roundtrip', loaded, saved);
eq('load v1 shape thrown away', DuoCore.load('{"version":1,"wins":{"p1":1}}').score, { p1: 0, p2: 0 });
eq('load garbage -> defaults', DuoCore.load('not json').round, 1);
eq('load null -> defaults', DuoCore.load(null).version, 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);