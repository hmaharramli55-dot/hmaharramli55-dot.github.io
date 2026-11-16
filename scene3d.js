/* The workstation in the hero, drawn with Three.js.

   This is an upgrade over the CSS scene in index.html: that one shows first,
   and stays if this module cannot load or the browser has no WebGL. Only when
   a frame has been drawn does the page switch to this canvas. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BLUE = 0x5b9dff;
const VIOLET = 0x9d8cff;
const CYAN = 0x6fe3ff;

// What the monitor types: the ensemble method, and its measured result.
const K = '#9d8cff'; // keyword
const T = '#c7d0e2'; // text
const N = '#ffb86b'; // number
const C = '#6fe3ff'; // comment
const CODE = [
  [['from', K], [' sklearn.tree ', T], ['import', K], [' DecisionTreeClassifier', T]],
  [],
  [['forest = [fit_tree(sample(X, ', T], ['100', N], ['))', T]],
  [['          ', T], ['for', K], [' _ ', T], ['in', K], [' range(', T], ['1000', N], [')]', T]],
  [['votes = np.array([t.predict(X_test)', T]],
  [['                  ', T], ['for', K], [' t ', T], ['in', K], [' forest])', T]],
  [['y_hat = mode(votes, axis=', T], ['0', N], [')', T]],
  [],
  [['accuracy(y_test, y_hat)  ', T], ['# 0.873', C]],
];
const CODE_LENGTH = CODE.reduce((sum, line) => sum + line.reduce((n, part) => n + part[0].length, 0), 0);

const host = document.querySelector('.scene');
if (host) {
  try {
    start(host);
  } catch (error) {
    // No WebGL, or it failed: the CSS scene is already on the page.
  }
}

function start(host) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'scene-gl';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  // A soft studio room, used only for reflections on the glossy surfaces.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.6, 0);

  /* ---------- light ---------- */

  const key = new THREE.DirectionalLight(0xdfe8ff, 2.2);
  key.position.set(-4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 7;
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x8fa4d8, 0.35));

  const screenLight = new THREE.PointLight(BLUE, 14, 7, 2);
  screenLight.position.set(-0.5, 1.5, 0.5);
  scene.add(screenLight);
  const rim = new THREE.PointLight(VIOLET, 30, 12, 2);
  rim.position.set(-4.5, 2.5, -3);
  scene.add(rim);
  const holoLight = new THREE.PointLight(CYAN, 9, 5, 2);
  holoLight.position.set(2, 1.4, -0.8);
  scene.add(holoLight);

  /* ---------- materials ---------- */

  const gloss = (color, extra) =>
    new THREE.MeshPhysicalMaterial(
      Object.assign({ color, roughness: 0.32, metalness: 0.65, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.55 }, extra)
    );
  const glow = (color, opacity) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  const solid = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  /* ---------- desk and floor ---------- */

  const world = new THREE.Group();
  scene.add(world);

  const desk = solid(new THREE.Mesh(new RoundedBoxGeometry(6.2, 0.16, 3.2, 4, 0.05), gloss(0x1b2335)));
  desk.position.y = -0.08;
  world.add(desk);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }));
  strip.position.set(0, -0.08, 1.61);
  world.add(strip);

  [-2.7, 2.7].forEach((x) => {
    const leg = solid(new THREE.Mesh(new RoundedBoxGeometry(0.1, 1.7, 2.4, 3, 0.04), gloss(0x1a2131, { roughness: 0.4 })));
    leg.position.set(x, -1.0, 0);
    world.add(leg);
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.85;
  floor.receiveShadow = true;
  world.add(floor);

  /* ---------- monitor ---------- */

  const monitor = new THREE.Group();
  monitor.position.set(-0.55, 1.62, -0.75);
  monitor.rotation.y = 0.1;
  world.add(monitor);

  monitor.add(solid(new THREE.Mesh(new RoundedBoxGeometry(3.5, 2.05, 0.09, 4, 0.04), gloss(0x0c1018, { roughness: 0.25 }))));

  const page = document.createElement('canvas');
  page.width = 1280;
  page.height = 720;
  const pen = page.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(page);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.34, 1.88), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.z = 0.047;
  monitor.add(screen);

  let typed = -1;
  function writeScreen(count, cursorOn) {
    pen.fillStyle = '#0a0e16';
    pen.fillRect(0, 0, page.width, page.height);
    pen.fillStyle = '#121826';
    pen.fillRect(0, 0, page.width, 58);
    ['#2c3650', '#2c3650', '#2c3650'].forEach((dot, i) => {
      pen.fillStyle = dot;
      pen.beginPath();
      pen.arc(34 + i * 28, 29, 8, 0, Math.PI * 2);
      pen.fill();
    });
    pen.font = '500 22px "Geist Mono", ui-monospace, Menlo, monospace';
    pen.fillStyle = '#7f8aa3';
    pen.textBaseline = 'middle';
    pen.fillText('ensemble.py', 128, 30);

    pen.font = '500 31px "Geist Mono", ui-monospace, Menlo, monospace';
    const step = pen.measureText('M').width;
    let left = count;
    let cursor = [48, 118];
    CODE.forEach((line, row) => {
      let x = 48;
      const y = 118 + row * 62;
      line.forEach(([text, color]) => {
        if (left <= 0) return;
        const shown = text.slice(0, left);
        left -= shown.length;
        pen.fillStyle = color;
        pen.fillText(shown, x, y);
        x += shown.length * step;
        cursor = [x, y];
      });
    });
    if (cursorOn) {
      pen.fillStyle = '#6fe3ff';
      pen.fillRect(cursor[0] + 4, cursor[1] - 18, 14, 34);
    }
    screenTexture.needsUpdate = true;
  }

  /* ---------- keyboard and mouse ---------- */

  const keyboard = solid(new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.06, 0.74, 3, 0.025), gloss(0x0d111a, { roughness: 0.5 })));
  keyboard.position.set(-0.7, 0.03, 0.85);
  world.add(keyboard);

  const COLS = 15;
  const ROWS = 5;
  const keys = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.108, 0.04, 0.108),
    new THREE.MeshStandardMaterial({ color: 0x242c40, roughness: 0.6, metalness: 0.2 }),
    COLS * ROWS
  );
  const slot = new THREE.Object3D();
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      slot.position.set(-0.7 + (c - (COLS - 1) / 2) * 0.132, 0.075, 0.85 + (r - (ROWS - 1) / 2) * 0.132);
      slot.updateMatrix();
      keys.setMatrixAt(r * COLS + c, slot.matrix);
    }
  }
  keys.castShadow = true;
  world.add(keys);

  const mouse = solid(new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), gloss(0x10151f, { roughness: 0.2 })));
  mouse.scale.set(1, 0.42, 1.5);
  mouse.position.set(0.85, 0.06, 0.9);
  world.add(mouse);

  /* ---------- an AI chip ---------- */

  const chipBase = solid(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.025, 0.92), new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.35, metalness: 1 })));
  chipBase.position.set(2.15, 0.013, 0.85);
  world.add(chipBase);

  const label = document.createElement('canvas');
  label.width = 256;
  label.height = 256;
  const ink = label.getContext('2d');
  ink.fillStyle = '#0f1522';
  ink.fillRect(0, 0, 256, 256);
  ink.strokeStyle = '#6fe3ff';
  ink.lineWidth = 5;
  ink.strokeRect(22, 22, 212, 212);
  ink.fillStyle = '#c9f4ff';
  ink.font = '700 92px "Geist Mono", ui-monospace, Menlo, monospace';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillText('AI', 128, 134);
  const labelTexture = new THREE.CanvasTexture(label);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const dark = gloss(0x0f1522, { roughness: 0.4 });
  const top = new THREE.MeshStandardMaterial({ map: labelTexture, emissive: 0xffffff, emissiveMap: labelTexture, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3 });
  const chip = solid(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.78), [dark, dark, top, dark, dark, dark]));
  chip.position.set(2.15, 0.07, 0.85);
  world.add(chip);

  /* ---------- a stack of model layers ---------- */

  const sheets = [];
  const sheetShape = new THREE.PlaneGeometry(0.86, 0.86);
  const sheetEdge = new THREE.EdgesGeometry(sheetShape);
  for (let i = 0; i < 4; i += 1) {
    const sheet = new THREE.Group();
    sheet.add(new THREE.Mesh(sheetShape, glow(VIOLET, 0.13)));
    sheet.add(new THREE.LineSegments(sheetEdge, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.95, toneMapped: false })));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(-2.45, 0.14 + i * 0.17, 0.75);
    sheet.userData.rest = sheet.position.y;
    world.add(sheet);
    sheets.push(sheet);
  }

  /* ---------- hologram: projector, beam, neural network ---------- */

  const holo = new THREE.Group();
  holo.position.set(2.0, 0, -0.8);
  world.add(holo);

  const projector = solid(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.07, 48), gloss(0x10151f)));
  projector.position.y = 0.035;
  holo.add(projector);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.014, 12, 64), new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.075;
  holo.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.36, 1.55, 48, 1, true), glow(CYAN, 0.055));
  beam.position.y = 0.86;
  holo.add(beam);

  const layout = (window.Portfolio && window.Portfolio.networkLayout ? window.Portfolio.networkLayout : fallbackLayout)([3, 5, 5, 2]);
  const net = new THREE.Group();
  net.position.y = 1.85;
  net.scale.setScalar(0.78);
  holo.add(net);

  const halo = haloTexture();
  const nodeShape = new THREE.SphereGeometry(0.055, 16, 12);
  layout.nodes.forEach((p, i) => {
    const color = i % 3 === 0 ? VIOLET : CYAN;
    const node = new THREE.Mesh(nodeShape, new THREE.MeshBasicMaterial({ color: 0xeaf8ff, toneMapped: false }));
    node.position.set(p[0], p[1], p[2]);
    net.add(node);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    aura.scale.setScalar(0.5);
    aura.position.copy(node.position);
    net.add(aura);
  });

  const linkPoints = [];
  layout.edges.forEach(([a, b]) => {
    linkPoints.push(...layout.nodes[a], ...layout.nodes[b]);
  });
  const linkShape = new THREE.BufferGeometry();
  linkShape.setAttribute('position', new THREE.Float32BufferAttribute(linkPoints, 3));
  net.add(new THREE.LineSegments(linkShape, new THREE.LineBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));

  const pulses = [];
  for (let i = 0; i < 10; i += 1) {
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xd9f6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    dot.scale.setScalar(0.2);
    net.add(dot);
    pulses.push({ dot, edge: (i * 7) % layout.edges.length, t: i / 10 });
  }

  /* ---------- camera, size, pointer ---------- */

  let aspect = 1;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };

  function placeCamera(sway) {
    const pull = Math.max(1, 1.2 / aspect) * (host.clientWidth < 520 ? 1.12 : 1); // step back on narrow screens so the desk still fits
    const distance = 10.2 * pull;
    const azimuth = 0.56 + look.x * 0.22 + sway;
    const height = 0.31 - look.y * 0.07;
    camera.position.set(
      target.x + Math.sin(azimuth) * Math.cos(height) * distance,
      target.y + Math.sin(height) * distance,
      target.z + Math.cos(azimuth) * Math.cos(height) * distance
    );
    camera.lookAt(target);
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth || host.clientWidth);
    const height = Math.max(1, canvas.clientHeight || host.clientHeight);
    aspect = width / height;
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  const hero = host.closest('.hero');
  if (hero && finePointer && !still) {
    hero.addEventListener('pointermove', (event) => {
      const box = host.getBoundingClientRect();
      look.tx = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
      look.ty = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * 2));
    });
    hero.addEventListener('pointerleave', () => {
      look.tx = 0;
      look.ty = 0;
    });
  }

  /* ---------- drawing ---------- */

  function draw(time) {
    const seconds = time / 1000;
    look.x += (look.tx - look.x) * 0.06;
    look.y += (look.ty - look.y) * 0.06;
    placeCamera(still ? 0 : Math.sin(seconds * 0.25) * 0.05);

    if (!still) {
      monitor.position.y = 1.62 + Math.sin(seconds * 0.9) * 0.05;
      net.rotation.y = seconds * 0.35;
      net.position.y = 1.85 + Math.sin(seconds * 1.1) * 0.04;
      ring.material.opacity = 1;
      sheets.forEach((sheet, i) => {
        sheet.position.y = sheet.userData.rest + Math.sin(seconds * 1.4 + i * 0.7) * 0.025;
      });
      pulses.forEach((pulse) => {
        pulse.t += 0.012;
        if (pulse.t >= 1) {
          pulse.t = 0;
          pulse.edge = (pulse.edge + 11) % layout.edges.length;
        }
      });
    }
    pulses.forEach((pulse) => {
      const [a, b] = layout.edges[pulse.edge];
      const from = layout.nodes[a];
      const to = layout.nodes[b];
      pulse.dot.position.set(from[0] + (to[0] - from[0]) * pulse.t, from[1] + (to[1] - from[1]) * pulse.t, from[2] + (to[2] - from[2]) * pulse.t);
    });

    const count = still ? CODE_LENGTH : Math.min(CODE_LENGTH, Math.floor(Math.max(0, seconds - 0.8) * 38));
    const cursorOn = !still && Math.floor(seconds * 2) % 2 === 0;
    const state = count * 2 + (cursorOn ? 1 : 0);
    if (state !== typed) {
      typed = state;
      writeScreen(count, cursorOn);
    }

    renderer.render(scene, camera);
  }

  host.appendChild(canvas);
  resize();
  draw(0);
  // A frame is on the canvas: now the CSS scene can step aside.
  host.classList.add('is-webgl');
  resize();
  draw(0);

  let running = false;
  let visible = true;
  let began = 0;
  function frame(now) {
    if (!running) return;
    if (!began) began = now;
    draw(now - began);
    window.requestAnimationFrame(frame);
  }
  function update() {
    const should = visible && !document.hidden && !still;
    if (should && !running) {
      running = true;
      window.requestAnimationFrame(frame);
    } else if (!should) {
      running = false;
    }
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    }).observe(host);
  } else {
    window.addEventListener('resize', resize);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    }).observe(host);
  }
  document.addEventListener('visibilitychange', update);
  // The screen font may arrive after the first frame; redraw the screen with it.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      typed = -1;
      if (!running) draw(0);
    });
  }
  update();
}

/** A soft round glow, used for the neurons and the pulses. */
function haloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255, 255, 255, 1)');
  fade.addColorStop(0.25, 'rgba(255, 255, 255, 0.45)');
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Used only if script.js has not run: one neuron per layer, in a line. */
function fallbackLayout(layers) {
  const nodes = layers.map((_, i) => [layers.length === 1 ? 0 : -1 + (2 * i) / (layers.length - 1), 0, 0]);
  const edges = nodes.slice(1).map((_, i) => [i, i + 1]);
  return { nodes, edges };
}
