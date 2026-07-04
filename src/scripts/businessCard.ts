/*
 * businessCard.ts — PORT-19 "the card comes off the page".
 *
 * A self-contained Three.js scene that renders the site's trading-card motif
 * as a literal 3D business card: cream card stock, ink typography, energy
 * pips, and a scannable QR code on the back — every texture painted at
 * runtime with the 2D canvas API using the site's self-hosted fonts.
 *
 * Exported as `mountBusinessCard(container)` so PORT-20 can later reuse the
 * same scene inside a floating overlay. The returned handle's `destroy()`
 * tears everything down (rAF, listeners, GPU resources).
 *
 * Interaction model:
 *   - idle: gentle bob + sway (a `floatGroup` owns this so it never fights
 *     the user's rotation, which lives on a nested `spinGroup`)
 *   - drag (mouse/touch/pen via Pointer Events): yaw free-spins, pitch is
 *     clamped; release carries velocity that decays exponentially (framerate
 *     independent) while pitch springs back to level
 *   - double-click / double-tap: eases yaw to the nearest full turn (front
 *     facing) — instant under prefers-reduced-motion, which also disables
 *     the idle bob and post-release inertia.
 */
import * as THREE from 'three';

/* ---------------------------------------------------------------
 * Palette — mirrors src/styles/tokens.css (canvas can't read CSS vars
 * at texture-paint time without a live element; keep in sync manually).
 * ------------------------------------------------------------- */
const C = {
  paper: '#f7f2e7',
  paperRaised: '#fdf9f0',
  paperEdge: '#e7ddc8',
  ink: '#1e2422',
  inkSoft: '#3d453f',
  inkMuted: '#6d746c',
  orange: '#e4572e',
  orangeDeep: '#b8421f',
  pine: '#2f5d50',
  pineDeep: '#21463c',
  sky: '#87bcde',
};

const FONT_DISPLAY = '"Bricolage Grotesque Variable"';
const FONT_BODY = '"Hanken Grotesk Variable"';
const FONT_MONO = '"IBM Plex Mono"';

/* ===============================================================
 * QR encoder — fixed Version 2 (25×25), error correction level M,
 * byte mode. Hand-rolled per ISO/IEC 18004 (no dependency): bit
 * stream → Reed–Solomon EC over GF(256) → matrix + mask selection
 * via the four standard penalty rules. Capacity: 26 bytes.
 * ============================================================= */
function qrModules(text: string): boolean[][] {
  const SIZE = 25; // version 2
  const DATA_CW = 28; // data codewords for 2-M
  const EC_CW = 16; // error-correction codewords for 2-M

  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 26) throw new Error('qr: payload exceeds version 2-M capacity');

  /* ---- data bit stream: mode 0100, 8-bit count, bytes, terminator, pads */
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, DATA_CW * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  for (let pad = 0xec; data.length < DATA_CW; pad ^= 0xec ^ 0x11) data.push(pad);

  /* ---- Reed–Solomon over GF(256), primitive polynomial 0x11d ---- */
  const exp = new Array<number>(512);
  const log = new Array<number>(256).fill(0);
  for (let i = 0, x = 1; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  const mul = (a: number, b: number) => (a && b ? exp[log[a] + log[b]] : 0);

  // generator g(x) = Π (x − α^i), coefficients highest-degree first (monic)
  let gen = [1];
  for (let i = 0; i < EC_CW; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], exp[i]);
    }
    gen = next;
  }
  // remainder of data(x)·x^EC mod g(x)
  const ec = new Array<number>(EC_CW).fill(0);
  for (const b of data) {
    const factor = b ^ (ec.shift() as number);
    ec.push(0);
    if (factor) for (let i = 0; i < EC_CW; i++) ec[i] ^= mul(gen[i + 1], factor);
  }
  const codewords = data.concat(ec); // 44 codewords

  /* ---- matrix: function patterns, then data, then mask ---- */
  const m: boolean[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const fn: boolean[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    m[y][x] = dark;
    fn[y][x] = true;
  };

  for (let i = 0; i < SIZE; i++) {
    set(6, i, i % 2 === 0); // vertical timing
    set(i, 6, i % 2 === 0); // horizontal timing
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);
  // single alignment pattern for version 2 at (18, 18)
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      set(18 + dx, 18 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);

  // format info: BCH(15,5) of [EC level M = 00 | mask], XOR mask 0x5412
  const drawFormat = (mask: number) => {
    const dataBits = (0b00 << 3) | mask; // EC level M
    let rem = dataBits;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((dataBits << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, SIZE - 15 + i, bit(i));
    set(8, SIZE - 8, true); // dark module
  };
  drawFormat(0); // reserve the format cells before placing data

  // zig-zag data placement, two columns at a time, skipping column 6
  let bi = 0;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < SIZE; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? SIZE - 1 - vert : vert;
        if (!fn[y][x] && bi < codewords.length * 8) {
          m[y][x] = ((codewords[bi >> 3] >>> (7 - (bi & 7))) & 1) !== 0;
          bi++;
        }
      }
    }
  }

  /* ---- choose the mask with the lowest penalty score ---- */
  const MASKS: Array<(x: number, y: number) => boolean> = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (k: number) => {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x];
  };
  const penalty = () => {
    let score = 0;
    const lineRuns = (at: (i: number, j: number) => boolean) => {
      for (let i = 0; i < SIZE; i++) {
        let run = 1;
        let color = at(i, 0);
        for (let j = 1; j < SIZE; j++) {
          if (at(i, j) === color) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score++;
          } else {
            color = at(i, j);
            run = 1;
          }
        }
      }
    };
    lineRuns((i, j) => m[i][j]); // rows
    lineRuns((i, j) => m[j][i]); // columns
    for (let y = 0; y < SIZE - 1; y++)
      for (let x = 0; x < SIZE - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
      }
    // finder-lookalikes (1:1:3:1:1 with 4-module light run)
    const P1 = '00001011101';
    const P2 = '10111010000';
    const scan = (s: string) => {
      for (let i = 0; i + 11 <= s.length; i++) {
        const seg = s.slice(i, i + 11);
        if (seg === P1 || seg === P2) score += 40;
      }
    };
    for (let i = 0; i < SIZE; i++) {
      let row = '';
      let col = '';
      for (let j = 0; j < SIZE; j++) {
        row += m[i][j] ? '1' : '0';
        col += m[j][i] ? '1' : '0';
      }
      scan(row);
      scan(col);
    }
    let dark = 0;
    for (const r of m) for (const c of r) if (c) dark++;
    score += Math.floor(Math.abs((dark * 100) / (SIZE * SIZE) - 50) / 5) * 10;
    return score;
  };

  let best = 0;
  let bestScore = Infinity;
  for (let k = 0; k < 8; k++) {
    applyMask(k);
    drawFormat(k);
    const s = penalty();
    if (s < bestScore) {
      bestScore = s;
      best = k;
    }
    applyMask(k); // XOR mask is its own inverse
  }
  applyMask(best);
  drawFormat(best);
  return m;
}

/* ===============================================================
 * Procedural textures — painted with the 2D canvas API at 500 px
 * per inch of the 3.5in × 2in card.
 * ============================================================= */
const TEX_W = 1750;
const TEX_H = 1000;

function makeCtx(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d') as CanvasRenderingContext2D;
}

/** Shared card-stock base: paper wash, hairline inner border, accent rail. */
function paintCardBase(ctx: CanvasRenderingContext2D, accent: string) {
  // paper with the faintest top-light so the stock doesn't read flat
  const wash = ctx.createLinearGradient(0, 0, 0, TEX_H);
  wash.addColorStop(0, C.paperRaised);
  wash.addColorStop(0.4, C.paper);
  wash.addColorStop(1, C.paper);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // accent rail across the top — same language as Card.astro's ::before
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, TEX_W, 16);

  // hairline inner border
  ctx.strokeStyle = C.paperEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(34, 34, TEX_W - 68, TEX_H - 68, 48);
  ctx.stroke();
}

/** Energy-badge pip: filled disc with a paper ring, like the tag badges. */
function paintPip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(253, 249, 240, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function paintFront(): HTMLCanvasElement {
  const ctx = makeCtx(TEX_W, TEX_H);
  paintCardBase(ctx, C.orange);

  // "SG" monogram chip, top-right, tipped like the home-page wordmark
  ctx.save();
  ctx.translate(1520, 200);
  ctx.rotate((-5 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(26, 30, 24, 0.22)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = C.pine;
  ctx.beginPath();
  ctx.roundRect(-75, -75, 150, 150, 34);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = C.paper;
  ctx.font = `800 76px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SG', 0, 8);
  ctx.restore();

  // eyebrow
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.pineDeep;
  ctx.font = `500 40px ${FONT_MONO}`;
  ctx.letterSpacing = '7px';
  ctx.fillText('DEVELOPER · TINKERER · UTAH', 140, 402);
  ctx.letterSpacing = '0px';

  // name
  ctx.fillStyle = C.ink;
  ctx.font = `800 164px ${FONT_DISPLAY}`;
  ctx.fillText('Skyler Godfrey', 132, 568);

  // orange underline nub — echoes the section-heading rule
  ctx.fillStyle = C.orange;
  ctx.beginPath();
  ctx.roundRect(140, 606, 220, 12, 6);
  ctx.fill();

  // tagline
  ctx.fillStyle = C.inkSoft;
  ctx.font = `500 56px ${FONT_BODY}`;
  ctx.fillText('Playful software, one card at a time.', 140, 712);

  // bottom row: energy pips + collector number
  paintPip(ctx, 172, 872, 30, C.orange);
  paintPip(ctx, 252, 872, 30, C.pine);
  paintPip(ctx, 332, 872, 30, C.sky);

  ctx.fillStyle = C.inkMuted;
  ctx.font = `500 36px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.letterSpacing = '4px';
  ctx.fillText('№ 001/001 · FIRST EDITION', TEX_W - 140, 886);
  ctx.letterSpacing = '0px';

  return ctx.canvas;
}

function paintBack(): HTMLCanvasElement {
  const ctx = makeCtx(TEX_W, TEX_H);
  paintCardBase(ctx, C.pine);

  // left column — contact
  ctx.textAlign = 'left';
  ctx.fillStyle = C.orangeDeep;
  ctx.font = `500 40px ${FONT_MONO}`;
  ctx.letterSpacing = '7px';
  ctx.fillText('SAY HELLO', 140, 268);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = C.ink;
  ctx.font = `700 92px ${FONT_DISPLAY}`;
  ctx.fillText('Flip me over,', 134, 398);
  ctx.fillText('deal me in.', 134, 508);

  const lines = [
    'godfrey4763@gmail.com',
    'github.com/SkylerGodfrey',
    'skylergodfrey.com',
  ];
  ctx.font = `500 47px ${FONT_MONO}`;
  lines.forEach((line, i) => {
    const y = 632 + i * 92;
    // small orange pip bullet
    ctx.fillStyle = C.orange;
    ctx.beginPath();
    ctx.moveTo(148, y - 30);
    ctx.lineTo(166, y - 14);
    ctx.lineTo(148, y + 2);
    ctx.lineTo(130, y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(line, 196, y);
  });

  // QR panel, right side — raised paper well with a quiet zone
  const modules = qrModules('https://skylergodfrey.com');
  const count = modules.length; // 25
  const modulePx = 18;
  const quiet = modulePx * 2.5;
  const qrSize = count * modulePx;
  const panel = qrSize + quiet * 2;
  const px = TEX_W - 150 - panel;
  const py = (TEX_H - panel) / 2 - 20;

  ctx.save();
  ctx.shadowColor = 'rgba(26, 30, 24, 0.16)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.paperRaised;
  ctx.beginPath();
  ctx.roundRect(px, py, panel, panel, 30);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.paperEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, panel, panel, 30);
  ctx.stroke();

  ctx.fillStyle = C.ink;
  for (let y = 0; y < count; y++)
    for (let x = 0; x < count; x++)
      if (modules[y][x])
        ctx.fillRect(px + quiet + x * modulePx, py + quiet + y * modulePx, modulePx, modulePx);

  ctx.fillStyle = C.inkMuted;
  ctx.font = `500 34px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('SCAN · SKYLERGODFREY.COM', px + panel / 2, py + panel + 66);
  ctx.letterSpacing = '0px';

  return ctx.canvas;
}

/** Soft radial blob used for the contact shadow under the card. */
function paintShadowBlob(): HTMLCanvasElement {
  const size = 256;
  const ctx = makeCtx(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(26, 30, 24, 0.34)');
  g.addColorStop(0.55, 'rgba(26, 30, 24, 0.12)');
  g.addColorStop(1, 'rgba(26, 30, 24, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return ctx.canvas;
}

/* ===============================================================
 * Geometry helpers
 * ============================================================= */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Remap a centered ShapeGeometry's UVs from shape-space to 0..1. */
function normalizeUvs(geo: THREE.BufferGeometry, w: number, h: number) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
}

/* ===============================================================
 * Mount
 * ============================================================= */
export interface BusinessCardHandle {
  destroy(): void;
}

export async function mountBusinessCard(container: HTMLElement): Promise<BusinessCardHandle | null> {
  // Fonts must be resolvable before the canvas textures are painted, or the
  // card renders in fallback faces. All three families are self-hosted, so
  // this settles fast; load() never rejects for unknown faces.
  try {
    await Promise.all([
      document.fonts.load(`800 100px ${FONT_DISPLAY}`),
      document.fonts.load(`700 100px ${FONT_DISPLAY}`),
      document.fonts.load(`500 100px ${FONT_BODY}`),
      document.fonts.load(`500 100px ${FONT_MONO}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* draw with fallbacks rather than not at all */
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    // No WebGL: leave the page's static fallback content in place.
    container.dataset.webgl = 'unavailable';
    return null;
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  const onMotionPref = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
  };
  reducedMotionQuery.addEventListener('change', onMotionPref);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0); // page paper + grain show through
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none'; // pointer events own the gesture
  canvas.style.cursor = 'grab';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const BASE_CAM_Z = 6.4;
  camera.position.set(0, 0.15, BASE_CAM_Z);
  camera.lookAt(0, 0, 0);

  /* ---- lighting: soft studio for matte stock ---- */
  // warm wraparound base light so the paper never goes muddy
  scene.add(new THREE.HemisphereLight(0xfff9ec, 0xd8cdb4, 1.05));
  // warm key, high and to the left — gives the face its gentle sheen
  const key = new THREE.DirectionalLight(0xfff2df, 1.5);
  key.position.set(-2.2, 3.4, 4.2);
  scene.add(key);
  // cool sky-blue fill from the lower right, very quiet
  const fill = new THREE.DirectionalLight(0xa8cbe4, 0.5);
  fill.position.set(3, -1.4, 2.4);
  scene.add(fill);
  // rim from behind so the card edge catches light mid-flip
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(0.5, 1.2, -4);
  scene.add(rim);

  /* ---- card ---- */
  const CARD_W = 3.5;
  const CARD_H = 2;
  const CARD_T = 0.04; // credit-card-ish stock
  const CARD_R = 0.15;

  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const bodyGeo = track(
    new THREE.ExtrudeGeometry(roundedRectShape(CARD_W, CARD_H, CARD_R), {
      depth: CARD_T,
      bevelEnabled: false,
      curveSegments: 32,
    }),
  );
  bodyGeo.translate(0, 0, -CARD_T / 2);
  const bodyMat = track(
    new THREE.MeshStandardMaterial({ color: 0xefe7d3, roughness: 0.95, metalness: 0 }),
  );
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const faceTexture = (cv: HTMLCanvasElement) => {
    const tex = track(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };
  const faceMaterial = (cv: HTMLCanvasElement) =>
    track(
      new THREE.MeshStandardMaterial({
        map: faceTexture(cv),
        roughness: 0.8, // matte stock with just a hint of sheen from the key
        metalness: 0,
      }),
    );

  // Printed faces are slightly inset planes floating a hair off the body, so
  // the extrude's cap peeks out as the card's cut edge and UVs stay simple.
  const FACE_INSET = 0.02;
  const faceGeo = track(
    new THREE.ShapeGeometry(
      roundedRectShape(CARD_W - FACE_INSET, CARD_H - FACE_INSET, CARD_R - FACE_INSET / 2),
      32,
    ),
  );
  normalizeUvs(faceGeo, CARD_W - FACE_INSET, CARD_H - FACE_INSET);

  const front = new THREE.Mesh(faceGeo, faceMaterial(paintFront()));
  front.position.z = CARD_T / 2 + 0.0015;
  const back = new THREE.Mesh(faceGeo, faceMaterial(paintBack()));
  back.rotation.y = Math.PI;
  back.position.z = -(CARD_T / 2 + 0.0015);

  // floatGroup owns idle bob/sway; spinGroup owns the user's rotation.
  const spinGroup = new THREE.Group();
  spinGroup.add(body, front, back);
  const floatGroup = new THREE.Group();
  floatGroup.add(spinGroup);
  scene.add(floatGroup);
  // TEMP DEBUG
  (window as any).__cardDebug = { scene, camera, spinGroup, floatGroup, front, back, body };

  /* ---- contact shadow ---- */
  const shadowTex = faceTexture(paintShadowBlob());
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(4.6, 3.2)), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.62;
  scene.add(shadow);

  /* ---- interaction state ---- */
  const YAW_PER_PX = 0.0075;
  const PITCH_PER_PX = 0.006;
  const PITCH_MAX = 1.0;

  let yaw = 0;
  let pitch = 0;
  let yawVel = 0; // rad/ms, carries after release
  let dragging = false;
  let resetting = false;
  let resetTargetYaw = 0;
  let idleWeight = 1; // idle motion eases out while the user is in control
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastMoveTime = 0;
  let dragDistance = 0;
  let lastTapTime = 0;

  const resetOrientation = () => {
    resetTargetYaw = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
    if (reducedMotion) {
      yaw = resetTargetYaw;
      pitch = 0;
      yawVel = 0;
    } else {
      resetting = true;
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    dragging = true;
    resetting = false;
    yawVel = 0;
    dragDistance = 0;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastMoveTime = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || !e.isPrimary) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    dragDistance += Math.abs(dx) + Math.abs(dy);

    yaw += dx * YAW_PER_PX;
    pitch = THREE.MathUtils.clamp(pitch + dy * PITCH_PER_PX, -PITCH_MAX, PITCH_MAX);

    // instantaneous velocity, lightly smoothed so release feels intentional
    const now = performance.now();
    const dt = Math.max(now - lastMoveTime, 1);
    lastMoveTime = now;
    yawVel = THREE.MathUtils.lerp(yawVel, (dx * YAW_PER_PX) / dt, 0.35);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging || !e.isPrimary) return;
    dragging = false;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

    // stale velocity (finger paused before lifting) shouldn't fling the card
    if (performance.now() - lastMoveTime > 90) yawVel = 0;
    if (reducedMotion) yawVel = 0;

    // double-tap/-click (two quick, nearly still releases) resets the card
    if (dragDistance < 10) {
      const now = performance.now();
      if (now - lastTapTime < 350) {
        resetOrientation();
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  /* ---- sizing ---- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // back the camera off on narrow screens so the flip never clips
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitWidth = (CARD_W + 1.1) / (2 * Math.tan(halfFov) * camera.aspect);
    camera.position.z = Math.max(BASE_CAM_Z, fitWidth);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ---- frame loop ---- */
  const YAW_FRICTION = 0.0022; // exponential decay rate (1/ms)
  const PITCH_RETURN = 0.005; // spring-back rate toward level (1/ms)
  const RESET_RATE = 0.008;

  let raf = 0;
  let prev = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(now - prev, 50); // clamp tab-switch jumps
    prev = now;
    const t = now / 1000;

    if (!dragging) {
      if (resetting) {
        const k = 1 - Math.exp(-dt * RESET_RATE);
        yaw = THREE.MathUtils.lerp(yaw, resetTargetYaw, k);
        pitch = THREE.MathUtils.lerp(pitch, 0, k);
        yawVel = 0;
        if (Math.abs(yaw - resetTargetYaw) < 0.002 && Math.abs(pitch) < 0.002) {
          yaw = resetTargetYaw;
          pitch = 0;
          resetting = false;
        }
      } else {
        yaw += yawVel * dt;
        yawVel *= Math.exp(-dt * YAW_FRICTION);
        pitch = THREE.MathUtils.lerp(pitch, 0, 1 - Math.exp(-dt * PITCH_RETURN));
      }
    }

    spinGroup.rotation.y = yaw;
    spinGroup.rotation.x = pitch;

    // idle float: fades out while the user (or inertia) is in charge
    const active = dragging || resetting || Math.abs(yawVel) > 0.00004;
    const idleTarget = reducedMotion ? 0 : active ? 0 : 1;
    idleWeight = THREE.MathUtils.lerp(idleWeight, idleTarget, 1 - Math.exp(-dt * 0.002));

    const bob = Math.sin(t * 0.9) * 0.05 * idleWeight;
    floatGroup.position.y = bob;
    floatGroup.rotation.z = Math.sin(t * 0.55) * 0.02 * idleWeight;
    floatGroup.rotation.x = Math.sin(t * 0.7) * 0.022 * idleWeight;
    floatGroup.rotation.y = Math.sin(t * 0.42) * 0.055 * idleWeight;

    // contact shadow breathes opposite the bob
    const lift = bob + 0.05;
    shadowMat.opacity = 0.55 - lift * 2.2;
    const shadowScale = 1 + lift * 0.55;
    shadow.scale.setScalar(shadowScale);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      reducedMotionQuery.removeEventListener('change', onMotionPref);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
