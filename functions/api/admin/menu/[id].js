import { ApiError, handle, json, parseMenuItem, readJson, requireAdmin } from '../../../_shared.js';

export function onRequestPut(context) {
  return handle(async () => {
    await requireAdmin(context);
    const item = parseMenuItem(await readJson(context.request));
    const now = new Date().toISOString();
    const result = await context.env.DB.prepare(`
      UPDATE menu_items
      SET name = ?, description = ?, category = ?, price_cents = ?, image_url = ?, updated_at = ?
      WHERE id = ?
    `).bind(item.name, item.description, item.category, item.priceCents, item.imageUrl, now, context.params.id).run();
    if (!result.meta.changes) throw new ApiError(404, 'Menu item not found.');
    return json({ ...item, id: context.params.id });
  });
}

export function onRequestPatch(context) {
  return handle(async () => {
    await requireAdmin(context);
    const body = await readJson(context.request);
    if (typeof body.available !== 'boolean') throw new ApiError(400, 'Availability must be true or false.');
    const result = await context.env.DB.prepare(`
      UPDATE menu_items SET available = ?, updated_at = ? WHERE id = ?
    `).bind(body.available ? 1 : 0, new Date().toISOString(), context.params.id).run();
    if (!result.meta.changes) throw new ApiError(404, 'Menu item not found.');
    return json({ id: context.params.id, available: body.available ? 1 : 0 });
  });
}

export function onRequestDelete(context) {
  return handle(async () => {
    await requireAdmin(context);
    const result = await context.env.DB.prepare('DELETE FROM menu_items WHERE id = ?')
      .bind(context.params.id).run();
    if (!result.meta.changes) throw new ApiError(404, 'Menu item not found.');
    return json({ deleted: true });
  });
}