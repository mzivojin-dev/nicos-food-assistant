import { handle, json, requireAdmin } from '../../_shared.js';

export function onRequestGet(context) {
  return handle(async () => {
    await requireAdmin(context);
    const { results } = await context.env.DB.prepare(`
      SELECT o.id, o.created_at AS createdAt, o.status,
        o.customer_name AS customerName, o.phone, o.pickup_date AS pickupDate,
        o.notes, o.campaign_source AS campaignSource, o.total_cents AS totalCents,
        i.menu_item_id AS menuItemId, i.item_name AS name,
        i.quantity, i.price_cents AS priceCents, i.subtotal_cents AS subtotalCents
      FROM orders AS o
      LEFT JOIN order_items AS i ON i.order_id = o.id
      ORDER BY o.created_at DESC
      LIMIT 1000
    `).all();
    const orders = new Map();
    for (const row of results) {
      let order = orders.get(row.id);
      if (!order) {
        order = {
          id: row.id,
          createdAt: row.createdAt,
          status: row.status,
          customerName: row.customerName,
          phone: row.phone,
          pickupDate: row.pickupDate,
          notes: row.notes,
          campaignSource: row.campaignSource,
          totalCents: row.totalCents,
          items: [],
        };
        orders.set(row.id, order);
      }
      if (row.menuItemId) {
        order.items.push({
          id: row.menuItemId,
          name: row.name,
          quantity: row.quantity,
          priceCents: row.priceCents,
          subtotalCents: row.subtotalCents,
        });
      }
    }
    return json({ orders: [...orders.values()] });
  });
}