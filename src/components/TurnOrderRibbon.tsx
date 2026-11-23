import React from 'react';
import { TacticalUnit, resolveUnitMood } from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';
import { AnimatedPortrait } from './AnimatedPortrait';

interface TurnOrderRibbonProps {
  turnQueue: TacticalUnit[];
  turnNumber: number;
  assets: LoadedGameAssets | null;
  showGrid: boolean;
  xrayCutaway: boolean;
  inspectOpen: boolean;
  muted: boolean;
  onSelectUnit: (unit: TacticalUnit) => void;
  onToggleInspect: () => void;
  onOpenStatus: () => void;
  onToggleGrid: () => void;
  onToggleCutaway: () => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
}

/**
 * Minimalist Translucent Tactical Turn Order & Utility Strip (top-right).
 * Uses clean full-bleed character portraits inside chamfered turn crests (zero white cutout
 * artifacts) plus quick Inspect [I] and Character Status [C] controls.
 */
export const TurnOrderRibbon: React.FC<TurnOrderRibbonProps> = ({
  turnQueue,
  turnNumber,
  assets,
  showGrid,
  xrayCutaway,
  inspectOpen,
  muted,
  onSelectUnit,
  onToggleInspect,
  onOpenStatus,
  onToggleGrid,
  onToggleCutaway,
  onToggleMute,
  onOpenPause,
}) => {
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {/* Slim Translucent Utility Row */}
      <div className="flex items-center gap-1.5">
        <div className="px-2.5 py-1 flex items-baseline gap-1.5 bg-[#090c12]/52 backdrop-blur-md border-b border-[#d4ae6a]/40 text-xs">
          <span className="text-[#bfb5a2] uppercase tracking-[0.16em] text-[10px]">Turn</span>
          <span className="font-mono-num font-bold text-sm text-[#f4d48e]">{turnNumber}</span>
        </div>

        {/* Enemy / Unit Inspect Toggle [I] */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleInspect();
          }}
          aria-label="Inspect Enemies and Abilities"
          title="Inspect Enemy Stats & Abilities (I)"
          className={`h-8 px-2.5 flex items-center gap-1.5 backdrop-blur-md border text-[11px] font-display font-semibold tracking-[0.12em] uppercase transition-colors cursor-pointer whitespace-nowrap ${
            inspectOpen
              ? 'bg-[#c94a44]/32 border-[#ef766e]/85 text-[#fff4f0]'
              : 'bg-[#0a0d13]/52 border-[#c9a45e]/32 text-[#e6decb] hover:text-[#ffffff] hover:border-[#e6c37a]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <span>Inspect</span>
        </button>

        {/* Character Status Screen Button [C] */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenStatus();
          }}
          aria-label="Open Character Status Screen"
          title="Character Status Screen (C)"
          className="h-8 px-2.5 flex items-center gap-1.5 bg-[#0a0d13]/52 backdrop-blur-md border border-[#c9a45e]/32 text-[11px] font-display font-semibold tracking-[0.12em] uppercase text-[#efd08a] hover:text-[#ffffff] hover:border-[#f0cf84] transition-colors cursor-pointer whitespace-nowrap"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l8 4v6c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V7l8-4z" />
          </svg>
          <span>Status</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleGrid();
          }}
          aria-label="Toggle Isometric Grid"
          title="Toggle Isometric Grid (G)"
          className={`w-8 h-8 flex items-center justify-center backdrop-blur-md border transition-colors cursor-pointer ${
            showGrid
              ? 'bg-[#b88940]/26 border-[#e5c176]/75 text-[#fae4b4]'
              : 'bg-[#0a0d13]/48 border-[#c9a45e]/28 text-[#c2b8a5] hover:text-[#faf2e2] hover:border-[#d8b46d]/60'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="12,3 21,9 12,15 3,9" />
            <polyline points="3,14 12,20 21,14" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleCutaway();
          }}
          aria-label="Toggle Blind-Angle Cutaway"
          title="Toggle Blind-Angle Cutaway (X)"
          className={`w-8 h-8 flex items-center justify-center backdrop-blur-md border transition-colors cursor-pointer ${
            xrayCutaway
              ? 'bg-[#b88940]/26 border-[#e5c176]/75 text-[#fae4b4]'
              : 'bg-[#0a0d13]/48 border-[#c9a45e]/28 text-[#c2b8a5] hover:text-[#faf2e2] hover:border-[#d8b46d]/60'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
          title={muted ? 'Unmute Sound (M)' : 'Mute Sound (M)'}
          className="w-8 h-8 flex items-center justify-center bg-[#0a0d13]/48 backdrop-blur-md border border-[#c9a45e]/28 text-[#c2b8a5] hover:text-[#faf2e2] hover:border-[#d8b46d]/60 transition-colors cursor-pointer"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 010 7" />
              <path d="M18.5 5.5a9 9 0 010 13" />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenPause();
          }}
          aria-label="Pause Menu"
          title="Pause Menu (Esc)"
          className="w-8 h-8 flex items-center justify-center bg-[#0a0d13]/48 backdrop-blur-md border border-[#c9a45e]/28 text-[#c2b8a5] hover:text-[#faf2e2] hover:border-[#d8b46d]/60 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </button>
      </div>

      {/* Floating Chamfered Turn Order Crests (Artifact-Free Full-Bleed Portraits) */}
      <nav aria-label="Turn Order" className="relative flex items-center gap-1.5 pt-0.5">
        <div
          aria-hidden="true"
          className="absolute left-4 right-2 top-1/2 -translate-y-1/2 h-[1px] pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(218, 180, 110, 0.45) 14%, rgba(218, 180, 110, 0.35) 100%)',
          }}
        />

        {turnQueue.slice(0, 7).map((unit, idx) => {
          const isCurrent = idx === 0;
          const mood = resolveUnitMood(unit);
          const src = assets?.characters[unit.sheetId]?.glamourPortrait;
          const isEnemy = unit.faction === 'enemy';

          return (
            <button
              key={`${unit.id}-${idx}`}
              type="button"
              onClick={() => onSelectUnit(unit)}
              aria-label={`Turn ${idx + 1}: ${unit.name} (${isEnemy ? 'Enemy' : 'Ally'})`}
              title={`Inspect ${unit.name} — VIT ${unit.vitality}/${unit.maxVitality} · ESS ${unit.essence}/${unit.maxEssence}`}
              className={`relative z-10 flex flex-col items-center transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f2d69a] ${
                isCurrent ? 'w-[48px] h-[56px] -translate-y-0.5' : 'w-[38px] h-[46px] opacity-85 hover:opacity-100'
              }`}
            >
              <div
                className={`relative w-full h-full chamfer-crest p-[1px] ${
                  isCurrent
                    ? isEnemy
                      ? 'bg-[#e6685e] shadow-[0_0_14px_rgba(220,76,68,0.45)]'
                      : 'bg-[#f0ca7d] shadow-[0_0_14px_rgba(240,202,125,0.42)]'
                    : isEnemy
                    ? 'bg-[#a04646]/70'
                    : 'bg-[#8ea4bf]/65'
                }`}
              >
                <div className="relative w-full h-full chamfer-crest overflow-hidden">
                  <AnimatedPortrait
                    src={src}
                    sheetId={unit.sheetId}
                    name={unit.name}
                    mood={mood}
                    isEnemy={isEnemy}
                    variant="crest"
                    className="w-full h-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#080a0e]/85 z-20">
                    <div
                      className={isEnemy ? 'h-full bg-[#d44c4c]' : 'h-full bg-[#62b580]'}
                      style={{
                        width: `${Math.max(0, Math.min(100, (unit.vitality / unit.maxVitality) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              {isCurrent && (
                <svg viewBox="0 0 10 6" className="w-2.5 h-1.5 mt-0.5" aria-hidden="true">
                  <polygon points="5,0 10,6 0,6" fill={isEnemy ? '#e6685e' : '#f2cd7e'} />
                </svg>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
