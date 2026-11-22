import React from 'react';

export function Ribbons({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        className="ribbon-path"
        pathLength={1}
        fill="none"
        stroke="#0B57F0"
        strokeWidth="26"
        strokeLinecap="round"
        d="M-40 520 C 240 640, 520 420, 760 330 C 1000 240, 1060 80, 930 70 C 800 62, 790 230, 960 280 C 1080 315, 1180 250, 1260 120"
      />
      <path
        className="ribbon-path"
        style={{ animationDelay: '.3s' }}
        pathLength={1}
        fill="none"
        stroke="#F5811F"
        strokeWidth="22"
        strokeLinecap="round"
        d="M-60 120 C 200 40, 420 200, 640 250 C 860 300, 1000 200, 1280 420"
      />
    </svg>
  );
}
