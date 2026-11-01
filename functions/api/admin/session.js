import { handle, isAuthenticated, json } from '../../_shared.js';

export function onRequestGet({ request, env }) {
  return handle(async () => json({ authenticated: await isAuthenticated(request, env.SESSION_SECRET) }));
}