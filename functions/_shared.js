const encoder = new TextEncoder();
const sessionCookie = 'nicos_owner';
const sessionLifetime = 12 * 60 * 60;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function handle(action) {
  try {
    return await action();
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) console.error(error);
    return json({ error: status === 500 ? 'Something went wrong.' : error.message }, status);
  }
}

export async function readJson(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 1_000_000) throw new ApiError(413, 'Request is too large.');
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'Send valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Send a JSON object.');
  }
  return body;
}

export function cleanText(value, label, maxLength, required = true) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} is required.`);
  const cleaned = value.trim();
  if ((required && !cleaned) || cleaned.length > maxLength) {
    throw new ApiError(400, `${label} is required and must be ${maxLength} characters or fewer.`);
  }
  return cleaned;
}

export function parseMenuItem(body) {
  const name = cleanText(body.name, 'Name', 100);
  const description = cleanText(body.description ?? '', 'Description', 500, false);
  const category = cleanText(body.category, 'Category', 48);
  const price = typeof body.price === 'string' || typeof body.price === 'number'
    ? String(body.price).trim()
    : '';
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(price)) {
    throw new ApiError(400, 'Enter a valid price with up to two decimal places.');
  }
  const priceCents = Math.round(Number(price) * 100);
  if (priceCents < 1 || priceCents > 10_000_000) {
    throw new ApiError(400, 'Price must be greater than zero and at most 100,000.');
  }
  const imageUrl = cleanText(body.imageUrl ?? '', 'Image URL', 1000, false);
  if (imageUrl && !/^\/images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(imageUrl)) {
    try {
      if (new URL(imageUrl).protocol !== 'https:') throw new Error('Unsupported protocol.');
    } catch {
      throw new ApiError(400, 'Image must be an uploaded image or a valid HTTPS URL.');
    }
  }
  return { name, description, category, priceCents, imageUrl };
}

function encodeBase64Url(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sessionKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator > -1 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

export async function createSession(secret) {
  const payload = encodeBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + sessionLifetime }));
  const key = await sessionKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function isAuthenticated(request, secret) {
  const token = getCookie(request, sessionCookie);
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const key = await sessionKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), encoder.encode(payload));
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return Number.isInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAdmin(context) {
  if (!await isAuthenticated(context.request, context.env.SESSION_SECRET)) {
    throw new ApiError(401, 'Sign in to manage the menu and orders.');
  }
}

export function sessionCookieHeader(request, token, maxAge = sessionLifetime) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure}`;
}

export async function passwordsMatch(supplied, expected) {
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(suppliedDigest);
  const right = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}