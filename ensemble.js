/* A small decision-tree ensemble, used by the illustration at the top of the page.

   It mirrors the idea of the "Ensemble Learning with Decision Trees" project:
   many small trees, each trained on a random 100-point subset, vote on a class.
   The data here is synthetic (two noisy half-moons), generated from a seed, so
   the picture is identical on every visit.

   No DOM in this file: demo.js does the drawing, the tests load it in Node. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Ensemble = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Tree counts at which the forest keeps a snapshot of its votes. */
  var CHECKPOINTS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 1000];

  /** Seeded random numbers in [0, 1) (mulberry32). */
  function createRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    var u = 1 - rng(); // (0, 1], so the log is finite
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  /** Two interleaved half-moons. x holds (x0, x1) pairs; class 1 is the lower moon. */
  function makeMoons(n, noise, rng) {
    var x = new Float64Array(2 * n);
    var y = new Uint8Array(n);
    var firstLower = n - Math.floor(n / 2);
    for (var i = 0; i < n; i += 1) {
      var t = Math.PI * rng();
      var lower = i >= firstLower;
      x[2 * i] = (lower ? 1 - Math.cos(t) : Math.cos(t)) + noise * gaussian(rng);
      x[2 * i + 1] = (lower ? 0.5 - Math.sin(t) : Math.sin(t)) + noise * gaussian(rng);
      y[i] = lower ? 1 : 0;
    }
    return { x: x, y: y };
  }

  /** k distinct indices below n (a partial Fisher-Yates shuffle). */
  function sampleIndices(n, k, rng) {
    var all = new Int32Array(n);
    for (var i = 0; i < n; i += 1) all[i] = i;
    for (var j = 0; j < k; j += 1) {
      var pick = j + Math.floor(rng() * (n - j));
      var swap = all[j];
      all[j] = all[pick];
      all[pick] = swap;
    }
    return all.slice(0, k);
  }

  /** Gini impurity of a two-class node, times 2 (the constant does not matter). */
  function gini(ones, count) {
    var p = ones / count;
    return p * (1 - p);
  }

  /**
   * Grow a CART classification tree on the rows of `data` listed in `indices`.
   * Splits are axis-aligned and chosen by Gini impurity. A node with feature -1
   * is a leaf; `value` holds its class.
   */
  function trainTree(data, indices, options) {
    var maxDepth = options && options.maxDepth != null ? options.maxDepth : 5;
    var minLeaf = options && options.minSamplesLeaf != null ? options.minSamplesLeaf : 1;
    var x = data.x;
    var y = data.y;

    var feature = [];
    var threshold = [];
    var left = [];
    var right = [];
    var value = [];
    var deepest = 0;

    function addLeaf(ones, count) {
      feature.push(-1);
      threshold.push(0);
      left.push(-1);
      right.push(-1);
      value.push(ones * 2 > count ? 1 : 0);
      return feature.length - 1;
    }

    function build(rows, depth) {
      var count = rows.length;
      var ones = 0;
      for (var i = 0; i < count; i += 1) ones += y[rows[i]];

      if (depth > deepest) deepest = depth;
      if (ones === 0 || ones === count || depth >= maxDepth || count < 2 * minLeaf) {
        return addLeaf(ones, count);
      }

      var parent = gini(ones, count);
      var bestScore = parent - 1e-12; // a split must strictly reduce impurity
      var bestFeature = -1;
      var bestThreshold = 0;

      for (var f = 0; f < 2; f += 1) {
        var sorted = rows.slice().sort(function (a, b) {
          return x[2 * a + f] - x[2 * b + f];
        });
        var leftOnes = 0;
        for (var s = 0; s < count - 1; s += 1) {
          leftOnes += y[sorted[s]];
          var here = x[2 * sorted[s] + f];
          var next = x[2 * sorted[s + 1] + f];
          if (here === next) continue; // cannot split between equal values
          var leftCount = s + 1;
          var rightCount = count - leftCount;
          if (leftCount < minLeaf || rightCount < minLeaf) continue;
          var score =
            (leftCount / count) * gini(leftOnes, leftCount) +
            (rightCount / count) * gini(ones - leftOnes, rightCount);
          if (score < bestScore) {
            bestScore = score;
            bestFeature = f;
            bestThreshold = (here + next) / 2;
          }
        }
      }

      if (bestFeature === -1) return addLeaf(ones, count);

      var goLeft = [];
      var goRight = [];
      for (var r = 0; r < count; r += 1) {
        if (x[2 * rows[r] + bestFeature] <= bestThreshold) goLeft.push(rows[r]);
        else goRight.push(rows[r]);
      }

      var node = feature.length;
      feature.push(bestFeature);
      threshold.push(bestThreshold);
      left.push(-1);
      right.push(-1);
      value.push(ones * 2 > count ? 1 : 0);
      left[node] = build(goLeft, depth + 1);
      right[node] = build(goRight, depth + 1);
      return node;
    }

    build(Array.prototype.slice.call(indices), 0);

    return {
      feature: Int8Array.from(feature),
      threshold: Float64Array.from(threshold),
      left: Int32Array.from(left),
      right: Int32Array.from(right),
      value: Uint8Array.from(value),
      depth: deepest,
    };
  }

  function predictTree(tree, x0, x1) {
    var node = 0;
    while (tree.feature[node] !== -1) {
      var v = tree.feature[node] === 0 ? x0 : x1;
      node = v <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    }
    return tree.value[node];
  }

  /** Where the training points sit, blurred and scaled to [0, 1]. Row 0 is the top. */
  function densityMap(pool, domain, cols, rows) {
    var cells = cols * rows;
    var map = new Float32Array(cells);
    var spanX = domain.x1 - domain.x0;
    var spanY = domain.y1 - domain.y0;
    for (var i = 0; i < pool.y.length; i += 1) {
      var c = Math.floor(((pool.x[2 * i] - domain.x0) / spanX) * cols);
      var r = Math.floor(((domain.y1 - pool.x[2 * i + 1]) / spanY) * rows);
      if (c >= 0 && c < cols && r >= 0 && r < rows) map[r * cols + c] += 1;
    }

    // Three box blurs in each direction are close to a Gaussian blur.
    var radius = Math.max(1, Math.round(cols / 36));
    var scratch = new Float32Array(cells);
    function blur(from, to, horizontal) {
      var outer = horizontal ? rows : cols;
      var inner = horizontal ? cols : rows;
      for (var o = 0; o < outer; o += 1) {
        for (var n = 0; n < inner; n += 1) {
          var sum = 0;
          var seen = 0;
          for (var k = -radius; k <= radius; k += 1) {
            var m = n + k;
            if (m < 0 || m >= inner) continue;
            sum += from[horizontal ? o * cols + m : m * cols + o];
            seen += 1;
          }
          to[horizontal ? o * cols + n : n * cols + o] = sum / seen;
        }
      }
    }
    for (var pass = 0; pass < 3; pass += 1) {
      blur(map, scratch, true);
      blur(scratch, map, false);
    }

    var peak = 0;
    for (var p = 0; p < cells; p += 1) if (map[p] > peak) peak = map[p];
    if (peak > 0) for (var q = 0; q < cells; q += 1) map[q] /= peak;
    return map;
  }

  /**
   * A forest that grows in steps, so the page can train it across animation
   * frames. Every tree votes for a class in each cell of a cols x rows grid;
   * the running totals are snapshotted at each of the CHECKPOINTS.
   */
  function createForest(options) {
    var o = options || {};
    var seed = o.seed != null ? o.seed : 1;
    var cols = o.cols || 128;
    var rows = o.rows || 64;
    var poolSize = o.poolSize || 2000;
    var sampleSize = o.sampleSize || 100;
    var noise = o.noise != null ? o.noise : 0.25;
    var domain = o.domain || { x0: -1.7, x1: 2.7, y0: -0.85, y1: 1.35 };
    var treeOptions = {
      maxDepth: o.maxDepth != null ? o.maxDepth : 5,
      minSamplesLeaf: o.minSamplesLeaf != null ? o.minSamplesLeaf : 2,
    };
    var total = CHECKPOINTS[CHECKPOINTS.length - 1];

    var rng = createRng(seed);
    var pool = makeMoons(poolSize, noise, rng);
    var votes = new Uint16Array(cols * rows);
    var snapshots = CHECKPOINTS.map(function () {
      return null;
    });
    var trees = o.keepTrees ? [] : null;
    var trained = 0;
    var nextCheckpoint = 0;
    var dx = (domain.x1 - domain.x0) / cols;
    var dy = (domain.y1 - domain.y0) / rows;

    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }

    // A tree's leaves are rectangles, so instead of asking the tree about every
    // cell we walk the tree once and paint each class-1 leaf's rectangle.
    function paint(tree, node, c0, c1, r0, r1) {
      if (c0 >= c1 || r0 >= r1) return;
      var f = tree.feature[node];
      if (f === -1) {
        if (tree.value[node] === 1) {
          for (var r = r0; r < r1; r += 1) {
            var base = r * cols;
            for (var c = c0; c < c1; c += 1) votes[base + c] += 1;
          }
        }
        return;
      }
      var t = tree.threshold[node];
      if (f === 0) {
        // columns whose centre is <= t go left
        var cs = clamp(Math.floor((t - domain.x0) / dx - 0.5) + 1, c0, c1);
        paint(tree, tree.left[node], c0, cs, r0, r1);
        paint(tree, tree.right[node], cs, c1, r0, r1);
      } else {
        // row 0 is the top, so rows whose centre is <= t are the lower ones
        var rs = clamp(Math.ceil((domain.y1 - t) / dy - 0.5), r0, r1);
        paint(tree, tree.left[node], c0, c1, rs, r1);
        paint(tree, tree.right[node], c0, c1, r0, rs);
      }
    }

    /** Train up to `count` more trees. Returns how many are trained in total. */
    function advance(count) {
      var target = Math.min(total, trained + Math.max(0, Math.floor(count)));
      while (trained < target) {
        var tree = trainTree(pool, sampleIndices(poolSize, sampleSize, rng), treeOptions);
        paint(tree, 0, 0, cols, 0, rows);
        if (trees) trees.push(tree);
        trained += 1;
        if (trained === CHECKPOINTS[nextCheckpoint]) {
          snapshots[nextCheckpoint] = votes.slice();
          nextCheckpoint += 1;
        }
      }
      return trained;
    }

    function ready(index) {
      return snapshots[index] != null;
    }

    /** Share of trees voting class 1 in a cell, at a (possibly fractional) checkpoint position. */
    function share(position, cell) {
      var lo = Math.floor(position);
      var hi = Math.min(CHECKPOINTS.length - 1, Math.ceil(position));
      var a = snapshots[lo][cell] / CHECKPOINTS[lo];
      if (hi === lo) return a;
      var b = snapshots[hi][cell] / CHECKPOINTS[hi];
      return a + (b - a) * (position - lo);
    }

    return {
      total: total,
      cols: cols,
      rows: rows,
      domain: domain,
      pool: pool,
      density: densityMap(pool, domain, cols, rows),
      snapshots: snapshots,
      trees: trees,
      get trained() {
        return trained;
      },
      get done() {
        return trained >= total;
      },
      advance: advance,
      ready: ready,
      share: share,
    };
  }

  // ---- Playback: how the picture moves between checkpoints ----

  var EASE = 0.24; // share of the remaining distance covered each frame
  var SNAP = 0.004; // close enough to count as arrived

  /**
   * True while nothing should be painted yet: before the first checkpoint is
   * in, and, for visitors who asked for reduced motion, until the whole forest
   * is trained (so they see one finished picture instead of a build-up).
   */
  function shouldHold(state) {
    if (state.readyIndex < 0) return true;
    return Boolean(state.reducedMotion) && !state.done;
  }

  /**
   * The checkpoint position to show on the next frame. It heads for `goal`
   * but never past `readyIndex`, the last checkpoint whose votes are in.
   */
  function nextPosition(state) {
    var reachable = Math.min(state.goal, state.readyIndex);
    if (state.reducedMotion) return reachable;
    var next = state.position + (reachable - state.position) * EASE;
    return Math.abs(reachable - next) < SNAP ? reachable : next;
  }

  return {
    CHECKPOINTS: CHECKPOINTS,
    createRng: createRng,
    makeMoons: makeMoons,
    sampleIndices: sampleIndices,
    trainTree: trainTree,
    predictTree: predictTree,
    createForest: createForest,
    shouldHold: shouldHold,
    nextPosition: nextPosition,
  };
});
