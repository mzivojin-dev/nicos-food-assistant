# Nico's Food

A plain HTML, CSS, and JavaScript catering site hosted on Cloudflare Pages. Pages Functions provide the API, and Cloudflare D1 stores menu items and pickup orders. There is no Node application server.

## Cloudflare resources

1. Install dependencies with `npm install` and authenticate Wrangler with `npx wrangler login`.
2. Create the D1 database with `npm run db:create`. Copy its database ID into `wrangler.jsonc`, replacing the local placeholder.
3. Create the R2 bucket with `npx wrangler r2 bucket create nicos-food-images`.
4. Create the Pages project with `npx wrangler pages project create nicos-food`.
5. Apply the schema with `npm run db:migrate:remote`.
6. Add the owner and webhook secrets with `npx wrangler pages secret put ADMIN_PASSWORD --project-name=nicos-food`, `npx wrangler pages secret put SESSION_SECRET --project-name=nicos-food`, and, optionally, `npx wrangler pages secret put ORDER_WEBHOOK_URL --project-name=nicos-food`. Use an owner password of at least 12 characters and a random session secret of at least 32 characters.
7. Deploy with `npm run deploy`.

For local development, copy `.dev.vars.example` to `.dev.vars`, run `npm run db:migrate:local`, then `npm run dev`. The local D1 database is separate from production.

## Migration

Use the JSON snapshot in `data/store.json` to seed the menu and any saved orders into the D1 database. Run `npm run db:seed:local` for local development or `npm run db:seed:remote` for production. To replace the existing menu with the snapshot, use `npm run db:replace-menu:local` or `npm run db:replace-menu:remote`; this leaves order history intact. Menu prices are displayed in CAD.

## Publishing

Sign in at `/admin` to add, edit, hide, or remove menu items and update order statuses. Upload a JPG, PNG, or WebP photo up to 5 MB when adding a menu item; uploaded photos are stored in the `nicos-food-images` R2 bucket and served by the site under `/images/`. When editing, leave the upload empty to keep the current photo or upload a replacement. Public visitors only see available menu items. Order totals are calculated from D1 prices, not from values submitted by the browser. Order items retain a snapshot of the item name and price at the time of ordering. `utm_campaign` or `utm_source` is saved as the campaign source.

To enable order notifications, set `ORDER_WEBHOOK_URL` as a Pages secret. The app sends `{ "event": "order.created", "order": { ... } }` after storing the order. Webhook failures do not discard saved orders.

## GitHub Actions deployment

The workflow in `.github/workflows/deploy.yml` applies D1 migrations and publishes the Pages site on pushes to `main`. Add `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret and `CLOUDFLARE_ACCOUNT_ID` as a repository variable. The token needs permission to deploy Pages and manage D1 migrations. Configure the real database ID in `wrangler.jsonc`, create the Pages project and R2 bucket, and ensure the bucket name matches the `IMAGES` binding before enabling the workflow.

Orders are pickup requests, not payments. The owner session uses signed, HttpOnly cookies; do not commit `.dev.vars` or expose secrets in frontend files.
