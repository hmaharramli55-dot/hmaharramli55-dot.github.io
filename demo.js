/* Paints the live tree-voting illustration in the hero.

   The model lives in ensemble.js. This file only spreads the training over
   animation frames and draws the result. Without it (or without JavaScript)
   the stage keeps its still poster. */
(function () {
  'use strict';

  if (typeof document === 'undefined' || !window.Ensemble) return;

  var E = window.Ensemble;
  var figure = document.querySelector('.demo');
  var stage = figure && figure.querySelector('.demo-stage');
  var canvas = figure && figure.querySelector('.demo-canvas');
  var range = document.getElementById('demo-range');
  var readout = document.getElementById('demo-count');
  var unit = document.getElementById('demo-unit');
  var replay = document.getElementById('demo-replay');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!stage || !ctx || !range || !readout) return;

  var COLS = 128;
  var ROWS = 64;
  var CHECKPOINTS = E.CHECKPOINTS;
  var LAST = CHECKPOINTS.length - 1;
  var AUTOPLAY_MS = 5600; // one run from 1 tree to 1,000
  var FRAME_BUDGET_MS = 7; // training time allowed per frame

  // Vote share: 0 is all blue, 1 is all orange, and a split vote lands on magenta.
  var BLUE = [38, 126, 255];
  var MID = [204, 70, 172];
  var ORANGE = [255, 126, 34];

  var reducedMotion = Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  var forest = E.createForest({ seed: 2026, cols: COLS, rows: ROWS });

  // The picture is computed on a small grid and scaled up smoothly.
  var grid = document.createElement('canvas');
  grid.width = COLS;
  grid.height = ROWS;
  var gridCtx = grid.getContext('2d');
  var image = gridCtx.createImageData(COLS, ROWS);

  // Brighter where the training points are, so the two half-moons glow.
  var glow = new Float32Array(COLS * ROWS);
  for (var g = 0; g < glow.length; g += 1) {
    glow[g] = 0.2 + 0.8 * Math.pow(forest.density[g], 0.7);
  }

  var sample = pickPoints(240);
  var position = 0; // checkpoint index currently shown (fractional while moving)
  var goal = 0; // checkpoint index it is heading for
  var readyIndex = -1; // last checkpoint whose votes are in
  var autoplay = 0; // 0 = off, -1 = start on next frame, otherwise the start time
  var userControl = false; // true once the visitor has taken the slider
  var started = false;
  var scheduled = false;
  var painted = -1;
  var pixelRatio = 1;

  function pickPoints(count) {
    var total = forest.pool.y.length;
    var step = Math.max(1, Math.floor(total / count));
    var picked = [];
    for (var i = 0; i < total; i += step) picked.push(i);
    return picked;
  }

  function treesAt(at) {
    var lo = Math.floor(at);
    var hi = Math.min(LAST, lo + 1);
    return Math.round(CHECKPOINTS[lo] + (CHECKPOINTS[hi] - CHECKPOINTS[lo]) * (at - lo));
  }

  function syncReadout() {
    var trees = treesAt(position);
    var label = trees.toLocaleString('en-US');
    var word = trees === 1 ? 'tree' : 'trees';
    readout.textContent = label;
    if (unit) unit.textContent = word;
    range.setAttribute('aria-valuetext', label + ' ' + word);
    figure.dataset.trees = String(trees);
  }

  function paint() {
    var lo = Math.floor(position);
    var hi = Math.min(LAST, lo + 1);
    var blend = position - lo;
    var a = forest.snapshots[lo];
    var b = forest.snapshots[hi];
    if (!a || (blend > 0 && !b)) return;

    var countA = CHECKPOINTS[lo];
    var countB = CHECKPOINTS[hi];
    var pixels = image.data;
    for (var cell = 0, o = 0; cell < glow.length; cell += 1, o += 4) {
      var share = a[cell] / countA;
      if (blend > 0) share += (b[cell] / countB - share) * blend;

      var from = share < 0.5 ? BLUE : MID;
      var to = share < 0.5 ? MID : ORANGE;
      var t = share < 0.5 ? share * 2 : share * 2 - 1;
      // dimmer where the trees disagree
      var light = glow[cell] * (0.6 + 0.4 * Math.abs(2 * share - 1));

      pixels[o] = (from[0] + (to[0] - from[0]) * t) * light;
      pixels[o + 1] = (from[1] + (to[1] - from[1]) * t) * light;
      pixels[o + 2] = (from[2] + (to[2] - from[2]) * t) * light;
      pixels[o + 3] = 255;
    }
    gridCtx.putImageData(image, 0, 0);

    // Fill the stage, cropping the sides on narrow screens.
    var width = canvas.width;
    var height = canvas.height;
    var scale = Math.max(width / COLS, height / ROWS);
    var drawWidth = COLS * scale;
    var drawHeight = ROWS * scale;
    var left = (width - drawWidth) / 2;
    var top = (height - drawHeight) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(grid, left, top, drawWidth, drawHeight);

    // A sample of the training points, each with a thin dark ring so it
    // stays visible on any colour.
    var domain = forest.domain;
    var pool = forest.pool;
    var radius = 1.5 * pixelRatio;
    ctx.lineWidth = pixelRatio;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    for (var kind = 0; kind < 2; kind += 1) {
      ctx.fillStyle = kind === 0 ? 'rgba(204, 226, 255, 0.9)' : 'rgba(255, 228, 200, 0.9)';
      ctx.beginPath();
      for (var s = 0; s < sample.length; s += 1) {
        var index = sample[s];
        if (pool.y[index] !== kind) continue;
        var x = left + ((pool.x[2 * index] - domain.x0) / (domain.x1 - domain.x0)) * drawWidth;
        var y = top + ((domain.y1 - pool.x[2 * index + 1]) / (domain.y1 - domain.y0)) * drawHeight;
        if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    }

    painted = position;
    figure.classList.add('is-live');
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(frame);
  }

  function frame(now) {
    scheduled = false;

    if (!forest.done) {
      var began = performance.now();
      do {
        forest.advance(3);
      } while (!forest.done && performance.now() - began < FRAME_BUDGET_MS);
      while (readyIndex < LAST && forest.ready(readyIndex + 1)) readyIndex += 1;
      figure.dataset.state = forest.done ? 'ready' : 'training';
    }

    // With reduced motion, wait for the whole forest and show the result once.
    if (E.shouldHold({ readyIndex: readyIndex, reducedMotion: reducedMotion, done: forest.done })) {
      schedule();
      return;
    }

    if (autoplay === -1) autoplay = now;
    if (autoplay > 0) {
      goal = Math.min(LAST, ((now - autoplay) / AUTOPLAY_MS) * LAST);
      if (goal >= LAST) autoplay = 0;
    }

    position = E.nextPosition({
      position: position,
      goal: goal,
      readyIndex: readyIndex,
      reducedMotion: reducedMotion,
    });

    if (position !== painted) {
      paint();
      syncReadout();
      // While the picture moves by itself, the thumb follows it.
      if (!userControl) range.value = String(Math.round(position));
    }

    if (!forest.done || autoplay !== 0 || position !== Math.min(goal, readyIndex)) schedule();
  }

  function resize() {
    var box = stage.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(1, Math.round(box.width * pixelRatio));
    var height = Math.max(1, Math.round(box.height * pixelRatio));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    painted = -1;
    if (!E.shouldHold({ readyIndex: readyIndex, reducedMotion: reducedMotion, done: forest.done })) paint();
  }

  function play() {
    position = 0;
    goal = 0;
    painted = -1;
    autoplay = -1;
    userControl = false;
    range.value = '0';
    schedule();
  }

  // The visitor takes over: stop the automatic run where it is.
  function takeControl() {
    if (autoplay !== 0) goal = position;
    autoplay = 0;
    userControl = true;
  }

  function start() {
    if (started) return;
    started = true;
    resize();
    if (reducedMotion) {
      goal = LAST;
      range.value = String(LAST);
      schedule();
    } else {
      play();
    }
  }

  range.addEventListener('pointerdown', takeControl);
  range.addEventListener('keydown', takeControl);
  range.addEventListener('input', function () {
    takeControl();
    goal = Number(range.value);
    schedule();
  });

  if (replay) replay.addEventListener('click', play);

  // From here on the controls work, so let the stylesheet show them.
  figure.classList.add('is-ready');

  if ('ResizeObserver' in window) {
    new window.ResizeObserver(resize).observe(stage);
  } else {
    window.addEventListener('resize', resize);
  }

  // Start once the stage is on screen, so the first run is not missed.
  if ('IntersectionObserver' in window) {
    var watcher = new window.IntersectionObserver(
      function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          watcher.disconnect();
          start();
        }
      },
      { threshold: 0.25 }
    );
    watcher.observe(stage);
  } else {
    start();
  }
})();
