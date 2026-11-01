import { ApiError, cleanText, handle, json, readJson, todayUtc } from '../_shared.js';

export function onRequestPost({ request, env }) {
  return handle(async () => {
    const body = await readJson(request);
    const customerName = cleanText(body.customerName, 'Name', 100);
    const phone = cleanText(body.phone, 'Phone', 40);
    const pickupDate = cleanText(body.pickupDate, 'Pickup date', 10);
    const parsedDate = new Date(`${pickupDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== pickupDate
      || pickupDate < todayUtc()) {
      throw new ApiError(400, 'Choose a valid pickup date today or later.');
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) {
      throw new ApiError(400, 'Add at least one menu item to your order.');
    }

    const orderItems = new Map();
    for (const requested of body.items) {
      if (typeof requested?.id !== 'string') throw new ApiError(400, 'One or more selected items are unavailable.');
      const quantity = Number(requested.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) {
        throw new ApiError(400, 'Choose a quantity between 1 and 25.');
      }
      const item = await env.DB.prepare(`
        SELECT id, name, price_cents AS priceCents
        FROM menu_items
        WHERE id = ? AND available = 1
      `).bind(requested.id).first();
      if (!item) throw new ApiError(400, 'One or more selected items are no longer available.');
      const existing = orderItems.get(item.id);
      const combinedQuantity = quantity + (existing?.quantity || 0);
      if (combinedQuantity > 25) throw new ApiError(400, 'Maximum quantity is 25 per item.');
      orderItems.set(item.id, { ...item, quantity: combinedQuantity });
    }

    const items = [...orderItems.values()].map((item) => ({
      ...item,
      subtotalCents: item.priceCents * item.quantity,
    }));
    const totalCents = items.reduce((total, item) => total + item.subtotalCents, 0);
    if (!Number.isSafeInteger(totalCents) || totalCents < 1) throw new ApiError(400, 'Order total is invalid.');

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const campaignSource = cleanText(body.campaignSource ?? '', 'Campaign source', 120, false);
    const notes = cleanText(body.notes ?? '', 'Notes', 1000, false);
    const statements = [env.DB.prepare(`
      INSERT INTO orders (id, created_at, customer_name, phone, pickup_date, notes, campaign_source, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, createdAt, customerName, phone, pickupDate, notes, campaignSource, totalCents)];
    for (const item of items) {
      statements.push(env.DB.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price_cents, subtotal_cents)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, item.id, item.name, item.quantity, item.priceCents, item.subtotalCents));
    }
    await env.DB.batch(statements);

    const order = { id, createdAt, customerName, phone, pickupDate, notes, campaignSource, items, totalCents };
    if (env.ORDER_WEBHOOK_URL) {
      try {
        const response = await fetch(env.ORDER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'order.created', order }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error(`Webhook responded with ${response.status}.`);
      } catch (error) {
        console.error(`Order ${id} was saved, but its webhook failed: ${error.message}`);
      }
    }
    return json({ id, message: 'Your order request is in.' }, 201);
  });
}