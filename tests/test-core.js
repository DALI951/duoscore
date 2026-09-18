/* DuoScore v3 core tests — run: node tests/test-core.js */
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
eq('defaults', [s.version, s.score, s.round, s.history.length, s.over], [3, { p1: 0, p2: 0 }, 1, 0, null]);

// one round holds BOTH players' numbers
s = DuoCore.addRound(s, 5, 3);
eq('round stores both', s.history[0], { n: 1, p1: 5, p2: 3 });
eq('totals after round', [s.score.p1, s.score.p2], [5, 3]);
s = DuoCore.addRound(s, 2, 8);
eq('accumulate', [s.score.p1, s.score.p2], [7, 11]);
eq('round numbers', s.history.map(function (h) { return h.n; }), [1, 2]);
eq('next round', s.round, 3);

// guards: one side may be empty/0, both empty -> no-op
var oneSide = DuoCore.addRound(s, '', 4);
eq('empty one side = 0', [oneSide.score.p1, oneSide.score.p2], [7, 15]);
var bothZero = DuoCore.addRound(oneSide, 0, 0);
eq('both zero no-op', bothZero, oneSide);
var junk = DuoCore.addRound(oneSide, 'abc', -2);
eq('junk discarded', junk, oneSide);

// finish by whole totals + draw + lock
var f = DuoCore.finish(s);
eq('finish winner', [f.over.winner, f.over.score], [2, { p1: 7, p2: 11 }]);
eq('finish locks', DuoCore.addRound(f, 99, 1), f);
var t = DuoCore.finish(DuoCore.addRound(DuoCore.createGame(null), 4, 4));
eq('finish draw', t.over.winner, 0);

// undo pops last round, restores both totals, unlocks
var u = DuoCore.undo(f);
eq('undo restores', [u.score.p1, u.score.p2, u.round, u.over], [5, 3, 2, null]);

// delete any round, recompute both totals
var d = DuoCore.addRound(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 5, 3), 2, 7), 1, 9);
eq('before delete', [d.score.p1, d.score.p2], [8, 19]);
d = DuoCore.deleteRound(d, 2); // remove 2-7
eq('delete recomputes', [d.score.p1, d.score.p2, d.round], [6, 12, 4]);
eq('delete missing no-op', DuoCore.deleteRound(d, 999), d);

// rematch keeps names, clears everything
var r = DuoCore.rematch(f);
eq('rematch clean', [r.score, r.round, r.history.length, r.over], [{ p1: 0, p2: 0 }, 1, 0, null]);
eq('rematch keeps names', [r.p1.name, r.p2.name], ['Player 1', 'Player 2']);

// names cleaned
var n = DuoCore.setNames(DuoCore.createGame(null), '  Adam  ', '');
eq('names cleaned', [n.p1.name, n.p2.name], ['Adam', 'Player']);

// persistence: v3 roundtrip, junk/v1-v2 -> fresh
var saved = DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 2, 4), 6, 1);
eq('load roundtrip', DuoCore.load(JSON.stringify(saved)), saved);
eq('load v2 shape thrown away', DuoCore.load('{"version":2,"score":{"p1":1}}').score, { p1: 0, p2: 0 });
eq('load garbage -> defaults', DuoCore.load('not json').round, 1);
eq('load null -> defaults', DuoCore.load(null).version, 3);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);