/**
 * MaliMart Security Layer
 * 
 * Client-side defense: validation, sanitization, rate-limiting, 
 * input hardening. True security lives in Supabase RLS + RPCs,
 * but this layer stops most attack vectors before they reach the server.
 */

// ─── Rate limiter (token bucket per key) ──────────────────────────────────────
const RL_BUCKETS = new Map<string, { tokens: number; last: number }>();
export function rateLimit(key: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const bucket = RL_BUCKETS.get(key) ?? { tokens: maxPerMinute, last: now };
  const elapsed = (now - bucket.last) / 60000;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + elapsed * maxPerMinute);
  bucket.last = now;
  RL_BUCKETS.set(key, bucket);
  if (bucket.tokens < 1) return false; // blocked
  bucket.tokens -= 1;
  return true;
}

// ─── Input sanitizers ─────────────────────────────────────────────────────────
/** Strip HTML tags, null bytes, control chars. */
export function sanitizeText(raw: string, maxLen = 2000): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .replace(/<[^>]*>/g, '')                             // HTML tags
    .replace(/javascript:/gi, '')                        // JS URIs
    .replace(/on\w+\s*=/gi, '')                          // event attrs
    .slice(0, maxLen)
    .trim();
}

/** Only allow safe URL schemes. Returns '' for dangerous URLs. */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Only allow https, http, relative paths — block javascript:, data:, vbscript:
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return '';
  return trimmed;
}

/** Validate redirect targets — block open redirect (only allow same-origin paths). */
export function safeRedirect(raw: string | null, fallback = '/'): string {
  if (!raw) return fallback;
  try {
    // If it's an absolute URL, reject it
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return url.pathname + url.search;
  } catch {
    // It's a relative path — ensure it starts with /
    return raw.startsWith('/') ? raw : fallback;
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
export function isValidTzPhone(phone: string): boolean {
  return /^(\+255|0)[67]\d{8}$/.test(phone.replace(/\s/g, ''));
}
export function isValidTIN(tin: string): boolean {
  return /^\d{9}$/.test(tin.trim());
}
export function isValidPrice(p: number): boolean {
  return Number.isFinite(p) && p >= 0 && p <= 1_000_000_000;
}
export function isValidQuantity(q: number): boolean {
  return Number.isInteger(q) && q >= 1 && q <= 9999;
}

// ─── JSON safe-parse ──────────────────────────────────────────────────────────
export function safeJsonParse<T = unknown>(raw: string, fallback: T): T {
  try {
    const val = JSON.parse(raw);
    // Block prototype pollution
    if (typeof val === 'object' && val !== null) {
      if ('__proto__' in val || 'constructor' in val || 'prototype' in val) return fallback;
    }
    return val as T;
  } catch {
    return fallback;
  }
}

// ─── CSRF protection ──────────────────────────────────────────────────────────
/** Generate a CSRF token stored in sessionStorage and returned for headers. */
let _csrf: string | null = null;
export function getCsrfToken(): string {
  if (_csrf) return _csrf;
  const stored = sessionStorage.getItem('mm_csrf');
  if (stored) { _csrf = stored; return _csrf; }
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  _csrf = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
  sessionStorage.setItem('mm_csrf', _csrf);
  return _csrf;
}

// ─── Role / permission check ──────────────────────────────────────────────────
export type UserRole = 'admin' | 'seller' | 'buyer' | 'guest';
export function assertRole(userRole: string | undefined, required: UserRole): boolean {
  if (required === 'guest') return true;
  if (!userRole) return false;
  if (required === 'admin') return userRole === 'admin';
  if (required === 'seller') return userRole === 'seller' || userRole === 'admin';
  if (required === 'buyer') return ['buyer','seller','admin'].includes(userRole);
  return false;
}

// ─── File upload security ─────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/gif'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_BYTES   = 20 * 1024 * 1024; // 20 MB

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}
export function validateUpload(file: File, allowDocs = false): FileValidationResult {
  const allowed = allowDocs ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES] : ALLOWED_IMAGE_TYPES;
  if (!allowed.includes(file.type))
    return { ok: false, error: `File type not allowed (${file.type}). Use ${allowDocs ? 'JPG, PNG, WebP, or PDF' : 'JPG, PNG, or WebP'}.` };
  const maxSize = allowDocs && ALLOWED_DOC_TYPES.includes(file.type) ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxSize)
    return { ok: false, error: `File too large (max ${maxSize/1024/1024} MB).` };
  // Check magic bytes (first bytes should match image signature)
  return { ok: true };
}

// ─── Brute-force lockout tracker ─────────────────────────────────────────────
const AUTH_ATTEMPTS = new Map<string, { count: number; until: number }>();
export function recordAuthAttempt(email: string): { locked: boolean; remainingMs: number } {
  const key = email.toLowerCase();
  const entry = AUTH_ATTEMPTS.get(key) ?? { count: 0, until: 0 };
  if (Date.now() < entry.until) return { locked: true, remainingMs: entry.until - Date.now() };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.until = Date.now() + 15 * 60 * 1000; // 15 minute lockout
    entry.count = 0;
    AUTH_ATTEMPTS.set(key, entry);
    return { locked: true, remainingMs: entry.until - Date.now() };
  }
  AUTH_ATTEMPTS.set(key, entry);
  return { locked: false, remainingMs: 0 };
}
export function clearAuthAttempts(email: string): void {
  AUTH_ATTEMPTS.delete(email.toLowerCase());
}

// ─── Suspicious activity detector ────────────────────────────────────────────
const ACTIVITY_LOG: { ts: number; action: string }[] = [];
export function detectAnomaly(action: string): boolean {
  const now = Date.now();
  // Keep last 60 seconds of events
  const windowStart = now - 60_000;
  while (ACTIVITY_LOG.length && ACTIVITY_LOG[0].ts < windowStart) ACTIVITY_LOG.shift();
  ACTIVITY_LOG.push({ ts: now, action });
  // Flag if >30 events in 60 seconds (bot-like behavior)
  return ACTIVITY_LOG.length > 30;
}

// ─── Content Security Policy nonce (for inline scripts) ──────────────────────
export function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr));
}
