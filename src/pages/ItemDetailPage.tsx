import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ItemDetailContent } from '../components/ItemDetailContent';
import { Modal } from '../components/Modal';
import { Page } from '../components/Motion';
import { EmptyShelfState } from '../components/ShelfLine';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { fetchBusyDates, fetchItemById } from '../lib/api';
import type { Item, ItemBusyDate } from '../types';
import { DiscoverPage } from './DiscoverPage';

interface ItemDetailPageProps {
  onOpenShareModal: () => void;
  onEditItem: (item: Item) => void;
}

export function ItemDetailPage({ onOpenShareModal, onEditItem }: ItemDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, busyDates } = useShareShelfData();

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [fallbackItem, setFallbackItem] = useState<Item | null>(null);
  const [fallbackBusy, setFallbackBusy] = useState<ItemBusyDate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const itemFromStore = items.find((it) => it.id === id) || null;
  const item = itemFromStore || fallbackItem;
  const activeBusy = itemFromStore ? busyDates : fallbackBusy;

  useEffect(() => {
    if (!id || itemFromStore) return;
    let active = true;
    setLoading(true);
    Promise.all([fetchItemById(id), fetchBusyDates(id)])
      .then(([foundItem, foundBusy]) => {
        if (!active) return;
        setFallbackItem(foundItem);
        setFallbackBusy(foundBusy);
      })
      .catch(() => {
        if (!active) return;
        setFallbackItem(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, itemFromStore]);

  const handleClose = () => {
    navigate('/');
  };

  if (isDesktop) {
    return (
      <Page>
        <DiscoverPage onOpenShareModal={onOpenShareModal} />
        <Modal
          open
          onClose={handleClose}
          title={item ? item.name : 'Item details'}
          maxWidthClass="max-w-4xl"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--blue)]" aria-hidden="true" />
            </div>
          ) : item ? (
            <ItemDetailContent
              item={item}
              busyDates={activeBusy}
              onClose={handleClose}
              onEditItem={(it) => {
                onEditItem(it);
              }}
            />
          ) : (
            <EmptyShelfState
              title="Item not found"
              description="This item may have been removed by its owner."
              action={
                <Button variant="navy" onClick={handleClose}>
                  Back to Discover
                </Button>
              }
            />
          )}
        </Modal>
      </Page>
    );
  }

  // Mobile full-page layout
  return (
    <Page className="min-h-[calc(100dvh-64px)] bg-white pb-28">
      <div className="border-b border-[var(--line)] bg-[var(--cream)] px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-[var(--blue)] hover:bg-[var(--sun-soft)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Discover
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--blue)]" aria-hidden="true" />
        </div>
      ) : item ? (
        <ItemDetailContent
          item={item}
          busyDates={activeBusy}
          onClose={handleClose}
          onEditItem={onEditItem}
        />
      ) : (
        <EmptyShelfState
          title="Item not found"
          description="This item may have been removed by its owner."
          action={
            <Button variant="navy" onClick={handleClose}>
              Back to Discover
            </Button>
          }
        />
      )}
    </Page>
  );
}
