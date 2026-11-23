import React, { useEffect } from 'react';
import { TileData } from '../game/mapTopology';
import {
  TacticalUnit,
  getAvailableReactions,
  resolveUnitMood,
} from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';
import { AnimatedPortrait } from './AnimatedPortrait';

interface CharacterStatusModalProps {
  unit: TacticalUnit;
  allUnits: TacticalUnit[];
  tiles: TileData[][];
  assets: LoadedGameAssets | null;
  onSelectUnit: (unit: TacticalUnit) => void;
  onClose: () => void;
}

const CHARACTER_LORE: Record<string, string> = {
  aiori:
    'Sworn highland vanguard of Elmodor. Channels elemental power into his greatsword—burning Ferunium Fire or piercing Auruinum Arcane—and stands firm behind Steel Guard.',
  aryon:
    'Fire Mage of the Crimson Order. Boils his own blood to strike with blistering hand speed, rains Globus Inflamus and Chamus Continuos, and deflects assaults with Escudo Ergeo.',
  panther:
    'Shadow—an obsidian highland predator of the Ruined Watchtower. Vanishes into Smoke Screen mist to ambush prey with lethal precision and dissolves into Shadow Veil when targeted.',
};

/**
 * Full-Screen Character Status Showcase.
 * Features a large living animated glamour portrait on the left alongside a minimalist
 * translucent tactical dossier covering all low-number resources, attributes, abilities,
 * and defensive Reactions — with instant roster switching across heroes and foes.
 */
export const CharacterStatusModal: React.FC<CharacterStatusModalProps> = ({
  unit,
  allUnits,
  tiles,
  assets,
  onSelectUnit,
  onClose,
}) => {
  const livingUnits = allUnits.filter((u) => u.alive);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const idx = livingUnits.findIndex((u) => u.id === unit.id);
        if (idx === -1 || livingUnits.length <= 1) return;
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = livingUnits[(idx + delta + livingUnits.length) % livingUnits.length];
        onSelectUnit(next);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [unit.id, livingUnits, onSelectUnit, onClose]);

  const isEnemy = unit.faction === 'enemy';
  const tile = tiles[unit.y]?.[unit.x] ?? null;
  const mood = resolveUnitMood(unit);
  const glamourPortrait = assets?.characters[unit.sheetId]?.glamourPortrait;
  const terrainEva = tile ? Math.round(tile.evasionBonus / 10) : 0;
  const effectiveEva = unit.evasion + terrainEva;
  const reactions = getAvailableReactions(unit).filter((r) => r.id !== 'none');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Character Status: ${unit.name}`}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#06080d]/78 backdrop-blur-md p-4 sm:p-6"
    >
      <div className="relative w-full max-w-[1220px] h-[min(88vh,740px)] flex flex-col overflow-hidden fantasy-veil">
        {/* TOP HEADER: ROSTER SWITCHER & CLOSE */}
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#d8b46d]/24">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-xs tracking-[0.22em] uppercase text-[#efd08a]">
              Character Status
            </span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <nav aria-label="Combatant Roster" className="flex items-center gap-1.5 flex-wrap">
              {livingUnits.map((u) => {
                const active = u.id === unit.id;
                const enemy = u.faction === 'enemy';
                const label = enemy ? `${u.name} (${u.title.split(' ')[0]})` : u.name;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onSelectUnit(u)}
                    className={`px-3 py-1 text-xs font-display font-semibold tracking-[0.06em] transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                      active
                        ? enemy
                          ? 'bg-[#d9524c]/22 border-[#ef736b] text-[#fff4f0]'
                          : 'bg-[#e6be6c]/20 border-[#f4cf7e] text-[#fff8e8]'
                        : 'bg-transparent border-transparent text-[#beb4a2] hover:text-[#ffffff] hover:bg-[#ffffff]/6'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[#e6decb] hover:text-[#ffffff] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#c9a45e]/34 cursor-pointer whitespace-nowrap transition-colors"
          >
            Return to Map [Esc]
          </button>
        </div>

        {/* MAIN 2-COLUMN SHOWCASE BODY */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* LEFT 5 COLS: HUGE LIVING ANIMATED GLAMOUR PORTRAIT */}
          <div className="lg:col-span-5 relative min-h-[260px] lg:h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-[#d8b46d]/20">
            <AnimatedPortrait
              src={glamourPortrait}
              sheetId={unit.sheetId}
              name={unit.name}
              mood={mood}
              isEnemy={isEnemy}
              swordElement={unit.swordElement}
              hidden={unit.hidden}
              variant="status"
              className="w-full h-full"
            />

            {/* Subtle Bottom Vignette Identity Overlay Over Portrait */}
            <div
              className="absolute inset-x-0 bottom-0 p-5 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(8, 10, 15, 0.72) 48%, rgba(8, 10, 15, 0.94) 100%)',
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                <span className={isEnemy ? 'text-[#f28a82]' : 'text-[#efd08a]'}>
                  {isEnemy ? 'Hostile Foe' : 'Vanguard Hero'}
                </span>
                <span aria-hidden="true" className="text-[#787062]">·</span>
                <span className="text-[#cfc5b2] font-mono-num">
                  Tile ({unit.x},{unit.y}) · Elev H{tile?.height ?? 0}
                </span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-[0.06em] text-[#fff7e6] mt-0.5">
                {unit.name}
              </h2>
              <p className="text-xs text-[#d1c7b4] mt-0.5">{unit.title}</p>
              <p className="text-[11px] text-[#b4ab98] leading-relaxed mt-2">
                {CHARACTER_LORE[unit.sheetId] ?? ''}
              </p>
            </div>
          </div>

          {/* RIGHT 7 COLS: LOW-NUMBER RESOURCES, ATTRIBUTES, ABILITIES & REACTIONS */}
          <div className="lg:col-span-7 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* 1. Core Tactical Resources Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[#d8b46d]/20">
              {/* Vitality */}
              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="uppercase tracking-[0.14em] text-[#c2b8a5] text-[10px]">
                    Vitality
                  </span>
                  <span className="font-mono-num font-bold text-sm text-[#faf2e2]">
                    {unit.vitality} / {unit.maxVitality}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: unit.maxVitality }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2.5 flex-1 ${
                        idx < unit.vitality
                          ? isEnemy
                            ? 'bg-[#d94d4d]'
                            : 'bg-[#5cb87e]'
                          : 'bg-[#ffffff]/12'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Essence */}
              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="uppercase tracking-[0.14em] text-[#9ebae0] text-[10px]">
                    Essence
                  </span>
                  <span className="font-mono-num font-bold text-sm text-[#d6e8ff]">
                    {unit.essence} / {unit.maxEssence}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: unit.maxEssence }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2.5 flex-1 ${
                        idx < unit.essence ? 'bg-[#74b0f6]' : 'bg-[#ffffff]/12'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Reaction */}
              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="uppercase tracking-[0.14em] text-[#ebc26c] text-[10px]">
                    Reaction
                  </span>
                  <span className="font-mono-num font-bold text-sm text-[#fff0c4]">
                    {unit.reaction} / {unit.maxReaction}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  {Array.from({ length: unit.maxReaction }).map((_, idx) => (
                    <svg key={idx} viewBox="0 0 16 18" className="w-4 h-4" aria-hidden="true">
                      <polygon
                        points="8,1 15,9 8,17 1,9"
                        fill={idx < unit.reaction ? '#efbf62' : 'rgba(255,255,255,0.1)'}
                        stroke={idx < unit.reaction ? '#fff0c2' : 'rgba(148,140,124,0.5)'}
                        strokeWidth="1.2"
                      />
                    </svg>
                  ))}
                  <span className="text-[11px] text-[#b8ae9c]">
                    {unit.reaction > 0 ? 'Ready to React' : 'Spent this turn'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Core Tactical Attributes Matrix */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pb-4 border-b border-[#d8b46d]/20">
              {[
                {
                  label: 'Evasion',
                  value: `${effectiveEva}`,
                  sub: terrainEva !== 0 ? `Base ${unit.evasion} ${terrainEva > 0 ? `+${terrainEva}` : terrainEva}` : 'Base',
                },
                { label: 'Attack', value: `+${unit.atk}`, sub: 'Power bonus' },
                {
                  label: 'Move',
                  value: `${Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0))}`,
                  sub: unit.slowedTurns > 0 ? 'Slowed -2' : 'Tiles / turn',
                },
                { label: 'Jump', value: `${unit.jmp}`, sub: 'Elev step' },
                { label: 'Crit', value: `${unit.crit}%`, sub: 'Base chance' },
                { label: 'Speed', value: `${unit.spd}`, sub: 'Turn order' },
              ].map((attr) => (
                <div key={attr.label} className="bg-[#ffffff]/[0.03] px-3 py-2 border-b border-[#d8b46d]/16">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#a89f8d]">
                    {attr.label}
                  </div>
                  <div className="font-mono-num font-bold text-lg text-[#faf2e2] mt-0.5">
                    {attr.value}
                  </div>
                  <div className="text-[10px] text-[#8f8778] truncate">{attr.sub}</div>
                </div>
              ))}
            </div>

            {/* 3. Abilities & Techniques */}
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-[0.18em] text-[#efd08a] mb-2.5">
                Combat Techniques &amp; Abilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {unit.skills.map((sk) => (
                  <div
                    key={sk.id}
                    className="px-3.5 py-2.5 bg-[#ffffff]/[0.04] border-b border-[#d8b46d]/20"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-sm text-[#fff6e4]">
                        {sk.name}
                      </span>
                      <span className="font-mono-num text-[11px] text-[#8cbcf7] shrink-0">
                        {sk.essenceCost} ESS
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono-num text-[#e8c67c]">
                      <span className="uppercase text-[#a9a08f]">{sk.category}</span>
                      <span aria-hidden="true" className="text-[#696256]">·</span>
                      <span>{sk.maxRange === 0 ? 'Self' : `Range ${sk.minRange}-${sk.maxRange}`}</span>
                      <span aria-hidden="true" className="text-[#696256]">·</span>
                      {sk.grantsHidden ? (
                        <span className="text-[#c7a8ff]">Smoke Screen Stealth</span>
                      ) : sk.isSelfBuff ? (
                        <span className="text-[#8be0a4]">Defensive Passive + Guard</span>
                      ) : (
                        <span>Base -{sk.baseDamage + unit.atk} VIT</span>
                      )}
                      {sk.accuracyBonus !== 0 && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span>
                            {sk.accuracyBonus > 0 ? `+${sk.accuracyBonus}%` : `${sk.accuracyBonus}%`} Hit
                          </span>
                        </>
                      )}
                      {sk.critBonus > 0 && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span>+{sk.critBonus}% Crit</span>
                        </>
                      )}
                      {sk.imbuesSword === 'ferunium' && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span className="text-[#ff9975]">Red Fire Sword</span>
                        </>
                      )}
                      {sk.imbuesSword === 'auruinum' && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span className="text-[#8ec8ff]">Blue Arcane Sword</span>
                        </>
                      )}
                      {sk.knockback && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span className="text-[#f09b72]">Knockback</span>
                        </>
                      )}
                      {sk.applySlow && (
                        <>
                          <span aria-hidden="true" className="text-[#696256]">·</span>
                          <span className="text-[#c59eff]">Slow</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-[#c2b8a5] leading-snug mt-1.5">
                      {sk.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Signature Defensive Reaction */}
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-[0.18em] text-[#efd08a] mb-2.5">
                Signature Defensive Reaction
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {reactions.map((rx) => (
                  <div
                    key={rx.id}
                    className="px-3 py-2 bg-[#ffffff]/[0.03] border-b border-[#d8b46d]/18"
                  >
                    <div className="flex items-baseline justify-between gap-1.5">
                      <span className="font-display font-bold text-xs text-[#faf2e2]">
                        {isEnemy ? rx.enemyName : rx.name}
                      </span>
                      <span className="font-mono-num text-[10px] text-[#f2c66d] shrink-0">
                        {rx.reactionCost}R{rx.essenceCost > 0 ? `·${rx.essenceCost}E` : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#b9b09e] leading-snug mt-1">{rx.shortDesc}</p>
                    <div
                      className={`mt-1.5 text-[10px] font-mono-num uppercase tracking-wider ${
                        rx.available ? 'text-[#84e0a8]' : 'text-[#8c7f74]'
                      }`}
                    >
                      {rx.available ? 'Available Now' : rx.reason ?? 'Unavailable'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
