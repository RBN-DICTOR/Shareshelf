import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_SECRET;
}

export interface AuthUserPayload {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUserPayload;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signAuthToken(user: AuthUserPayload): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

export function verifyAuthToken(token: string): AuthUserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sigPart] = parts;
    const data = `${header}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest();
    const actualSig = base64UrlDecode(sigPart);

    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const decoded = JSON.parse(base64UrlDecode(payload).toString('utf8')) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    if (!decoded.sub || !decoded.email || !decoded.exp) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    const existingUser = db
      .prepare('SELECT id, email FROM users WHERE id = ?')
      .get(decoded.sub) as { id: string; email: string } | undefined;

    if (!existingUser) return null;
    return { id: existingUser.id, email: existingUser.email };
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const verified = verifyAuthToken(token);
    if (verified) {
      req.authUser = verified;
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  const verified = verifyAuthToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    return;
  }
  req.authUser = verified;
  next();
}
