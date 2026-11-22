import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import {
  requireAuth,
  signAuthToken,
  verifyAuthToken,
  type AuthenticatedRequest,
} from './auth.ts';
import { db, hashPassword, verifyPassword } from './db.ts';
import { addSseClient, broadcastEvent, removeSseClient } from './events.ts';

const CATEGORIES = new Set([
  'Tools',
  'Electronics',
  'Education',
  'Household',
  'Outdoor',
  'Events',
  'Sports',
  'Other',
]);
const CONDITIONS = new Set(['Like new', 'Good', 'Fair']);
const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function cleanStr(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[<>]/g, '');
}

function isValidISODate(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function sanitizeImageUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) return trimmed;
  if (
    trimmed.length <= 1_500_000 &&
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)
  ) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapItemRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    description: row.description,
    category: row.category,
    condition: row.condition,
    image_url: row.image_url ?? null,
    neighborhood: row.neighborhood,
    is_available: Boolean(row.is_available),
    rules: row.rules ?? null,
    replacement_value: Number(row.replacement_value) || 0,
    is_demo: Boolean(row.is_demo),
    created_at: row.created_at,
    owner: row.owner_name
      ? {
          id: row.owner_id,
          full_name: row.owner_name,
          neighborhood: row.owner_neighborhood ?? null,
        }
      : null,
  };
}

function mapRequestRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    item_id: row.item_id,
    borrower_id: row.borrower_id,
    owner_id: row.owner_id,
    start_date: row.start_date,
    end_date: row.end_date,
    message: row.message ?? null,
    status: row.status,
    is_demo: Boolean(row.is_demo),
    created_at: row.created_at,
    updated_at: row.updated_at,
    item: row.item_name
      ? {
          id: row.item_id,
          owner_id: row.owner_id,
          name: row.item_name,
          description: row.item_description,
          category: row.item_category,
          condition: row.item_condition,
          image_url: row.item_image_url ?? null,
          neighborhood: row.item_neighborhood,
          is_available: Boolean(row.item_is_available),
          rules: row.item_rules ?? null,
          replacement_value: Number(row.item_replacement_value) || 0,
          is_demo: Boolean(row.item_is_demo),
          created_at: row.item_created_at,
        }
      : null,
    borrower: row.borrower_name
      ? {
          id: row.borrower_id,
          full_name: row.borrower_name,
          neighborhood: row.borrower_neighborhood ?? null,
        }
      : null,
    owner: row.owner_name
      ? {
          id: row.owner_id,
          full_name: row.owner_name,
          neighborhood: row.owner_neighborhood ?? null,
        }
      : null,
  };
}

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, backend: 'express-sqlite' });
});

// Server-Sent Events for real-time updates
apiRouter.get('/events', (req: Request, res: Response) => {
  const tokenParam = typeof req.query.token === 'string' ? req.query.token : '';
  const verifiedUser = tokenParam ? verifyAuthToken(tokenParam) : null;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = crypto.randomUUID();
  addSseClient(clientId, verifiedUser?.id ?? null, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      removeSseClient(clientId);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSseClient(clientId);
  });
});

// ============ AUTH ROUTES ============

apiRouter.post('/auth/signup', (req: Request, res: Response) => {
  const fullName = cleanStr(req.body?.full_name);
  const neighborhood = cleanStr(req.body?.neighborhood);
  const email = cleanStr(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }
  if (!neighborhood) {
    res.status(400).json({ error: 'Please enter your neighborhood.' });
    return;
  }
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password should be at least 6 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({
      error: 'An account with this email already exists. Try signing in instead.',
    });
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      email,
      passwordHash
    );
    db.prepare('INSERT INTO profiles (id, full_name, neighborhood) VALUES (?, ?, ?)').run(
      userId,
      fullName,
      neighborhood
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Could not create your account right now.' });
    return;
  }

  const profile = db
    .prepare('SELECT id, full_name, neighborhood, created_at FROM profiles WHERE id = ?')
    .get(userId);

  const token = signAuthToken({ id: userId, email });
  res.status(201).json({
    token,
    user: { id: userId, email },
    profile,
  });
});

apiRouter.post('/auth/signin', (req: Request, res: Response) => {
  const email = cleanStr(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Please enter your email and password.' });
    return;
  }

  const userRow = db
    .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .get(email) as { id: string; email: string; password_hash: string } | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({
      error: 'Email or password did not match. Double-check and try again.',
    });
    return;
  }

  const profile = db
    .prepare('SELECT id, full_name, neighborhood, created_at FROM profiles WHERE id = ?')
    .get(userRow.id);

  const token = signAuthToken({ id: userRow.id, email: userRow.email });
  res.json({
    token,
    user: { id: userRow.id, email: userRow.email },
    profile,
  });
});

apiRouter.post('/auth/demo', (req: Request, res: Response) => {
  const role = req.body?.role === 'jordan' ? 'jordan' : req.body?.role === 'alex' ? 'alex' : null;
  if (!role) {
    res.status(400).json({ error: 'Invalid demo role.' });
    return;
  }
  const email = role === 'alex' ? 'alex@shareshelf.demo' : 'jordan@shareshelf.demo';
  const userRow = db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .get(email) as { id: string; email: string } | undefined;

  if (!userRow) {
    res.status(404).json({ error: 'Demo account is not available.' });
    return;
  }

  const profile = db
    .prepare('SELECT id, full_name, neighborhood, created_at FROM profiles WHERE id = ?')
    .get(userRow.id);

  const token = signAuthToken({ id: userRow.id, email: userRow.email });
  res.json({
    token,
    user: { id: userRow.id, email: userRow.email },
    profile,
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const profile = db
    .prepare('SELECT id, full_name, neighborhood, created_at FROM profiles WHERE id = ?')
    .get(user.id);
  res.json({ user, profile });
});

// ============ IMAGE UPLOAD ============

apiRouter.post('/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.toLowerCase() : '';
  const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

  const ext = ALLOWED_IMAGE_MIME[mimeType];
  if (!ext) {
    res.status(400).json({ error: 'Please upload a JPG, PNG, WebP, or GIF image.' });
    return;
  }

  const cleanBase64 = dataBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch {
    res.status(400).json({ error: 'Invalid image payload.' });
    return;
  }

  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Please choose an image smaller than 5 MB.' });
    return;
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    res.status(400).json({ error: 'Invalid upload path.' });
    return;
  }

  fs.writeFileSync(targetPath, buffer);
  res.status(201).json({ url: `/uploads/${filename}` });
});

// ============ ITEMS ============

apiRouter.get('/items', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT i.*, p.full_name AS owner_name, p.neighborhood AS owner_neighborhood
       FROM items i
       LEFT JOIN profiles p ON p.id = i.owner_id
       ORDER BY i.created_at DESC`
    )
    .all() as Record<string, unknown>[];

  res.json(rows.map(mapItemRow));
});

apiRouter.get('/items/:id', (req: Request, res: Response) => {
  const row = db
    .prepare(
      `SELECT i.*, p.full_name AS owner_name, p.neighborhood AS owner_neighborhood
       FROM items i
       LEFT JOIN profiles p ON p.id = i.owner_id
       WHERE i.id = ?`
    )
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  res.json(mapItemRow(row));
});

apiRouter.post('/items', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ownerId = req.authUser!.id;
  const name = cleanStr(req.body?.name);
  const description = cleanStr(req.body?.description);
  const category = typeof req.body?.category === 'string' ? req.body.category : '';
  const condition = typeof req.body?.condition === 'string' ? req.body.condition : 'Good';
  const neighborhood = cleanStr(req.body?.neighborhood);
  const rules =
    cleanStr(req.body?.rules) ||
    'Please return it on time and in the condition you received it.';
  const isAvailable = req.body?.is_available === false ? 0 : 1;
  const replacementValue = Math.max(0, Number(req.body?.replacement_value) || 0);
  const imageUrl = sanitizeImageUrl(req.body?.image_url);

  if (!name) {
    res.status(400).json({ error: 'Give your item a short, clear name.' });
    return;
  }
  if (!description || description.length < 8) {
    res.status(400).json({ error: 'Add a short description (at least 8 characters).' });
    return;
  }
  if (!CATEGORIES.has(category)) {
    res.status(400).json({ error: 'Please select a valid category.' });
    return;
  }
  if (!CONDITIONS.has(condition)) {
    res.status(400).json({ error: 'Please select a valid condition.' });
    return;
  }
  if (!neighborhood) {
    res.status(400).json({ error: 'Enter the neighborhood for pickup.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO items (
      id, owner_id, name, description, category, condition,
      image_url, neighborhood, is_available, rules, replacement_value, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
    id,
    ownerId,
    name,
    description,
    category,
    condition,
    imageUrl,
    neighborhood,
    isAvailable,
    rules,
    replacementValue
  );

  const createdRow = db
    .prepare(
      `SELECT i.*, p.full_name AS owner_name, p.neighborhood AS owner_neighborhood
       FROM items i
       LEFT JOIN profiles p ON p.id = i.owner_id
       WHERE i.id = ?`
    )
    .get(id) as Record<string, unknown>;

  const item = mapItemRow(createdRow);
  broadcastEvent('items', { itemId: id });
  res.status(201).json(item);
});

apiRouter.patch('/items/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }
  if (existing.owner_id !== req.authUser!.id) {
    res.status(403).json({ error: 'You do not have permission to edit this item.' });
    return;
  }

  const name = req.body?.name !== undefined ? cleanStr(req.body.name) : (existing.name as string);
  const description =
    req.body?.description !== undefined
      ? cleanStr(req.body.description)
      : (existing.description as string);
  const category =
    req.body?.category !== undefined ? String(req.body.category) : (existing.category as string);
  const condition =
    req.body?.condition !== undefined ? String(req.body.condition) : (existing.condition as string);
  const neighborhood =
    req.body?.neighborhood !== undefined
      ? cleanStr(req.body.neighborhood)
      : (existing.neighborhood as string);
  const rules =
    req.body?.rules !== undefined
      ? cleanStr(req.body.rules) || 'Please return it on time and in the condition you received it.'
      : (existing.rules as string);
  const isAvailable =
    req.body?.is_available !== undefined
      ? req.body.is_available
        ? 1
        : 0
      : (existing.is_available as number);
  const replacementValue =
    req.body?.replacement_value !== undefined
      ? Math.max(0, Number(req.body.replacement_value) || 0)
      : Number(existing.replacement_value);
  const imageUrl =
    req.body?.image_url !== undefined
      ? sanitizeImageUrl(req.body.image_url)
      : (existing.image_url as string | null);

  if (!name || !description || !neighborhood || !CATEGORIES.has(category) || !CONDITIONS.has(condition)) {
    res.status(400).json({ error: 'Please complete all required item fields.' });
    return;
  }

  db.prepare(
    `UPDATE items
     SET name = ?, description = ?, category = ?, condition = ?,
         image_url = ?, neighborhood = ?, is_available = ?, rules = ?, replacement_value = ?
     WHERE id = ?`
  ).run(
    name,
    description,
    category,
    condition,
    imageUrl,
    neighborhood,
    isAvailable,
    rules,
    replacementValue,
    req.params.id
  );

  const updatedRow = db
    .prepare(
      `SELECT i.*, p.full_name AS owner_name, p.neighborhood AS owner_neighborhood
       FROM items i
       LEFT JOIN profiles p ON p.id = i.owner_id
       WHERE i.id = ?`
    )
    .get(req.params.id) as Record<string, unknown>;

  const item = mapItemRow(updatedRow);
  broadcastEvent('items', { itemId: req.params.id });
  res.json(item);
});

apiRouter.delete('/items/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT id, owner_id FROM items WHERE id = ?')
    .get(req.params.id) as { id: string; owner_id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }
  if (existing.owner_id !== req.authUser!.id) {
    res.status(403).json({ error: 'You do not have permission to remove this item.' });
    return;
  }

  const busy = db
    .prepare(
      `SELECT id FROM borrow_requests
       WHERE item_id = ? AND status IN ('approved','active','return_requested')
       LIMIT 1`
    )
    .get(req.params.id);

  if (busy) {
    res.status(409).json({
      error:
        'This item cannot be removed while a loan is approved, active, or waiting for return confirmation.',
    });
    return;
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  broadcastEvent('items', { itemId: req.params.id });
  res.json({ ok: true });
});

// ============ BUSY DATES ============

apiRouter.get('/busy-dates', (req: Request, res: Response) => {
  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : null;
  const rows = itemId
    ? db
        .prepare(
          `SELECT item_id, start_date, end_date, status
           FROM borrow_requests
           WHERE item_id = ? AND status IN ('approved','active','return_requested')
           ORDER BY start_date ASC`
        )
        .all(itemId)
    : db
        .prepare(
          `SELECT item_id, start_date, end_date, status
           FROM borrow_requests
           WHERE status IN ('approved','active','return_requested')
           ORDER BY start_date ASC`
        )
        .all();

  res.json(rows);
});

// ============ BORROW REQUESTS ============

apiRouter.get('/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(
      `SELECT r.*,
        i.name AS item_name, i.description AS item_description, i.category AS item_category,
        i.condition AS item_condition, i.image_url AS item_image_url, i.neighborhood AS item_neighborhood,
        i.is_available AS item_is_available, i.rules AS item_rules,
        i.replacement_value AS item_replacement_value, i.is_demo AS item_is_demo,
        i.created_at AS item_created_at,
        bp.full_name AS borrower_name, bp.neighborhood AS borrower_neighborhood,
        op.full_name AS owner_name, op.neighborhood AS owner_neighborhood
       FROM borrow_requests r
       JOIN items i ON i.id = r.item_id
       LEFT JOIN profiles bp ON bp.id = r.borrower_id
       LEFT JOIN profiles op ON op.id = r.owner_id
       WHERE r.borrower_id = ? OR r.owner_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(userId, userId) as Record<string, unknown>[];

  res.json(rows.map(mapRequestRow));
});

apiRouter.post('/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const borrowerId = req.authUser!.id;
  const itemId = typeof req.body?.item_id === 'string' ? req.body.item_id : '';
  const startDate = req.body?.start_date;
  const endDate = req.body?.end_date;
  const message = cleanStr(req.body?.message).slice(0, 300) || null;

  if (!itemId) {
    res.status(400).json({ error: 'Missing item reference.' });
    return;
  }
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    res.status(400).json({ error: 'Please select valid start and return dates.' });
    return;
  }
  const today = getTodayISO();
  if (startDate < today || endDate < today) {
    res.status(400).json({ error: 'Dates cannot be in the past.' });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: 'Return date cannot be before start date.' });
    return;
  }

  const item = db
    .prepare('SELECT id, owner_id, name, is_available FROM items WHERE id = ?')
    .get(itemId) as
    | { id: string; owner_id: string; name: string; is_available: number }
    | undefined;

  if (!item) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }
  if (item.owner_id === borrowerId) {
    res.status(400).json({ error: 'You cannot request to borrow your own item.' });
    return;
  }
  if (!item.is_available) {
    res.status(400).json({ error: 'This item is currently paused by its owner.' });
    return;
  }

  const overlap = db
    .prepare(
      `SELECT id FROM borrow_requests
       WHERE item_id = ?
         AND status IN ('approved','active','return_requested')
         AND start_date <= ?
         AND end_date >= ?
       LIMIT 1`
    )
    .get(itemId, endDate, startDate);

  if (overlap) {
    res.status(409).json({ error: 'Those dates are already reserved for this item.' });
    return;
  }

  const requestId = crypto.randomUUID();
  const notifId = crypto.randomUUID();
  const notifMsg = `New request to borrow ${item.name}`;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO borrow_requests (
        id, item_id, borrower_id, owner_id, start_date, end_date, message, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(requestId, itemId, borrowerId, item.owner_id, startDate, endDate, message);

    db.prepare(
      'INSERT INTO notifications (id, user_id, message, is_read) VALUES (?, ?, ?, 0)'
    ).run(notifId, item.owner_id, notifMsg);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Could not create borrow request.' });
    return;
  }

  const created = db
    .prepare('SELECT * FROM borrow_requests WHERE id = ?')
    .get(requestId) as Record<string, unknown>;
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId) as Record<
    string,
    unknown
  >;

  broadcastEvent('borrow_requests', { requestId });
  broadcastEvent(
    'notifications',
    {
      notification: {
        ...notif,
        is_read: Boolean(notif.is_read),
      },
    },
    item.owner_id
  );

  res.status(201).json({
    ...created,
    is_demo: Boolean(created.is_demo),
  });
});

apiRouter.patch(
  '/requests/:id/status',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';

    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db
        .prepare(
          `SELECT r.*, i.name AS item_name
           FROM borrow_requests r
           JOIN items i ON i.id = r.item_id
           WHERE r.id = ?`
        )
        .get(req.params.id) as
        | {
            id: string;
            item_id: string;
            borrower_id: string;
            owner_id: string;
            start_date: string;
            end_date: string;
            status: string;
            item_name: string;
          }
        | undefined;

      if (!existing) {
        db.exec('ROLLBACK');
        res.status(404).json({ error: 'Borrow request not found.' });
        return;
      }

      if (existing.owner_id !== userId && existing.borrower_id !== userId) {
        db.exec('ROLLBACK');
        res.status(403).json({ error: 'You do not have permission to update this request.' });
        return;
      }

      if (existing.status === nextStatus) {
        db.exec('COMMIT');
        res.json(existing);
        return;
      }

      const ownerAllowed =
        existing.owner_id === userId &&
        ((existing.status === 'pending' &&
          (nextStatus === 'approved' || nextStatus === 'rejected')) ||
          (existing.status === 'return_requested' && nextStatus === 'completed'));

      const borrowerAllowed =
        existing.borrower_id === userId &&
        (((existing.status === 'pending' || existing.status === 'approved') &&
          nextStatus === 'cancelled') ||
          (existing.status === 'approved' && nextStatus === 'active') ||
          (existing.status === 'active' && nextStatus === 'return_requested'));

      if (!ownerAllowed && !borrowerAllowed) {
        db.exec('ROLLBACK');
        res.status(400).json({ error: 'That status change is not allowed' });
        return;
      }

      if (nextStatus === 'approved') {
        const clash = db
          .prepare(
            `SELECT id FROM borrow_requests
             WHERE item_id = ?
               AND id <> ?
               AND status IN ('approved','active','return_requested')
               AND start_date <= ?
               AND end_date >= ?
             LIMIT 1`
          )
          .get(existing.item_id, existing.id, existing.end_date, existing.start_date);

        if (clash) {
          db.exec('ROLLBACK');
          res.status(409).json({
            error: 'Those dates are already reserved for this item.',
          });
          return;
        }
      }

      db.prepare(
        `UPDATE borrow_requests
         SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(nextStatus, existing.id);

      const targetUserId = ['approved', 'rejected', 'completed'].includes(nextStatus)
        ? existing.borrower_id
        : existing.owner_id;
      const notifId = crypto.randomUUID();
      const notifMsg = `Your ${existing.item_name} request is now ${nextStatus.replace(/_/g, ' ')}`;

      db.prepare(
        'INSERT INTO notifications (id, user_id, message, is_read) VALUES (?, ?, ?, 0)'
      ).run(notifId, targetUserId, notifMsg);

      const updated = db
        .prepare('SELECT * FROM borrow_requests WHERE id = ?')
        .get(existing.id) as Record<string, unknown>;
      const notif = db
        .prepare('SELECT * FROM notifications WHERE id = ?')
        .get(notifId) as Record<string, unknown>;

      db.exec('COMMIT');

      broadcastEvent('borrow_requests', { requestId: existing.id });
      broadcastEvent(
        'notifications',
        {
          notification: {
            ...notif,
            is_read: Boolean(notif.is_read),
          },
        },
        targetUserId
      );

      res.json({
        ...updated,
        is_demo: Boolean(updated.is_demo),
      });
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'Could not update request status.' });
    }
  }
);

// ============ WANTED BOARD ============

apiRouter.get('/wants', (_req: Request, res: Response) => {
  const wants = db
    .prepare(
      `SELECT w.*, p.full_name AS requester_name, p.neighborhood AS requester_neighborhood
       FROM item_wants w
       LEFT JOIN profiles p ON p.id = w.requester_id
       ORDER BY w.created_at DESC`
    )
    .all() as Record<string, unknown>[];

  const responses = db
    .prepare(
      `SELECT r.*, p.full_name AS responder_name, p.neighborhood AS responder_neighborhood
       FROM want_responses r
       LEFT JOIN profiles p ON p.id = r.responder_id
       ORDER BY r.created_at ASC`
    )
    .all() as Record<string, unknown>[];

  const responsesByWant = new Map<string, unknown[]>();
  for (const r of responses) {
    const wid = r.want_id as string;
    const list = responsesByWant.get(wid) || [];
    list.push({
      id: r.id,
      want_id: r.want_id,
      responder_id: r.responder_id,
      message: r.message,
      created_at: r.created_at,
      responder: r.responder_name
        ? {
            id: r.responder_id,
            full_name: r.responder_name,
            neighborhood: r.responder_neighborhood ?? null,
          }
        : null,
    });
    responsesByWant.set(wid, list);
  }

  res.json(
    wants.map((w) => ({
      id: w.id,
      requester_id: w.requester_id,
      title: w.title,
      description: w.description ?? null,
      category: w.category,
      neighborhood: w.neighborhood,
      needed_by: w.needed_by,
      status: w.status,
      is_demo: Boolean(w.is_demo),
      created_at: w.created_at,
      requester: w.requester_name
        ? {
            id: w.requester_id,
            full_name: w.requester_name,
            neighborhood: w.requester_neighborhood ?? null,
          }
        : null,
      want_responses: responsesByWant.get(w.id as string) || [],
    }))
  );
});

apiRouter.post('/wants', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const requesterId = req.authUser!.id;
  const title = cleanStr(req.body?.title);
  const description = cleanStr(req.body?.description) || null;
  const category = cleanStr(req.body?.category) || 'Other';
  const neighborhood = cleanStr(req.body?.neighborhood);
  const neededBy = req.body?.needed_by;

  if (!title) {
    res.status(400).json({ error: 'What item are you looking for?' });
    return;
  }
  if (!neighborhood) {
    res.status(400).json({ error: 'Please enter your neighborhood.' });
    return;
  }
  if (!isValidISODate(neededBy) || neededBy < getTodayISO()) {
    res.status(400).json({ error: 'Please pick a valid needed-by date.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO item_wants (id, requester_id, title, description, category, neighborhood, needed_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
  ).run(id, requesterId, title, description, category, neighborhood, neededBy);

  const row = db
    .prepare('SELECT * FROM item_wants WHERE id = ?')
    .get(id) as Record<string, unknown>;

  broadcastEvent('item_wants', { wantId: id });
  res.status(201).json({
    ...row,
    is_demo: Boolean(row.is_demo),
    want_responses: [],
  });
});

apiRouter.patch('/wants/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT id, requester_id FROM item_wants WHERE id = ?')
    .get(req.params.id) as { id: string; requester_id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }
  if (existing.requester_id !== req.authUser!.id) {
    res.status(403).json({ error: 'You do not have permission to update this request.' });
    return;
  }

  const status = req.body?.status === 'fulfilled' ? 'fulfilled' : 'open';
  db.prepare('UPDATE item_wants SET status = ? WHERE id = ?').run(status, req.params.id);
  broadcastEvent('item_wants', { wantId: req.params.id });
  res.json({ ok: true, status });
});

apiRouter.delete('/wants/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT id, requester_id FROM item_wants WHERE id = ?')
    .get(req.params.id) as { id: string; requester_id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }
  if (existing.requester_id !== req.authUser!.id) {
    res.status(403).json({ error: 'You do not have permission to delete this request.' });
    return;
  }

  db.prepare('DELETE FROM item_wants WHERE id = ?').run(req.params.id);
  broadcastEvent('item_wants', { wantId: req.params.id });
  res.json({ ok: true });
});

apiRouter.post(
  '/wants/:id/responses',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const responderId = req.authUser!.id;
    const message = cleanStr(req.body?.message);
    if (!message) {
      res.status(400).json({ error: 'Please enter a response message.' });
      return;
    }

    const want = db
      .prepare('SELECT id, requester_id, title FROM item_wants WHERE id = ?')
      .get(req.params.id) as
      | { id: string; requester_id: string; title: string }
      | undefined;

    if (!want) {
      res.status(404).json({ error: 'Neighbor request not found.' });
      return;
    }

    const responseId = crypto.randomUUID();
    const notifId = crypto.randomUUID();

    db.exec('BEGIN');
    try {
      db.prepare(
        'INSERT INTO want_responses (id, want_id, responder_id, message) VALUES (?, ?, ?, ?)'
      ).run(responseId, want.id, responderId, message);

      db.prepare(
        'INSERT INTO notifications (id, user_id, message, is_read) VALUES (?, ?, ?, 0)'
      ).run(notifId, want.requester_id, `A neighbor responded to your request for ${want.title}`);

      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'Could not save response.' });
      return;
    }

    const created = db
      .prepare(
        `SELECT r.*, p.full_name AS responder_name, p.neighborhood AS responder_neighborhood
         FROM want_responses r
         LEFT JOIN profiles p ON p.id = r.responder_id
         WHERE r.id = ?`
      )
      .get(responseId) as Record<string, unknown>;

    const notif = db
      .prepare('SELECT * FROM notifications WHERE id = ?')
      .get(notifId) as Record<string, unknown>;

    broadcastEvent('want_responses', { wantId: want.id });
    broadcastEvent(
      'notifications',
      {
        notification: {
          ...notif,
          is_read: Boolean(notif.is_read),
        },
      },
      want.requester_id
    );

    res.status(201).json({
      id: created.id,
      want_id: created.want_id,
      responder_id: created.responder_id,
      message: created.message,
      created_at: created.created_at,
      responder: created.responder_name
        ? {
            id: created.responder_id,
            full_name: created.responder_name,
            neighborhood: created.responder_neighborhood ?? null,
          }
        : null,
    });
  }
);

// ============ NOTIFICATIONS ============

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT id, user_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`
    )
    .all(req.authUser!.id) as Record<string, unknown>[];

  res.json(
    rows.map((n) => ({
      ...n,
      is_read: Boolean(n.is_read),
    }))
  );
});

apiRouter.patch(
  '/notifications/read-all',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(
      req.authUser!.id
    );
    res.json({ ok: true });
  }
);

apiRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.authUser!.id
    );
    res.json({ ok: true });
  }
);

// ============ COMMUNITY IMPACT ============

apiRouter.get('/impact', (_req: Request, res: Response) => {
  const row = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM items) AS items_listed,
        (SELECT COUNT(*) FROM borrow_requests WHERE status = 'completed') AS completed_exchanges,
        (SELECT COUNT(*) FROM borrow_requests WHERE status IN ('active','return_requested')) AS borrowed_now,
        (SELECT COALESCE(SUM(i.replacement_value), 0)
         FROM borrow_requests r
         JOIN items i ON i.id = r.item_id
         WHERE r.status = 'completed') AS money_saved,
        (SELECT COUNT(DISTINCT item_id) FROM borrow_requests WHERE status = 'completed') AS items_reused,
        (SELECT COUNT(*) FROM items WHERE is_demo = 1) AS demo_items`
    )
    .get() as Record<string, unknown>;

  res.json({
    items_listed: Number(row.items_listed) || 0,
    completed_exchanges: Number(row.completed_exchanges) || 0,
    borrowed_now: Number(row.borrowed_now) || 0,
    money_saved: Number(row.money_saved) || 0,
    items_reused: Number(row.items_reused) || 0,
    demo_items: Number(row.demo_items) || 0,
  });
});

// ============ NEIGHBOR CHAT MESSAGES ============

function buildServerThreadKey(itemId: string | null, userA: string, userB: string): string {
  const [p1, p2] = [userA, userB].sort();
  return `${itemId || 'direct'}::${p1}::${p2}`;
}

function mapMessageRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    thread_key: row.thread_key,
    item_id: row.item_id ?? null,
    request_id: row.request_id ?? null,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    message: row.message,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    sender: row.sender_name
      ? {
          id: row.sender_id,
          full_name: row.sender_name,
          neighborhood: row.sender_neighborhood ?? null,
        }
      : null,
    recipient: row.recipient_name
      ? {
          id: row.recipient_id,
          full_name: row.recipient_name,
          neighborhood: row.recipient_neighborhood ?? null,
        }
      : null,
    item: row.item_name
      ? {
          id: row.item_id,
          name: row.item_name,
          image_url: row.item_image_url ?? null,
          category: row.item_category,
          neighborhood: row.item_neighborhood,
        }
      : null,
  };
}

apiRouter.get('/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare(
      `SELECT m.*,
        sp.full_name AS sender_name, sp.neighborhood AS sender_neighborhood,
        rp.full_name AS recipient_name, rp.neighborhood AS recipient_neighborhood,
        i.name AS item_name, i.image_url AS item_image_url, i.category AS item_category, i.neighborhood AS item_neighborhood
       FROM borrow_messages m
       LEFT JOIN profiles sp ON sp.id = m.sender_id
       LEFT JOIN profiles rp ON rp.id = m.recipient_id
       LEFT JOIN items i ON i.id = m.item_id
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(userId, userId) as Record<string, unknown>[];

  res.json(rows.map(mapMessageRow));
});

apiRouter.post('/messages', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.authUser!.id;
  const recipientId = typeof req.body?.recipient_id === 'string' ? req.body.recipient_id.trim() : '';
  const itemId = typeof req.body?.item_id === 'string' && req.body.item_id.trim() ? req.body.item_id.trim() : null;
  const requestId =
    typeof req.body?.request_id === 'string' && req.body.request_id.trim()
      ? req.body.request_id.trim()
      : null;
  const message = cleanStr(req.body?.message).slice(0, 1000);

  if (!recipientId) {
    res.status(400).json({ error: 'Missing recipient.' });
    return;
  }
  if (recipientId === senderId) {
    res.status(400).json({ error: 'You cannot send a message to yourself.' });
    return;
  }
  if (!message) {
    res.status(400).json({ error: 'Please write a message first.' });
    return;
  }

  const recipientRow = db.prepare('SELECT id FROM profiles WHERE id = ?').get(recipientId);
  if (!recipientRow) {
    res.status(404).json({ error: 'Recipient not found.' });
    return;
  }

  const threadKey = buildServerThreadKey(itemId, senderId, recipientId);
  const id = crypto.randomUUID();
  const notifId = crypto.randomUUID();

  const senderProfile = db
    .prepare('SELECT full_name FROM profiles WHERE id = ?')
    .get(senderId) as { full_name?: string } | undefined;
  const itemRow = itemId
    ? (db.prepare('SELECT name FROM items WHERE id = ?').get(itemId) as { name?: string } | undefined)
    : undefined;

  const notifMsg = itemRow?.name
    ? `New message from ${senderProfile?.full_name || 'a neighbor'} about ${itemRow.name}`
    : `New message from ${senderProfile?.full_name || 'a neighbor'}`;

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO borrow_messages (id, thread_key, item_id, request_id, sender_id, recipient_id, message, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(id, threadKey, itemId, requestId, senderId, recipientId, message);

    db.prepare(
      'INSERT INTO notifications (id, user_id, message, is_read) VALUES (?, ?, ?, 0)'
    ).run(notifId, recipientId, notifMsg);

    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Could not send message.' });
    return;
  }

  const createdRow = db
    .prepare(
      `SELECT m.*,
        sp.full_name AS sender_name, sp.neighborhood AS sender_neighborhood,
        rp.full_name AS recipient_name, rp.neighborhood AS recipient_neighborhood,
        i.name AS item_name, i.image_url AS item_image_url, i.category AS item_category, i.neighborhood AS item_neighborhood
       FROM borrow_messages m
       LEFT JOIN profiles sp ON sp.id = m.sender_id
       LEFT JOIN profiles rp ON rp.id = m.recipient_id
       LEFT JOIN items i ON i.id = m.item_id
       WHERE m.id = ?`
    )
    .get(id) as Record<string, unknown>;

  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId) as Record<
    string,
    unknown
  >;

  const mapped = mapMessageRow(createdRow);
  broadcastEvent('borrow_messages', { message: mapped }, recipientId);
  broadcastEvent('borrow_messages', { message: mapped }, senderId);
  broadcastEvent(
    'notifications',
    {
      notification: {
        ...notif,
        is_read: Boolean(notif.is_read),
      },
    },
    recipientId
  );

  res.status(201).json(mapped);
});

apiRouter.patch(
  '/messages/thread/read',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.authUser!.id;
    const threadKey = typeof req.body?.thread_key === 'string' ? req.body.thread_key.trim() : '';
    if (!threadKey) {
      res.status(400).json({ error: 'Missing thread_key.' });
      return;
    }

    db.prepare(
      'UPDATE borrow_messages SET is_read = 1 WHERE thread_key = ? AND recipient_id = ? AND is_read = 0'
    ).run(threadKey, userId);

    res.json({ ok: true });
  }
);
