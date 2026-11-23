import React, { useEffect, useState } from 'react';
import { TileData } from '../game/mapTopology';
import { TacticalUnit, PortraitMood, resolveUnitMood } from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';
import { AnimatedPortrait } from './AnimatedPortrait';

interface UnitPortraitPanelProps {
  unit: TacticalUnit | null;
  unitTile: TileData | null;
  hoveredTile: TileData | null;
  assets: LoadedGameAssets | null;
  moodOverride?: PortraitMood | null;
  isEnemyTurn: boolean;
  onInspectUnit: (unit: TacticalUnit) => void;
  onOpenStatus: (unit: TacticalUnit) => void;
}

/**
 * Minimalist Translucent Tactical Fantasy Unit Crest (bottom-left).
 * Uses a living animated full-bleed glamour portrait (breathing motion, drifting embers,
 * highland mist, zero white-background cutout artifacts) beside an open-edge frosted veil
 * with instant Inspect and Character Status triggers.
 */
export const UnitPortraitPanel: React.FC<UnitPortraitPanelProps> = ({
  unit,
  unitTile,
  hoveredTile,
  assets,
  moodOverride,
  isEnemyTurn,
  onInspectUnit,
  onOpenStatus,
}) => {
  const [ghostVit, setGhostVit] = useState<number>(unit?.vitality ?? 10);

  useEffect(() => {
    if (!unit) return;
    if (unit.vitality > ghostVit) {
      setGhostVit(unit.vitality);
      return;
    }
    const timer = window.setTimeout(() => {
      setGhostVit(unit.vitality);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [unit?.id, unit?.vitality]);

  if (!unit) return null;

  const mood = resolveUnitMood(unit, moodOverride);
  const glamourPortrait = assets?.characters[unit.sheetId]?.glamourPortrait;
  const isEnemy = unit.faction === 'enemy';
  const terrainEva = unitTile ? Math.round(unitTile.evasionBonus / 10) : 0;
  const effectiveEva = unit.evasion + terrainEva;

  return (
    <aside
      aria-label="Selected Unit Attributes"
      className="pointer-events-auto flex flex-col gap-2 max-w-[430px]"
    >
      {/* Living Animated Portrait Crest + Open-Edge Translucent Veil */}
      <div className="relative flex items-center gap-3">
        {/* Clickable Chamfered Living Portrait (Opens Full Character Status Showcase) */}
        <button
          type="button"
          onClick={() => onOpenStatus(unit)}
          title={`Open ${unit.name}'s Character Status (C)`}
          aria-label={`Open ${unit.name} Status Screen`}
          className={`group relative w-[92px] h-[112px] shrink-0 chamfer-crest p-[1.5px] cursor-pointer transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-[#f2d69a] ${
            isEnemy
              ? 'bg-gradient-to-b from-[#e05d56] via-[#8a2e2c]/70 to-[#e05d56]/50'
              : 'bg-gradient-to-b from-[#edc97a] via-[#947238]/65 to-[#edc97a]/45'
          } shadow-[0_10px_26px_rgba(0,0,0,0.62)]`}
        >
          <AnimatedPortrait
            src={glamourPortrait}
            sheetId={unit.sheetId}
            name={unit.name}
            mood={mood}
            isEnemy={isEnemy}
            swordElement={unit.swordElement}
            hidden={unit.hidden}
            variant="hud"
            className="w-full h-full chamfer-crest"
          />
          <span className="absolute top-1.5 left-2 z-20 font-mono-num text-[10px] font-bold text-[#f4d48e] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            H{unitTile?.height ?? 0}
          </span>
        </button>

        {/* Open-Edge Translucent Veil Readout */}
        <div
          className="flex-1 min-w-[276px] py-2 pl-3 pr-5 backdrop-blur-[9px]"
          style={{
            background: isEnemy
              ? 'linear-gradient(90deg, rgba(22, 12, 15, 0.74) 0%, rgba(14, 10, 13, 0.54) 76%, rgba(14, 10, 13, 0) 100%)'
              : 'linear-gradient(90deg, rgba(11, 14, 20, 0.74) 0%, rgba(11, 14, 20, 0.54) 76%, rgba(11, 14, 20, 0) 100%)',
            borderTop: isEnemy
              ? '1px solid rgba(212, 86, 82, 0.44)'
              : '1px solid rgba(214, 178, 112, 0.4)',
            borderBottom: isEnemy
              ? '1px solid rgba(212, 86, 82, 0.24)'
              : '1px solid rgba(214, 178, 112, 0.2)',
          }}
        >
          {/* Header Row: Name + Quiet Status + Reaction Diamonds */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-[15px] leading-tight tracking-[0.04em] text-[#faf2e2] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] truncate">
                {unit.name}
              </h2>
              <p className="text-[11px] text-[#c5bba8]/90 truncate">
                {unit.title} ·{' '}
                {unit.hidden
                  ? 'Hidden in Smoke'
                  : unit.swordElement === 'ferunium'
                  ? 'Ferunium Fire'
                  : unit.swordElement === 'auruinum'
                  ? 'Auruinum Arcane'
                  : isEnemyTurn && isEnemy
                  ? 'Acting'
                  : unit.guarding
                  ? 'Guarding'
                  : unit.slowedTurns > 0
                  ? 'Slowed'
                  : 'Ready'}
              </p>
            </div>

            <div
              className="flex items-center gap-1.5 pt-0.5 shrink-0"
              aria-label={`Reaction ${unit.reaction} of ${unit.maxReaction}`}
              title={`Reaction ${unit.reaction}/${unit.maxReaction}`}
            >
              <span className="text-[9px] tracking-[0.14em] uppercase text-[#c7bca8]">React</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: unit.maxReaction }).map((_, idx) => (
                  <svg key={idx} viewBox="0 0 14 16" className="w-3 h-3" aria-hidden="true">
                    <polygon
                      points="7,1 13,8 7,15 1,8"
                      fill={idx < unit.reaction ? '#efbf62' : 'rgba(26,29,36,0.75)'}
                      stroke={idx < unit.reaction ? '#fff0c2' : 'rgba(130,122,108,0.6)'}
                      strokeWidth="1.2"
                    />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          {/* Slim Segmented Vitality Bar */}
          <div className="mt-2">
            <div className="flex items-baseline justify-between text-[10px] mb-1">
              <span className="text-[#c8bfa9] tracking-[0.12em]">Vitality</span>
              <span className="font-mono-num font-semibold text-[#faf3e4]">
                {unit.vitality} / {unit.maxVitality}
              </span>
            </div>
            <div className="flex items-center gap-[3px] w-full">
              {Array.from({ length: unit.maxVitality }).map((_, idx) => {
                const filled = idx < unit.vitality;
                const ghost = !filled && idx < ghostVit;
                return (
                  <div
                    key={idx}
                    className={`h-[7px] flex-1 transition-colors ${
                      filled
                        ? isEnemy
                          ? 'bg-[#d94d4d] shadow-[0_0_6px_rgba(217,77,77,0.45)]'
                          : unit.vitality <= Math.ceil(unit.maxVitality * 0.35)
                          ? 'bg-[#e0823d]'
                          : 'bg-[#5cb87e]'
                        : ghost
                        ? 'bg-[#e39644]/75'
                        : 'bg-[#ffffff]/12'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Slim Essence Crystal Strip */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#9cb8dc] tracking-[0.12em] shrink-0">Essence</span>
            <div className="flex items-center gap-1 flex-1 justify-end">
              {Array.from({ length: unit.maxEssence }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-[5px] w-3.5 ${
                    idx < unit.essence ? 'bg-[#74b0f6]' : 'bg-[#ffffff]/12'
                  }`}
                />
              ))}
              <span className="font-mono-num text-[10px] font-semibold text-[#d3e6ff] ml-1 shrink-0">
                {unit.essence}/{unit.maxEssence}
              </span>
            </div>
          </div>

          {/* Unboxed Stat Whisper Line + Compact Inspect / Status Links */}
          <div className="mt-2 pt-1.5 border-t border-[#e5c27b]/18 flex items-center justify-between gap-2 text-[11px] font-mono-num text-[#ebe1cd]">
            <div className="flex items-center gap-1.5">
              <span>
                <span className="text-[#9e9687] text-[10px] mr-0.5">EVA</span>
                {effectiveEva}
              </span>
              <span aria-hidden="true" className="text-[#696256]">·</span>
              <span>
                <span className="text-[#9e9687] text-[10px] mr-0.5">ATK</span>+{unit.atk}
              </span>
              <span aria-hidden="true" className="text-[#696256]">·</span>
              <span>
                <span className="text-[#9e9687] text-[10px] mr-0.5">MOV</span>
                {Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0))}
              </span>
              <span aria-hidden="true" className="text-[#696256]">·</span>
              <span>
                <span className="text-[#9e9687] text-[10px] mr-0.5">CRT</span>
                {unit.crit}%
              </span>
            </div>

            <div className="flex items-center gap-2 font-sans shrink-0">
              <button
                type="button"
                onClick={() => onInspectUnit(unit)}
                className="text-[10px] uppercase tracking-[0.12em] text-[#efd08a] hover:text-[#ffffff] underline underline-offset-2 decoration-[#efd08a]/50 cursor-pointer"
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={() => onOpenStatus(unit)}
                className="text-[10px] uppercase tracking-[0.12em] text-[#c7d8ee] hover:text-[#ffffff] underline underline-offset-2 decoration-[#8cbcf7]/50 cursor-pointer"
              >
                Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slim Floating Terrain Line on Hover */}
      {hoveredTile && (
        <div
          className="px-3 py-1 flex items-center justify-between gap-3 text-[11px] backdrop-blur-md"
          style={{
            background:
              'linear-gradient(90deg, rgba(10, 12, 18, 0.68) 0%, rgba(10, 12, 18, 0.44) 80%, rgba(10, 12, 18, 0) 100%)',
            borderTop: '1px solid rgba(212, 174, 106, 0.25)',
          }}
        >
          <span className="text-[#eee4d0] font-medium truncate">{hoveredTile.label}</span>
          <div className="flex items-center gap-2 text-[#bfb5a2] font-mono-num shrink-0">
            <span>
              ({hoveredTile.x},{hoveredTile.y})
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#e8c67c]">H{hoveredTile.height}</span>
            {hoveredTile.blocked ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#e27a7a]">Blocked</span>
              </>
            ) : hoveredTile.evasionBonus !== 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Eva{' '}
                  {hoveredTile.evasionBonus > 0
                    ? `+${Math.round(hoveredTile.evasionBonus / 10)}`
                    : Math.round(hoveredTile.evasionBonus / 10)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
};
