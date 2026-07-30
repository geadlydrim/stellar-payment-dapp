/**
 * Procedural pixel-art sprites for Stellar4.
 * Char grids bake into offscreen canvases; `T` is the tintable metal/magic color.
 */

import { TIER_COLORS, type Tier, type WeaponType } from '@/lib/game';

export type Palette = Record<string, string>;

const TRANSPARENT = '.';

export function bakeSprite(
  rows: string[],
  palette: Palette
): HTMLCanvasElement {
  const trimmed = trimEmptyRows(rows);
  const h = trimmed.length;
  const w = Math.max(1, ...trimmed.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = trimmed[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === TRANSPARENT || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Drop leading/trailing fully-empty rows so foot-align uses real sprite bounds. */
function trimEmptyRows(rows: string[]): string[] {
  const isEmpty = (r: string) =>
    ![...r].some((ch) => ch !== TRANSPARENT && ch !== ' ');
  let start = 0;
  let end = rows.length - 1;
  while (start <= end && isEmpty(rows[start]!)) start++;
  while (end >= start && isEmpty(rows[end]!)) end--;
  if (start > end) return ['.'];
  return rows.slice(start, end + 1);
}

/** Rebake with a new tint color for the `T` key (blade / magic). */
export function bakeTinted(
  rows: string[],
  base: Palette,
  tint: string
): HTMLCanvasElement {
  return bakeSprite(rows, { ...base, T: tint });
}

// ── Palettes ──────────────────────────────────────────────────────────

export const HERO_PAL: Palette = {
  K: '#1a1a22', // outline / visor
  S: '#f0d5b8', // skin
  A: '#3dd9b0', // armor mint
  D: '#1f8a72', // armor dark
  C: '#ff8c6b', // cape / accent
  B: '#2a3540', // boots
  E: '#ffe08a', // eye glow
};

export const DUMMY_PAL: Palette = {
  K: '#2a1a10',
  W: '#c4a574', // wood / burlap
  D: '#8b6914', // dark wood
  S: '#e8d5a3', // straw
  X: '#5c4030', // stitch
  H: '#ffffff', // hit flash
};

export const WEAPON_PAL: Palette = {
  K: '#1a1410',
  G: '#6b4423', // grip
  W: '#8b6914', // wood
  L: '#c0a060', // leather wrap
  M: '#d8d8e0', // metal highlight
  T: '#9ca3af', // tinted (overridden)
  O: '#ffffff', // orb core
};

export const FX_PAL: Palette = {
  T: '#ffffff',
  A: '#ffffffaa',
  B: '#ffffff55',
};

// ── Hero frames (14×20), facing right ─────────────────────────────────

export const HERO_IDLE: string[][] = [
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '...DSSSD......',
    '...D.D.D......',
    '...B...B......',
    '...B...B......',
    '..BB...BB.....',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '...DSSSD......',
    '...D.D.D......',
    '...B...B......',
    '...B...B......',
    '..BB...BB.....',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
];

// Idle frame 2 — slight cape flutter / bob
HERO_IDLE[1] = [
  '..............',
  '....KKKK......',
  '...KAEEAK.....',
  '...KSSSSK.....',
  '....KSSK......',
  '....DAAAD.....',
  '...DAAAAAAD...',
  '...DACCCAAD...',
  '...DAAAAAAD...',
  '....DAAAD.....',
  '....DSSSD.....',
  '....D.D.D.....',
  '....B...B.....',
  '....B...B.....',
  '...BB...BB....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
];

export const HERO_RUN: string[][] = [
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '...DSSD.......',
    '..D..D........',
    '.B....B.......',
    'B......BB.....',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '...DSSSD......',
    '...D.D.D......',
    '...B...B......',
    '..BB...B......',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '....DSSD......',
    '.......D.D....',
    '......B....B..',
    '.....BB......B',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
  [
    '..............',
    '....KKKK......',
    '...KAEEAK.....',
    '...KSSSSK.....',
    '....KSSK......',
    '...DAAAD......',
    '..DAAAAAAD....',
    '..DACCAAD.....',
    '..DAAAAAAD....',
    '...DAAAD......',
    '...DSSSD......',
    '...D.D.D......',
    '...B...B......',
    '..B...BB......',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
    '..............',
  ],
];

// ── Dummy (14×22) ─────────────────────────────────────────────────────

export const DUMMY_IDLE: string[] = [
  '..............',
  '....SSSS......',
  '...SWWWWS.....',
  '...KWWWWK.....',
  '...WXWWXW.....',
  '...WXXXXW.....',
  '...WXWWXW.....',
  '...KWWWWK.....',
  '....WWWW......',
  '...WWWWWW.....',
  '..WWDDDDWW....',
  '..WDDDDDDW....',
  '..WDDDDDDW....',
  '..WDDDDDDW....',
  '..WWDDDDWW....',
  '...WDDDDW.....',
  '....WDDW......',
  '.....DD.......',
  '.....DD.......',
  '.....DD.......',
  '....DDDD......',
  '...DSSSSD.....',
];

export const DUMMY_HIT: string[] = [
  '..............',
  '....HHHH......',
  '...SHHHHS.....',
  '...KHHHHK.....',
  '...HXHHXH.....',
  '...HXXXXH.....',
  '...HXHHXH.....',
  '...KHHHHK.....',
  '....HHHH......',
  '...HHHHHH.....',
  '..HHDDDDHH....',
  '..HDDDDDDH....',
  '..HDDDDDDH....',
  '..HDDDDDDH....',
  '..HHDDDDHH....',
  '...HDDDDH.....',
  '....HDDH......',
  '.....DD.......',
  '.....DD.......',
  '.....DD.......',
  '....DDDD......',
  '...DSSSSD.....',
];

// ── Weapons (tint key T) ──────────────────────────────────────────────

export const WEAPON_SPRITES: Record<WeaponType, string[]> = {
  sword: [
    '...M....',
    '...T....',
    '...T....',
    '...T....',
    '...T....',
    '...T....',
    '..LTL...',
    '...G....',
    '...G....',
    '...K....',
  ],
  dagger: [
    '..M...',
    '..T...',
    '..T...',
    '..T...',
    '.LTL..',
    '..G...',
    '..K...',
  ],
  // Limbs (T) away from hero (+X), string (W) toward hero when facing right
  bow: [
    '.....T..',
    '....W.T.',
    '....W..T',
    '....W..T',
    '....W..T',
    '....W.T.',
    '.....T..',
  ],
  staff: [
    '...OT...',
    '..TOTO..',
    '...OT...',
    '...W....',
    '...W....',
    '...W....',
    '...W....',
    '...W....',
    '...G....',
    '...K....',
  ],
  spear: [
    '....M.....',
    '...TTT....',
    '....T.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....W.....',
    '....G.....',
    '....K.....',
  ],
};

/**
 * Grip pivot in sprite pixel coords (hand holds here).
 * tipLen = distance from grip to tip along -Y (used for trails / thrust).
 * Sprite tip points up (-Y); rotate positive to tip forward (+X after facing flip).
 */
export const WEAPON_GRIP: Record<
  WeaponType,
  { x: number; y: number; tipLen: number }
> = {
  sword: { x: 3.5, y: 8, tipLen: 8 },
  dagger: { x: 2.5, y: 5.5, tipLen: 5.5 },
  bow: { x: 4, y: 3.5, tipLen: 0 },
  staff: { x: 3.5, y: 8.5, tipLen: 8.5 },
  spear: { x: 4.5, y: 8.5, tipLen: 8.5 },
};

/** Rest angle (rad): 0 = tip up; positive = tip tilts forward away from hero. */
export const WEAPON_REST_ANGLE: Record<WeaponType, number> = {
  sword: 0.55,
  dagger: 0.75,
  bow: 0,
  staff: 0.2,
  spear: 1.45, // near-horizontal, tip forward
};

export const ARROW_SPRITE: string[] = [
  '........',
  'MTTTTTL.',
  '........',
];

export const BOLT_SPRITE: string[] = [
  '.....',
  '.OTO.',
  'OTTTO',
  '.OTO.',
  '.....',
];

export const SPARK_SPRITE: string[] = [
  '...',
  '.T.',
  'TOT',
  '.T.',
  '...',
];

export const DUST_SPRITE: string[] = [
  '....',
  '.BB.',
  'B..B',
  '....',
];

export const CHARM_SPRITE: string[] = [
  '........',
  '...TT...',
  '..TOTT..',
  '.TOTOTO.',
  '..TOTT..',
  '...TT...',
  '........',
];

// ── Cache ─────────────────────────────────────────────────────────────

type CacheKey = string;
const cache = new Map<CacheKey, HTMLCanvasElement>();

function cached(
  key: CacheKey,
  factory: () => HTMLCanvasElement
): HTMLCanvasElement {
  let s = cache.get(key);
  if (!s) {
    s = factory();
    cache.set(key, s);
  }
  return s;
}

export function getHeroFrame(kind: 'idle' | 'run', frame: number): HTMLCanvasElement {
  const frames = kind === 'idle' ? HERO_IDLE : HERO_RUN;
  const i = ((frame % frames.length) + frames.length) % frames.length;
  return cached(`hero-${kind}-${i}`, () => bakeSprite(frames[i]!, HERO_PAL));
}

export function getDummyFrame(hit: boolean): HTMLCanvasElement {
  return cached(hit ? 'dummy-hit' : 'dummy-idle', () =>
    bakeSprite(hit ? DUMMY_HIT : DUMMY_IDLE, DUMMY_PAL)
  );
}

export function getWeaponSprite(
  type: WeaponType,
  tier: Tier
): HTMLCanvasElement {
  const tint = TIER_COLORS[tier];
  return cached(`weapon-${type}-${tier}`, () =>
    bakeTinted(WEAPON_SPRITES[type], WEAPON_PAL, tint)
  );
}

export function getArrowSprite(tier: Tier): HTMLCanvasElement {
  return cached(`arrow-${tier}`, () =>
    bakeTinted(ARROW_SPRITE, WEAPON_PAL, TIER_COLORS[tier])
  );
}

export function getBoltSprite(tier: Tier): HTMLCanvasElement {
  return cached(`bolt-${tier}`, () =>
    bakeTinted(BOLT_SPRITE, { ...WEAPON_PAL, O: '#ffffff' }, TIER_COLORS[tier])
  );
}

export function getSpark(tier: Tier): HTMLCanvasElement {
  return cached(`spark-${tier}`, () =>
    bakeTinted(SPARK_SPRITE, FX_PAL, TIER_COLORS[tier])
  );
}

export function getDust(): HTMLCanvasElement {
  return cached('dust', () => bakeSprite(DUST_SPRITE, { B: '#8a7a60' }));
}

export function getCharmSprite(): HTMLCanvasElement {
  return cached('charm', () =>
    bakeTinted(CHARM_SPRITE, FX_PAL, '#f472b6')
  );
}

/** Data URL for UI icons (inventory). Client-only. */
const iconUrlCache = new Map<string, string>();

export function weaponIconDataUrl(type: WeaponType, tier: Tier): string {
  const key = `icon-${type}-${tier}`;
  const hit = iconUrlCache.get(key);
  if (hit) return hit;
  const sprite = getWeaponSprite(type, tier);
  const pad = 2;
  const scale = 4;
  const out = document.createElement('canvas');
  out.width = (sprite.width + pad * 2) * scale;
  out.height = (sprite.height + pad * 2) * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprite,
    pad * scale,
    pad * scale,
    sprite.width * scale,
    sprite.height * scale
  );
  const url = out.toDataURL('image/png');
  iconUrlCache.set(key, url);
  return url;
}

export function charmIconDataUrl(): string {
  const key = 'icon-charm';
  const hit = iconUrlCache.get(key);
  if (hit) return hit;
  const sprite = getCharmSprite();
  const scale = 4;
  const out = document.createElement('canvas');
  out.width = sprite.width * scale;
  out.height = sprite.height * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, out.width, out.height);
  const url = out.toDataURL('image/png');
  iconUrlCache.set(key, url);
  return url;
}

/** Draw a sprite centered at (cx,cy), optionally flipped and rotated. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  cx: number,
  cy: number,
  opts: { flipX?: boolean; angle?: number; alpha?: number; scale?: number } = {}
): void {
  const s = opts.scale ?? 1;
  const w = sprite.width * s;
  const h = sprite.height * s;
  ctx.save();
  ctx.translate(cx, cy);
  if (opts.flipX) ctx.scale(-1, 1);
  if (opts.angle) ctx.rotate(opts.angle);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * Draw weapon with grip at origin. Call after translating to hand and
 * applying facing flip. Angle 0 = tip up; positive = tip forward (+X).
 */
export function drawWeaponAtGrip(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  type: WeaponType,
  scale = 1,
  alpha = 1
): void {
  const grip = WEAPON_GRIP[type];
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprite,
    -grip.x * scale,
    -grip.y * scale,
    sprite.width * scale,
    sprite.height * scale
  );
  ctx.restore();
}
