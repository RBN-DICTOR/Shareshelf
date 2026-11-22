import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx="24"
        cy="24"
        r="14"
        fill="none"
        stroke="#F5811F"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="70 18"
        transform="rotate(-60 24 24)"
      />
      <circle cx="24" cy="24" r="5" fill="#0B57F0" />
    </svg>
  );
}

export function Logo({
  size = 34,
  showWordmark = true,
  wordmarkClassName = 'text-xl font-extrabold text-[var(--blue)]',
}: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <LogoMark size={size} />
      {showWordmark && (
        <span className={`font-display tracking-tight whitespace-nowrap ${wordmarkClassName}`}>
          ShareShelf
        </span>
      )}
    </span>
  );
}
