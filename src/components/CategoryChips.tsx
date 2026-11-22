import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';

interface CategoryChipsProps {
  value: string;
  onChange: (category: string) => void;
  items: readonly string[];
  id?: string;
  allLabel?: string;
}

export function CategoryChips({
  value,
  onChange,
  items,
  id = 'chips',
  allLabel,
}: CategoryChipsProps) {
  const list = allLabel ? ['All', ...items] : [...items];

  return (
    <LayoutGroup id={id}>
      <div
        className="no-scrollbar flex gap-2 overflow-x-auto py-2"
        role="tablist"
        aria-label="Categories"
      >
        {list.map((cat) => {
          const active = value === cat;
          const label = cat === 'All' && allLabel ? allLabel : cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(cat)}
              className="relative min-h-[44px] shrink-0 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors hover:bg-[var(--sun-soft)]/50"
            >
              {active && (
                <motion.span
                  layoutId={`chip-${id}`}
                  className="absolute inset-0 rounded-full bg-[var(--blue)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative ${active ? 'text-white' : 'text-[var(--navy)]'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
