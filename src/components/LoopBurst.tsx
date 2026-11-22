import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const BURST_COLORS = ['#0B57F0', '#F5811F', '#FFC531'];

export function LoopBurst({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
        >
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute h-3 w-3 rounded-full"
                style={{ background: BURST_COLORS[i % 3] }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * 170,
                  y: Math.sin(angle) * 170,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            );
          })}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="rounded-3xl border border-[var(--line)] bg-white px-8 py-6 text-center shadow-2xl"
          >
            <p className="text-2xl font-extrabold text-[var(--navy)]">Loop complete 🎉</p>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">
              Item home, neighbor happy.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
