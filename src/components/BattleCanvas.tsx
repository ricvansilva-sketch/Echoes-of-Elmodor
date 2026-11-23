import React, { useEffect, useRef } from 'react';
import {
  TileData,
  ISO_CONFIG,
  MAP_CALIBRATION,
  gridToScreen,
  getTileDiamond,
  pickTileAtMapPoint,
  isTileOccluded,
  getOccludingTilesFor,
} from '../game/mapTopology';
import {
  TacticalUnit,
  GridPos,
  ReachableNode,
  FacingDir,
  tileKey,
} from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';

export interface FloatingTextEvent {
  id: number;
  gx: number;
  gy: number;
  text: string;
  subtext?: string;
  color: string;
  createdAt: number;
}

export interface ProjectileAnim {
  fromX: number;
  fromY: number;
  fromH: number;
  toX: number;
  toY: number;
  toH: number;
  color: string;
  progress: number;
  duration: number;
}

export interface UnitVisualOverride {
  renderX: number;
  renderY: number;
  renderH: number;
  hopOffset: number;
  lungeX: number;
  lungeY: number;
  flashTimer: number;
  koAlpha: number;
  facing: FacingDir;
}

export interface BattleCanvasProps {
  tiles: TileData[][];
  units: TacticalUnit[];
  assets: LoadedGameAssets | null;
  activeUnitId: string | null;
  selectedUnitId: string | null;
  hoveredTile: TileData | null;
  reachableTiles: Map<string, ReachableNode>;
  pathPreview: GridPos[];
  attackTargetTiles: Set<string>;
  lockedTargetUnitId: string | null;
  showGrid: boolean;
  xrayCutaway: boolean;
  showTopologyOverlay: boolean;
  isRenderingActive: boolean;
  visualOverridesRef: React.MutableRefObject<Record<string, UnitVisualOverride>>;
  floatingTextsRef: React.MutableRefObject<FloatingTextEvent[]>;
  projectilesRef: React.MutableRefObject<ProjectileAnim[]>;
  traumaRef: React.MutableRefObject<number>;
  hitstopRef: React.MutableRefObject<number>;
  panTargetRef: React.MutableRefObject<{ gx: number; gy: number } | null>;
  onHoverTile: (tile: TileData | null) => void;
  onClickTile: (tile: TileData) => void;
  onActiveUnitScreenPos: (pos: { x: number; y: number } | null) => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'ember' | 'spark' | 'dust';
}

const PARTICLE_POOL_SIZE = 140;

export function spawnBurstParticles(
  pool: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 110
) {
  let spawned = 0;
  for (let i = 0; i < pool.length && spawned < count; i++) {
    if (!pool[i].active) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      pool[i].active = true;
      pool[i].x = x;
      pool[i].y = y;
      pool[i].vx = Math.cos(ang) * spd;
      pool[i].vy = Math.sin(ang) * spd - 35;
      pool[i].size = 2.2 + Math.random() * 3.4;
      pool[i].alpha = 1;
      pool[i].life = 0;
      pool[i].maxLife = 0.35 + Math.random() * 0.35;
      pool[i].color = color;
      pool[i].kind = 'spark';
      spawned++;
    }
  }
}

export const BattleCanvas: React.FC<BattleCanvasProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Camera state in master 1920x1080 map space
  const camRef = useRef({
    x: 960,
    y: 540,
    zoom: 1.0,
    targetZoom: 1.0,
    initialized: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragCamStartX: 0,
    dragCamStartY: 0,
    movedDistance: 0,
  });

  const keysRef = useRef<Set<string>>(new Set());
  const lastReportedPosRef = useRef<{ x: number; y: number } | null>(null);
  const particlePoolRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_POOL_SIZE }, (_, idx) => ({
      active: idx < 38,
      x: Math.random() * ISO_CONFIG.canvasWidth,
      y: Math.random() * ISO_CONFIG.canvasHeight,
      vx: 14 + Math.random() * 18,
      vy: -6 + Math.random() * 12,
      size: 1.5 + Math.random() * 2.2,
      alpha: 0.25 + Math.random() * 0.4,
      life: Math.random() * 6,
      maxLife: 5 + Math.random() * 5,
      color: idx % 3 === 0 ? '#f4d18c' : '#d8e3c5',
      kind: 'ember',
    }))
  );

  // Listen for burst events via custom window event for zero-re-render combat FX
  useEffect(() => {
    const onBurst = (ev: Event) => {
      const detail = (ev as CustomEvent<{ gx: number; gy: number; color: string; count: number }>).detail;
      if (!detail) return;
      const tile = propsRef.current.tiles[detail.gy]?.[detail.gx];
      const pt = gridToScreen(detail.gx, detail.gy, tile?.height ?? 0);
      spawnBurstParticles(particlePoolRef.current, pt.x, pt.y - 26, detail.color, detail.count);
    };
    window.addEventListener('elmodor:burst', onBurst);
    return () => window.removeEventListener('elmodor:burst', onBurst);
  }, []);

  // Main isolated 60fps canvas loop & pointer/keyboard bindings (mounted once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    // Pre-bake the static 30x30 walkable isometric grid once onto an offscreen canvas (1 drawImage vs 900 strokes/frame!)
    const gridCache = document.createElement('canvas');
    gridCache.width = ISO_CONFIG.canvasWidth;
    gridCache.height = ISO_CONFIG.canvasHeight;
    const gctx = gridCache.getContext('2d')!;
    gctx.strokeStyle = 'rgba(245, 236, 214, 0.13)';
    gctx.lineWidth = 0.85;
    for (let y = 0; y < ISO_CONFIG.mapSize; y++) {
      for (let x = 0; x < ISO_CONFIG.mapSize; x++) {
        const tile = propsRef.current.tiles[y][x];
        if (tile.blocked) continue;
        const pts = getTileDiamond(x, y, tile.height, ISO_CONFIG);
        gctx.beginPath();
        gctx.moveTo(pts[0].x, pts[0].y);
        gctx.lineTo(pts[1].x, pts[1].y);
        gctx.lineTo(pts[2].x, pts[2].y);
        gctx.lineTo(pts[3].x, pts[3].y);
        gctx.closePath();
        gctx.stroke();
      }
    }

    // Offscreen 1:1 pre-scaled cache for the painted battle map (avoids per-frame JPEG rescale)
    let mapCache: HTMLCanvasElement | null = null;
    let mapCacheSource: HTMLImageElement | null = null;

    // Offscreen cached tactical highlight overlay (rebuilt ONLY when reachable/attack sets change)
    const overlayCache = document.createElement('canvas');
    overlayCache.width = ISO_CONFIG.canvasWidth;
    overlayCache.height = ISO_CONFIG.canvasHeight;
    const octx = overlayCache.getContext('2d')!;
    let lastReachRef: Map<string, ReachableNode> | null = null;
    let lastAttackRef: Set<string> | null = null;
    let lastUnitsRef: TacticalUnit[] | null = null;
    let overlayHasContent = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(320, rect.width || window.innerWidth);
      height = Math.max(240, rect.height || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      if (!camRef.current.initialized) {
        // Fit the 16:9 Banner Saga battle map cleanly so outer non-playable highland ambience frames the arena
        const fitZoom = Math.max(width / ISO_CONFIG.canvasWidth, height / ISO_CONFIG.canvasHeight);
        const startZoom = Math.min(1.24, Math.max(fitZoom * 1.04, 0.82));
        camRef.current.zoom = startZoom;
        camRef.current.targetZoom = startZoom;
        camRef.current.x = 960;
        camRef.current.y = 540;
        camRef.current.initialized = true;
      }
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const screenToMap = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const cam = camRef.current;
      return {
        x: (sx - width / 2) / cam.zoom + cam.x,
        y: (sy - height / 2) / cam.zoom + cam.y,
      };
    };

    const mapToScreen = (mx: number, my: number) => {
      const cam = camRef.current;
      return {
        x: (mx - cam.x) * cam.zoom + width / 2,
        y: (my - cam.y) * cam.zoom + height / 2,
      };
    };

    const clampCamera = () => {
      const cam = camRef.current;
      const minZoom = Math.max(
        width / ISO_CONFIG.canvasWidth,
        height / ISO_CONFIG.canvasHeight
      ) * 0.96;
      cam.targetZoom = Math.max(minZoom, Math.min(2.15, cam.targetZoom));
      cam.zoom = Math.max(minZoom * 0.9, Math.min(2.2, cam.zoom));

      const halfViewW = width / (2 * cam.zoom);
      const halfViewH = height / (2 * cam.zoom);
      const padX = 140;
      const padY = 100;
      const minX = Math.min(ISO_CONFIG.canvasWidth / 2, halfViewW - padX);
      const maxX = Math.max(ISO_CONFIG.canvasWidth / 2, ISO_CONFIG.canvasWidth - halfViewW + padX);
      const minY = Math.min(ISO_CONFIG.canvasHeight / 2, halfViewH - padY);
      const maxY = Math.max(ISO_CONFIG.canvasHeight / 2, ISO_CONFIG.canvasHeight - halfViewH + padY);
      cam.x = Math.max(minX, Math.min(maxX, cam.x));
      cam.y = Math.max(minY, Math.min(maxY, cam.y));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      camRef.current.dragging = true;
      camRef.current.dragStartX = e.clientX;
      camRef.current.dragStartY = e.clientY;
      camRef.current.dragCamStartX = camRef.current.x;
      camRef.current.dragCamStartY = camRef.current.y;
      camRef.current.movedDistance = 0;
      propsRef.current.panTargetRef.current = null;
    };

    /** Checks living unit sprite hitboxes (front-to-back) so clicking a character's torso/head selects them cleanly */
    const pickUnitTileAtMapPoint = (mx: number, my: number): TileData | null => {
      const p = propsRef.current;
      // Sort front-to-back (highest depth first) so foreground units win overlaps
      const living = p.units
        .filter((u) => u.alive)
        .sort((a, b) => b.x + b.y - (a.x + a.y));
      for (const u of living) {
        const tile = p.tiles[u.y]?.[u.x];
        if (!tile) continue;
        const pt = gridToScreen(u.x, u.y, tile.height, ISO_CONFIG);
        const isQuad = u.sheetId === 'panther';
        const footY = pt.y + (isQuad ? 7 : 8);
        const hitW = isQuad ? 28 : 22;
        const hitH = isQuad ? 44 : 60;
        if (mx >= pt.x - hitW && mx <= pt.x + hitW && my >= footY - hitH && my <= footY + 6) {
          return tile;
        }
      }
      return null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const cam = camRef.current;
      if (cam.dragging) {
        const dx = e.clientX - cam.dragStartX;
        const dy = e.clientY - cam.dragStartY;
        cam.movedDistance = Math.hypot(dx, dy);
        if (cam.movedDistance > 5) {
          cam.x = cam.dragCamStartX - dx / cam.zoom;
          cam.y = cam.dragCamStartY - dy / cam.zoom;
          clampCamera();
        }
      }
      const mp = screenToMap(e.clientX, e.clientY);
      const picked =
        (propsRef.current.reachableTiles.size === 0 ? pickUnitTileAtMapPoint(mp.x, mp.y) : null) ??
        pickTileAtMapPoint(mp.x, mp.y, propsRef.current.tiles, ISO_CONFIG);
      const prev = propsRef.current.hoveredTile;
      if ((picked?.x ?? -1) !== (prev?.x ?? -1) || (picked?.y ?? -1) !== (prev?.y ?? -1)) {
        propsRef.current.onHoverTile(picked);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const cam = camRef.current;
      const wasClick = cam.dragging && cam.movedDistance <= 6;
      cam.dragging = false;
      if (wasClick && e.button === 0) {
        const mp = screenToMap(e.clientX, e.clientY);
        const picked =
          (propsRef.current.reachableTiles.size === 0 ? pickUnitTileAtMapPoint(mp.x, mp.y) : null) ??
          pickTileAtMapPoint(mp.x, mp.y, propsRef.current.tiles, ISO_CONFIG);
        if (picked) {
          propsRef.current.onClickTile(picked);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.11 : 0.9;
      camRef.current.targetZoom *= factor;
      clampCamera();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysRef.current.add(k);
        propsRef.current.panTargetRef.current = null;
      } else if (k === '=' || k === '+') {
        camRef.current.targetZoom *= 1.14;
        clampCamera();
      } else if (k === '-' || k === '_') {
        camRef.current.targetZoom *= 0.88;
        clampCamera();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const clearInputs = () => {
      keysRef.current.clear();
      camRef.current.dragging = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    let rafId = 0;
    let lastTime = performance.now();
    let lastPaintTime = 0;

    const drawDiamond = (
      gx: number,
      gy: number,
      h: number,
      fillStyle: string | null,
      strokeStyle: string | null,
      lineWidth = 1.2
    ) => {
      const pts = getTileDiamond(gx, gy, h, ISO_CONFIG);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    const renderFrame = (now: number) => {
      const p = propsRef.current;

      // Skip canvas work when Title screen covers the viewport so startup is instantaneous
      if (!p.isRenderingActive) {
        lastTime = now;
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      // Pace idle frames smoothly (~30fps when static, full 60fps during motion/combat/panning)
      const isActiveMotion =
        camRef.current.dragging ||
        keysRef.current.size > 0 ||
        p.panTargetRef.current !== null ||
        p.projectilesRef.current.length > 0 ||
        p.floatingTextsRef.current.length > 0 ||
        p.traumaRef.current > 0.01 ||
        Object.keys(p.visualOverridesRef.current).length > 0;

      if (!isActiveMotion && now - lastPaintTime < 34) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      lastPaintTime = now;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      const tSec = now * 0.001;

      // Hitstop freezes simulation motion briefly on heavy impacts while shake/flash tick
      const hitstop = p.hitstopRef.current;
      if (hitstop > 0) {
        p.hitstopRef.current = Math.max(0, hitstop - dt);
      }
      const simDt = hitstop > 0 ? 0 : dt;

      // Smooth camera zoom & WASD pan
      const cam = camRef.current;
      cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(1, dt * 10);

      const panSpeed = 480 / cam.zoom;
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) cam.y -= panSpeed * dt;
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) cam.y += panSpeed * dt;
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) cam.x -= panSpeed * dt;
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) cam.x += panSpeed * dt;

      // Smooth focus-pan toward an active unit or clicked turn-order portrait
      if (p.panTargetRef.current) {
        const tgt = p.panTargetRef.current;
        const tTile = p.tiles[tgt.gy]?.[tgt.gx];
        const sp = gridToScreen(tgt.gx, tgt.gy, tTile?.height ?? 0);
        cam.x += (sp.x - cam.x) * Math.min(1, dt * 6.5);
        cam.y += (sp.y - 24 - cam.y) * Math.min(1, dt * 6.5);
        if (Math.hypot(sp.x - cam.x, sp.y - 24 - cam.y) < 3) {
          p.panTargetRef.current = null;
        }
      }

      clampCamera();

      // Decaying trauma^2 camera shake
      p.traumaRef.current = Math.max(0, p.traumaRef.current - dt * 2.4);
      const shakeMag = p.traumaRef.current * p.traumaRef.current * 14;
      const shakeX = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
      const shakeY = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;

      // Update active unit screen position for the Prelude Dark Pain Radial Menu
      if (p.activeUnitId) {
        const active = p.units.find((u) => u.id === p.activeUnitId && u.alive);
        if (active) {
          const ov = p.visualOverridesRef.current[active.id];
          const gx = ov ? ov.renderX : active.x;
          const gy = ov ? ov.renderY : active.y;
          const gh = ov ? ov.renderH : p.tiles[active.y]?.[active.x]?.height ?? 0;
          const mapPt = gridToScreen(gx, gy, gh);
          const scr = mapToScreen(mapPt.x, mapPt.y - 34);
          const prev = lastReportedPosRef.current;
          if (!prev || Math.abs(prev.x - scr.x) > 1.5 || Math.abs(prev.y - scr.y) > 1.5) {
            lastReportedPosRef.current = { x: Math.round(scr.x), y: Math.round(scr.y) };
            p.onActiveUnitScreenPos(lastReportedPosRef.current);
          }
        }
      }

      // Clear background
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#141914';
      ctx.fillRect(0, 0, width, height);

      // Apply camera transform
      ctx.save();
      ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // 1. SINGLE PAINTED BANNER SAGA BATTLE MAP (1:1 pre-scaled offscreen blit)
      if (p.assets?.battleMap) {
        if (mapCacheSource !== p.assets.battleMap) {
          mapCache = document.createElement('canvas');
          mapCache.width = ISO_CONFIG.canvasWidth;
          mapCache.height = ISO_CONFIG.canvasHeight;
          const mctx = mapCache.getContext('2d')!;
          mctx.drawImage(p.assets.battleMap, 0, 0, ISO_CONFIG.canvasWidth, ISO_CONFIG.canvasHeight);
          mapCacheSource = p.assets.battleMap;
        }
        if (mapCache) {
          ctx.drawImage(
            mapCache,
            MAP_CALIBRATION.offsetX,
            MAP_CALIBRATION.offsetY,
            ISO_CONFIG.canvasWidth * MAP_CALIBRATION.scaleX,
            ISO_CONFIG.canvasHeight * MAP_CALIBRATION.scaleY
          );
        }
      }

      const N = ISO_CONFIG.mapSize;

      // 2. PRE-BAKED 30x30 MATHEMATICAL ISOMETRIC GRID (Single Fast Blit)
      if (p.showGrid && !p.showTopologyOverlay) {
        ctx.drawImage(gridCache, 0, 0);
      } else if (p.showTopologyOverlay) {
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const tile = p.tiles[y][x];
            const fill = tile.blocked
              ? 'rgba(185, 48, 48, 0.28)'
              : tile.terrain === 'stone_stair'
              ? 'rgba(235, 185, 76, 0.32)'
              : tile.terrain === 'stream'
              ? 'rgba(65, 145, 210, 0.26)'
              : `rgba(215, 232, 188, ${0.06 + tile.height * 0.035})`;
            drawDiamond(x, y, tile.height, fill, 'rgba(244, 236, 212, 0.28)', 0.9);
          }
        }
      }

      // 3 & 4. CACHED REACHABLE MOVE & ATTACK TARGET OVERLAYS (1 Fast Blit vs 70+ Strokes/Frame!)
      if (
        lastReachRef !== p.reachableTiles ||
        lastAttackRef !== p.attackTargetTiles ||
        lastUnitsRef !== p.units
      ) {
        lastReachRef = p.reachableTiles;
        lastAttackRef = p.attackTargetTiles;
        lastUnitsRef = p.units;
        octx.clearRect(0, 0, ISO_CONFIG.canvasWidth, ISO_CONFIG.canvasHeight);
        overlayHasContent = p.reachableTiles.size > 0 || p.attackTargetTiles.size > 0;

        const drawCachedDiamond = (
          gx: number,
          gy: number,
          h: number,
          fill: string,
          stroke: string,
          lw: number
        ) => {
          const pts = getTileDiamond(gx, gy, h, ISO_CONFIG);
          octx.beginPath();
          octx.moveTo(pts[0].x, pts[0].y);
          octx.lineTo(pts[1].x, pts[1].y);
          octx.lineTo(pts[2].x, pts[2].y);
          octx.lineTo(pts[3].x, pts[3].y);
          octx.closePath();
          octx.fillStyle = fill;
          octx.fill();
          octx.strokeStyle = stroke;
          octx.lineWidth = lw;
          octx.stroke();
        };

        for (const node of p.reachableTiles.values()) {
          const tile = p.tiles[node.y][node.x];
          const isStair = tile.terrain === 'stone_stair';
          drawCachedDiamond(
            node.x,
            node.y,
            tile.height,
            isStair ? 'rgba(98, 206, 224, 0.34)' : 'rgba(62, 162, 232, 0.28)',
            isStair ? 'rgba(244, 226, 158, 0.88)' : 'rgba(164, 224, 255, 0.78)',
            isStair ? 1.7 : 1.35
          );
          // Subtle inner beveled highlight diamond so reachable movement range reads with crisp AAA clarity
          const pts = getTileDiamond(node.x, node.y, tile.height, ISO_CONFIG);
          const cx = (pts[0].x + pts[2].x) * 0.5;
          const cy = (pts[0].y + pts[2].y) * 0.5;
          octx.beginPath();
          for (let k = 0; k < 4; k++) {
            const ix = cx + (pts[k].x - cx) * 0.76;
            const iy = cy + (pts[k].y - cy) * 0.76;
            if (k === 0) octx.moveTo(ix, iy);
            else octx.lineTo(ix, iy);
          }
          octx.closePath();
          octx.strokeStyle = isStair
            ? 'rgba(255, 240, 190, 0.42)'
            : 'rgba(194, 236, 255, 0.32)';
          octx.lineWidth = 0.9;
          octx.stroke();
        }

        for (const key of p.attackTargetTiles) {
          const [tx, ty] = key.split(',').map(Number);
          const tile = p.tiles[ty]?.[tx];
          if (!tile) continue;
          const hasEnemy = p.units.some(
            (u) => u.alive && u.faction === 'enemy' && u.x === tx && u.y === ty
          );
          drawCachedDiamond(
            tx,
            ty,
            tile.height,
            hasEnemy ? 'rgba(228, 56, 52, 0.48)' : 'rgba(196, 58, 56, 0.25)',
            hasEnemy ? 'rgba(255, 204, 150, 0.98)' : 'rgba(240, 114, 110, 0.62)',
            hasEnemy ? 2.3 : 1.2
          );
        }
      }

      if (overlayHasContent) {
        ctx.save();
        ctx.globalAlpha = 0.9 + Math.sin(tSec * 3.4) * 0.1;
        ctx.drawImage(overlayCache, 0, 0);
        ctx.restore();
      }

      // 5. HOVERED TILE & UPGRADED LUMINOUS PATHFINDING UI
      if (p.pathPreview.length > 1) {
        // Highlight every tile along the chosen march route in warm burnished gold
        for (let idx = 1; idx < p.pathPreview.length; idx++) {
          const stepPos = p.pathPreview[idx];
          const st = p.tiles[stepPos.y][stepPos.x];
          const isDest = idx === p.pathPreview.length - 1;
          drawDiamond(
            stepPos.x,
            stepPos.y,
            st.height,
            isDest ? 'rgba(246, 200, 96, 0.42)' : 'rgba(242, 196, 98, 0.26)',
            isDest ? 'rgba(255, 242, 192, 0.98)' : 'rgba(248, 214, 128, 0.84)',
            isDest ? 2.4 : 1.5
          );
        }
      }

      if (p.hoveredTile) {
        const ht = p.hoveredTile;
        const isLegalMove = p.reachableTiles.has(tileKey(ht.x, ht.y));
        const isAttack = p.attackTargetTiles.has(tileKey(ht.x, ht.y));
        drawDiamond(
          ht.x,
          ht.y,
          ht.height,
          isAttack
            ? 'rgba(244, 88, 68, 0.36)'
            : isLegalMove
            ? 'rgba(246, 206, 112, 0.34)'
            : 'rgba(255, 248, 228, 0.14)',
          ht.blocked ? 'rgba(210, 80, 80, 0.65)' : 'rgba(255, 232, 168, 0.98)',
          2.2
        );
      }

      if (p.pathPreview.length > 1) {
        ctx.save();
        const pts = p.pathPreview.map((stepPos) => {
          const st = p.tiles[stepPos.y][stepPos.x];
          return {
            ...gridToScreen(stepPos.x, stepPos.y, st.height),
            h: st.height,
          };
        });

        // Soft outer golden bloom ribbon
        ctx.beginPath();
        pts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = 'rgba(244, 186, 72, 0.36)';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Crisp dark contrast under-stroke for readability over bright grass/stone
        ctx.strokeStyle = 'rgba(18, 14, 8, 0.72)';
        ctx.lineWidth = 4.8;
        ctx.stroke();

        // Animated marching bright golden core ribbon
        ctx.strokeStyle = '#ffdf8c';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(tSec * 28);
        ctx.stroke();
        ctx.setLineDash([]);

        // Directional chevron arrowheads & elevation delta callouts along path
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          const ang = Math.atan2(b.y - a.y, b.x - a.x);

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(5.5, 0);
          ctx.lineTo(-3.5, -4);
          ctx.lineTo(-1.8, 0);
          ctx.lineTo(-3.5, 4);
          ctx.closePath();
          ctx.fillStyle = '#fff5d0';
          ctx.strokeStyle = 'rgba(18, 14, 8, 0.85)';
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Elevation step indicator when climbing or descending stairs
          const dh = b.h - a.h;
          if (dh !== 0) {
            ctx.save();
            ctx.font = '700 9.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            const tag = dh > 0 ? `▲+${dh}` : `▼${dh}`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(10, 12, 16, 0.92)';
            ctx.strokeText(tag, mx, my - 9);
            ctx.fillStyle = dh > 0 ? '#ffe596' : '#9ed4ff';
            ctx.fillText(tag, mx, my - 9);
            ctx.restore();
          }
        }

        // Pulsing destination reticle ring + step-cost badge
        const last = pts[pts.length - 1];
        const destTile = p.pathPreview[p.pathPreview.length - 1];
        const reachNode = p.reachableTiles.get(tileKey(destTile.x, destTile.y));
        const pulse = 1 + Math.sin(tSec * 5.2) * 0.1;

        ctx.beginPath();
        ctx.ellipse(last.x, last.y, 13 * pulse, 6.2 * pulse, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 240, 186, 0.96)';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(last.x, last.y, 4.4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff5cf';
        ctx.fill();

        const stepCost = reachNode ? reachNode.cost : p.pathPreview.length - 1;
        const badgeText = `${stepCost} MOV · H${last.h}`;
        ctx.font = '700 10px "JetBrains Mono", monospace';
        const tw = ctx.measureText(badgeText).width + 12;
        const bx = last.x - tw / 2;
        const by = last.y - 26;
        ctx.fillStyle = 'rgba(11, 14, 20, 0.88)';
        ctx.fillRect(bx, by, tw, 16);
        ctx.strokeStyle = 'rgba(244, 206, 114, 0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, tw, 16);
        ctx.fillStyle = '#fff1c7';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, last.x, by + 11.5);
        ctx.restore();
      }

      // 6. COMPUTE ACTIVE BLIND-ANGLE OCCLUDERS (units or hovered tile behind tall walls/pines)
      const cutawayOccluders = new Set<string>();
      const occludedUnitIds = new Set<string>();

      for (const u of p.units) {
        if (!u.alive) continue;
        const occs = getOccludingTilesFor(u.x, u.y, p.tiles, ISO_CONFIG);
        if (occs.length > 0) {
          occludedUnitIds.add(u.id);
          for (const oc of occs) {
            cutawayOccluders.add(tileKey(oc.x, oc.y));
          }
        }
      }
      if (p.hoveredTile && isTileOccluded(p.hoveredTile.x, p.hoveredTile.y, p.tiles, ISO_CONFIG)) {
        for (const oc of getOccludingTilesFor(p.hoveredTile.x, p.hoveredTile.y, p.tiles, ISO_CONFIG)) {
          cutawayOccluders.add(tileKey(oc.x, oc.y));
        }
      }

      // 7. DEPTH-SORTED PAINTER'S PASS: UNITS + FOREGROUND BRIDGE OCCLUDERS
      type RenderItem =
        | { kind: 'unit'; depth: number; unit: TacticalUnit }
        | { kind: 'occluder'; depth: number; tile: TileData };

      const drawList: RenderItem[] = [];
      for (const u of p.units) {
        const ov = p.visualOverridesRef.current[u.id];
        if (!u.alive && (!ov || ov.koAlpha <= 0.02)) continue;
        const rx = ov ? ov.renderX : u.x;
        const ry = ov ? ov.renderY : u.y;
        drawList.push({ kind: 'unit', depth: rx + ry + 0.05, unit: u });
      }

      // Add foreground bridge occluders ONLY where they actively interact with depth/cutaway
      // so the single painted map remains pristine while blind angles have genuine volumetric occlusion!
      for (const key of cutawayOccluders) {
        const [ox, oy] = key.split(',').map(Number);
        const tile = p.tiles[oy]?.[ox];
        if (tile && tile.occluder) {
          drawList.push({ kind: 'occluder', depth: tile.x + tile.y + 0.15, tile });
        }
      }
      // In X-Ray cutaway mode, highlight all watchtower occluder edges lightly
      if (p.xrayCutaway) {
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const tile = p.tiles[y][x];
            if (tile.terrain === 'tower_wall' && !cutawayOccluders.has(tileKey(x, y))) {
              drawList.push({ kind: 'occluder', depth: tile.x + tile.y + 0.15, tile });
            }
          }
        }
      }

      drawList.sort((a, b) => a.depth - b.depth);

      const drawUnitSprite = (u: TacticalUnit, ghostPass: boolean) => {
        const ov = p.visualOverridesRef.current[u.id];
        const rx = ov ? ov.renderX : u.x;
        const ry = ov ? ov.renderY : u.y;
        const rh = ov ? ov.renderH : p.tiles[u.y]?.[u.x]?.height ?? 0;
        const hop = ov ? ov.hopOffset : 0;
        const lungeX = ov ? ov.lungeX : 0;
        const lungeY = ov ? ov.lungeY : 0;
        const facing = ov ? ov.facing : u.facing;
        const koAlpha = ov ? ov.koAlpha : u.alive ? 1 : 0;
        const flashTimer = ov ? ov.flashTimer : 0;
        if (koAlpha <= 0.01) return;

        const pt = gridToScreen(rx, ry, rh);
        // Subtle ground-anchored breathing (feet stay 100% glued to tile surface — zero floating!)
        const breath = u.alive ? Math.sin(tSec * 2.4 + rx * 1.3) * 0.018 : 0;
        const isQuadruped = u.sheetId === 'panther';
        const groundY = pt.y + (isQuadruped ? 7 : 8);
        const footX = pt.x + lungeX;
        const footY = groundY - hop + lungeY;

        const isActive = u.id === p.activeUnitId;
        const isLockedTarget = u.id === p.lockedTargetUnitId;

        if (!ghostPass) {
          // Firm layered contact shadow & tactical ring planted directly under boots/paws
          const shadowScale = Math.max(0.55, 1 - hop / 34);
          const shadowRx = (isQuadruped ? 20 : 14) * shadowScale;
          const shadowRy = (isQuadruped ? 8 : 6.5) * shadowScale;

          ctx.save();
          ctx.globalAlpha = koAlpha;
          // Outer soft ambient ground occlusion
          ctx.beginPath();
          ctx.ellipse(pt.x, groundY - 2, shadowRx * 1.25, shadowRy * 1.25, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(8, 10, 12, 0.30)';
          ctx.fill();
          // Tight dark core contact shadow directly beneath feet/paws
          ctx.beginPath();
          ctx.ellipse(pt.x, groundY - 2.5, shadowRx, shadowRy, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(6, 8, 10, 0.66)';
          ctx.fill();

          if (isActive || isLockedTarget) {
            const ringPulse = 1 + Math.sin(tSec * 4.5) * 0.05;
            ctx.beginPath();
            ctx.ellipse(
              pt.x,
              groundY - 2,
              (isQuadruped ? 24 : 20) * ringPulse,
              (isQuadruped ? 11 : 9.5) * ringPulse,
              0,
              0,
              Math.PI * 2
            );
            ctx.strokeStyle = isLockedTarget
              ? 'rgba(244, 92, 72, 0.95)'
              : u.faction === 'hero'
              ? 'rgba(242, 200, 112, 0.95)'
              : 'rgba(220, 74, 74, 0.9)';
            ctx.lineWidth = 2.4;
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.ellipse(pt.x, groundY - 2, isQuadruped ? 21 : 16, isQuadruped ? 9.5 : 7.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle =
              u.faction === 'hero' ? 'rgba(116, 178, 232, 0.52)' : 'rgba(214, 82, 72, 0.52)';
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          // Active Elemental Sword Aura Ring for Aiori (Red Ferunium Fire / Blue Auruinum Arcane)
          if (u.swordElement !== 'none') {
            ctx.beginPath();
            ctx.ellipse(pt.x, groundY - 2, 16, 7.2, 0, 0, Math.PI * 2);
            ctx.strokeStyle =
              u.swordElement === 'ferunium'
                ? 'rgba(255, 112, 68, 0.88)'
                : 'rgba(104, 186, 255, 0.88)';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }

          // Swirling Smoke Screen Veil around Hidden Shadow Panthers
          if (u.hidden) {
            for (let s = 0; s < 4; s++) {
              const ang = tSec * 1.8 + s * (Math.PI / 2);
              const sx = pt.x + Math.cos(ang) * 14;
              const sy = groundY - 12 + Math.sin(ang) * 6 - (s % 2) * 5;
              ctx.beginPath();
              ctx.arc(sx, sy, 11 + Math.sin(tSec * 3 + s) * 2.5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(46, 36, 68, 0.44)';
              ctx.fill();
            }
          }
          ctx.restore();
        }

        // Character sprite scaled 1:1 with the 56px character-height elevation tiers,
        // anchored strictly at bottom-center (footX, footY) so boots & paws sit solidly on ground.
        const sprite = p.assets?.characters[u.sheetId]?.sprites[facing];
        if (sprite) {
          const targetH = isQuadruped
            ? u.id === 'panther_alpha'
              ? 45
              : 40
            : 58;
          const aspect = sprite.width / sprite.height;
          const drawW = targetH * aspect;
          const drawH = targetH;

          ctx.save();
          const hiddenAlpha = u.hidden ? 0.28 : 1;
          ctx.globalAlpha = ghostPass ? 0.62 * koAlpha * hiddenAlpha : koAlpha * hiddenAlpha;
          ctx.translate(footX, footY);
          ctx.scale(1 - breath * 0.4, 1 + breath);
          ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);

          // Fast zero-filter hit flash overlay
          if (!ghostPass && flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.72 * koAlpha;
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.restore();

          // Fast zero-filter blind-angle X-Ray halo ring around occluded unit
          if (ghostPass) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(footX, footY - drawH * 0.5, drawW * 0.45, drawH * 0.48, 0, 0, Math.PI * 2);
            ctx.strokeStyle =
              u.faction === 'hero' ? 'rgba(136, 204, 255, 0.85)' : 'rgba(255, 118, 96, 0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // Compact diegetic overhead X-COM segmented Vitality pips + Status Tag
          if (!ghostPass && u.alive) {
            const maxPips = Math.max(1, u.maxVitality);
            const pipGap = 1.5;
            const pipW = Math.min(4.2, (42 - (maxPips - 1) * pipGap) / maxPips);
            const totalBarW = maxPips * pipW + (maxPips - 1) * pipGap;
            const barH = 4.5;
            const bx = footX - totalBarW / 2;
            const by = footY - drawH - 11;

            ctx.save();
            ctx.fillStyle = 'rgba(10, 12, 16, 0.88)';
            ctx.fillRect(bx - 1.5, by - 1.5, totalBarW + 3, barH + 3);

            const vitRatio = u.vitality / u.maxVitality;
            const fillColor =
              u.faction === 'hero'
                ? vitRatio > 0.38
                  ? '#5fa876'
                  : '#d48f3b'
                : '#cf4848';

            for (let i = 0; i < maxPips; i++) {
              ctx.fillStyle = i < u.vitality ? fillColor : 'rgba(38, 42, 50, 0.9)';
              ctx.fillRect(bx + i * (pipW + pipGap), by, pipW, barH);
            }

            ctx.strokeStyle = isActive ? '#f2cf84' : 'rgba(218, 200, 168, 0.4)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(bx - 1.5, by - 1.5, totalBarW + 3, barH + 3);

            if (u.hidden) {
              ctx.fillStyle = '#c4a8ff';
              ctx.font = '700 9px Manrope, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('SHADOW', footX, by - 4);
            } else if (u.guarding) {
              ctx.fillStyle = '#e8c472';
              ctx.font = '700 9px Manrope, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('GUARD', footX, by - 4);
            } else if (u.slowedTurns > 0) {
              ctx.fillStyle = '#d88ef0';
              ctx.font = '700 9px Manrope, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('SLOW', footX, by - 4);
            } else if (u.swordElement === 'ferunium') {
              ctx.fillStyle = '#ff9975';
              ctx.font = '700 9px Manrope, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('FERUNIUM', footX, by - 4);
            } else if (u.swordElement === 'auruinum') {
              ctx.fillStyle = '#8ec8ff';
              ctx.font = '700 9px Manrope, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('AURUINUM', footX, by - 4);
            }
            ctx.restore();
          }
        }
      };

      const drawBridgeOccluder = (tile: TileData) => {
        if (!p.assets?.props) return;
        const pt = gridToScreen(tile.x, tile.y, tile.height);
        const isCutaway = cutawayOccluders.has(tileKey(tile.x, tile.y)) || p.xrayCutaway;

        ctx.save();
        // Smooth transparency cutaway when a unit stands in the blind angle behind this element
        ctx.globalAlpha = isCutaway ? 0.36 : 0.88;

        if (tile.terrain === 'tower_wall') {
          const prop = tile.propHeight >= 3.8 ? p.assets.props.pillar : p.assets.props.wall;
          const hPx = tile.propHeight * ISO_CONFIG.elevStep + 24;
          const wPx = hPx * (prop.width / prop.height);
          ctx.drawImage(prop, pt.x - wPx / 2, pt.y + 14 - hPx, wPx, hPx);
        } else if (tile.terrain === 'pine_tree') {
          const prop = p.assets.props.pine;
          const hPx = tile.propHeight * ISO_CONFIG.elevStep + 34;
          const wPx = hPx * (prop.width / prop.height);
          ctx.drawImage(prop, pt.x - wPx / 2, pt.y + 10 - hPx, wPx, hPx);
        } else if (tile.terrain === 'boulder') {
          const prop = p.assets.props.boulder;
          const hPx = tile.propHeight * ISO_CONFIG.elevStep + 18;
          const wPx = hPx * (prop.width / prop.height);
          ctx.drawImage(prop, pt.x - wPx / 2, pt.y + 10 - hPx, wPx, hPx);
        }

        // Subtle cutaway indicator outline on transparent occluder base
        if (isCutaway) {
          drawDiamond(tile.x, tile.y, tile.height, null, 'rgba(244, 214, 146, 0.35)', 1.0);
        }
        ctx.restore();
      };

      for (const item of drawList) {
        if (item.kind === 'unit') {
          drawUnitSprite(item.unit, false);
        } else {
          drawBridgeOccluder(item.tile);
        }
      }

      // 8. BLIND-ANGLE X-RAY GHOST SILHOUETTE PASS
      // Guarantees units standing behind tall watchtower walls remain unmistakable & readable
      for (const u of p.units) {
        if (!u.alive) continue;
        if (occludedUnitIds.has(u.id) || p.xrayCutaway) {
          drawUnitSprite(u, true);
          const pt = gridToScreen(u.x, u.y, p.tiles[u.y][u.x].height);
          ctx.save();
          ctx.setLineDash([3, 3]);
          drawDiamond(u.x, u.y, p.tiles[u.y][u.x].height, null, 'rgba(246, 224, 162, 0.8)', 1.4);
          ctx.setLineDash([]);
          ctx.fillStyle = '#f6df9d';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`H${p.tiles[u.y][u.x].height}`, pt.x, pt.y + 20);
          ctx.restore();
        }
      }

      // 9. PROJECTILE ARCS (Crimson Bolt / Shadow Snare)
      const projs = p.projectilesRef.current;
      for (let i = projs.length - 1; i >= 0; i--) {
        const pr = projs[i];
        pr.progress += simDt / pr.duration;
        if (pr.progress >= 1) {
          projs.splice(i, 1);
          continue;
        }
        const a = gridToScreen(pr.fromX, pr.fromY, pr.fromH);
        const b = gridToScreen(pr.toX, pr.toY, pr.toH);
        const t = pr.progress;
        const arcY = Math.sin(t * Math.PI) * 52;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y - 36 + (b.y - a.y) * t - arcY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = pr.color;
        ctx.shadowColor = pr.color;
        ctx.shadowBlur = 16;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff3e2';
        ctx.fill();
        ctx.restore();
      }

      // 10. ZERO-GC POOLED PARTICLES (Ambient Highland Wind Embers + Combat Hit Sparks)
      const pool = particlePoolRef.current;
      for (let i = 0; i < pool.length; i++) {
        const pt = pool[i];
        if (!pt.active) continue;
        pt.life += dt;
        if (pt.kind === 'ember') {
          pt.x += pt.vx * dt;
          pt.y += (pt.vy + Math.sin(tSec * 1.4 + i) * 7) * dt;
          if (pt.x > ISO_CONFIG.canvasWidth + 20 || pt.life > pt.maxLife) {
            pt.x = -10;
            pt.y = Math.random() * ISO_CONFIG.canvasHeight;
            pt.life = 0;
          }
          const fade = Math.sin((pt.life / pt.maxLife) * Math.PI);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = pt.alpha * fade;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 240 * dt;
          if (pt.life >= pt.maxLife) {
            pt.active = false;
            continue;
          }
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = Math.max(0, 1 - pt.life / pt.maxLife);
          ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
      }
      ctx.globalAlpha = 1;

      // 11. FLOATING COMBAT DAMAGE & MODIFIER CALLOUTS
      const floats = p.floatingTextsRef.current;
      for (let i = floats.length - 1; i >= 0; i--) {
        const fl = floats[i];
        const age = (now - fl.createdAt) / 1000;
        if (age > 1.35) {
          floats.splice(i, 1);
          continue;
        }
        const tileH = p.tiles[fl.gy]?.[fl.gx]?.height ?? 0;
        const pos = gridToScreen(fl.gx, fl.gy, tileH);
        const rise = age * 46;
        const alpha = age > 0.9 ? Math.max(0, 1 - (age - 0.9) / 0.45) : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = '800 22px "Cinzel", Georgia, serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(10, 10, 12, 0.92)';
        ctx.strokeText(fl.text, pos.x, pos.y - 78 - rise);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, pos.x, pos.y - 78 - rise);

        if (fl.subtext) {
          ctx.font = '700 11px "Manrope", sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeText(fl.subtext, pos.x, pos.y - 60 - rise);
          ctx.fillStyle = '#f5e4be';
          ctx.fillText(fl.subtext, pos.x, pos.y - 60 - rise);
        }
        ctx.restore();
      }

      ctx.restore();

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="battle-canvas"
      className="block w-full h-full cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
};
