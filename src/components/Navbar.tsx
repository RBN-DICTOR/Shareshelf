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
import { LogoMark } from './Logo';
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
  const accountBtnRef = useRef<HTMLButtonElement | null>(null);

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
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        accountBtnRef.current &&
        !accountBtnRef.current.contains(target)
      ) {
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
      {/* Desktop & Clean Single-Row Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--cream)]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl flex-nowrap items-center justify-between gap-2 px-3 lg:h-16 lg:px-4">
          <div className="flex min-w-0 shrink items-center gap-2.5">
            <Link to="/" className="flex min-w-0 shrink items-center gap-2 rounded-xl">
              <LogoMark size={32} />
              <span className="hidden truncate font-display text-lg font-extrabold tracking-tight text-[var(--blue)] min-[380px]:inline lg:text-xl">
                ShareShelf
              </span>
            </Link>
            <span className="hidden rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[var(--muted)] whitespace-nowrap lg:inline-block">
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

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="orange"
              onClick={handleShareClick}
              className="hidden lg:inline-flex"
            >
              Share an item
            </Button>

            {user ? (
              <>
                {/* Desktop Neighbor Messages shortcut (mobile uses avatar menu & item/activity chat buttons) */}
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setMenuOpen(false);
                    openInbox();
                  }}
                  aria-label="Neighbor messages"
                  className="hidden h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)] lg:inline-flex"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {unreadMessagesCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--blue)] px-1 text-[11px] font-extrabold text-white tabular-nums">
                      {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                    </span>
                  )}
                </button>

                {/* Notification Bell */}
                <button
                  type="button"
                  onClick={handleNotificationsClick}
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  className={`inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[var(--line)] bg-white text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)] ${
                    unreadNotificationsCount > 0 ? 'px-2.5' : 'w-11'
                  }`}
                >
                  <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {unreadNotificationsCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--orange)] px-1 text-[11px] font-extrabold text-white tabular-nums">
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Avatar Menu Trigger */}
                <button
                  ref={accountBtnRef}
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white pl-1.5 pr-1.5 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-[var(--sun-soft)] sm:pr-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                    {getInitials(displayName)}
                  </span>
                  <span className="hidden max-w-[110px] truncate sm:inline">
                    {displayName.split(' ')[0]}
                  </span>
                </button>
              </>
            ) : (
              <Button
                variant="blue"
                onClick={() => openAuthModal()}
                className="px-4 whitespace-nowrap"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Account Dropdown Menu (rendered outside header so header has zero absolute/fixed children) */}
      <AnimatePresence>
        {user && menuOpen && (
          <div className="pointer-events-none fixed inset-x-0 top-14 z-50 pt-[env(safe-area-inset-top)] lg:top-16">
            <div className="mx-auto flex max-w-6xl justify-end px-3 pt-2 lg:px-4">
              <motion.div
                ref={menuRef}
                role="menu"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-auto w-64 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl border border-[var(--line)] bg-white py-2 shadow-2xl"
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
                      <span className="min-w-0 truncate">Switch to {otherDemoName}</span>
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
                    <span className="flex min-w-0 items-center gap-2.5">
                      <MessageCircle className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                      <span className="truncate">Messages</span>
                    </span>
                    {unreadMessagesCount > 0 && (
                      <span className="shrink-0 rounded-full bg-[var(--blue)] px-2 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
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
                    <span className="truncate">My activity</span>
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
                    <span className="truncate">Sign out</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications Panel (rendered outside header) */}
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

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
