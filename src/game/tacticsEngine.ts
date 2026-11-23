import { TileData, isTileOccluded } from './mapTopology';

export type Faction = 'hero' | 'enemy';
export type CharacterSheetId = 'aiori' | 'aryon' | 'panther';
export type FacingDir = 'SW' | 'SE' | 'NW' | 'NE';
export type PortraitMood = 'neutral' | 'attacking' | 'hurt' | 'wounded';
export type AttackAngle = 'FRONT' | 'SIDE' | 'BACK';
export type AIPolicy = 'HIGH_GROUND_POUNCER' | 'FLANKER' | 'AMBUSH_HUNTER';
export type SkillCategory = 'attack' | 'essence' | 'defense';
export type SwordElement = 'none' | 'ferunium' | 'auruinum';
export type AttackStanceId = 'standard' | 'focused' | 'heavy';
export type ReactionId = 'none' | 'escudo_ergeo' | 'steel_guard' | 'shadow_veil';
export type ClashOutcomeKind = 'hit' | 'crit' | 'blocked' | 'shielded' | 'evaded';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  /** Command Wheel grouping: Attack (physical), Essence (unique elemental/stealth), Defense (defensive passive/stance) */
  category: SkillCategory;
  element?: 'physical' | 'fire' | 'arcane' | 'shadow';
  /** Low-number Essence cost (0..3) */
  essenceCost: number;
  minRange: number;
  maxRange: number;
  elevationRangeBonus: boolean;
  /** Low-number base Vitality damage (X-COM early tier: 2..5) */
  baseDamage: number;
  accuracyBonus: number;
  critBonus: number;
  /** Pierces N points of Guard / Shield mitigation */
  pierce?: number;
  knockback?: number;
  applySlow?: boolean;
  /** Grants Smoke Screen stealth (disappear until attacking) */
  grantsHidden?: boolean;
  /** Imbues Aiori's greatsword with Red Fire (Ferunium) or Blue Arcane (Auruinum) energy */
  imbuesSword?: SwordElement;
  isSelfBuff?: boolean;
  kind: 'melee' | 'ranged' | 'buff';
}

export interface AttackStanceOption {
  id: AttackStanceId;
  name: string;
  shortDesc: string;
  essenceCost: number;
  damageBonus: number;
  hitBonus: number;
  critBonus: number;
  pierceBonus?: number;
}

export const ATTACK_STANCES: AttackStanceOption[] = [
  {
    id: 'standard',
    name: 'Standard',
    shortDesc: 'Balanced execution · No extra Essence',
    essenceCost: 0,
    damageBonus: 0,
    hitBonus: 0,
    critBonus: 0,
  },
  {
    id: 'focused',
    name: 'Focused',
    shortDesc: '+16% Hit · +10% Crit',
    essenceCost: 1,
    damageBonus: 0,
    hitBonus: 16,
    critBonus: 10,
  },
  {
    id: 'heavy',
    name: 'Overdrive',
    shortDesc: '+1 Vitality DMG · -8% Hit',
    essenceCost: 1,
    damageBonus: 1,
    hitBonus: -8,
    critBonus: 6,
  },
];

export interface ReactionOption {
  id: ReactionId;
  name: string;
  enemyName: string;
  shortDesc: string;
  reactionCost: number;
  essenceCost: number;
  damageReduction: number;
  evasionBonus: number;
  negatesCrit: boolean;
  blocksEffects: boolean;
  available: boolean;
  reason?: string;
}

export interface TacticalUnit {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  sheetId: CharacterSheetId;
  x: number;
  y: number;
  facing: FacingDir;
  /** Low-number X-COM Vitality (6..10) */
  vitality: number;
  maxVitality: number;
  /** Arcane / Martial Essence pool (4..6) */
  essence: number;
  maxEssence: number;
  /** Low-number Evasion rating (2..4; each point reduces incoming Hit by 8%) */
  evasion: number;
  /** Defensive Reaction charge refreshed each turn (1) */
  reaction: number;
  maxReaction: number;
  /** Every combatant has strictly ONE signature defensive Reaction */
  signatureReaction: Exclude<ReactionId, 'none'>;
  /** Low-number combat power modifier */
  atk: number;
  mov: number;
  jmp: number;
  spd: number;
  crit: number;
  guarding: boolean;
  /** True when Shadow activates Smoke Screen stealth (reappears on attack; +25% Hit from shadow) */
  hidden: boolean;
  /** Active elemental blade infusion for Aiori (Red Ferunium Fire / Blue Auruinum Arcane) */
  swordElement: SwordElement;
  slowedTurns: number;
  hasMoved: boolean;
  hasActed: boolean;
  alive: boolean;
  aiPolicy?: AIPolicy;
  skills: SkillDef[];
  accentColor: string;
}

export interface GridPos {
  x: number;
  y: number;
}

export interface ReachableNode {
  x: number;
  y: number;
  cost: number;
  parentKey: string | null;
}

export interface KnockbackOutcome {
  targetX: number;
  targetY: number;
  bonusDamage: number;
  reason: 'push' | 'wall' | 'fall';
}

export interface CombatForecast {
  attackerId: string;
  defenderId: string;
  skill: SkillDef;
  stance: AttackStanceOption;
  reaction: ReactionId;
  elevationDelta: number;
  attackerHeight: number;
  defenderHeight: number;
  elevationDamageBonus: number;
  elevationHitBonus: number;
  attackAngle: AttackAngle;
  flankDamageBonus: number;
  fromShadowBonus: boolean;
  activeBladeBonus: SwordElement;
  defenderTotalEvasion: number;
  rawDamage: number;
  damageMitigated: number;
  expectedDamage: number;
  minDamage: number;
  maxDamage: number;
  hitChance: number;
  critChance: number;
  totalEssenceCost: number;
  projectedDefenderVitality: number;
  willKill: boolean;
  knockbackOutcome: KnockbackOutcome | null;
}

export interface CombatClashResult {
  forecast: CombatForecast;
  outcomeKind: ClashOutcomeKind;
  didHit: boolean;
  didCrit: boolean;
  didKill: boolean;
  finalDamage: number;
  mitigatedDamage: number;
  attackerEssenceSpent: number;
  defenderEssenceSpent: number;
  defenderReactionSpent: number;
  reactionUsed: ReactionId;
  stanceUsed: AttackStanceId;
  defenderVitalityBefore: number;
  defenderVitalityAfter: number;
  appliedSlow: boolean;
  revealedAttacker: boolean;
  flushedDefender: boolean;
  imbuedSword: SwordElement | null;
  knockbackOutcome: KnockbackOutcome | null;
  headline: string;
  subline: string;
  tags: string[];
}

export interface AIActionPlan {
  movePath: GridPos[];
  targetId: string | null;
  skill: SkillDef | null;
  useSmokeScreen?: boolean;
  finalFacing: FacingDir;
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Returns character- and ability-specific attack modifications inside the Stage 1 Target Cut-In.
 */
export function getAttackModifications(
  attacker: TacticalUnit,
  skill: SkillDef
): AttackStanceOption[] {
  if (attacker.sheetId === 'aryon') {
    if (skill.category === 'attack') {
      return [
        {
          id: 'standard',
          name: 'Boiling Pulse',
          shortDesc: 'Blood-accelerated hand strike · 0 extra ESS',
          essenceCost: 0,
          damageBonus: 0,
          hitBonus: 0,
          critBonus: 0,
        },
        {
          id: 'focused',
          name: 'Vein Velocity',
          shortDesc: 'Hyper-speed rush · +18% Hit · +12% Crit',
          essenceCost: 1,
          damageBonus: 0,
          hitBonus: 18,
          critBonus: 12,
        },
        {
          id: 'heavy',
          name: 'Blood Boil',
          shortDesc: 'Max kinetic surge · +2 VIT DMG · -8% Hit',
          essenceCost: 1,
          damageBonus: 2,
          hitBonus: -8,
          critBonus: 6,
        },
      ];
    }
    return [
      {
        id: 'standard',
        name: 'Kindled Cast',
        shortDesc: 'Balanced fire weave · 0 extra ESS',
        essenceCost: 0,
        damageBonus: 0,
        hitBonus: 0,
        critBonus: 0,
      },
      {
        id: 'focused',
        name: 'Focused Flare',
        shortDesc: 'Tighter flame arc · +16% Hit · +10% Crit',
        essenceCost: 1,
        damageBonus: 0,
        hitBonus: 16,
        critBonus: 10,
      },
      {
        id: 'heavy',
        name: 'Inferno Surge',
        shortDesc: '+1 Fire DMG · +1 Shield Pierce · -8% Hit',
        essenceCost: 1,
        damageBonus: 1,
        hitBonus: -8,
        critBonus: 8,
        pierceBonus: 1,
      },
    ];
  }

  if (attacker.sheetId === 'aiori') {
    if (skill.category === 'attack') {
      const bladeLabel =
        attacker.swordElement === 'ferunium'
          ? 'Ferunium Edge'
          : attacker.swordElement === 'auruinum'
          ? 'Auruinum Edge'
          : 'Iron Edge';
      return [
        {
          id: 'standard',
          name: bladeLabel,
          shortDesc:
            attacker.swordElement === 'ferunium'
              ? 'Red Fire infusion active (+1 Fire DMG · 1 Pierce)'
              : attacker.swordElement === 'auruinum'
              ? 'Blue Arcane infusion active (+12% Hit · +10% Crit)'
              : 'Balanced greatsword swing · 0 extra ESS',
          essenceCost: 0,
          damageBonus: 0,
          hitBonus: 0,
          critBonus: 0,
        },
        {
          id: 'focused',
          name: 'Precision Cut',
          shortDesc: 'Measured blade arc · +16% Hit · +10% Crit',
          essenceCost: 1,
          damageBonus: 0,
          hitBonus: 16,
          critBonus: 10,
        },
        {
          id: 'heavy',
          name: 'Breaker Cleave',
          shortDesc: 'Heavy iron momentum · +1 VIT DMG · +1 Pierce · -8% Hit',
          essenceCost: 1,
          damageBonus: 1,
          hitBonus: -8,
          critBonus: 6,
          pierceBonus: 1,
        },
      ];
    }
    return [
      {
        id: 'standard',
        name: 'Channel Blade',
        shortDesc: 'Ignite elemental edge · 0 extra ESS',
        essenceCost: 0,
        damageBonus: 0,
        hitBonus: 0,
        critBonus: 0,
      },
      {
        id: 'focused',
        name: 'Keen Resonance',
        shortDesc: 'Sharpened elemental arc · +16% Hit · +12% Crit',
        essenceCost: 1,
        damageBonus: 0,
        hitBonus: 16,
        critBonus: 12,
      },
      {
        id: 'heavy',
        name: 'Overcharge Edge',
        shortDesc: '+1 Elemental DMG · +1 Pierce · -8% Hit',
        essenceCost: 1,
        damageBonus: 1,
        hitBonus: -8,
        critBonus: 8,
        pierceBonus: 1,
      },
    ];
  }

  return ATTACK_STANCES;
}

export function getStanceOption(
  id: AttackStanceId,
  attacker?: TacticalUnit,
  skill?: SkillDef
): AttackStanceOption {
  const list = attacker && skill ? getAttackModifications(attacker, skill) : ATTACK_STANCES;
  return list.find((s) => s.id === id) ?? list[0];
}

/**
 * Computes isometric facing direction from grid tile (ax, ay) toward (bx, by).
 */
export function computeFacingToward(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  fallback: FacingDir = 'NE'
): FacingDir {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'SE' : 'NW';
  }
  return dy > 0 ? 'SW' : 'NE';
}

/**
 * Computes whether an attack from (ax, ay) strikes a defender at (dx, dy)
 * facing `defenderFacing` from the FRONT, SIDE, or BACK.
 */
export function getAttackAngle(
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  defenderFacing: FacingDir
): AttackAngle {
  const vx = ax - dx;
  const vy = ay - dy;
  const fwd: Record<FacingDir, [number, number]> = {
    SE: [1, 0],
    NW: [-1, 0],
    SW: [0, 1],
    NE: [0, -1],
  };
  const [fx, fy] = fwd[defenderFacing];
  const dot = vx * fx + vy * fy;
  const cross = Math.abs(vx * fy - vy * fx);
  if (dot > 0 && dot >= cross) return 'FRONT';
  if (dot < 0 && Math.abs(dot) >= cross) return 'BACK';
  return 'SIDE';
}

/**
 * Returns the portrait mood for a unit based on Vitality ratio and current combat event.
 */
export function resolveUnitMood(
  unit: TacticalUnit,
  override?: PortraitMood | null
): PortraitMood {
  if (override) return override;
  if (unit.vitality / unit.maxVitality <= 0.45) return 'wounded';
  return 'neutral';
}

/**
 * Returns the single signature defensive Reaction unique to this unit.
 * Every hero and enemy has strictly ONE defensive Reaction type.
 */
export function getSignatureReaction(defender: TacticalUnit): ReactionOption {
  const hasReact = defender.reaction >= 1;

  if (defender.signatureReaction === 'escudo_ergeo') {
    const canAfford = hasReact && defender.essence >= 1;
    return {
      id: 'escudo_ergeo',
      name: 'Escudo Ergeo',
      enemyName: 'Escudo Ergeo',
      shortDesc: 'Arcane shield deflection · Absorb up to 3 DMG & negate Crit/Effects',
      reactionCost: 1,
      essenceCost: 1,
      damageReduction: 3,
      evasionBonus: 0,
      negatesCrit: true,
      blocksEffects: true,
      available: canAfford,
      reason: !hasReact
        ? 'No Reaction left'
        : defender.essence < 1
        ? 'Needs 1 Essence'
        : undefined,
    };
  }

  if (defender.signatureReaction === 'steel_guard') {
    return {
      id: 'steel_guard',
      name: 'Steel Guard',
      enemyName: 'Steel Guard',
      shortDesc: 'Two-handed greatsword parry · Reduce Vitality DMG by 2 & negate Crit',
      reactionCost: 1,
      essenceCost: 0,
      damageReduction: 2,
      evasionBonus: 0,
      negatesCrit: true,
      blocksEffects: false,
      available: hasReact,
      reason: hasReact ? undefined : 'No Reaction left',
    };
  }

  return {
    id: 'shadow_veil',
    name: 'Shadow Veil',
    enemyName: 'Shadow Veil',
    shortDesc: 'Smoke-mist sidestep · +3 Evasion (-24% Enemy Hit) for this clash',
    reactionCost: 1,
    essenceCost: 0,
    damageReduction: 0,
    evasionBonus: 3,
    negatesCrit: false,
    blocksEffects: false,
    available: hasReact,
    reason: hasReact ? undefined : 'No Reaction left',
  };
}

/**
 * Returns Endure ('none') + the defender's single signature Reaction for the Stage 2 Cut-In.
 */
export function getAvailableReactions(defender: TacticalUnit): ReactionOption[] {
  return [
    {
      id: 'none',
      name: 'Endure',
      enemyName: 'No Reaction',
      shortDesc: 'Save Reaction · Absorb full incoming strike',
      reactionCost: 0,
      essenceCost: 0,
      damageReduction: 0,
      evasionBonus: 0,
      negatesCrit: false,
      blocksEffects: false,
      available: true,
    },
    getSignatureReaction(defender),
  ];
}

/**
 * Enemy AI defensive Reaction policy: Shadows have only ONE Reaction (Shadow Veil)
 * and trigger it whenever charged against threatening attacks.
 */
export function chooseEnemyReaction(
  defender: TacticalUnit,
  baseForecast: CombatForecast
): ReactionId {
  const sig = getSignatureReaction(defender);
  if (!sig.available) return 'none';
  if (baseForecast.willKill || baseForecast.expectedDamage >= 2 || baseForecast.hitChance >= 55) {
    return sig.id;
  }
  return 'none';
}

/**
 * Elevation-aware Dijkstra pathfinding across the 30x30 topology.
 */
export function computeReachableTiles(
  unit: TacticalUnit,
  tiles: TileData[][],
  units: TacticalUnit[]
): Map<string, ReachableNode> {
  const N = tiles.length;
  const effectiveMov = Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0));

  const occupiedByEnemy = new Set<string>();
  const occupiedByAny = new Set<string>();
  for (const other of units) {
    if (!other.alive || other.id === unit.id) continue;
    const k = tileKey(other.x, other.y);
    occupiedByAny.add(k);
    if (other.faction !== unit.faction) {
      occupiedByEnemy.add(k);
    }
  }

  const visited = new Map<string, ReachableNode>();
  const startKey = tileKey(unit.x, unit.y);
  visited.set(startKey, { x: unit.x, y: unit.y, cost: 0, parentKey: null });

  const queue: ReachableNode[] = [{ x: unit.x, y: unit.y, cost: 0, parentKey: null }];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;
    const currTile = tiles[curr.y][curr.x];

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;

      const nextTile = tiles[ny][nx];
      if (nextTile.blocked) continue;

      const nk = tileKey(nx, ny);
      if (occupiedByEnemy.has(nk)) continue;

      const dh = nextTile.height - currTile.height;
      if (dh > unit.jmp) continue;
      if (-dh > unit.jmp + 1) continue;

      const stepCost = nextTile.moveCost;
      const nextCost = curr.cost + stepCost;
      if (nextCost > effectiveMov) continue;

      const prev = visited.get(nk);
      if (!prev || nextCost < prev.cost) {
        const node: ReachableNode = {
          x: nx,
          y: ny,
          cost: nextCost,
          parentKey: tileKey(curr.x, curr.y),
        };
        visited.set(nk, node);
        queue.push(node);
      }
    }
  }

  for (const occKey of occupiedByAny) {
    if (occKey !== startKey) {
      visited.delete(occKey);
    }
  }

  return visited;
}

/**
 * Reconstructs the exact tile-by-tile movement path from unit position to (destX, destY).
 */
export function findPathToTile(
  unit: TacticalUnit,
  destX: number,
  destY: number,
  tiles: TileData[][],
  units: TacticalUnit[]
): GridPos[] | null {
  const N = tiles.length;
  const effectiveMov = Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0));
  const occupiedByEnemy = new Set<string>();
  const occupiedByAny = new Set<string>();
  for (const other of units) {
    if (!other.alive || other.id === unit.id) continue;
    const k = tileKey(other.x, other.y);
    occupiedByAny.add(k);
    if (other.faction !== unit.faction) occupiedByEnemy.add(k);
  }
  const destKey = tileKey(destX, destY);
  if (occupiedByAny.has(destKey)) return null;

  const visited = new Map<string, ReachableNode>();
  const startKey = tileKey(unit.x, unit.y);
  visited.set(startKey, { x: unit.x, y: unit.y, cost: 0, parentKey: null });
  const queue: ReachableNode[] = [{ x: unit.x, y: unit.y, cost: 0, parentKey: null }];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;
    const currKey = tileKey(curr.x, curr.y);
    if (currKey === destKey) break;
    const currTile = tiles[curr.y][curr.x];

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
      const nextTile = tiles[ny][nx];
      if (nextTile.blocked) continue;
      const nk = tileKey(nx, ny);
      if (occupiedByEnemy.has(nk)) continue;
      const dh = nextTile.height - currTile.height;
      if (dh > unit.jmp || -dh > unit.jmp + 1) continue;
      const nextCost = curr.cost + nextTile.moveCost;
      if (nextCost > effectiveMov) continue;
      const prev = visited.get(nk);
      if (!prev || nextCost < prev.cost) {
        const node: ReachableNode = { x: nx, y: ny, cost: nextCost, parentKey: currKey };
        visited.set(nk, node);
        queue.push(node);
      }
    }
  }

  if (!visited.has(destKey)) return null;
  const path: GridPos[] = [];
  let cursor: string | null = destKey;
  while (cursor) {
    const node = visited.get(cursor);
    if (!node) break;
    path.push({ x: node.x, y: node.y });
    cursor = node.parentKey;
  }
  return path.reverse();
}

/**
 * Full-map elevation-aware A* pathfinder used by AI & topology verification tests.
 */
export function findLongRangePath(
  unit: TacticalUnit,
  goalX: number,
  goalY: number,
  tiles: TileData[][],
  units: TacticalUnit[]
): GridPos[] | null {
  const N = tiles.length;
  if (goalX < 0 || goalX >= N || goalY < 0 || goalY >= N) return null;
  if (tiles[goalY][goalX].blocked) return null;

  const occupiedByEnemy = new Set<string>();
  for (const other of units) {
    if (!other.alive || other.id === unit.id) continue;
    if (other.faction !== unit.faction) {
      occupiedByEnemy.add(tileKey(other.x, other.y));
    }
  }

  const startKey = tileKey(unit.x, unit.y);
  const goalKey = tileKey(goalX, goalY);

  const gScore = new Map<string, number>([[startKey, 0]]);
  const parent = new Map<string, string | null>([[startKey, null]]);
  const open: { x: number; y: number; f: number }[] = [
    { x: unit.x, y: unit.y, f: Math.abs(goalX - unit.x) + Math.abs(goalY - unit.y) },
  ];
  const closed = new Set<string>();

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const curr = open.shift()!;
    const ck = tileKey(curr.x, curr.y);
    if (ck === goalKey) {
      const path: GridPos[] = [];
      let cur: string | null = goalKey;
      while (cur) {
        const [px, py] = cur.split(',').map(Number);
        path.push({ x: px, y: py });
        cur = parent.get(cur) ?? null;
      }
      return path.reverse();
    }
    if (closed.has(ck)) continue;
    closed.add(ck);

    const currTile = tiles[curr.y][curr.x];
    const currG = gScore.get(ck) ?? 0;

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
      const nk = tileKey(nx, ny);
      if (closed.has(nk)) continue;

      const nextTile = tiles[ny][nx];
      if (nextTile.blocked) continue;
      if (occupiedByEnemy.has(nk) && nk !== goalKey) continue;

      const dh = nextTile.height - currTile.height;
      if (dh > unit.jmp || -dh > unit.jmp + 1) continue;

      const tentativeG = currG + nextTile.moveCost;
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentativeG);
        parent.set(nk, ck);
        const h = Math.abs(goalX - nx) + Math.abs(goalY - ny);
        open.push({ x: nx, y: ny, f: tentativeG + h });
      }
    }
  }

  return null;
}

/**
 * Returns all tiles targetable by a given skill from `unit`'s current tile,
 * respecting Tactics Ogre high-ground range extensions (+1 range when higher).
 */
export function getSkillTargetTiles(
  unit: TacticalUnit,
  skill: SkillDef,
  tiles: TileData[][]
): GridPos[] {
  const N = tiles.length;
  const originTile = tiles[unit.y][unit.x];
  const result: GridPos[] = [];

  if (skill.isSelfBuff) {
    return [{ x: unit.x, y: unit.y }];
  }

  const maxSearch = skill.maxRange + (skill.elevationRangeBonus ? 2 : 0);

  for (let y = Math.max(0, unit.y - maxSearch); y <= Math.min(N - 1, unit.y + maxSearch); y++) {
    for (let x = Math.max(0, unit.x - maxSearch); x <= Math.min(N - 1, unit.x + maxSearch); x++) {
      const dist = Math.abs(x - unit.x) + Math.abs(y - unit.y);
      if (dist < skill.minRange) continue;
      const targetTile = tiles[y][x];
      if (targetTile.blocked) continue;

      const dh = originTile.height - targetTile.height;
      if (skill.kind === 'melee' && Math.abs(dh) > 2) continue;

      const elevBonusRange = skill.elevationRangeBonus && dh >= 2 ? 1 : 0;
      const effectiveMax = Math.max(skill.minRange, skill.maxRange + elevBonusRange);
      if (dist <= effectiveMax) {
        result.push({ x, y });
      }
    }
  }

  return result;
}

/**
 * Evaluates knockback physics (cliff fall bonus +2 VIT or wall crush +1 VIT).
 */
function evaluateKnockback(
  attacker: TacticalUnit,
  defender: TacticalUnit,
  tiles: TileData[][],
  units: TacticalUnit[]
): KnockbackOutcome | null {
  const dx = Math.sign(defender.x - attacker.x);
  const dy = Math.sign(defender.y - attacker.y);
  const stepX = Math.abs(defender.x - attacker.x) >= Math.abs(defender.y - attacker.y) ? dx : 0;
  const stepY = stepX === 0 ? dy : 0;
  if (stepX === 0 && stepY === 0) return null;

  const nx = defender.x + stepX;
  const ny = defender.y + stepY;
  const N = tiles.length;
  if (nx < 0 || nx >= N || ny < 0 || ny >= N) {
    return { targetX: defender.x, targetY: defender.y, bonusDamage: 1, reason: 'wall' };
  }

  const destTile = tiles[ny][nx];
  const currTile = tiles[defender.y][defender.x];
  const occupied = units.some((u) => u.alive && u.x === nx && u.y === ny);

  if (destTile.blocked || occupied) {
    return { targetX: defender.x, targetY: defender.y, bonusDamage: 1, reason: 'wall' };
  }

  const drop = currTile.height - destTile.height;
  if (drop >= 2) {
    return { targetX: nx, targetY: ny, bonusDamage: 2, reason: 'fall' };
  }
  return { targetX: nx, targetY: ny, bonusDamage: 0, reason: 'push' };
}

/**
 * Computes the low-number X-COM tactical combat forecast between attacker and defender,
 * accounting for Attack Stance options and Defender Reactions.
 */
export function calculateCombatForecast(
  attacker: TacticalUnit,
  defender: TacticalUnit,
  skill: SkillDef,
  tiles: TileData[][],
  units: TacticalUnit[],
  stanceId: AttackStanceId = 'standard',
  reactionId: ReactionId = 'none'
): CombatForecast {
  const atkTile = tiles[attacker.y][attacker.x];
  const defTile = tiles[defender.y][defender.x];
  const stance = getStanceOption(stanceId, attacker, skill);
  const reactionOpt =
    getAvailableReactions(defender).find((r) => r.id === reactionId) ??
    getAvailableReactions(defender)[0];

  const elevationDelta = atkTile.height - defTile.height;
  const elevationDamageBonus = elevationDelta >= 2 ? 1 : elevationDelta <= -2 ? -1 : 0;
  const elevationHitBonus = elevationDelta >= 2 ? 15 : elevationDelta <= -2 ? -10 : 0;

  const attackAngle = getAttackAngle(
    attacker.x,
    attacker.y,
    defender.x,
    defender.y,
    defender.facing
  );
  const flankDamageBonus = attackAngle === 'BACK' ? 2 : attackAngle === 'SIDE' ? 1 : 0;
  const flankHitBonus = attackAngle === 'BACK' ? 12 : attackAngle === 'SIDE' ? 6 : 0;
  const flankCritBonus = attackAngle === 'BACK' ? 18 : attackAngle === 'SIDE' ? 8 : 0;

  // Smoke Screen Stealth Ambush Bonus (+25% Hit & +10% Crit when attacking from Shadow!)
  const fromShadowBonus = Boolean(attacker.hidden);
  const fromShadowHitBonus = fromShadowBonus ? 25 : 0;
  const fromShadowCritBonus = fromShadowBonus ? 10 : 0;

  // Aiori's Elemental Sword passive bonus applied to Physical Attack
  const activeBladeBonus: SwordElement =
    attacker.sheetId === 'aiori' && skill.category === 'attack'
      ? attacker.swordElement
      : skill.imbuesSword ?? 'none';
  const bladeDmgBonus =
    attacker.sheetId === 'aiori' && skill.category === 'attack' && attacker.swordElement === 'ferunium'
      ? 1
      : 0;
  const bladeHitBonus =
    attacker.sheetId === 'aiori' && skill.category === 'attack' && attacker.swordElement === 'auruinum'
      ? 12
      : 0;
  const bladeCritBonus =
    attacker.sheetId === 'aiori' && skill.category === 'attack' && attacker.swordElement === 'auruinum'
      ? 10
      : 0;
  const bladePierceBonus =
    attacker.sheetId === 'aiori' && skill.category === 'attack' && attacker.swordElement !== 'none'
      ? 1
      : 0;

  const terrainEvasion = Math.round(defTile.evasionBonus / 10);
  const hiddenDefenderEvasion = defender.hidden ? 2 : 0;
  const defenderTotalEvasion = Math.max(
    0,
    defender.evasion + terrainEvasion + hiddenDefenderEvasion + reactionOpt.evasionBonus
  );

  const knockbackOutcome =
    skill.knockback && !reactionOpt.blocksEffects
      ? evaluateKnockback(attacker, defender, tiles, units)
      : null;

  // Low-number X-COM damage calculation
  const rawBase =
    skill.baseDamage +
    attacker.atk +
    bladeDmgBonus +
    stance.damageBonus +
    elevationDamageBonus +
    flankDamageBonus +
    (knockbackOutcome?.bonusDamage ?? 0);
  const rawDamage = Math.max(1, rawBase);

  // Defense Guard (-1 DMG) + Single Signature Reaction mitigation, reduced by Pierce
  const guardReduction = defender.guarding ? 1 : 0;
  const totalPierce = (skill.pierce ?? 0) + (stance.pierceBonus ?? 0) + bladePierceBonus;
  const reactionMitigation = Math.max(0, reactionOpt.damageReduction - totalPierce);
  const totalMitigation = guardReduction + reactionMitigation;

  const expectedDamage =
    reactionId === 'escudo_ergeo'
      ? Math.max(0, rawDamage - totalMitigation)
      : Math.max(1, rawDamage - totalMitigation);
  const damageMitigated = Math.max(0, rawDamage - expectedDamage);

  // Low-number X-COM hit chance (each point of Evasion = -8% Hit)
  const hitRaw =
    92 +
    skill.accuracyBonus +
    bladeHitBonus +
    stance.hitBonus +
    elevationHitBonus +
    flankHitBonus +
    fromShadowHitBonus -
    defenderTotalEvasion * 8;
  const hitChance = Math.max(20, Math.min(99, Math.round(hitRaw)));

  const critRaw = reactionOpt.negatesCrit
    ? 0
    : attacker.crit +
      skill.critBonus +
      bladeCritBonus +
      stance.critBonus +
      flankCritBonus +
      fromShadowCritBonus;
  const critChance = Math.max(0, Math.min(75, Math.round(critRaw)));

  const projectedDefenderVitality = Math.max(0, defender.vitality - expectedDamage);

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    skill,
    stance,
    reaction: reactionId,
    elevationDelta,
    attackerHeight: atkTile.height,
    defenderHeight: defTile.height,
    elevationDamageBonus,
    elevationHitBonus,
    attackAngle,
    flankDamageBonus,
    fromShadowBonus,
    activeBladeBonus,
    defenderTotalEvasion,
    rawDamage,
    damageMitigated,
    expectedDamage,
    minDamage: expectedDamage,
    maxDamage: expectedDamage + (critChance > 0 ? 2 : 0),
    hitChance,
    critChance,
    totalEssenceCost: skill.essenceCost + stance.essenceCost,
    projectedDefenderVitality,
    willKill: projectedDefenderVitality <= 0,
    knockbackOutcome,
  };
}

/**
 * Resolves a single combat clash (after Stage 2 Reaction confirmation) into
 * the concrete Stage 3 Defender Cut-In Outcome.
 */
export function resolveCombatClash(
  attacker: TacticalUnit,
  defender: TacticalUnit,
  skill: SkillDef,
  tiles: TileData[][],
  units: TacticalUnit[],
  stanceId: AttackStanceId,
  reactionId: ReactionId,
  rng: () => number = Math.random
): CombatClashResult {
  const forecast = calculateCombatForecast(
    attacker,
    defender,
    skill,
    tiles,
    units,
    stanceId,
    reactionId
  );
  const reactionOpt =
    getAvailableReactions(defender).find((r) => r.id === reactionId) ??
    getAvailableReactions(defender)[0];

  const hitRoll = rng() * 100;
  const didHit = hitRoll <= forecast.hitChance;
  const didCrit = didHit && forecast.critChance > 0 && rng() * 100 <= forecast.critChance;

  let finalDamage = 0;
  let outcomeKind: ClashOutcomeKind = 'hit';

  if (!didHit) {
    outcomeKind = 'evaded';
    finalDamage = 0;
  } else {
    finalDamage = didCrit ? forecast.expectedDamage + 2 : forecast.expectedDamage;
    if (reactionId === 'escudo_ergeo') {
      outcomeKind = 'shielded';
    } else if (reactionId === 'steel_guard') {
      outcomeKind = 'blocked';
    } else if (didCrit) {
      outcomeKind = 'crit';
    } else {
      outcomeKind = 'hit';
    }
  }

  const defenderVitalityBefore = defender.vitality;
  const defenderVitalityAfter = Math.max(0, defenderVitalityBefore - finalDamage);
  const didKill = defenderVitalityAfter <= 0;
  const appliedSlow = didHit && Boolean(skill.applySlow) && !reactionOpt.blocksEffects;
  const knockbackOutcome =
    didHit && !didKill && !reactionOpt.blocksEffects ? forecast.knockbackOutcome : null;

  // Attacking from Smoke Screen immediately reveals the attacker; taking a hit flushes a hidden defender
  const revealedAttacker = Boolean(attacker.hidden);
  const flushedDefender = didHit && Boolean(defender.hidden);
  const imbuedSword = skill.imbuesSword ?? null;

  const tags: string[] = [];
  if (forecast.fromShadowBonus) tags.push('FROM SHADOW +25% HIT');
  if (imbuedSword === 'ferunium') tags.push('FERUNIUM FIRE');
  else if (imbuedSword === 'auruinum') tags.push('AURUINUM ARCANE');
  else if (forecast.activeBladeBonus === 'ferunium') tags.push('FERUNIUM +1 FIRE');
  else if (forecast.activeBladeBonus === 'auruinum') tags.push('AURUINUM ARCANE');
  if (didCrit) tags.push('CRITICAL +2');
  if (forecast.elevationDelta >= 2) tags.push('HIGH GROUND +1');
  if (forecast.attackAngle === 'BACK') tags.push('BACKSTAB +2');
  else if (forecast.attackAngle === 'SIDE') tags.push('FLANK +1');
  if (appliedSlow) tags.push('SCORCH SLOW');
  if (flushedDefender) tags.push('REVEALED');
  if (knockbackOutcome?.reason === 'fall') tags.push('CLIFF FALL +2');
  if (knockbackOutcome?.reason === 'wall') tags.push('WALL CRUSH +1');

  const reactionLabel = reactionOpt.name;

  let headline = '';
  let subline = '';
  if (outcomeKind === 'evaded') {
    headline = 'EVADED!';
    subline =
      reactionId === 'shadow_veil'
        ? `${defender.name} triggered ${reactionLabel} and slipped past ${skill.name}!`
        : `${defender.name}'s Evasion (${forecast.defenderTotalEvasion}) dodged the strike.`;
  } else if (didKill) {
    headline = `FALLEN! -${finalDamage} VIT`;
    subline = `${defender.name} collapses under ${attacker.name}'s ${skill.name}!`;
  } else if (outcomeKind === 'shielded') {
    headline =
      finalDamage === 0
        ? `ESCUDO ERGEO! 0 DMG`
        : `ESCUDO ERGEO! -${finalDamage} VIT`;
    subline =
      forecast.damageMitigated > 0
        ? `Arcane shield deflected ${forecast.damageMitigated} Vitality damage & blocked secondary effects.`
        : `Heavy strike cracked through the arcane barrier.`;
  } else if (outcomeKind === 'blocked') {
    headline = `STEEL GUARD! -${finalDamage} VIT`;
    subline = `${defender.name}'s ${reactionLabel} absorbed ${forecast.damageMitigated} damage and negated critical impact.`;
  } else if (outcomeKind === 'crit') {
    headline = `CRITICAL! -${finalDamage} VIT`;
    subline = `Devastating ${skill.name} tore through ${defender.name}'s guard!`;
  } else {
    headline = `IMPACT! -${finalDamage} VIT`;
    subline = `${attacker.name}'s ${skill.name} struck ${defender.name} squarely.`;
  }

  return {
    forecast,
    outcomeKind,
    didHit,
    didCrit,
    didKill,
    finalDamage,
    mitigatedDamage: didHit ? forecast.damageMitigated : forecast.rawDamage,
    attackerEssenceSpent: forecast.totalEssenceCost,
    defenderEssenceSpent: reactionOpt.essenceCost,
    defenderReactionSpent: reactionOpt.reactionCost,
    reactionUsed: reactionId,
    stanceUsed: stanceId,
    defenderVitalityBefore,
    defenderVitalityAfter,
    appliedSlow,
    revealedAttacker,
    flushedDefender,
    imbuedSword,
    knockbackOutcome,
    headline,
    subline,
    tags,
  };
}

/**
 * Generates the balanced 5 combatant units:
 * - Aiori Suiciniv (Iron Vanguard — Physical Greatsword + Ferunium Fire / Auruinum Arcane Essence blades, Steel Guard Reaction)
 * - Aryon Fallen (Fire Mage — Blood-Rush physical hand strike + Globus Inflamus & Chamus Continuos Fire Essence, Escudo Ergeo Reaction)
 * - 3x Shadow Panthers (Balanced Highland Pack with Smoke Screen stealth + Shadow Veil single Reaction)
 */
export function createInitialUnits(): TacticalUnit[] {
  const aioriSkills: SkillDef[] = [
    {
      id: 'greatsword_strike',
      name: 'Greatsword Strike',
      description:
        'Heavy physical iron-blade cleave. Channels active Ferunium (Fire) or Auruinum (Arcane) blade infusion.',
      category: 'attack',
      element: 'physical',
      essenceCost: 0,
      minRange: 1,
      maxRange: 1,
      elevationRangeBonus: false,
      baseDamage: 2,
      accuracyBonus: 6,
      critBonus: 6,
      kind: 'melee',
    },
    {
      id: 'ferunium_blade',
      name: 'Ferunium Blade',
      description:
        'Red Sword — Fire Essence. Ignites greatsword in crimson flame (+Fire DMG, 1 Guard Pierce) and imbues future attacks.',
      category: 'essence',
      element: 'fire',
      essenceCost: 1,
      minRange: 1,
      maxRange: 1,
      elevationRangeBonus: false,
      baseDamage: 3,
      accuracyBonus: 4,
      critBonus: 8,
      pierce: 1,
      imbuesSword: 'ferunium',
      kind: 'melee',
    },
    {
      id: 'auruinum_blade',
      name: 'Auruinum Blade',
      description:
        'Blue Sword — Arcane Essence. Charges greatsword with azure arcane edge (+18% Hit, +14% Crit, 2 Pierce) and imbues future attacks.',
      category: 'essence',
      element: 'arcane',
      essenceCost: 1,
      minRange: 1,
      maxRange: 1,
      elevationRangeBonus: false,
      baseDamage: 2,
      accuracyBonus: 18,
      critBonus: 14,
      pierce: 2,
      imbuesSword: 'auruinum',
      kind: 'melee',
    },
    {
      id: 'iron_bastion',
      name: 'Iron Bastion',
      description:
        'Vanguard Defensive Passive: brace plate armor (-1 incoming DMG), recover +2 Vitality & refresh Steel Guard.',
      category: 'defense',
      element: 'physical',
      essenceCost: 0,
      minRange: 0,
      maxRange: 0,
      elevationRangeBonus: false,
      baseDamage: 0,
      accuracyBonus: 0,
      critBonus: 0,
      isSelfBuff: true,
      kind: 'buff',
    },
  ];

  const aryonSkills: SkillDef[] = [
    {
      id: 'blood_rush_strike',
      name: 'Blood-Rush Strike',
      description:
        'Physical hand strike propelled by boiling his own blood for blistering velocity and kinetic force.',
      category: 'attack',
      element: 'physical',
      essenceCost: 0,
      minRange: 1,
      maxRange: 1,
      elevationRangeBonus: false,
      baseDamage: 2,
      accuracyBonus: 14,
      critBonus: 10,
      kind: 'melee',
    },
    {
      id: 'globus_inflamus',
      name: 'Globus Inflamus',
      description:
        'Fire Essence: hurls a compressed orb of roaring highland flame. Gains +1 range from High Ground.',
      category: 'essence',
      element: 'fire',
      essenceCost: 2,
      minRange: 1,
      maxRange: 5,
      elevationRangeBonus: true,
      baseDamage: 3,
      accuracyBonus: 8,
      critBonus: 10,
      kind: 'ranged',
    },
    {
      id: 'chamus_continuos',
      name: 'Chamus Continuos',
      description:
        'Fire Essence: sustained torrent of searing flame that pierces 1 Guard and scorches movement (-2 MOV).',
      category: 'essence',
      element: 'fire',
      essenceCost: 3,
      minRange: 1,
      maxRange: 3,
      elevationRangeBonus: true,
      baseDamage: 4,
      accuracyBonus: 12,
      critBonus: 12,
      pierce: 1,
      applySlow: true,
      kind: 'ranged',
    },
    {
      id: 'sanguine_ward',
      name: 'Sanguine Ward',
      description:
        'Fire Mage Defensive Passive: steady boiling blood (-1 incoming DMG), restore +2 Essence & refresh Escudo Ergeo.',
      category: 'defense',
      element: 'fire',
      essenceCost: 0,
      minRange: 0,
      maxRange: 0,
      elevationRangeBonus: false,
      baseDamage: 0,
      accuracyBonus: 0,
      critBonus: 0,
      isSelfBuff: true,
      kind: 'buff',
    },
  ];

  const shadowSkills: SkillDef[] = [
    {
      id: 'rending_claws',
      name: 'Rending Claws',
      description:
        'Ferocious physical claw swipe. Gains +25% Hit & +10% Crit when striking unseen from Smoke Screen.',
      category: 'attack',
      element: 'physical',
      essenceCost: 0,
      minRange: 1,
      maxRange: 1,
      elevationRangeBonus: false,
      baseDamage: 2,
      accuracyBonus: 4,
      critBonus: 8,
      kind: 'melee',
    },
    {
      id: 'smoke_screen',
      name: 'Smoke Screen',
      description:
        'Shadow Essence: erupts dark smoke to vanish (+2 EVA). Next strike from Shadow gains +25% Hit & reveals position.',
      category: 'essence',
      element: 'shadow',
      essenceCost: 1,
      minRange: 0,
      maxRange: 0,
      elevationRangeBonus: false,
      baseDamage: 0,
      accuracyBonus: 0,
      critBonus: 0,
      grantsHidden: true,
      isSelfBuff: true,
      kind: 'buff',
    },
    {
      id: 'shadow_pounce',
      name: 'Shadow Pounce',
      description:
        'Shadow Essence: lunging ridge ambush across 2 tiles. Strikes with +25% Hit when leaping from Smoke Screen.',
      category: 'essence',
      element: 'shadow',
      essenceCost: 2,
      minRange: 1,
      maxRange: 2,
      elevationRangeBonus: false,
      baseDamage: 3,
      accuracyBonus: 6,
      critBonus: 12,
      kind: 'melee',
    },
    {
      id: 'predator_crouch',
      name: 'Predator Crouch',
      description: 'Defensive Passive: coil low in highland grass (-1 incoming DMG) & refresh Shadow Veil.',
      category: 'defense',
      element: 'shadow',
      essenceCost: 0,
      minRange: 0,
      maxRange: 0,
      elevationRangeBonus: false,
      baseDamage: 0,
      accuracyBonus: 0,
      critBonus: 0,
      isSelfBuff: true,
      kind: 'buff',
    },
  ];

  return [
    {
      id: 'aiori',
      name: 'Aiori Suiciniv',
      title: 'Iron Vanguard',
      faction: 'hero',
      sheetId: 'aiori',
      x: 12,
      y: 22,
      facing: 'NE',
      vitality: 10,
      maxVitality: 10,
      essence: 5,
      maxEssence: 5,
      evasion: 2,
      reaction: 1,
      maxReaction: 1,
      signatureReaction: 'steel_guard',
      atk: 1,
      mov: 5,
      jmp: 1,
      spd: 13,
      crit: 15,
      guarding: false,
      hidden: false,
      swordElement: 'none',
      slowedTurns: 0,
      hasMoved: false,
      hasActed: false,
      alive: true,
      skills: aioriSkills,
      accentColor: '#6ca0dc',
    },
    {
      id: 'aryon',
      name: 'Aryon Fallen',
      title: 'Fire Mage',
      faction: 'hero',
      sheetId: 'aryon',
      x: 14,
      y: 22,
      facing: 'NE',
      vitality: 8,
      maxVitality: 8,
      essence: 6,
      maxEssence: 6,
      evasion: 3,
      reaction: 1,
      maxReaction: 1,
      signatureReaction: 'escudo_ergeo',
      atk: 1,
      mov: 5,
      jmp: 1,
      spd: 15,
      crit: 18,
      guarding: false,
      hidden: false,
      swordElement: 'none',
      slowedTurns: 0,
      hasMoved: false,
      hasActed: false,
      alive: true,
      skills: aryonSkills,
      accentColor: '#d9534f',
    },
    {
      id: 'panther_alpha',
      name: 'Shadow',
      title: 'Watchtower Alpha',
      faction: 'enemy',
      sheetId: 'panther',
      x: 14,
      y: 11,
      facing: 'SW',
      vitality: 7,
      maxVitality: 7,
      essence: 4,
      maxEssence: 4,
      evasion: 3,
      reaction: 1,
      maxReaction: 1,
      signatureReaction: 'shadow_veil',
      atk: 1,
      mov: 6,
      jmp: 2,
      spd: 14,
      crit: 14,
      guarding: false,
      hidden: false,
      swordElement: 'none',
      slowedTurns: 0,
      hasMoved: false,
      hasActed: false,
      alive: true,
      aiPolicy: 'HIGH_GROUND_POUNCER',
      skills: shadowSkills,
      accentColor: '#d97706',
    },
    {
      id: 'panther_flank',
      name: 'Shadow',
      title: 'Ridge Stalker',
      faction: 'enemy',
      sheetId: 'panther',
      x: 12,
      y: 19,
      facing: 'SW',
      vitality: 6,
      maxVitality: 6,
      essence: 4,
      maxEssence: 4,
      evasion: 3,
      reaction: 1,
      maxReaction: 1,
      signatureReaction: 'shadow_veil',
      atk: 1,
      mov: 6,
      jmp: 2,
      spd: 12,
      crit: 14,
      guarding: false,
      hidden: false,
      swordElement: 'none',
      slowedTurns: 0,
      hasMoved: false,
      hasActed: false,
      alive: true,
      aiPolicy: 'FLANKER',
      skills: shadowSkills,
      accentColor: '#dc2626',
    },
    {
      id: 'panther_ambush',
      name: 'Shadow',
      title: 'Ruin Prowler',
      faction: 'enemy',
      sheetId: 'panther',
      x: 19,
      y: 18,
      facing: 'SW',
      vitality: 6,
      maxVitality: 6,
      essence: 4,
      maxEssence: 4,
      evasion: 3,
      reaction: 1,
      maxReaction: 1,
      signatureReaction: 'shadow_veil',
      atk: 1,
      mov: 6,
      jmp: 2,
      spd: 11,
      crit: 12,
      guarding: false,
      hidden: false,
      swordElement: 'none',
      slowedTurns: 0,
      hasMoved: false,
      hasActed: false,
      alive: true,
      aiPolicy: 'AMBUSH_HUNTER',
      skills: shadowSkills,
      accentColor: '#b91c1c',
    },
  ];
}

/**
 * Builds deterministic speed-sorted turn order IDs for the Turn Order Ribbon.
 */
export function buildInitialTurnOrder(units: TacticalUnit[]): string[] {
  return [...units]
    .filter((u) => u.alive)
    .sort((a, b) => b.spd - a.spd || a.id.localeCompare(b.id))
    .map((u) => u.id);
}

/**
 * Returns the upcoming turn sequence preview (next `count` living turns) for the top-right ribbon.
 */
export function getUpcomingTurnQueue(
  turnOrder: string[],
  currentIndex: number,
  units: TacticalUnit[],
  count = 7
): TacticalUnit[] {
  const aliveMap = new Map(units.filter((u) => u.alive).map((u) => [u.id, u]));
  const livingOrder = turnOrder.filter((id) => aliveMap.has(id));
  if (livingOrder.length === 0) return [];

  const result: TacticalUnit[] = [];
  const safeIdx = ((currentIndex % livingOrder.length) + livingOrder.length) % livingOrder.length;
  for (let i = 0; i < count; i++) {
    const id = livingOrder[(safeIdx + i) % livingOrder.length];
    const u = aliveMap.get(id);
    if (u) result.push(u);
  }
  return result;
}

/**
 * Smart Shadow Panther Tactical AI supporting Smoke Screen stealth + 3 predator policies:
 * - Attacks from Shadow whenever in range (revealing itself with +25% Hit ambush bonus!)
 * - When advancing out of strike range and not hidden, pops Smoke Screen to disappear into stealth!
 */
export function computePantherTurn(
  panther: TacticalUnit,
  tiles: TileData[][],
  units: TacticalUnit[]
): AIActionPlan {
  const heroes = units.filter((u) => u.alive && u.faction === 'hero');
  if (heroes.length === 0) {
    return {
      movePath: [{ x: panther.x, y: panther.y }],
      targetId: null,
      skill: null,
      finalFacing: panther.facing,
    };
  }

  const reachable = computeReachableTiles(panther, tiles, units);
  const candidates = Array.from(reachable.values());
  const offensiveSkills = panther.skills.filter((s) => !s.isSelfBuff);

  let bestScore = -Infinity;
  let bestDest: GridPos = { x: panther.x, y: panther.y };
  let bestTarget: TacticalUnit | null = null;
  let bestSkill: SkillDef | null = null;

  for (const node of candidates) {
    const simUnit: TacticalUnit = { ...panther, x: node.x, y: node.y };
    const tile = tiles[node.y][node.x];

    for (const hero of heroes) {
      for (const skill of offensiveSkills) {
        if (skill.essenceCost > panther.essence) continue;
        const targetable = getSkillTargetTiles(simUnit, skill, tiles);
        const canHit = targetable.some((p) => p.x === hero.x && p.y === hero.y);
        if (!canHit) continue;

        const fc = calculateCombatForecast(simUnit, hero, skill, tiles, units);
        let score = 200 + fc.expectedDamage * 25 + (fc.willKill ? 180 : 0);
        if (panther.hidden) score += 45; // Eager to ambush from Shadow!
        score += tile.height * 16 + tile.evasionBonus * 0.6;

        if (panther.aiPolicy === 'HIGH_GROUND_POUNCER') {
          score += fc.elevationDelta * 32;
        } else if (panther.aiPolicy === 'FLANKER') {
          score += fc.attackAngle === 'BACK' ? 85 : fc.attackAngle === 'SIDE' ? 45 : 0;
        } else if (panther.aiPolicy === 'AMBUSH_HUNTER') {
          score += (1 - hero.vitality / hero.maxVitality) * 80;
          if (isTileOccluded(node.x, node.y, tiles)) score += 24;
        }

        if (score > bestScore) {
          bestScore = score;
          bestDest = { x: node.x, y: node.y };
          bestTarget = hero;
          bestSkill = skill;
        }
      }
    }
  }

  if (bestTarget && bestSkill) {
    const path = findPathToTile(panther, bestDest.x, bestDest.y, tiles, units) ?? [
      { x: panther.x, y: panther.y },
    ];
    return {
      movePath: path,
      targetId: bestTarget.id,
      skill: bestSkill,
      useSmokeScreen: false,
      finalFacing: computeFacingToward(
        bestDest.x,
        bestDest.y,
        bestTarget.x,
        bestTarget.y,
        panther.facing
      ),
    };
  }

  const smokeSkill = panther.skills.find((s) => s.grantsHidden);
  const shouldSmoke = Boolean(!panther.hidden && smokeSkill && panther.essence >= smokeSkill.essenceCost);

  const primaryHero =
    panther.aiPolicy === 'AMBUSH_HUNTER'
      ? [...heroes].sort((a, b) => a.vitality - b.vitality)[0]
      : [...heroes].sort(
          (a, b) =>
            Math.abs(a.x - panther.x) +
            Math.abs(a.y - panther.y) -
            (Math.abs(b.x - panther.x) + Math.abs(b.y - panther.y))
        )[0];

  const longPath = findLongRangePath(panther, primaryHero.x, primaryHero.y, tiles, units);
  if (longPath && longPath.length > 1) {
    let furthestReachable: GridPos = { x: panther.x, y: panther.y };
    for (let i = 1; i < longPath.length; i++) {
      const step = longPath[i];
      if (reachable.has(tileKey(step.x, step.y))) {
        furthestReachable = step;
      }
    }
    const movePath = findPathToTile(panther, furthestReachable.x, furthestReachable.y, tiles, units) ?? [
      { x: panther.x, y: panther.y },
    ];
    return {
      movePath,
      targetId: null,
      skill: shouldSmoke ? smokeSkill ?? null : null,
      useSmokeScreen: shouldSmoke,
      finalFacing: computeFacingToward(
        furthestReachable.x,
        furthestReachable.y,
        primaryHero.x,
        primaryHero.y,
        panther.facing
      ),
    };
  }

  let bestFallback = { x: panther.x, y: panther.y };
  let bestFallbackScore = -Infinity;
  for (const node of candidates) {
    const dist = Math.abs(node.x - primaryHero.x) + Math.abs(node.y - primaryHero.y);
    const tile = tiles[node.y][node.x];
    const score = -dist * 15 + tile.height * 7 + (tile.terrain === 'tall_grass' ? 8 : 0);
    if (score > bestFallbackScore) {
      bestFallbackScore = score;
      bestFallback = { x: node.x, y: node.y };
    }
  }
  const movePath = findPathToTile(panther, bestFallback.x, bestFallback.y, tiles, units) ?? [
    { x: panther.x, y: panther.y },
  ];

  return {
    movePath,
    targetId: null,
    skill: shouldSmoke ? smokeSkill ?? null : null,
    useSmokeScreen: shouldSmoke,
    finalFacing: computeFacingToward(
      bestFallback.x,
      bestFallback.y,
      primaryHero.x,
      primaryHero.y,
      panther.facing
    ),
  };
}

export function checkBattleOutcome(units: TacticalUnit[]): 'playing' | 'victory' | 'defeat' {
  const heroesAlive = units.some((u) => u.faction === 'hero' && u.alive);
  const enemiesAlive = units.some((u) => u.faction === 'enemy' && u.alive);
  if (!enemiesAlive) return 'victory';
  if (!heroesAlive) return 'defeat';
  return 'playing';
}
