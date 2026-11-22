import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createBorrowRequest,
  createItem,
  createItemWant,
  createWantResponse,
  deleteItem,
  deleteItemWant,
  fetchBorrowRequestsForUser,
  fetchBusyDates,
  fetchCommunityImpact,
  fetchItems,
  fetchItemWants,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateBorrowRequestStatus,
  updateItem,
  updateWantStatus,
  type ItemInput,
} from '../lib/api';
import { getFirstName, mapSupabaseError } from '../lib/format';
import { getLocalAuthToken } from '../lib/localApi';
import { getSupabaseClient } from '../lib/supabase';
import type {
  BorrowRequest,
  BorrowRequestStatus,
  CommunityImpact,
  Item,
  ItemBusyDate,
  ItemWant,
  NotificationItem,
} from '../types';
import { useAuth } from './useAuth';
import { useToast } from './useToast';

interface ShareShelfDataContextValue {
  items: Item[];
  busyDates: ItemBusyDate[];
  requests: BorrowRequest[];
  wants: ItemWant[];
  notifications: NotificationItem[];
  impact: CommunityImpact | null;
  loadingItems: boolean;
  loadingRequests: boolean;
  loadingWants: boolean;
  loadingImpact: boolean;
  schemaMissing: boolean;
  loopBurstOpen: boolean;
  actionCount: number;
  unreadNotificationsCount: number;
  refreshAll: () => Promise<void>;
  refreshImpact: () => Promise<void>;
  addItem: (input: ItemInput) => Promise<Item>;
  editItem: (itemId: string, input: Partial<Omit<ItemInput, 'owner_id'>>) => Promise<Item>;
  removeItem: (itemId: string) => Promise<void>;
  toggleItemAvailability: (item: Item) => Promise<void>;
  submitBorrowRequest: (input: {
    item: Item;
    start_date: string;
    end_date: string;
    message?: string;
  }) => Promise<BorrowRequest>;
  changeRequestStatus: (requestId: string, nextStatus: BorrowRequestStatus) => Promise<void>;
  addWant: (input: {
    title: string;
    description?: string;
    category: string;
    neighborhood: string;
    needed_by: string;
  }) => Promise<ItemWant>;
  markWantFulfilled: (wantId: string, status: 'open' | 'fulfilled') => Promise<void>;
  removeWant: (wantId: string) => Promise<void>;
  respondToWant: (wantId: string, message: string, requesterName?: string) => Promise<void>;
  readNotification: (id: string) => Promise<void>;
  readAllNotifications: () => Promise<void>;
}

const ShareShelfDataContext = createContext<ShareShelfDataContextValue | null>(null);

export function ShareShelfDataProvider({
  children,
  supabaseReady,
}: {
  children: React.ReactNode;
  supabaseReady: boolean;
}) {
  const { user } = useAuth();
  const { showToast, logDebugError } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [busyDates, setBusyDates] = useState<ItemBusyDate[]>([]);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [wants, setWants] = useState<ItemWant[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [impact, setImpact] = useState<CommunityImpact | null>(null);

  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingWants, setLoadingWants] = useState(true);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loopBurstOpen, setLoopBurstOpen] = useState(false);
  const loopBurstTimerRef = useRef<number | null>(null);

  const triggerLoopBurst = useCallback(() => {
    if (loopBurstTimerRef.current) {
      window.clearTimeout(loopBurstTimerRef.current);
    }
    setLoopBurstOpen(true);
    loopBurstTimerRef.current = window.setTimeout(() => {
      setLoopBurstOpen(false);
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (loopBurstTimerRef.current) {
        window.clearTimeout(loopBurstTimerRef.current);
      }
    };
  }, []);

  const loadPublicData = useCallback(async () => {
    try {
      const [itemsData, busyData] = await Promise.all([fetchItems(), fetchBusyDates()]);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setBusyDates(Array.isArray(busyData) ? busyData : []);
      setSchemaMissing(false);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = ((err as { message?: string })?.message || '').toLowerCase();
      if (
        code === 'PGRST205' ||
        code === '42P01' ||
        msg.includes('could not find the table') ||
        (msg.includes('relation') && msg.includes('does not exist'))
      ) {
        setSchemaMissing(true);
      }
      logDebugError('loadPublicData(items/busyDates)', err);
    } finally {
      setLoadingItems(false);
    }
  }, [logDebugError]);

  const loadWantsData = useCallback(async () => {
    try {
      const wantsData = await fetchItemWants();
      setWants(Array.isArray(wantsData) ? wantsData : []);
    } catch (err) {
      logDebugError('loadWantsData', err);
    } finally {
      setLoadingWants(false);
    }
  }, [logDebugError]);

  const refreshImpact = useCallback(async () => {
    try {
      const data = await fetchCommunityImpact();
      setImpact(data);
    } catch (err) {
      logDebugError('fetchCommunityImpact', err);
    } finally {
      setLoadingImpact(false);
    }
  }, [logDebugError]);

  const loadUserData = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setNotifications([]);
      setLoadingRequests(false);
      return;
    }
    setLoadingRequests(true);
    try {
      const [reqs, notifs] = await Promise.all([
        fetchBorrowRequestsForUser(user.id),
        fetchNotifications(user.id),
      ]);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (err) {
      logDebugError('loadUserData', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [logDebugError, user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadPublicData(), loadWantsData(), refreshImpact(), loadUserData()]);
  }, [loadPublicData, loadUserData, loadWantsData, refreshImpact]);

  useEffect(() => {
    loadPublicData();
    loadWantsData();
    refreshImpact();
  }, [supabaseReady, loadPublicData, loadWantsData, refreshImpact]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Realtime subscriptions: Supabase Realtime OR Express SSE (/api/events)
  useEffect(() => {
    if (!supabaseReady) {
      const token = getLocalAuthToken();
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
      const source = new EventSource(url);

      source.addEventListener('items', () => {
        loadPublicData();
        refreshImpact();
      });
      source.addEventListener('borrow_requests', () => {
        loadPublicData();
        refreshImpact();
        if (user) loadUserData();
      });
      source.addEventListener('item_wants', () => {
        loadWantsData();
      });
      source.addEventListener('want_responses', () => {
        loadWantsData();
      });
      source.addEventListener('notifications', (evt) => {
        if (!user) return;
        try {
          const parsed = JSON.parse((evt as MessageEvent).data) as {
            notification?: NotificationItem;
          };
          if (parsed.notification) {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === parsed.notification!.id)) return prev;
              return [parsed.notification!, ...prev];
            });
            showToast(parsed.notification.message, 'info');
          }
        } catch {
          // ignore parse error
        }
      });

      return () => {
        source.close();
      };
    }

    const sb = getSupabaseClient();
    if (!sb) return;

    const channel = sb
      .channel(`shareshelf-live-${user?.id || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        () => {
          loadPublicData();
          refreshImpact();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrow_requests' },
        () => {
          loadPublicData();
          refreshImpact();
          if (user) {
            loadUserData();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_wants' },
        () => {
          loadWantsData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'want_responses' },
        () => {
          loadWantsData();
        }
      );

    if (user) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          showToast(newNotif.message, 'info');
        }
      );
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as NotificationItem;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      );
    }

    channel.subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [
    supabaseReady,
    user,
    loadPublicData,
    loadWantsData,
    loadUserData,
    refreshImpact,
    showToast,
  ]);

  const addItem = useCallback(
    async (input: ItemInput) => {
      try {
        const created = await createItem(input);
        setItems((prev) => [created, ...prev]);
        refreshImpact();
        showToast(`${created.name} is on the shelf. Thanks for sharing!`);
        return created;
      } catch (err) {
        logDebugError('createItem', err);
        throw new Error(mapSupabaseError(err));
      }
    },
    [logDebugError, refreshImpact, showToast]
  );

  const editItem = useCallback(
    async (itemId: string, input: Partial<Omit<ItemInput, 'owner_id'>>) => {
      try {
        const updated = await updateItem(itemId, input);
        setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
        showToast('Changes saved.');
        return updated;
      } catch (err) {
        logDebugError('updateItem', err);
        throw new Error(mapSupabaseError(err));
      }
    },
    [logDebugError, showToast]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const prevItems = items;
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      try {
        await deleteItem(itemId);
        refreshImpact();
        showToast('Item removed.');
      } catch (err) {
        setItems(prevItems);
        logDebugError('deleteItem', err);
        const msg = mapSupabaseError(err);
        showToast(msg, 'error');
        throw new Error(msg);
      }
    },
    [items, logDebugError, refreshImpact, showToast]
  );

  const toggleItemAvailability = useCallback(
    async (item: Item) => {
      const nextVal = !item.is_available;
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_available: nextVal } : it))
      );
      try {
        await updateItem(item.id, { is_available: nextVal });
        showToast('Changes saved.');
      } catch (err) {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, is_available: item.is_available } : it))
        );
        logDebugError('toggleItemAvailability', err);
        showToast(mapSupabaseError(err), 'error');
      }
    },
    [logDebugError, showToast]
  );

  const submitBorrowRequest = useCallback(
    async (input: {
      item: Item;
      start_date: string;
      end_date: string;
      message?: string;
    }) => {
      if (!user) throw new Error('Sign in to continue. It only takes a minute.');
      try {
        const created = await createBorrowRequest({
          item_id: input.item.id,
          borrower_id: user.id,
          owner_id: input.item.owner_id,
          start_date: input.start_date,
          end_date: input.end_date,
          message: input.message,
        });
        await loadUserData();
        const ownerFirst = getFirstName(input.item.owner?.full_name);
        showToast(`Request sent to ${ownerFirst}. They'll reply soon.`);
        return created;
      } catch (err) {
        logDebugError('createBorrowRequest', err);
        throw new Error(mapSupabaseError(err));
      }
    },
    [loadUserData, logDebugError, showToast, user]
  );

  const changeRequestStatus = useCallback(
    async (requestId: string, nextStatus: BorrowRequestStatus) => {
      const prevRequests = requests;
      const targetReq = requests.find((r) => r.id === requestId);
      const borrowerFirst = getFirstName(targetReq?.borrower?.full_name);
      const ownerFirst = getFirstName(targetReq?.owner?.full_name);

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: nextStatus } : r))
      );
      try {
        await updateBorrowRequestStatus(requestId, nextStatus);
        await Promise.all([loadPublicData(), loadUserData(), refreshImpact()]);

        const toastMap: Partial<Record<BorrowRequestStatus, string>> = {
          approved: `Approved! ${borrowerFirst} can pick it up.`,
          rejected: "Request declined. There's always another item.",
          cancelled: 'Request cancelled.',
          active: 'Enjoy it! Remember the return date.',
          return_requested: `Return noted. Waiting for ${ownerFirst} to confirm.`,
          completed: 'Loop complete! Thanks for sharing.',
        };
        showToast(toastMap[nextStatus] || 'Changes saved.');
        if (nextStatus === 'completed') {
          triggerLoopBurst();
        }
      } catch (err) {
        setRequests(prevRequests);
        logDebugError(`updateBorrowRequestStatus(${nextStatus})`, err);
        const msg = mapSupabaseError(err);
        showToast(msg, 'error');
        throw new Error(msg);
      }
    },
    [
      loadPublicData,
      loadUserData,
      logDebugError,
      refreshImpact,
      requests,
      showToast,
      triggerLoopBurst,
    ]
  );

  const addWant = useCallback(
    async (input: {
      title: string;
      description?: string;
      category: string;
      neighborhood: string;
      needed_by: string;
    }) => {
      if (!user) throw new Error('Sign in to continue. It only takes a minute.');
      try {
        const created = await createItemWant({
          requester_id: user.id,
          ...input,
        });
        await loadWantsData();
        showToast('Request posted. Your neighbors can see it now.');
        return created;
      } catch (err) {
        logDebugError('createItemWant', err);
        throw new Error(mapSupabaseError(err));
      }
    },
    [loadWantsData, logDebugError, showToast, user]
  );

  const markWantFulfilled = useCallback(
    async (wantId: string, status: 'open' | 'fulfilled') => {
      const prevWants = wants;
      setWants((prev) => prev.map((w) => (w.id === wantId ? { ...w, status } : w)));
      try {
        await updateWantStatus(wantId, status);
        showToast(status === 'fulfilled' ? 'Marked as fulfilled.' : 'Request reopened.');
      } catch (err) {
        setWants(prevWants);
        logDebugError('updateWantStatus', err);
        showToast(mapSupabaseError(err), 'error');
      }
    },
    [logDebugError, showToast, wants]
  );

  const removeWant = useCallback(
    async (wantId: string) => {
      const prevWants = wants;
      setWants((prev) => prev.filter((w) => w.id !== wantId));
      try {
        await deleteItemWant(wantId);
        showToast('Item removed.');
      } catch (err) {
        setWants(prevWants);
        logDebugError('deleteItemWant', err);
        showToast(mapSupabaseError(err), 'error');
      }
    },
    [logDebugError, showToast, wants]
  );

  const respondToWant = useCallback(
    async (wantId: string, message: string, requesterName?: string) => {
      if (!user) throw new Error('Sign in to continue. It only takes a minute.');
      try {
        await createWantResponse({
          want_id: wantId,
          responder_id: user.id,
          message,
        });
        await loadWantsData();
        const firstName = getFirstName(requesterName);
        showToast(`Response sent. ${firstName} will be notified.`);
      } catch (err) {
        logDebugError('createWantResponse', err);
        throw new Error(mapSupabaseError(err));
      }
    },
    [loadWantsData, logDebugError, showToast, user]
  );

  const readNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      try {
        await markNotificationRead(id);
      } catch (err) {
        logDebugError('markNotificationRead', err);
      }
    },
    [logDebugError]
  );

  const readAllNotifications = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead(user.id);
    } catch (err) {
      logDebugError('markAllNotificationsRead', err);
    }
  }, [logDebugError, user]);

  const actionCount = useMemo(() => {
    if (!user) return 0;
    return requests.filter((r) => {
      if (r.owner_id === user.id && (r.status === 'pending' || r.status === 'return_requested')) {
        return true;
      }
      if (r.borrower_id === user.id && (r.status === 'approved' || r.status === 'active')) {
        return true;
      }
      return false;
    }).length;
  }, [requests, user]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  return (
    <ShareShelfDataContext.Provider
      value={{
        items,
        busyDates,
        requests,
        wants,
        notifications,
        impact,
        loadingItems,
        loadingRequests,
        loadingWants,
        loadingImpact,
        schemaMissing,
        loopBurstOpen,
        actionCount,
        unreadNotificationsCount,
        refreshAll,
        refreshImpact,
        addItem,
        editItem,
        removeItem,
        toggleItemAvailability,
        submitBorrowRequest,
        changeRequestStatus,
        addWant,
        markWantFulfilled,
        removeWant,
        respondToWant,
        readNotification,
        readAllNotifications,
      }}
    >
      {children}
    </ShareShelfDataContext.Provider>
  );
}

export function useShareShelfData(): ShareShelfDataContextValue {
  const ctx = useContext(ShareShelfDataContext);
  if (!ctx) {
    throw new Error('useShareShelfData must be used within a ShareShelfDataProvider');
  }
  return ctx;
}
