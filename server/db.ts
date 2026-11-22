import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'shareshelf.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Neighbor',
    neighborhood TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Tools','Electronics','Education','Household','Outdoor','Events','Sports','Other')),
    condition TEXT NOT NULL DEFAULT 'Good' CHECK (condition IN ('Like new','Good','Fair')),
    image_url TEXT,
    neighborhood TEXT NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1,
    rules TEXT DEFAULT 'Please return it on time and in the condition you received it.',
    replacement_value REAL NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS borrow_requests (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    borrower_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','active','return_requested','completed','cancelled')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (end_date >= start_date)
  );

  CREATE TABLE IF NOT EXISTS item_wants (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    needed_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS want_responses (
    id TEXT PRIMARY KEY,
    want_id TEXT NOT NULL REFERENCES item_wants(id) ON DELETE CASCADE,
    responder_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS borrow_messages (
    id TEXT PRIMARY KEY,
    thread_key TEXT NOT NULL,
    item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
    request_id TEXT REFERENCES borrow_requests(id) ON DELETE SET NULL,
    sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_borrow_messages_thread
    ON borrow_messages (thread_key, created_at);
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function seedDatabaseIfEmpty(): void {
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const alexId = '11111111-1111-4111-8111-111111111111';
  const jordanId = '22222222-2222-4222-8222-222222222222';
  const demoPassHash = hashPassword('ShareShelf!2026');

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
  );
  const insertProfile = db.prepare(
    'INSERT INTO profiles (id, full_name, neighborhood) VALUES (?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    insertUser.run(alexId, 'alex@shareshelf.demo', demoPassHash);
    insertUser.run(jordanId, 'jordan@shareshelf.demo', demoPassHash);

    insertProfile.run(alexId, 'Alex Morgan', 'Riverside');
    insertProfile.run(jordanId, 'Jordan Lee', 'Westlands');

    const insertItem = db.prepare(`
      INSERT INTO items (
        id, owner_id, name, description, category, condition,
        image_url, neighborhood, is_available, rules, replacement_value, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'Please return it on time and in the condition you received it.', ?, 1)
    `);

    const demoItems: Array<[string, string, string, string, string, string, string, number]> = [
      [alexId, 'Cordless power drill', '18V drill with two batteries, charger and a bit set.', 'Tools', 'Good', '/src/assets/images/item_power_drill_1795298891489.jpg', 'Riverside', 80],
      [alexId, 'Extension ladder', '3 metre aluminium ladder, good for gutters and painting.', 'Tools', 'Good', '/src/assets/images/item_extension_ladder_1795298892017.jpg', 'Riverside', 120],
      [alexId, '4-person camping tent', 'Easy pop-up tent with rain cover and carry bag.', 'Outdoor', 'Good', '/src/assets/images/item_camping_tent_1795298891497.jpg', 'Riverside', 90],
      [alexId, 'HD projector', 'HDMI projector with a small tripod. Great for movie nights.', 'Electronics', 'Like new', '/src/assets/images/item_hd_projector_1795298891584.jpg', 'Riverside', 250],
      [alexId, 'Home tool kit', 'Hammer, screwdrivers, pliers, spanner and spirit level.', 'Tools', 'Good', '/src/assets/images/item_home_toolkit_1795298892107.jpg', 'Riverside', 55],
      [alexId, 'Folding chairs (set of 6)', 'Six sturdy folding chairs for parties and gatherings.', 'Events', 'Good', '/src/assets/images/item_folding_chairs_1795298891705.jpg', 'Riverside', 70],
      [jordanId, 'Scientific calculator', 'Exam-approved scientific calculator, fresh battery.', 'Education', 'Like new', '/src/assets/images/item_calculator_1795298891504.jpg', 'Westlands', 25],
      [jordanId, 'Football', 'Size 5 match ball, pumped and ready.', 'Sports', 'Good', '/src/assets/images/item_football_1795298891439.jpg', 'Westlands', 20],
      [jordanId, 'Portable speaker', 'Bluetooth speaker with about 12 hours of battery.', 'Electronics', 'Good', '/src/assets/images/item_portable_speaker_1795298891809.jpg', 'Westlands', 60],
      [jordanId, 'Countertop blender', 'Strong 1.5L blender for smoothies and soups.', 'Household', 'Fair', '/src/assets/images/item_blender_1795298892105.jpg', 'Westlands', 45],
      [jordanId, 'Study books bundle', 'Five first-year textbooks, lightly highlighted.', 'Education', 'Fair', '/src/assets/images/item_study_books_1795298894414.jpg', 'Westlands', 40],
      [jordanId, 'Bicycle pump', 'Floor pump with a gauge. Fits both valve types.', 'Sports', 'Good', '/src/assets/images/item_bicycle_pump_1795298892045.jpg', 'Westlands', 18],
    ];

    for (const [ownerId, name, description, category, condition, imageUrl, neighborhood, value] of demoItems) {
      insertItem.run(
        crypto.randomUUID(),
        ownerId,
        name,
        description,
        category,
        condition,
        imageUrl,
        neighborhood,
        value
      );
    }

    const insertWant = db.prepare(`
      INSERT INTO item_wants (id, requester_id, title, description, category, neighborhood, needed_by, status, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 1)
    `);

    insertWant.run(
      crypto.randomUUID(),
      jordanId,
      'Ladder for the weekend',
      'I need a ladder to repair my roof.',
      'Tools',
      'Westlands',
      addDaysISO(10)
    );
    insertWant.run(
      crypto.randomUUID(),
      alexId,
      'Camping stove',
      'A small gas stove for a weekend hike.',
      'Outdoor',
      'Riverside',
      addDaysISO(20)
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function backfillDemoItemImages(): void {
  const imageMap: Record<string, string> = {
    'Cordless power drill': '/src/assets/images/item_power_drill_1795298891489.jpg',
    'Extension ladder': '/src/assets/images/item_extension_ladder_1795298892017.jpg',
    '4-person camping tent': '/src/assets/images/item_camping_tent_1795298891497.jpg',
    'HD projector': '/src/assets/images/item_hd_projector_1795298891584.jpg',
    'Home tool kit': '/src/assets/images/item_home_toolkit_1795298892107.jpg',
    'Folding chairs (set of 6)': '/src/assets/images/item_folding_chairs_1795298891705.jpg',
    'Scientific calculator': '/src/assets/images/item_calculator_1795298891504.jpg',
    Football: '/src/assets/images/item_football_1795298891439.jpg',
    'Portable speaker': '/src/assets/images/item_portable_speaker_1795298891809.jpg',
    'Countertop blender': '/src/assets/images/item_blender_1795298892105.jpg',
    'Study books bundle': '/src/assets/images/item_study_books_1795298894414.jpg',
    'Bicycle pump': '/src/assets/images/item_bicycle_pump_1795298892045.jpg',
  };
  const stmt = db.prepare(
    'UPDATE items SET image_url = ? WHERE is_demo = 1 AND image_url IS NULL AND name = ?'
  );
  for (const [name, url] of Object.entries(imageMap)) {
    stmt.run(url, name);
  }
}

seedDatabaseIfEmpty();
backfillDemoItemImages();
