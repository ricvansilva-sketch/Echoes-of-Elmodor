import React, { useEffect } from 'react';
import { ASSET_URLS } from '../game/spriteProcessor';

interface TitleScreenProps {
  onStart: () => void;
  assetsReady: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, assetsReady }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <main className="fixed inset-0 z-30 overflow-hidden bg-[#0c1016] text-[#ece4d4]">
      {/* Illustrated Key-Art Backdrop positioned on the right with seamless slate-indigo atmospheric scrim across the left negative space */}
      <img
        src={ASSET_URLS.titleKeyArt}
        alt="Ruined highland watchtower of Elmodor at golden dusk"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover object-right select-none pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, #0b0e14 0%, #0d121a 32%, rgba(13, 18, 26, 0.92) 44%, rgba(13, 18, 26, 0.35) 64%, rgba(13, 18, 26, 0.14) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,10,14,0.45) 0%, rgba(8,10,14,0) 28%, rgba(8,10,14,0.72) 100%)',
        }}
      />

      {/* Left-third negative-space Title Emblem & Primary Start Handshake */}
      <div className="relative z-10 flex h-full flex-col justify-between px-10 py-10 md:px-16 md:py-14 max-w-[660px]">
        <div />

        <div className="flex flex-col items-start gap-7">
          {/* Bespoke Inline SVG Heraldic Title Lockup */}
          <div className="w-full max-w-[520px]">
            <svg
              viewBox="0 0 520 176"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label="Echoes of Elmodor: The Ruined Watchtower"
            >
              {/* Heraldic tower & crossed blade crest */}
              <g transform="translate(0, 6)">
                <path
                  d="M20 42 L20 12 L26 12 L26 17 L32 17 L32 12 L38 12 L38 42 Z"
                  fill="#b89254"
                  stroke="#0b0e14"
                  strokeWidth="2"
                />
                <path
                  d="M15 44 L43 44 L46 49 L12 49 Z"
                  fill="#8e6d3b"
                  stroke="#0b0e14"
                  strokeWidth="1.5"
                />
                <line x1="60" y1="30" x2="210" y2="30" stroke="rgba(184,146,84,0.55)" strokeWidth="1.2" />
                <polygon points="216,30 222,26 228,30 222,34" fill="#c7a05e" />
              </g>

              <text
                x="0"
                y="102"
                fill="#f4ead6"
                stroke="#0a0c10"
                strokeWidth="5"
                paintOrder="stroke fill"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: '46px',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                }}
              >
                ECHOES OF
              </text>
              <text
                x="0"
                y="148"
                fill="#d4a95f"
                stroke="#0a0c10"
                strokeWidth="5"
                paintOrder="stroke fill"
                style={{
                  fontFamily: "'Cinzel', Georgia, serif",
                  fontSize: '48px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                }}
              >
                ELMODOR
              </text>
              <text
                x="2"
                y="174"
                fill="#c2b8a3"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.28em',
                }}
              >
                THE RUINED WATCHTOWER
              </text>
            </svg>
          </div>

          <p className="max-w-[440px] text-[15px] leading-relaxed text-[#c9c2b4]">
            Command Aiori Suiciniv and Aryon Fallen across a 30×30 highland elevation battlefield. Seize the ruined watchtower battlements and outmaneuver the Black Panther pack.
          </p>

          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="group relative inline-flex items-center gap-3 px-8 py-3.5 bg-[#b88940] hover:bg-[#cca055] active:bg-[#a17633] text-[#110f0c] font-display font-bold text-base tracking-[0.12em] uppercase border border-[#f2d69a]/60 shadow-[0_10px_30px_rgba(0,0,0,0.55)] transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2d69a]"
            >
              <span>Enter Battle</span>
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true">
                <path d="M4 10h10.5l-4-4 1.4-1.4L18.3 11l-6.4 6.4L10.5 16l4-4H4v-2z" />
              </svg>
            </button>

            {!assetsReady && (
              <span className="text-xs text-[#b7aa93] font-mono-num">
                Preparing painted battle map…
              </span>
            )}
          </div>
        </div>

        {/* Single flat borderless control hint line in safe bottom margin */}
        <p className="text-xs tracking-wide text-[#9a9384] whitespace-nowrap">
          Click Tile Select · Drag or WASD Pan · Scroll Zoom · 1–5 Actions · G Grid · X Cutaway · Esc Pause
        </p>
      </div>
    </main>
  );
};
