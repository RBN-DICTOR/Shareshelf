import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { fetchProfile, updateProfile } from '../lib/api';
import { cleanText, mapSupabaseError } from '../lib/format';
import {
  localSignIn,
  localSignInDemo,
  localSignOut,
  localSignUp,
} from '../lib/localApi';
import { getSupabaseClient } from '../lib/supabase';
import type { Profile } from '../types';
import { useToast } from './useToast';

export const DEMO_USERS = {
  alex: {
    email: 'alex@shareshelf.demo',
    password: 'ShareShelf!2026',
    name: 'Alex Morgan',
    roleLabel: 'item owner',
    neighborhood: 'Riverside',
  },
  jordan: {
    email: 'jordan@shareshelf.demo',
    password: 'ShareShelf!2026',
    name: 'Jordan Lee',
    roleLabel: 'borrower',
    neighborhood: 'Westlands',
  },
} as const;

export type DemoRole = keyof typeof DEMO_USERS;

export interface AuthUserSummary {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface AuthContextValue {
  session: Session | null;
  user: AuthUserSummary | null;
  profile: Profile | null;
  loading: boolean;
  isDemoAccount: boolean;
  demoRole: DemoRole | null;
  authModalOpen: boolean;
  authModalReason: string | null;
  openAuthModal: (reason?: string, onAuthenticated?: () => void) => void;
  closeAuthModal: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    fullName: string;
    neighborhood: string;
    email: string;
    password: string;
  }) => Promise<void>;
  signInDemo: (role: DemoRole) => Promise<void>;
  switchDemoUser: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  supabaseReady,
}: {
  children: React.ReactNode;
  supabaseReady: boolean;
}) {
  const { showToast, logDebugError } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLocalUser] = useState<AuthUserSummary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(supabaseReady);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const loadProfileForUser = useCallback(
    async (u: User | null) => {
      if (!u) {
        setProfile(null);
        return;
      }
      try {
        const p = await fetchProfile(u.id);
        if (p) {
          setProfile(p);
        } else {
          setProfile({
            id: u.id,
            full_name:
              (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Neighbor',
            neighborhood: (u.user_metadata?.neighborhood as string) || null,
          });
        }
      } catch (err) {
        logDebugError('fetchProfile', err);
        setProfile({
          id: u.id,
          full_name:
            (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || 'Neighbor',
          neighborhood: (u.user_metadata?.neighborhood as string) || null,
        });
      }
    },
    [logDebugError]
  );

  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      setLoading(false);
      return;
    }

    localSignOut();
    setLocalUser(null);

    const sb = getSupabaseClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    sb.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          logDebugError('auth.getSession', error);
        }
        setSession(data.session ?? null);
        await loadProfileForUser(data.session?.user ?? null);
        if (mounted) setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        logDebugError('auth.getSession.catch', err);
        setLoading(false);
      });

    const { data: listener } = sb.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      await loadProfileForUser(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabaseReady, loadProfileForUser, logDebugError]);

  const runPendingAction = useCallback(() => {
    const fn = pendingActionRef.current;
    pendingActionRef.current = null;
    if (fn) {
      window.setTimeout(() => fn(), 40);
    }
  }, []);

  const openAuthModal = useCallback((reason?: string, onAuthenticated?: () => void) => {
    pendingActionRef.current = onAuthenticated || null;
    setAuthModalReason(reason || 'Sign in to continue. It only takes a minute.');
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
    pendingActionRef.current = null;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabaseReady) {
        try {
          const res = await localSignIn(email, password);
          setLocalUser({
            id: res.user.id,
            email: res.user.email,
            user_metadata: { full_name: res.profile.full_name },
          });
          setProfile(res.profile);
          setAuthModalOpen(false);
          setAuthModalReason(null);
          showToast('Welcome back!');
          runPendingAction();
          return;
        } catch (err) {
          logDebugError('localAuth.signIn', err);
          throw err;
        }
      }

      const sb = getSupabaseClient();
      if (!sb) throw new Error('Supabase is not connected.');
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        logDebugError('auth.signIn', error);
        throw new Error(mapSupabaseError(error));
      }
      setSession(data.session);
      await loadProfileForUser(data.user);
      setAuthModalOpen(false);
      setAuthModalReason(null);
      showToast('Welcome back!');
      runPendingAction();
    },
    [supabaseReady, loadProfileForUser, logDebugError, runPendingAction, showToast]
  );

  const signUp = useCallback(
    async (input: {
      fullName: string;
      neighborhood: string;
      email: string;
      password: string;
    }) => {
      const fullName = cleanText(input.fullName);
      const neighborhood = cleanText(input.neighborhood);

      if (!supabaseReady) {
        try {
          const res = await localSignUp({
            full_name: fullName,
            neighborhood,
            email: input.email,
            password: input.password,
          });
          setLocalUser({
            id: res.user.id,
            email: res.user.email,
            user_metadata: { full_name: res.profile.full_name },
          });
          setProfile(res.profile);
          setAuthModalOpen(false);
          setAuthModalReason(null);
          showToast(`Welcome to ShareShelf, ${fullName.split(' ')[0]}!`);
          runPendingAction();
          return;
        } catch (err) {
          logDebugError('localAuth.signUp', err);
          throw err;
        }
      }

      const sb = getSupabaseClient();
      if (!sb) throw new Error('Supabase is not connected.');

      const { data, error } = await sb.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            full_name: fullName,
            neighborhood,
          },
        },
      });
      if (error) {
        logDebugError('auth.signUp', error);
        throw new Error(mapSupabaseError(error));
      }

      if (data.user && data.session) {
        try {
          const updated = await updateProfile(data.user.id, {
            full_name: fullName,
            neighborhood,
          });
          if (updated) setProfile(updated);
        } catch (profileErr) {
          logDebugError('auth.signUp.updateProfile', profileErr);
        }
        setSession(data.session);
        setAuthModalOpen(false);
        setAuthModalReason(null);
        showToast(`Welcome to ShareShelf, ${fullName.split(' ')[0]}!`);
        runPendingAction();
      } else {
        showToast('Account created! Please check your email if confirmation is enabled.', 'info');
      }
    },
    [supabaseReady, logDebugError, runPendingAction, showToast]
  );

  const signInDemo = useCallback(
    async (role: DemoRole) => {
      const account = DEMO_USERS[role];

      if (!supabaseReady) {
        try {
          const res = await localSignInDemo(role);
          setLocalUser({
            id: res.user.id,
            email: res.user.email,
            user_metadata: { full_name: res.profile.full_name },
          });
          setProfile(res.profile);
          setAuthModalOpen(false);
          setAuthModalReason(null);
          showToast(`Signed in as ${account.name}`);
          runPendingAction();
          return;
        } catch (err) {
          logDebugError(`localAuth.signInDemo(${role})`, err);
          throw err;
        }
      }

      const sb = getSupabaseClient();
      if (!sb) throw new Error('Supabase is not connected.');
      const { data, error } = await sb.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) {
        logDebugError(`auth.signInDemo(${role})`, error);
        const mapped = mapSupabaseError(error);
        const isInvalidCreds = error.message?.toLowerCase().includes('invalid login credentials');
        throw new Error(
          isInvalidCreds
            ? `${mapped} Make sure the demo users exist in Supabase Authentication.`
            : mapped
        );
      }
      setSession(data.session);
      await loadProfileForUser(data.user);
      setAuthModalOpen(false);
      setAuthModalReason(null);
      showToast(`Signed in as ${account.name}`);
      runPendingAction();
    },
    [supabaseReady, loadProfileForUser, logDebugError, runPendingAction, showToast]
  );

  const user: AuthUserSummary | null = supabaseReady ? session?.user ?? null : localUser;
  const emailLower = user?.email?.toLowerCase() || '';
  const demoRole: DemoRole | null =
    emailLower === DEMO_USERS.alex.email
      ? 'alex'
      : emailLower === DEMO_USERS.jordan.email
        ? 'jordan'
        : null;
  const isDemoAccount = demoRole !== null;

  const switchDemoUser = useCallback(async () => {
    if (!demoRole) return;
    const nextRole: DemoRole = demoRole === 'alex' ? 'jordan' : 'alex';
    try {
      await signInDemo(nextRole);
    } catch (err) {
      showToast(mapSupabaseError(err), 'error');
    }
  }, [demoRole, showToast, signInDemo]);

  const signOut = useCallback(async () => {
    if (!supabaseReady) {
      localSignOut();
      setLocalUser(null);
      setProfile(null);
      showToast('Signed out', 'info');
      return;
    }

    const sb = getSupabaseClient();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) {
      logDebugError('auth.signOut', error);
      showToast(mapSupabaseError(error), 'error');
      return;
    }
    setSession(null);
    setProfile(null);
    showToast('Signed out', 'info');
  }, [supabaseReady, logDebugError, showToast]);

  const refreshProfile = useCallback(async () => {
    if (supabaseReady) {
      await loadProfileForUser(session?.user ?? null);
    }
  }, [supabaseReady, loadProfileForUser, session?.user]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isDemoAccount,
        demoRole,
        authModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        signInDemo,
        switchDemoUser,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
