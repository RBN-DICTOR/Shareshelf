import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  buildThreadKey,
  fetchChatMessages,
  markChatThreadRead,
  sendChatMessage,
  subscribeBrowserChat,
} from '../lib/chatApi';
import { mapSupabaseError } from '../lib/format';
import { getLocalAuthToken } from '../lib/localApi';
import { getSupabaseClient } from '../lib/supabase';
import type { ChatMessage, ChatThread, Item, Profile } from '../types';
import { useAuth } from './useAuth';
import { useShareShelfData } from './useShareShelfData';
import { useToast } from './useToast';

export interface ChatTarget {
  recipient: Profile;
  item?: Pick<Item, 'id' | 'name' | 'image_url' | 'category' | 'neighborhood'> | null;
  requestId?: string | null;
}

interface ActiveConversation {
  threadKey: string;
  recipient: Profile;
  item: Pick<Item, 'id' | 'name' | 'image_url' | 'category' | 'neighborhood'> | null;
  requestId: string | null;
}

interface ChatContextValue {
  threads: ChatThread[];
  unreadMessagesCount: number;
  loadingChat: boolean;
  drawerOpen: boolean;
  activeConversation: ActiveConversation | null;
  openInbox: () => void;
  openChatWith: (target: ChatTarget) => void;
  selectThread: (thread: ChatThread) => void;
  clearActiveConversation: () => void;
  closeChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  supabaseReady,
}: {
  children: React.ReactNode;
  supabaseReady: boolean;
}) {
  const { user, profile, openAuthModal } = useAuth();
  const { items, requests } = useShareShelfData();
  const { showToast, logDebugError } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<'supabase' | 'local' | 'browser'>(
    supabaseReady ? 'supabase' : 'local'
  );
  const [loadingChat, setLoadingChat] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const prevUserIdRef = React.useRef<string | null>(user?.id ?? null);

  // Clear stale conversation from a previous account whenever the signed-in user changes
  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (prevUserIdRef.current !== nextUserId) {
      prevUserIdRef.current = nextUserId;
      setActiveConversation(null);
      setDrawerOpen(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setLoadingChat(false);
      return;
    }
    setLoadingChat(true);
    try {
      const res = await fetchChatMessages(user.id);
      setMessages(Array.isArray(res.messages) ? res.messages : []);
      setChatMode(res.mode);
    } catch (err) {
      logDebugError('fetchChatMessages', err);
    } finally {
      setLoadingChat(false);
    }
  }, [logDebugError, user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time listeners for Supabase Realtime, Express SSE, and cross-tab BroadcastChannel
  useEffect(() => {
    if (!user) return;

    const unsubBrowser = subscribeBrowserChat(() => {
      loadMessages();
    });

    if (!supabaseReady) {
      const token = getLocalAuthToken();
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
      const source = new EventSource(url);
      source.addEventListener('borrow_messages', () => {
        loadMessages();
      });
      return () => {
        unsubBrowser();
        source.close();
      };
    }

    const sb = getSupabaseClient();
    if (!sb) {
      return () => unsubBrowser();
    }

    const channel = sb
      .channel(`shareshelf-chat-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrow_messages' },
        (payload) => {
          const row = (payload.new || payload.old) as Partial<ChatMessage> | undefined;
          if (!row) {
            loadMessages();
            return;
          }
          if (row.sender_id === user.id || row.recipient_id === user.id) {
            loadMessages();
          }
        }
      )
      .subscribe();

    return () => {
      unsubBrowser();
      sb.removeChannel(channel);
    };
  }, [loadMessages, supabaseReady, user]);

  // Build lookups from items & requests so profiles/items are always richly populated
  const profileLookup = useMemo(() => {
    const map = new Map<string, Profile>();
    if (profile) map.set(profile.id, profile);
    items.forEach((it) => {
      if (it.owner) map.set(it.owner.id, it.owner);
    });
    requests.forEach((r) => {
      if (r.owner) map.set(r.owner.id, r.owner);
      if (r.borrower) map.set(r.borrower.id, r.borrower);
    });
    return map;
  }, [items, profile, requests]);

  const itemLookup = useMemo(() => {
    const map = new Map<string, Pick<Item, 'id' | 'name' | 'image_url' | 'category' | 'neighborhood'>>();
    items.forEach((it) => {
      map.set(it.id, {
        id: it.id,
        name: it.name,
        image_url: it.image_url,
        category: it.category,
        neighborhood: it.neighborhood,
      });
    });
    return map;
  }, [items]);

  const threads = useMemo<ChatThread[]>(() => {
    if (!user) return [];
    const grouped = new Map<string, ChatMessage[]>();

    for (const msg of messages) {
      const list = grouped.get(msg.thread_key) || [];
      list.push(msg);
      grouped.set(msg.thread_key, list);
    }

    const result: ChatThread[] = [];
    for (const [threadKey, msgs] of grouped.entries()) {
      const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const latest = sorted[sorted.length - 1];
      const partnerMsg =
        sorted.find((m) => m.sender_id !== user.id || m.recipient_id !== user.id) || latest;
      const otherId =
        partnerMsg.sender_id === user.id ? partnerMsg.recipient_id : partnerMsg.sender_id;

      const rawOther =
        partnerMsg.sender_id === user.id ? partnerMsg.recipient : partnerMsg.sender;
      const otherUser: Profile = (rawOther && rawOther.id !== user.id ? rawOther : null) ||
        profileLookup.get(otherId) || {
          id: otherId,
          full_name: 'Neighbor',
          neighborhood: null,
        };

      const linkedItem =
        latest.item || (latest.item_id ? itemLookup.get(latest.item_id) ?? null : null);

      const unreadCount = sorted.filter(
        (m) => m.recipient_id === user.id && !m.is_read
      ).length;

      result.push({
        threadKey,
        itemId: latest.item_id ?? null,
        requestId: sorted.find((m) => m.request_id)?.request_id ?? null,
        itemName: linkedItem?.name ?? null,
        itemImageUrl: linkedItem?.image_url ?? null,
        itemCategory: linkedItem?.category ?? null,
        otherUser,
        lastMessage: latest.message,
        lastMessageAt: latest.created_at,
        unreadCount,
        messages: sorted,
      });
    }

    return result.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [itemLookup, messages, profileLookup, user]);

  const unreadMessagesCount = useMemo(
    () => threads.reduce((acc, t) => acc + t.unreadCount, 0),
    [threads]
  );

  const markRead = useCallback(
    async (threadKey: string) => {
      if (!user) return;
      const hasUnread = messages.some(
        (m) => m.thread_key === threadKey && m.recipient_id === user.id && !m.is_read
      );
      if (!hasUnread) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.thread_key === threadKey && m.recipient_id === user.id
            ? { ...m, is_read: true }
            : m
        )
      );
      try {
        await markChatThreadRead(threadKey, user.id, chatMode);
      } catch (err) {
        logDebugError('markChatThreadRead', err);
      }
    },
    [chatMode, logDebugError, messages, user]
  );

  const openInbox = useCallback(() => {
    if (!user) {
      openAuthModal('Sign in to message neighbors about items.', () => {
        setDrawerOpen(true);
      });
      return;
    }
    if (activeConversation && activeConversation.recipient.id === user.id) {
      setActiveConversation(null);
    }
    setDrawerOpen(true);
  }, [activeConversation, openAuthModal, user]);

  // Safety guard: if activeConversation ever points to self after account switch, flip or clear it
  useEffect(() => {
    if (!user || !activeConversation) return;
    if (activeConversation.recipient.id !== user.id) return;
    const matching = threads.find((t) => t.threadKey === activeConversation.threadKey);
    if (matching && matching.otherUser.id !== user.id) {
      setActiveConversation((prev) =>
        prev ? { ...prev, recipient: matching.otherUser } : null
      );
    } else {
      setActiveConversation(null);
    }
  }, [activeConversation, threads, user]);

  const pendingTargetRef = React.useRef<ChatTarget | null>(null);

  useEffect(() => {
    if (!user || !pendingTargetRef.current) return;
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    if (target.recipient.id === user.id) {
      showToast('That is your own item.', 'info');
      return;
    }
    const threadKey = buildThreadKey(target.item?.id ?? null, user.id, target.recipient.id);
    setActiveConversation({
      threadKey,
      recipient: target.recipient,
      item: target.item ?? null,
      requestId: target.requestId ?? null,
    });
    setDrawerOpen(true);
  }, [showToast, user]);

  const openChatWith = useCallback(
    (target: ChatTarget) => {
      if (!user) {
        pendingTargetRef.current = target;
        openAuthModal('Sign in to message your neighbor.');
        return;
      }

      if (target.recipient.id === user.id) {
        showToast('That is your own item.', 'info');
        return;
      }

      const threadKey = buildThreadKey(target.item?.id ?? null, user.id, target.recipient.id);
      setActiveConversation({
        threadKey,
        recipient: target.recipient,
        item: target.item ?? null,
        requestId: target.requestId ?? null,
      });
      setDrawerOpen(true);
      void markRead(threadKey);
    },
    [markRead, openAuthModal, showToast, user]
  );

  const selectThread = useCallback(
    (thread: ChatThread) => {
      const item = thread.itemId
        ? itemLookup.get(thread.itemId) || {
            id: thread.itemId,
            name: thread.itemName || 'Shared item',
            image_url: thread.itemImageUrl,
            category: (thread.itemCategory as Item['category']) || 'Other',
            neighborhood: thread.otherUser.neighborhood || '',
          }
        : null;

      setActiveConversation({
        threadKey: thread.threadKey,
        recipient: thread.otherUser,
        item,
        requestId: thread.requestId,
      });
      void markRead(thread.threadKey);
    },
    [itemLookup, markRead]
  );

  const clearActiveConversation = useCallback(() => {
    setActiveConversation(null);
  }, []);

  const closeChat = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !activeConversation) return;
      const matchingThread = threads.find((t) => t.threadKey === activeConversation.threadKey);
      const targetRecipient =
        activeConversation.recipient.id !== user.id
          ? activeConversation.recipient
          : matchingThread && matchingThread.otherUser.id !== user.id
            ? matchingThread.otherUser
            : activeConversation.recipient;

      try {
        const { message: created, mode } = await sendChatMessage({
          senderId: user.id,
          senderProfile: profile || {
            id: user.id,
            full_name:
              (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Neighbor',
            neighborhood: null,
          },
          recipientId: targetRecipient.id,
          recipientProfile: targetRecipient,
          item: activeConversation.item,
          requestId: activeConversation.requestId,
          message: text,
        });
        setChatMode(mode);
        setMessages((prev) => {
          if (prev.some((m) => m.id === created.id)) return prev;
          return [...prev, created];
        });
      } catch (err) {
        logDebugError('sendChatMessage', err);
        const msg = mapSupabaseError(err);
        showToast(msg, 'error');
        throw new Error(msg);
      }
    },
    [activeConversation, logDebugError, profile, showToast, threads, user]
  );

  return (
    <ChatContext.Provider
      value={{
        threads,
        unreadMessagesCount,
        loadingChat,
        drawerOpen,
        activeConversation,
        openInbox,
        openChatWith,
        selectThread,
        clearActiveConversation,
        closeChat,
        sendMessage,
        refreshMessages: loadMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
