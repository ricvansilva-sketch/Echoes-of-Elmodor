import { CharacterSheetId, FacingDir, PortraitMood } from './tacticsEngine';

export const ASSET_URLS = {
  battleMap: '/src/assets/images/elmodor_watchtower_map_v2_1795457649119.jpg',
  titleKeyArt: '/src/assets/images/title_watchtower_keyart_1795455715238.jpg',
  bridgeProps: '/src/assets/images/bridge_occluder_props_1795455714231.jpg',
  cutinBackdrop: '/src/assets/images/duel_courtyard_backdrop_1795463985440.jpg',
  duelScenes: {
    aryon_vs_panther: '/src/assets/images/duel_aryon_vs_panther_1795465047276.jpg',
    aiori_vs_panther: '/src/assets/images/duel_aiori_vs_panther_1795465063159.jpg',
  },
  glamourPortraits: {
    aiori: '/src/assets/images/portrait_aiori_glamour_1795465042172.jpg',
    aryon: '/src/assets/images/portrait_aryon_glamour_1795465044533.jpg',
    panther: '/src/assets/images/portrait_panther_glamour_1795465042652.jpg',
  } as Record<CharacterSheetId, string>,
  sheets: {
    aiori: '/assets/aistudio/Gemini_Generated_Image_4gi89t4gi89t4gi8_24a0c4f1.jpg',
    aryon: '/assets/aistudio/Gemini_Generated_Image_4gi89t4gi89t4gi8__1__d9eb0a31.jpg',
    panther: '/src/assets/images/black_panther_quadruped_1795457647316.jpg',
  } as Record<CharacterSheetId, string>,
  cutinSheets: {
    aiori: '/src/assets/images/cutin_aiori_poses_1795461496571.jpg',
    aryon: '/src/assets/images/cutin_aryon_poses_1795461497105.jpg',
    panther: '/src/assets/images/cutin_panther_poses_1795461495438.jpg',
    impact: '/src/assets/images/cutin_impact_poses_1795461495975.jpg',
  },
  glamourPanels: {
    aioriGreatsword: '/src/assets/images/cutin_aiori_greatsword_1795470272508.jpg',
    aioriFerunium: '/src/assets/images/cutin_aiori_ferunium_1795470273405.jpg',
    aioriAuruinum: '/src/assets/images/cutin_aiori_auruinum_1795470272065.jpg',
    aioriGuard: '/src/assets/images/cutin_aiori_sword_guard_1795470272624.jpg',
    aioriHurt: '/src/assets/images/cutin_aiori_hurt_right_1795470309172.jpg',
    aryonBloodRush: '/src/assets/images/cutin_aryon_blood_rush_1795470274252.jpg',
    aryonGlobus: '/src/assets/images/cutin_aryon_globus_1795470274867.jpg',
    aryonChamus: '/src/assets/images/cutin_aryon_chamus_1795470274909.jpg',
    aryonShield: '/src/assets/images/defend_aryon_escudo_right_1795468091799.jpg',
    aryonHurt: '/src/assets/images/cutin_aryon_hurt_speed_1795470274083.jpg',
    pantherClaws: '/src/assets/images/cutin_shadow_claws_1795470272074.jpg',
    pantherPounce: '/src/assets/images/cutin_shadow_pounce_1795470271985.jpg',
    pantherGuard: '/src/assets/images/cutin_shadow_veil_speed_1795470271830.jpg',
    pantherHurt: '/src/assets/images/cutin_shadow_hurt_speed_1795470272903.jpg',
  },
  fanfare: {
    victoryAryon: '/src/assets/images/victory_aryon_smirk_1795468090649.jpg',
    victoryAiori: '/src/assets/images/victory_aiori_sheathe_1795468090157.jpg',
    defeatFallen: '/src/assets/images/defeat_heroes_fallen_1795468091398.jpg',
  },
};

export interface CutinCharacterPoses {
  /** Close bottom-left over-the-shoulder view looking toward upper-right enemy */
  overShoulder: string;
  /** Battle-ready standing pose facing left for fallback duel view */
  duelReadyLeft: string;
  /** Default chroma-keyed frame-breaking glamour comic panel — ALWAYS facing right */
  attackGlamour: string;
  /** Ability-specific attack glamour panels keyed by skill.id — ALWAYS facing right */
  attackGlamourBySkill: Record<string, string>;
  /** Chroma-keyed frame-breaking defensive block/shield/evade glamour panel — ALWAYS facing right, generic impact (no weapons) */
  guardGlamour: string;
  /** Chroma-keyed hit-impact glamour panel — ALWAYS facing right, generic impact (no weapons) */
  hurtGlamour: string;
  /** Recoiling / taking damage cel-shaded figure */
  hurtLeft: string;
}

export interface ProcessedCharacterAssets {
  /** Full-bleed atmospheric painted portrait with zero cutout artifacts */
  glamourPortrait: string;
  portraits: Record<PortraitMood, string>;
  sprites: Record<FacingDir, HTMLCanvasElement>;
  cutins: CutinCharacterPoses;
}

export interface BridgePropAssets {
  wall: HTMLCanvasElement;
  pillar: HTMLCanvasElement;
  pine: HTMLCanvasElement;
  boulder: HTMLCanvasElement;
}

export interface LoadedGameAssets {
  battleMap: HTMLImageElement;
  cutinBackdrop: string;
  duelScenes: {
    aryon_vs_panther: string;
    aiori_vs_panther: string;
  };
  fanfare: {
    victoryAryon: string;
    victoryAiori: string;
    defeatFallen: string;
  };
  characters: Record<CharacterSheetId, ProcessedCharacterAssets>;
  props: BridgePropAssets;
}

interface ExtractOptions {
  maxOutputDim?: number;
  flipX?: boolean;
  /** Normalized sub-rectangles inside the cropped box to blank out before keying (removes adjacent pose bleed) */
  excludeLocalRects?: [number, number, number, number][];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${src} (${String(err)})`));
    img.src = src;
  });
}

/**
 * Keys pure neon chroma-green (#00FF00) out of skewed comic-frame glamour panels,
 * clears trapped green pockets between pop-out flames/sparks, applies a 1px morphological
 * fringe erosion on green-contaminated border pixels, and runs a 3px green-spill neutralizer
 * so dark comic ink lines and warm gold/crimson sparks have zero lime artifacts.
 */
function extractChromaGreenPanel(img: HTMLImageElement, maxOutputDim = 1120): string {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const scale = Math.min(1, maxOutputDim / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;

  // Pass 1: Remove neon chroma-green background + trapped chroma-green pockets inside pop-out flames.
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxRB = r > b ? r : b;
    const excess = g - maxRB;

    if (g > 96 && excess > 34) {
      data[p + 3] = 0;
    } else if (g > 82 && excess > 16) {
      const alphaFrac = Math.max(0, Math.min(1, (34 - excess) / 18));
      data[p + 3] = Math.round(alphaFrac * 255);
      data[p + 1] = Math.min(g, maxRB);
    }
  }

  // Pass 2: 1px morphological border cleanup — erode semi-transparent / green-tainted 1px JPEG fringe
  const alphaCopy = new Uint8Array(total);
  for (let i = 0; i < total; i++) alphaCopy[i] = data[i * 4 + 3];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const a = alphaCopy[idx];
      if (a === 0) continue;
      const touchesZero =
        alphaCopy[idx - 1] === 0 ||
        alphaCopy[idx + 1] === 0 ||
        alphaCopy[idx - w] === 0 ||
        alphaCopy[idx + w] === 0;
      if (!touchesZero) continue;

      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxRB = r > b ? r : b;
      if (g > maxRB + 6 || a < 170) {
        data[p + 3] = 0;
      } else {
        // Crisp anti-aliased edge feather
        data[p + 3] = Math.round(a * 0.78);
      }
    }
  }

  // Pass 3: 2-ring despill pass around all transparent edges so zero lime glow survives on ink/sparks
  for (let ring = 0; ring < 2; ring++) {
    const nearEdge = new Uint8Array(total);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] === 0) continue;
        if (
          data[(idx - 1) * 4 + 3] < 220 ||
          data[(idx + 1) * 4 + 3] < 220 ||
          data[(idx - w) * 4 + 3] < 220 ||
          data[(idx + w) * 4 + 3] < 220
        ) {
          nearEdge[idx] = 1;
        }
      }
    }
    for (let i = 0; i < total; i++) {
      if (!nearEdge[i]) continue;
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxRB = r > b ? r : b;
      if (g > maxRB) {
        data[p + 1] = Math.round((maxRB + Math.min(r, b) * 0.2) / 1.2);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Tightly trim transparent outer margin so layout scales cleanly
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return work.toDataURL('image/png');

  const pad = 2;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);

  const maxDim = 920;
  const outScale = Math.min(1, maxDim / Math.max(cw, ch));
  const outW = Math.max(8, Math.round(cw * outScale));
  const outH = Math.max(8, Math.round(ch * outScale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  octx.drawImage(work, cx, cy, cw, ch, 0, 0, outW, outH);
  return out.toDataURL('image/png');
}

/**
 * Crops a normalized sub-region from an image, optionally masks adjacent pose overlaps,
 * removes connected white background via border BFS flood-fill (preserving interior white
 * hair/fangs behind dark ink outlines), softens 1px JPEG fringe, and tightly trims bounds.
 */
function extractKeyedSprite(
  img: HTMLImageElement,
  nx: number,
  ny: number,
  nw: number,
  nh: number,
  opts: ExtractOptions | number = 220
): HTMLCanvasElement {
  const options: ExtractOptions = typeof opts === 'number' ? { maxOutputDim: opts } : opts;
  const maxOutputDim = options.maxOutputDim ?? 220;

  const sx = Math.floor(img.naturalWidth * nx);
  const sy = Math.floor(img.naturalHeight * ny);
  const sw = Math.max(4, Math.floor(img.naturalWidth * nw));
  const sh = Math.max(4, Math.floor(img.naturalHeight * nh));

  const scale = Math.min(1, maxOutputDim / Math.max(sw, sh));
  const w = Math.max(4, Math.round(sw * scale));
  const h = Math.max(4, Math.round(sh * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  if (options.excludeLocalRects) {
    ctx.fillStyle = '#ffffff';
    for (const [ex, ey, ew, eh] of options.excludeLocalRects) {
      ctx.fillRect(
        Math.floor(ex * w),
        Math.floor(ey * h),
        Math.ceil(ew * w),
        Math.ceil(eh * h)
      );
    }
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isNearWhite = (idx: number, minLum: number, maxChroma: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    return minC >= minLum && maxC - minC <= maxChroma;
  };

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    if (!isNearWhite(idx, 214, 34)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x);
    enqueue((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    enqueue(y * w);
    enqueue(y * w + (w - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx - x) / w;

    if (x > 0) enqueue(idx - 1);
    if (x < w - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - w);
    if (y < h - 1) enqueue(idx + w);
  }

  // 1px anti-alias de-fringe pass on pixels bordering transparent background
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const p = idx * 4;
      if (data[p + 3] === 0) continue;
      const hasTransNeighbor =
        data[(idx - 1) * 4 + 3] === 0 ||
        data[(idx + 1) * 4 + 3] === 0 ||
        data[(idx - w) * 4 + 3] === 0 ||
        data[(idx + w) * 4 + 3] === 0;
      if (hasTransNeighbor) {
        const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
        if (lum > 195) {
          data[p + 3] = Math.round(((255 - lum) / 60) * 180);
        }
      }
    }
  }

  // Remove disconnected neighbor-pose fragments touching the outer crop borders
  // while keeping the primary subject and interior floating effects (e.g. sparks) intact.
  const compIds = new Int32Array(total).fill(-1);
  const compSizes: number[] = [];
  const compTouchesBorder: boolean[] = [];
  let compCount = 0;

  for (let i = 0; i < total; i++) {
    if (compIds[i] !== -1 || data[i * 4 + 3] <= 20) continue;
    const cid = compCount++;
    let size = 0;
    let touchesEdge = false;
    let qh = 0;
    let qt = 0;
    compIds[i] = cid;
    queue[qt++] = i;

    while (qh < qt) {
      const idx = queue[qh++];
      size++;
      const x = idx % w;
      const y = (idx - x) / w;
      if (x <= 1 || x >= w - 2 || y <= 1 || y >= h - 2) touchesEdge = true;

      if (x > 0 && compIds[idx - 1] === -1 && data[(idx - 1) * 4 + 3] > 20) {
        compIds[idx - 1] = cid;
        queue[qt++] = idx - 1;
      }
      if (x < w - 1 && compIds[idx + 1] === -1 && data[(idx + 1) * 4 + 3] > 20) {
        compIds[idx + 1] = cid;
        queue[qt++] = idx + 1;
      }
      if (y > 0 && compIds[idx - w] === -1 && data[(idx - w) * 4 + 3] > 20) {
        compIds[idx - w] = cid;
        queue[qt++] = idx - w;
      }
      if (y < h - 1 && compIds[idx + w] === -1 && data[(idx + w) * 4 + 3] > 20) {
        compIds[idx + w] = cid;
        queue[qt++] = idx + w;
      }
    }
    compSizes.push(size);
    compTouchesBorder.push(touchesEdge);
  }

  let largestComp = 0;
  for (let c = 1; c < compCount; c++) {
    if (compSizes[c] > compSizes[largestComp]) largestComp = c;
  }
  const largestSize = compSizes[largestComp] ?? 0;

  if (compCount > 1 && largestSize > 0) {
    for (let i = 0; i < total; i++) {
      const cid = compIds[i];
      if (
        cid !== -1 &&
        cid !== largestComp &&
        compTouchesBorder[cid] &&
        compSizes[cid] < largestSize * 0.85
      ) {
        data[i * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return work;
  }

  const pad = 1;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  if (options.flipX) {
    octx.translate(cw, 0);
    octx.scale(-1, 1);
  }
  octx.drawImage(work, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

/**
 * Removes pure studio white trapped between legs/arms/tails in the lower region
 * of full-body sprites while keeping upper-body white hair untouched.
 */
function clearLowerInteriorWhiteLoops(
  canvas: HTMLCanvasElement,
  startYFrac = 0.34,
  startXFrac = 0.0
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const startY = Math.floor(h * startYFrac);
  const startX = Math.floor(w * startXFrac);

  for (let y = startY; y < h; y++) {
    for (let x = startX; x < w; x++) {
      const p = (y * w + x) * 4;
      if (data[p + 3] === 0) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      if (minC >= 236 && maxC - minC <= 18) {
        data[p + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Slicing layout for uploaded Echoes of Elmodor humanoid hero sheets */
function processHeroSheet(
  img: HTMLImageElement,
  cutins: CutinCharacterPoses,
  glamourPortrait: string
): ProcessedCharacterAssets {
  const portraitBands: [PortraitMood, number, number][] = [
    ['neutral', 0.06, 0.23],
    ['attacking', 0.29, 0.205],
    ['hurt', 0.495, 0.205],
    ['wounded', 0.70, 0.22],
  ];

  const portraits = {} as Record<PortraitMood, string>;
  for (const [mood, nx, nw] of portraitBands) {
    const c = extractKeyedSprite(img, nx, 0.015, nw, 0.268, 180);
    portraits[mood] = c.toDataURL('image/png');
  }

  const spriteBands: [FacingDir, number, number][] = [
    ['SW', 0.095, 0.215],
    ['SE', 0.305, 0.205],
    ['NW', 0.505, 0.21],
    ['NE', 0.715, 0.225],
  ];

  const sprites = {} as Record<FacingDir, HTMLCanvasElement>;
  for (const [dir, nx, nw] of spriteBands) {
    const raw = extractKeyedSprite(img, nx, 0.332, nw, 0.525, 220);
    sprites[dir] = clearLowerInteriorWhiteLoops(raw, 0.34);
  }

  return { portraits, glamourPortrait, sprites, cutins };
}

/** Slicing layout for clean text-free 2x4 quadruped Black Panther sheet */
function processQuadrupedPantherSheet(
  img: HTMLImageElement,
  cutins: CutinCharacterPoses,
  glamourPortrait: string
): ProcessedCharacterAssets {
  const portraitBands: [PortraitMood, number, number][] = [
    ['neutral', 0.01, 0.24],
    ['attacking', 0.25, 0.25],
    ['hurt', 0.50, 0.24],
    ['wounded', 0.74, 0.25],
  ];

  const portraits = {} as Record<PortraitMood, string>;
  for (const [mood, nx, nw] of portraitBands) {
    const c = extractKeyedSprite(img, nx, 0.02, nw, 0.44, 180);
    portraits[mood] = c.toDataURL('image/png');
  }

  const spriteBands: [FacingDir, number, number][] = [
    ['SE', 0.005, 0.25],
    ['SW', 0.255, 0.25],
    ['NW', 0.505, 0.245],
    ['NE', 0.75, 0.245],
  ];

  const sprites = {} as Record<FacingDir, HTMLCanvasElement>;
  for (const [dir, nx, nw] of spriteBands) {
    const raw = extractKeyedSprite(img, nx, 0.52, nw, 0.46, 220);
    sprites[dir] = clearLowerInteriorWhiteLoops(raw, 0.15);
  }

  return { portraits, glamourPortrait, sprites, cutins };
}

interface GlamourImages {
  aioriGreatsword: HTMLImageElement;
  aioriFerunium: HTMLImageElement;
  aioriAuruinum: HTMLImageElement;
  aioriGuard: HTMLImageElement;
  aioriHurt: HTMLImageElement;
  aryonBloodRush: HTMLImageElement;
  aryonGlobus: HTMLImageElement;
  aryonChamus: HTMLImageElement;
  aryonShield: HTMLImageElement;
  aryonHurt: HTMLImageElement;
  pantherClaws: HTMLImageElement;
  pantherPounce: HTMLImageElement;
  pantherGuard: HTMLImageElement;
  pantherHurt: HTMLImageElement;
}

function processCutinPoses(
  aioriCutinImg: HTMLImageElement,
  aryonCutinImg: HTMLImageElement,
  pantherCutinImg: HTMLImageElement,
  impactCutinImg: HTMLImageElement,
  glamour: GlamourImages
): Record<CharacterSheetId, CutinCharacterPoses> {
  const aioriOver = extractKeyedSprite(aioriCutinImg, 0.01, 0.06, 0.365, 0.86, {
    maxOutputDim: 620,
    flipX: true,
    excludeLocalRects: [[0.73, 0.04, 0.27, 0.31]],
  });
  const aioriDuelReady = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(aioriCutinImg, 0.68, 0.01, 0.31, 0.94, { maxOutputDim: 560 }),
    0.34
  );
  const aioriHurt = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(impactCutinImg, 0.02, 0.1, 0.31, 0.8, { maxOutputDim: 520 }),
    0.34
  );

  const aryonOver = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(aryonCutinImg, 0.01, 0.06, 0.31, 0.84, {
      maxOutputDim: 620,
    }),
    0.58,
    0.5
  );
  const aryonDuelReady = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(aryonCutinImg, 0.635, 0.11, 0.355, 0.83, {
      maxOutputDim: 560,
      flipX: true,
    }),
    0.42
  );
  const aryonHurt = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(impactCutinImg, 0.365, 0.11, 0.29, 0.8, {
      maxOutputDim: 520,
      flipX: true,
    }),
    0.42
  );

  const pantherOver = extractKeyedSprite(pantherCutinImg, 0.01, 0.06, 0.295, 0.88, {
    maxOutputDim: 620,
  });
  const pantherDuelReady = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(pantherCutinImg, 0.555, 0.43, 0.435, 0.53, {
      maxOutputDim: 560,
      flipX: true,
    }),
    0.25
  );
  const pantherHurt = clearLowerInteriorWhiteLoops(
    extractKeyedSprite(impactCutinImg, 0.66, 0.37, 0.33, 0.53, {
      maxOutputDim: 520,
      flipX: true,
    }),
    0.25
  );

  const aioriGreatsword = extractChromaGreenPanel(glamour.aioriGreatsword, 980);
  const aioriFerunium = extractChromaGreenPanel(glamour.aioriFerunium, 980);
  const aioriAuruinum = extractChromaGreenPanel(glamour.aioriAuruinum, 980);
  const aryonBloodRush = extractChromaGreenPanel(glamour.aryonBloodRush, 980);
  const aryonGlobus = extractChromaGreenPanel(glamour.aryonGlobus, 980);
  const aryonChamus = extractChromaGreenPanel(glamour.aryonChamus, 980);
  const pantherClaws = extractChromaGreenPanel(glamour.pantherClaws, 980);
  const pantherPounce = extractChromaGreenPanel(glamour.pantherPounce, 980);

  return {
    aiori: {
      overShoulder: aioriOver.toDataURL('image/png'),
      duelReadyLeft: aioriDuelReady.toDataURL('image/png'),
      attackGlamour: aioriGreatsword,
      attackGlamourBySkill: {
        greatsword_strike: aioriGreatsword,
        ferunium_blade: aioriFerunium,
        auruinum_blade: aioriAuruinum,
      },
      guardGlamour: extractChromaGreenPanel(glamour.aioriGuard, 980),
      hurtGlamour: extractChromaGreenPanel(glamour.aioriHurt, 980),
      hurtLeft: aioriHurt.toDataURL('image/png'),
    },
    aryon: {
      overShoulder: aryonOver.toDataURL('image/png'),
      duelReadyLeft: aryonDuelReady.toDataURL('image/png'),
      attackGlamour: aryonGlobus,
      attackGlamourBySkill: {
        blood_rush_strike: aryonBloodRush,
        globus_inflamus: aryonGlobus,
        chamus_continuos: aryonChamus,
      },
      guardGlamour: extractChromaGreenPanel(glamour.aryonShield, 980),
      hurtGlamour: extractChromaGreenPanel(glamour.aryonHurt, 980),
      hurtLeft: aryonHurt.toDataURL('image/png'),
    },
    panther: {
      overShoulder: pantherOver.toDataURL('image/png'),
      duelReadyLeft: pantherDuelReady.toDataURL('image/png'),
      attackGlamour: pantherClaws,
      attackGlamourBySkill: {
        rending_claws: pantherClaws,
        shadow_pounce: pantherPounce,
      },
      guardGlamour: extractChromaGreenPanel(glamour.pantherGuard, 980),
      hurtGlamour: extractChromaGreenPanel(glamour.pantherHurt, 980),
      hurtLeft: pantherHurt.toDataURL('image/png'),
    },
  };
}

function processBridgeProps(img: HTMLImageElement): BridgePropAssets {
  return {
    wall: extractKeyedSprite(img, 0.02, 0.02, 0.46, 0.46, 220),
    pillar: extractKeyedSprite(img, 0.52, 0.02, 0.46, 0.46, 220),
    pine: extractKeyedSprite(img, 0.02, 0.46, 0.46, 0.52, 220),
    boulder: extractKeyedSprite(img, 0.52, 0.5, 0.46, 0.48, 180),
  };
}

let cachedPromise: Promise<LoadedGameAssets> | null = null;

export function loadAllGameAssets(): Promise<LoadedGameAssets> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const [
      battleMap,
      aioriImg,
      aryonImg,
      pantherImg,
      propsImg,
      aioriCutinImg,
      aryonCutinImg,
      pantherCutinImg,
      impactCutinImg,
      aioriGreatswordG,
      aioriFeruniumG,
      aioriAuruinumG,
      aioriGuardG,
      aioriHurtG,
      aryonBloodRushG,
      aryonGlobusG,
      aryonChamusG,
      aryonShieldG,
      aryonHurtG,
      pantherClawsG,
      pantherPounceG,
      pantherGuardG,
      pantherHurtG,
    ] = await Promise.all([
      loadImage(ASSET_URLS.battleMap),
      loadImage(ASSET_URLS.sheets.aiori),
      loadImage(ASSET_URLS.sheets.aryon),
      loadImage(ASSET_URLS.sheets.panther),
      loadImage(ASSET_URLS.bridgeProps),
      loadImage(ASSET_URLS.cutinSheets.aiori),
      loadImage(ASSET_URLS.cutinSheets.aryon),
      loadImage(ASSET_URLS.cutinSheets.panther),
      loadImage(ASSET_URLS.cutinSheets.impact),
      loadImage(ASSET_URLS.glamourPanels.aioriGreatsword),
      loadImage(ASSET_URLS.glamourPanels.aioriFerunium),
      loadImage(ASSET_URLS.glamourPanels.aioriAuruinum),
      loadImage(ASSET_URLS.glamourPanels.aioriGuard),
      loadImage(ASSET_URLS.glamourPanels.aioriHurt),
      loadImage(ASSET_URLS.glamourPanels.aryonBloodRush),
      loadImage(ASSET_URLS.glamourPanels.aryonGlobus),
      loadImage(ASSET_URLS.glamourPanels.aryonChamus),
      loadImage(ASSET_URLS.glamourPanels.aryonShield),
      loadImage(ASSET_URLS.glamourPanels.aryonHurt),
      loadImage(ASSET_URLS.glamourPanels.pantherClaws),
      loadImage(ASSET_URLS.glamourPanels.pantherPounce),
      loadImage(ASSET_URLS.glamourPanels.pantherGuard),
      loadImage(ASSET_URLS.glamourPanels.pantherHurt),
    ]);

    const cutins = processCutinPoses(
      aioriCutinImg,
      aryonCutinImg,
      pantherCutinImg,
      impactCutinImg,
      {
        aioriGreatsword: aioriGreatswordG,
        aioriFerunium: aioriFeruniumG,
        aioriAuruinum: aioriAuruinumG,
        aioriGuard: aioriGuardG,
        aioriHurt: aioriHurtG,
        aryonBloodRush: aryonBloodRushG,
        aryonGlobus: aryonGlobusG,
        aryonChamus: aryonChamusG,
        aryonShield: aryonShieldG,
        aryonHurt: aryonHurtG,
        pantherClaws: pantherClawsG,
        pantherPounce: pantherPounceG,
        pantherGuard: pantherGuardG,
        pantherHurt: pantherHurtG,
      }
    );

    return {
      battleMap,
      cutinBackdrop: ASSET_URLS.cutinBackdrop,
      duelScenes: ASSET_URLS.duelScenes,
      fanfare: ASSET_URLS.fanfare,
      characters: {
        aiori: processHeroSheet(aioriImg, cutins.aiori, ASSET_URLS.glamourPortraits.aiori),
        aryon: processHeroSheet(aryonImg, cutins.aryon, ASSET_URLS.glamourPortraits.aryon),
        panther: processQuadrupedPantherSheet(
          pantherImg,
          cutins.panther,
          ASSET_URLS.glamourPortraits.panther
        ),
      },
      props: processBridgeProps(propsImg),
    };
  })();

  return cachedPromise;
}
