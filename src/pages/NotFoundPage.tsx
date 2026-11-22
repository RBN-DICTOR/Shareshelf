import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Page } from '../components/Motion';
import { EmptyShelfState } from '../components/ShelfLine';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Page className="mx-auto max-w-2xl px-4 py-16 pb-24 sm:px-6">
      <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
        <EmptyShelfState
          title="This page took a trip. Let's get you back to the shelf."
          description="The link might be outdated, or the item may have found a home."
          action={
            <Button variant="navy" onClick={() => navigate('/')}>
              Back to Discover
            </Button>
          }
        />
      </div>
    </Page>
  );
}
