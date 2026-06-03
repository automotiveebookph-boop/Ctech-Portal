# CTech Fleet Connect — Quote + PMS SMS Automation (External Supabase Setup)

All artifacts here are for your **external** Supabase project `azcrctokesvpwxdptatl` (where `vehicles`, `fleet_clients`, etc. live). Nothing in this folder runs against Lovable Cloud.

---

## 1) Apply the SQL migration

Open `azcrctokesvpwxdptatl` → **SQL Editor** → paste the contents of:
- `migrations/20260527_quotes_and_pms_automation.sql`

Creates: `quotations`, `quote_line_items`, `notification_queue`, `pms_sms_log`, the `updated_at` trigger, and the `quotations → notification_queue` enqueue trigger. RLS scoped to `admin` + `fleet_manager.client_id`.

> Assumes `fleet_clients` has an `email` and a `contact_number` (or `phone`) column. If not, add them:
> ```sql
> ALTER TABLE public.fleet_clients
>   ADD COLUMN IF NOT EXISTS email TEXT,
>   ADD COLUMN IF NOT EXISTS contact_number TEXT;
> ```

---

## 2) Set Edge Function secrets

In `azcrctokesvpwxdptatl` → **Project Settings → Edge Functions → Secrets**:

| Secret | Example | Used by |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx` | quote notifications |
| `RESEND_FROM_EMAIL` | `CTech <quotes@ctechportal.com>` | quote notifications |
| `CTECH_ADMIN_EMAIL` | `admin@ctechportal.com` | quote notifications |
| `SEMAPHORE_API_KEY` | from semaphore.co dashboard | PMS SMS |
| `SEMAPHORE_SENDERNAME` | `CTECH` (must be approved by Semaphore) | PMS SMS |
| `AUTOMATION_CRON_SECRET` | any long random string | both (header auth) |
| `PUBLIC_SITE_URL` | `https://ctechportal.com` | quote email link |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

---

## 3) Deploy the two Edge Functions

Copy both folders into your local Supabase CLI project:

```
supabase/functions/_shared/cors.ts
supabase/functions/process-quote-notifications/index.ts
supabase/functions/send-pms-reminder-sms/index.ts
```

Then:
```bash
supabase functions deploy process-quote-notifications --project-ref azcrctokesvpwxdptatl
supabase functions deploy send-pms-reminder-sms       --project-ref azcrctokesvpwxdptatl
```

(Or paste each `index.ts` into Dashboard → Edge Functions → New Function.)

---

## 4) Test — quote notification

Insert a test quote in SQL Editor (the trigger enqueues a job automatically):

```sql
WITH c AS (SELECT id FROM public.fleet_clients LIMIT 1),
     v AS (SELECT id FROM public.vehicles LIMIT 1),
     q AS (
       INSERT INTO public.quotations (quote_number, client_id, vehicle_id, total_amount, valid_until, notes)
       SELECT 'Q-TEST-001', c.id, v.id, 3500, current_date + 7, 'Test quote'
       FROM c, v RETURNING id
     )
INSERT INTO public.quote_line_items (quote_id, description, qty, unit_price)
SELECT q.id, 'OIL-5L-FS-5W30 oil change', 1, 3500 FROM q;
```

Then drain the queue:
```bash
curl -X POST \
  -H "x-cron-secret: <AUTOMATION_CRON_SECRET>" \
  https://azcrctokesvpwxdptatl.supabase.co/functions/v1/process-quote-notifications
```

Expected: response `{"processed":1,"results":[{"id":"...","ok":true}]}` and email arrives at `CTECH_ADMIN_EMAIL` (and at the client's `email` if set). Verify:
```sql
SELECT id, type, status, sent_at, last_error FROM public.notification_queue ORDER BY created_at DESC LIMIT 5;
```

---

## 5) Test — PMS SMS in dry-run mode

```bash
curl -X POST \
  -H "x-cron-secret: <AUTOMATION_CRON_SECRET>" \
  "https://azcrctokesvpwxdptatl.supabase.co/functions/v1/send-pms-reminder-sms?dry_run=true&limit=20"
```

Nothing is sent to Semaphore. Each candidate vehicle is logged with `status='dry_run'`. Inspect:
```sql
SELECT created_at, phone, message, status FROM public.pms_sms_log
WHERE dry_run = true ORDER BY created_at DESC LIMIT 20;
```

When ready to send for real, drop `dry_run=true`.

---

## 6) Schedule both with pg_cron (optional)

In SQL Editor (after enabling `pg_cron` and `pg_net` extensions):

```sql
-- Process queued quote notifications every 2 minutes
SELECT cron.schedule(
  'process-quote-notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://azcrctokesvpwxdptatl.supabase.co/functions/v1/process-quote-notifications',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<AUTOMATION_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Send PMS reminders once a day at 9am Manila (01:00 UTC)
SELECT cron.schedule(
  'send-pms-reminder-sms-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://azcrctokesvpwxdptatl.supabase.co/functions/v1/send-pms-reminder-sms',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<AUTOMATION_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## Security notes
- Edge Functions only run with the `x-cron-secret` header — unauthenticated calls return 401.
- API keys live as Supabase secrets, never in frontend code.
- RLS lets fleet managers see only their client's quotes and SMS log; only admins can read the notification queue.
- The DB trigger uses `SECURITY DEFINER` so unprivileged inserts to `quotations` still enqueue a job.
