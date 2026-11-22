/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthModal } from './components/AuthModal';
import { ChatDrawer } from './components/ChatDrawer';
import { DebugConsole } from './components/DebugConsole';
import { LoopBurst } from './components/LoopBurst';
import { Navbar } from './components/Navbar';
import { ShareItemModal } from './components/ShareItemModal';
import { AuthProvider } from './hooks/useAuth';
import { ChatProvider } from './hooks/useChat';
import { ShareShelfDataProvider, useShareShelfData } from './hooks/useShareShelfData';
import { ToastProvider } from './hooks/useToast';
import { isSupabaseConfigured } from './lib/supabase';
import { ActivityPage } from './pages/ActivityPage';
import { AuthPage } from './pages/AuthPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { ImpactPage } from './pages/ImpactPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { WantedPage } from './pages/WantedPage';
import type { Item } from './types';

function ShareShelfAppShell() {
  const location = useLocation();
  const { loopBurstOpen } = useShareShelfData();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const openNewShareModal = () => {
    setEditingItem(null);
    setShareModalOpen(true);
  };

  const openEditItemModal = (item: Item) => {
    setEditingItem(item);
    setShareModalOpen(true);
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden overflow-x-clip bg-[var(--cream)] text-[var(--navy)]">
      <Navbar onOpenShareModal={openNewShareModal} />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<DiscoverPage onOpenShareModal={openNewShareModal} />} />
          <Route path="/wanted" element={<WantedPage />} />
          <Route
            path="/activity"
            element={
              <ActivityPage
                onOpenShareModal={openNewShareModal}
                onEditItem={openEditItemModal}
              />
            }
          />
          <Route path="/impact" element={<ImpactPage />} />
          <Route
            path="/item/:id"
            element={
              <ItemDetailPage
                onOpenShareModal={openNewShareModal}
                onEditItem={openEditItemModal}
              />
            }
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>

      <AuthModal />
      <ChatDrawer />
      <ShareItemModal
        open={shareModalOpen}
        onClose={closeShareModal}
        editingItem={editingItem}
      />
      <LoopBurst show={loopBurstOpen} />
      <DebugConsole />
    </div>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-dvh place-items-center bg-[var(--cream)] p-6 text-center text-[var(--navy)]">
          <div className="max-w-md rounded-3xl border border-[var(--line)] bg-white p-8 shadow-[var(--shadow)]">
            <h1 className="text-2xl font-extrabold">Something went wrong</h1>
            <p className="mt-2 text-sm font-medium text-[var(--muted)]">
              {this.state.message || 'Please reload the page to try again.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--navy)] px-6 py-2.5 text-sm font-bold text-white"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <AppErrorBoundary>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider supabaseReady={supabaseReady}>
            <ShareShelfDataProvider supabaseReady={supabaseReady}>
              <ChatProvider supabaseReady={supabaseReady}>
                <HashRouter>
                  <ShareShelfAppShell />
                </HashRouter>
              </ChatProvider>
            </ShareShelfDataProvider>
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </AppErrorBoundary>
  );
}
