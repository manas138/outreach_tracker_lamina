# Outreach Tracker

A self-hosted Next.js dashboard that scrapes your Gmail sent folder on an hourly schedule, classifies each thread as **Replied**, **Bounced**, or **No response**, and displays everything in a filterable dashboard. Designed to deploy to Vercel in about 15 minutes.

## What it tracks

For every sent thread matching your Gmail search query, the dashboard shows:

- Company (derived from recipient domain)
- Primary recipient
- Subject
- Sent date
- Status badge (Replied / Bounced / No response)
- Reply snippet or bounce detail
- Totals and reply rate across the campaign

The data refreshes every hour via Vercel Cron and is stored in Supabase (free tier is more than enough).

## Stack

- Next.js 14 App Router (TypeScript + Tailwind)
- Supabase Postgres for persistence (anon-key reads for the dashboard, service-role writes for the cron)
- Gmail API via `googleapis` with an OAuth refresh token
- Vercel Cron for the hourly `/api/cron/refresh` call

---

## 1. Supabase

A Supabase project has already been provisioned for this tracker:

- Project ID: `sobakkovbsjhzdoyuvjs`
- URL: `https://sobakkovbsjhzdoyuvjs.supabase.co`
- Region: `ap-south-1`

The schema (`threads` + `sync_state` tables, row-level security, anon read policies) is already applied.

From the Supabase dashboard, grab:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** (Project Settings → API) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** (same page, keep secret) → `SUPABASE_SERVICE_ROLE_KEY`

If you want to stand up a fresh project instead, run the migration in `supabase/migrations/0001_init.sql` (see bottom of this file).

## 2. Gmail OAuth credentials

The cron job calls the Gmail API on your behalf with a refresh token. Create one once:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create (or pick) a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → choose **External**, fill in app name, add your own Gmail address as a test user, save. You don't need to publish.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: anything
   - Authorized redirect URIs: `http://localhost`
   - Click create, copy the **Client ID** and **Client secret**.

Then, on your laptop:

```bash
cp .env.example .env.local
# fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
npm install
npm run get-token
```

The helper prints a consent URL. Open it, sign in as `manas@getmason.io`, approve the `gmail.readonly` scope. Your browser will redirect to `http://localhost/?code=...&scope=...` and likely show a "can't connect" page — that's fine. Copy the `code=` value out of the URL bar and paste it into the terminal. You'll get a `GOOGLE_REFRESH_TOKEN=...` line to paste into `.env.local`.

Keep that refresh token. It's long-lived but will be revoked if you delete the OAuth client or change the scope list.

## 3. Environment variables

Fill in `.env.local` (for local dev) and mirror them in Vercel → Project Settings → Environment Variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, used by the dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, used only server-side by the cron |
| `GOOGLE_CLIENT_ID` | OAuth client ID from step 2 |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from step 2 |
| `GOOGLE_REFRESH_TOKEN` | Output of `npm run get-token` |
| `OUTREACH_QUERY` | Gmail search query, e.g. `in:sent subject:"Shopify x Creative Magic"` |
| `OUTREACH_SENDER` | Your sender email, e.g. `manas@getmason.io` — used to decide which messages in a thread count as "from us" |
| `OUTREACH_MAX_THREADS` | Optional, caps threads per refresh. Default 500. |
| `CRON_SECRET` | Random string. Vercel Cron sends it as `Authorization: Bearer ...` |

Generate a cron secret with e.g. `openssl rand -hex 32`.

## 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On a fresh database the table will be empty until you trigger a sync:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/refresh
```

That response should look like `{"ok":true,"scanned":58,"upserted":58,"query":"..."}`. Reload the dashboard.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project**, import the repo.
3. Paste every env var from the table above into **Environment Variables**, then Deploy.
4. `vercel.json` already schedules `/api/cron/refresh` every hour — nothing else to configure. Vercel automatically includes the `CRON_SECRET` as the Bearer token on the scheduled call.

You can also trigger it manually from **Deployments → Functions → /api/cron/refresh → Run** or from your terminal with the same `curl` command pointing at your production URL.

## 6. Changing the query

Edit `OUTREACH_QUERY` in Vercel and redeploy (or run the cron manually). Any Gmail search operator works: `in:sent`, `subject:"..."`, `after:2026/01/01`, `to:@shopify.com`, etc.

If you switch campaigns, clear the old rows first:

```sql
delete from threads;
delete from sync_state;
```

## 7. How classification works

For every thread matching your query, the scraper finds the first message whose `From` header matches `OUTREACH_SENDER`, then scans the rest of the thread:

- If any later message comes from `mailer-daemon@...` or has a subject like **"Delivery Status Notification"** / **"Undeliverable"** → **Bounced**. The scraper extracts which specific recipient bounced from the DSN snippet.
- Else, if any later message comes from a different (non-mailer-daemon) address → **Replied**. The sender and first 500 chars of the reply are stored.
- Otherwise → **No response**.

Everything is upserted by `thread_id`, so re-running the cron never creates duplicates — it just updates statuses as replies and bounces arrive.

## 8. Troubleshooting

**"Missing GOOGLE_CLIENT_ID..."** — Env vars aren't set. For local dev, check `.env.local`. On Vercel, check Project Settings → Environment Variables and redeploy.

**Cron returns 401** — Your `Authorization: Bearer ...` header doesn't match `CRON_SECRET`. Vercel Cron sends this automatically for production; for manual testing you have to include it yourself.

**Empty dashboard after a successful sync** — Row level security may be blocking the anon key. Confirm the `Allow anon read` policies exist on both tables (they were created by the migration).

**Refresh token is invalid** — Google revokes refresh tokens if the OAuth client is deleted or the scope changes. Run `npm run get-token` again.

**Function timeout** — The cron endpoint has `maxDuration = 60` (Hobby plan limit). For campaigns with more than ~500 threads, lower `OUTREACH_MAX_THREADS` or upgrade the plan to extend it.

---

## Schema (for reference)

```sql
create table threads (
  thread_id            text primary key,
  subject              text,
  recipients           text[],
  primary_recipient    text,
  company              text,
  sent_at              timestamptz,
  status               text check (status in ('Replied','Bounced','No response')),
  detail               text,
  reply_from           text,
  reply_snippet        text,
  message_count        int,
  updated_at           timestamptz default now()
);

create table sync_state (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

alter table threads enable row level security;
alter table sync_state enable row level security;

create policy "Allow anon read" on threads for select to anon using (true);
create policy "Allow anon read" on sync_state for select to anon using (true);
```

The service role key bypasses RLS, so the cron writes freely. The dashboard uses the anon key, which can only read.
