import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'shareshelf_supabase_url';
const STORAGE_ANON_KEY = 'shareshelf_supabase_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'env' | 'localStorage' | 'none';
}

function normalizeEnvValue(value: string): string {
  return value.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function normalizeSupabaseUrl(value: string): string {
  const cleaned = normalizeEnvValue(value).replace(/\/+$/, '');
  if (/\.supabase\.$/i.test(cleaned)) {
    return `${cleaned}co`;
  }
  return cleaned;
}

function readProcessEnv(name: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[name] === 'string') {
      return normalizeEnvValue(process.env[name]!);
    }
  } catch {
    // ignore
  }
  return '';
}

const DEFAULT_PUBLIC_SUPABASE_URL = 'https://wxilcjhelvfjdqqbwrdx.supabase.co';
const DEFAULT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_76N8WvSHMotSgpxUOoMxUA_cwNHg0Ic';

export function getSupabaseConfig(): SupabaseConfig {
  const staticViteUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const staticViteKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  const envUrl = normalizeSupabaseUrl(
    (staticViteUrl ? normalizeEnvValue(String(staticViteUrl)) : '') ||
      readProcessEnv('VITE_SUPABASE_URL') ||
      readProcessEnv('SUPABASE_URL') ||
      readProcessEnv('NEXT_PUBLIC_SUPABASE_URL')
  );
  const envKey =
    (staticViteKey ? normalizeEnvValue(String(staticViteKey)) : '') ||
    readProcessEnv('VITE_SUPABASE_ANON_KEY') ||
    readProcessEnv('SUPABASE_ANON_KEY') ||
    readProcessEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  try {
    const localUrl = localStorage.getItem(STORAGE_URL_KEY)?.trim() || '';
    const localKey = localStorage.getItem(STORAGE_ANON_KEY)?.trim() || '';
    if (localUrl && localKey) {
      return { url: normalizeSupabaseUrl(localUrl), anonKey: localKey, source: 'localStorage' };
    }
  } catch {
    // ignore localStorage errors
  }

  return {
    url: DEFAULT_PUBLIC_SUPABASE_URL,
    anonKey: DEFAULT_PUBLIC_SUPABASE_ANON_KEY,
    source: 'env',
  };
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey);
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }

  const sig = `${url}::${anonKey}`;
  if (cachedClient && cachedSignature === sig) {
    return cachedClient;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  cachedSignature = sig;
  return cachedClient;
}
