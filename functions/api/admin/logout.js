import { handle, json, sessionCookieHeader } from '../../_shared.js';

export function onRequestPost({ request }) {
  return handle(async () => json({ authenticated: false }, 200, {
    'Set-Cookie': sessionCookieHeader(request, '', 0),
  }));
}