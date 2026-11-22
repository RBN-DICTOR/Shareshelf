import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Bell,
  Compass,
  HandHelping,
  Inbox,
  LayoutList,
  LogOut,
  MessageCircle,
  Plus,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_USERS, useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { getInitials } from '../lib/format';
import { Button } from './Button';
import { Logo } from './Logo';
import { NotificationsPanel } from './NotificationsPanel';

interface NavbarProps {
  onOpenShareModal: () => void;
}

const DESKTOP_LINKS = [
  ['/', 'Discover'],
  ['/wanted', 'Wanted board'],
  ['/activity', 'My activity'],
  ['/impact', 'Impact'],
] as const;

export function Navbar({ onOpenShareModal }: NavbarProps) {
  const { user, profile, isDemoAccount, demoRole, switchDemoUser, signOut, openAuthModal } =
    useAuth();
  const { unreadMessagesCount, openInbox } = useChat();
  const { actionCount, unreadNotificationsCount } = useShareShelfData();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Neighbor';
  const otherDemoName =
    demoRole === 'alex' ? DEMO_USERS.jordan.name : DEMO_USERS.alex.name;

  useEffect(() => {
    setNotifOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  const handleShareClick = () => {
    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.', () => {
        onOpenShareModal();
      });
      return;
    }
    onOpenShareModal();
  };

  const handleNotificationsClick = () => {
    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.');
      return;
    }
    setMenuOpen(false);
    setNotifOpen((v) => !v);
  };

  const renderMobileTab = (
    to: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <li key={to}>
      <NavLink
        to={to}
        end={to === '/'}
        className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold"
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.span
                layoutId="tabbubble"
                className="absolute top-1.5 h-8 w-14 rounded-full bg-[var(--sun-soft)]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon
              className={`relative h-5 w-5 ${
                isActive ? 'text-[var(--blue)]' : 'text-[var(--muted)]'
              }`}
            />
            <span
              className={`relative ${
                isActive ? 'text-[var(--navy)]' : 'text-[var(--muted)]'
              }`}
            >
              {label}
            </span>
            {label === 'Activity' && user && actionCount > 0 && (
              <span className="absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--orange)] px-1 text-[10px] font-extrabold text-white tabular-nums">
                {actionCount}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );

  return (
    <>
      {/* Desktop & Slim Mobile Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--cream)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 shrink-0">
            <Link to="/" className="inline-flex items-center rounded-xl">
              <Logo size={30} />
            </Link>
            <span className="hidden md:inline-block rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[var(--muted)] whitespace-nowrap">
              Prototype demo
            </span>
          </div>

          <LayoutGroup id="topnav">
            <nav
              aria-label="Primary navigation"
              className="hidden gap-1 rounded-full bg-white p-1 shadow-[var(--shadow)] lg:flex"
            >
              {DESKTOP_LINKS.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className="relative rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="navpill"
                          className="absolute inset-0 rounded-full bg-[var(--navy)]"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span
                        className={`relative inline-flex items-center gap-1.5 ${
                          isActive ? 'text-white' : 'text-[var(--navy)]'
                        }`}
                      >
                        <span>{label}</span>
                        {to === '/activity' && user && actionCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--orange)] px-1.5 text-[11px] font-extrabold text-white tabular-nums">
                            {actionCount}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="orange"
              onClick={handleShareClick}
              className="hidden lg:inline-flex"
            >
              Share an item
            </Button>

            {/* Inbuilt Neighbor Messages */}
            <button
              type="button"
              onClick={() => {
                setNotifOpen(false);
                setMenuOpen(false);
                openInbox();
              }}
              aria-label="Neighbor messages"
              className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {user && unreadMessagesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--blue)] px-1 text-[11px] font-extrabold text-white tabular-nums ring-2 ring-[var(--cream)]">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={handleNotificationsClick}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)]"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {user && unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--orange)] px-1 text-[11px] font-extrabold text-white tabular-nums ring-2 ring-[var(--cream)]">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
              <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* Avatar menu or Sign in */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  className="flex h-10 sm:h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white pl-1 pr-1 sm:pl-1.5 sm:pr-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                    {getInitials(displayName)}
                  </span>
                  <span className="hidden sm:inline max-w-[110px] truncate">
                    {displayName.split(' ')[0]}
                  </span>
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-3xl border border-[var(--line)] bg-white py-2 shadow-2xl"
                    >
                      <div className="border-b border-[var(--line)] px-4 py-3">
                        <p className="truncate text-sm font-extrabold text-[var(--navy)]">
                          {displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[var(--muted)]">
                          {profile?.neighborhood || 'Neighborhood member'}
                        </p>
                      </div>

                      <div className="py-1">
                        {isDemoAccount && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setMenuOpen(false);
                              await switchDemoUser();
                            }}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-[var(--blue)] hover:bg-[var(--blue-soft)]/60"
                          >
                            <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>Switch to {otherDemoName}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            openInbox();
                          }}
                          className="flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[var(--navy)] hover:bg-[var(--sun-soft)]/50"
                        >
                          <span className="flex items-center gap-2.5">
                            <MessageCircle className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                            <span>Messages</span>
                          </span>
                          {unreadMessagesCount > 0 && (
                            <span className="rounded-full bg-[var(--blue)] px-2 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
                              {unreadMessagesCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            navigate('/activity');
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[var(--navy)] hover:bg-[var(--sun-soft)]/50"
                        >
                          <LayoutList className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                          <span>My activity</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            setMenuOpen(false);
                            await signOut();
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-[var(--danger)] hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="inline-flex min-h-[40px] sm:min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)] whitespace-nowrap shrink-0"
              >
                <UserIcon className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (<1024px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <LayoutGroup id="mobnav">
          <ul className="mx-auto grid max-w-md grid-cols-5 items-center">
            {renderMobileTab('/', 'Discover', Compass)}
            {renderMobileTab('/wanted', 'Wanted', HandHelping)}
            <li className="flex justify-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={handleShareClick}
                aria-label="Share an item"
                className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-[var(--orange)] text-white shadow-lg ring-4 ring-[var(--cream)]"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </motion.button>
            </li>
            {renderMobileTab('/activity', 'Activity', Inbox)}
            {renderMobileTab('/impact', 'Impact', Sparkles)}
          </ul>
        </LayoutGroup>
      </nav>
    </>
  );
}
