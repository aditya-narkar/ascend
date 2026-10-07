# ASCEND

Gamified personal-development PWA: ranks, levels, stats, 21-day quest cycles, streaks, penalties and web-push reminders. Next.js (App Router) + Supabase.

## Run

```bash
npm install
# create .env.local with the variables listed under "Environment variables" in memory.md
npm run dev
```

Apply the `supabase-*.sql` files to your Supabase project (start with `supabase-schema.sql`; see `memory.md` for the full list and order), and deploy the edge functions in `supabase/functions/`.

## Docs

`memory.md` is the architecture and rules handoff: game mechanics, schema, date/timezone conventions, notifications, deployment and known quirks. Read it before changing behavior.
