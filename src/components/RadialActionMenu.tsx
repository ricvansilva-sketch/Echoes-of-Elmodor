import React, { useState } from 'react';
import { SkillDef, TacticalUnit } from '../game/tacticsEngine';

export type ActionMode = 'idle' | 'radial' | 'move' | 'essence_select' | 'target';

interface RadialActionMenuProps {
  unit: TacticalUnit;
  /** Kept for compatibility with BattleCanvas projection callback */
  anchor?: { x: number; y: number } | null;
  mode: ActionMode;
  selectedSkill: SkillDef | null;
  onOpenRadial: () => void;
  onChooseMove: () => void;
  onChooseAttack: () => void;
  onOpenEssence: () => void;
  onSelectEssenceSkill: (skill: SkillDef) => void;
  onChooseDefense: () => void;
  onChooseWait: () => void;
  onBackToRadial: () => void;
}

type CommandKey = 'move' | 'attack' | 'essence' | 'defense' | 'wait';

/**
 * Modern Dynamic Tactical Command Dock (bottom-right floating angled dark-fantasy rail).
 * - Immediately available on every hero turn with zero forced "click sprite first" friction.
 * - Supports instant 1-click command switching, hotkeys 1-5, live hover tactical preview,
 *   and an upward-expanding Essence Blade drawer for Fire / Elemental Sword abilities.
 */
export const RadialActionMenu: React.FC<RadialActionMenuProps> = ({
  unit,
  mode,
  selectedSkill,
  onChooseMove,
  onChooseAttack,
  onOpenEssence,
  onSelectEssenceSkill,
  onChooseDefense,
  onChooseWait,
  onBackToRadial,
}) => {
  const [hoveredCmd, setHoveredCmd] = useState<CommandKey | null>(null);

  const attackSkill = unit.skills.find((s) => s.category === 'attack');
  const essenceSkills = unit.skills.filter((s) => s.category === 'essence' && !s.isSelfBuff);
  const defenseSkill = unit.skills.find((s) => s.category === 'defense');
  const canAffordAnyEssence = essenceSkills.some((s) => unit.essence >= s.essenceCost);

  const commands: {
    id: CommandKey;
    label: string;
    hotkey: string;
    subtitle: string;
    disabled: boolean;
    active: boolean;
    accent: string;
    activeBorder: string;
    activeBg: string;
    onClick: () => void;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'move',
      label: 'Move',
      hotkey: '1',
      subtitle: unit.hasMoved
        ? 'Movement spent this turn'
        : `Advance up to ${Math.max(2, unit.mov - (unit.slowedTurns > 0 ? 2 : 0))} tiles · JMP ${unit.jmp}`,
      disabled: unit.hasMoved,
      active: mode === 'move',
      accent: '#7cd0f8',
      activeBorder: 'border-[#7cd0f8]',
      activeBg: 'bg-[#112636]/92',
      onClick: onChooseMove,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M5 19l5-5m0 0l2-7 7 2-7 5zm0 0l-5-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'attack',
      label: 'Attack',
      hotkey: '2',
      subtitle: unit.hasActed
        ? 'Action spent this turn'
        : `${attackSkill?.name ?? 'Physical Strike'} · 0 ESS · ${attackSkill?.baseDamage ?? 2}+ VIT DMG`,
      disabled: unit.hasActed,
      active: mode === 'target' && selectedSkill?.category === 'attack',
      accent: '#f07c70',
      activeBorder: 'border-[#f07c70]',
      activeBg: 'bg-[#361518]/92',
      onClick: onChooseAttack,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M18.5 4.5L9 14m0 0l-3.5 3.5m3.5-3.5l2 2m-5.5 1.5l1.5 1.5M14.5 4.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'essence',
      label: 'Essence',
      hotkey: '3',
      subtitle: unit.hasActed
        ? 'Action spent this turn'
        : !canAffordAnyEssence
        ? `Insufficient Essence (${unit.essence}/${unit.maxEssence})`
        : unit.sheetId === 'aryon'
        ? 'Fire Essence · Globus Inflamus / Chamus Continuos'
        : 'Elemental Sword · Ferunium (Red) / Auruinum (Blue)',
      disabled: unit.hasActed || !canAffordAnyEssence,
      active: mode === 'essence_select' || (mode === 'target' && selectedSkill?.category === 'essence'),
      accent: unit.sheetId === 'aryon' ? '#ff8b52' : '#7ec2ff',
      activeBorder: unit.sheetId === 'aryon' ? 'border-[#ff8b52]' : 'border-[#7ec2ff]',
      activeBg: unit.sheetId === 'aryon' ? 'bg-[#381b10]/92' : 'bg-[#12243b]/92',
      onClick: () => {
        if (mode === 'essence_select') {
          onBackToRadial();
        } else {
          onOpenEssence();
        }
      },
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M12 3c2.5 3.2 5 5.6 5 9.5a5 5 0 11-10 0C7 8.6 9.5 6.2 12 3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 12.5c1 1.2 1.8 2.2 1.8 3.5a1.8 1.8 0 11-3.6 0c0-1.3.8-2.3 1.8-3.5z" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      id: 'defense',
      label: 'Defense',
      hotkey: '4',
      subtitle: unit.hasActed
        ? 'Action spent this turn'
        : defenseSkill
        ? `${defenseSkill.name} · Guard + Refresh Reaction`
        : 'Defensive Guard Stance',
      disabled: unit.hasActed,
      active: false,
      accent: '#8be0a4',
      activeBorder: 'border-[#8be0a4]',
      activeBg: 'bg-[#122b20]/92',
      onClick: onChooseDefense,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.6-2.9 8.4-7 10-4.1-1.6-7-5.4-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'wait',
      label: 'Wait',
      hotkey: '5',
      subtitle: 'Hold ground and pass turn to next combatant',
      disabled: false,
      active: false,
      accent: '#d6c39b',
      activeBorder: 'border-[#d6c39b]',
      activeBg: 'bg-[#22201b]/92',
      onClick: onChooseWait,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.8 1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  // Contextual whisper text above the command dock
  const hoveredDef = hoveredCmd ? commands.find((c) => c.id === hoveredCmd) : null;
  let contextHeading = `${unit.name} · Ready`;
  let contextDetail = 'Choose a command or click a Shadow in range to engage';
  let contextAccent = '#e8c474';

  if (mode === 'move') {
    contextHeading = 'Move Mode · Click Highlighted Tile';
    contextDetail = 'Hover any tile to preview elevation pathing · Esc to cancel';
    contextAccent = '#7cd0f8';
  } else if (mode === 'target' && selectedSkill) {
    contextHeading = `${selectedSkill.name} · Select Shadow in Range`;
    contextDetail = `Rng ${selectedSkill.minRange}–${selectedSkill.maxRange} · ${selectedSkill.essenceCost} ESS · Click target to launch Duel Cut-In`;
    contextAccent = selectedSkill.category === 'essence' ? '#ff9970' : '#f07c70';
  } else if (mode === 'essence_select') {
    contextHeading =
      unit.sheetId === 'aryon' ? 'Fire Essence Grimoire' : 'Elemental Greatsword Arts';
    contextDetail = `Essence ${unit.essence}/${unit.maxEssence} · Select an art to highlight targets`;
    contextAccent = unit.sheetId === 'aryon' ? '#ff8b52' : '#7ec2ff';
  } else if (hoveredDef) {
    contextHeading = `${hoveredDef.label} [${hoveredDef.hotkey}]`;
    contextDetail = hoveredDef.subtitle;
    contextAccent = hoveredDef.accent;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2 max-w-[92vw] animate-dock-in"
      aria-label={`${unit.name} Tactical Command Dock`}
    >
      {/* EXPANDABLE ESSENCE ABILITY DRAWER (Pops cleanly above dock when Essence is active) */}
      {mode === 'essence_select' && (
        <div
          className="pointer-events-auto w-[372px] max-w-[90vw] fantasy-veil px-3.5 py-2.5 flex flex-col gap-1.5"
          role="group"
          aria-label="Essence Abilities"
        >
          <div className="flex items-center justify-between border-b border-[#cfa65d]/28 pb-1.5">
            <span className="font-display font-bold text-[11px] uppercase tracking-[0.16em] text-[#f5d284]">
              {unit.sheetId === 'aryon' ? 'Fire Essence' : 'Elemental Blade Essence'}
            </span>
            <span className="font-mono-num text-[11px] text-[#8cbcf7]">
              ESS {unit.essence}/{unit.maxEssence}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {essenceSkills.map((sk) => {
              const affordable = unit.essence >= sk.essenceCost;
              const isRedBlade = sk.imbuesSword === 'ferunium';
              const isBlueBlade = sk.imbuesSword === 'auruinum';
              const isFireSpell = sk.element === 'fire' && !sk.imbuesSword;
              const edgeColor = isBlueBlade
                ? 'border-l-[#5bb4ff]'
                : isRedBlade || isFireSpell
                ? 'border-l-[#ff6b42]'
                : 'border-l-[#e0b864]';
              const tagColor = isBlueBlade
                ? 'text-[#8ecbff]'
                : isRedBlade || isFireSpell
                ? 'text-[#ff9c78]'
                : 'text-[#f2cc78]';

              return (
                <button
                  key={sk.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => onSelectEssenceSkill(sk)}
                  className={`w-full text-left px-3 py-2 border-y border-r border-l-[3px] transition-all ${edgeColor} ${
                    affordable
                      ? 'bg-[#121621]/92 hover:bg-[#1f2536]/95 border-y-[#cfa65d]/30 border-r-[#cfa65d]/30 text-[#faf2e2] hover:-translate-x-0.5 cursor-pointer'
                      : 'bg-[#111319]/65 border-y-[#423d35]/40 border-r-[#423d35]/40 text-[#726b60] cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-xs tracking-[0.06em] uppercase">
                      {sk.name}
                    </span>
                    <div className="flex items-center gap-2 font-mono-num text-[10px] shrink-0">
                      <span className={tagColor}>
                        {isRedBlade
                          ? 'RED · FIRE'
                          : isBlueBlade
                          ? 'BLUE · ARCANE'
                          : `RNG ${sk.minRange}-${sk.maxRange}`}
                      </span>
                      <span className="text-[#8cbcf7] font-bold">{sk.essenceCost} ESS</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#bdb4a2] mt-0.5 leading-snug line-clamp-2">
                    {sk.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LIVE CONTEXTUAL TACTICAL WHISPER STRIP (Hover Preview / Active Mode + Cancel) */}
      <div
        className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-1.5 min-w-[330px] max-w-[540px]"
        style={{
          background:
            'linear-gradient(90deg, rgba(10, 13, 20, 0.35) 0%, rgba(10, 13, 20, 0.82) 18%, rgba(10, 13, 20, 0.9) 100%)',
          borderTop: '1px solid rgba(212, 174, 106, 0.34)',
          borderBottom: '1px solid rgba(212, 174, 106, 0.2)',
        }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-display font-bold text-[11px] uppercase tracking-[0.14em] truncate"
              style={{ color: contextAccent }}
            >
              {contextHeading}
            </span>
            {unit.swordElement !== 'none' && (
              <span
                className={`font-mono-num text-[9px] uppercase tracking-[0.1em] px-1.5 py-[1px] border ${
                  unit.swordElement === 'ferunium'
                    ? 'text-[#ff9c78] border-[#ff6b42]/50 bg-[#3a160e]/75'
                    : 'text-[#8ecbff] border-[#5bb4ff]/50 bg-[#10243d]/75'
                }`}
              >
                {unit.swordElement === 'ferunium' ? 'Ferunium' : 'Auruinum'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#c7beac] truncate">{contextDetail}</p>
        </div>

        {/* Turn Action Pips (MOV / ACT) or Cancel Button when in Move/Target/Essence */}
        {mode === 'move' || mode === 'target' || mode === 'essence_select' ? (
          <button
            type="button"
            onClick={onBackToRadial}
            className="px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-[#f2e8d4] bg-[#ffffff]/10 hover:bg-[#ffffff]/18 border border-[#cfa55a]/45 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            Back [Esc]
          </button>
        ) : (
          <div className="flex items-center gap-2 font-mono-num text-[10px] shrink-0">
            <span className={unit.hasMoved ? 'text-[#6c665c] line-through' : 'text-[#86d6ff]'}>
              MOV
            </span>
            <span aria-hidden="true" className="text-[#5d564b]">·</span>
            <span className={unit.hasActed ? 'text-[#6c665c] line-through' : 'text-[#f2c972]'}>
              ACT
            </span>
          </div>
        )}
      </div>

      {/* SLEEK DYNAMIC 5-COMMAND BLADE RAIL (Always Ready on Hero Turn — Zero Clunky Click Gate!) */}
      <nav
        aria-label="Combat Commands"
        className="pointer-events-auto flex items-end gap-1.5"
      >
        {commands.map((cmd, idx) => {
          // Subtle Persona/Tactics dynamic arc lift so the dock feels alive & sculptural
          const arcLift = idx === 2 ? '-translate-y-1' : idx === 1 || idx === 3 ? '-translate-y-0.5' : '';
          return (
            <button
              key={cmd.id}
              type="button"
              disabled={cmd.disabled}
              aria-pressed={cmd.active}
              onMouseEnter={() => setHoveredCmd(cmd.id)}
              onMouseLeave={() => setHoveredCmd(null)}
              onFocus={() => setHoveredCmd(cmd.id)}
              onBlur={() => setHoveredCmd(null)}
              onClick={cmd.onClick}
              className={`group relative flex items-center gap-2 px-3.5 py-2.5 border transition-all duration-150 whitespace-nowrap ${arcLift} ${
                cmd.active
                  ? `${cmd.activeBg} ${cmd.activeBorder} text-[#fff8e8] -translate-y-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.65)]`
                  : cmd.disabled
                  ? 'bg-[#0e1016]/68 border-[#3b3730]/55 text-[#666056] cursor-not-allowed'
                  : 'bg-[#10141f]/86 hover:bg-[#1b2233]/94 border-[#c9a45e]/42 hover:border-[#f0ca78] text-[#efe6d4] hover:-translate-y-1 cursor-pointer shadow-[0_6px_18px_rgba(0,0,0,0.52)]'
              }`}
              style={{
                clipPath: 'polygon(7px 0%, 100% 0%, calc(100% - 7px) 100%, 0% 100%)',
              }}
            >
              <span
                className="transition-colors"
                style={{ color: cmd.disabled ? '#5b564e' : cmd.active ? '#fff8e8' : cmd.accent }}
              >
                {cmd.icon}
              </span>
              <span className="font-display font-bold text-xs tracking-[0.12em] uppercase">
                {cmd.label}
              </span>
              <span className="font-mono-num text-[10px] opacity-65 ml-0.5">
                {cmd.hotkey}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
