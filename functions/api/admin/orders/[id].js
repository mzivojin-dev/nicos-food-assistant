import { ApiError, handle, json, readJson, requireAdmin } from '../../../_shared.js';

const statuses = new Set(['new', 'confirmed', 'ready', 'completed', 'cancelled']);

export function onRequestPatch(context) {
  return handle(async () => {
    await requireAdmin(context);
    const body = await readJson(context.request);
    if (!statuses.has(body.status)) throw new ApiError(400, 'Choose a valid order status.');
    const result = await context.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?')
      .bind(body.status, context.params.id).run();
    if (!result.meta.changes) throw new ApiError(404, 'Order not found.');
    return json({ id: context.params.id, status: body.status });
  });
}