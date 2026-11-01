import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targetMode = process.argv.includes('--remote') ? '--remote' : '--local';
const rootDir = resolve(new URL('..', import.meta.url).pathname);
const storePath = resolve(rootDir, 'data', 'store.json');
const payload = JSON.parse(readFileSync(storePath, 'utf8'));

const menuItems = Array.isArray(payload.items) ? payload.items : [];
const orders = Array.isArray(payload.orders) ? payload.orders : [];
const replaceMenu = process.argv.includes('--replace-menu');

function sqlEscape(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''");
}

const sqlStatements = [];
if (replaceMenu) sqlStatements.push('DELETE FROM menu_items;');

for (const item of menuItems) {
  const id = String(item.id ?? crypto.randomUUID());
  const name = sqlEscape(item.name ?? '');
  const description = sqlEscape(item.description ?? '');
  const category = sqlEscape(item.category ?? 'General');
  const priceCents = Number(item.priceCents ?? 0);
  const imageUrl = sqlEscape(item.imageUrl ?? '');
  const available = item.available === false ? 0 : 1;
  const createdAt = item.createdAt ?? new Date().toISOString();
  const updatedAt = item.updatedAt ?? createdAt;
  sqlStatements.push(`INSERT OR REPLACE INTO menu_items (id, name, description, category, price_cents, image_url, available, created_at, updated_at) VALUES ('${id}', '${name}', '${description}', '${category}', ${priceCents}, '${imageUrl}', ${available}, '${createdAt}', '${updatedAt}');`);
}

for (const order of orders) {
  const id = String(order.id ?? crypto.randomUUID());
  const createdAt = order.createdAt ?? new Date().toISOString();
  const status = sqlEscape(order.status ?? 'new');
  const customerName = sqlEscape(order.customerName ?? '');
  const phone = sqlEscape(order.phone ?? '');
  const pickupDate = sqlEscape(order.pickupDate ?? '');
  const notes = sqlEscape(order.notes ?? '');
  const campaignSource = sqlEscape(order.campaignSource ?? '');
  const totalCents = Number(order.totalCents ?? 0);
  sqlStatements.push(`INSERT OR REPLACE INTO orders (id, created_at, status, customer_name, phone, pickup_date, notes, campaign_source, total_cents) VALUES ('${id}', '${createdAt}', '${status}', '${customerName}', '${phone}', '${pickupDate}', '${notes}', '${campaignSource}', ${totalCents});`);

  for (const line of Array.isArray(order.items) ? order.items : []) {
    const itemId = String(line.menuItemId ?? line.id ?? crypto.randomUUID());
    const itemName = sqlEscape(line.name ?? '');
    const quantity = Number(line.quantity ?? 1);
    const priceCents = Number(line.priceCents ?? 0);
    const subtotalCents = Number(line.subtotalCents ?? 0);
    sqlStatements.push(`INSERT OR REPLACE INTO order_items (order_id, menu_item_id, item_name, quantity, price_cents, subtotal_cents) VALUES ('${id}', '${itemId}', '${itemName}', ${quantity}, ${priceCents}, ${subtotalCents});`);
  }
}

if (!sqlStatements.length) {
  console.log('No records found in data/store.json to migrate.');
  process.exit(0);
}

const statement = sqlStatements.join('\n');

try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'nicos-food-db', targetMode, '--command', statement], {
    stdio: 'inherit',
    cwd: rootDir,
  });
  console.log(`Migrated ${menuItems.length} menu item(s) and ${orders.length} order(s) to D1 (${targetMode.replace(/^--/, '')}).`);
} catch (error) {
  console.error('Migration failed. Ensure the database exists and is configured in wrangler.jsonc.');
  process.exit(error.status ?? 1);
}
