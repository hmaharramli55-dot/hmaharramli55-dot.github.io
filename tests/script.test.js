'use strict';

// Unit tests for the theme logic in script.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const load = () => require(path.join(__dirname, '..', 'script.js'));

test('script.js loads outside a browser without touching the DOM', () => {
  assert.doesNotThrow(load);
});

test('resolveTheme keeps a valid stored choice, whatever the system says', () => {
  const { resolveTheme } = load();
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
});

test('resolveTheme falls back to the system setting when nothing is stored', () => {
  const { resolveTheme } = load();
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
  assert.equal(resolveTheme(undefined, false), 'light');
});

test('resolveTheme ignores junk values in storage', () => {
  const { resolveTheme } = load();
  assert.equal(resolveTheme('banana', true), 'dark');
  assert.equal(resolveTheme('', false), 'light');
});

test('bakuClock prints the time in Baku, four hours ahead of UTC all year', () => {
  const { bakuClock } = load();
  assert.equal(bakuClock(new Date('2026-11-16T10:05:00Z')), '14:05');
  assert.equal(bakuClock(new Date('2026-07-01T21:30:00Z')), '01:30');
  assert.equal(bakuClock(new Date('2026-01-01T00:00:00Z')), '04:00');
});

test('the script no longer carries the old navigation-tone switch', () => {
  assert.equal(load().navTone, undefined);
});

test('nextTheme flips between light and dark', () => {
  const { nextTheme } = load();
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});

// ---------- motion helpers ----------

test('parseCount reads the number, its decimals and its grouping from printed text', () => {
  const { parseCount } = load();
  assert.deepEqual(parseCount('87.3%'), { value: 87.3, decimals: 1, grouped: false, before: '', after: '%' });
  assert.deepEqual(parseCount(' 0.79'), { value: 0.79, decimals: 2, grouped: false, before: ' ', after: '' });
  assert.deepEqual(parseCount('9,994'), { value: 9994, decimals: 0, grouped: true, before: '', after: '' });
  assert.equal(parseCount('no digits here'), null);
});

test('formatCount prints a number the way the page wrote it', () => {
  const { formatCount } = load();
  assert.equal(formatCount(87.3, 1, false), '87.3');
  assert.equal(formatCount(0.79, 2, false), '0.79');
  assert.equal(formatCount(9994, 0, true), '9,994');
  assert.equal(formatCount(1234567, 0, true), '1,234,567');
  assert.equal(formatCount(30, 0, false), '30');
});

test('a count-up starts at zero and lands exactly on the printed figure', () => {
  const { parseCount, countAt } = load();
  for (const text of ['87.3%', '0.79', '9,994', '30']) {
    const parsed = parseCount(text);
    assert.equal(countAt(parsed, 1), text, `${text} must end as written`);
    assert.notEqual(countAt(parsed, 0), text);
    assert.equal(countAt(parsed, 2), text, 'progress past the end is clamped');
  }
  assert.equal(countAt(parseCount('9,994'), 0), '0');
});

test('count-up never overshoots the final figure on the way', () => {
  const { parseCount, countAt } = load();
  const parsed = parseCount('9,994');
  let last = -1;
  for (let i = 0; i <= 20; i += 1) {
    const n = Number(countAt(parsed, i / 20).replace(/,/g, ''));
    assert.ok(n >= last && n <= 9994, `step ${i} gave ${n}`);
    last = n;
  }
});

test('scrollProgress runs from 0 at the top to 1 at the bottom and stays in range', () => {
  const { scrollProgress } = load();
  assert.equal(scrollProgress(0, 3000, 1000), 0);
  assert.equal(scrollProgress(1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(2000, 3000, 1000), 1);
  assert.equal(scrollProgress(-50, 3000, 1000), 0);
  assert.equal(scrollProgress(9999, 3000, 1000), 1);
  assert.equal(scrollProgress(0, 800, 1000), 0, 'a page shorter than the screen has no progress');
});

// --------------------------------- 3D helpers -------------------------------

test('tiltAngles turns a pointer position into a small rotation toward the pointer', () => {
  const { tiltAngles } = load();
  assert.deepEqual(tiltAngles(0.5, 0.5, 8), { rx: 0, ry: 0 });
  assert.deepEqual(tiltAngles(1, 0, 8), { rx: 8, ry: 8 });
  assert.deepEqual(tiltAngles(0, 1, 8), { rx: -8, ry: -8 });
  assert.deepEqual(tiltAngles(5, -3, 8), { rx: 8, ry: 8 }, 'clamped outside the element');
});

test('fibonacciSphere spreads points evenly over a unit sphere', () => {
  const { fibonacciSphere } = load();
  const points = fibonacciSphere(40);
  assert.equal(points.length, 40);
  for (const [x, y, z] of points) assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-9);
  const mean = [0, 1, 2].map((i) => points.reduce((sum, p) => sum + p[i], 0) / points.length);
  for (const m of mean) assert.ok(Math.abs(m) < 0.05, 'centred on the origin');
  assert.deepEqual(fibonacciSphere(0), []);
  assert.equal(fibonacciSphere(1).length, 1);
});

test('rotatePoint keeps length and turns the right way', () => {
  const { rotatePoint } = load();
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(rotatePoint([0, 0, 1], 0, Math.PI / 2), [1, 0, 0]), 'quarter turn about Y');
  assert.ok(near(rotatePoint([0, 1, 0], Math.PI / 2, 0), [0, 0, 1]), 'quarter turn about X');
  const p = rotatePoint([0.3, -0.5, 0.81], 1.1, -2.3);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(0.3, -0.5, 0.81)) < 1e-9);
});

test('networkLayout places every neuron inside a unit cube and links neighbouring layers fully', () => {
  const { networkLayout } = load();
  const net = networkLayout([3, 5, 5, 2]);
  assert.equal(net.nodes.length, 15);
  assert.equal(net.edges.length, 3 * 5 + 5 * 5 + 5 * 2);
  for (const node of net.nodes) for (const v of node) assert.ok(v >= -1 && v <= 1);
  assert.equal(net.nodes[0][0], -1, 'first layer on the left');
  assert.equal(net.nodes[14][0], 1, 'last layer on the right');
  for (const [a, b] of net.edges) assert.ok(a < b && b < 15);
  assert.deepEqual(networkLayout([]), { nodes: [], edges: [] });
});
