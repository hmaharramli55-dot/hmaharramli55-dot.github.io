'use strict';

// Content and structure checks for the portfolio page.
// Run with: npm test   (needs Node 20+; no dependencies)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => (exists(p) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : '');

const html = read('index.html');
const css = read('styles.css');

// ---------- tiny HTML helpers (regular markup only, no dependency) ----------

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const toText = (markup) =>
  decode(
    markup
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

const attrsOf = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
};

const tags = (name, source = html) =>
  [...source.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrsOf(m[0]));

// Journey entries and projects are <article id="…"> blocks, which never nest.
const article = (id) => {
  const m = html.match(new RegExp(`<article\\b[^>]*\\bid="${id}"[\\s\\S]*?</article>`));
  return m ? m[0] : '';
};

const pageText = toText(html);
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const anchors = tags('a');

const assertIncludesAll = (haystack, needles, where) => {
  for (const needle of needles) {
    assert.ok(haystack.includes(needle), `${where} should mention "${needle}"`);
  }
};

const LINKS = {
  github: 'https://github.com/hmaharramli55-dot',
  linkedin: 'https://www.linkedin.com/in/huseyn-maharramli-18a904336/',
  email: 'mailto:hmaharramli55@gmail.com',
  ensemble: 'https://github.com/hmaharramli55-dot/Ensemble-Learning-Decision-Trees',
  regression: 'https://github.com/hmaharramli55-dot/Linear-Logistic-Regression-from-Scratch',
  store:
    'https://github.com/hmaharramli55-dot/Linear-Logistic-Regression-from-Scratch/blob/main/store_performance_report_assignment_Huseyn_Maharramli.ipynb',
  adaRunPlay: 'https://hmaharramli55-dot.github.io/ADA-Run/',
  adaRunCode: 'https://github.com/hmaharramli55-dot/ADA-Run',
  week1: 'https://github.com/hmaharramli55-dot/Data-Cleaning-Exploratory-Data-Analysis-',
  week2: 'https://github.com/hmaharramli55-dot/Statistical-Analysis-Hypothesis-Testing-',
  week3: 'https://github.com/hmaharramli55-dot/Supervised-Learning-Model-with-Scikit-learn-',
  week4: 'https://github.com/hmaharramli55-dot/End-to-End-Machine-Learning-Pipeline-',
};

const hrefs = new Set(anchors.map((a) => a.href));

// ------------------------------- document ----------------------------------

test('index.html exists and declares HTML5, English, UTF-8 and a mobile viewport', () => {
  assert.ok(exists('index.html'), 'index.html is missing');
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html\b[^>]*\blang="en"/);
  assert.match(html, /<meta\s+charset="utf-8"/i);
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1"/);
});

test('has a descriptive title and meta description', () => {
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  assert.ok(title.includes('Huseyn Maharramli'), 'title should carry the name');
  const description = (tags('meta').find((m) => m.name === 'description') || {}).content || '';
  assert.ok(
    description.length >= 70 && description.length <= 165,
    `meta description should be 70–165 characters, got ${description.length}`
  );
});

test('has exactly one h1 and it names Huseyn Maharramli', () => {
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.ok(toText(h1s[0][1]).includes('Huseyn Maharramli'));
});

test('contains every section, in reading order', () => {
  const expected = ['top', 'about', 'projects', 'journey', 'skills', 'recognition', 'contact'];
  const found = tags('section')
    .map((s) => s.id)
    .filter(Boolean);
  assert.deepEqual(found, expected);
});

test('every in-page link points at an id that exists', () => {
  const inPage = anchors.map((a) => a.href || '').filter((h) => h.startsWith('#'));
  assert.ok(inPage.length >= 6, 'expected in-page navigation links');
  for (const href of inPage) {
    assert.ok(ids.has(href.slice(1)), `no element with id "${href.slice(1)}" for link ${href}`);
  }
});

test('navigation reaches all main sections', () => {
  const nav = (html.match(/<nav\b[\s\S]*?<\/nav>/) || [''])[0];
  const navHrefs = tags('a', nav).map((a) => a.href);
  assert.deepEqual(navHrefs, ['#about', '#projects', '#journey', '#skills', '#contact']);
});

test('theme is applied before first paint', () => {
  const head = (html.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  assert.match(head, /<script>[^<]*localStorage[^<]*dataset\.theme[^<]*<\/script>/);
});

// --------------------------------- hero ------------------------------------

test('hero is dark in both themes', () => {
  const hero = tags('section').find((s) => s.id === 'top') || {};
  assert.match(hero.class || '', /\btone-dark\b/);
});

test('hero carries the live tree-voting illustration with a text alternative', () => {
  const demo = (html.match(/<figure\b[^>]*class="demo"[\s\S]*?<\/figure>/) || [''])[0];
  assert.ok(demo, 'demo figure is missing');
  const canvas = tags('canvas', demo)[0] || {};
  assert.equal(canvas.role, 'img');
  assert.ok((canvas['aria-label'] || '').length >= 40, 'canvas needs a descriptive aria-label');
  const range = tags('input', demo).find((input) => input.type === 'range') || {};
  assert.ok((range['aria-label'] || '').length > 0, 'slider needs an accessible name');
  // The caption must keep saying what this is: an illustration on made-up data,
  // not the results of the real assignment.
  assertIncludesAll(toText(demo), ['illustration', 'synthetic'], 'demo caption');
});

test('highlights strip repeats four headline numbers', () => {
  const strip = (html.match(/<ul\b[^>]*class="highlights"[\s\S]*?<\/ul>/) || [''])[0];
  assert.equal((strip.match(/<li\b/g) || []).length, 4);
  assertIncludesAll(toText(strip), ['87.3%', '0.79', '9,994', '30'], 'highlights strip');
});

test('method details sit in native disclosures that work without JavaScript', () => {
  for (const id of ['project-ensemble', 'project-regression', 'project-store']) {
    assert.match(
      article(id),
      /<details\b[\s\S]*?<summary\b[\s\S]*?<\/summary>[\s\S]*?<\/details>/,
      `${id} needs a <details> with a <summary>`
    );
  }
});

// -------------------------------- journey ----------------------------------

test('journey includes the Erasmus+ semester at Vytautas Magnus University', () => {
  const entry = toText(article('journey-erasmus'));
  assertIncludesAll(
    entry,
    ['Erasmus+', 'Vytautas Magnus University', 'Kaunas, Lithuania', 'Spring 2027', 'Upcoming'],
    'Erasmus entry'
  );
});

test('journey covers AI Academy, DevJoint and ADA University', () => {
  assertIncludesAll(
    toText(article('journey-ai-academy')),
    ['AI Engineering Program', 'AI Academy', 'Fully Funded', 'October 2026', 'two-stage assessment'],
    'AI Academy entry'
  );
  assertIncludesAll(
    toText(article('journey-devjoint')),
    ['Data Scientist Intern', 'DevJoint', 'June – September 2026', 'Top Performer with Honors', 'scikit-learn'],
    'DevJoint entry'
  );
  assertIncludesAll(
    toText(article('journey-ada')),
    ['Computer Science', 'ADA University', 'September 2024', 'June 2028', 'Excellence List', 'ADA AI Club'],
    'ADA University entry'
  );
});

test('journey runs newest first', () => {
  const order = ['journey-erasmus', 'journey-ai-academy', 'journey-devjoint', 'journey-ada'].map(
    (id) => html.indexOf(`id="${id}"`)
  );
  assert.ok(order.every((i) => i > 0), 'all four journey entries should exist');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

// -------------------------------- projects ---------------------------------

test('ensemble project states its measured results', () => {
  const block = article('project-ensemble');
  assertIncludesAll(
    toText(block),
    ['Ensemble Learning with Decision Trees', 'GridSearchCV', '1,000', '87.3%', '85.95%', '80.6%'],
    'ensemble project'
  );
  assert.ok(block.includes(`href="${LINKS.ensemble}"`));
});

test('regression project states its measured results', () => {
  const block = article('project-regression');
  assertIncludesAll(
    toText(block),
    ['Linear & Logistic Regression from Scratch', 'NumPy', 'Turbo.az', '0.79', '89%', 'scikit-learn'],
    'regression project'
  );
  assert.ok(block.includes(`href="${LINKS.regression}"`));
});

test('store analysis project states its findings', () => {
  const block = article('project-store');
  assertIncludesAll(
    toText(block),
    ['Store Performance Analysis', '9,994', '$2.3M', '24%', '$97', '$67', '247', '2.47%'],
    'store analysis project'
  );
  assert.ok(block.includes(`href="${LINKS.store}"`));
});

test('ADA Run project links to the live game and its code, with a screenshot', () => {
  const block = article('project-ada-run');
  assertIncludesAll(toText(block), ['ADA Run', 'Three.js', 'all 30', 'no installation'], 'ADA Run project');
  assert.ok(block.includes(`href="${LINKS.adaRunPlay}"`));
  assert.ok(block.includes(`href="${LINKS.adaRunCode}"`));
  assert.equal(tags('img', block).length, 1);
});

test('DevJoint track lists four weekly deliverables with their repositories', () => {
  const track = (html.match(/<ol\b[^>]*class="track"[\s\S]*?<\/ol>/) || [''])[0];
  assert.equal((track.match(/<li\b/g) || []).length, 4);
  const trackHrefs = tags('a', track).map((a) => a.href);
  assert.deepEqual(trackHrefs, [LINKS.week1, LINKS.week2, LINKS.week3, LINKS.week4]);
  assertIncludesAll(toText(track), ['Week 1', 'Week 2', 'Week 3', 'Week 4'], 'DevJoint track');
});

test('chart bars are drawn at exactly the value they print', () => {
  const meters = [...html.matchAll(/<li\b[^>]*class="meter[^"]*"[^>]*>[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.equal(meters.length, 7, 'expected 3 accuracy bars, 2 score bars and 2 profit bars');
  for (const meter of meters) {
    const { 'data-value': rawValue, 'data-max': rawMax } = attrsOf(meter.match(/<li\b[^>]*>/)[0]);
    const value = Number(rawValue);
    const max = Number(rawMax);
    assert.ok(Number.isFinite(value) && max > 0, `meter needs numeric data-value and data-max: ${meter}`);
    const drawn = Number((meter.match(/--v:\s*([\d.]+)%/) || [])[1]);
    const expected = (Math.abs(value) / max) * 100;
    assert.ok(Math.abs(drawn - expected) < 0.01, `bar drawn at ${drawn}% but value is ${expected}%`);
    assert.ok(
      toText(meter).includes(String(Math.abs(value))),
      `meter should print its value ${Math.abs(value)}: ${toText(meter)}`
    );
    assert.equal(/meter-fill[^"]*\bneg\b/.test(meter), value < 0, 'negative values use the negative bar');
  }
});

// --------------------------------- links -----------------------------------

test('links to GitHub, LinkedIn, email and every repository', () => {
  for (const [name, url] of Object.entries(LINKS)) {
    assert.ok(hrefs.has(url), `missing link to ${name}: ${url}`);
  }
});

test('external links are https, on known hosts, and open safely', () => {
  const allowed = new Set(['github.com', 'www.linkedin.com', 'hmaharramli55-dot.github.io']);
  const external = anchors.filter((a) => /^[a-z]+:\/\//i.test(a.href || ''));
  assert.ok(external.length >= 12);
  for (const a of external) {
    const url = new URL(a.href);
    assert.equal(url.protocol, 'https:', `not https: ${a.href}`);
    assert.ok(allowed.has(url.host), `unexpected host: ${a.href}`);
    if (a.target === '_blank') {
      assert.match(a.rel || '', /\bnoopener\b/, `target=_blank without rel=noopener: ${a.href}`);
    }
  }
});

// ------------------------------- guard rails -------------------------------

test('shows no phone number: contact is email and profile links only', () => {
  assert.doesNotMatch(html, /href="tel:/, 'telephone link');
  // international format: a plus, then at least nine digits with optional separators
  assert.doesNotMatch(pageText, /\+\d[\d\s().-]{7,}\d/, 'international phone number');
  // local format: 0xx xxx xx xx
  assert.doesNotMatch(pageText, /\b0\d{2}[\s-]\d{3}[\s-]\d{2}[\s-]\d{2}\b/, 'local phone number');
});

test('has no placeholder or filler text', () => {
  assert.doesNotMatch(html, /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|example\.com|your name/i);
});

test('images have alt text, explicit dimensions and exist on disk', () => {
  const imgs = tags('img');
  assert.ok(imgs.length >= 1);
  for (const img of imgs) {
    assert.ok((img.alt || '').length >= 10, `image needs descriptive alt text: ${img.src}`);
    assert.ok(Number(img.width) > 0 && Number(img.height) > 0, `image needs width and height: ${img.src}`);
    assert.ok(exists(img.src), `image file missing: ${img.src}`);
    for (const candidate of (img.srcset || '').split(',').filter(Boolean)) {
      const file = candidate.trim().split(/\s+/)[0];
      assert.ok(exists(file), `srcset file missing: ${file}`);
    }
  }
});

test('local stylesheets, scripts and icons exist on disk', () => {
  const local = [
    ...tags('link').map((l) => l.href),
    ...tags('script').map((s) => s.src),
  ].filter((ref) => ref && !/^(https?:|data:)/.test(ref));
  for (const needed of ['styles.css', 'script.js', 'ensemble.js', 'demo.js']) {
    assert.ok(local.includes(needed), `page should load ${needed}`);
  }
  for (const ref of local) assert.ok(exists(ref), `missing file: ${ref}`);
});

test('structured data describes the person', () => {
  const raw = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  assert.ok(raw, 'JSON-LD block is missing');
  const data = JSON.parse(raw);
  assert.equal(data['@type'], 'Person');
  assert.equal(data.name, 'Huseyn Maharramli');
  assert.deepEqual(data.sameAs, [LINKS.github, LINKS.linkedin]);
});

// ----------------------------------- css -----------------------------------

const declarations = (block) =>
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`).sort();

const blockAfter = (source, selector) => {
  const start = source.indexOf(selector);
  if (start === -1) return '';
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
};

test('dark theme tokens are the same for the system setting and the manual toggle', () => {
  const light = declarations(blockAfter(css, ':root {'));
  const system = declarations(blockAfter(css, ':root:not([data-theme="light"])'));
  const manual = declarations(blockAfter(css, ':root[data-theme="dark"]'));
  assert.ok(light.length >= 12, 'light tokens should be defined on :root');
  assert.ok(system.length >= 12, 'dark tokens for the system setting are missing');
  assert.deepEqual(system, manual);
  const lightNames = new Set(light.map((d) => d.split(':')[0]));
  for (const d of system) {
    assert.ok(lightNames.has(d.split(':')[0]), `dark token without a light value: ${d}`);
  }
});

test('always-dark sections reuse the dark theme tokens instead of a third copy', () => {
  assert.match(css, /:root\[data-theme="dark"\],\s*\.tone-dark\s*\{/);
});

test('stylesheet respects reduced motion and has no insecure resources', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css + html, /http:\/\/(?!www\.w3\.org)/);
});

// ---------------------------------- motion ----------------------------------

test('the tools ticker is decorative, repeats itself once and holds only real tools', () => {
  const ticker = html.match(/<div class="ticker[^"]*"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(ticker, 'ticker is present');
  assert.match(ticker[0], /^<div[^>]*aria-hidden="true"/, 'hidden from screen readers: the skills section says it all');
  const groups = ticker[0].match(/<ul class="ticker-group">[\s\S]*?<\/ul>/g) || [];
  assert.equal(groups.length, 2, 'two identical groups make the loop seamless');
  assert.equal(toText(groups[0]), toText(groups[1]));
  assert.doesNotMatch(ticker[0], /<a\b|<button/, 'nothing focusable inside a hidden region');
  const skills = toText(html.replace(ticker[0], ''));
  for (const item of groups[0].match(/<li>([^<]+)<\/li>/g).map((li) => toText(li))) {
    assert.ok(skills.includes(item), `${item} appears elsewhere on the page`);
  }
});

test('a scroll progress bar exists and is hidden from screen readers', () => {
  assert.match(html, /<div class="scroll-progress" aria-hidden="true"><\/div>/);
});

test('section headings reveal on scroll, and award icons can draw themselves', () => {
  const heads = html.match(/<header class="section-head[^"]*"/g) || [];
  assert.ok(heads.length >= 5);
  for (const head of heads) assert.match(head, /\breveal\b/);
  const icons = html.match(/<svg class="award-icon"[\s\S]*?<\/svg>/g) || [];
  assert.equal(icons.length, 3);
  for (const icon of icons) {
    for (const shape of icon.match(/<(path|circle)\b[^>]*>/g)) assert.match(shape, /pathLength="1"/);
  }
});

test('every looping animation is switched off for visitors who ask for reduced motion', () => {
  const from = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const reduced = css.slice(from, css.indexOf('@media print', from));
  assert.ok(from !== -1 && reduced.length > 0);
  assert.match(reduced, /animation:\s*none\s*!important/);
  assert.match(reduced, /transition:\s*none\s*!important/);
  assert.match(css, /animation:[^;]*infinite/, 'there are looping animations to switch off');
  assert.match(reduced, /\.chips li[\s\S]*opacity:\s*1/, 'staggered chips are shown at once');
});

test('the page has its own typefaces rather than the system font alone', () => {
  assert.match(html, /fonts\.googleapis\.com\/css2\?[^"]*Space\+Grotesk/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?[^"]*JetBrains\+Mono/);
  assert.match(css, /--display:\s*"Space Grotesk"/);
  assert.match(css, /--mono:\s*"JetBrains Mono"/);
});
