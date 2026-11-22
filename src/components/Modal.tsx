import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidthClass?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  maxWidthClass = 'max-w-2xl',
  hideHeader = false,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--navy)]/50 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Dialog'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 48, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[32px] border border-[var(--line)] bg-[var(--cream)] shadow-2xl sm:max-h-[88dvh] sm:rounded-[32px] ${maxWidthClass}`}
          >
            {/* Mobile grab handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-[var(--line)]" />
            </div>

            {!hideHeader && (
              <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                <h2 className="text-lg font-extrabold text-[var(--navy)] sm:text-xl">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            )}

            {hideHeader && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-4 right-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--navy)] shadow-sm transition-colors hover:bg-[var(--sun-soft)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sheet({
  open,
  onClose,
  children,
  title,
  maxWidthClass = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidthClass?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass={maxWidthClass}
      hideHeader={!title}
    >
      {children}
    </Modal>
  );
}
