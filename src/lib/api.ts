import type {
  BorrowRequest,
  BorrowRequestStatus,
  CommunityImpact,
  Item,
  ItemBusyDate,
  ItemCategory,
  ItemCondition,
  ItemWant,
  NotificationItem,
  Profile,
  WantResponse,
} from '../types';
import { cleanText } from './format';
import { fileToOptimizedImageDataUrl } from './itemImages';
import {
  localCreateBorrowRequest,
  localCreateItem,
  localCreateItemWant,
  localCreateWantResponse,
  localDeleteItem,
  localDeleteItemWant,
  localFetchBorrowRequests,
  localFetchBusyDates,
  localFetchCommunityImpact,
  localFetchItemById,
  localFetchItems,
  localFetchItemWants,
  localFetchNotifications,
  localMarkAllNotificationsRead,
  localMarkNotificationRead,
  localUpdateBorrowRequestStatus,
  localUpdateItem,
  localUpdateWantStatus,
  localUploadImage,
} from './localApi';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

function requireSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not connected yet.');
  }
  return client;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, neighborhood, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  payload: { full_name?: string; neighborhood?: string }
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update({
      ...(payload.full_name !== undefined ? { full_name: cleanText(payload.full_name) } : {}),
      ...(payload.neighborhood !== undefined
        ? { neighborhood: cleanText(payload.neighborhood) }
        : {}),
    })
    .eq('id', userId)
    .select('id, full_name, neighborhood, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchItems(): Promise<Item[]> {
  if (!isSupabaseConfigured()) {
    return localFetchItems();
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('items')
    .select(
      'id, owner_id, name, description, category, condition, image_url, neighborhood, is_available, rules, replacement_value, is_demo, created_at, owner:profiles!owner_id(id, full_name, neighborhood)'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    replacement_value: Number(row.replacement_value) || 0,
    owner: Array.isArray(row.owner) ? row.owner[0] ?? null : row.owner ?? null,
  })) as Item[];
}

export async function fetchItemById(id: string): Promise<Item | null> {
  if (!isSupabaseConfigured()) {
    return localFetchItemById(id);
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('items')
    .select(
      'id, owner_id, name, description, category, condition, image_url, neighborhood, is_available, rules, replacement_value, is_demo, created_at, owner:profiles!owner_id(id, full_name, neighborhood)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    replacement_value: Number(data.replacement_value) || 0,
    owner: Array.isArray(data.owner) ? data.owner[0] ?? null : data.owner ?? null,
  } as Item;
}

export interface ItemInput {
  owner_id: string;
  name: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
  image_url: string | null;
  neighborhood: string;
  is_available: boolean;
  rules: string;
  replacement_value: number;
}

export async function createItem(input: ItemInput): Promise<Item> {
  if (!isSupabaseConfigured()) {
    return localCreateItem(input);
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('items')
    .insert({
      owner_id: input.owner_id,
      name: cleanText(input.name),
      description: cleanText(input.description),
      category: input.category,
      condition: input.condition,
      image_url: input.image_url ? input.image_url.trim() : null,
      neighborhood: cleanText(input.neighborhood),
      is_available: input.is_available,
      rules:
        cleanText(input.rules) ||
        'Please return it on time and in the condition you received it.',
      replacement_value: Math.max(0, Number(input.replacement_value) || 0),
    })
    .select(
      'id, owner_id, name, description, category, condition, image_url, neighborhood, is_available, rules, replacement_value, is_demo, created_at, owner:profiles!owner_id(id, full_name, neighborhood)'
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    replacement_value: Number(data.replacement_value) || 0,
    owner: Array.isArray(data.owner) ? data.owner[0] ?? null : data.owner ?? null,
  } as Item;
}

export async function updateItem(
  itemId: string,
  input: Partial<Omit<ItemInput, 'owner_id'>>
): Promise<Item> {
  if (!isSupabaseConfigured()) {
    return localUpdateItem(itemId, input);
  }
  const sb = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = cleanText(input.name);
  if (input.description !== undefined) payload.description = cleanText(input.description);
  if (input.category !== undefined) payload.category = input.category;
  if (input.condition !== undefined) payload.condition = input.condition;
  if (input.image_url !== undefined) payload.image_url = input.image_url ? input.image_url.trim() : null;
  if (input.neighborhood !== undefined) payload.neighborhood = cleanText(input.neighborhood);
  if (input.is_available !== undefined) payload.is_available = input.is_available;
  if (input.rules !== undefined) payload.rules = cleanText(input.rules);
  if (input.replacement_value !== undefined)
    payload.replacement_value = Math.max(0, Number(input.replacement_value) || 0);

  const { data, error } = await sb
    .from('items')
    .update(payload)
    .eq('id', itemId)
    .select(
      'id, owner_id, name, description, category, condition, image_url, neighborhood, is_available, rules, replacement_value, is_demo, created_at, owner:profiles!owner_id(id, full_name, neighborhood)'
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    replacement_value: Number(data.replacement_value) || 0,
    owner: Array.isArray(data.owner) ? data.owner[0] ?? null : data.owner ?? null,
  } as Item;
}

export async function deleteItem(itemId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return localDeleteItem(itemId);
  }
  const sb = requireSupabase();
  const { data: activeLoans, error: checkErr } = await sb
    .from('item_busy_dates')
    .select('item_id, status')
    .eq('item_id', itemId);

  if (checkErr) throw checkErr;
  if (activeLoans && activeLoans.length > 0) {
    throw new Error(
      'This item cannot be removed while a loan is approved, active, or waiting for return confirmation.'
    );
  }

  const { error } = await sb.from('items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function uploadItemImage(file: File, userId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    return localUploadImage(file);
  }
  const sb = requireSupabase();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'png';
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const { error: uploadErr } = await sb.storage
    .from('item-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (!uploadErr) {
    const { data } = sb.storage.from('item-images').getPublicUrl(filePath);
    return data.publicUrl;
  }

  // Fallback when Supabase Storage bucket is not provisioned: store optimized PNG/image data directly
  return fileToOptimizedImageDataUrl(file);
}

export async function fetchBusyDates(itemId?: string): Promise<ItemBusyDate[]> {
  if (!isSupabaseConfigured()) {
    return localFetchBusyDates(itemId);
  }
  const sb = requireSupabase();
  let query = sb
    .from('item_busy_dates')
    .select('item_id, start_date, end_date, status')
    .order('start_date', { ascending: true });

  if (itemId) {
    query = query.eq('item_id', itemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ItemBusyDate[];
}

export async function fetchBorrowRequestsForUser(userId: string): Promise<BorrowRequest[]> {
  if (!isSupabaseConfigured()) {
    return localFetchBorrowRequests();
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('borrow_requests')
    .select(
      'id, item_id, borrower_id, owner_id, start_date, end_date, message, status, is_demo, created_at, updated_at, item:items!item_id(id, owner_id, name, description, category, condition, image_url, neighborhood, is_available, rules, replacement_value, is_demo, created_at), borrower:profiles!borrower_id(id, full_name, neighborhood), owner:profiles!owner_id(id, full_name, neighborhood)'
    )
    .or(`borrower_id.eq.${userId},owner_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    item: Array.isArray(row.item) ? row.item[0] ?? null : row.item ?? null,
    borrower: Array.isArray(row.borrower) ? row.borrower[0] ?? null : row.borrower ?? null,
    owner: Array.isArray(row.owner) ? row.owner[0] ?? null : row.owner ?? null,
  })) as BorrowRequest[];
}

export async function createBorrowRequest(input: {
  item_id: string;
  borrower_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  message?: string;
}): Promise<BorrowRequest> {
  if (!isSupabaseConfigured()) {
    return localCreateBorrowRequest({
      item_id: input.item_id,
      start_date: input.start_date,
      end_date: input.end_date,
      message: input.message,
    });
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('borrow_requests')
    .insert({
      item_id: input.item_id,
      borrower_id: input.borrower_id,
      owner_id: input.owner_id,
      start_date: input.start_date,
      end_date: input.end_date,
      message: input.message ? cleanText(input.message).slice(0, 300) : null,
      status: 'pending',
    })
    .select(
      'id, item_id, borrower_id, owner_id, start_date, end_date, message, status, is_demo, created_at, updated_at'
    )
    .single();

  if (error) throw error;
  return data as BorrowRequest;
}

export async function updateBorrowRequestStatus(
  requestId: string,
  status: BorrowRequestStatus
): Promise<BorrowRequest> {
  if (!isSupabaseConfigured()) {
    return localUpdateBorrowRequestStatus(requestId, status);
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('borrow_requests')
    .update({ status })
    .eq('id', requestId)
    .select(
      'id, item_id, borrower_id, owner_id, start_date, end_date, message, status, is_demo, created_at, updated_at'
    )
    .single();

  if (error) throw error;
  return data as BorrowRequest;
}

export async function fetchItemWants(): Promise<ItemWant[]> {
  if (!isSupabaseConfigured()) {
    return localFetchItemWants();
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('item_wants')
    .select(
      'id, requester_id, title, description, category, neighborhood, needed_by, status, is_demo, created_at, requester:profiles!requester_id(id, full_name, neighborhood), want_responses(id, want_id, responder_id, message, created_at, responder:profiles!responder_id(id, full_name, neighborhood))'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    requester: Array.isArray(row.requester) ? row.requester[0] ?? null : row.requester ?? null,
    want_responses: (row.want_responses || []).map((resp: Record<string, unknown>) => ({
      ...resp,
      responder: Array.isArray(resp.responder)
        ? (resp.responder[0] as Profile) ?? null
        : (resp.responder as Profile) ?? null,
    })) as WantResponse[],
  })) as ItemWant[];
}

export async function createItemWant(input: {
  requester_id: string;
  title: string;
  description?: string;
  category: string;
  neighborhood: string;
  needed_by: string;
}): Promise<ItemWant> {
  if (!isSupabaseConfigured()) {
    return localCreateItemWant(input);
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('item_wants')
    .insert({
      requester_id: input.requester_id,
      title: cleanText(input.title),
      description: input.description ? cleanText(input.description) : null,
      category: input.category,
      neighborhood: cleanText(input.neighborhood),
      needed_by: input.needed_by,
      status: 'open',
    })
    .select('id, requester_id, title, description, category, neighborhood, needed_by, status, is_demo, created_at')
    .single();

  if (error) throw error;
  return { ...data, want_responses: [] } as ItemWant;
}

export async function updateWantStatus(
  wantId: string,
  status: 'open' | 'fulfilled'
): Promise<void> {
  if (!isSupabaseConfigured()) {
    return localUpdateWantStatus(wantId, status);
  }
  const sb = requireSupabase();
  const { error } = await sb.from('item_wants').update({ status }).eq('id', wantId);
  if (error) throw error;
}

export async function deleteItemWant(wantId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return localDeleteItemWant(wantId);
  }
  const sb = requireSupabase();
  const { error } = await sb.from('item_wants').delete().eq('id', wantId);
  if (error) throw error;
}

export async function createWantResponse(input: {
  want_id: string;
  responder_id: string;
  message: string;
}): Promise<WantResponse> {
  if (!isSupabaseConfigured()) {
    return localCreateWantResponse(input.want_id, input.message);
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('want_responses')
    .insert({
      want_id: input.want_id,
      responder_id: input.responder_id,
      message: cleanText(input.message),
    })
    .select(
      'id, want_id, responder_id, message, created_at, responder:profiles!responder_id(id, full_name, neighborhood)'
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    responder: Array.isArray(data.responder) ? data.responder[0] ?? null : data.responder ?? null,
  } as WantResponse;
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured()) {
    return localFetchNotifications();
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select('id, user_id, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data || []) as NotificationItem[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return localMarkNotificationRead(notificationId);
  }
  const sb = requireSupabase();
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return localMarkAllNotificationsRead();
  }
  const sb = requireSupabase();
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function fetchCommunityImpact(): Promise<CommunityImpact> {
  if (!isSupabaseConfigured()) {
    return localFetchCommunityImpact();
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('community_impact')
    .select('items_listed, completed_exchanges, borrowed_now, money_saved, items_reused, demo_items')
    .single();

  if (error) throw error;
  return {
    items_listed: Number(data?.items_listed) || 0,
    completed_exchanges: Number(data?.completed_exchanges) || 0,
    borrowed_now: Number(data?.borrowed_now) || 0,
    money_saved: Number(data?.money_saved) || 0,
    items_reused: Number(data?.items_reused) || 0,
    demo_items: Number(data?.demo_items) || 0,
  };
}
