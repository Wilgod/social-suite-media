# social-suite-media

A monorepo (npm workspaces) for Social Suite: a `web` app (Next.js), a `worker` (pg-boss job processor), and shared `packages` (core, db, platforms, queue).

## Prerequisites

- Node.js >= 22.12.0
- A running Postgres instance

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values:

   - `DATABASE_URL` — Postgres connection string
   - `TOKEN_ENCRYPTION_KEY` — base64 32-byte key, generate with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `NEXTAUTH_SECRET` — Auth.js session secret
   - Storage vars (`STORAGE_*`) — only needed for media upload features (Cloudflare R2 or S3-compatible)

3. Generate the Prisma client and run migrations:

   ```
   npm run db:generate
   npm run db:migrate
   ```

## Running the app

Run the web app and worker in separate terminals:

```
npm run dev:web
```

Serves the Next.js app over HTTPS at `https://localhost:3000` using the dev certs in `apps/web/certs`.

```
npm run dev:worker
```

Runs the background job processor (pg-boss).

## Using the app

The homepage (`/`) is a bare scaffold with no navigation. To sign in or create an account, go directly to:

- `/signup` — create an account (creates a `User`, `Organization`, and owner `Membership`)
- `/login` — sign in with email/password
- `/dashboard` — main app (requires auth)

There is no seeded/default account and no password-reset flow yet — sign up to create the first account.

## Video publishing platforms

The worker publishes each `PostTarget` through a `PlatformAdapter`. Current coverage:

- **YouTube / Instagram** — existing production adapters
- **Facebook** — Page OAuth, video publish via Graph `file_url`, comments and view/like/share metrics
- **Xiaohongshu** — official OAuth skeleton; silent note publish waits on approved content capabilities
- **Bilibili** — OAuth skeleton; chunked archive upload is the next wiring step
- **Douyin** — OAuth skeleton; silent publish waits on `video.create.bind` approval

Per-post metrics and comments are stored in `post_target_metric_snapshots` / `post_comments` and refreshed every 15 minutes.

## Other scripts

- `npm run db:migrate` — run Prisma migrations (dev)
- `npm run build` — build all packages and apps
