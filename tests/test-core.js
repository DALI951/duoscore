/* DuoScore v4 core tests — run: node tests/test-core.js */
'use strict';
var DuoCore = require('../js/score-core.js');

var pass = 0, fail = 0;
function eq(name, got, want) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' -> got ' + g + ' want ' + w); }
}

// defaults + names + no target by default
var s = DuoCore.createGame(null);
eq('defaults', [s.version, s.score, s.target, s.round, s.history.length, s.over], [4, { p1: 0, p2: 0 }, 0, 1, 0, null]);

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

// target: set / clear
var w = DuoCore.setTarget(DuoCore.createGame(null), 100);
eq('target set', w.target, 100);
eq('target invalid -> off', DuoCore.setTarget(w, 0).target, 0);
eq('target junk -> off', DuoCore.setTarget(w, 'x').target, 0);

// auto-finish when a player crosses the target
var t = DuoCore.setTarget(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 45, 30), 30, 10), 50);
// after setTarget Dali's totals already exceeded -> auto over? neither reached at set time (75 vs 40) -> not over until next add
eq('set below totals auto-finishes', t.over, { winner: 1, score: { p1: 75, p2: 40 } });
var t2 = DuoCore.setTarget(DuoCore.addRound(DuoCore.createGame(null), 45, 30), 40);
eq('set below totals auto-finishes (2)', t2.over && t2.over.winner, 1);
var t3 = DuoCore.setTarget(DuoCore.createGame(null), 100);
t3 = DuoCore.addRound(t3, 60, 40);
eq('no finish below target', t3.over, null);
t3 = DuoCore.addRound(t3, 40, 70); // p1=100, p2=110 -> both reached, higher total wins
eq('both cross -> higher total wins', [t3.over.winner, t3.over.score], [2, { p1: 100, p2: 110 }]);
eq('auto-over locks adds', DuoCore.addRound(t3, 5, 5), t3);
var t4 = DuoCore.addRound(DuoCore.addRound(DuoCore.setTarget(DuoCore.createGame(null), 50), 25, 25), 25, 25);
eq('target - both reached equal -> draw', t4.over.winner, 0);

// manual finish (no target) + lock
var f = DuoCore.finish(s);
eq('finish winner', [f.over.winner, f.over.score], [2, { p1: 7, p2: 11 }]);
eq('finish locks', DuoCore.addRound(f, 99, 1), f);
var d0 = DuoCore.finish(DuoCore.addRound(DuoCore.createGame(null), 4, 4));
eq('finish draw', d0.over.winner, 0);

// undo pops last round, restores both totals, unlocks
var u = DuoCore.undo(f);
eq('undo restores', [u.score.p1, u.score.p2, u.round, u.over], [5, 3, 2, null]);

// delete any round, recompute both totals
var d = DuoCore.addRound(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 5, 3), 2, 7), 1, 9);
eq('before delete', [d.score.p1, d.score.p2], [8, 19]);
d = DuoCore.deleteRound(d, 2); // remove 2-7
eq('delete recomputes', [d.score.p1, d.score.p2, d.round], [6, 12, 4]);
eq('delete missing no-op', DuoCore.deleteRound(d, 999), d);

// rematch keeps names + target, clears everything
var r = DuoCore.rematch(DuoCore.setTarget(d, 60));
eq('rematch clean', [r.score, r.round, r.history.length, r.over, r.target], [{ p1: 0, p2: 0 }, 1, 0, null, 60]);
eq('rematch keeps names', [r.p1.name, r.p2.name], ['Player 1', 'Player 2']);

// names cleaned
var n = DuoCore.setNames(DuoCore.createGame(null), '  Adam  ', '');
eq('names cleaned', [n.p1.name, n.p2.name], ['Adam', 'Player']);

// persistence: v4 roundtrip (with target), older shapes MIGRATE, garbage -> fresh
var saved = DuoCore.setTarget(DuoCore.addRound(DuoCore.addRound(DuoCore.createGame(null), 2, 4), 6, 1), 50);
eq('load roundtrip', DuoCore.load(JSON.stringify(saved)), saved);
var v3 = { version: 3, p1: { name: 'Adam' }, p2: { name: 'Sam' }, score: { p1: 12, p2: 7 }, target: undefined,
           round: 3, history: [{ n: 1, p1: 5, p2: 3 }, { n: 2, p1: 7, p2: 4 }], over: null };
var m3 = DuoCore.load(JSON.stringify(v3));
eq('v3 migrates to v4', [m3.version, m3.target, m3.score], [4, 0, { p1: 12, p2: 7 }]);
eq('v3 history kept', m3.history, v3.history);
var v2 = { version: 2, p1: { name: 'A' }, p2: { name: 'B' }, score: { p1: 8, p2: 9 }, round: 3,
           history: [{ n: 1, player: 1, pts: 5 }, { n: 2, player: 2, pts: 9 }, { n: 3, player: 1, pts: 3 }], over: null };
var m2 = DuoCore.load(JSON.stringify(v2));
eq('v2 migrates totals', [m2.score.p1, m2.score.p2, m2.version, m2.target], [8, 9, 4, 0]);
eq('v2 rounds rebuilt', m2.history, [{ n: 1, p1: 5, p2: 0 }, { n: 2, p1: 0, p2: 9 }, { n: 3, p1: 3, p2: 0 }]);
eq('v2 names kept', [m2.p1.name, m2.p2.name], ['A', 'B']);
eq('v1 shape -> fresh', DuoCore.load('{"version":1,"wins":{"p1":1}}').history.length, 0);
eq('load garbage -> defaults', DuoCore.load('not json').round, 1);
eq('load null -> defaults', DuoCore.load(null).version, 4);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);