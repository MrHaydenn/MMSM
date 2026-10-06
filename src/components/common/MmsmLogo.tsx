import React from 'react';

interface MmsmLogoProps {
  className?: string;
  size?: number;
}

export const MmsmLogo: React.FC<MmsmLogoProps> = ({ className = 'w-9 h-9', size = 36 }) => {
  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-lg border border-emerald-500/30 flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full object-cover"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Swirl marble background gradients */}
          <radialGradient id="swirlGrad1" cx="30%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#0a2a70" />
            <stop offset="35%" stopColor="#d4af37" />
            <stop offset="65%" stopColor="#040b2a" />
            <stop offset="100%" stopColor="#c59b27" />
          </radialGradient>
          <linearGradient id="goldVein" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eecf73" />
            <stop offset="40%" stopColor="#b38728" />
            <stop offset="70%" stopColor="#08184f" />
            <stop offset="100%" stopColor="#ffd875" />
          </linearGradient>

          {/* Neon green glow filter */}
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Liquid Swirl Background */}
        <rect width="200" height="200" fill="url(#swirlGrad1)" />

        {/* Dynamic marble swirl contours */}
        <path
          d="M-20,30 C40,-10 90,80 130,20 C170,-40 220,50 210,120 C200,190 140,210 90,170 C40,130 -10,180 -10,120 Z"
          fill="none"
          stroke="url(#goldVein)"
          strokeWidth="32"
          opacity="0.85"
        />
        <path
          d="M30,220 C60,150 110,180 140,110 C170,40 120,0 70,30 C20,60 -20,110 10,160 Z"
          fill="none"
          stroke="#061c56"
          strokeWidth="24"
          opacity="0.9"
        />
        <path
          d="M0,0 Q100,120 200,40 Q120,180 0,200 Z"
          fill="none"
          stroke="#e8be54"
          strokeWidth="14"
          opacity="0.6"
        />

        {/* Central Stylized Glowing Runic Glyph */}
        <g filter="url(#neonGlow)">
          {/* Main Diagonal Runic Spine and Crossbars */}
          <path
            d="M 40 122 L 68 114 L 82 128 L 88 112 L 108 116 L 114 96 L 140 102 L 146 76 L 168 84 L 174 62 L 148 54 L 138 72 L 116 66 L 110 84 L 88 80 L 82 100 L 64 96 Z"
            fill="#39ff74"
            stroke="#b3ffcc"
            strokeWidth="3"
            strokeLinejoin="miter"
            strokeLinecap="round"
          />
          {/* Left Arrow Head / Notch */}
          <polygon
            points="32,126 58,102 52,138"
            fill="#39ff74"
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Upper Right Glyph Cross Bar */}
          <path
            d="M 124 38 L 162 50 L 156 66 L 120 54 Z"
            fill="#39ff74"
            stroke="#b3ffcc"
            strokeWidth="2"
          />
          {/* High Energy Inner White Core Line */}
          <path
            d="M 48 120 L 78 110 L 96 116 L 124 98 L 152 82 L 162 66"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.95"
          />
        </g>
      </svg>
    </div>
  );
};
