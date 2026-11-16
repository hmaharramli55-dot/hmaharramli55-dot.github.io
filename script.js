/* Theme toggle, scroll reveal, count-up numbers, scroll progress,
   current-section highlight and the bar's light/dark tone.
   A classic script (not a module) so the page also works when opened straight
   from disk. The page is fully readable without it. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api; // lets the tests load the pure functions in Node
  } else {
    root.Portfolio = api;
  }
  if (typeof document !== 'undefined') {
    api.init(document, root);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var THEMES = ['light', 'dark'];
  var STORAGE_KEY = 'theme';

  /** A stored choice wins; otherwise follow the system setting. */
  function resolveTheme(stored, prefersDark) {
    if (THEMES.indexOf(stored) !== -1) return stored;
    return prefersDark ? 'dark' : 'light';
  }

  function nextTheme(current) {
    return current === 'dark' ? 'light' : 'dark';
  }

  /** The navigation bar goes dark over sections that are dark in both themes. */
  function navTone(className) {
    return String(className).split(/\s+/).indexOf('tone-dark') !== -1 ? 'dark' : 'light';
  }


  /* ---------- motion helpers (pure, tested in Node) ---------- */

  /** Finds the first number in printed text: "9,994" → 9994, grouped, no decimals. */
  function parseCount(text) {
    var match = /\d[\d,]*(?:\.\d+)?/.exec(String(text));
    if (!match) return null;
    var raw = match[0];
    var dot = raw.indexOf('.');
    return {
      value: Number(raw.replace(/,/g, '')),
      decimals: dot === -1 ? 0 : raw.length - dot - 1,
      grouped: raw.indexOf(',') !== -1,
      before: text.slice(0, match.index),
      after: text.slice(match.index + raw.length)
    };
  }

  function formatCount(value, decimals, grouped) {
    var parts = value.toFixed(decimals).split('.');
    if (grouped) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /** The text to show at `progress` (0 to 1) of a count-up; fast first, slow at the end. */
  function countAt(parsed, progress) {
    var t = Math.min(1, Math.max(0, progress));
    var eased = 1 - Math.pow(1 - t, 4);
    var value = t === 1 ? parsed.value : Math.min(parsed.value, parsed.value * eased);
    return parsed.before + formatCount(value, parsed.decimals, parsed.grouped) + parsed.after;
  }

  /** How far down the page the visitor is, 0 to 1. */
  function scrollProgress(scrollTop, scrollHeight, viewportHeight) {
    var room = scrollHeight - viewportHeight;
    if (room <= 0) return 0;
    return Math.min(1, Math.max(0, scrollTop / room));
  }

  function prefersReducedMotion(win) {
    return Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function initTheme(doc, win) {
    var toggle = doc.getElementById('theme-toggle');
    if (!toggle) return;

    var rootEl = doc.documentElement;
    var media = win.matchMedia ? win.matchMedia('(prefers-color-scheme: dark)') : null;

    function current() {
      return resolveTheme(rootEl.dataset.theme, Boolean(media && media.matches));
    }

    function sync() {
      toggle.setAttribute('aria-pressed', String(current() === 'dark'));
    }

    toggle.addEventListener('click', function () {
      var theme = nextTheme(current());
      rootEl.dataset.theme = theme;
      try {
        win.localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        /* private mode or blocked storage: the choice lasts for this visit */
      }
      sync();
    });

    if (media && media.addEventListener) media.addEventListener('change', sync);
    sync();
  }

  function initReveal(doc, win) {
    var items = Array.prototype.slice.call(doc.querySelectorAll('.reveal'));
    // each skill chip waits a little longer than the one before it
    Array.prototype.slice.call(doc.querySelectorAll('.specs .chips')).forEach(function (list) {
      Array.prototype.slice.call(list.children).forEach(function (chip, i) {
        chip.style.setProperty('--i', String(i));
      });
    });
    if (!('IntersectionObserver' in win)) {
      items.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var observer = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initSectionSpy(doc, win) {
    var links = Array.prototype.slice.call(doc.querySelectorAll('.site-nav a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in win)) return;

    var linkFor = {};
    links.forEach(function (link) {
      linkFor[link.getAttribute('href').slice(1)] = link;
    });

    // A section is "current" while it crosses a thin band just above mid-screen.
    var observer = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (link) {
            link.removeAttribute('aria-current');
          });
          var link = linkFor[entry.target.id];
          if (link) link.setAttribute('aria-current', 'location');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    Array.prototype.slice.call(doc.querySelectorAll('main section[id]')).forEach(function (section) {
      observer.observe(section);
    });
  }

  function initNavTone(doc, win) {
    var header = doc.querySelector('.site-header');
    var zones = Array.prototype.slice.call(doc.querySelectorAll('main > section, .site-footer'));
    if (!header || !zones.length || !('IntersectionObserver' in win)) return;

    // Watch a thin band at the top of the screen, where the bar sits.
    var observer = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) header.dataset.tone = navTone(entry.target.className);
        });
      },
      { rootMargin: '0px 0px -95% 0px' }
    );
    zones.forEach(function (zone) {
      observer.observe(zone);
    });
  }

  /* The four headline numbers count up from zero the first time they are seen.
     The page already holds the final text, so nothing is lost without this. */
  function initCountUp(doc, win) {
    if (prefersReducedMotion(win) || !('IntersectionObserver' in win) || !win.requestAnimationFrame) return;
    var DURATION = 1600;
    var jobs = [];
    Array.prototype.slice.call(doc.querySelectorAll('.highlights strong')).forEach(function (el) {
      for (var node = el.firstChild; node; node = node.nextSibling) {
        if (node.nodeType !== 3) continue;
        var parsed = parseCount(node.nodeValue);
        if (parsed) {
          jobs.push({ el: el, node: node, parsed: parsed, final: node.nodeValue });
          return;
        }
      }
    });
    if (!jobs.length) return;

    function run(job) {
      var start = null;
      function frame(now) {
        if (start === null) start = now;
        var progress = (now - start) / DURATION;
        if (progress >= 1) {
          job.node.nodeValue = job.final;
          return;
        }
        job.node.nodeValue = countAt(job.parsed, progress);
        win.requestAnimationFrame(frame);
      }
      win.requestAnimationFrame(frame);
      // a hidden tab pauses animation frames; never leave a half-counted number behind
      win.setTimeout(function () {
        job.node.nodeValue = job.final;
      }, DURATION + 1200);
    }

    var observer = new win.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          jobs.forEach(function (job) {
            if (job.el === entry.target) run(job);
          });
        });
      },
      { threshold: 0.6 }
    );
    jobs.forEach(function (job) {
      observer.observe(job.el);
    });
  }

  /* A thin bar across the top that fills as the page is read. */
  function initScrollProgress(doc, win) {
    var bar = doc.querySelector('.scroll-progress');
    if (!bar || !win.requestAnimationFrame) return;
    var queued = false;
    function paint() {
      queued = false;
      var el = doc.documentElement;
      bar.style.setProperty('--progress', String(scrollProgress(win.scrollY || el.scrollTop, el.scrollHeight, win.innerHeight)));
    }
    function request() {
      if (queued) return;
      queued = true;
      win.requestAnimationFrame(paint);
    }
    win.addEventListener('scroll', request, { passive: true });
    win.addEventListener('resize', request);
    paint();
  }

  function init(doc, win) {
    initTheme(doc, win);
    initReveal(doc, win);
    initCountUp(doc, win);
    initScrollProgress(doc, win);
    initSectionSpy(doc, win);
    initNavTone(doc, win);
  }

  return {
    resolveTheme: resolveTheme,
    nextTheme: nextTheme,
    navTone: navTone,
    parseCount: parseCount,
    formatCount: formatCount,
    countAt: countAt,
    scrollProgress: scrollProgress,
    init: init
  };
});
