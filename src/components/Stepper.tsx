import React from 'react';
import { motion } from 'framer-motion';
import type { BorrowRequestStatus } from '../types';

const STEPS = ['Requested', 'Approved', 'Picked up', 'Returned', 'Complete'] as const;

const STEP_INDEX: Partial<Record<BorrowRequestStatus, number>> = {
  pending: 0,
  approved: 1,
  active: 2,
  return_requested: 3,
  completed: 4,
};

export function Stepper({ status }: { status: BorrowRequestStatus | string }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <p className="text-sm font-bold text-[var(--danger)]">
        {status === 'rejected' ? 'Not approved this time' : 'Request cancelled'}
      </p>
    );
  }

  const cur = STEP_INDEX[status as BorrowRequestStatus] ?? 0;

  return (
    <div className="relative flex justify-between" aria-label="Borrow progress">
      <div className="absolute left-7 right-7 top-[13px] h-1 rounded-full bg-[var(--line)]">
        <motion.div
          className="h-full rounded-full bg-[var(--blue)]"
          initial={{ width: 0 }}
          animate={{ width: `${(cur / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {STEPS.map((step, i) => (
        <div
          key={step}
          className="relative z-10 flex w-14 flex-col items-center gap-1 text-center"
        >
          <motion.span
            animate={{ scale: i === cur ? 1.15 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-extrabold ${
              i <= cur
                ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                : 'border-[var(--line)] bg-white text-[var(--muted)]'
            }`}
          >
            {i < cur || status === 'completed' ? '✓' : i + 1}
          </motion.span>
          <span
            className={`text-[10px] font-bold leading-tight ${
              i <= cur ? 'text-[var(--navy)]' : 'text-[var(--muted)]'
            }`}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}
