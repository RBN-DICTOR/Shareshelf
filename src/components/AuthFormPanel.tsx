import React, { useEffect, useState } from 'react';
import { Package, Sparkles, UserCheck } from 'lucide-react';
import { DEMO_USERS, useAuth, type DemoRole } from '../hooks/useAuth';
import { Button } from './Button';
import { Logo } from './Logo';
import { Ribbons } from './Ribbons';

interface AuthFormPanelProps {
  reason?: string | null;
  initialTab?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export function AuthFormPanel({
  reason,
  initialTab = 'signin',
  onSuccess,
}: AuthFormPanelProps) {
  const { signIn, signUp, signInDemo } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);

  useEffect(() => {
    setTab(initialTab);
    setError(null);
  }, [initialTab]);
  const [fullName, setFullName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<DemoRole | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!neighborhood.trim()) {
        setError('Please enter your neighborhood so neighbors know how close you are.');
        return;
      }
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'signin') {
        await signIn(email, password);
      } else {
        await signUp({ fullName, neighborhood, email, password });
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (role: DemoRole) => {
    setError(null);
    setDemoLoading(role);
    try {
      await signInDemo(role);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with demo account.');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-12">
      {/* Left blue panel on desktop with ribbons */}
      <div className="relative hidden overflow-hidden lg:col-span-5 lg:flex flex-col justify-between bg-[var(--blue)] p-8 text-white">
        <Ribbons />
        <div className="relative z-10">
          <div className="inline-flex items-center rounded-2xl bg-white px-3.5 py-2 shadow-lg">
            <Logo size={26} />
          </div>
          <h2 className="mt-7 text-3xl font-extrabold leading-tight text-white">
            Join your neighbors. Share what you have.
          </h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/90">
            Borrow what you need. Share what you have. Lend tools, camping gear, study books, and
            everyday essentials for free.
          </p>
        </div>

        <div className="relative z-10 mt-10 pt-4">
          <div className="flex items-end gap-3">
            <div className="rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs text-white backdrop-blur-sm">
              <Package className="mb-1 h-4 w-4 text-[var(--sun)]" aria-hidden="true" />
              <span className="font-bold">Power drill</span>
            </div>
            <div className="mb-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs text-white backdrop-blur-sm">
              <Sparkles className="mb-1 h-4 w-4 text-[var(--sun)]" aria-hidden="true" />
              <span className="font-bold">Camping tent</span>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-white/85">
            Free to borrow · Clear return dates · Built for trust
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 lg:col-span-7">
        <div className="mb-3 pr-12 lg:hidden">
          <Logo size={26} />
        </div>

        {reason && (
          <div className="mb-4 rounded-2xl border border-[var(--sun)] bg-[var(--sun-soft)] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[var(--navy)]">
            {reason}
          </div>
        )}

        {/* Prototype demo box */}
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-3 sm:mb-6 sm:rounded-3xl sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--blue)]">
              <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Prototype demo
            </span>
            <span className="text-[11px] font-bold text-[var(--muted)] sm:text-xs">
              Instant sign-in
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[var(--navy)]/80">
            Explore both sides of a borrow exchange in one click.
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2">
            <Button
              variant="navy"
              loading={demoLoading === 'alex'}
              disabled={demoLoading !== null || submitting}
              onClick={() => handleDemo('alex')}
              className="min-h-[40px] w-full px-3 py-2 text-center text-xs leading-tight whitespace-normal"
            >
              Continue as {DEMO_USERS.alex.name} ({DEMO_USERS.alex.roleLabel})
            </Button>
            <Button
              variant="orange"
              loading={demoLoading === 'jordan'}
              disabled={demoLoading !== null || submitting}
              onClick={() => handleDemo('jordan')}
              className="min-h-[40px] w-full px-3 py-2 text-center text-xs leading-tight whitespace-normal"
            >
              Continue as {DEMO_USERS.jordan.name} ({DEMO_USERS.jordan.roleLabel})
            </Button>
          </div>
        </div>

        {/* Sign in / Create account tabs */}
        <div className="flex rounded-full border border-[var(--line)] bg-[var(--cream)] p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signin'}
            onClick={() => {
              setTab('signin');
              setError(null);
            }}
            className={`min-h-[40px] flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              tab === 'signin'
                ? 'bg-[var(--navy)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--navy)]'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`min-h-[40px] flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              tab === 'signup'
                ? 'bg-[var(--navy)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--navy)]'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4" noValidate>
          {tab === 'signup' && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <label
                  htmlFor="auth-fullname"
                  className="mb-1 block text-sm font-bold text-[var(--navy)]"
                >
                  Full name
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Samira Patel"
                  className="min-h-[44px] w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none sm:text-sm"
                  required
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="auth-neighborhood"
                  className="mb-1 block text-sm font-bold text-[var(--navy)]"
                >
                  Neighborhood
                </label>
                <input
                  id="auth-neighborhood"
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Riverside"
                  className="min-h-[44px] w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none sm:text-sm"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-sm font-bold text-[var(--navy)]"
            >
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[44px] w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none sm:text-sm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-sm font-bold text-[var(--navy)]"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="min-h-[44px] w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none sm:text-sm"
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-4 py-2.5 text-sm font-semibold text-[var(--danger)]"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="blue"
            loading={submitting}
            disabled={demoLoading !== null}
            className="w-full"
          >
            {tab === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
