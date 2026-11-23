import React, { useEffect } from 'react';
import {
  AttackStanceId,
  CombatClashResult,
  CombatForecast,
  ReactionId,
  SkillDef,
  TacticalUnit,
  getAttackModifications,
  getAvailableReactions,
} from '../game/tacticsEngine';
import { LoadedGameAssets } from '../game/spriteProcessor';
import { AnimatedPortrait } from './AnimatedPortrait';

export type CutInPhase = 'select' | 'attack_pose' | 'resolution';

export interface CombatCutInOverlayProps {
  phase: CutInPhase;
  /** Strictly scopes Stage 1 to either physical Attack or Essence abilities */
  cutInCategory: 'attack' | 'essence';
  attacker: TacticalUnit;
  defender: TacticalUnit;
  /** Scoped skills of the attacker matching cutInCategory */
  attackerSkills: SkillDef[];
  /** Skill IDs that can currently reach the locked defender */
  inRangeSkillIds: Set<string>;
  selectedSkill: SkillDef;
  selectedStance: AttackStanceId;
  selectedReaction: ReactionId;
  forecast: CombatForecast;
  /** Preview forecast without defender reaction (for Stage 2 before/after comparison) */
  baseForecast: CombatForecast;
  clashResult: CombatClashResult | null;
  assets: LoadedGameAssets | null;
  /** True when the defender is controlled by the player (can choose Reaction interactively in Stage 2) */
  isPlayerDefending: boolean;
  onSelectSkill: (skill: SkillDef) => void;
  onSelectStance: (stance: AttackStanceId) => void;
  onSelectReaction: (reaction: ReactionId) => void;
  onConfirmSelect: () => void;
  onCancelSelect: () => void;
  onConfirmAttackPose: () => void;
  onConfirmResolution: () => void;
}

/** Slim X-COM-style segmented low-number Vitality pip bar */
const VitalityPips: React.FC<{
  current: number;
  max: number;
  previewAfter?: number;
  isEnemy: boolean;
  compact?: boolean;
}> = ({ current, max, previewAfter, isEnemy, compact = false }) => {
  const after = previewAfter ?? current;
  return (
    <div className="flex items-center gap-[3px]" aria-label={`Vitality ${current} of ${max}`}>
      {Array.from({ length: max }).map((_, idx) => {
        const filled = idx < current;
        const willLose = filled && idx >= after;
        return (
          <div
            key={idx}
            className={`${compact ? 'h-[6px]' : 'h-[8px]'} flex-1 min-w-[8px] transition-colors ${
              willLose
                ? 'bg-[#f4be58] shadow-[0_0_8px_rgba(244,190,88,0.72)]'
                : filled
                ? isEnemy
                  ? 'bg-[#d84c4c]'
                  : 'bg-[#5bb57e]'
                : 'bg-[#ffffff]/14'
            }`}
          />
        );
      })}
    </div>
  );
};

const CUTIN_EMBERS = [
  { left: '12%', bottom: '18%', delay: '0s', duration: '2.6s', size: 4 },
  { left: '26%', bottom: '10%', delay: '0.6s', duration: '3.1s', size: 3 },
  { left: '44%', bottom: '22%', delay: '1.1s', duration: '2.8s', size: 3.5 },
  { left: '63%', bottom: '14%', delay: '0.3s', duration: '2.9s', size: 4 },
  { left: '78%', bottom: '20%', delay: '1.5s', duration: '3.3s', size: 3 },
  { left: '89%', bottom: '12%', delay: '0.9s', duration: '2.5s', size: 3.5 },
];

export const CombatCutInOverlay: React.FC<CombatCutInOverlayProps> = ({
  phase,
  cutInCategory,
  attacker,
  defender,
  attackerSkills,
  inRangeSkillIds,
  selectedSkill,
  selectedStance,
  selectedReaction,
  forecast,
  baseForecast,
  clashResult,
  assets,
  isPlayerDefending,
  onSelectSkill,
  onSelectStance,
  onSelectReaction,
  onConfirmSelect,
  onCancelSelect,
  onConfirmAttackPose,
  onConfirmResolution,
}) => {
  // Keyboard confirmation support (Enter / Space to confirm stage, Esc to cancel Stage 1)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (phase === 'select') {
          if (
            inRangeSkillIds.has(selectedSkill.id) &&
            attacker.essence >= forecast.totalEssenceCost
          ) {
            onConfirmSelect();
          }
        } else if (phase === 'attack_pose') {
          onConfirmAttackPose();
        } else if (phase === 'resolution') {
          onConfirmResolution();
        }
      } else if (e.key === 'Escape' && phase === 'select') {
        e.preventDefault();
        e.stopPropagation();
        onCancelSelect();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    phase,
    inRangeSkillIds,
    selectedSkill.id,
    attacker.essence,
    forecast.totalEssenceCost,
    onConfirmSelect,
    onCancelSelect,
    onConfirmAttackPose,
    onConfirmResolution,
  ]);

  const atkArt = assets?.characters[attacker.sheetId]?.cutins;
  const defArt = assets?.characters[defender.sheetId]?.cutins;
  const defPortrait = assets?.characters[defender.sheetId]?.glamourPortrait;
  const reactions = getAvailableReactions(defender);
  const chosenReactionOpt =
    reactions.find((r) => r.id === selectedReaction) ?? reactions[0];
  const attackModifications = getAttackModifications(attacker, selectedSkill);

  const canLaunchAttack =
    inRangeSkillIds.has(selectedSkill.id) &&
    attacker.essence >= forecast.totalEssenceCost;

  // =========================================================================
  // STAGE 1: UNIFIED SEAMLESS OVER-THE-SHOULDER DUEL PAINTING (ZERO ARTIFACTS!)
  // =========================================================================
  if (phase === 'select') {
    const elevShort =
      forecast.elevationDelta >= 2
        ? 'High Ground +1'
        : forecast.elevationDelta <= -2
        ? 'Low Ground -1'
        : 'Level';
    const flankShort =
      forecast.attackAngle === 'BACK'
        ? 'Backstab +2'
        : forecast.attackAngle === 'SIDE'
        ? 'Flank +1'
        : 'Front';

    // Select the dedicated seamless unified full-bleed confrontation painting (zero pasted cutouts!)
    const unifiedDuelSrc =
      attacker.sheetId === 'aiori'
        ? assets?.duelScenes.aiori_vs_panther
        : assets?.duelScenes.aryon_vs_panther;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Combat Selection Screen"
        className="pointer-events-auto fixed inset-0 z-40 overflow-hidden bg-[#0a0c11]"
      >
        {/* Seamless Full-Bleed Over-the-Shoulder Confrontation Painting with Living Camera Breath */}
        {unifiedDuelSrc && (
          <img
            src={unifiedDuelSrc}
            alt={`${attacker.name} facing ${defender.name} across the ruined watchtower courtyard`}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none animate-duel-breathe will-change-transform"
          />
        )}

        {/* Ambient Floating Embers & Dust Motes for Living Atmosphere */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
          {CUTIN_EMBERS.map((e, idx) => (
            <span
              key={idx}
              className="absolute rounded-full animate-ember-drift"
              style={{
                left: e.left,
                bottom: e.bottom,
                width: `${e.size}px`,
                height: `${e.size}px`,
                backgroundColor: attacker.sheetId === 'aryon' ? '#ff6f61' : '#f2c774',
                boxShadow:
                  attacker.sheetId === 'aryon'
                    ? '0 0 10px rgba(255,111,97,0.85)'
                    : '0 0 10px rgba(242,199,116,0.85)',
                animationDelay: e.delay,
                animationDuration: e.duration,
              }}
            />
          ))}
        </div>

        {/* Delicate Top & Bottom Edge Scrims Only — Center Confrontation Art 100% Clear */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,9,13,0.48) 0%, rgba(7,9,13,0) 18%, rgba(7,9,13,0) 78%, rgba(7,9,13,0.78) 100%)',
          }}
        />

        {/* TOP-LEFT ULTRA-SLIM TRANSLUCENT ATTACKER STATUS WHISPER */}
        <div
          className="absolute top-5 left-7 z-20 w-[264px] py-2 pl-3 pr-5"
          style={{
            background:
              'linear-gradient(90deg, rgba(9, 12, 18, 0.82) 0%, rgba(9, 12, 18, 0.56) 76%, transparent 100%)',
            borderTop: '1px solid rgba(214, 178, 112, 0.42)',
            borderBottom: '1px solid rgba(214, 178, 112, 0.18)',
          }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-display font-bold text-sm tracking-[0.06em] text-[#faf2e2] truncate">
              {attacker.name}
            </span>
            <span className="font-mono-num text-[11px] text-[#e8c67c] shrink-0">
              H{forecast.attackerHeight}
            </span>
          </div>
          <VitalityPips
            current={attacker.vitality}
            max={attacker.maxVitality}
            isEnemy={attacker.faction === 'enemy'}
            compact
          />
          <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-mono-num text-[#dfd6c4]">
            <span>
              VIT <strong className="text-[#8be0a4]">{attacker.vitality}/{attacker.maxVitality}</strong>
            </span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <span>
              ESS <strong className="text-[#8cbcf7]">{attacker.essence}/{attacker.maxEssence}</strong>
            </span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <span>
              EVA <strong className="text-[#f4ead6]">{attacker.evasion}</strong>
            </span>
          </div>
        </div>

        {/* TOP-RIGHT ULTRA-SLIM TRANSLUCENT TARGET READOUT */}
        <div
          className="absolute top-5 right-7 z-20 w-[332px] py-2 pl-5 pr-3.5 text-right"
          style={{
            background:
              'linear-gradient(270deg, rgba(22, 11, 14, 0.84) 0%, rgba(16, 10, 13, 0.58) 76%, transparent 100%)',
            borderTop: '1px solid rgba(218, 92, 88, 0.52)',
            borderBottom: '1px solid rgba(218, 92, 88, 0.22)',
          }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-mono-num text-xs font-bold text-[#f4d48c] shrink-0">
              VIT {defender.vitality} →{' '}
              <span className="text-[#ff8b7d]">{forecast.projectedDefenderVitality}</span>/
              {defender.maxVitality}
            </span>
            <div className="min-w-0 text-right">
              <h2 className="font-display font-bold text-sm tracking-[0.06em] text-[#faf2e2] truncate">
                {defender.name}
              </h2>
            </div>
          </div>

          <VitalityPips
            current={defender.vitality}
            max={defender.maxVitality}
            previewAfter={forecast.projectedDefenderVitality}
            isEnemy={defender.faction === 'enemy'}
            compact
          />

          <div className="mt-1.5 flex items-center justify-end gap-2.5 text-[11px] font-mono-num text-[#dfd6c4]">
            <span className="text-[#c8a39e] font-sans">H{forecast.defenderHeight}</span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <span>
              ESS <strong className="text-[#8cbcf7]">{defender.essence}/{defender.maxEssence}</strong>
            </span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <span>
              EVA <strong className="text-[#96dfae]">{forecast.defenderTotalEvasion}</strong>
            </span>
            <span aria-hidden="true" className="text-[#696256]">·</span>
            <span>
              REACT <strong className="text-[#f4c96e]">{defender.reaction}/{defender.maxReaction}</strong>
            </span>
          </div>
        </div>

        {/* BOTTOM SLEEK TRANSLUCENT SINGLE-BAR COMMAND DOCK */}
        <div className="absolute bottom-3.5 inset-x-4 sm:inset-x-5 z-30 max-w-[1380px] mx-auto fantasy-veil px-4 py-2.5">
          <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
            {/* 1. Scoped Attack / Essence Selector */}
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#b8ae9c]">
                {cutInCategory === 'essence' ? 'Essence Ability' : 'Physical Attack'}
              </span>
              <div className="flex items-center gap-1">
                {attackerSkills.map((sk) => {
                  const inRange = inRangeSkillIds.has(sk.id);
                  const canAfford = attacker.essence >= sk.essenceCost;
                  const isSelected = sk.id === selectedSkill.id;
                  const disabled = !inRange || !canAfford;

                  return (
                    <button
                      key={sk.id}
                      type="button"
                      disabled={disabled}
                      title={
                        !inRange
                          ? `Out of range (Rng ${sk.maxRange})`
                          : !canAfford
                          ? `Needs ${sk.essenceCost} Essence`
                          : sk.description
                      }
                      onClick={() => onSelectSkill(sk)}
                      className={`px-2.5 py-1 text-left transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                        isSelected
                          ? 'bg-[#e6be6c]/16 border-[#f2cf7e] text-[#fff8e8]'
                          : disabled
                          ? 'bg-transparent border-transparent text-[#6f6960] cursor-not-allowed'
                          : 'bg-[#ffffff]/4 border-transparent text-[#ddd4c3] hover:bg-[#ffffff]/10 hover:border-[#cfa55a]/60 cursor-pointer'
                      }`}
                    >
                      <span className="font-display font-bold text-[11px]">{sk.name}</span>
                      <span className="font-mono-num text-[10px] text-[#8cbcf7] ml-1">
                        {sk.essenceCost}E
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div aria-hidden="true" className="hidden xl:block w-[1px] h-9 bg-[#d8b46d]/22 shrink-0" />

            {/* 2. Ability-Specific Attack Modifications */}
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#b8ae9c]">
                Attack Modification
              </span>
              <div className="flex items-center gap-1">
                {attackModifications.map((st) => {
                  const totalCost = selectedSkill.essenceCost + st.essenceCost;
                  const affordable = attacker.essence >= totalCost;
                  const active = selectedStance === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={!affordable}
                      title={st.shortDesc}
                      onClick={() => onSelectStance(st.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                        active
                          ? 'bg-[#d95b54]/22 border-[#ef776f] text-[#fff4ed]'
                          : !affordable
                          ? 'border-transparent text-[#666057] cursor-not-allowed'
                          : 'bg-[#ffffff]/4 border-transparent text-[#d3cab8] hover:bg-[#ffffff]/10 cursor-pointer'
                      }`}
                    >
                      {st.name}
                      {st.essenceCost > 0 && (
                        <span className="font-mono-num text-[10px] text-[#8cbcf7] ml-1">
                          +{st.essenceCost}E
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div aria-hidden="true" className="hidden xl:block w-[1px] h-9 bg-[#d8b46d]/22 shrink-0" />

            {/* 3. Live Attack Estimate */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-[#bfb6a4]">
                <span className="uppercase tracking-[0.16em] text-[#e8c67c]">Estimate</span>
                <span aria-hidden="true">·</span>
                <span>{elevShort}</span>
                <span aria-hidden="true">·</span>
                <span>{flankShort}</span>
                {forecast.activeBladeBonus === 'ferunium' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-display font-bold text-[#ff9975] uppercase">
                      Ferunium Fire
                    </span>
                  </>
                )}
                {forecast.activeBladeBonus === 'auruinum' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-display font-bold text-[#8ec8ff] uppercase">
                      Auruinum Arcane
                    </span>
                  </>
                )}
                {defender.hidden && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-display font-bold text-[#c7a8ff] uppercase">
                      Target in Smoke
                    </span>
                  </>
                )}
                {forecast.willKill && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-display font-bold text-[#ff8476] uppercase">Lethal</span>
                  </>
                )}
              </div>
              <div className="flex items-baseline gap-3 font-mono-num text-sm">
                <span>
                  <strong className="text-[#f7cf73] text-base">-{forecast.expectedDamage}</strong>{' '}
                  <span className="text-[10px] text-[#b4ab9a]">
                    VIT{forecast.critChance > 0 ? ` (Crit -${forecast.maxDamage})` : ''}
                  </span>
                </span>
                <span>
                  <strong className="text-[#f4f6fa] text-base">{forecast.hitChance}%</strong>{' '}
                  <span className="text-[10px] text-[#b4ab9a]">HIT</span>
                </span>
                <span>
                  <strong className="text-[#f2a65a] text-base">{forecast.critChance}%</strong>{' '}
                  <span className="text-[10px] text-[#b4ab9a]">CRT</span>
                </span>
                <span>
                  <strong
                    className={`text-base ${
                      attacker.essence >= forecast.totalEssenceCost
                        ? 'text-[#8cbcf7]'
                        : 'text-[#eb6b6b]'
                    }`}
                  >
                    {forecast.totalEssenceCost}
                  </strong>{' '}
                  <span className="text-[10px] text-[#b4ab9a]">ESS</span>
                </span>
              </div>
            </div>

            {/* 4. Cancel + Primary Strike CTA */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                type="button"
                onClick={onCancelSelect}
                className="px-3 py-2 text-xs font-medium text-[#dfd7c7] hover:text-[#ffffff] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#c9a45e]/32 cursor-pointer whitespace-nowrap transition-colors"
              >
                Cancel [Esc]
              </button>
              <button
                type="button"
                disabled={!canLaunchAttack}
                onClick={onConfirmSelect}
                className={`px-4 py-2 text-xs font-display font-bold tracking-[0.12em] uppercase border whitespace-nowrap transition-colors ${
                  canLaunchAttack
                    ? 'bg-[#d8a148] hover:bg-[#e8b35a] text-[#140e07] border-[#fae4ae] cursor-pointer shadow-[0_4px_18px_rgba(216,161,72,0.34)]'
                    : 'bg-[#2a2824]/70 text-[#756e62] border-[#454038] cursor-not-allowed'
                }`}
              >
                Launch Attack [Enter]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAGE 2: KINETIC SPILL-FREE ABILITY-MATCHED GLAMOUR CUT-IN (ALWAYS FACING RIGHT!)
  // =========================================================================
  if (phase === 'attack_pose') {
    const enemyReactionLabel =
      defender.faction === 'enemy' ? chosenReactionOpt.enemyName : chosenReactionOpt.name;

    // Pick the exact ability-matched glamour artwork (including Aiori's imbued elemental blade!)
    let effectiveArtSkillId = selectedSkill.id;
    if (
      attacker.sheetId === 'aiori' &&
      selectedSkill.id === 'greatsword_strike' &&
      attacker.swordElement === 'ferunium'
    ) {
      effectiveArtSkillId = 'ferunium_blade';
    } else if (
      attacker.sheetId === 'aiori' &&
      selectedSkill.id === 'greatsword_strike' &&
      attacker.swordElement === 'auruinum'
    ) {
      effectiveArtSkillId = 'auruinum_blade';
    }
    const stage2GlamourSrc =
      atkArt?.attackGlamourBySkill?.[effectiveArtSkillId] ?? atkArt?.attackGlamour ?? null;

    const speedPalette =
      effectiveArtSkillId === 'auruinum_blade'
        ? { primary: 'rgba(104, 198, 255, 0.34)', secondary: 'rgba(210, 240, 255, 0.24)' }
        : effectiveArtSkillId === 'ferunium_blade' ||
          selectedSkill.element === 'fire' ||
          effectiveArtSkillId === 'blood_rush_strike'
        ? { primary: 'rgba(255, 146, 74, 0.36)', secondary: 'rgba(232, 68, 56, 0.32)' }
        : attacker.sheetId === 'panther'
        ? { primary: 'rgba(220, 74, 96, 0.38)', secondary: 'rgba(170, 114, 245, 0.32)' }
        : { primary: 'rgba(242, 198, 114, 0.28)', secondary: 'rgba(228, 236, 248, 0.24)' };

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attack Pose and Reaction Cut-In"
        className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-between px-5 py-5 bg-[#06080d]/82 overflow-hidden"
      >
        {/* High-Velocity Left->Right Speed-Lines Sweeping Behind Ability Glamour Frame */}
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none animate-speedline-rush"
        >
          {[140, 215, 290, 365, 440, 515, 595, 675, 745].map((y, idx) => (
            <line
              key={y}
              x1={20 + (idx % 3) * 55}
              y1={y}
              x2={1420}
              y2={y - 34}
              stroke={idx % 2 === 0 ? speedPalette.primary : speedPalette.secondary}
              strokeWidth={idx % 3 === 0 ? '3.4' : '1.6'}
            />
          ))}
        </svg>

        {/* TOP UNBOXED FLOATING ATTACK TITLE & ARTIFACT-FREE TARGET CREST */}
        <div className="relative z-20 w-full max-w-[1260px] flex items-start justify-between gap-4 pointer-events-none">
          <div className="pl-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#ecc472] drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              <span>{attacker.name}</span>
              <span aria-hidden="true">·</span>
              <span>{forecast.stance.name}</span>
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-[0.1em] uppercase text-[#fff7e6] drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
              {selectedSkill.name}
            </h2>
            <div
              aria-hidden="true"
              className="h-[1px] w-64 mt-1"
              style={{
                background: 'linear-gradient(90deg, rgba(236,196,114,0.85), transparent)',
              }}
            />
          </div>

          <div className="hidden sm:flex items-center gap-3 text-right pr-1">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#e09d95] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                Incoming Target
              </div>
              <div className="font-display font-bold text-base text-[#faf2e2] drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                {defender.name}
              </div>
              <div className="font-mono-num text-[11px] text-[#e9c880] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                VIT {defender.vitality}/{defender.maxVitality} · REACT {defender.reaction}/
                {defender.maxReaction} · ESS {defender.essence}/{defender.maxEssence}
              </div>
            </div>
            <div className="w-12 h-14 chamfer-crest p-[1px] bg-[#d85a56]/80 shrink-0">
              <AnimatedPortrait
                src={defPortrait}
                sheetId={defender.sheetId}
                name={defender.name}
                mood="neutral"
                isEnemy={defender.faction === 'enemy'}
                variant="crest"
                className="w-full h-full chamfer-crest"
              />
            </div>
          </div>
        </div>

        {/* CENTERPIECE: ABILITY-MATCHED FRAME-BREAKING GLAMOUR PANEL (ALWAYS FACING RIGHT) */}
        <div
          key={`${attacker.id}-${effectiveArtSkillId}`}
          className="relative z-10 flex-1 w-full max-w-[1180px] flex items-center justify-center my-2 min-h-0 pointer-events-none animate-glamour-slam will-change-transform"
        >
          {stage2GlamourSrc && (
            <img
              src={stage2GlamourSrc}
              alt={`${attacker.name} executing ${selectedSkill.name} facing right`}
              referrerPolicy="no-referrer"
              className="max-h-[64vh] max-w-full object-contain"
            />
          )}
        </div>

        {/* BOTTOM SLIM TRANSLUCENT REACTION & CONFIRM DOCK */}
        <div className="relative z-20 w-full max-w-[1160px] fantasy-veil px-5 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-display font-bold text-xs tracking-[0.16em] uppercase text-[#f4cf7a]">
                  {isPlayerDefending
                    ? `Choose ${defender.name}'s Reaction`
                    : `${defender.name}'s Reaction`}
                </span>
                <span aria-hidden="true" className="text-[#726b5e]">·</span>
                <span className="font-mono-num text-[11px] text-[#dcd3c0]">
                  Reaction <strong className="text-[#f4cb70]">{defender.reaction}/{defender.maxReaction}</strong>
                  {' · '}
                  Essence <strong className="text-[#8cbcf7]">{defender.essence}/{defender.maxEssence}</strong>
                </span>
              </div>

              {isPlayerDefending ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-[680px]">
                  {reactions.map((opt) => {
                    const active = selectedReaction === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!opt.available}
                        onClick={() => onSelectReaction(opt.id)}
                        className={`text-left px-3.5 py-2 border-b-2 transition-colors ${
                          active
                            ? 'bg-[#e8bf68]/18 border-[#f4cf7c] text-[#fff8e8]'
                            : !opt.available
                            ? 'bg-transparent border-transparent text-[#686259] cursor-not-allowed'
                            : 'bg-[#ffffff]/5 border-transparent text-[#e0d7c5] hover:bg-[#ffffff]/10 hover:border-[#cfa55a]/60 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-display font-bold">
                          <span className="truncate">{opt.name}</span>
                          <span className="font-mono-num text-[10px] text-[#f2c66d] shrink-0">
                            {opt.reactionCost}R{opt.essenceCost > 0 ? ` · ${opt.essenceCost}E` : ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#b4ab9a] truncate mt-0.5">
                          {opt.available ? opt.shortDesc : opt.reason}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-display font-bold text-sm uppercase tracking-[0.08em] ${
                          selectedReaction === 'none'
                            ? 'text-[#b5ad9d]'
                            : selectedReaction === 'escudo_ergeo'
                            ? 'text-[#c3a2ff]'
                            : selectedReaction === 'shadow_veil'
                            ? 'text-[#9ce8c2]'
                            : 'text-[#f4cb70]'
                        }`}
                      >
                        {enemyReactionLabel}
                      </span>
                      {chosenReactionOpt.reactionCost > 0 && (
                        <span className="font-mono-num text-[11px] text-[#dcd3c0]">
                          ({chosenReactionOpt.reactionCost} React
                          {chosenReactionOpt.essenceCost > 0
                            ? ` · ${chosenReactionOpt.essenceCost} Ess`
                            : ''}
                          )
                        </span>
                      )}
                      <span aria-hidden="true" className="text-[#696256] hidden sm:inline">·</span>
                      <span className="text-xs text-[#c2b8a5] hidden sm:inline truncate">
                        {chosenReactionOpt.shortDesc}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono-num text-xs shrink-0">
                    <div>
                      <span className="text-[10px] uppercase text-[#a39a89] mr-1.5">Clash</span>
                      <strong className="text-sm text-[#f4cf7a]">
                        {baseForecast.expectedDamage !== forecast.expectedDamage ? (
                          <>
                            <span className="line-through text-[#8c8478] mr-1">
                              {baseForecast.expectedDamage}
                            </span>
                            {forecast.expectedDamage} VIT
                          </>
                        ) : (
                          `${forecast.expectedDamage} VIT`
                        )}
                      </strong>
                    </div>
                    <span aria-hidden="true" className="text-[#696256]">·</span>
                    <div>
                      <span className="text-[10px] uppercase text-[#a39a89] mr-1.5">Hit</span>
                      <strong className="text-sm text-[#f2f5fa]">
                        {baseForecast.hitChance !== forecast.hitChance ? (
                          <>
                            <span className="line-through text-[#8c8478] mr-1">
                              {baseForecast.hitChance}%
                            </span>
                            {forecast.hitChance}%
                          </>
                        ) : (
                          `${forecast.hitChance}%`
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {isPlayerDefending && (
                <div className="font-mono-num text-[11px] text-[#e6ddcb] hidden md:block">
                  Incoming <strong className="text-[#f4cf7a]">-{forecast.expectedDamage} VIT</strong> ·{' '}
                  <strong>{forecast.hitChance}%</strong>
                </div>
              )}
              <button
                type="button"
                onClick={onConfirmAttackPose}
                className="px-6 py-2.5 text-xs font-display font-extrabold tracking-[0.15em] uppercase text-[#140e07] bg-[#dfa84e] hover:bg-[#eeb961] border border-[#fae4ae] shadow-[0_4px_18px_rgba(223,168,78,0.34)] cursor-pointer whitespace-nowrap transition-colors"
              >
                Confirm Clash [Enter]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STAGE 3: KINETIC SPILL-FREE DEFENDER OUTCOME GLAMOUR PANEL
  // =========================================================================
  const res = clashResult;
  if (!res) return null;

  const isDefensiveOutcome =
    res.outcomeKind === 'blocked' ||
    res.outcomeKind === 'shielded' ||
    res.outcomeKind === 'evaded';

  const glamourPanelSrc = isDefensiveOutcome
    ? defArt?.guardGlamour ?? null
    : defArt?.hurtGlamour ?? null;

  const accentTone =
    res.outcomeKind === 'shielded'
      ? { title: '#dfcbff', rule: 'rgba(182, 140, 255, 0.85)', ember: '#b98eff' }
      : res.outcomeKind === 'blocked'
      ? { title: '#fae29e', rule: 'rgba(238, 198, 110, 0.85)', ember: '#f6cb70' }
      : res.outcomeKind === 'evaded'
      ? { title: '#aef2cb', rule: 'rgba(116, 218, 162, 0.85)', ember: '#82e6b0' }
      : res.outcomeKind === 'crit' || res.didKill
      ? { title: '#ff968a', rule: 'rgba(240, 94, 84, 0.88)', ember: '#ff6f61' }
      : { title: '#ffd0a1', rule: 'rgba(226, 134, 86, 0.85)', ember: '#f09c66' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Combat Resolution Cut-In"
      className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-between px-5 py-5 bg-[#06080d]/82 overflow-hidden"
    >
      {/* Crisp Kinetic Impact Burst Flash & Speed Streaks on Resolution */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 48%, ${accentTone.rule.replace('0.85', '0.2').replace('0.88', '0.24')} 0%, transparent 62%)`,
        }}
      />
      {res.didHit && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none animate-impact-flash"
          style={{
            background:
              res.outcomeKind === 'crit' || res.didKill
                ? 'radial-gradient(circle at 54% 48%, rgba(255,214,160,0.46) 0%, rgba(236,72,62,0.18) 38%, transparent 72%)'
                : 'radial-gradient(circle at 54% 48%, rgba(255,235,200,0.34) 0%, transparent 64%)',
          }}
        />
      )}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none animate-speedline-rush"
      >
        {[175, 275, 390, 480, 585, 685].map((y, idx) => (
          <line
            key={y}
            x1={40 + idx * 32}
            y1={y}
            x2={1400}
            y2={y + (idx % 2 === 0 ? -24 : 18)}
            stroke={accentTone.rule.replace('0.85', '0.26').replace('0.88', '0.3')}
            strokeWidth={idx % 2 === 0 ? '3' : '1.4'}
          />
        ))}
      </svg>

      {/* TOP FLOATING DRAMATIC OUTCOME CALLOUT */}
      <div className="relative z-20 text-center pointer-events-none">
        <h2
          className="font-display font-extrabold text-3xl sm:text-5xl tracking-[0.12em] uppercase"
          style={{ color: accentTone.title, textShadow: '0 4px 16px rgba(0,0,0,0.95)' }}
        >
          {res.headline}
        </h2>
        <div
          aria-hidden="true"
          className="h-[1px] w-72 mx-auto mt-1.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentTone.rule}, transparent)`,
          }}
        />
        {res.tags.length > 0 && (
          <p
            className="mt-1.5 text-xs font-mono-num tracking-[0.18em] uppercase text-[#ede2cc]"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
          >
            {res.tags.join(' · ')}
          </p>
        )}
      </div>

      {/* CENTERPIECE: SPILL-FREE FACING-RIGHT WEAPON-FREE GLAMOUR PANEL WITH IMPACT JOLT */}
      <div
        key={`${defender.id}-${res.outcomeKind}-${res.defenderVitalityAfter}`}
        className={`relative z-10 flex-1 w-full max-w-[1160px] flex items-center justify-center my-2 min-h-0 pointer-events-none will-change-transform ${
          isDefensiveOutcome ? 'animate-glamour-slam' : 'animate-impact-jolt'
        }`}
      >
        {glamourPanelSrc && (
          <img
            src={glamourPanelSrc}
            alt={`${defender.name} ${res.outcomeKind}`}
            referrerPolicy="no-referrer"
            className={`max-h-[64vh] max-w-full object-contain ${
              res.outcomeKind === 'evaded' ? 'translate-x-2' : ''
            }`}
          />
        )}
      </div>

      {/* BOTTOM SLIM TRANSLUCENT OUTCOME STRIP & CONTINUE GATE */}
      <div className="relative z-20 w-full max-w-[1100px] fantasy-veil px-5 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <span className="font-display font-bold text-sm text-[#faf2e2]">
                  {defender.name}
                </span>{' '}
                <span className="ml-1 text-xs text-[#c5bba8]">
                  {res.subline.startsWith(defender.name)
                    ? res.subline.slice(defender.name.length).trimStart()
                    : res.subline}
                </span>
              </div>
              <span className="font-mono-num text-xs font-bold text-[#f4cf7a] shrink-0">
                Vitality {res.defenderVitalityBefore} → {res.defenderVitalityAfter} /{' '}
                {defender.maxVitality}
              </span>
            </div>

            <VitalityPips
              current={res.defenderVitalityAfter}
              max={defender.maxVitality}
              isEnemy={defender.faction === 'enemy'}
              compact
            />

            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] font-mono-num text-[#d5ccb8]">
              <span>
                {attacker.name} spent <strong className="text-[#8cbcf7]">{res.attackerEssenceSpent} ESS</strong>
              </span>
              {res.defenderReactionSpent > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#696256]">·</span>
                  <span>
                    {defender.name} spent{' '}
                    <strong className="text-[#f4cb70]">{res.defenderReactionSpent} REACT</strong>
                    {res.defenderEssenceSpent > 0 && (
                      <>
                        {' & '}
                        <strong className="text-[#8cbcf7]">{res.defenderEssenceSpent} ESS</strong>
                      </>
                    )}
                  </span>
                </>
              )}
              {res.mitigatedDamage > 0 && res.didHit && (
                <>
                  <span aria-hidden="true" className="text-[#696256]">·</span>
                  <span className="text-[#96e0b2]">{res.mitigatedDamage} DMG Mitigated</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirmResolution}
            className="px-6 py-2.5 text-xs font-display font-extrabold tracking-[0.15em] uppercase text-[#140e07] bg-[#dfa84e] hover:bg-[#eeb961] border border-[#fae4ae] shadow-[0_4px_18px_rgba(223,168,78,0.34)] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            Continue [Enter]
          </button>
        </div>
      </div>
    </div>
  );
};
