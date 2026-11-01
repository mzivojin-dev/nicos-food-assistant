import { handle, json } from '../_shared.js';

export function onRequestGet({ env }) {
  return handle(async () => {
    const { results } = await env.DB.prepare(`
      SELECT id, name, description, category, price_cents AS priceCents,
        image_url AS imageUrl, available, created_at AS createdAt
      FROM menu_items
      WHERE available = 1
      ORDER BY category, name
    `).all();
    return json(results);
  });
}