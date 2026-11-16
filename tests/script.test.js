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

test('navTone is dark over always-dark sections and light over the rest', () => {
  const { navTone } = load();
  assert.equal(navTone('hero tone-dark'), 'dark');
  assert.equal(navTone('section section-contact tone-dark'), 'dark');
  assert.equal(navTone('section section-alt'), 'light');
  assert.equal(navTone('site-footer'), 'light');
  assert.equal(navTone(''), 'light');
  assert.equal(navTone('not-tone-darker'), 'light');
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
