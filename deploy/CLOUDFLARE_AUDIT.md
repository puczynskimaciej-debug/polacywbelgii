# Cloudflare Pages migration audit

This document records the repository state before the migration. The production
site, Netlify configuration and DNS remain unchanged on the `main` branch.

## Build and static site

- Eleventy 3 reads `src/` and writes `_site/` (`.eleventy.js`).
- `admin-app/` is copied to `_site/admin/`. Articles are Markdown in
  `src/content/articles/`; the home page and site settings are JSON in
  `src/_data/`. Uploaded media lives in `src/Images/uploads/` and is copied to
  `_site/images/uploads/`.
- Four language versions are rendered by shared templates and browser scripts.
  The map and regional filtering are browser-side and do not require a platform
  service.
- `.local/` demo data is copied into builds unless `CONTEXT=production`.
  Cloudflare builds must set `CONTEXT=production` to avoid publishing local demos.

## Dynamic behavior and platform dependencies

| Feature | Current implementation | Migration requirement |
| --- | --- | --- |
| Ads, booking and images | `netlify/functions/ads.mjs` wraps `server/handlers/ads.js`; PostgreSQL in `server/ads-store.js` | Pages Function and D1 data layer; migrate existing orders, settings and image data |
| CMS authentication | Email/password with scrypt; PostgreSQL users and sessions | OAuth identity and D1 sessions/users; preserve roles and access controls |
| CMS content and media | Authenticated GitHub Contents API through `cms-content` function and `CMS_GITHUB_TOKEN` | Pages Function with the same path and content validation; server-side token |
| Contact form | Netlify Forms via `data-netlify` in `src/kontakt.njk` | Pages Function and a way for editors to receive/read submissions |
| Health endpoint | PostgreSQL and Netlify environment checks | D1, OAuth and publishing checks |
| Auto publishing | GitHub changes to `main` trigger Netlify | Cloudflare Pages Git integration on the migration branch for preview, then later a planned production switch |

The current CMS does **not** implement GitHub OAuth. GitHub is used only by the
server-side content API to read and write repository files. The UI also has
password management and administrator/editor roles. OAuth is a new capability,
not an existing adapter to move.

All browser references to `/.netlify/functions/` occur in
`admin-app/modules/client.js`, `src/ads.js` and `src/order-modal.js`. The
ads handler generates image URLs with the same prefix. The contact form is
the other direct Netlify dependency. `netlify.toml` supplies the build,
functions, headers and `/admin/*` fallback.

## Data and security boundaries

- PostgreSQL schema is in `deploy/ads.sql` and `deploy/cms.sql`; four Netlify
  migrations include initial content and demonstration ads. Existing records
  must be exported and imported without deleting the source database.
- CMS file writes are restricted by `server/cms-content.js`, use SHA conflict
  checks and write to `CMS_GITHUB_BRANCH` (currently `main` by default).
- Production secrets belong in Cloudflare encrypted secrets, never in static
  assets or Git. The preview Pages origin needs its own GitHub OAuth callback.
- D1 is SQLite, so PostgreSQL SQL and transactions cannot be copied verbatim.
  Booking capacity needs atomic writes in the new data layer.
- Cloudflare Workers Free has a 10 ms CPU limit per invocation. Existing
  scrypt password verification is too expensive to assume it will fit;
  OAuth avoids that operation. Other functions still require runtime checks.

## Migration gates

1. Prepare Pages Functions, D1 schema, OAuth, contact handling and an import
   tool on `cloudflare-migration`; keep Netlify files intact.
2. Create a separate Pages project and D1 database; bind D1 and add secrets.
   Set the Pages production branch to `cloudflare-migration` and build output
   to `_site`. This provides a `pages.dev` address without changing the public
   domain or Netlify site.
3. Export the current PostgreSQL data, import a copy to D1, and verify counts
   and key fields. Keep the source unchanged.
4. Verify complete site and CMS behavior on `pages.dev`, including OAuth,
   GitHub writes and resulting Pages deploys.
5. Plan the domain switch separately; never change DNS during this migration.

No Cloudflare project or database has been created by this audit.
