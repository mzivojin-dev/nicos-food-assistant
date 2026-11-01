import { ApiError, cleanText, handle, json, parseMenuItem, readJson, requireAdmin } from '../../_shared.js';

export function onRequestGet(context) {
  return handle(async () => {
    await requireAdmin(context);
    const { results } = await context.env.DB.prepare(`
      SELECT id, name, description, category, price_cents AS priceCents,
        image_url AS imageUrl, available, created_at AS createdAt
      FROM menu_items
      ORDER BY category, name
    `).all();
    return json(results);
  });
}

export function onRequestPost(context) {
  return handle(async () => {
    await requireAdmin(context);
    const item = parseMenuItem(await readJson(context.request));
    if (!item.imageUrl) throw new ApiError(400, 'Upload a photo for the new menu item.');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await context.env.DB.prepare(`
      INSERT INTO menu_items (id, name, description, category, price_cents, image_url, available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(id, item.name, item.description, item.category, item.priceCents, item.imageUrl, now, now).run();
    return json({ ...item, id, available: 1, createdAt: now }, 201);
  });
}