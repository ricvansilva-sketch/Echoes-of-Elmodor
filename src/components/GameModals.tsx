import React from 'react';
import { LoadedGameAssets } from '../game/spriteProcessor';
import victoryAryonImg from '../assets/images/victory_aryon_smirk_1795468090649.jpg';
import victoryAioriImg from '../assets/images/victory_aiori_sheathe_1795468090157.jpg';
import defeatFallenImg from '../assets/images/defeat_heroes_fallen_1795468091398.jpg';

export interface RunStatsSnapshot {
  turns: number;
  damageDealt: number;
  highGroundHits: number;
  enemiesDefeated: number;
  totalEnemies: number;
  heroesStanding: number;
}

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#07090d]/76 p-6"
    >
      <div className="fantasy-veil w-full max-w-[400px] p-7 flex flex-col gap-5">
        <div className="text-center border-b border-[#b08d57]/30 pb-4">
          <h2
            id="pause-title"
            className="font-display font-bold text-2xl tracking-[0.12em] uppercase text-[#f4ead6]"
          >
            Battle Paused
          </h2>
          <p className="text-xs text-[#aba290] mt-1">
            Elmodor Ruined Watchtower · 30×30 Highland Grid
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 font-display font-bold text-sm tracking-[0.14em] uppercase bg-[#d8a24a] hover:bg-[#e8b45c] text-[#110f0c] border border-[#f5dca0]/70 transition-colors cursor-pointer"
          >
            Resume Battle
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 text-sm font-medium text-[#e7decb] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#b08d57]/35 transition-colors cursor-pointer"
          >
            Restart Skirmish
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 text-sm font-medium text-[#b5ac9a] hover:text-[#f2e8d4] bg-transparent hover:bg-[#ffffff]/8 border border-[#5e5648]/40 transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};

interface OutcomeModalProps {
  outcome: 'victory' | 'defeat';
  stats: RunStatsSnapshot;
  assets: LoadedGameAssets | null;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

/**
 * Full-Screen Victory & Defeat Fanfare Cut-In Experience.
 * - Victory: Dramatic dual comic showcase featuring Aryon Fallen smirking ("Previsibly.")
 *   and Aiori Suiciniv sheathing his greatsword ("Let's go, we have much to do.").
 * - Defeat: Somber full-bleed cut-in showing both heroes fallen on the watchtower stones.
 */
export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  outcome,
  stats,
  assets,
  onPlayAgain,
  onReturnTitle,
}) => {
  const isVictory = outcome === 'victory';

  if (isVictory) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-title"
        className="pointer-events-auto fixed inset-0 z-50 flex flex-col justify-between bg-[#06080d]/90 p-5 sm:p-7 overflow-hidden"
      >
        {/* Top Fanfare Banner */}
        <div className="relative z-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#e8c67c]">
            Watchtower Secured · Shadows Driven Back
          </p>
          <h2
            id="outcome-title"
            className="font-display font-extrabold text-4xl sm:text-5xl tracking-[0.18em] uppercase text-[#fff2cd] drop-shadow-[0_4px_18px_rgba(232,188,92,0.45)] mt-1"
          >
            Victory
          </h2>
          <div
            aria-hidden="true"
            className="h-[1px] w-80 mx-auto mt-2"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(240, 200, 114, 0.85), transparent)',
            }}
          />
        </div>

        {/* Centerpiece: Dual Hero Victory Fanfare Cut-In Panels */}
        <div className="relative z-10 flex-1 min-h-0 max-w-[1340px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 my-4 items-stretch">
          {/* Panel 1: Aryon Fallen Smirk — "Previsibly." */}
          <figure className="relative overflow-hidden border border-[#e5b864]/55 shadow-[0_20px_48px_rgba(0,0,0,0.8)] animate-glamour-slam">
            <img
              src={assets?.fanfare.victoryAryon ?? victoryAryonImg}
              alt="Aryon Fallen smirking after victory"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <figcaption
              className="absolute inset-x-0 bottom-0 px-5 py-4"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(8, 10, 15, 0.78) 42%, rgba(8, 10, 15, 0.96) 100%)',
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#f08b7a]">
                <span>Aryon Fallen</span>
                <span aria-hidden="true">·</span>
                <span>Fire Mage</span>
              </div>
              <p className="font-display font-bold italic text-2xl sm:text-3xl text-[#fff6e2] tracking-[0.04em] mt-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                &ldquo;Previsibly.&rdquo;
              </p>
            </figcaption>
          </figure>

          {/* Panel 2: Aiori Suiciniv Sheathing Sword — "Let's go, we have much to do." */}
          <figure className="relative overflow-hidden border border-[#e5b864]/55 shadow-[0_20px_48px_rgba(0,0,0,0.8)] animate-glamour-slam">
            <img
              src={assets?.fanfare.victoryAiori ?? victoryAioriImg}
              alt="Aiori Suiciniv sheathing his greatsword"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <figcaption
              className="absolute inset-x-0 bottom-0 px-5 py-4"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(8, 10, 15, 0.78) 42%, rgba(8, 10, 15, 0.96) 100%)',
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#98c4f4]">
                <span>Aiori Suiciniv</span>
                <span aria-hidden="true">·</span>
                <span>Iron Vanguard</span>
              </div>
              <p className="font-display font-bold italic text-2xl sm:text-3xl text-[#fff6e2] tracking-[0.03em] mt-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                &ldquo;Let&rsquo;s go, we have much to do.&rdquo;
              </p>
            </figcaption>
          </figure>
        </div>

        {/* Bottom Sleek Translucent Battle Summary & CTA Dock */}
        <div className="relative z-20 max-w-[1040px] w-full mx-auto fantasy-veil px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 font-mono-num">
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#a59b8a] block">
                Turns
              </span>
              <span className="text-xl font-bold text-[#faf2e2]">{stats.turns}</span>
            </div>
            <div aria-hidden="true" className="w-[1px] h-7 bg-[#d8b46d]/25" />
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#a59b8a] block">
                Shadows Slain
              </span>
              <span className="text-xl font-bold text-[#faf2e2]">
                {stats.enemiesDefeated}/{stats.totalEnemies}
              </span>
            </div>
            <div aria-hidden="true" className="w-[1px] h-7 bg-[#d8b46d]/25" />
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#a59b8a] block">
                Total Damage
              </span>
              <span className="text-xl font-bold text-[#f2cb72]">{stats.damageDealt} VIT</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-4 py-2.5 text-xs font-medium text-[#d8cfc0] hover:text-[#ffffff] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#c9a45e]/34 transition-colors cursor-pointer whitespace-nowrap"
            >
              Return to Title
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="px-6 py-2.5 font-display font-extrabold text-xs tracking-[0.16em] uppercase bg-[#dfa84e] hover:bg-[#eeb961] text-[#140e07] border border-[#fae4ae] shadow-[0_4px_18px_rgba(223,168,78,0.34)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DEFEAT FANFARE CUT-IN (Full-Bleed Fallen Heroes on Watchtower Flagstones)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outcome-title"
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col justify-between bg-[#06070b] overflow-hidden"
    >
      {/* Full-Bleed Defeat Illustration */}
      <img
        src={assets?.fanfare.defeatFallen ?? defeatFallenImg}
        alt="Aiori Suiciniv and Aryon Fallen defeated on the ruined watchtower stones"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
      />

      {/* Atmospheric Edge Vignette */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,7,11,0.74) 0%, rgba(6,7,11,0.12) 34%, rgba(6,7,11,0.22) 66%, rgba(6,7,11,0.92) 100%)',
        }}
      />

      {/* Top Crimson Defeat Header */}
      <div className="relative z-20 text-center pt-7 px-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#e0938c]">
          The Watchtower Falls to Shadow
        </p>
        <h2
          id="outcome-title"
          className="font-display font-extrabold text-4xl sm:text-6xl tracking-[0.2em] uppercase text-[#f06e64] drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)] mt-1"
        >
          Defeat
        </h2>
        <div
          aria-hidden="true"
          className="h-[1px] w-72 mx-auto mt-2"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(226, 86, 78, 0.85), transparent)',
          }}
        />
      </div>

      {/* Bottom Translucent Metrics & Retry Bar */}
      <div className="relative z-20 max-w-[1000px] w-full mx-auto mb-6 px-5">
        <div className="fantasy-veil-crimson px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 font-mono-num">
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#b4a09a] block">
                Turns
              </span>
              <span className="text-xl font-bold text-[#faf2e2]">{stats.turns}</span>
            </div>
            <div aria-hidden="true" className="w-[1px] h-7 bg-[#d85852]/30" />
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#b4a09a] block">
                Shadows Slain
              </span>
              <span className="text-xl font-bold text-[#faf2e2]">
                {stats.enemiesDefeated}/{stats.totalEnemies}
              </span>
            </div>
            <div aria-hidden="true" className="w-[1px] h-7 bg-[#d85852]/30" />
            <div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#b4a09a] block">
                Damage Dealt
              </span>
              <span className="text-xl font-bold text-[#f2b872]">{stats.damageDealt} VIT</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-4 py-2.5 text-xs font-medium text-[#dfd3ce] hover:text-[#ffffff] bg-[#ffffff]/6 hover:bg-[#ffffff]/14 border border-[#d85852]/40 transition-colors cursor-pointer whitespace-nowrap"
            >
              Return to Title
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="px-6 py-2.5 font-display font-extrabold text-xs tracking-[0.16em] uppercase bg-[#d9524c] hover:bg-[#ea645d] text-[#fff6f2] border border-[#ffb4ae]/70 shadow-[0_4px_18px_rgba(217,82,76,0.38)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
