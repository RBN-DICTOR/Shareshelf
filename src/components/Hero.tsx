import React from 'react';
import { motion } from 'framer-motion';
import type { Item } from '../types';
import { Button } from './Button';
import { ItemImage } from './ItemThumbnail';
import { Headline } from './Motion';
import { Ribbons } from './Ribbons';

interface HeroProps {
  items: Item[];
  loading?: boolean;
  onExplore: () => void;
  onShare: () => void;
  onSelectItem: (item: Item) => void;
}

const FLOAT_POSITIONS: [number, number, number][] = [
  [0, 0, -6],
  [48, 6, 5],
  [10, 50, 3],
  [52, 46, -4],
];

export function Hero({ items, loading = false, onExplore, onShare, onSelectItem }: HeroProps) {
  const showcase = items.slice(0, 4);

  return (
    <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--cream)]">
      {/* Golden yellow wave */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%] w-full"
        viewBox="0 0 1200 420"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 420V165C220 75 470 180 700 120C900 70 1050 100 1200 140V420Z"
          fill="#FFC531"
        />
      </svg>

      {/* Self-drawing ribbons */}
      <Ribbons />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24 lg:px-8">
        <div>
          <Headline text="Good things are better when shared." />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.4 }}
            className="mt-5 max-w-md text-lg font-semibold leading-relaxed text-[var(--navy)]/85"
          >
            Borrow everyday essentials from your community, save money, and give useful things a
            second life.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.35 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Button variant="navy" onClick={onExplore}>
              Explore items
            </Button>
            <Button variant="orange" onClick={onShare}>
              Share an item
            </Button>
          </motion.div>

          <span className="mt-6 inline-block rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] shadow-[var(--shadow)]">
            Your neighborhood is full of things worth sharing.
          </span>
        </div>

        {/* 4 Floating real item cards */}
        <div className="relative h-[320px] sm:h-[340px]">
          {loading && showcase.length === 0
            ? FLOAT_POSITIONS.map(([left, top, rotate], i) => (
                <div
                  key={i}
                  className="absolute w-36 rounded-3xl border border-[var(--line)] bg-white p-2 shadow-xl md:w-44"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: `rotate(${rotate}deg)`,
                    animation: `float 5s ease-in-out ${i * 0.7}s infinite`,
                  }}
                >
                  <div className="shimmer aspect-square rounded-2xl" />
                  <div className="shimmer mx-1 mt-2.5 h-3.5 w-3/4 rounded-full" />
                </div>
              ))
            : showcase.map((it, i) => {
                const [left, top, rotate] = FLOAT_POSITIONS[i] || [0, 0, 0];
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelectItem(it)}
                    className="group absolute w-36 cursor-pointer rounded-3xl border border-[var(--line)] bg-white p-2 text-left shadow-xl transition-shadow hover:shadow-2xl md:w-44"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      transform: `rotate(${rotate}deg)`,
                      animation: `float 5s ease-in-out ${i * 0.7}s infinite`,
                    }}
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl bg-[var(--sun-soft)]">
                      <ItemImage
                        item={it}
                        iconSize="sm"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <p className="truncate px-1 pt-2 text-sm font-extrabold text-[var(--navy)]">
                      {it.name}
                    </p>
                  </button>
                );
              })}
        </div>
      </div>
    </section>
  );
}
