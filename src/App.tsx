import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_MAP_TILES, TileData, gridToScreen } from './game/mapTopology';
import {
  AttackStanceId,
  CombatClashResult,
  GridPos,
  PortraitMood,
  ReactionId,
  SkillDef,
  TacticalUnit,
  buildInitialTurnOrder,
  calculateCombatForecast,
  checkBattleOutcome,
  chooseEnemyReaction,
  computeFacingToward,
  computePantherTurn,
  computeReachableTiles,
  createInitialUnits,
  findPathToTile,
  getSignatureReaction,
  getSkillTargetTiles,
  getUpcomingTurnQueue,
  resolveCombatClash,
  tileKey,
} from './game/tacticsEngine';
import { LoadedGameAssets, loadAllGameAssets } from './game/spriteProcessor';
import { soundEngine } from './game/soundEngine';
import {
  BattleCanvas,
  FloatingTextEvent,
  ProjectileAnim,
  UnitVisualOverride,
} from './components/BattleCanvas';
import { TitleScreen } from './components/TitleScreen';
import { UnitPortraitPanel } from './components/UnitPortraitPanel';
import { TurnOrderRibbon } from './components/TurnOrderRibbon';
import { ActionMode, RadialActionMenu } from './components/RadialActionMenu';
import { CombatCutInOverlay, CutInPhase } from './components/CombatCutInOverlay';
import { OutcomeModal, PauseModal, RunStatsSnapshot } from './components/GameModals';
import { InspectDrawer } from './components/InspectDrawer';
import { CharacterStatusModal } from './components/CharacterStatusModal';

type ScreenState = 'title' | 'playing' | 'paused' | 'gameover';

interface CombatCutInSession {
  phase: CutInPhase;
  cutInCategory: 'attack' | 'essence';
  attackerId: string;
  defenderId: string;
  skillId: string;
  stanceId: AttackStanceId;
  reactionId: ReactionId;
  clashResult: CombatClashResult | null;
  /** True when initiated by Enemy AI so resolving continues the enemy turn smoothly */
  initiatedByEnemy: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function App() {
  const tiles = INITIAL_MAP_TILES;

  const initialQuery = useMemo(() => {
    if (typeof window === 'undefined') {
      return { autostart: false, previewOutcome: null as 'victory' | 'defeat' | null };
    }
    const params = new URLSearchParams(window.location.search);
    const rawOutcome = params.get('outcome');
    const previewOutcome: 'victory' | 'defeat' | null =
      rawOutcome === 'victory'
        ? 'victory'
        : rawOutcome === 'defeat'
        ? 'defeat'
        : null;
    return {
      autostart: params.get('autostart') === '1',
      previewOutcome,
    };
  }, []);

  const [screenState, setScreenState] = useState<ScreenState>(
    initialQuery.previewOutcome ? 'gameover' : initialQuery.autostart ? 'playing' : 'title'
  );
  const [outcome, setOutcome] = useState<'victory' | 'defeat' | null>(initialQuery.previewOutcome);
  const [assets, setAssets] = useState<LoadedGameAssets | null>(null);

  const [units, setUnits] = useState<TacticalUnit[]>(() => createInitialUnits());
  const [turnOrder, setTurnOrder] = useState<string[]>(() =>
    buildInitialTurnOrder(createInitialUnits())
  );
  const [turnIndex, setTurnIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);

  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null);
  const [inspectUnitId, setInspectUnitId] = useState<string | null>(null);
  const [statusUnitId, setStatusUnitId] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  // Modern dynamic command dock is immediately ready ('radial') on every hero turn
  const [actionMode, setActionMode] = useState<ActionMode>('radial');
  const [selectedSkill, setSelectedSkill] = useState<SkillDef | null>(null);
  const [cutIn, setCutIn] = useState<CombatCutInSession | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const [showGrid, setShowGrid] = useState(true);
  const [xrayCutaway, setXrayCutaway] = useState(false);
  const [muted, setMuted] = useState(false);
  const [portraitMoodOverride, setPortraitMoodOverride] = useState<{
    unitId: string;
    mood: PortraitMood;
  } | null>(null);
  const [activeUnitScreenPos, setActiveUnitScreenPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Frozen run metrics for Victory/Defeat modal
  const runStatsRef = useRef({
    turns: 1,
    damageDealt: 0,
    highGroundHits: 0,
  });
  const [frozenSnapshot, setFrozenSnapshot] = useState<RunStatsSnapshot>(() =>
    initialQuery.previewOutcome === 'victory'
      ? {
          turns: 6,
          damageDealt: 24,
          highGroundHits: 4,
          enemiesDefeated: 3,
          totalEnemies: 3,
          heroesStanding: 2,
        }
      : initialQuery.previewOutcome === 'defeat'
      ? {
          turns: 7,
          damageDealt: 14,
          highGroundHits: 1,
          enemiesDefeated: 1,
          totalEnemies: 3,
          heroesStanding: 0,
        }
      : {
          turns: 1,
          damageDealt: 0,
          highGroundHits: 0,
          enemiesDefeated: 0,
          totalEnemies: 3,
          heroesStanding: 2,
        }
  );

  // High-frequency refs shared with BattleCanvas (zero 60Hz React reconciliation)
  const visualOverridesRef = useRef<Record<string, UnitVisualOverride>>({});
  const floatingTextsRef = useRef<FloatingTextEvent[]>([]);
  const projectilesRef = useRef<ProjectileAnim[]>([]);
  const traumaRef = useRef(0);
  const hitstopRef = useRef(0);
  const panTargetRef = useRef<{ gx: number; gy: number } | null>(null);
  const floatIdRef = useRef(1);
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const screenStateRef = useRef(screenState);
  screenStateRef.current = screenState;
  // Resolver ref for pausing the Enemy AI coroutine while the player reacts inside the cut-in
  const enemyCutInResolverRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    document.body.dataset.state = cutIn ? `cutin_${cutIn.phase}` : screenState;
  }, [screenState, cutIn]);

  useEffect(() => {
    let active = true;
    loadAllGameAssets()
      .then((loaded) => {
        if (active) setAssets(loaded);
      })
      .catch((err) => {
        console.error('Asset loading failed:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const turnQueue = useMemo(
    () => getUpcomingTurnQueue(turnOrder, turnIndex, units, 8),
    [turnOrder, turnIndex, units]
  );

  const activeUnit = turnQueue[0] ?? null;
  const displayedUnit = useMemo(() => {
    if (inspectedUnitId) {
      const found = units.find((u) => u.id === inspectedUnitId && u.alive);
      if (found) return found;
    }
    return activeUnit;
  }, [inspectedUnitId, units, activeUnit]);

  const livingUnits = useMemo(() => units.filter((u) => u.alive), [units]);

  const inspectUnit = useMemo(() => {
    if (!inspectUnitId) return null;
    return units.find((u) => u.id === inspectUnitId && u.alive) ?? null;
  }, [inspectUnitId, units]);

  const statusUnit = useMemo(() => {
    if (!statusUnitId) return null;
    return units.find((u) => u.id === statusUnitId && u.alive) ?? null;
  }, [statusUnitId, units]);

  const isPlayerControl =
    screenState === 'playing' &&
    !isAnimating &&
    !cutIn &&
    !statusUnit &&
    activeUnit !== null &&
    activeUnit.faction === 'hero';

  // Reachable tiles when in Move mode
  const reachableTiles = useMemo(() => {
    if (!isPlayerControl || !activeUnit || actionMode !== 'move') {
      return new Map();
    }
    return computeReachableTiles(activeUnit, tiles, units);
  }, [isPlayerControl, activeUnit, actionMode, tiles, units]);

  // Path preview when hovering a reachable tile in Move mode
  const pathPreview = useMemo<GridPos[]>(() => {
    if (!isPlayerControl || !activeUnit || actionMode !== 'move' || !hoveredTile) return [];
    if (!reachableTiles.has(tileKey(hoveredTile.x, hoveredTile.y))) return [];
    return findPathToTile(activeUnit, hoveredTile.x, hoveredTile.y, tiles, units) ?? [];
  }, [isPlayerControl, activeUnit, actionMode, hoveredTile, reachableTiles, tiles, units]);

  // Targetable tiles when in Target mode
  const attackTargetTiles = useMemo(() => {
    if (!isPlayerControl || !activeUnit || actionMode !== 'target' || !selectedSkill) {
      return new Set<string>();
    }
    const list = getSkillTargetTiles(activeUnit, selectedSkill, tiles);
    return new Set(list.map((p) => tileKey(p.x, p.y)));
  }, [isPlayerControl, activeUnit, actionMode, selectedSkill, tiles]);

  const pushFloatingText = useCallback(
    (gx: number, gy: number, text: string, color: string, subtext?: string) => {
      floatingTextsRef.current.push({
        id: floatIdRef.current++,
        gx,
        gy,
        text,
        subtext,
        color,
        createdAt: performance.now(),
      });
    },
    []
  );

  const emitBurst = useCallback((gx: number, gy: number, color: string, count = 16) => {
    window.dispatchEvent(
      new CustomEvent('elmodor:burst', { detail: { gx, gy, color, count } })
    );
  }, []);

  const resetBattle = useCallback((enterPlaying: boolean) => {
    const freshUnits = createInitialUnits();
    const freshOrder = buildInitialTurnOrder(freshUnits);
    visualOverridesRef.current = {};
    floatingTextsRef.current = [];
    projectilesRef.current = [];
    traumaRef.current = 0;
    hitstopRef.current = 0;
    runStatsRef.current = { turns: 1, damageDealt: 0, highGroundHits: 0 };
    if (enemyCutInResolverRef.current) {
      enemyCutInResolverRef.current();
      enemyCutInResolverRef.current = null;
    }

    setUnits(freshUnits);
    setTurnOrder(freshOrder);
    setTurnIndex(0);
    setTurnNumber(1);
    setInspectedUnitId(null);
    setInspectUnitId(null);
    setStatusUnitId(null);
    setActionMode('radial');
    setSelectedSkill(null);
    setCutIn(null);
    setIsAnimating(false);
    setOutcome(null);
    setPortraitMoodOverride(null);

    const first = freshUnits.find((u) => u.id === freshOrder[0]);
    if (first) {
      panTargetRef.current = { gx: first.x, gy: first.y };
    }
    setScreenState(enterPlaying ? 'playing' : 'title');
  }, []);

  const handleStartFromTitle = useCallback(() => {
    soundEngine.playUiTick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (outcome !== null) {
      resetBattle(true);
    } else {
      setScreenState('playing');
      const first = unitsRef.current.find((u) => u.id === turnOrder[0] && u.alive);
      if (first) {
        panTargetRef.current = { gx: first.x, gy: first.y };
      }
    }
  }, [outcome, resetBattle, turnOrder]);

  /**
   * Animates a unit walking step-by-step along an A* path with elevation hop arc
   * and live 4-way isometric directional sprite updates.
   */
  const animateUnitWalk = useCallback(
    async (unit: TacticalUnit, path: GridPos[]) => {
      if (path.length <= 1) return;
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1];
        const to = path[i];
        const fromH = tiles[from.y][from.x].height;
        const toH = tiles[to.y][to.x].height;
        const stepFacing = computeFacingToward(from.x, from.y, to.x, to.y, unit.facing);
        soundEngine.playStep();

        const duration = 135;
        const start = performance.now();
        while (true) {
          const t = Math.min(1, (performance.now() - start) / duration);
          const hop = Math.sin(t * Math.PI) * (Math.abs(toH - fromH) > 0 ? 18 : 7);
          visualOverridesRef.current[unit.id] = {
            renderX: from.x + (to.x - from.x) * t,
            renderY: from.y + (to.y - from.y) * t,
            renderH: fromH + (toH - fromH) * t,
            hopOffset: hop,
            lungeX: 0,
            lungeY: 0,
            flashTimer: 0,
            koAlpha: 1,
            facing: stepFacing,
          };
          if (t >= 1) break;
          await sleep(16);
        }
      }
      delete visualOverridesRef.current[unit.id];
    },
    [tiles]
  );

  /**
   * Freezes final run telemetry and opens the full-screen Victory or Defeat Fanfare Cut-In
   * whenever all 3 Shadows fall OR both heroes fall (whether on hero or enemy turn!).
   */
  const triggerBattleEnd = useCallback(
    (status: 'victory' | 'defeat', latestUnits: TacticalUnit[]) => {
      if (screenStateRef.current === 'gameover') return;
      const enemies = latestUnits.filter((u) => u.faction === 'enemy');
      const heroes = latestUnits.filter((u) => u.faction === 'hero');
      setFrozenSnapshot({
        turns: runStatsRef.current.turns,
        damageDealt: runStatsRef.current.damageDealt,
        highGroundHits: runStatsRef.current.highGroundHits,
        enemiesDefeated: enemies.filter((e) => !e.alive).length,
        totalEnemies: enemies.length,
        heroesStanding: heroes.filter((h) => h.alive).length,
      });
      setCutIn(null);
      setIsAnimating(false);
      setOutcome(status);
      soundEngine.playOutcome(status === 'victory');
      window.setTimeout(() => {
        setScreenState('gameover');
      }, 420);
    },
    []
  );

  /**
   * Advances turn to the next living unit in the Turn Order Ribbon,
   * refreshing their Reaction charges and regenerating +1 Essence.
   */
  const advanceTurn = useCallback(
    (latestUnits: TacticalUnit[]) => {
      const status = checkBattleOutcome(latestUnits);
      if (status !== 'playing') {
        triggerBattleEnd(status, latestUnits);
        return;
      }

      const aliveIds = turnOrder.filter((id) =>
        latestUnits.some((u) => u.id === id && u.alive)
      );
      if (aliveIds.length === 0) return;
      const nextIdx = (turnIndex + 1) % aliveIds.length;
      const nextUnitId = aliveIds[nextIdx];
      const nextTurnNum = turnNumber + 1;
      runStatsRef.current.turns = nextTurnNum;

      setUnits((prev) =>
        prev.map((u) =>
          u.id === nextUnitId
            ? {
                ...u,
                essence: Math.min(u.maxEssence, u.essence + 1),
                reaction: u.maxReaction,
                hasMoved: false,
                hasActed: false,
                guarding: false,
                slowedTurns: Math.max(0, u.slowedTurns - 1),
              }
            : u
        )
      );
      setTurnIndex(nextIdx);
      setTurnNumber(nextTurnNum);
      setInspectedUnitId(null);
      setActionMode('radial');
      setSelectedSkill(null);
      setCutIn(null);

      const nextUnit = latestUnits.find((u) => u.id === nextUnitId);
      if (nextUnit) {
        panTargetRef.current = { gx: nextUnit.x, gy: nextUnit.y };
      }
    },
    [turnIndex, turnNumber, turnOrder, triggerBattleEnd]
  );

  /**
   * Opens Stage 1 (Pokemon-style over-the-shoulder selection cut-in) ONLY AFTER
   * the player selects the specific foe on the map, scoped to Attack or Essence.
   */
  const openPlayerSelectionCutIn = useCallback(
    (attacker: TacticalUnit, defender: TacticalUnit, initialSkill: SkillDef) => {
      soundEngine.playUiTick();
      setInspectUnitId(null);
      setStatusUnitId(null);
      setActionMode('idle');
      setSelectedSkill(initialSkill);
      const category: 'attack' | 'essence' =
        initialSkill.category === 'essence' ? 'essence' : 'attack';
      setCutIn({
        phase: 'select',
        cutInCategory: category,
        attackerId: attacker.id,
        defenderId: defender.id,
        skillId: initialSkill.id,
        stanceId: 'standard',
        reactionId: 'none',
        clashResult: null,
        initiatedByEnemy: false,
      });
    },
    []
  );

  /** Toggles Enemy Tactical Inspect Drawer (defaults to nearest living enemy for rapid recon) */
  const handleToggleInspect = useCallback(() => {
    soundEngine.playUiTick();
    if (inspectUnitId) {
      setInspectUnitId(null);
      return;
    }
    setStatusUnitId(null);
    const refUnit = activeUnit ?? unitsRef.current.find((u) => u.alive) ?? null;
    const enemies = unitsRef.current
      .filter((u) => u.alive && u.faction === 'enemy')
      .sort((a, b) => {
        if (!refUnit) return 0;
        const da = Math.abs(a.x - refUnit.x) + Math.abs(a.y - refUnit.y);
        const db = Math.abs(b.x - refUnit.x) + Math.abs(b.y - refUnit.y);
        return da - db;
      });
    const target = enemies[0] ?? displayedUnit ?? activeUnit;
    if (target) {
      setInspectUnitId(target.id);
      setInspectedUnitId(target.id);
      panTargetRef.current = { gx: target.x, gy: target.y };
    }
  }, [inspectUnitId, activeUnit, displayedUnit]);

  const handleOpenStatusFor = useCallback((u: TacticalUnit | null) => {
    if (!u) return;
    soundEngine.playUiTick();
    setInspectUnitId(null);
    setStatusUnitId(u.id);
  }, []);

  /**
   * Plays brief on-map impact juice (lunge/projectile, flash, knockback, KO dissolve)
   * right after Stage 3 Resolution Cut-In is confirmed by the player!
   */
  const applyResolvedClashToBoard = useCallback(
    async (
      attacker: TacticalUnit,
      defender: TacticalUnit,
      result: CombatClashResult,
      initiatedByEnemy: boolean
    ) => {
      setIsAnimating(true);
      const skill = result.forecast.skill;
      const atkFacing = computeFacingToward(
        attacker.x,
        attacker.y,
        defender.x,
        defender.y,
        attacker.facing
      );
      const atkH = tiles[attacker.y][attacker.x].height;
      const defH = tiles[defender.y][defender.x].height;

      setUnits((prev) =>
        prev.map((u) => (u.id === attacker.id ? { ...u, facing: atkFacing } : u))
      );
      setPortraitMoodOverride({ unitId: attacker.id, mood: 'attacking' });

      if (skill.kind === 'ranged') {
        soundEngine.playSpell();
        projectilesRef.current.push({
          fromX: attacker.x,
          fromY: attacker.y,
          fromH: atkH,
          toX: defender.x,
          toY: defender.y,
          toH: defH,
          color:
            skill.element === 'fire'
              ? skill.applySlow
                ? '#ff4d2e'
                : '#ff8a3d'
              : skill.applySlow
              ? '#a855f7'
              : '#e05252',
          progress: 0,
          duration: 0.22,
        });
        await sleep(210);
      } else {
        const aPt = gridToScreen(attacker.x, attacker.y, atkH);
        const dPt = gridToScreen(defender.x, defender.y, defH);
        visualOverridesRef.current[attacker.id] = {
          renderX: attacker.x,
          renderY: attacker.y,
          renderH: atkH,
          hopOffset: 5,
          lungeX: (dPt.x - aPt.x) * 0.4,
          lungeY: (dPt.y - aPt.y) * 0.4,
          flashTimer: 0,
          koAlpha: 1,
          facing: atkFacing,
        };
        await sleep(95);
      }

      if (result.didHit) {
        const isHeavy = result.didCrit || result.finalDamage >= 4 || Boolean(result.knockbackOutcome);
        if (result.outcomeKind === 'blocked' || result.outcomeKind === 'shielded') {
          soundEngine.playGuard();
        } else {
          soundEngine.playHit(isHeavy);
        }
        hitstopRef.current = isHeavy ? 0.055 : 0.03;
        traumaRef.current = isHeavy ? 0.52 : 0.28;

        visualOverridesRef.current[defender.id] = {
          renderX: defender.x,
          renderY: defender.y,
          renderH: defH,
          hopOffset: 0,
          lungeX: 0,
          lungeY: 0,
          flashTimer: 0.12,
          koAlpha: 1,
          facing: defender.facing,
        };
        setPortraitMoodOverride({ unitId: defender.id, mood: 'hurt' });
        emitBurst(
          defender.x,
          defender.y,
          result.outcomeKind === 'shielded'
            ? '#b48bff'
            : result.outcomeKind === 'blocked'
            ? '#f2cf7e'
            : result.didCrit
            ? '#ffe082'
            : '#e8685c',
          isHeavy ? 20 : 12
        );

        const floatLabel =
          result.finalDamage === 0 ? 'WARDED' : `-${result.finalDamage} VIT`;
        const floatColor =
          result.outcomeKind === 'shielded'
            ? '#c9a6ff'
            : result.outcomeKind === 'blocked'
            ? '#f5d484'
            : result.didCrit
            ? '#fde08d'
            : '#f47b71';

        pushFloatingText(
          defender.x,
          defender.y,
          floatLabel,
          floatColor,
          result.tags.join(' · ') || undefined
        );

        if (attacker.faction === 'hero') {
          runStatsRef.current.damageDealt += result.finalDamage;
          if (result.forecast.elevationDelta >= 2) runStatsRef.current.highGroundHits += 1;
        }
      } else {
        soundEngine.playUiTick();
        pushFloatingText(defender.x, defender.y, 'EVADED', '#9ae4b8');
      }

      if (result.revealedAttacker) {
        emitBurst(attacker.x, attacker.y, '#8465b5', 16);
        pushFloatingText(attacker.x, attacker.y, 'FROM SHADOW', '#cdb4ff');
      }
      if (result.imbuedSword === 'ferunium') {
        emitBurst(attacker.x, attacker.y, '#ff7338', 14);
        pushFloatingText(attacker.x, attacker.y, 'FERUNIUM FIRE', '#ff9975');
      } else if (result.imbuedSword === 'auruinum') {
        emitBurst(attacker.x, attacker.y, '#6cb8ff', 14);
        pushFloatingText(attacker.x, attacker.y, 'AURUINUM ARCANE', '#8ec8ff');
      }

      const defSurvived = !result.didKill;
      const pushedX =
        result.didHit && defSurvived && result.knockbackOutcome
          ? result.knockbackOutcome.targetX
          : defender.x;
      const pushedY =
        result.didHit && defSurvived && result.knockbackOutcome
          ? result.knockbackOutcome.targetY
          : defender.y;

      const updatedUnits: TacticalUnit[] = unitsRef.current.map((u) => {
        if (u.id === attacker.id) {
          return {
            ...u,
            facing: atkFacing,
            essence: Math.max(0, u.essence - result.attackerEssenceSpent),
            hidden: result.revealedAttacker ? false : u.hidden,
            swordElement: result.imbuedSword ?? u.swordElement,
            hasActed: true,
          };
        }
        if (u.id === defender.id) {
          return {
            ...u,
            vitality: result.defenderVitalityAfter,
            alive: defSurvived,
            essence: Math.max(0, u.essence - result.defenderEssenceSpent),
            reaction: Math.max(0, u.reaction - result.defenderReactionSpent),
            hidden: result.flushedDefender ? false : u.hidden,
            x: pushedX,
            y: pushedY,
            slowedTurns: result.appliedSlow ? 2 : u.slowedTurns,
          };
        }
        return u;
      });

      setUnits(updatedUnits);
      await sleep(100);
      delete visualOverridesRef.current[attacker.id];

      if (!defSurvived) {
        const koStart = performance.now();
        while (true) {
          const t = Math.min(1, (performance.now() - koStart) / 340);
          visualOverridesRef.current[defender.id] = {
            renderX: defender.x,
            renderY: defender.y,
            renderH: defH,
            hopOffset: -t * 10,
            lungeX: 0,
            lungeY: t * 8,
            flashTimer: 0,
            koAlpha: 1 - t,
            facing: defender.facing,
          };
          if (t >= 1) break;
          await sleep(16);
        }
      }
      delete visualOverridesRef.current[defender.id];

      await sleep(140);
      setPortraitMoodOverride(null);
      setIsAnimating(false);

      const nextStatus = checkBattleOutcome(updatedUnits);

      // If initiated by enemy AI coroutine, wake it up AND trigger Defeat immediately if both heroes fell!
      if (initiatedByEnemy) {
        const resolver = enemyCutInResolverRef.current;
        enemyCutInResolverRef.current = null;
        if (nextStatus !== 'playing') {
          triggerBattleEnd(nextStatus, updatedUnits);
        }
        if (resolver) resolver();
        return;
      }

      if (nextStatus !== 'playing') {
        triggerBattleEnd(nextStatus, updatedUnits);
        return;
      }

      const refreshedAttacker = updatedUnits.find((u) => u.id === attacker.id);
      if (
        refreshedAttacker &&
        refreshedAttacker.faction === 'hero' &&
        refreshedAttacker.hasMoved &&
        refreshedAttacker.hasActed
      ) {
        advanceTurn(updatedUnits);
      } else {
        setActionMode('radial');
      }
    },
    [tiles, emitBurst, pushFloatingText, advanceTurn, triggerBattleEnd]
  );

  // Derived objects for the active 3-stage CombatCutInOverlay
  const cutInDerived = useMemo(() => {
    if (!cutIn) return null;
    const attacker = units.find((u) => u.id === cutIn.attackerId);
    const defender = units.find((u) => u.id === cutIn.defenderId);
    if (!attacker || !defender) return null;

    const scopedSkills = attacker.skills.filter(
      (s) => !s.isSelfBuff && s.category === cutIn.cutInCategory
    );
    const fallbackSkills =
      scopedSkills.length > 0
        ? scopedSkills
        : attacker.skills.filter((s) => !s.isSelfBuff);
    const skill =
      fallbackSkills.find((s) => s.id === cutIn.skillId) ??
      fallbackSkills[0] ??
      attacker.skills[0];

    const inRangeSkillIds = new Set<string>();
    for (const sk of fallbackSkills) {
      const targetable = getSkillTargetTiles(attacker, sk, tiles);
      if (targetable.some((p) => p.x === defender.x && p.y === defender.y)) {
        inRangeSkillIds.add(sk.id);
      }
    }

    const baseForecast = calculateCombatForecast(
      attacker,
      defender,
      skill,
      tiles,
      units,
      cutIn.stanceId,
      'none'
    );
    const activeReaction = cutIn.phase === 'select' ? 'none' : cutIn.reactionId;
    const forecast = calculateCombatForecast(
      attacker,
      defender,
      skill,
      tiles,
      units,
      cutIn.stanceId,
      activeReaction
    );

    return {
      attacker,
      defender,
      scopedSkills: fallbackSkills,
      inRangeSkillIds,
      skill,
      baseForecast,
      forecast,
    };
  }, [cutIn, units, tiles]);

  // Cut-In Stage Transition Handlers
  const handleConfirmSelectCutIn = useCallback(() => {
    if (!cutIn || !cutInDerived) return;
    soundEngine.playUiTick();
    // Enemy defender evaluates Reaction resource when entering Stage 2 Attack Pose Cut-In
    const chosenEnemyReaction =
      cutInDerived.defender.faction === 'enemy'
        ? chooseEnemyReaction(cutInDerived.defender, cutInDerived.baseForecast)
        : 'none';
    setCutIn({
      ...cutIn,
      phase: 'attack_pose',
      reactionId: chosenEnemyReaction,
    });
  }, [cutIn, cutInDerived]);

  const handleConfirmAttackPoseCutIn = useCallback(() => {
    if (!cutIn || !cutInDerived) return;
    const result = resolveCombatClash(
      cutInDerived.attacker,
      cutInDerived.defender,
      cutInDerived.skill,
      tiles,
      unitsRef.current,
      cutIn.stanceId,
      cutIn.reactionId
    );
    if (result.outcomeKind === 'blocked' || result.outcomeKind === 'shielded') {
      soundEngine.playGuard();
    } else if (result.didHit) {
      soundEngine.playHit(result.didCrit || result.finalDamage >= 4);
    } else {
      soundEngine.playUiTick();
    }
    setCutIn({
      ...cutIn,
      phase: 'resolution',
      clashResult: result,
    });
  }, [cutIn, cutInDerived, tiles]);

  const handleConfirmResolutionCutIn = useCallback(() => {
    if (!cutIn || !cutInDerived || !cutIn.clashResult) return;
    const { attacker, defender } = cutInDerived;
    const result = cutIn.clashResult;
    const byEnemy = cutIn.initiatedByEnemy;
    soundEngine.playUiTick();
    setCutIn(null);
    setSelectedSkill(null);
    setActionMode('radial');
    applyResolvedClashToBoard(attacker, defender, result, byEnemy);
  }, [cutIn, cutInDerived, applyResolvedClashToBoard]);

  // Automatic Shadow AI Turn Controller (Smoke Screen stealth + Stage 2 Attack Pose + Hero single Reaction!)
  useEffect(() => {
    if (screenState !== 'playing' || isAnimating || cutIn || !activeUnit || activeUnit.faction !== 'enemy') {
      return;
    }

    let cancelled = false;

    const runEnemyTurn = async () => {
      setIsAnimating(true);
      panTargetRef.current = { gx: activeUnit.x, gy: activeUnit.y };
      await sleep(460);
      if (cancelled || screenStateRef.current !== 'playing') return;

      const decision = computePantherTurn(activeUnit, tiles, unitsRef.current);

      let movedUnit = activeUnit;
      if (decision.movePath.length > 1) {
        await animateUnitWalk(activeUnit, decision.movePath);
        if (cancelled) return;
        const dest = decision.movePath[decision.movePath.length - 1];
        movedUnit = {
          ...activeUnit,
          x: dest.x,
          y: dest.y,
          facing: decision.finalFacing,
          hasMoved: true,
        };
        setUnits((prev) => prev.map((u) => (u.id === movedUnit.id ? movedUnit : u)));
        await sleep(220);
      } else {
        movedUnit = { ...activeUnit, facing: decision.finalFacing };
        setUnits((prev) => prev.map((u) => (u.id === movedUnit.id ? movedUnit : u)));
      }

      if (decision.useSmokeScreen && decision.skill) {
        soundEngine.playSpell();
        const smokeCost = decision.skill.essenceCost;
        const hiddenUnit: TacticalUnit = {
          ...movedUnit,
          essence: Math.max(0, movedUnit.essence - smokeCost),
          hidden: true,
          hasActed: true,
        };
        const updatedAfterSmoke = unitsRef.current.map((u) =>
          u.id === hiddenUnit.id ? hiddenUnit : u
        );
        setUnits(updatedAfterSmoke);
        emitBurst(hiddenUnit.x, hiddenUnit.y, '#6d509e', 22);
        pushFloatingText(hiddenUnit.x, hiddenUnit.y, 'SMOKE SCREEN', '#cdb4ff', 'HIDDEN IN SHADOW');
        await sleep(420);
      } else if (decision.targetId && decision.skill) {
        const targetHero = unitsRef.current.find((u) => u.id === decision.targetId && u.alive);
        if (targetHero && !cancelled) {
          // Pause Shadow AI coroutine while the player chooses their Hero's single signature Reaction in Stage 2
          setInspectUnitId(null);
          setStatusUnitId(null);
          setIsAnimating(false);
          const heroSigReaction = getSignatureReaction(targetHero);
          const defaultReaction: ReactionId = heroSigReaction.available
            ? targetHero.signatureReaction
            : 'none';
          await new Promise<void>((resolve) => {
            enemyCutInResolverRef.current = resolve;
            setCutIn({
              phase: 'attack_pose',
              cutInCategory: decision.skill!.category === 'essence' ? 'essence' : 'attack',
              attackerId: movedUnit.id,
              defenderId: targetHero.id,
              skillId: decision.skill!.id,
              stanceId: 'standard',
              reactionId: defaultReaction,
              clashResult: null,
              initiatedByEnemy: true,
            });
          });
          if (cancelled) return;
          const postClashOutcome = checkBattleOutcome(unitsRef.current);
          if (postClashOutcome !== 'playing') {
            triggerBattleEnd(postClashOutcome, unitsRef.current);
            return;
          }
        }
      } else {
        pushFloatingText(movedUnit.x, movedUnit.y, 'STALKING', '#e8b068');
        await sleep(340);
      }

      if (!cancelled) {
        setIsAnimating(false);
        advanceTurn(unitsRef.current);
      }
    };

    runEnemyTurn();
    return () => {
      cancelled = true;
    };
  }, [screenState, activeUnit?.id, turnNumber]);

  // Player Action Handlers
  const handleChooseMove = useCallback(() => {
    if (!isPlayerControl || !activeUnit || activeUnit.hasMoved) return;
    soundEngine.playUiTick();
    setInspectedUnitId(null);
    setSelectedSkill(null);
    setActionMode('move');
  }, [isPlayerControl, activeUnit]);

  /**
   * Enters Target Mode on the map for the chosen physical Attack or Essence skill.
   * The Stage 1 Target Cut-In ONLY opens AFTER the player clicks a foe on the map!
   */
  const handleEnterTargetForSkill = useCallback(
    (skill: SkillDef) => {
      if (!isPlayerControl || !activeUnit || activeUnit.hasActed || activeUnit.essence < skill.essenceCost) {
        return;
      }
      soundEngine.playUiTick();
      setInspectedUnitId(null);
      setSelectedSkill(skill);
      setActionMode('target');
    },
    [isPlayerControl, activeUnit]
  );

  const handleChooseAttack = useCallback(() => {
    if (!activeUnit) return;
    const attackSkill = activeUnit.skills.find((s) => s.category === 'attack') ?? activeUnit.skills[0];
    handleEnterTargetForSkill(attackSkill);
  }, [activeUnit, handleEnterTargetForSkill]);

  const handleChooseDefense = useCallback(() => {
    if (!isPlayerControl || !activeUnit || activeUnit.hasActed) return;
    soundEngine.playGuard();
    const defSkill = activeUnit.skills.find((s) => s.category === 'defense');
    const isAryon = activeUnit.sheetId === 'aryon';
    const vitGain = isAryon ? 0 : 2;
    const essGain = isAryon ? 2 : 0;

    const updated = unitsRef.current.map((u) =>
      u.id === activeUnit.id
        ? {
            ...u,
            vitality: Math.min(u.maxVitality, u.vitality + vitGain),
            essence: Math.min(u.maxEssence, u.essence + essGain),
            reaction: u.maxReaction,
            guarding: true,
            hasActed: true,
          }
        : u
    );
    setUnits(updated);
    pushFloatingText(
      activeUnit.x,
      activeUnit.y,
      defSkill?.name.toUpperCase() ?? 'DEFENSE',
      isAryon ? '#ff9975' : '#8be0a4',
      isAryon ? '+2 ESS · GUARD · ESCUDO READY' : '+2 VIT · GUARD · STEEL GUARD'
    );
    emitBurst(activeUnit.x, activeUnit.y, isAryon ? '#ff7b4a' : '#e8c472', 16);
    setActionMode('radial');
    setSelectedSkill(null);
    if (activeUnit.hasMoved) {
      window.setTimeout(() => advanceTurn(updated), 360);
    }
  }, [isPlayerControl, activeUnit, pushFloatingText, emitBurst, advanceTurn]);

  const handleChooseWait = useCallback(() => {
    if (!isPlayerControl || !activeUnit) return;
    soundEngine.playUiTick();
    advanceTurn(unitsRef.current);
  }, [isPlayerControl, activeUnit, advanceTurn]);

  const handleClickTile = useCallback(
    async (tile: TileData) => {
      if (screenState !== 'playing' || isAnimating || cutIn || statusUnitId) return;

      const unitAtTile = unitsRef.current.find(
        (u) => u.alive && u.x === tile.x && u.y === tile.y
      );

      // 0. When Enemy/Unit Inspect Drawer is open, clicking any living unit inspects it immediately
      if (inspectUnitId && unitAtTile) {
        soundEngine.playUiTick();
        setInspectUnitId(unitAtTile.id);
        setInspectedUnitId(unitAtTile.id);
        panTargetRef.current = { gx: unitAtTile.x, gy: unitAtTile.y };
        return;
      }

      // 1. Move Mode -> Walk to clicked reachable tile, then return smoothly to Command Dock
      if (actionMode === 'move' && isPlayerControl && activeUnit) {
        if (
          reachableTiles.has(tileKey(tile.x, tile.y)) &&
          (tile.x !== activeUnit.x || tile.y !== activeUnit.y)
        ) {
          const path = findPathToTile(activeUnit, tile.x, tile.y, tiles, unitsRef.current);
          if (path && path.length > 1) {
            setIsAnimating(true);
            setActionMode('radial');
            await animateUnitWalk(activeUnit, path);
            const finalFacing = computeFacingToward(
              path[path.length - 2].x,
              path[path.length - 2].y,
              tile.x,
              tile.y,
              activeUnit.facing
            );
            const updated = unitsRef.current.map((u) =>
              u.id === activeUnit.id
                ? { ...u, x: tile.x, y: tile.y, facing: finalFacing, hasMoved: true }
                : u
            );
            setUnits(updated);
            setIsAnimating(false);
            panTargetRef.current = { gx: tile.x, gy: tile.y };
            if (activeUnit.hasActed) {
              window.setTimeout(() => advanceTurn(updated), 260);
            }
            return;
          }
        }
      }

      // 2. Target Mode -> Clicking a Shadow foe in crimson range opens Stage 1 Target Cut-In!
      if (actionMode === 'target' && isPlayerControl && activeUnit && selectedSkill) {
        if (
          unitAtTile &&
          unitAtTile.faction === 'enemy' &&
          attackTargetTiles.has(tileKey(tile.x, tile.y))
        ) {
          openPlayerSelectionCutIn(activeUnit, unitAtTile, selectedSkill);
          return;
        }
      }

      // 3. Direct zero-friction interaction on map:
      //    - Clicking an enemy in range while hero can still act immediately opens Target Cut-In!
      //    - Clicking an out-of-range unit focuses & previews them in the corner plaque.
      //    - Clicking the active hero toggles Move mode if not moved yet (or returns to command dock).
      if (unitAtTile) {
        soundEngine.playUiTick();
        if (activeUnit && unitAtTile.id === activeUnit.id && isPlayerControl) {
          setInspectedUnitId(null);
          setSelectedSkill(null);
          panTargetRef.current = { gx: activeUnit.x, gy: activeUnit.y };
          if (!activeUnit.hasMoved && actionMode === 'radial') {
            setActionMode('move');
          } else {
            setActionMode('radial');
          }
        } else if (
          unitAtTile.faction === 'enemy' &&
          isPlayerControl &&
          activeUnit &&
          !activeUnit.hasActed
        ) {
          const directSkill = activeUnit.skills.find((sk) => {
            if (sk.isSelfBuff || activeUnit.essence < sk.essenceCost) return false;
            const rangeTiles = getSkillTargetTiles(activeUnit, sk, tiles);
            return rangeTiles.some((p) => p.x === unitAtTile.x && p.y === unitAtTile.y);
          });
          if (directSkill) {
            openPlayerSelectionCutIn(activeUnit, unitAtTile, directSkill);
          } else {
            setInspectedUnitId(unitAtTile.id);
            panTargetRef.current = { gx: unitAtTile.x, gy: unitAtTile.y };
          }
        } else {
          setInspectedUnitId(unitAtTile.id);
        }
      } else {
        setInspectedUnitId(null);
        if (actionMode === 'essence_select' || actionMode === 'target') {
          setActionMode('radial');
          setSelectedSkill(null);
        }
      }
    },
    [
      screenState,
      isAnimating,
      cutIn,
      statusUnitId,
      inspectUnitId,
      actionMode,
      isPlayerControl,
      activeUnit,
      reachableTiles,
      tiles,
      animateUnitWalk,
      selectedSkill,
      attackTargetTiles,
      openPlayerSelectionCutIn,
      advanceTurn,
    ]
  );

  // Keyboard shortcuts (1-5 Command Arc, Space toggle wheel, I Inspect, C Status, G Grid, X Cutaway, M Mute, Esc/P Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screenState === 'title' || cutIn || statusUnitId) return;
      const k = e.key.toLowerCase();

      if (k === 'escape' || k === 'p') {
        e.preventDefault();
        if (screenState === 'paused') {
          setScreenState('playing');
          return;
        }
        if (screenState === 'playing') {
          if (inspectUnitId) {
            setInspectUnitId(null);
            return;
          }
          if (actionMode !== 'radial') {
            setActionMode('radial');
            setSelectedSkill(null);
            return;
          }
          setScreenState('paused');
        }
        return;
      }

      if (screenState !== 'playing') return;

      if (k === 'i') {
        e.preventDefault();
        handleToggleInspect();
      } else if (k === 'c') {
        e.preventDefault();
        handleOpenStatusFor(inspectUnit ?? displayedUnit ?? activeUnit);
      } else if (k === 'g') {
        setShowGrid((v) => !v);
      } else if (k === 'x') {
        setXrayCutaway((v) => !v);
      } else if (k === 'm') {
        setMuted((v) => {
          soundEngine.muted = !v;
          return !v;
        });
      } else if (isPlayerControl && activeUnit) {
        if (k === '1') handleChooseMove();
        else if (k === '2') handleChooseAttack();
        else if (k === '3') {
          soundEngine.playUiTick();
          setActionMode((prev) => (prev === 'essence_select' ? 'radial' : 'essence_select'));
        } else if (k === '4') handleChooseDefense();
        else if (k === '5') handleChooseWait();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screenState,
    cutIn,
    statusUnitId,
    inspectUnitId,
    inspectUnit,
    displayedUnit,
    actionMode,
    isPlayerControl,
    activeUnit,
    handleToggleInspect,
    handleOpenStatusFor,
    handleChooseMove,
    handleChooseAttack,
    handleChooseDefense,
    handleChooseWait,
  ]);

  const displayedUnitTile = displayedUnit
    ? tiles[displayedUnit.y]?.[displayedUnit.x] ?? null
    : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0d0f12]">
      {/* Isolated Full-Bleed Isometric Battle Canvas */}
      <BattleCanvas
        tiles={tiles}
        units={units}
        assets={assets}
        activeUnitId={activeUnit?.id ?? null}
        selectedUnitId={displayedUnit?.id ?? null}
        hoveredTile={hoveredTile}
        reachableTiles={reachableTiles}
        pathPreview={pathPreview}
        attackTargetTiles={attackTargetTiles}
        lockedTargetUnitId={cutIn?.defenderId ?? null}
        showGrid={showGrid}
        xrayCutaway={xrayCutaway}
        showTopologyOverlay={false}
        isRenderingActive={screenState === 'playing' && !cutIn && !statusUnit}
        visualOverridesRef={visualOverridesRef}
        floatingTextsRef={floatingTextsRef}
        projectilesRef={projectilesRef}
        traumaRef={traumaRef}
        hitstopRef={hitstopRef}
        panTargetRef={panTargetRef}
        onHoverTile={setHoveredTile}
        onClickTile={handleClickTile}
        onActiveUnitScreenPos={setActiveUnitScreenPos}
      />

      {/* Lightweight atmospheric edge vignette */}
      {screenState !== 'title' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[5]"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0) 54%, rgba(7,9,12,0.52) 100%)',
          }}
        />
      )}

      {/* TITLE SCREEN */}
      {screenState === 'title' && (
        <TitleScreen onStart={handleStartFromTitle} assetsReady={Boolean(assets)} />
      )}

      {/* PRELUDE DARK PAIN TACTICAL HUD */}
      {screenState === 'playing' && !cutIn && (
        <div className="pointer-events-none fixed inset-0 z-10">
          {/* Top-Left Minimalist Floating Turn Header (No Clunky Box) */}
          <div className="fixed top-4 left-5 pointer-events-none">
            <div
              className="pl-1 pr-6 py-1.5"
              style={{
                background:
                  'linear-gradient(90deg, rgba(8, 10, 15, 0.56) 0%, rgba(8, 10, 15, 0.24) 72%, transparent 100%)',
              }}
            >
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 shrink-0" aria-hidden="true">
                  <polygon
                    points="5,0 10,5 5,10 0,5"
                    fill={activeUnit?.faction === 'enemy' ? '#df534f' : '#e8be66'}
                  />
                </svg>
                <p className="font-display font-bold text-[13px] tracking-[0.16em] uppercase text-[#faf1df] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                  {activeUnit?.faction === 'enemy'
                    ? `${activeUnit.name} Stalks`
                    : `${activeUnit?.name ?? 'Hero'}'s Turn`}
                </p>
              </div>
              <div
                aria-hidden="true"
                className="h-[1px] w-52 my-1"
                style={{
                  background:
                    activeUnit?.faction === 'enemy'
                      ? 'linear-gradient(90deg, rgba(223, 83, 79, 0.72), transparent)'
                      : 'linear-gradient(90deg, rgba(232, 190, 102, 0.72), transparent)',
                }}
              />
              <p className="text-[11px] text-[#d3cab6] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] pl-4">
                Ruined Watchtower · {units.filter((u) => u.faction === 'enemy' && u.alive).length} Shadows Remaining
              </p>
            </div>
          </div>

          {/* Top-Right Turn Order Ribbon & Utility Controls */}
          <div className="fixed top-4 right-5">
            <TurnOrderRibbon
              turnQueue={turnQueue}
              turnNumber={turnNumber}
              assets={assets}
              showGrid={showGrid}
              xrayCutaway={xrayCutaway}
              inspectOpen={Boolean(inspectUnit)}
              muted={muted}
              onSelectUnit={(u) => {
                soundEngine.playUiTick();
                setInspectedUnitId(u.id);
                if (inspectUnitId) setInspectUnitId(u.id);
                panTargetRef.current = { gx: u.x, gy: u.y };
              }}
              onToggleInspect={handleToggleInspect}
              onOpenStatus={() => handleOpenStatusFor(inspectUnit ?? displayedUnit ?? activeUnit)}
              onToggleGrid={() => {
                soundEngine.playUiTick();
                setShowGrid((v) => !v);
              }}
              onToggleCutaway={() => {
                soundEngine.playUiTick();
                setXrayCutaway((v) => !v);
              }}
              onToggleMute={() => {
                setMuted((v) => {
                  soundEngine.muted = !v;
                  return !v;
                });
              }}
              onOpenPause={() => {
                soundEngine.playUiTick();
                setScreenState('paused');
              }}
            />
          </div>

          {/* Bottom-Left Living Animated Portrait & Low-Number Tactical Plaque */}
          <div className="fixed bottom-5 left-5">
            <UnitPortraitPanel
              unit={displayedUnit}
              unitTile={displayedUnitTile}
              hoveredTile={hoveredTile}
              assets={assets}
              moodOverride={
                portraitMoodOverride && displayedUnit?.id === portraitMoodOverride.unitId
                  ? portraitMoodOverride.mood
                  : null
              }
              isEnemyTurn={activeUnit?.faction === 'enemy'}
              onInspectUnit={(u) => {
                soundEngine.playUiTick();
                setInspectUnitId(u.id);
                setInspectedUnitId(u.id);
                panTargetRef.current = { gx: u.x, gy: u.y };
              }}
              onOpenStatus={(u) => handleOpenStatusFor(u)}
            />
          </div>

          {/* Modern Dynamic Tactical Command Dock (Always Ready on Hero Turn) */}
          {isPlayerControl && activeUnit && (
            <RadialActionMenu
              unit={activeUnit}
              anchor={activeUnitScreenPos}
              mode={actionMode}
              selectedSkill={selectedSkill}
              onOpenRadial={() => {
                soundEngine.playUiTick();
                setActionMode('radial');
              }}
              onChooseMove={handleChooseMove}
              onChooseAttack={handleChooseAttack}
              onOpenEssence={() => {
                soundEngine.playUiTick();
                setActionMode('essence_select');
              }}
              onSelectEssenceSkill={handleEnterTargetForSkill}
              onChooseDefense={handleChooseDefense}
              onChooseWait={handleChooseWait}
              onBackToRadial={() => {
                soundEngine.playUiTick();
                setActionMode('radial');
                setSelectedSkill(null);
              }}
            />
          )}

          {/* Enemy & Unit Tactical Inspect Drawer */}
          {inspectUnit && !statusUnit && (
            <InspectDrawer
              unit={inspectUnit}
              unitTile={tiles[inspectUnit.y]?.[inspectUnit.x] ?? null}
              allLivingUnits={livingUnits}
              assets={assets}
              onSelectUnit={(u) => {
                soundEngine.playUiTick();
                setInspectUnitId(u.id);
                setInspectedUnitId(u.id);
                panTargetRef.current = { gx: u.x, gy: u.y };
              }}
              onOpenFullStatus={(u) => handleOpenStatusFor(u)}
              onClose={() => {
                soundEngine.playUiTick();
                setInspectUnitId(null);
              }}
            />
          )}
        </div>
      )}

      {/* FULL CHARACTER STATUS SHOWCASE SCREEN */}
      {screenState === 'playing' && !cutIn && statusUnit && (
        <CharacterStatusModal
          unit={statusUnit}
          allUnits={units}
          tiles={tiles}
          assets={assets}
          onSelectUnit={(u) => {
            soundEngine.playUiTick();
            setStatusUnitId(u.id);
          }}
          onClose={() => {
            soundEngine.playUiTick();
            setStatusUnitId(null);
          }}
        />
      )}

      {/* 3-STAGE CEL-SHADED COMBAT CUT-IN SEQUENCE */}
      {screenState === 'playing' && cutIn && cutInDerived && (
        <CombatCutInOverlay
          phase={cutIn.phase}
          cutInCategory={cutIn.cutInCategory}
          attacker={cutInDerived.attacker}
          defender={cutInDerived.defender}
          attackerSkills={cutInDerived.scopedSkills}
          inRangeSkillIds={cutInDerived.inRangeSkillIds}
          selectedSkill={cutInDerived.skill}
          selectedStance={cutIn.stanceId}
          selectedReaction={cutIn.reactionId}
          forecast={cutInDerived.forecast}
          baseForecast={cutInDerived.baseForecast}
          clashResult={cutIn.clashResult}
          assets={assets}
          isPlayerDefending={cutInDerived.defender.faction === 'hero'}
          onSelectSkill={(sk) => {
            soundEngine.playUiTick();
            setCutIn((prev) => {
              if (!prev) return prev;
              const nextStance: AttackStanceId =
                cutInDerived.attacker.essence >= sk.essenceCost + 1 ? prev.stanceId : 'standard';
              return { ...prev, skillId: sk.id, stanceId: nextStance };
            });
          }}
          onSelectStance={(st) => {
            soundEngine.playUiTick();
            setCutIn((prev) => (prev ? { ...prev, stanceId: st } : prev));
          }}
          onSelectReaction={(rx) => {
            soundEngine.playUiTick();
            setCutIn((prev) => (prev ? { ...prev, reactionId: rx } : prev));
          }}
          onConfirmSelect={handleConfirmSelectCutIn}
          onCancelSelect={() => {
            soundEngine.playUiTick();
            setCutIn(null);
            setSelectedSkill(null);
            setActionMode('radial');
          }}
          onConfirmAttackPose={handleConfirmAttackPoseCutIn}
          onConfirmResolution={handleConfirmResolutionCutIn}
        />
      )}

      {/* PAUSE MODAL */}
      {screenState === 'paused' && (
        <PauseModal
          onResume={() => {
            soundEngine.playUiTick();
            setScreenState('playing');
          }}
          onRestart={() => {
            soundEngine.playUiTick();
            resetBattle(true);
          }}
          onReturnTitle={() => {
            soundEngine.playUiTick();
            resetBattle(false);
          }}
        />
      )}

      {/* VICTORY / DEFEAT FANFARE CUT-IN MODAL */}
      {screenState === 'gameover' && outcome && (
        <OutcomeModal
          outcome={outcome}
          stats={frozenSnapshot}
          assets={assets}
          onPlayAgain={() => {
            soundEngine.playUiTick();
            resetBattle(true);
          }}
          onReturnTitle={() => {
            soundEngine.playUiTick();
            resetBattle(false);
          }}
        />
      )}
    </div>
  );
}
