import type {
  BorrowRequest,
  BorrowRequestStatus,
  CommunityImpact,
  Item,
  ItemBusyDate,
  ItemWant,
  NotificationItem,
  Profile,
  WantResponse,
} from '../types';
import type { ItemInput } from './api';

// Held strictly in JS memory (never localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setLocalAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getLocalAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export interface LocalAuthResponse {
  token: string;
  user: { id: string; email: string };
  profile: Profile;
}

export async function localSignIn(email: string, password: string): Promise<LocalAuthResponse> {
  const res = await apiRequest<LocalAuthResponse>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setLocalAuthToken(res.token);
  return res;
}

export async function localSignUp(input: {
  full_name: string;
  neighborhood: string;
  email: string;
  password: string;
}): Promise<LocalAuthResponse> {
  const res = await apiRequest<LocalAuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setLocalAuthToken(res.token);
  return res;
}

export async function localSignInDemo(role: 'alex' | 'jordan'): Promise<LocalAuthResponse> {
  const res = await apiRequest<LocalAuthResponse>('/auth/demo', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  setLocalAuthToken(res.token);
  return res;
}

export async function localFetchMe(): Promise<{
  user: { id: string; email: string };
  profile: Profile;
}> {
  return apiRequest('/auth/me');
}

export function localSignOut(): void {
  setLocalAuthToken(null);
}

export async function localUploadImage(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

  const res = await apiRequest<{ url: string }>('/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      dataBase64,
    }),
  });
  return res.url;
}

export async function localFetchItems(): Promise<Item[]> {
  return apiRequest<Item[]>('/items');
}

export async function localFetchItemById(id: string): Promise<Item | null> {
  try {
    return await apiRequest<Item>(`/items/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function localCreateItem(input: Omit<ItemInput, 'owner_id'>): Promise<Item> {
  return apiRequest<Item>('/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function localUpdateItem(
  itemId: string,
  input: Partial<Omit<ItemInput, 'owner_id'>>
): Promise<Item> {
  return apiRequest<Item>(`/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function localDeleteItem(itemId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

export async function localFetchBusyDates(itemId?: string): Promise<ItemBusyDate[]> {
  const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
  return apiRequest<ItemBusyDate[]>(`/busy-dates${query}`);
}

export async function localFetchBorrowRequests(): Promise<BorrowRequest[]> {
  return apiRequest<BorrowRequest[]>('/requests');
}

export async function localCreateBorrowRequest(input: {
  item_id: string;
  start_date: string;
  end_date: string;
  message?: string;
}): Promise<BorrowRequest> {
  return apiRequest<BorrowRequest>('/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function localUpdateBorrowRequestStatus(
  requestId: string,
  status: BorrowRequestStatus
): Promise<BorrowRequest> {
  return apiRequest<BorrowRequest>(`/requests/${encodeURIComponent(requestId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function localFetchItemWants(): Promise<ItemWant[]> {
  return apiRequest<ItemWant[]>('/wants');
}

export async function localCreateItemWant(input: {
  title: string;
  description?: string;
  category: string;
  neighborhood: string;
  needed_by: string;
}): Promise<ItemWant> {
  return apiRequest<ItemWant>('/wants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function localUpdateWantStatus(
  wantId: string,
  status: 'open' | 'fulfilled'
): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/wants/${encodeURIComponent(wantId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function localDeleteItemWant(wantId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/wants/${encodeURIComponent(wantId)}`, {
    method: 'DELETE',
  });
}

export async function localCreateWantResponse(
  wantId: string,
  message: string
): Promise<WantResponse> {
  return apiRequest<WantResponse>(`/wants/${encodeURIComponent(wantId)}/responses`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function localFetchNotifications(): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>('/notifications');
}

export async function localMarkNotificationRead(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export async function localMarkAllNotificationsRead(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/notifications/read-all', {
    method: 'PATCH',
  });
}

export async function localFetchCommunityImpact(): Promise<CommunityImpact> {
  return apiRequest<CommunityImpact>('/impact');
}
