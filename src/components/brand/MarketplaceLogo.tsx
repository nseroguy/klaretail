"use client";

import React from "react";

interface MarketplaceLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function MarketplaceLogo({
  size = 36,
  showText = true,
  className = "",
}: MarketplaceLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className="shrink-0 drop-shadow-sm transition-transform hover:scale-105"
      >
        <defs>
          <linearGradient id="bagFrontGrad" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#00C9FF" />
            <stop offset="35%" stopColor="#144272" />
            <stop offset="75%" stopColor="#0A2647" />
            <stop offset="100%" stopColor="#051923" />
          </linearGradient>

          <linearGradient id="bagSideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF512F" />
            <stop offset="50%" stopColor="#DD2476" />
            <stop offset="100%" stopColor="#2C0C59" />
          </linearGradient>

          <linearGradient id="topGlowGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#E52E71" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0A2647" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="handleFront" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="50%" stopColor="#4FACFE" />
            <stop offset="100%" stopColor="#000DFF" />
          </linearGradient>

          <linearGradient id="handleBack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB300" />
            <stop offset="50%" stopColor="#F76B1C" />
            <stop offset="100%" stopColor="#E91E63" />
          </linearGradient>

          <linearGradient id="infLeftGrad" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#00F5D4" />
            <stop offset="45%" stopColor="#00BBF9" />
            <stop offset="85%" stopColor="#4361EE" />
            <stop offset="100%" stopColor="#7209B7" />
          </linearGradient>

          <linearGradient id="infRightGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FEE440" />
            <stop offset="30%" stopColor="#FF7B00" />
            <stop offset="70%" stopColor="#F72585" />
            <stop offset="100%" stopColor="#7209B7" />
          </linearGradient>

          <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF512F" />
            <stop offset="100%" stopColor="#DD2476" />
          </linearGradient>

          <filter id="softShadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#04121F" floodOpacity="0.32" />
          </filter>
        </defs>

        <g filter="url(#softShadow)">
          {/* Back Handle */}
          <path
            d="M 230 185 V 135 C 230 90, 310 90, 310 135 V 185"
            fill="none"
            stroke="url(#handleBack)"
            strokeWidth="22"
            strokeLinecap="round"
          />

          {/* Bag Side Panel */}
          <polygon points="325,185 385,185 405,375 325,385" fill="url(#bagSideGrad)" />

          {/* Network Detail Lines */}
          <g stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.35" fill="#ffffff">
            <line x1="340" y1="215" x2="368" y2="245" />
            <line x1="368" y1="245" x2="350" y2="295" />
            <circle cx="340" cy="215" r="4.5" fillOpacity="0.8" />
            <circle cx="368" cy="245" r="5" fillOpacity="0.9" />
          </g>

          {/* Pin */}
          <path
            d="M 370 295 C 356 295, 345 306, 345 320 C 345 338, 370 358, 370 358 C 370 358, 395 338, 395 320 C 395 306, 384 295, 370 295 Z"
            fill="url(#pinGrad)"
          />
          <circle cx="370" cy="320" r="7.5" fill="#FFEAA7" />

          {/* Front Body */}
          <polygon points="175,185 330,185 330,385 150,385" fill="url(#bagFrontGrad)" />
          <polygon points="175,185 330,185 330,305 159,320" fill="url(#topGlowGrad)" />

          {/* Front Cutouts */}
          <circle cx="205" cy="210" r="9" fill="#0A2647" />
          <circle cx="285" cy="210" r="9" fill="#0A2647" />

          {/* Front Handle */}
          <path
            d="M 205 210 V 125 C 205 75, 285 75, 285 125 V 210"
            fill="none"
            stroke="url(#handleFront)"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Infinity Handshake Loops */}
          <path
            d="M 240 285 C 215 250, 160 250, 160 285 C 160 320, 215 320, 240 285 Z"
            fill="none"
            stroke="url(#infLeftGrad)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 240 285 C 265 250, 320 250, 320 285 C 320 320, 265 320, 240 285 Z"
            fill="none"
            stroke="url(#infRightGrad)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Handshake Fingers */}
          <g fill="#0A2647">
            <rect x="226" y="293" width="16" height="5" rx="2.5" transform="rotate(-30 226 293)" />
            <rect x="232" y="303" width="16" height="5" rx="2.5" transform="rotate(-30 232 303)" />
            <rect x="238" y="313" width="16" height="5" rx="2.5" transform="rotate(-30 238 313)" />
          </g>

          {/* Sparkles */}
          <path
            d="M 148 165 Q 148 177, 136 177 Q 148 177, 148 189 Q 148 177, 160 177 Q 148 177, 148 165 Z"
            fill="#FFD166"
          />
          <circle cx="125" cy="225" r="5" fill="#FF7B00" />
          <circle cx="132" cy="265" r="4" fill="#00F5D4" />

          <path
            d="M 398 238 Q 398 246, 390 246 Q 398 246, 398 254 Q 398 246, 406 246 Q 398 246, 398 238 Z"
            fill="#00F5D4"
          />
          <circle cx="340" cy="148" r="5" fill="#FFEAA7" />
          <circle cx="395" cy="180" r="4" fill="#FF512F" />
        </g>
      </svg>

      {showText && (
        <span className="font-sans text-lg font-bold tracking-tight">
          <span className="text-zinc-800 dark:text-zinc-200">the </span>
          <span className="text-rose-500 font-extrabold">market </span>
          <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">place</span>
        </span>
      )}
    </div>
  );
}
