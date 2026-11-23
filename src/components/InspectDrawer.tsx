import React from 'react';
import { TileData } from '../game/mapTopology';
import {
  TacticalUnit,
  getAvailableReactions,
  resolveUnitMood,
} from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';
import { AnimatedPortrait } from './AnimatedPortrait';

interface InspectDrawerProps {
  unit: TacticalUnit;
  unitTile: TileData | null;
  allLivingUnits: TacticalUnit[];
  assets: LoadedGameAssets | null;
  onSelectUnit: (unit: TacticalUnit) => void;
  onOpenFullStatus: (unit: TacticalUnit) => void;
  onClose: () => void;
}

/**
 * Minimalist Translucent Enemy & Unit Tactical Inspect Drawer.
 * Displays complete enemy/ally stats, elevation bonuses, all offensive abilities,
 * and every defensive Reaction they can spend during combat — without obscuring the map.
 */
export const InspectDrawer: React.FC<InspectDrawerProps> = ({
  unit,
  unitTile,
  allLivingUnits,
  assets,
  onSelectUnit,
  onOpenFullStatus,
  onClose,
}) => {
  const isEnemy = unit.faction === 'enemy';
  const glamourPortrait = assets?.characters[unit.sheetId]?.glamourPortrait;
  const mood = resolveUnitMood(unit);
  const terrainEva = unitTile ? Math.round(unitTile.evasionBonus / 10) : 0;
  const effectiveEva = unit.evasion + terrainEva;
  const reactions = getAvailableReactions(unit).filter((r) => r.id !== 'none');

  const enemies = allLivingUnits.filter((u) => u.faction === 'enemy');
  const heroes = allLivingUnits.filter((u) => u.faction === 'hero');

  return (
    <aside
      role="region"
      aria-label={`Tactical Inspect: ${unit.name}`}
      className={`pointer-events-auto fixed right-5 top-[118px] bottom-5 z-30 w-[min(92vw,372px)] flex flex-col overflow-hidden ${
        isEnemy ? 'fantasy-veil-crimson' : 'fantasy-veil'
      }`}
    >
      {/* Top Bar: Unit Quick-Switch Tabs + Close */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-[#d8b46d]/22">
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 shrink-0" aria-hidden="true">
            <polygon points="5,0 10,5 5,10 0,5" fill={isEnemy ? '#e05852' : '#ebc26c'} />
          </svg>
          <span className="font-display font-bold text-xs tracking-[0.18em] uppercase text-[#f4d48e] truncate">
            Tactical Inspect
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Inspect Panel"
          className="px-2 py-0.5 text-[11px] text-[#ccc2ae] hover:text-[#ffffff] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#c9a45e]/28 cursor-pointer transition-colors"
        >
          Close [Esc]
        </button>
      </div>

      {/* Quick Target Switcher Strip (Enemies First for Rapid Recon) */}
      <div className="px-3.5 py-2 flex items-center gap-1 overflow-x-auto border-b border-[#d8b46d]/14">
        {[...enemies, ...heroes].map((u) => {
          const active = u.id === unit.id;
          const enemyTag = u.faction === 'enemy';
          const shortTitle = u.title.split(' ')[0];
          const tabLabel = enemyTag ? `${u.name} (${shortTitle})` : u.name.split(' ')[0];
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUnit(u)}
              className={`px-2 py-1 text-[10px] font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                active
                  ? enemyTag
                    ? 'bg-[#d9524c]/22 border-[#ef736b] text-[#fff4f0]'
                    : 'bg-[#e6be6c]/20 border-[#f4cf7e] text-[#fff8e8]'
                  : 'bg-transparent border-transparent text-[#b8ae9c] hover:text-[#f4ead6] hover:bg-[#ffffff]/6'
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Scrollable Tactical Dossier Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
        {/* Living Glamour Portrait + Core Identity */}
        <div className="flex items-stretch gap-3">
          <div
            className={`w-[88px] h-[112px] shrink-0 chamfer-crest p-[1px] ${
              isEnemy ? 'bg-[#de5c56]/80' : 'bg-[#e8c374]/80'
            }`}
          >
            <AnimatedPortrait
              src={glamourPortrait}
              sheetId={unit.sheetId}
              name={unit.name}
              mood={mood}
              isEnemy={isEnemy}
              swordElement={unit.swordElement}
              hidden={unit.hidden}
              variant="inspect"
              className="w-full h-full chamfer-crest"
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <span
                className={`text-[10px] uppercase tracking-[0.16em] font-semibold ${
                  isEnemy ? 'text-[#f08b84]' : 'text-[#ebd08c]'
                }`}
              >
                {isEnemy ? 'Hostile Foe' : 'Allied Vanguard'} · Elev H{unitTile?.height ?? 0}
              </span>
              <h3 className="font-display font-bold text-base text-[#faf2e2] leading-tight mt-0.5 truncate">
                {unit.name}
              </h3>
              <p className="text-[11px] text-[#c2b8a5] truncate">
                {unit.title}
                {unit.hidden ? ' · Hidden in Smoke' : ''}
                {unit.swordElement === 'ferunium' ? ' · Ferunium Fire' : ''}
                {unit.swordElement === 'auruinum' ? ' · Auruinum Arcane' : ''}
              </p>
            </div>

            {/* Compact Resource Pips */}
            <div className="space-y-1.5 pt-1.5">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-[#bfb5a2]">Vitality</span>
                  <span className="font-mono-num font-bold text-[#faf2e2]">
                    {unit.vitality} / {unit.maxVitality}
                  </span>
                </div>
                <div className="flex gap-[2px]">
                  {Array.from({ length: unit.maxVitality }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-[6px] flex-1 ${
                        idx < unit.vitality
                          ? isEnemy
                            ? 'bg-[#d94c4c]'
                            : 'bg-[#5bb57e]'
                          : 'bg-[#ffffff]/12'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono-num">
                <span className="text-[#9ebae0]">
                  ESS <strong className="text-[#d6e8ff]">{unit.essence}/{unit.maxEssence}</strong>
                </span>
                <span className="text-[#ebc26c]">
                  REACT <strong className="text-[#fff0c4]">{unit.reaction}/{unit.maxReaction}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Core Attributes Strip */}
        <div className="grid grid-cols-6 gap-1 py-2 border-y border-[#d8b46d]/20 text-center">
          {[
            { k: 'EVA', v: effectiveEva },
            { k: 'ATK', v: `+${unit.atk}` },
            { k: 'MOV', v: Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0)) },
            { k: 'JMP', v: unit.jmp },
            { k: 'CRT', v: `${unit.crit}%` },
            { k: 'SPD', v: unit.spd },
          ].map((s) => (
            <div key={s.k}>
              <div className="text-[9px] text-[#a49b8a] tracking-wider">{s.k}</div>
              <div className="font-mono-num text-xs font-bold text-[#f4ead6]">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Abilities & Techniques Section */}
        <div>
          <h4 className="font-display font-bold text-[11px] uppercase tracking-[0.16em] text-[#efd08a] mb-2">
            Abilities &amp; Attacks
          </h4>
          <div className="space-y-2">
            {unit.skills.map((sk) => (
              <div
                key={sk.id}
                className="px-3 py-2 bg-[#ffffff]/[0.04] border-b border-[#d8b46d]/18"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display font-bold text-xs text-[#faf2e2]">
                    {sk.name}
                  </span>
                  <span className="font-mono-num text-[10px] text-[#8cbcf7] shrink-0">
                    {sk.essenceCost} ESS · {sk.maxRange === 0 ? 'Self' : `Rng ${sk.minRange}-${sk.maxRange}`}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-mono-num text-[#e6c57a]">
                      {!sk.isSelfBuff ? (
                    <>
                      <span className="uppercase text-[#a9a08f]">{sk.category}</span>
                      <span>Base -{sk.baseDamage + unit.atk} VIT</span>
                      {sk.accuracyBonus !== 0 && (
                        <span>
                          {sk.accuracyBonus > 0 ? `+${sk.accuracyBonus}%` : `${sk.accuracyBonus}%`} Hit
                        </span>
                      )}
                      {sk.critBonus > 0 && <span>+{sk.critBonus}% Crit</span>}
                      {sk.knockback && <span className="text-[#f09b72]">Knockback</span>}
                      {sk.applySlow && <span className="text-[#c59eff]">Slows</span>}
                      {sk.imbuesSword === 'ferunium' && (
                        <span className="text-[#ff9975]">Red Fire Sword</span>
                      )}
                      {sk.imbuesSword === 'auruinum' && (
                        <span className="text-[#8ec8ff]">Blue Arcane Sword</span>
                      )}
                    </>
                  ) : sk.grantsHidden ? (
                    <span className="text-[#c7a8ff]">Smoke Screen · Hidden (+25% Ambush Hit)</span>
                  ) : (
                    <span className="text-[#8be0a4]">Defensive Passive · Guard + Recovery</span>
                  )}
                </div>
                <p className="text-[11px] text-[#beb5a2] leading-snug mt-1">
                  {sk.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Signature Defensive Reaction Intel */}
        <div>
          <h4 className="font-display font-bold text-[11px] uppercase tracking-[0.16em] text-[#efd08a] mb-2">
            Signature Defensive Reaction
          </h4>
          <div className="space-y-1.5">
            {reactions.map((rx) => (
              <div
                key={rx.id}
                className="px-3 py-1.5 bg-[#ffffff]/[0.03] border-b border-[#d8b46d]/14 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-[11px] text-[#f4ead6]">
                      {isEnemy ? rx.enemyName : rx.name}
                    </span>
                    <span className="font-mono-num text-[10px] text-[#ebc26c]">
                      {rx.reactionCost}R{rx.essenceCost > 0 ? ` · ${rx.essenceCost}E` : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#b4ab9a] leading-snug">{rx.shortDesc}</p>
                </div>
                <span
                  className={`font-mono-num text-[9px] uppercase tracking-wider shrink-0 pt-0.5 ${
                    rx.available ? 'text-[#84e0a8]' : 'text-[#8a7d72]'
                  }`}
                >
                  {rx.available ? 'Ready' : 'Spent'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA -> Full Status Showcase Screen */}
      <div className="px-4 py-2.5 border-t border-[#d8b46d]/22 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#b3aa98]">Click any unit on map to inspect</span>
        <button
          type="button"
          onClick={() => onOpenFullStatus(unit)}
          className="px-3.5 py-1.5 text-[11px] font-display font-bold tracking-[0.12em] uppercase text-[#140e07] bg-[#dfa84e] hover:bg-[#eeb961] border border-[#fae4ae] cursor-pointer whitespace-nowrap transition-colors"
        >
          Full Status [C]
        </button>
      </div>
    </aside>
  );
};
