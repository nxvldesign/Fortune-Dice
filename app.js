/* ==============================================
   FORTUNE DICE — app.js
   Three.js dice with monochrome dot-matrix faces,
   a bunny avatar, shake-to-roll, typewriter fortune
   and light / dark themes.
   ============================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ----------------------------------------------
   DOM
---------------------------------------------- */
const $ = (id) => document.getElementById(id);
const container  = $('dice-container');
const textEl     = $('fortune-text');
const caretEl    = $('fortune-caret');
const metaEl     = $('fortune-meta');
const srEl       = $('fortune-sr');
const nudgeText  = $('nudge-text');
const themeBtn   = $('theme-toggle');
const themeLabel = $('theme-label');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----------------------------------------------
   Copy
---------------------------------------------- */
const FORTUNES = [
  'Friday 4 PM meeting canceled. Go live your life.',
  "Your 'quick sync' actually took 10 minutes. What a day.",
  'Free samosas in the pantry—and you got the hot ones.',
  'Salary credited. For the next two hours, you are royalty.',
  'You fixed the big bug just by restarting. Pure magic.',
  "Your boss said 'Great job' and actually meant it.",
  'Closing all 40 browser tabs at 5:30 PM. Bliss.',
  'The office chai actually hits the spot today.',
  "No replies to your 'Any questions?' email. You're free.",
  "That 'urgent' task just got pushed to next month.",
  'You guessed your new password on the very first try.',
  'Zero traffic on the drive home. The universe loves you.',
  'Your Friday afternoon is completely empty. Breathe it in.',
  'Someone else took the blame for the muted mic.',
  'Long weekend loading... and your inbox is already quiet.',
];

const INTRO_TEXT = 'Psst... shake the phone to find out what destiny wants to say.';

/* ----------------------------------------------
   Dot-matrix: 5x7 pixel font + helpers
---------------------------------------------- */
const N = 36;                   // dots across each round display
const C = (N - 1) / 2;          // grid centre (17.5)
const RADIUS = N / 2 - 0.4;     // round display mask

const FONT = {
  A: [14,17,17,31,17,17,17], B: [30,17,17,30,17,17,30], C: [14,17,16,16,16,17,14],
  D: [28,18,17,17,17,18,28], E: [31,16,16,30,16,16,31], F: [31,16,16,30,16,16,16],
  G: [14,17,16,23,17,17,15], H: [17,17,17,31,17,17,17], I: [14,4,4,4,4,4,14],
  J: [7,2,2,2,2,18,12],      K: [17,18,20,24,20,18,17], L: [16,16,16,16,16,16,31],
  M: [17,27,21,21,17,17,17], N: [17,17,25,21,19,17,17], O: [14,17,17,17,17,17,14],
  P: [30,17,17,30,16,16,16], Q: [14,17,17,17,21,18,13], R: [30,17,17,30,20,18,17],
  S: [15,16,16,14,1,1,30],   T: [31,4,4,4,4,4,4],       U: [17,17,17,17,17,17,14],
  V: [17,17,17,17,17,10,4],  W: [17,17,17,21,21,21,10], X: [17,17,10,4,10,17,17],
  Y: [17,17,10,4,4,4,4],     Z: [31,1,2,4,8,16,31],
  0: [14,17,19,21,25,17,14], 1: [4,12,4,4,4,4,14],      2: [14,17,1,2,4,8,31],
  3: [31,2,4,2,1,17,14],     4: [2,6,10,18,31,2,2],     5: [31,16,30,1,1,17,14],
  6: [6,8,16,30,17,17,14],   7: [31,1,2,4,8,8,8],       8: [14,17,17,14,17,17,14],
  9: [14,17,17,15,1,2,12],
  ':': [0,12,12,0,12,12,0],  '.': [0,0,0,0,0,12,12],    '!': [4,4,4,4,4,0,4],
  '?': [14,17,1,2,4,0,4],    '-': [0,0,0,31,0,0,0],     ' ': [0,0,0,0,0,0,0],
};

const inCircle = (x, y) => Math.hypot(x - C, y - C) <= RADIUS;

function px(g, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < N && y >= 0 && y < N) g[y * N + x] = 1;
}

/** Fill every cell for which fn(u, v) is true; u,v are centred coords. */
function fillFn(g, fn) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (fn(x - C, y - C)) g[y * N + x] = 1;
}

function textWidth(str, s = 1) { return str.length * 6 * s - s; }

function drawText(g, str, x, y, s = 1) {
  for (const ch of str.toUpperCase()) {
    const rows = FONT[ch] || FONT['?'];
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++)
        if (rows[r] & (16 >> c))
          for (let sy = 0; sy < s; sy++)
            for (let sx = 0; sx < s; sx++) px(g, x + c * s + sx, y + r * s + sy);
    x += 6 * s;
  }
}

function drawTextCentered(g, lines, s = 1, dy = 0) {
  const lh = 8 * s;
  const h = lines.length * lh - s;
  let y = Math.round((N - h) / 2) + dy;
  for (const line of lines) {
    drawText(g, line, Math.round((N - textWidth(line, s)) / 2), y, s);
    y += lh;
  }
}

function drawBitmap(g, rows, x0, y0) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') px(g, x0 + c, y0 + r);
  });
}

/* ---------- The bunny: ears, eyes, smile — nothing else ---------- */
const EYES = {
  open:  ['.###.', '#####', '#####', '#####', '.###.'],
  blink: ['.....', '.....', '#####', '.....', '.....'],
  happy: ['.....', '.###.', '#...#', '#...#', '.....'],
};
const MOUTHS = {
  smile: ['#........#', '.#......#.', '..######..'],
  happy: ['##########', '#........#', '.#......#.', '..######..'],
};

function drawEar(g, cx, cy, rx, ry, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  fillFn(g, (u, v) => {
    const du = u - cx, dv = v - cy;
    const ru = du * cs + dv * sn;
    const rv = -du * sn + dv * cs;
    const outer = (ru / rx) ** 2 + (rv / ry) ** 2 <= 1;
    const inner = (ru / (rx - 1.25)) ** 2 + (rv / (ry - 1.4)) ** 2 <= 1;
    return outer && !inner;
  });
}

function drawBunny(g, t, mood) {
  let la = -0.2, ra = 0.2;
  if ((t % 5.3) < 0.45) ra += Math.sin((t % 5.3) * 28) * 0.22;   // ear twitch
  if (mood === 'happy') { la -= 0.06; ra += 0.06; }
  drawEar(g, -5.4, -8.6, 2.9, 7.1, la);
  drawEar(g, 5.4, -8.6, 2.9, 7.1, ra);

  const eye = mood === 'happy' ? 'happy' : (t % 3.7) < 0.14 ? 'blink' : 'open';
  drawBitmap(g, EYES[eye], 10, 19);
  drawBitmap(g, EYES[eye], 21, 19);
  drawBitmap(g, MOUTHS[mood === 'happy' ? 'happy' : 'smile'], 13, 26);
}

/* ---------- Typographic face programs ---------- */
function drawMarquee(g, t, msg) {
  const w = textWidth(msg) + 1;
  const off = Math.floor(t * 14) % w;
  drawText(g, msg + msg, N - 4 - off - w, 14);
  drawText(g, msg, N - 4 - off, 14);
  for (let x = 2; x < N - 2; x += 2) { px(g, x, 10); px(g, x, 24); }
}

function drawClock(g) {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  drawText(g, hh + (d.getMilliseconds() < 500 ? ':' : ' ') + mm, 3, 14);
  const s = d.getSeconds() / 59;
  for (let x = 6; x <= 6 + Math.round(s * 23); x++) px(g, x, 25);
}

function drawNoise(g, density) {
  for (let i = 0; i < g.length; i++) if (Math.random() < density) g[i] = 1;
}

// what each face shows when the bunny isn't on it
const BASE = [
  (g) => drawTextCentered(g, ['SHAKE', 'ME']),
  (g, t) => drawMarquee(g, t, 'FORTUNE DICE - GOOD NEWS ONLY - '),
  (g, t) => drawTextCentered(g, ['?'], 3, Math.round(Math.sin(t * 3) * 1.6)),
  (g) => drawClock(g),
  (g) => drawTextCentered(g, ['GOOD', 'NEWS']),
  (g) => drawTextCentered(g, ['LUCK', 'NO.7']),
];

/* ----------------------------------------------
   Display: canvas dot matrix + monochrome
   holographic sheen shader
---------------------------------------------- */
const TEX = 384;
const PITCH = TEX / N;

const dotLit = (() => {
  const s = Math.ceil(PITCH * 2.2);
  const c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(250,250,250,0.95)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, s, s);
  return c;
})();

const displayBase = (() => {
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(TEX / 2, TEX * 0.4, 0, TEX / 2, TEX / 2, TEX / 2);
  grd.addColorStop(0, '#141414'); grd.addColorStop(1, '#050505');
  x.fillStyle = grd; x.fillRect(0, 0, TEX, TEX);
  x.fillStyle = '#232323';
  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++)
      if (inCircle(gx, gy)) {
        x.beginPath();
        x.arc((gx + 0.5) * PITCH, (gy + 0.5) * PITCH, PITCH * 0.28, 0, Math.PI * 2);
        x.fill();
      }
  return c;
})();

const holoVert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

// monochrome "hologram": view-angle sheen + scanlines, no hue
const holoFrag = /* glsl */`
  uniform sampler2D map; uniform float uTime; uniform float uGlitch;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vec2 uv = vUv;
    uv.x += uGlitch * 0.018 * sin(uv.y * 90.0 + uTime * 50.0);
    vec3 base = texture2D(map, uv).rgb;
    float f = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float lum = max(max(base.r, base.g), base.b);
    float band = 0.5 + 0.5 * sin((uv.x * 0.8 + uv.y * 0.5) * 6.0 + f * 5.0 - uTime * 0.6);
    vec3 col = base * (0.86 + 0.14 * band);
    col += vec3(0.02 + 0.2 * f * f) * (0.3 + lum);
    col *= 0.93 + 0.07 * sin(uv.y * 420.0 - uTime * 6.0);
    float r = length(vUv - 0.5) * 2.0;
    col *= mix(1.0, 0.7, smoothstep(0.75, 1.0, r));
    gl_FragColor = vec4(col, 1.0);
  }`;

class Display {
  constructor(program) {
    this.program = program;
    this.grid = new Uint8Array(N * N);
    this.hash = -1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = TEX;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.anisotropy = 4;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.texture }, uTime: { value: 0 }, uGlitch: { value: 0 } },
      vertexShader: holoVert,
      fragmentShader: holoFrag,
    });
  }

  update(t) {
    const g = this.grid;
    g.fill(0);
    this.program(g, t);
    let h = 2166136261;
    for (let i = 0; i < g.length; i++) if (g[i] && inCircle(i % N, (i / N) | 0)) h = Math.imul(h ^ i, 16777619);
    if (h === this.hash) return;
    this.hash = h;
    this.paint();
  }

  paint() {
    const x = this.ctx, g = this.grid, s = dotLit.width;
    x.globalCompositeOperation = 'source-over';
    x.drawImage(displayBase, 0, 0);
    x.globalCompositeOperation = 'lighter';
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++)
        if (g[gy * N + gx] && inCircle(gx, gy))
          x.drawImage(dotLit, (gx + 0.5) * PITCH - s / 2, (gy + 0.5) * PITCH - s / 2);
    this.texture.needsUpdate = true;
  }
}

/* ----------------------------------------------
   Stickers — monochrome case art
---------------------------------------------- */
const FONT_STACK = '"Courier Prime", "Courier New", monospace';
const INK = '#111111', PAPER = '#ffffff', GRAY = '#8a8a8a', LIGHT = '#d6d6d6';

function seeded(seed) {
  return () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296;
}

function makeSticker(kind) {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  const font = (w, s) => { x.font = `${w} ${s}px ${FONT_STACK}`; };

  // die-cut: white border + soft drop shadow, then the fill
  const cut = (path, fill, border = 18) => {
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.28)'; x.shadowBlur = 10; x.shadowOffsetY = 4;
    x.beginPath(); path(); x.lineWidth = border; x.strokeStyle = PAPER; x.stroke();
    x.fillStyle = PAPER; x.fill();
    x.restore();
    x.beginPath(); path(); x.fillStyle = fill; x.fill();
  };
  const outline = (path, w = 5) => { x.beginPath(); path(); x.lineWidth = w; x.strokeStyle = INK; x.stroke(); };

  switch (kind) {
    case 'lucky': {
      cut(() => x.arc(128, 128, 98, 0, Math.PI * 2), INK);
      x.strokeStyle = PAPER; x.lineWidth = 3; x.setLineDash([6, 6]);
      x.beginPath(); x.arc(128, 128, 82, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
      x.fillStyle = PAPER;
      font('700', 22); x.fillText('+ + +', 128, 86);
      font('700', 50); x.fillText('LUCKY', 128, 134);
      font('700', 24); x.fillText('Nº 07', 128, 178);
      break;
    }
    case 'shake': {
      const p = () => x.roundRect(14, 82, 228, 92, 46);
      cut(p, PAPER); outline(p, 6);
      x.fillStyle = INK; font('700', 36); x.fillText('SHAKE ME!', 128, 130);
      break;
    }
    case 'barcode': {
      const p = () => x.roundRect(26, 62, 204, 132, 10);
      cut(p, PAPER); outline(p, 3);
      const r = seeded(7);
      x.fillStyle = INK;
      for (let bx = 44; bx < 210;) { const w = 2 + Math.floor(r() * 5); if (r() > 0.3) x.fillRect(bx, 78, w, 70); bx += w + 2; }
      font('700', 19); x.fillText('FD-07 · ORACLE', 128, 172);
      break;
    }
    case 'hazard': {
      const p = () => x.roundRect(12, 70, 232, 116, 12);
      cut(p, PAPER);
      x.save(); x.beginPath(); p(); x.clip();
      x.fillStyle = INK;
      for (let i = -260; i < 260; i += 36) {
        x.beginPath(); x.moveTo(i, 186); x.lineTo(i + 18, 186); x.lineTo(i + 134, 70); x.lineTo(i + 116, 70); x.fill();
      }
      x.restore();
      outline(p, 4);
      x.fillStyle = PAPER; x.fillRect(30, 104, 196, 48);
      x.strokeStyle = INK; x.lineWidth = 3; x.strokeRect(30, 104, 196, 48);
      x.fillStyle = INK; font('700', 17); x.fillText('HANDLE WITH LUCK', 128, 129);
      break;
    }
    case 'seven': {
      cut(() => x.arc(128, 128, 94, 0, Math.PI * 2), LIGHT);
      x.strokeStyle = INK; x.lineWidth = 3; x.setLineDash([4, 7]);
      x.beginPath(); x.arc(128, 128, 78, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
      x.fillStyle = INK; font('700', 120); x.fillText('7', 128, 138);
      break;
    }
    case 'warn': {
      cut(() => { x.moveTo(128, 26); x.lineTo(234, 214); x.lineTo(22, 214); x.closePath(); }, PAPER, 22);
      x.strokeStyle = INK; x.lineWidth = 9;
      x.beginPath(); x.moveTo(128, 46); x.lineTo(216, 204); x.lineTo(40, 204); x.closePath(); x.stroke();
      x.fillStyle = INK; font('700', 110); x.fillText('!', 128, 150);
      break;
    }
    case 'ok': {
      cut(() => {
        x.roundRect(28, 44, 200, 132, 44);
        x.moveTo(70, 168); x.lineTo(56, 220); x.lineTo(112, 172);
      }, GRAY);
      x.fillStyle = PAPER; font('700', 64); x.fillText('OK!', 128, 112);
      break;
    }
    case 'orbit': {
      cut(() => x.roundRect(20, 92, 216, 72, 12), INK);
      x.fillStyle = LIGHT; x.fillRect(20, 92, 46, 72);
      x.fillStyle = INK; font('700', 34); x.fillText('+', 43, 130);
      x.fillStyle = PAPER; font('700', 24); x.fillText('V.2026', 150, 130);
      break;
    }
    case 'fragile': {
      const p = () => x.roundRect(18, 64, 220, 128, 14);
      cut(p, PAPER); outline(p, 5);
      x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(30, 76, 196, 104);
      x.fillStyle = INK; font('700', 40); x.fillText('FRAGILE', 128, 118);
      font('700', 17); x.fillText('ORACLE INSIDE', 128, 156);
      break;
    }
    case 'dots': {
      cut(() => x.roundRect(36, 36, 184, 184, 36), INK);
      x.fillStyle = PAPER;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
        x.beginPath(); x.arc(70 + i * 23, 66 + j * 23, (i + j) % 3 ? 4 : 7, 0, Math.PI * 2); x.fill();
      }
      font('700', 24); x.fillText('FD-01', 128, 196);
      break;
    }
    case 'arrow': {
      const p = () => x.roundRect(40, 30, 176, 196, 18);
      cut(p, PAPER); outline(p, 5);
      x.fillStyle = INK;
      x.beginPath(); x.moveTo(128, 50); x.lineTo(176, 108); x.lineTo(146, 108); x.lineTo(146, 150);
      x.lineTo(110, 150); x.lineTo(110, 108); x.lineTo(80, 108); x.closePath(); x.fill();
      font('700', 20); x.fillText('THIS SIDE', 128, 178); x.fillText('UP', 128, 202);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ----------------------------------------------
   Three.js scene
---------------------------------------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  textEl.textContent = 'your device could not start the 3d oracle. try another browser?';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(0, 0.6, 7.3);
camera.lookAt(0, -0.2, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(3, 5, 4);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

/* ---------- Dice geometry ---------- */
const SHELL = 2.0, SHELL_R = 0.4;   // outer clear case — big, soft corners
const CORE = 1.74, CORE_R = 0.32;   // inner body — rounded to echo the case
const H = SHELL / 2;
const CH = CORE / 2;
const FLAT = H - SHELL_R;           // flat half-width of each case face (0.6)

// materials whose colours swap with the theme
const mats = {
  core:  new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.38 }),
  shell: new THREE.MeshPhysicalMaterial({
    metalness: 0, roughness: 0.12, transparent: true, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.6,
  }),
  frame: new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.28 }),
  bezel: new THREE.MeshStandardMaterial({ metalness: 0.7, roughness: 0.3 }),
  screw: new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.25 }),
  slot:  new THREE.MeshBasicMaterial(),
  led:   new THREE.MeshBasicMaterial({ color: 0xffffff }),
};

const THEMES = {
  // light page → dark dice
  light: { core: 0x26272b, coreMetal: 0.55, shell: 0xf2f4f7, shellOpacity: 0.15, frame: 0xc4c8ce,
           bezel: 0x3a3b40, screw: 0xb5b9bf, slot: 0x4a4c52, shadow: 0x000000, shadowOpacity: 0.75,
           metaTheme: '#ffffff' },
  // dark page → white dice
  dark:  { core: 0xe4e5e8, coreMetal: 0.25, shell: 0xffffff, shellOpacity: 0.2, frame: 0x7b7f86,
           bezel: 0xc9ccd1, screw: 0x8f939a, slot: 0x55585e, shadow: 0xffffff, shadowOpacity: 0.16,
           metaTheme: '#0b0b0c' },
};

const dice = new THREE.Group();
scene.add(dice);

dice.add(new THREE.Mesh(new RoundedBoxGeometry(CORE, CORE, CORE, 6, CORE_R), mats.core));

const shell = new THREE.Mesh(new RoundedBoxGeometry(SHELL, SHELL, SHELL, 8, SHELL_R), mats.shell);
shell.renderOrder = 2;
dice.add(shell);

// thin skeletal frame — straight edge bars joined by quarter-arcs at the
// corners, so the cage follows the rounded body instead of drawing a box
{
  const A = 0.82;                 // edge offset of the bars
  const E = 0.55;                 // where each straight bar ends (start of the bend)
  const R = A - E;                // bend radius
  const T = 0.011;                // bar thickness
  const bar = new THREE.CylinderGeometry(T, T, 2 * E, 10);
  const add = (rx, rz, x, y, z) => {
    const m = new THREE.Mesh(bar, mats.frame); m.rotation.set(rx, 0, rz); m.position.set(x, y, z); dice.add(m);
  };
  for (const a of [-A, A]) for (const b of [-A, A]) {
    add(0, Math.PI / 2, 0, a, b);   // along X
    add(0, 0, a, 0, b);             // along Y
    add(Math.PI / 2, 0, a, b, 0);   // along Z
  }

  class Arc extends THREE.Curve {
    constructor(c, u, v) { super(); this.c = c; this.u = u; this.v = v; }
    getPoint(t, out = new THREE.Vector3()) {
      const ang = t * Math.PI / 2;
      return out.copy(this.c).addScaledVector(this.u, Math.cos(ang) * R).addScaledVector(this.v, Math.sin(ang) * R);
    }
  }
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const sg = [sx, sy, sz];
    for (const [i, j, k] of [[0, 1, 2], [1, 2, 0], [0, 2, 1]]) {
      const c = new THREE.Vector3();
      c.setComponent(i, E * sg[i]); c.setComponent(j, E * sg[j]); c.setComponent(k, A * sg[k]);
      const curve = new Arc(c, axes[i].clone().multiplyScalar(sg[i]), axes[j].clone().multiplyScalar(sg[j]));
      dice.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, T, 8), mats.frame));
    }
  }
}

/* ---------- Faces ---------- */
// rotation that turns local +Z into each face normal (and keeps content upright)
const FACES = [
  [0, 0, 0],                 // front
  [0, Math.PI / 2, 0],       // right
  [-Math.PI / 2, 0, 0],      // top
  [0, -Math.PI / 2, 0],      // left
  [0, Math.PI, 0],           // back
  [Math.PI / 2, 0, 0],       // bottom
];

// sticker layout per face: [kind, x, y, size, rotation] — kept inside the flat area
const STICKERS = [
  [['lucky', -0.45, 0.45, 0.36, -0.3], ['seven', 0.48, -0.48, 0.26, 0.15]],
  [['shake', -0.2, -0.5, 0.5, 0.1], ['warn', 0.47, 0.47, 0.28, 0.2]],
  [['barcode', 0.4, -0.5, 0.36, -0.08], ['ok', -0.48, 0.48, 0.26, 0]],
  [['hazard', 0.2, -0.5, 0.5, -0.06], ['fragile', -0.46, 0.46, 0.32, -0.18]],
  [['orbit', 0.28, -0.5, 0.46, 0], ['dots', -0.47, 0.47, 0.28, -0.12]],
  [['arrow', 0.46, -0.46, 0.3, 0]],
];

const stickerTextures = new Map();
const screwGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.02, 20);
screwGeo.rotateX(Math.PI / 2);
const slotGeo = new THREE.BoxGeometry(0.044, 0.009, 0.01);
const bezelGeo = new THREE.RingGeometry(0.575, 0.61, 72);
const displayGeo = new THREE.CircleGeometry(0.575, 72);

const displays = [];
let led = null;

function buildFaces() {
  FACES.forEach((rot, i) => {
    const grp = new THREE.Group();
    grp.rotation.set(...rot);
    dice.add(grp);

    const disp = new Display((g, t) => faceProgram(i, g, t));
    const dMesh = new THREE.Mesh(displayGeo, disp.material);
    dMesh.position.z = CH + 0.004;
    const bezel = new THREE.Mesh(bezelGeo, mats.bezel);
    bezel.position.z = CH + 0.003;
    grp.add(dMesh, bezel);
    displays.push(disp);

    const list = STICKERS[i];
    list.forEach(([kind, sx, sy, size, rz], k) => {
      if (!stickerTextures.has(kind)) stickerTextures.set(kind, makeSticker(kind));
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshStandardMaterial({ map: stickerTextures.get(kind), alphaTest: 0.5, roughness: 0.55 })
      );
      m.position.set(sx, sy, H + 0.004 + k * 0.0015);
      m.rotation.z = rz;
      grp.add(m);
    });

    // screws in free corners; the front face gets a small status led
    const S = FLAT - 0.08;
    for (const cx of [-1, 1]) for (const cy of [-1, 1]) {
      if (list.some(([, sx, sy]) => Math.sign(sx) === cx && Math.sign(sy) === cy)) continue;
      const pos = new THREE.Vector3(cx * S, cy * S, H + 0.006);
      if (i === 0 && cx === 1 && cy === 1) {
        led = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), mats.led);
        led.position.copy(pos);
        grp.add(led);
        continue;
      }
      const screw = new THREE.Mesh(screwGeo, mats.screw);
      screw.position.copy(pos);
      const slot = new THREE.Mesh(slotGeo, mats.slot);
      slot.position.set(pos.x, pos.y, pos.z + 0.011);
      slot.rotation.z = cx * cy * 0.6;
      grp.add(screw, slot);
    }
  });
}

/* ---------- Floor shadow (dark mode: soft spotlight pool) ---------- */
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.5)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.2)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(3.2, 3.2),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -1.8;
scene.add(shadow);

/* ----------------------------------------------
   Theme
---------------------------------------------- */
let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

function applyTheme(name, save) {
  theme = name;
  const p = THEMES[name];
  document.documentElement.setAttribute('data-theme', name);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', p.metaTheme);
  mats.core.color.setHex(p.core); mats.core.metalness = p.coreMetal;
  mats.shell.color.setHex(p.shell); mats.shell.opacity = p.shellOpacity;
  mats.frame.color.setHex(p.frame);
  mats.bezel.color.setHex(p.bezel);
  mats.screw.color.setHex(p.screw);
  mats.slot.color.setHex(p.slot);
  shadow.material.color.setHex(p.shadow);
  themeLabel.textContent = name === 'dark' ? 'LIGHT MODE' : 'DARK MODE';
  themeBtn.setAttribute('aria-label', `Switch to ${name === 'dark' ? 'light' : 'dark'} mode`);
  if (save) { try { localStorage.setItem('fd-theme', name); } catch { /* private mode */ } }
}
applyTheme(theme, false);

themeBtn.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark', true));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('fd-theme'); } catch { /* ignore */ }
  if (!saved) applyTheme(e.matches ? 'dark' : 'light', false);
});

/* ----------------------------------------------
   State machine
---------------------------------------------- */
const BASE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, -0.6, 0, 'XYZ'));
const faceTargets = FACES.map((rot) =>
  BASE_Q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)).invert())
);

let state = 'intro';           // intro | idle | shaking | settling | result
let targetQ = BASE_Q.clone();
let bunnyFace = 0;             // the one bunny lives on this face
let resultFace = -1;
let fortune = '';
let lastFortune = -1;
let isIntroSettle = true;

const angVel = new THREE.Vector3();
let shakeStart = 0, shakeUntil = 0;
let settleStart = 0, settleDur = 1300;
const settleFromQ = new THREE.Quaternion();
const settleFromP = new THREE.Vector3();
const wobbleAxis = new THREE.Vector3(1, 0, 0);
let settleK = 0;

// drag-to-inspect: vx / vy are angular velocities (rad/s) about world Y / X
const drag = { active: false, id: -1, moved: false, x0: 0, y0: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0 };
const bunnyTmp = new Uint8Array(N * N);

function faceProgram(i, g, t) {
  if (state === 'shaking') { drawNoise(g, 0.3); return; }

  const rolling = state === 'settling' && !isIntroSettle;
  if (rolling && i === resultFace) {
    // the bunny resolves out of the static on the landing face
    drawNoise(g, 0.3 * (1 - settleK) ** 1.5);
    bunnyTmp.fill(0);
    drawBunny(bunnyTmp, t, 'happy');
    const p = settleK * settleK;
    for (let k = 0; k < bunnyTmp.length; k++) if (bunnyTmp[k] && Math.random() < p) g[k] = 1;
    return;
  }
  if (!rolling && i === bunnyFace) { drawBunny(g, t, state === 'result' ? 'happy' : 'idle'); return; }
  BASE[i](g, t);
}

function roll() {
  if (state === 'intro') return;
  const now = performance.now();
  if (state === 'shaking') {
    // keep rattling while the phone is being shaken (capped)
    shakeUntil = Math.min(Math.max(shakeUntil, now + 450), shakeStart + 4000);
    return;
  }
  state = 'shaking';
  isIntroSettle = false;
  shakeStart = now;
  shakeUntil = now + (reducedMotion ? 600 : 1300);

  let idx;
  do { idx = Math.floor(Math.random() * FORTUNES.length); } while (idx === lastFortune);
  lastFortune = idx;
  fortune = FORTUNES[idx];
  do { resultFace = Math.floor(Math.random() * FACES.length); } while (resultFace === bunnyFace);
  targetQ.copy(faceTargets[resultFace]);
  drag.vx = drag.vy = 0;

  angVel.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(7, 10));

  cancelTyping();
  textEl.textContent = '';
  srEl.textContent = '';
  scramble(metaEl, 'CONSULTING THE ORACLE...');
  buzz(30);
}

function beginSettle(now, fromIntro = false) {
  state = 'settling';
  settleStart = now;
  settleDur = fromIntro ? 1500 : reducedMotion ? 500 : 1400;
  settleFromQ.copy(dice.quaternion);
  settleFromP.copy(dice.position);
  wobbleAxis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
}

function finishSettle() {
  if (isIntroSettle) {
    state = 'idle';
    isIntroSettle = false;
    typewrite(INTRO_TEXT);
    return;
  }
  state = 'result';
  bunnyFace = resultFace;
  buzz([18, 50, 18]);
  const no = String(Math.floor(rand(1000, 9999)));
  const lucky = String(Math.floor(rand(1, 99))).padStart(2, '0');
  scramble(metaEl, `FORTUNE Nº ${no} · LUCKY ${lucky}`);
  srEl.textContent = fortune;
  typewrite(fortune);
}

/* ---------- motion helpers ---------- */
const buzz = (p) => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(p); } catch { /* no haptics */ } };
const rand = (a, b) => a + Math.random() * (b - a);
const easeOutCubic = (k) => 1 - (1 - k) ** 3;
const easeOutBounce = (k) => {
  const n = 7.5625, d = 2.75;
  if (k < 1 / d) return n * k * k;
  if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
  if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
  return n * (k -= 2.625 / d) * k + 0.984375;
};

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const restQ = new THREE.Quaternion();
const restP = new THREE.Vector3();

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/** Turn the resting orientation in screen space (used by drag + its momentum). */
function spinTarget(aboutY, aboutX) {
  _q.setFromAxisAngle(AXIS_Y, aboutY); targetQ.premultiply(_q);
  _q.setFromAxisAngle(AXIS_X, aboutX); targetQ.premultiply(_q);
  targetQ.normalize();
}

function restPose(t) {
  const amp = reducedMotion ? 0.3 : 1;
  _e.set(Math.sin(t * 0.8) * 0.04 * amp, Math.sin(t * 0.55) * 0.07 * amp, 0);
  restQ.setFromEuler(_e).multiply(targetQ);
  restP.set(0, Math.sin(t * 1.3) * 0.08 * amp, 0);
}

function update(t, dt, now) {
  // momentum after a drag, easing out
  if (!drag.active && (drag.vx || drag.vy)) {
    spinTarget(drag.vx * dt, drag.vy * dt);
    const decay = Math.exp(-dt * 3.5);
    drag.vx *= decay; drag.vy *= decay;
    if (Math.abs(drag.vx) + Math.abs(drag.vy) < 0.03) drag.vx = drag.vy = 0;
  }
  restPose(t);

  if (state === 'shaking') {
    // tumble + rattle
    angVel.x += rand(-1, 1) * 40 * dt;
    angVel.y += rand(-1, 1) * 40 * dt;
    angVel.z += rand(-1, 1) * 40 * dt;
    angVel.clampLength(6, 12);
    _q.setFromAxisAngle(_v.copy(angVel).normalize(), angVel.length() * dt);
    dice.quaternion.premultiply(_q);
    dice.position.set(rand(-1, 1) * 0.1, Math.sin(t * 38) * 0.08 + 0.15, rand(-1, 1) * 0.06);
    if (now >= shakeUntil) beginSettle(now);
  } else if (state === 'settling') {
    const k = Math.min(1, (now - settleStart) / settleDur);
    settleK = k;
    dice.quaternion.slerpQuaternions(settleFromQ, restQ, easeOutCubic(k));
    _q.setFromAxisAngle(wobbleAxis, 0.35 * (1 - k) ** 2 * Math.sin(k * 20));
    dice.quaternion.premultiply(_q);
    dice.position.lerpVectors(settleFromP, restP, isIntroSettle ? easeOutBounce(k) : easeOutCubic(k));
    if (!isIntroSettle) dice.position.x += rand(-1, 1) * 0.06 * (1 - k) ** 3;
    if (k >= 1) finishSettle();
  } else if (state !== 'intro') {
    dice.quaternion.copy(restQ);
    dice.position.copy(restP);
  }

  // shadow / light pool follows the float height
  const y = dice.position.y;
  const s = 1 - y * 0.12;
  shadow.scale.set(s, s, s);
  const base = THEMES[theme].shadowOpacity;
  shadow.material.opacity = THREE.MathUtils.clamp(base - y * base * 0.25, base * 0.2, base * 1.1);
  shadow.position.x = dice.position.x;

  if (led) led.visible = state === 'shaking' ? (t * 12) % 1 < 0.5 : (t % 2.4) < 2.2;

  const glitch = state === 'shaking' ? 1 : state === 'settling' && !isIntroSettle ? 1 - settleK : 0;
  for (const d of displays) {
    d.material.uniforms.uTime.value = t;
    d.material.uniforms.uGlitch.value = glitch;
  }
}

/* ----------------------------------------------
   Typewriter + scramble text
---------------------------------------------- */
let typeToken = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cancelTyping() { typeToken++; caretEl.classList.remove('typing'); }

async function typewrite(text) {
  const tok = ++typeToken;
  textEl.textContent = '';
  caretEl.classList.add('typing');
  for (const ch of text) {
    if (tok !== typeToken) return;
    textEl.textContent += ch;
    let d = reducedMotion ? 8 : 34 + Math.random() * 30;
    if (!reducedMotion && /[.,!?—]/.test(ch)) d += 220;
    await wait(d);
  }
  if (tok === typeToken) caretEl.classList.remove('typing');
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#+<>/';
let scrambleToken = 0;
function scramble(el, target) {
  const tok = ++scrambleToken;
  const start = performance.now();
  const dur = reducedMotion ? 0 : 520;
  const step = () => {
    if (tok !== scrambleToken) return;
    const k = dur ? Math.min(1, (performance.now() - start) / dur) : 1;
    const n = Math.floor(target.length * k);
    let out = target.slice(0, n);
    for (let i = n; i < target.length; i++) out += target[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

/* ----------------------------------------------
   Input: shake, tap, keyboard, pointer parallax
---------------------------------------------- */
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const needsPermission = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
let motionOn = false;

nudgeText.textContent = isTouch
  ? "Can't shake? Then tap the dice to reveal your fortune."
  : "Can't shake? Then click the dice to reveal your fortune.";

let lastAcc = null, lastHit = 0, hits = 0;
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a || a.x == null) return;
  if (lastAcc) {
    const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z);
    if (d > 22) {
      const now = performance.now();
      hits = now - lastHit < 500 ? hits + 1 : 1;
      lastHit = now;
      if (hits >= 2 || state === 'shaking') roll();
    }
  }
  lastAcc = { x: a.x, y: a.y, z: a.z };
}

function enableMotion() {
  if (motionOn) return;
  window.addEventListener('devicemotion', onMotion);
  motionOn = true;
}

if (isTouch && !needsPermission && 'DeviceMotionEvent' in window) enableMotion();

// iOS only grants motion access from a user gesture, and there is no button
// any more — so the first tap anywhere on the page asks for it.
let askedMotion = false;
async function askMotion() {
  if (!needsPermission || motionOn || askedMotion) return;
  askedMotion = true;
  try {
    if ((await DeviceMotionEvent.requestPermission()) === 'granted') enableMotion();
  } catch { askedMotion = false; /* not a valid gesture yet — try again next tap */ }
}
if (needsPermission) {
  document.addEventListener('touchend', askMotion, { passive: true });
  document.addEventListener('click', askMotion);
}

/* ---------- Drag to turn the dice; a quick tap rolls it ---------- */
const TAP_SLOP = 8;          // px of movement before a press counts as a drag
const MAX_SPIN = 14;         // rad/s cap on release momentum

container.addEventListener('pointerdown', (e) => {
  if (drag.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
  Object.assign(drag, {
    active: true, id: e.pointerId, moved: false,
    x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0,
  });
  container.setPointerCapture(e.pointerId);
});

container.addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.id) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < TAP_SLOP) return;
    drag.moved = true;
    container.classList.add('dragging');
  }
  const now = performance.now();
  const k = (Math.PI * 1.4) / container.clientWidth;   // a full-width drag ≈ 250°
  const ay = (e.clientX - drag.lx) * k;
  const ax = (e.clientY - drag.ly) * k;
  if (state === 'idle' || state === 'result') {
    spinTarget(ay, ax);
    const secs = Math.max(0.008, (now - drag.lt) / 1000);
    drag.vx = THREE.MathUtils.clamp(drag.vx * 0.5 + (ay / secs) * 0.5, -MAX_SPIN, MAX_SPIN);
    drag.vy = THREE.MathUtils.clamp(drag.vy * 0.5 + (ax / secs) * 0.5, -MAX_SPIN, MAX_SPIN);
  }
  drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
});

function endDrag(e, cancelled) {
  if (!drag.active || e.pointerId !== drag.id) return;
  drag.active = false;
  container.classList.remove('dragging');
  if (performance.now() - drag.lt > 90) drag.vx = drag.vy = 0;   // held still before letting go
  if (!drag.moved && !cancelled) roll();
}
container.addEventListener('pointerup', (e) => endDrag(e, false));
container.addEventListener('pointercancel', (e) => endDrag(e, true));

container.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); }
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); roll(); }
});

/* ----------------------------------------------
   Resize + loop
---------------------------------------------- */
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

const clock = new THREE.Clock();
let lastTick = -1;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  update(t, dt, performance.now());

  // dot-matrix content runs at ~15 fps — it's a display, not a movie
  const tick = Math.floor(t * 15);
  if (tick !== lastTick) {
    lastTick = tick;
    for (const d of displays) d.update(t);
  }
  renderer.render(scene, camera);
}

/* ----------------------------------------------
   Boot: wait for the font (stickers use it),
   then drop the dice in
---------------------------------------------- */
(async () => {
  try {
    await Promise.race([document.fonts.load(`700 40px ${FONT_STACK}`), wait(1500)]);
  } catch { /* use fallback font */ }

  buildFaces();
  displays.forEach((d) => d.update(0));

  dice.position.set(0, 3.4, 0);
  dice.quaternion.setFromEuler(new THREE.Euler(rand(-2, 2), rand(-2, 2), rand(-1, 1)));
  container.classList.add('ready');
  renderer.setAnimationLoop(frame);
  beginSettle(performance.now(), true);
})();
