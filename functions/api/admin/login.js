import {
  ApiError, createSession, handle, json, passwordsMatch, readJson, sessionCookieHeader,
} from '../../_shared.js';

export function onRequestPost({ request, env }) {
  return handle(async () => {
    if (typeof env.ADMIN_PASSWORD !== 'string' || env.ADMIN_PASSWORD.length < 12) {
      throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
    }
    if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 characters.');
    }
    const body = await readJson(request);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!await passwordsMatch(password, env.ADMIN_PASSWORD)) {
      throw new ApiError(401, 'That password did not match.');
    }
    const token = await createSession(env.SESSION_SECRET);
    return json({ authenticated: true }, 200, {
      'Set-Cookie': sessionCookieHeader(request, token),
    });
  });
}