import type { ChatMessage, Item, Profile } from '../types';
import { cleanText } from './format';
import {
  localFetchChatMessages,
  localMarkThreadRead,
  localSendChatMessage,
} from './localApi';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

const LOCAL_CHAT_STORAGE_KEY = 'shareshelf_chat_messages_v1';
const CHAT_CHANNEL_NAME = 'shareshelf_chat_v1';

let broadcastChannel: BroadcastChannel | null = null;
function getChatBroadcast(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHAT_CHANNEL_NAME);
  }
  return broadcastChannel;
}

export function buildThreadKey(itemId: string | null | undefined, userA: string, userB: string): string {
  const [p1, p2] = [userA, userB].sort();
  return `${itemId || 'direct'}::${p1}::${p2}`;
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code || '';
  const msg = ((err as { message?: string }).message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function readBrowserStoredMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeBrowserStoredMessages(messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-200)));
  } catch {
    // ignore quota errors
  }
}

export interface ChatFetchResult {
  messages: ChatMessage[];
  mode: 'supabase' | 'local' | 'browser';
}

export async function fetchChatMessages(userId: string): Promise<ChatFetchResult> {
  if (!isSupabaseConfigured()) {
    const messages = await localFetchChatMessages();
    return { messages: Array.isArray(messages) ? messages : [], mode: 'local' };
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return { messages: [], mode: 'browser' };
  }

  const { data, error } = await sb
    .from('borrow_messages')
    .select(
      'id, thread_key, item_id, request_id, sender_id, recipient_id, message, is_read, created_at, sender:profiles!sender_id(id, full_name, neighborhood), recipient:profiles!recipient_id(id, full_name, neighborhood), item:items!item_id(id, name, image_url, category, neighborhood)'
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      const localMsgs = readBrowserStoredMessages().filter(
        (m) => m.sender_id === userId || m.recipient_id === userId
      );
      return { messages: localMsgs, mode: 'browser' };
    }
    throw error;
  }

  const mapped = (data || []).map((row) => ({
    ...row,
    sender: Array.isArray(row.sender) ? (row.sender[0] ?? null) : (row.sender ?? null),
    recipient: Array.isArray(row.recipient) ? (row.recipient[0] ?? null) : (row.recipient ?? null),
    item: Array.isArray(row.item) ? (row.item[0] ?? null) : (row.item ?? null),
  })) as ChatMessage[];

  return { messages: mapped, mode: 'supabase' };
}

export async function sendChatMessage(input: {
  senderId: string;
  senderProfile?: Profile | null;
  recipientId: string;
  recipientProfile?: Profile | null;
  item?: Pick<Item, 'id' | 'name' | 'image_url' | 'category' | 'neighborhood'> | null;
  requestId?: string | null;
  message: string;
}): Promise<{ message: ChatMessage; mode: 'supabase' | 'local' | 'browser' }> {
  const cleaned = cleanText(input.message).slice(0, 1000);
  if (!cleaned) {
    throw new Error('Please write a message before sending.');
  }
  if (input.senderId === input.recipientId) {
    throw new Error('You cannot send a message to yourself.');
  }

  if (!isSupabaseConfigured()) {
    const saved = await localSendChatMessage({
      recipient_id: input.recipientId,
      item_id: input.item?.id ?? null,
      request_id: input.requestId ?? null,
      message: cleaned,
    });
    return { message: saved, mode: 'local' };
  }

  const threadKey = buildThreadKey(input.item?.id ?? null, input.senderId, input.recipientId);
  const sb = getSupabaseClient();

  if (sb) {
    const { data, error } = await sb
      .from('borrow_messages')
      .insert({
        thread_key: threadKey,
        item_id: input.item?.id ?? null,
        request_id: input.requestId ?? null,
        sender_id: input.senderId,
        recipient_id: input.recipientId,
        message: cleaned,
      })
      .select(
        'id, thread_key, item_id, request_id, sender_id, recipient_id, message, is_read, created_at, sender:profiles!sender_id(id, full_name, neighborhood), recipient:profiles!recipient_id(id, full_name, neighborhood), item:items!item_id(id, name, image_url, category, neighborhood)'
      )
      .single();

    if (!error && data) {
      const mapped = {
        ...data,
        sender: Array.isArray(data.sender) ? (data.sender[0] ?? null) : (data.sender ?? null),
        recipient: Array.isArray(data.recipient)
          ? (data.recipient[0] ?? null)
          : (data.recipient ?? null),
        item: Array.isArray(data.item) ? (data.item[0] ?? null) : (data.item ?? null),
      } as ChatMessage;
      return { message: mapped, mode: 'supabase' };
    }

    if (error && !isMissingTableError(error)) {
      throw error;
    }
  }

  // Fallback to cross-tab synchronized browser storage if borrow_messages table isn't created yet
  const created: ChatMessage = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    thread_key: threadKey,
    item_id: input.item?.id ?? null,
    request_id: input.requestId ?? null,
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    message: cleaned,
    is_read: false,
    created_at: new Date().toISOString(),
    sender: input.senderProfile ?? {
      id: input.senderId,
      full_name: 'You',
      neighborhood: null,
    },
    recipient: input.recipientProfile ?? {
      id: input.recipientId,
      full_name: 'Neighbor',
      neighborhood: null,
    },
    item: input.item ?? null,
  };

  const all = readBrowserStoredMessages();
  all.push(created);
  writeBrowserStoredMessages(all);
  getChatBroadcast()?.postMessage({ type: 'new_message', message: created });
  return { message: created, mode: 'browser' };
}

export async function markChatThreadRead(
  threadKey: string,
  userId: string,
  mode: 'supabase' | 'local' | 'browser'
): Promise<void> {
  if (!threadKey || !userId) return;

  if (mode === 'local') {
    await localMarkThreadRead(threadKey);
    return;
  }

  if (mode === 'supabase') {
    const sb = getSupabaseClient();
    if (!sb) return;
    const { error } = await sb
      .from('borrow_messages')
      .update({ is_read: true })
      .eq('thread_key', threadKey)
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error && !isMissingTableError(error)) {
      throw error;
    }
    if (!error) return;
  }

  const all = readBrowserStoredMessages();
  let changed = false;
  const updated = all.map((m) => {
    if (m.thread_key === threadKey && m.recipient_id === userId && !m.is_read) {
      changed = true;
      return { ...m, is_read: true };
    }
    return m;
  });
  if (changed) {
    writeBrowserStoredMessages(updated);
    getChatBroadcast()?.postMessage({ type: 'thread_read', threadKey, userId });
  }
}

export function subscribeBrowserChat(
  onUpdate: () => void
): () => void {
  const bc = getChatBroadcast();
  const handleBc = () => onUpdate();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_CHAT_STORAGE_KEY) {
      onUpdate();
    }
  };
  bc?.addEventListener('message', handleBc);
  window.addEventListener('storage', handleStorage);
  return () => {
    bc?.removeEventListener('message', handleBc);
    window.removeEventListener('storage', handleStorage);
  };
}
