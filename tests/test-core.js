/* DuoScore core tests — run: node tests/test-core.js */
'use strict';
var DuoCore = require('../js/score-core.js');

var pass = 0, fail = 0;
function eq(name, got, want) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> got ' + g + ' want ' + w); }
}

// defaults
var s = DuoCore.createGame(null);
eq('defaults', [s.mode, s.target, s.round, s.wins, s.over], ['winner', 3, 1, { p1: 0, p2: 0 }, null]);

// winner mode: close round for player 1
s = DuoCore.closeWinner(s, 1);
eq('winner closes round 1', [s.round, s.wins, s.history.length, s.history[0]], [2, { p1: 1, p2: 0 }, 1, { n: 1, p1: 0, p2: 0, winner: 1 }]);

// match over at target
s = DuoCore.closeWinner(s, 1);
s = DuoCore.closeWinner(s, 1);
eq('match over', [s.over.winner, s.over.score], [1, { p1: 3, p2: 0 }]);
eq('no-op when over', DuoCore.closeWinner(s, 2), s);

// undo restores everything
var before = DuoCore.undo(s);
eq('undo revives match', [before.over, before.wins, before.round], [null, { p1: 2, p2: 0 }, 3]);
eq('undo pops history', before.history.length, 2);

// points mode: add, endRound winner + tie
var p = DuoCore.setMode(DuoCore.createGame(null), 'points');
p = DuoCore.addPoints(p, 1, 5);
p = DuoCore.addPoints(p, 1, 1);
p = DuoCore.addPoints(p, 2, 2);
eq('open points', p.open, { p1: 6, p2: 2 });
p = DuoCore.endRound(p);
eq('endRound winner', [p.history[0].winner, p.wins.p1, p.round], [1, 1, 2]);
var t = DuoCore.createGame(null);
var tie = DuoCore.addPoints(DuoCore.addPoints(DuoCore.setMode(t, 'points'), 1, 3), 2, 3);
tie = DuoCore.endRound(tie);
eq('tie round', [tie.history[0].winner, tie.wins], [0, { p1: 0, p2: 0 }]);
eq('tie advances round', tie.round, 2);

// undo in points mode recomputes from history
var pun = DuoCore.endRound(DuoCore.addPoints(DuoCore.addPoints(DuoCore.setMode(DuoCore.createGame(null), 'points'), 2, 9), 1, 4));
pun = DuoCore.addPoints(pun, 1, 2);
pun = DuoCore.endRound(pun); // round 2: p1 wins 2-0
eq('two closed rounds', pun.history.length, 2);
var pu = DuoCore.undo(pun);
eq('undo keeps first win', [pu.history.length, pu.wins, pu.round], [1, { p1: 0, p2: 1 }, 2]);

// delete any round + clear open points
var d = DuoCore.closeWinner(DuoCore.closeWinner(DuoCore.closeWinner(DuoCore.createGame(null), 1), 2), 1);
d = DuoCore.deleteRound(d, 2); // remove P2's round
eq('delete middle round', [d.history.length, d.history.map(function (h) { return h.n; }), d.wins], [2, [1, 3], { p1: 2, p2: 0 }]);
eq('delete missing no-op', DuoCore.deleteRound(d, 999), d);
var drained = DuoCore.closeWinner(DuoCore.closeWinner(DuoCore.createGame(null), 1), 1); // [R1,R2]
drained = DuoCore.deleteRound(drained, 1);
eq('delete first of two', [drained.history.map(function (h) { return h.n; }), drained.wins, drained.round], [[2], { p1: 1, p2: 0 }, 3]);
var delSingle = DuoCore.deleteRound(DuoCore.closeWinner(DuoCore.createGame(null), 1), 1);
eq('delete only round -> empty', [delSingle.history.length, delSingle.wins, delSingle.round], [0, { p1: 0, p2: 0 }, 1]);
var c = DuoCore.addPoints(DuoCore.addPoints(DuoCore.setMode(DuoCore.createGame(null), 'points'), 1, 5), 2, 3);
c = DuoCore.clearOpen(c, 1);
eq('clearOpen zeroes p1', c.open, { p1: 0, p2: 3 });
eq('clearOpen guards', DuoCore.clearOpen(DuoCore.createGame(null), 1), DuoCore.createGame(null));

// rematch
var r = DuoCore.closeWinner(DuoCore.closeWinner(s, 1), 2);
r = DuoCore.rematch(r);
eq('rematch clean', [r.round, r.wins, r.history.length, r.over], [1, { p1: 0, p2: 0 }, 0, null]);
eq('rematch keeps names/target', [r.p1.name, r.target], ['Player 1', 3]);

// names / target
var n = DuoCore.setNames(DuoCore.createGame(null), '  Adam  ', '');
eq('names cleaned', [n.p1.name, n.p2.name], ['Adam', 'Player']);
eq('target no upper limit', DuoCore.setTarget(DuoCore.createGame(null), 99).target, 99);
eq('target big value', DuoCore.setTarget(DuoCore.createGame(null), 1000).target, 1000);
eq('target floor', DuoCore.setTarget(DuoCore.createGame(null), -3).target, 1);

// persistence roundtrip
var saved = JSON.parse(JSON.stringify(DuoCore.closeWinner(DuoCore.createGame(null), 2)));
var loaded = DuoCore.load(JSON.stringify(saved));
eq('load roundtrip', loaded, saved);
eq('load garbage -> defaults', DuoCore.load('not json').target, 3);
eq('load null -> defaults', DuoCore.load(null).mode, 'winner');

// addPoints guards
var gp = DuoCore.addPoints(DuoCore.setMode(DuoCore.createGame(null), 'points'), 1, 0);
eq('addPoints ignores 0', gp.open, { p1: 0, p2: 0 });

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);