import React from 'react';
import { motion } from 'framer-motion';
import { isItemOnLoanToday } from '../lib/format';
import type { Item, ItemBusyDate } from '../types';
import { ItemImage } from './ItemThumbnail';

interface ItemCardProps {
  item: Item;
  busyDates: ItemBusyDate[];
  onSelect: (item: Item) => void;
  index?: number;
}

export function ItemCard({ item, busyDates, onSelect, index = 0 }: ItemCardProps) {
  const onLoanToday = isItemOnLoanToday(busyDates, item.id);
  const status = onLoanToday ? 'On loan' : item.is_available ? 'Available' : 'Unavailable';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 12) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${item.name}`}
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)] focus-visible:outline-[3px] focus-visible:outline-[var(--blue)]"
    >
      <div>
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--sun-soft)]">
          <ItemImage
            item={item}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${
              status === 'Available'
                ? 'bg-[var(--blue)] text-white'
                : 'border border-[var(--line)] bg-white/95 text-[var(--muted)]'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="space-y-1 p-4 pb-2">
          <p className="text-xs font-bold text-[var(--orange)]">{item.category}</p>
          <h3 className="text-lg font-extrabold text-[var(--navy)] transition-colors group-hover:text-[var(--blue)]">
            {item.name}
          </h3>
          <p className="text-sm font-medium text-[var(--muted)]">
            {item.neighborhood} · {item.condition}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-4 pt-2">
        <span className="rounded-full bg-[var(--sun-soft)] px-3 py-1 text-xs font-extrabold text-[var(--navy)]">
          FREE
        </span>
        <span className="text-sm font-bold text-[var(--blue)] group-hover:underline">
          View details →
        </span>
      </div>
    </motion.article>
  );
}

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
      <div className="shimmer aspect-[4/3]" />
      <div className="space-y-2.5 p-4">
        <div className="shimmer h-3 w-1/3 rounded-full" />
        <div className="shimmer h-5 w-3/4 rounded-full" />
        <div className="shimmer h-3 w-1/2 rounded-full" />
      </div>
    </div>
  );
}
