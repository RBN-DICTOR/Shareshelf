import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { DebugErrorLog } from '../types';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  debugLogs: DebugErrorLog[];
  logDebugError: (context: string, err: unknown) => void;
  clearDebugLogs: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [debugLogs, setDebugLogs] = useState<DebugErrorLog[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 3600);
    },
    [dismissToast]
  );

  const logDebugError = useCallback((context: string, err: unknown) => {
    const message =
      typeof err === 'string'
        ? err
        : (err as { message?: string })?.message || JSON.stringify(err);
    setDebugLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString(),
        context,
        message,
        raw: err,
      },
      ...prev.slice(0, 24),
    ]);
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, debugLogs, logDebugError, clearDebugLogs }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-28 z-50 mx-auto flex max-w-sm flex-col items-center gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[380px] lg:items-end"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const isError = toast.variant === 'error';
            const isInfo = toast.variant === 'info';
            return (
              <motion.div
                key={toast.id}
                layout
                role="status"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-xl ${
                  isError
                    ? 'bg-[var(--danger)] text-white'
                    : isInfo
                      ? 'border border-[var(--line)] bg-white text-[var(--navy)]'
                      : 'bg-[var(--navy)] text-white'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {isError ? (
                    <AlertCircle className="h-4 w-4 text-white" aria-hidden="true" />
                  ) : isInfo ? (
                    <Info className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[var(--sun)]" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1 break-words leading-snug">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className={`-mr-1 -mt-0.5 rounded-full p-1 transition-colors ${
                    isInfo
                      ? 'text-[var(--muted)] hover:bg-[var(--sun-soft)] hover:text-[var(--navy)]'
                      : 'text-white/75 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
