# Deployment & Launch Checklist

A detailed guide to deploying the unified client frontend (`apps/client`) to Vercel and the modular backend Express API (`apps/server`) to Render, on their free tiers — plus the real limitations of those free tiers so nothing here is a surprise in production.

---

## 💸 The Free Stack

- **Frontend**: Vercel free (Hobby) plan — automatic HTTPS, CDN, preview deploys per PR, SPA routing support.
- **Backend**: Render free Web Service — runs the Express API in a container.
- **Database**: MongoDB Atlas free tier (M0 cluster) — free indefinitely, unlike Render's own Postgres (deleted after 90 days).

### Known free-tier constraints

- **Render cold starts**: free web services spin down after ~15 minutes of inactivity. The next request triggers a 30-60s cold start. Either accept it (it's a portfolio, not high-traffic) or set up a free external uptime pinger (UptimeRobot, cron-job.org) hitting `/api/v1/health` every 10-14 minutes — a legitimate, commonly used workaround, though it doesn't fully guarantee zero cold starts.
- **Atlas M0** is free forever but has no automatic backups (see Backups below).
- **No background workers/cron** on Render's free tier. A scheduled job (e.g. nightly analytics rollup) would need Render Cron Jobs (separate free-tier feature) or a third-party scheduler hitting an API endpoint.

---

## 🗄️ Database Setup (no migrations — Mongoose)

There is no migration step **for document shape**. Mongoose enforces schema shape at the application layer, not the database layer — a field change just means editing the relevant `.model.ts` file and redeploying. Documents that predate a new field simply won't have it until updated; the code handles this with defaults (`?? []`, Mongoose schema defaults) rather than assuming every document matches the latest shape.

> ⚠️ **Indexes are the exception, and they do need a deliberate step.** Mongoose only ever *creates* missing indexes at boot — it never alters an existing index whose options changed, and never drops one whose declaration was removed. A database that has been through a few schema revisions therefore drifts from the code, and the test suite cannot catch it because `mongodb-memory-server` starts empty every run. This has already caused one real failure: `Page.path` began as a plain unique index and later became partial on `deletedAt` so that a soft-deleted page frees its URL; on a database carrying the old index, recreating a page at a deleted page's URL failed.

- [ ] Create a MongoDB Atlas **M0 cluster** (free tier).
- [ ] Create a database user under Database Access.
- [ ] Under Network Access, add `0.0.0.0/0` — Render's free tier has no fixed outbound IP to allowlist individually.
- [ ] Copy the `mongodb+srv://...` connection string into `MONGODB_URI`.
- [ ] Seed the initial admin account (dev/first-deploy only — `seed.ts` refuses to run when `NODE_ENV=production` unless you pass `--force`):
  ```bash
  npm run db:seed --workspace=apps/server
  ```
- [ ] **After any deploy that changed an index declaration**, check for drift. The report is read-only; `--apply` drops and rebuilds, so run it during a quiet window:
  ```bash
  npm run db:indexes              # report only
  npm run db:indexes -- --apply   # drop extras, build missing
  ```
- [ ] **First deploy only** — backfill the built-in pages as CMS-managed Page documents so their content is editable without a deploy. Idempotent and report-only by default; an existing page at the same path is never overwritten:
  ```bash
  npm run db:backfill-pages              # report only
  npm run db:backfill-pages -- --apply
  ```
  These six (`/`, `/projects`, `/about`, `/certifications`, `/blog`, `/contact`) are created with `isSystem: true`, so the delete guard refuses to remove them and their slug/parent are locked in the editor. Sections, content, SEO and nav order remain fully editable. **They do not render until the matching hardcoded route is removed from `apps/client/src/App.tsx`** — see "Cutting a page over to the CMS" in the README.

---

## ⚙️ Backend Deployment (`apps/server` → Render)

- [ ] Connect the repository on Render and create a **Web Service**.
- [ ] Build settings:
  - **Build Command**: `npm install && npm run build --workspace=apps/server`
  - **Start Command**: `node apps/server/dist/server.js`
- [ ] Environment variables: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`, `CLIENT_ORIGIN` (exact Vercel domain), `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, `RESEND_API_KEY` (or `SMTP_*`), `SENTRY_DSN` (optional).
- [ ] Set Render's **Health Check Path** to `/api/v1/health` — it does a real Mongoose `ping()`, not just a static response, so it also keeps a free-tier Atlas cluster from going idle as a side effect.
- [ ] Confirm `trust proxy` is enabled (it is, in `server.ts`) so rate limiting and the auth audit log see the real client IP behind Render's proxy.

**Operational features already built in:**
- Structured logging via `pino` (`apps/server/src/utils/logger.ts`) — JSON lines in production, pretty-printed locally.
- Optional Sentry error tracking (`apps/server/src/config/sentry.ts`) — activates automatically once `SENTRY_DSN` is set; the app runs fine without it.
- Graceful shutdown — `SIGTERM`/`SIGINT` close the HTTP server and Mongoose connection cleanly on redeploys/spin-downs.

---

## 🚀 Frontend Deployment (`apps/client` → Vercel)

- [ ] Add the project on Vercel. Framework preset: Vite. Root directory: `apps/client`. Build command: `npm run build`. Output directory: `dist`.
- [ ] Environment variables (used at build time, by `scripts/generateSitemap.mjs`):
  - `VITE_SITE_URL` — your deployed frontend URL (e.g. `https://alexdeveloper.com`). Without this, `sitemap.xml`/`robots.txt`'s Sitemap directive are skipped entirely, not generated with a wrong domain.
  - `VITE_API_URL` — your deployed API URL + `/api/v1` (e.g. `https://portfolio-api.onrender.com/api/v1`).
- [ ] `apps/client/vercel.json` already contains the SPA fallback rewrite so `/admin/*` routes don't 404 on refresh:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- [ ] Vercel's default caching (hashed asset filenames, no-cache on `index.html`) works out of the box — no extra config needed.

---

## 🔒 CORS & Cookies in Production

- [ ] `CLIENT_ORIGIN` on Render must be your **exact** Vercel production domain (or custom domain, if attached).
- [ ] Since Vercel and Render are different domains, the refresh-token and CSRF cookies use `SameSite=None; Secure` in production (`sameSite: 'none'`, gated on `NODE_ENV === 'production'` in `apps/server/src/modules/auth/routes.ts`) with `credentials: true` on both the CORS middleware and every client fetch. Locally, both run on `localhost`, so cookies stay `SameSite=Strict` — no cross-site boundary to cross.
- [ ] Both Vercel and Render provide HTTPS automatically — no certificate setup needed (required for `Secure` cookies to actually be sent).

---

## 🔁 CI/CD

- [ ] GitHub Actions (`.github/workflows/ci.yml`) runs lint + typecheck + test + build on every push/PR — free for public/personal repos.
- [ ] Vercel auto-deploys the frontend on every push to `main` once the repo is connected.
- [ ] Render auto-deploys the backend on push to `main` similarly, once connected.

---

## 💾 Backups

MongoDB Atlas M0 (free tier) has **no automatic backups** — continuous backups/point-in-time recovery are a paid-tier feature. If backups matter, the free workaround is a manual or scheduled `mongodump` (e.g. via a scheduled GitHub Action) run periodically against the Atlas connection string.

---

## ✅ Pre-Launch Checklist

- [ ] MongoDB Atlas M0 cluster created, database user + network access (`0.0.0.0/0`) configured, `MONGODB_URI` set in Render env vars
- [ ] All env vars set on both Vercel and Render, no secrets in git history
- [ ] Admin password rotated from the seeded default
- [ ] `CLIENT_ORIGIN` on Render locked to the exact Vercel production domain
- [ ] Cookie `SameSite`/`Secure` settings correct for the cross-domain setup (verify a login round-trip in the deployed app, not just locally)
- [ ] Health check endpoint live at `/api/v1/health` (verifying a real Mongoose connection, not just readyState) and set in Render's health check config
- [ ] (Optional) External uptime pinger set up to reduce cold starts
- [ ] Error tracking (Sentry free tier) receiving events, if `SENTRY_DSN` is set
- [ ] Sitemap/robots.txt reachable at the production Vercel domain
- [ ] Contact form email delivery tested against the real provider (Resend/SMTP)
- [ ] Manual/scheduled `mongodump` backup process set up if backups matter to you
