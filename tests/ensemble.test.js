'use strict';

// Unit tests for the tree-voting model behind the hero illustration (ensemble.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const E = require(path.join(__dirname, '..', 'ensemble.js'));

const accuracy = (predict, data) => {
  let right = 0;
  for (let i = 0; i < data.y.length; i += 1) {
    if (predict(data.x[2 * i], data.x[2 * i + 1]) === data.y[i]) right += 1;
  }
  return right / data.y.length;
};

test('createRng is deterministic for a seed and stays in [0, 1)', () => {
  const a = E.createRng(7);
  const b = E.createRng(7);
  const c = E.createRng(8);
  const fromA = Array.from({ length: 50 }, () => a());
  const fromB = Array.from({ length: 50 }, () => b());
  const fromC = Array.from({ length: 50 }, () => c());
  assert.deepEqual(fromA, fromB);
  assert.notDeepEqual(fromA, fromC);
  assert.ok(fromA.every((v) => v >= 0 && v < 1));
});

test('makeMoons returns n finite points in two balanced classes', () => {
  const data = E.makeMoons(400, 0.25, E.createRng(1));
  assert.equal(data.y.length, 400);
  assert.equal(data.x.length, 800);
  assert.ok(Array.from(data.x).every(Number.isFinite));
  const ones = data.y.reduce((sum, label) => sum + label, 0);
  assert.equal(ones, 200);
  assert.ok(Array.from(data.y).every((label) => label === 0 || label === 1));
});

test('sampleIndices draws k distinct indices below n', () => {
  const picked = E.sampleIndices(1000, 100, E.createRng(3));
  assert.equal(picked.length, 100);
  assert.equal(new Set(picked).size, 100);
  assert.ok(picked.every((i) => Number.isInteger(i) && i >= 0 && i < 1000));
});

test('trainTree learns a clean threshold on one feature', () => {
  // class 1 exactly when the first feature is above 0.5
  const n = 60;
  const x = new Float64Array(2 * n);
  const y = new Uint8Array(n);
  const rng = E.createRng(11);
  for (let i = 0; i < n; i += 1) {
    x[2 * i] = rng();
    x[2 * i + 1] = rng();
    y[i] = x[2 * i] > 0.5 ? 1 : 0;
  }
  const data = { x, y };
  const tree = E.trainTree(data, Array.from({ length: n }, (_, i) => i), { maxDepth: 3, minSamplesLeaf: 1 });
  assert.equal(accuracy((a, b) => E.predictTree(tree, a, b), data), 1);
  assert.equal(E.predictTree(tree, 0.01, 0.9), 0);
  assert.equal(E.predictTree(tree, 0.99, 0.1), 1);
});

test('trainTree never grows deeper than maxDepth', () => {
  const data = E.makeMoons(300, 0.4, E.createRng(5));
  const all = Array.from({ length: 300 }, (_, i) => i);
  for (const maxDepth of [1, 2, 4]) {
    const tree = E.trainTree(data, all, { maxDepth, minSamplesLeaf: 1 });
    assert.ok(tree.depth <= maxDepth, `depth ${tree.depth} exceeds ${maxDepth}`);
    assert.ok(tree.depth >= 1);
  }
});

test('a single-class sample becomes one leaf that predicts that class', () => {
  const data = { x: new Float64Array([0, 0, 1, 1, 2, 2]), y: new Uint8Array([1, 1, 1]) };
  const tree = E.trainTree(data, [0, 1, 2], { maxDepth: 5, minSamplesLeaf: 1 });
  assert.equal(tree.depth, 0);
  assert.equal(E.predictTree(tree, -5, 5), 1);
});

test('a majority vote of small trees beats the average small tree', () => {
  const pool = E.makeMoons(1000, 0.3, E.createRng(21));
  const holdout = E.makeMoons(1000, 0.3, E.createRng(22));
  const rng = E.createRng(23);
  const trees = [];
  for (let t = 0; t < 200; t += 1) {
    trees.push(E.trainTree(pool, E.sampleIndices(1000, 100, rng), { maxDepth: 5, minSamplesLeaf: 2 }));
  }
  const single = trees.map((tree) => accuracy((a, b) => E.predictTree(tree, a, b), holdout));
  const meanSingle = single.reduce((sum, v) => sum + v, 0) / single.length;
  const vote = accuracy((a, b) => {
    let ones = 0;
    for (const tree of trees) ones += E.predictTree(tree, a, b);
    return ones * 2 > trees.length ? 1 : 0;
  }, holdout);
  assert.ok(vote > meanSingle + 0.02, `vote ${vote} should clearly beat the mean single tree ${meanSingle}`);
  assert.ok(vote > 0.85, `vote accuracy ${vote} is implausibly low`);
});

test('CHECKPOINTS climb from 1 tree to 1,000', () => {
  const points = E.CHECKPOINTS;
  assert.equal(points[0], 1);
  assert.equal(points[points.length - 1], 1000);
  for (let i = 1; i < points.length; i += 1) assert.ok(points[i] > points[i - 1]);
});

test('a forest trains in steps and snapshots its votes at every checkpoint', () => {
  const forest = E.createForest({ seed: 4, cols: 24, rows: 12 });
  assert.equal(forest.total, 1000);
  assert.equal(forest.trained, 0);
  assert.equal(forest.ready(0), false);

  forest.advance(1);
  assert.equal(forest.trained, 1);
  assert.equal(forest.ready(0), true);
  assert.equal(forest.ready(1), false);
  // one tree: every cell is a unanimous 0 or 1
  for (let cell = 0; cell < 24 * 12; cell += 1) {
    assert.ok([0, 1].includes(forest.share(0, cell)));
  }

  forest.advance(5000); // asking for too many just finishes the forest
  assert.equal(forest.trained, 1000);
  assert.equal(forest.done, true);
  const last = E.CHECKPOINTS.length - 1;
  assert.equal(forest.ready(last), true);

  let mixed = 0;
  for (let cell = 0; cell < 24 * 12; cell += 1) {
    const share = forest.share(last, cell);
    assert.ok(share >= 0 && share <= 1);
    if (share > 0.05 && share < 0.95) mixed += 1;
  }
  assert.ok(mixed > 0, 'with 1,000 trees some cells near the boundary should be contested');
});

test('painting leaf rectangles gives the same votes as asking every tree about every cell', () => {
  const cols = 31;
  const rows = 17;
  const forest = E.createForest({ seed: 12, cols, rows, keepTrees: true });
  forest.advance(13);
  const k = E.CHECKPOINTS.indexOf(13);
  const { x0, x1, y0, y1 } = forest.domain;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x0 + ((c + 0.5) / cols) * (x1 - x0);
      const cy = y1 - ((r + 0.5) / rows) * (y1 - y0);
      let ones = 0;
      for (const tree of forest.trees) ones += E.predictTree(tree, cx, cy);
      assert.equal(forest.snapshots[k][r * cols + c], ones, `cell (${c}, ${r})`);
    }
  }
});

test('share blends neighbouring checkpoints for positions in between', () => {
  const forest = E.createForest({ seed: 4, cols: 24, rows: 12 });
  forest.advance(1000);
  for (const cell of [0, 77, 150, 287]) {
    const a = forest.share(3, cell);
    const b = forest.share(4, cell);
    const mid = forest.share(3.5, cell);
    assert.ok(Math.abs(mid - (a + b) / 2) < 1e-9);
  }
});

test('the same seed always grows the same forest', () => {
  const one = E.createForest({ seed: 9, cols: 16, rows: 8 });
  const two = E.createForest({ seed: 9, cols: 16, rows: 8 });
  one.advance(144);
  two.advance(144);
  const k = E.CHECKPOINTS.indexOf(144);
  for (let cell = 0; cell < 16 * 8; cell += 1) {
    assert.equal(one.share(k, cell), two.share(k, cell));
  }
});

// ---- playback: how the picture moves between checkpoints ----

test('nothing is painted before the first checkpoint is in', () => {
  assert.equal(E.shouldHold({ readyIndex: -1, reducedMotion: false, done: false }), true);
  assert.equal(E.shouldHold({ readyIndex: 0, reducedMotion: false, done: false }), false);
});

test('with reduced motion the picture waits for the whole forest', () => {
  assert.equal(E.shouldHold({ readyIndex: 6, reducedMotion: true, done: false }), true);
  assert.equal(E.shouldHold({ readyIndex: 14, reducedMotion: true, done: true }), false);
});

test('with reduced motion the picture jumps straight to its goal', () => {
  assert.equal(E.nextPosition({ position: 0, goal: 14, readyIndex: 14, reducedMotion: true }), 14);
  assert.equal(E.nextPosition({ position: 14, goal: 3, readyIndex: 14, reducedMotion: true }), 3);
});

test('otherwise the picture eases towards its goal, in both directions', () => {
  const forward = E.nextPosition({ position: 0, goal: 14, readyIndex: 14, reducedMotion: false });
  assert.ok(forward > 0 && forward < 14, `expected a partial step, got ${forward}`);
  const back = E.nextPosition({ position: 14, goal: 0, readyIndex: 14, reducedMotion: false });
  assert.ok(back < 14 && back > 0, `expected a partial step back, got ${back}`);
});

test('the picture never runs ahead of the trees that are trained', () => {
  let position = 0;
  for (let frame = 0; frame < 200; frame += 1) {
    position = E.nextPosition({ position, goal: 14, readyIndex: 3, reducedMotion: false });
    assert.ok(position <= 3);
  }
  assert.equal(position, 3, 'it settles exactly on the last ready checkpoint');
});

test('the picture settles exactly on its goal instead of creeping forever', () => {
  let position = 0;
  let frames = 0;
  while (position !== 14 && frames < 500) {
    position = E.nextPosition({ position, goal: 14, readyIndex: 14, reducedMotion: false });
    frames += 1;
  }
  assert.equal(position, 14);
  assert.ok(frames < 60, `took ${frames} frames to settle`);
});

test('density is a normalised map of where the training points sit', () => {
  const forest = E.createForest({ seed: 4, cols: 24, rows: 12 });
  assert.equal(forest.density.length, 24 * 12);
  const values = Array.from(forest.density);
  assert.ok(values.every((v) => v >= 0 && v <= 1));
  assert.ok(Math.max(...values) > 0.99);
});
