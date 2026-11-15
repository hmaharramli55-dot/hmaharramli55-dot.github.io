/* Theme toggle, scroll reveal, current-section highlight and the bar's light/dark tone.
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

  function init(doc, win) {
    initTheme(doc, win);
    initReveal(doc, win);
    initSectionSpy(doc, win);
    initNavTone(doc, win);
  }

  return { resolveTheme: resolveTheme, nextTheme: nextTheme, navTone: navTone, init: init };
});
