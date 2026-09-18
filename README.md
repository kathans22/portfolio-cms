# Portfolio & CMS Monorepo Platform

A production-grade developer portfolio and admin CMS, built with React 18, Express, TypeScript, and MongoDB (Mongoose).

---

## 🏗️ Architecture

```
┌────────────────────┐        REST (/api/v1, JSON)        ┌─────────────────────┐
│   apps/client       │ ─────────────────────────────────▶ │   apps/server        │
│   React 18 + Vite   │ ◀───────────────────────────────── │   Express + TS       │
│                     │                                     │                      │
│  • Public site      │        JWT access token (header)   │  • REST route modules│
│    (Home, Projects, │        + refresh token (httpOnly   │    (projects, blog,  │
│     Blog, About,    │        cookie, rotated on use)      │     skills, media…)  │
│     Contact)        │                                     │  • JWT auth + CSRF   │
│  • Admin CMS        │                                     │    double-submit     │
│    (/admin/*, guard-│                                     │  • Audit log         │
│    ed by RequireAuth│                                     │  • Rate limiting     │
│    + JWT)           │                                     └──────────┬───────────┘
└─────────┬───────────┘                                                │ Mongoose
          │ imports types/schemas                                     ▼
          │                                                  ┌──────────────────┐
          ▼                                                  │     MongoDB       │
┌───────────────────────────────┐                            │ (Atlas / local)   │
│  packages/shared               │                            └──────────────────┘
│  Zod schemas — single source   │
│  of truth for validation;      │
│  types derived via z.infer     │
├────────────────────────────────┤
│  packages/types                │
│  Plain TS interfaces for       │
│  Mongoose document shapes as   │
│  returned over the API         │
└────────────────────────────────┘
```

- **`apps/client`** — the public portfolio site and the `/admin` CMS panel, in one React app. Routes are code-split with `React.lazy` so the admin bundle (recharts, prism syntax highlighting, drag-and-drop editors) never ships to public visitors, and vice versa.
- **`apps/server`** — a modular Express API. Each content type (`projects`, `blog`, `skills`, `experience`, `education`, `testimonials`, `messages`, `media`, `analytics`, `resume`, `auth`) is its own module under `src/modules/<name>/` with its own Mongoose model, route file, and (where covered) test file.
- **`packages/shared`** — Zod validation schemas (`projectSchema`, `blogSchema`, `contactSchema`, …). Both the client (`react-hook-form` + `@hookform/resolvers/zod`) and the server (`validateRequest` middleware) validate against the exact same schema, and both derive their TypeScript input types from it via `z.infer` — there is no manually-kept-in-sync duplicate type.
- **`packages/types`** — plain TypeScript interfaces describing the shape of documents as the API actually returns them (after `id`/`_id` normalization). Used by the client to type `useQuery`/`useMutation` results without pulling in Mongoose.

### Request flow

1. Public pages fetch content via `optionalAuth`-guarded GET endpoints (drafts are hidden unless an admin bearer token is present).
2. Admin CMS pages authenticate via `POST /auth/login`, storing a short-lived access token in memory/localStorage and receiving a long-lived refresh token as an httpOnly cookie plus a readable CSRF cookie (double-submit pattern) used only on `/auth/refresh`.
3. All admin writes (`POST`/`PATCH`/`DELETE`) go through `requireAdmin` and `validateRequest(<schema>)`, so no invalid or unauthenticated write reaches MongoDB.
4. List endpoints are additively paginated: passing `?page=&limit=` returns `{ data, pagination }`; omitting both keeps returning the plain array, so existing callers are unaffected.

---

## 🧭 The boundary: what needs a deploy and what doesn't

This is the line the CMS is built around. Keep it.

### No deploy required

- Create, delete, rename, reorder and nest routes and sub-routes.
- Add, remove, reorder and hide sections on any page.
- Change what a section queries (domains, tags, skills, featured-only, limit, sort).
- Change any section's layout variant, background, padding, width, columns, alignment.
- All content, CTA and SEO edits.
- Navigation structure.
- Publish and unpublish.

### Deploy required

- A genuinely new *kind* of section (a new component).
- Changes to a component's internal design beyond its exposed variants and style options.
- A new typed collection.
- Anything touching auth or the API contracts.

### Cutting a page over to the CMS

`npm run db:backfill-pages -- --apply` creates `/`, `/projects`, `/about`,
`/certifications`, `/blog` and `/contact` as Page documents whose sections mirror what the
hand-built components render today. They are published and admin-editable immediately, but
**they do not render yet**: `App.tsx` still declares a hardcoded route for each path, and a
hardcoded route always beats the resolver catch-all.

Cutting one over is deleting its `<Route>` line from `apps/client/src/App.tsx`. Do it one
page at a time and look at the result, because the swap is not guaranteed to be
pixel-identical — a bespoke component may do things its section equivalents cannot:

| Page | Cutover risk |
| --- | --- |
| `/contact`, `/blog` | Low — a single section reproduces the whole page. |
| `/certifications` | Low — the `grouped` variant reproduces the domain grouping. |
| `/projects` | Low — the `filtered` variant reproduces both filter controls. |
| `/about` | Medium — prose lives in content blocks now, so re-read the copy once. |
| `/` | **High — do not cut over without looking.** The hand-built home page has bespoke hero visuals and layout that `HERO` does not reproduce. Widen the `HERO` variants first, or leave home hardcoded. |

Reverting is putting the `<Route>` line back. Nothing about the Page document changes
either way, so this is safe to trial.

### Two rules that keep the boundary honest

**Widen before you add.** If a new section type seems necessary more than roughly once a
month, the registry is too coarse and the variants too narrow. Widen `variants` and
`styleOptions` first; add a type only when the thing genuinely has no relation to what
already exists. Step 11 of the build order is the worked example: the hand-built
`/projects` and `/certifications` pages had client-side filtering and domain grouping that
no section could express. The fix was a `filtered` variant on `PROJECT_LIST` and a
`grouped` variant on `CERTIFICATION_LIST` — not two new section types. Both filter the
items the resolver already returned, so the one-request-per-page rule still holds.

**Do not evolve this into a free-form drag-and-drop visual builder.** That is a different
product. It produces inconsistent design in the hands of its own author, and a portfolio's
credibility rests on visual consistency far more than on layout freedom. The constraint —
a fixed set of section types, each with a fixed set of variants — is the feature. Every
page composed from it looks like it belongs to the same site, which is the entire point.

---

## 📄 Résumé

Admin uploads PDF versions of the CV at `/admin/resume`. Every upload is its own
document — files are never overwritten — and exactly one row is `isActive` (enforced by
a partial unique index, not just app logic). The public site links to whichever version
is active:

- `GET /api/v1/resume` — metadata for the active version, or 404. Only the active row is
  ever exposed; storage keys and inactive versions never cross this boundary.
- `GET /api/v1/resume/download` — 302 to the active file. A stable link that keeps
  working after a rollback, so it's safe to share directly.

The first upload goes live automatically. After that, switching what the site shows is
one **Activate** click on any row (upload a new PDF, or re-activate an old one to roll
back). The active version cannot be deleted — activate a different one first.

Uploads are validated by **magic bytes** (`%PDF-`), not by the file extension or the
declared `Content-Type`, both of which the client controls. Max 8 MB.

> **Content practice, not code:** upload a public-safe PDF (email + city, no phone or
> street address). A public file URL gets harvested by scrapers and a CDN copy can't be
> recalled. Hand the full-detail version directly to recruiters who make contact.

> **Cloudinary:** PDF delivery is blocked by default on new accounts. If resume links
> return 401/403 from `res.cloudinary.com`, enable **Settings → Security → Allow
> delivery of PDF and ZIP files**. With no Cloudinary credentials set, files are served
> from the local `/uploads` directory instead (fine for a single Render instance; note
> Render's free tier has an ephemeral filesystem, so prefer Cloudinary in production).

---

## ⚡ Performance model

**One request per page view.** A CMS page's sections are expanded server-side by the
resolver (`GET /api/v1/resolve?path=…`), so the browser makes exactly one call regardless
of how many sections the page has. Section components are purely presentational and never
fetch — a section that loaded its own data would reintroduce the request waterfall the
resolver exists to remove, and that waterfall grows with page complexity.

**Caching.** Resolved public pages are held in an in-process `Map`, keyed by path, with a
60-second TTL. Each entry records which collections it was built from, so writing a
Project busts the cached `/work` page that lists it — not just `/projects/<slug>`.
Invalidation is registered on the Mongoose schemas
(`invalidatesResolveCache(Schema, 'Project')`), not in individual admin routes, so a route
added later inherits it rather than silently serving stale content. Responses carry a
strong ETag and `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

The derived list endpoints — `/nav`, `/sitemap`, `/sitemap.xml` — use the same
`Map` (via `getDerived` / `setDerived`) tagged with the models they read (`Page`, plus
`Project` and `BlogPost` for the XML sitemap), so the schema hooks that already bust the
page cache bust these too. A page deleted or published in the CMS drops out of the menu
immediately for a fresh visitor, instead of riding a `Cache-Control` header for minutes.
Their wire cache is correspondingly short (`max-age=30, stale-while-revalidate=120`) since
it no longer has to paper over staleness; the client (`useNav`) mirrors this with a
60-second `staleTime`.

> **This cache is per-process, and that is a deliberate choice.** On a single free-tier
> Render instance an in-process Map is sufficient and costs nothing to boot. Do not add
> Redis for a portfolio. **If you ever scale to more than one instance**, each would hold
> its own copy and a publish would only invalidate the instance that served the write —
> at that point either move to a shared cache (Redis) or drop the TTL low enough that the
> staleness window is acceptable. Nothing else in the code needs to change.

**Cold starts dominate latency** on Render's free tier — far more than any query. The
resolver's dependency graph is deliberately light for that reason; adding a heavyweight
import to the boot path costs every visitor who arrives on a cold instance.

**Indexes.** `Page` is indexed on `path` (unique among non-deleted rows),
`previousPaths`, `{ status, showInNav, navOrder }` and `{ parentId, navOrder }` — covering
every read the resolver, nav and sitemap perform.

> **Index drift is real and the test suite cannot catch it.** Mongoose only ever *creates*
> missing indexes at boot. It never alters an existing index whose options changed, and
> never drops one whose declaration was removed — so a long-lived database silently
> diverges from the schema, while tests keep passing because `mongodb-memory-server`
> starts empty and always builds exactly what is declared.
>
> This bit for real: `path` began as a plain unique index and later became partial on
> `deletedAt`, so that a soft-deleted page frees its URL. On a database still carrying the
> old index, recreating a page at a deleted page's URL failed outright.
>
> ```bash
> npm run db:indexes              # report drift, changes nothing
> npm run db:indexes -- --apply   # drop the extras, build the missing ones
> ```
>
> Run the report after any deploy that changed an index declaration. Dry-run is the
> default because `--apply` drops indexes and a rebuild can block writes on a large
> collection. Creating a page whose path the database rejects now returns a 409 with an
> explanation rather than a 500.

**Projections.** Public list sections `.select()` only the fields their components render,
and certifications go through an explicit `toPublicCertification` allowlist. Whole
documents are never returned to the public API: that would publish every field added to a
model later, by default and silently.

---

## 🛠️ Tech Stack

- **Client**: React 18, React Router v6, TanStack Query, React Hook Form + Zod resolvers, Zustand, Tailwind CSS, Framer Motion, Vite.
- **Server**: Node.js, Express, TypeScript, MongoDB via Mongoose, JWT (access header + refresh httpOnly cookie with rotation), Helmet, CORS (env-driven allowlist), express-rate-limit, DOMPurify-sanitized rich content, audit logging.
- **Shared**: Zod (`packages/shared`) as the single source of truth for both validation and types; a plain-interface package (`packages/types`) for API response shapes.
- **Testing**: Vitest everywhere. `supertest` + `mongodb-memory-server` for server API integration tests; `@testing-library/react` for client component tests.
- **Tooling**: ESLint 9 (flat config, separate rule sets for client/browser vs server/Node code), Prettier, npm workspaces.

---

## 📁 Monorepo Layout

```
apps/
  client/   React 18 + Vite frontend (public site + admin CMS)
  server/   Express + TypeScript REST API
packages/
  shared/   Zod schemas + inferred input types (z.infer)
  types/    Plain TS interfaces for API document shapes
```

---

## 🚀 Setup & Launch

### Prerequisites
- Node.js 18+
- A MongoDB instance — local (via Docker) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

### 1. Install dependencies
From the repo root (installs and links all workspaces):
```bash
npm install
```

### 2. Configure environment variables
Copy each `.env.example` to `.env` and fill in real values:
```bash
cp .env.example .env                       # server env (root-level, read by apps/server)
cp apps/client/.env.example apps/client/.env
```
Every variable in both files is documented inline with a comment explaining what it's for and what happens if it's left unset. At minimum for local dev you need `MONGODB_URI` and the JWT secrets in the root `.env`; the client `.env` can be left as-is for local development (it defaults to `http://localhost:5000/api/v1`).

### 3. Start MongoDB locally (optional)
If you have Docker installed:
```bash
docker-compose up -d
```
Otherwise, point `MONGODB_URI` in `.env` at an Atlas connection string.

### 4. Seed the admin account
Creates/updates the one admin document from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` in `.env`:
```bash
npm run db:seed
```

### 5. Run the dev servers
```bash
npm run dev
```
This runs the client (`http://localhost:3000`) and server (`http://localhost:5000`) concurrently.
- Public portfolio: `http://localhost:3000/`
- Admin CMS: `http://localhost:3000/admin/login`

---

## ✅ CI-Ready Scripts

Run from the repo root — each fans out to every workspace that defines the matching script:

```bash
npm run lint        # ESLint across the whole repo (client, server, packages)
npm run typecheck   # tsc --noEmit in apps/client, apps/server, packages/shared, packages/types
npm run test        # Vitest in apps/client, apps/server, and packages/shared
npm run build       # Production build for apps/client (Vite) and apps/server (tsc)
```

Server tests spin up an in-memory MongoDB (`mongodb-memory-server`) automatically — no external database is required to run the test suite. Client component tests run in `jsdom` with `@testing-library/react` and `@testing-library/jest-dom`.

---

## 📦 Deployment

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for the full guide to deploying `apps/server` to Render and `apps/client` to Vercel, including required production environment variables.
