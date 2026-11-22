import type { Response } from 'express';

export type ShareShelfEventType =
  | 'items'
  | 'borrow_requests'
  | 'item_wants'
  | 'want_responses'
  | 'notifications';

interface SseClient {
  id: string;
  userId: string | null;
  res: Response;
}

const clients = new Map<string, SseClient>();

export function addSseClient(id: string, userId: string | null, res: Response): void {
  clients.set(id, { id, userId, res });
}

export function removeSseClient(id: string): void {
  clients.delete(id);
}

export function broadcastEvent(
  eventType: ShareShelfEventType,
  payload: Record<string, unknown> = {},
  targetUserId?: string
): void {
  const data = JSON.stringify({ type: eventType, ...payload });
  for (const client of clients.values()) {
    if (targetUserId && client.userId !== targetUserId) {
      continue;
    }
    try {
      client.res.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch {
      clients.delete(client.id);
    }
  }
}
