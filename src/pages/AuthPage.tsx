import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFormPanel } from '../components/AuthFormPanel';
import { Page } from '../components/Motion';
import { useAuth } from '../hooks/useAuth';

export function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  return (
    <Page className="mx-auto max-w-4xl px-4 py-10 pb-24 sm:px-6 lg:py-14">
      <div className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-white shadow-[var(--shadow)]">
        <AuthFormPanel onSuccess={() => navigate('/', { replace: true })} />
      </div>
    </Page>
  );
}
