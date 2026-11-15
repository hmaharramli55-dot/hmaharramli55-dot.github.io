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
