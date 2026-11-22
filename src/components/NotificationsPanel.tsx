import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { formatRelativeTime } from '../lib/format';

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const { notifications, unreadNotificationsCount, readNotification, readAllNotifications } =
    useShareShelfData();

  const handleItemClick = async (id: string) => {
    await readNotification(id);
    onClose();
    navigate('/activity');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[var(--navy)]/25 lg:bg-transparent"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Mobile full-screen list / Desktop top-right dropdown */}
          <div className="pointer-events-none fixed inset-0 z-50 flex flex-col lg:inset-x-0 lg:top-16 lg:bottom-auto">
            <div className="flex h-full w-full flex-col lg:mx-auto lg:max-w-6xl lg:items-end lg:px-4 lg:pt-2">
              <motion.div
                role="dialog"
                aria-label="Notifications"
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className="pointer-events-auto flex h-full w-full flex-col bg-white lg:h-auto lg:max-h-[460px] lg:w-96 lg:rounded-3xl lg:border lg:border-[var(--line)] lg:shadow-2xl"
              >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[var(--navy)]">Notifications</h2>
                {unreadNotificationsCount > 0 && (
                  <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 text-xs font-extrabold text-[var(--navy)] tabular-nums">
                    {unreadNotificationsCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={readAllNotifications}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-[var(--blue)] hover:bg-[var(--blue-soft)]"
                  >
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Mark all as read
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notifications"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sun-soft)] lg:hidden"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
              {notifications.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-base font-extrabold text-[var(--navy)]">
                    You're all caught up.
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--muted)]">
                    Updates about your borrow requests and neighbor responses will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleItemClick(notif.id)}
                    className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-[var(--sun-soft)]/50 ${
                      notif.is_read ? 'bg-white' : 'bg-[var(--blue-soft)]/45'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={`min-w-0 flex-1 break-words text-sm leading-snug ${
                          notif.is_read
                            ? 'font-medium text-[var(--navy)]/85'
                            : 'font-bold text-[var(--navy)]'
                        }`}
                      >
                        {notif.message}
                      </p>
                      {!notif.is_read && (
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--orange)]"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                      {formatRelativeTime(notif.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
