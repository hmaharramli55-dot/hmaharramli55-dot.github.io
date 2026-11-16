/* Theme toggle, scroll reveal, count-up numbers, scroll progress,
   current-section highlight, the Baku clock, tilting cards and the skill globe.
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

  /** "14:05": the time in Baku, which is UTC+4 all year (no daylight saving). */
  function bakuClock(date) {
    var minutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + 240) % 1440;
    var hh = Math.floor(minutes / 60);
    var mm = minutes % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
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

  /* ---------- 3D helpers (pure, tested in Node) ---------- */

  /** Pointer position inside a card (0 to 1 each way) → degrees of tilt toward the pointer. */
  function tiltAngles(x, y, max) {
    var cx = Math.min(1, Math.max(0, x));
    var cy = Math.min(1, Math.max(0, y));
    return { rx: (0.5 - cy) * 2 * max, ry: (cx - 0.5) * 2 * max };
  }

  /** `count` points spread evenly over a sphere of radius 1. */
  function fibonacciSphere(count) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    var points = [];
    for (var i = 0; i < count; i += 1) {
      var y = 1 - (2 * i + 1) / count;
      var ring = Math.sqrt(1 - y * y);
      points.push([Math.cos(i * golden) * ring, y, Math.sin(i * golden) * ring]);
    }
    return points;
  }

  /** Turns a point about the X axis by `ax`, then about the Y axis by `ay` (radians). */
  function rotatePoint(point, ax, ay) {
    var y = point[1] * Math.cos(ax) - point[2] * Math.sin(ax);
    var z = point[1] * Math.sin(ax) + point[2] * Math.cos(ax);
    return [point[0] * Math.cos(ay) + z * Math.sin(ay), y, -point[0] * Math.sin(ay) + z * Math.cos(ay)];
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
      // cross-fade the two themes where the browser can; otherwise switch at once
      if (doc.startViewTransition && !prefersReducedMotion(win)) {
        doc.startViewTransition(function () {
          rootEl.dataset.theme = theme;
        });
      } else {
        rootEl.dataset.theme = theme;
      }
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

  /* The header shows what time it is for me; the page prints "UTC+4" without this. */
  function initClock(doc, win) {
    var el = doc.getElementById('baku-time');
    if (!el) return;
    function tick() {
      el.textContent = bakuClock(new Date());
    }
    tick();
    win.setInterval(tick, 15000);
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

  /* Cards marked data-tilt lean toward the pointer. Mouse only: on touch they stay flat. */
  function initTilt(doc, win) {
    if (prefersReducedMotion(win) || !win.matchMedia) return;
    if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    Array.prototype.slice.call(doc.querySelectorAll('[data-tilt]')).forEach(function (el) {
      var max = el.classList.contains('demo-window') ? 10 : 7;
      el.addEventListener('pointermove', function (event) {
        var box = el.getBoundingClientRect();
        if (!box.width || !box.height) return;
        var x = (event.clientX - box.left) / box.width;
        var y = (event.clientY - box.top) / box.height;
        var angles = tiltAngles(x, y, max);
        el.style.setProperty('--rx', angles.rx.toFixed(2));
        el.style.setProperty('--ry', angles.ry.toFixed(2));
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        el.classList.add('is-tilting');
      });
      el.addEventListener('pointerleave', function () {
        ['--rx', '--ry', '--gx', '--gy'].forEach(function (name) {
          el.style.removeProperty(name);
        });
        el.classList.remove('is-tilting');
      });
    });
  }

  /* A slowly turning globe of skills, built from the lists below it so the two
     never disagree. Drag to spin. Decorative: the lists are the real content. */
  function initGlobe(doc, win) {
    var box = doc.querySelector('.skill-globe');
    if (!box || !win.requestAnimationFrame) return;

    var seen = {};
    var words = [];
    Array.prototype.slice.call(doc.querySelectorAll('.specs .chips li')).forEach(function (chip) {
      var text = chip.textContent.trim();
      if (text.length > 18 || seen[text] || words.length >= 38) return;
      seen[text] = true;
      words.push(text);
    });
    if (words.length < 8) return;

    var points = fibonacciSphere(words.length);
    var nodes = words.map(function (word) {
      var node = doc.createElement('span');
      node.className = 'skill-globe-word';
      node.textContent = word;
      box.appendChild(node);
      return node;
    });
    box.classList.add('is-on');

    var SPIN = 0.00022; // radians per millisecond when left alone
    var ax = -0.35;
    var ay = 0;
    var vy = SPIN;
    var still = prefersReducedMotion(win);
    var running = false;
    var last = 0;
    var drag = null;

    function paint() {
      // wider than tall, so the words have room to pass each other
      var radiusY = box.clientHeight * 0.38;
      var radiusX = Math.max(60, Math.min(box.clientWidth / 2 - 70, radiusY * 2.1));
      for (var i = 0; i < nodes.length; i += 1) {
        var p = rotatePoint(points[i], ax, ay);
        var depth = (p[2] + 1) / 2; // 0 at the back, 1 at the front
        var style = nodes[i].style;
        style.transform =
          'translate(-50%, -50%) translate3d(' + (p[0] * radiusX).toFixed(1) + 'px,' +
          (p[1] * radiusY).toFixed(1) + 'px, 0) scale(' + (0.62 + 0.5 * depth).toFixed(3) + ')';
        style.opacity = (0.12 + 0.88 * depth * depth).toFixed(3);
        style.zIndex = String(Math.round(depth * 100));
      }
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(64, now - (last || now));
      last = now;
      if (!drag) {
        ay += vy * dt;
        vy += (SPIN - vy) * 0.02; // ease back to the resting spin after a flick
      }
      paint();
      win.requestAnimationFrame(frame);
    }

    function start() {
      if (running || still) return;
      running = true;
      last = 0;
      win.requestAnimationFrame(frame);
    }

    box.addEventListener('pointerdown', function (event) {
      drag = { x: event.clientX, y: event.clientY, t: event.timeStamp };
      box.classList.add('is-dragging');
      if (box.setPointerCapture) box.setPointerCapture(event.pointerId);
    });
    box.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var dx = event.clientX - drag.x;
      var dy = event.clientY - drag.y;
      var dt = Math.max(1, event.timeStamp - drag.t);
      ay += dx * 0.006;
      ax = Math.min(1.2, Math.max(-1.2, ax + dy * 0.006));
      vy = Math.min(0.004, Math.max(-0.004, (dx * 0.006) / dt));
      drag = { x: event.clientX, y: event.clientY, t: event.timeStamp };
      if (still) paint();
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      box.addEventListener(type, function () {
        drag = null;
        box.classList.remove('is-dragging');
      });
    });

    paint();
    if ('IntersectionObserver' in win) {
      new win.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            paint();
            start();
          } else {
            running = false;
          }
        });
      }).observe(box);
    } else {
      start();
    }
  }

  function init(doc, win) {
    initTheme(doc, win);
    initReveal(doc, win);
    initCountUp(doc, win);
    initScrollProgress(doc, win);
    initSectionSpy(doc, win);
    initClock(doc, win);
    initTilt(doc, win);
    initGlobe(doc, win);
  }

  return {
    resolveTheme: resolveTheme,
    nextTheme: nextTheme,
    bakuClock: bakuClock,
    parseCount: parseCount,
    formatCount: formatCount,
    countAt: countAt,
    scrollProgress: scrollProgress,
    tiltAngles: tiltAngles,
    fibonacciSphere: fibonacciSphere,
    rotatePoint: rotatePoint,
    init: init
  };
});
