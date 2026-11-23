export type TerrainType =
  | 'grass'
  | 'tall_grass'
  | 'dirt_road'
  | 'stone_stair'
  | 'flagstone'
  | 'stream'
  | 'stone_bridge'
  | 'cliff'
  | 'tower_wall'
  | 'boulder'
  | 'pine_tree';

export interface TileData {
  x: number;
  y: number;
  /**
   * Walkable surface elevation in Tactics Ogre height units (0..6).
   * Each major plateau tier step (Δh = 2) equals 56px — matching 1 full character height!
   * Carved staircases ascend smoothly by Δh = 1 (28px) per tile across each tier.
   */
  height: number;
  terrain: TerrainType;
  /** True if units cannot stand on or pass through this tile */
  blocked: boolean;
  /** Movement cost to enter */
  moveCost: number;
  /** Extra vertical structure height (in height units) for walls/trees/boulders */
  propHeight: number;
  /** True if this tile casts a visual blind-angle behind it in the locked iso camera */
  occluder: boolean;
  /** Optional stair ascent direction for visual rendering & orientation */
  stairDir?: 'N' | 'S' | 'E' | 'W';
  /** Tactical defense / evasion modifier */
  evasionBonus: number;
  /** Human-readable terrain label */
  label: string;
}

export interface IsoProjectionConfig {
  /** Master canvas coordinate space matching the 16:9 painted single-image battlemap */
  canvasWidth: number;
  canvasHeight: number;
  mapSize: number;
  tileW: number;
  tileH: number;
  elevStep: number;
  originX: number;
  originY: number;
}

/**
 * Fixed FFT / Tactics Ogre 2:1 dimetric projection math with 1-character-tall elevation tiers:
 * - tileW = 48, tileH = 24 -> 30x30 playable diamond is 1440x720, leaving generous outer Banner Saga
 *   ambient highland wilderness around all four edges of the 1920x1080 painted canvas!
 * - elevStep = 28px -> Each major terrace cliff (Δh = 2) is 56px tall (~1 full character height!).
 */
export const ISO_CONFIG: IsoProjectionConfig = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  mapSize: 30,
  tileW: 48,
  tileH: 24,
  elevStep: 28,
  originX: 960,
  originY: 238,
};

/**
 * Fine-tuning calibration between the painted single-image map and the mathematical grid.
 */
export interface MapImageCalibration {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export const MAP_CALIBRATION: MapImageCalibration = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
};

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Converts grid coordinates (x, y) + elevation h into the center point of the
 * tile's top diamond face in master 1920x1080 battlemap coordinates.
 */
export function gridToScreen(
  gx: number,
  gy: number,
  height: number,
  cfg: IsoProjectionConfig = ISO_CONFIG
): ScreenPoint {
  const halfW = cfg.tileW / 2;
  const halfH = cfg.tileH / 2;
  return {
    x: cfg.originX + (gx - gy) * halfW,
    y: cfg.originY + (gx + gy) * halfH - height * cfg.elevStep,
  };
}

/**
 * Returns the 4 vertices (top, right, bottom, left) of a tile's isometric diamond face.
 */
export function getTileDiamond(
  gx: number,
  gy: number,
  height: number,
  cfg: IsoProjectionConfig = ISO_CONFIG
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  const c = gridToScreen(gx, gy, height, cfg);
  const hw = cfg.tileW / 2;
  const hh = cfg.tileH / 2;
  return [
    { x: c.x, y: c.y - hh },
    { x: c.x + hw, y: c.y },
    { x: c.x, y: c.y + hh },
    { x: c.x - hw, y: c.y },
  ];
}

/**
 * Point-in-diamond test in master 1920x1080 map coordinates.
 */
export function isPointInTileDiamond(
  px: number,
  py: number,
  gx: number,
  gy: number,
  height: number,
  cfg: IsoProjectionConfig = ISO_CONFIG
): boolean {
  const c = gridToScreen(gx, gy, height, cfg);
  const dx = Math.abs(px - c.x) / (cfg.tileW / 2);
  const dy = Math.abs(py - c.y) / (cfg.tileH / 2);
  return dx + dy <= 1.0;
}

/**
 * Picks the exact topmost tile under a master map coordinate (px, py),
 * iterating front-to-back (highest depth x + y first) so tall elevated plateaus
 * pick accurately like FFT / Tactics Ogre.
 */
export function pickTileAtMapPoint(
  px: number,
  py: number,
  tiles: TileData[][],
  cfg: IsoProjectionConfig = ISO_CONFIG
): TileData | null {
  const size = tiles.length;
  for (let sum = (size - 1) * 2; sum >= 0; sum--) {
    const xStart = Math.max(0, sum - (size - 1));
    const xEnd = Math.min(size - 1, sum);
    for (let x = xStart; x <= xEnd; x++) {
      const y = sum - x;
      const tile = tiles[y][x];
      if (isPointInTileDiamond(px, py, x, y, tile.height, cfg)) {
        return tile;
      }
    }
  }
  return null;
}

/**
 * Checks whether a tile (gx, gy) sits in the visual "blind angle" behind any
 * foreground tall wall, cliff face, or highland pine.
 */
export function isTileOccluded(
  gx: number,
  gy: number,
  tiles: TileData[][],
  cfg: IsoProjectionConfig = ISO_CONFIG
): boolean {
  const size = tiles.length;
  const target = tiles[gy]?.[gx];
  if (!target) return false;

  const targetScreen = gridToScreen(gx, gy, target.height, cfg);
  for (let d = 1; d <= 6; d++) {
    for (let dx = 0; dx <= d; dx++) {
      const dy = d - dx;
      const ox = gx + dx;
      const oy = gy + dy;
      if (ox >= size || oy >= size) continue;
      if (Math.abs((ox - oy) - (gx - gy)) > 2) continue;

      const occ = tiles[oy][ox];
      const occTopHeight = occ.height + occ.propHeight;
      if (occTopHeight <= target.height + 0.8 && !occ.occluder) continue;

      const occBase = gridToScreen(ox, oy, occ.height, cfg);
      const occTopY = occBase.y - occ.propHeight * cfg.elevStep - cfg.tileH * 0.5;
      const horizDist = Math.abs(occBase.x - targetScreen.x);

      if (
        horizDist <= cfg.tileW * 0.95 &&
        occTopY <= targetScreen.y - 4 &&
        occBase.y + cfg.tileH * 0.5 >= targetScreen.y - 52
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns all foreground occluder tiles that visually overlap a given target tile.
 */
export function getOccludingTilesFor(
  gx: number,
  gy: number,
  tiles: TileData[][],
  cfg: IsoProjectionConfig = ISO_CONFIG
): TileData[] {
  const size = tiles.length;
  const target = tiles[gy]?.[gx];
  if (!target) return [];

  const targetScreen = gridToScreen(gx, gy, target.height, cfg);
  const result: TileData[] = [];

  for (let d = 1; d <= 6; d++) {
    for (let dx = 0; dx <= d; dx++) {
      const dy = d - dx;
      const ox = gx + dx;
      const oy = gy + dy;
      if (ox >= size || oy >= size) continue;
      if (Math.abs((ox - oy) - (gx - gy)) > 2) continue;

      const occ = tiles[oy][ox];
      if (!occ.occluder && occ.height <= target.height + 1) continue;

      const occBase = gridToScreen(ox, oy, occ.height, cfg);
      const occTopY = occBase.y - occ.propHeight * cfg.elevStep - cfg.tileH * 0.5;
      const horizDist = Math.abs(occBase.x - targetScreen.x);

      if (
        horizDist <= cfg.tileW * 0.98 &&
        occTopY <= targetScreen.y - 2 &&
        occBase.y + cfg.tileH * 0.5 >= targetScreen.y - 56
      ) {
        result.push(occ);
      }
    }
  }
  return result;
}

const TERRAIN_META: Record<
  TerrainType,
  { label: string; moveCost: number; evasionBonus: number; defaultBlocked: boolean }
> = {
  grass: { label: 'Highland Grass', moveCost: 1, evasionBonus: 0, defaultBlocked: false },
  tall_grass: { label: 'Tall Meadow Grass', moveCost: 1, evasionBonus: 10, defaultBlocked: false },
  dirt_road: { label: 'Weathered Trail', moveCost: 1, evasionBonus: 0, defaultBlocked: false },
  stone_stair: { label: 'Carved Stone Stairs', moveCost: 1, evasionBonus: 0, defaultBlocked: false },
  flagstone: { label: 'Ruined Flagstone', moveCost: 1, evasionBonus: 5, defaultBlocked: false },
  stream: { label: 'Highland Brook', moveCost: 2, evasionBonus: -5, defaultBlocked: false },
  stone_bridge: { label: 'Arched Stone Bridge', moveCost: 1, evasionBonus: 0, defaultBlocked: false },
  cliff: { label: 'Sheer Cliff', moveCost: 99, evasionBonus: 0, defaultBlocked: true },
  tower_wall: { label: 'Ruined Watchtower Wall', moveCost: 99, evasionBonus: 0, defaultBlocked: true },
  boulder: { label: 'Standing Monolith', moveCost: 99, evasionBonus: 0, defaultBlocked: true },
  pine_tree: { label: 'Highland Pine', moveCost: 99, evasionBonus: 0, defaultBlocked: true },
};

function makeTile(
  x: number,
  y: number,
  height: number,
  terrain: TerrainType,
  overrides: Partial<TileData> = {}
): TileData {
  const meta = TERRAIN_META[terrain];
  return {
    x,
    y,
    height,
    terrain,
    blocked: overrides.blocked ?? meta.defaultBlocked,
    moveCost: overrides.moveCost ?? meta.moveCost,
    propHeight: overrides.propHeight ?? 0,
    occluder: overrides.occluder ?? false,
    stairDir: overrides.stairDir,
    evasionBonus: overrides.evasionBonus ?? meta.evasionBonus,
    label: overrides.label ?? meta.label,
  };
}

/**
 * Generates the authoritative 30x30 Elmodor Ruined Watchtower topology with true
 * 1-character-height (Δh = 2 = 56px) Tactics Ogre elevation cliffs & terraced plateaus:
 * - Tier 0 (h = 0): Southern highland meadow clearing & eastern mountain brook
 * - Tier 1 (h = 2, +1 character tall): Mid highland grassy terraces (West, South Approach, East Bank)
 * - Tier 2 (h = 4, +2 characters tall): Central Ruined Watchtower Flagstone Plateau
 * - Tier 3 (h = 6, +3 characters tall): Upper Watchtower Battlement Lookout Deck
 * Every vertical cliff jump of Δh = 2 (1 full character tall) is bridged cleanly by
 * explicit carved stone staircases stepping Δh = 1 per tile.
 */
export function buildElmodorWatchtowerMap(): TileData[][] {
  const N = ISO_CONFIG.mapSize;
  const grid: TileData[][] = [];

  // 1. Base highland elevation tiers (Tier 0 = h0, Tier 1 = h2)
  for (let y = 0; y < N; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < N; x++) {
      let h = 0;
      let terrain: TerrainType = 'grass';

      // Mid-level Highland Terraces (h = 2 -> 1 full character height above the southern meadow!)
      if (y <= 19 && x <= 21) {
        h = 2;
      }
      // Northern highland rim behind watchtower (h = 2)
      if (y <= 5 && x >= 6 && x <= 21) {
        h = 2;
      }
      // Eastern terraced ridge beyond the mountain brook (h = 2)
      if (x >= 24 && y >= 5 && y <= 20) {
        h = 2;
      }

      // Scattered tall meadow grass patches (evasion +10%)
      if (
        (x >= 4 && x <= 8 && y >= 22 && y <= 26) ||
        (x >= 17 && x <= 20 && y >= 24 && y <= 27) ||
        (x >= 2 && x <= 5 && y >= 13 && y <= 17) ||
        (x >= 25 && x <= 28 && y >= 14 && y <= 19)
      ) {
        terrain = 'tall_grass';
      }

      row.push(makeTile(x, y, h, terrain));
    }
    grid.push(row);
  }

  const set = (
    x: number,
    y: number,
    height: number,
    terrain: TerrainType,
    overrides: Partial<TileData> = {}
  ) => {
    if (x < 0 || x >= N || y < 0 || y >= N) return;
    grid[y][x] = makeTile(x, y, height, terrain, overrides);
  };

  // 2. Eastern Highland Brook running cleanly along h = 0 ravine
  const streamCenterX = (y: number): number => {
    if (y < 12) return 23;
    if (y < 23) return 22;
    return 21;
  };
  for (let y = 0; y < N; y++) {
    const cx = streamCenterX(y);
    set(cx, y, 0, 'stream');
    if (y >= 15 && y <= 28) {
      set(cx + 1, y, 0, 'stream');
    }
    // Keep immediate brook banks low (h=0) in southern section so bridge connects cleanly
    if (y >= 20) {
      if (cx - 1 >= 0) set(cx - 1, y, 0, 'grass');
      if (cx + 2 < N) set(cx + 2, y, 0, 'grass');
    }
  }

  // Low arched stone bridge over the southern brook (h = 0 -> h = 1 -> h = 0)
  set(21, 22, 0, 'dirt_road');
  set(22, 22, 1, 'stone_bridge');
  set(23, 22, 1, 'stone_bridge');
  set(24, 22, 0, 'dirt_road');
  set(22, 21, 1, 'stone_bridge');
  set(23, 21, 1, 'stone_bridge');

  // Step stairs up from southern eastern bank (h=0) onto Eastern Terraced Ridge (h=2)
  for (let x = 25; x <= 26; x++) {
    set(x, 21, 1, 'stone_stair', { stairDir: 'N', label: 'East Bank Steps' });
  }

  // Upper brook stepping ford at y=11..12 connecting to Eastern Plateau Stairs
  set(23, 11, 0, 'stone_bridge', { label: 'Brook Stepping Ford' });
  set(23, 12, 0, 'stone_bridge', { label: 'Brook Stepping Ford' });

  // 3. Lower-to-Mid Terrace Steps (Bridging h=0 Southern Meadow -> h=2 Mid Terrace, Δh = 2 = 1 Character Height!)
  // Wide Main Southern Road Approach Stairway (3 tiles wide: x = 13..15, y = 20)
  for (let x = 13; x <= 15; x++) {
    set(x, 20, 1, 'stone_stair', { stairDir: 'N', label: 'Meadow Approach Steps' });
  }
  // Western Meadow Grassy Step Trail (x = 7..8, y = 20)
  for (let x = 7; x <= 8; x++) {
    set(x, 20, 1, 'stone_stair', { stairDir: 'N', label: 'Western Terrace Steps' });
  }

  // 4. Central Ruined Watchtower Plateau (x: 10..19, y: 6..16, h = 4 -> 1 full character height above h=2 terrace!)
  for (let y = 6; y <= 16; y++) {
    for (let x = 10; x <= 19; x++) {
      const isCourtyard = x >= 11 && x <= 18 && y >= 7 && y <= 15;
      set(x, y, 4, isCourtyard ? 'flagstone' : 'grass');
    }
  }

  // Impassable rocky sheer cliff wall skirting the southern & side edges of the h=4 plateau
  for (let x = 10; x <= 12; x++) {
    set(x, 17, 2, 'cliff', { propHeight: 1.8, occluder: false });
  }
  for (let x = 16; x <= 19; x++) {
    set(x, 17, 2, 'cliff', { propHeight: 1.8, occluder: false });
  }
  for (let y = 7; y <= 12; y++) {
    set(9, y, 2, 'cliff', { propHeight: 1.8, occluder: false });
  }
  set(9, 16, 2, 'cliff', { propHeight: 1.8, occluder: false });
  for (let y = 6; y <= 9; y++) {
    set(20, y, 2, 'cliff', { propHeight: 1.8, occluder: false });
  }
  for (let y = 14; y <= 16; y++) {
    set(20, y, 2, 'cliff', { propHeight: 1.8, occluder: false });
  }

  // 5. Three Grand Stone Staircases Ascending to the h=4 Watchtower Plateau (Δh = 1 per tile!)
  // A) Grand Southern Plateau Staircase (x: 13..15)
  // y=19 (h=2 dirt road) -> y=18 (h=3 stair) -> y=17 (h=3 stair landing) -> y=16 (h=4 flagstone)
  for (let x = 13; x <= 15; x++) {
    set(x, 19, 2, 'dirt_road');
    set(x, 18, 3, 'stone_stair', { stairDir: 'N', label: 'Grand Watchtower Steps' });
    set(x, 17, 3, 'stone_stair', { stairDir: 'N', label: 'Grand Watchtower Steps' });
    set(x, 16, 4, 'flagstone');
  }

  // B) Western Flank Stone Staircase (y: 13..15)
  // x=7 (h=2 trail) -> x=8 (h=3 stair) -> x=9 (h=3 stair) -> x=10 (h=4 flagstone)
  for (let y = 13; y <= 15; y++) {
    set(7, y, 2, 'dirt_road');
    set(8, y, 3, 'stone_stair', { stairDir: 'E', label: 'Western Flank Stairs' });
    set(9, y, 3, 'stone_stair', { stairDir: 'E', label: 'Western Flank Stairs' });
    set(10, y, 4, 'flagstone');
  }

  // C) Eastern Brook-to-Plateau Grand Causeway Steps (y: 10..12)
  // x=23 (h=0 ford) -> x=22 (h=1 stair) -> x=21 (h=2 landing) -> x=20 (h=3 stair) -> x=19 (h=4 plateau)
  for (let y = 10; y <= 12; y++) {
    set(22, y, 1, 'stone_stair', { stairDir: 'W', label: 'Eastern Causeway Steps' });
    set(21, y, 2, 'flagstone', { label: 'Causeway Landing' });
    set(20, y, 3, 'stone_stair', { stairDir: 'W', label: 'Eastern Causeway Steps' });
    set(19, y, 4, 'flagstone');
  }

  // 6. Weathered Highland Dirt Roads connecting Southern Clearing -> Stairs & Bridge
  for (let y = 21; y <= 28; y++) {
    set(14, y, 0, 'dirt_road');
    set(15, y, 0, 'dirt_road');
  }
  // West approach trail on h=0 & h=2 terrace leading to Western Flank Stairs
  for (let x = 7; x <= 13; x++) {
    set(x, 22, 0, 'dirt_road');
  }
  set(7, 21, 0, 'dirt_road');
  set(8, 21, 0, 'dirt_road');
  for (let y = 16; y <= 19; y++) {
    set(7, y, 2, 'dirt_road');
  }
  // East approach trail from south road to stone bridge
  for (let x = 16; x <= 21; x++) {
    set(x, 22, 0, 'dirt_road');
  }

  // 7. THE RUINED WATCHTOWER (x: 11..18, y: 5..11 on h=4 plateau)
  for (let y = 6; y <= 10; y++) {
    for (let x = 12; x <= 17; x++) {
      set(x, y, 4, 'flagstone');
    }
  }

  // Upper Ruined Battlement Lookout Deck (h = 6 -> 1 full character height above h=4 courtyard!)
  // Reached via interior spiral stone stair: (16,9 h=4) -> (16,8 h=5 stair) -> (15,7 h=6 flagstone)
  set(16, 8, 5, 'stone_stair', { stairDir: 'N', label: 'Tower Spiral Stair' });
  set(15, 8, 5, 'stone_stair', { stairDir: 'N', label: 'Tower Spiral Stair' });
  for (let y = 6; y <= 7; y++) {
    for (let x = 12; x <= 15; x++) {
      set(x, y, 6, 'flagstone', { label: 'Watchtower Battlement', evasionBonus: 15 });
    }
  }
  // Fallen rubble parapet bordering the south edge of the h=6 deck
  set(12, 8, 4, 'boulder', { propHeight: 1.0, occluder: true, label: 'Fallen Masonry' });
  set(13, 8, 4, 'boulder', { propHeight: 0.9, occluder: false, label: 'Crumbled Parapet' });

  // Tall Ruined Watchtower Stone Walls (propHeight 2.0..2.6 = ~1.1-1.3 character heights above h=4!)
  for (let x = 11; x <= 18; x++) {
    const tall = x >= 12 && x <= 16 ? 2.5 : 1.9;
    set(x, 5, 4, 'tower_wall', { propHeight: tall, occluder: true });
  }
  for (let y = 6; y <= 10; y++) {
    const tall = y <= 8 ? 2.4 : 1.9;
    set(11, y, 4, 'tower_wall', { propHeight: tall, occluder: true });
  }
  set(18, 6, 4, 'tower_wall', { propHeight: 2.2, occluder: true });
  set(18, 7, 4, 'tower_wall', { propHeight: 1.8, occluder: true });
  set(18, 8, 4, 'tower_wall', { propHeight: 1.3, occluder: true });
  set(18, 9, 4, 'flagstone', { label: 'Breached Tower Arch' });
  set(18, 10, 4, 'flagstone', { label: 'Breached Tower Arch' });

  // South ruined wall segments framing the wide 3-tile breached gateway (x=13..15 OPEN)
  set(11, 11, 4, 'tower_wall', { propHeight: 2.0, occluder: true });
  set(12, 11, 4, 'tower_wall', { propHeight: 1.7, occluder: true });
  set(16, 11, 4, 'tower_wall', { propHeight: 1.6, occluder: true });
  set(17, 11, 4, 'tower_wall', { propHeight: 2.0, occluder: true });
  set(18, 11, 4, 'tower_wall', { propHeight: 1.4, occluder: true });
  for (let x = 13; x <= 15; x++) {
    set(x, 11, 4, 'flagstone', { label: 'Watchtower Gateway' });
  }

  // Rear mossy steps connecting northern h=2 terrace back-alley cleanly to h=4 plateau
  for (let x = 10; x <= 19; x++) {
    set(x, 4, 2, 'grass');
    set(x, 3, 2, 'grass');
  }
  set(10, 5, 3, 'stone_stair', { stairDir: 'S', label: 'Mossy Rear Steps' });

  // 8. Tactical Highland Pines & Standing Stones (matched to painted v2 artwork, off main paths)
  const pines: [number, number][] = [
    [3, 5], [5, 4], [7, 3], [2, 10], [4, 11],
    [3, 23], [5, 26], [9, 27],
    [19, 3], [21, 4], [20, 17], [19, 25],
  ];
  for (const [px, py] of pines) {
    const baseH = grid[py][px].height;
    set(px, py, baseH, 'pine_tree', { propHeight: 2.3, occluder: true });
  }

  const boulders: [number, number][] = [
    [5, 13], [11, 22], [16, 24], [10, 25], [8, 7], [19, 13], [11, 14],
  ];
  for (const [bx, by] of boulders) {
    const baseH = grid[by][bx].height;
    set(bx, by, baseH, 'boulder', { propHeight: 1.1, occluder: true });
  }

  // 9. Outer Non-Playable Banner Saga Gorge & Canyon Chasm Trim
  // Keeps the tactical grid tightly hugging the painted highland island with zero lines floating over deep gorges
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inEastChasm =
        x >= 24 ||
        (x >= 23 && (y <= 10 || y >= 13)) ||
        (x >= 21 && y <= 8);
      const inSouthWaterfallGorge =
        (x >= 17 && x <= 20 && y >= 25) ||
        (y >= 28 && x >= 16);
      const inOuterCornerVoid =
        x + y <= 4 ||
        x + y >= 47 ||
        (x <= 1 && y >= 22) ||
        (y <= 1 && x >= 19);

      if (inEastChasm || inSouthWaterfallGorge || inOuterCornerVoid) {
        set(x, y, 0, 'cliff', {
          blocked: true,
          propHeight: 0,
          occluder: false,
          label: 'Highland Gorge',
        });
      }
    }
  }

  return grid;
}

export const INITIAL_MAP_TILES: TileData[][] = buildElmodorWatchtowerMap();
