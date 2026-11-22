import React from 'react';
import { Package } from 'lucide-react';

interface EmptyShelfStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyShelfState({
  title,
  description,
  action,
  secondaryAction,
}: EmptyShelfStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--sun-soft)] text-[var(--blue)]">
          <Package className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="h-1.5 w-28 rounded-full bg-[var(--orange)]" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-extrabold text-[var(--navy)]">{title}</h3>
      {description && (
        <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
