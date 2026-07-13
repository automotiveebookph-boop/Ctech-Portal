# C-Tech Automotive — Setup & Operations Reference

Last updated: 2026-07-12

This is the practical reference for how the C-Tech landing site and staff portal
are wired together — domains, logins, bookings, email, and how to deploy.

---

## 1. Domains & what's deployed where

| URL | What it is | Vercel project |
|---|---|---|
| **ctechautomotiveph.com** (+ www.ctechautomotiveph.com, estimate.ctechautomotiveph.com) | Public landing / free-estimate site (static) | `ctech-landing` |
| **admin** / **fleetadmin** / **portal** / **fleet** `.ctechautomotiveph.com` (+ ctech-portal.vercel.app) | Staff & client **portal / app** — one app, four login "doors" (see §2) | `ctech-portal` |
| ctechportal.com | Intended portal domain — **DNS not pointed at Vercel yet**, does not load | `ctech-portal` |

- The domain runs on **Vercel nameservers**, so subdomains auto-provision DNS + SSL.
- All four portal subdomains serve the **same** `ctech-portal` app; the app reads the
  hostname to show the right login page (`src/lib/subdomain.ts`).
- To activate `ctechportal.com`: at the registrar (name.com), switch nameservers to
  `ns1.vercel-dns.com` / `ns2.vercel-dns.com`, or add `A ctechportal.com 76.76.21.21`.

---

## 2. Logging into the portal — four separate login doors

Each audience has its own subdomain + login page. Signing in on the **wrong** door is
rejected with a hint pointing to the correct one. (Same app, routed by hostname.)

| Login URL | Who | Allowed role | Lands on |
|---|---|---|---|
| **admin.ctechautomotiveph.com/login** | Shop admin | `admin` | Walk-in / Shop panel (`/admin/walkin`) |
| **fleetadmin.ctechautomotiveph.com/login** | Fleet service admin | `admin` | Fleet panel (`/admin`) |
| **portal.ctechautomotiveph.com/login** | Retail client | `customer` | `/my-car` |
| **fleet.ctechautomotiveph.com/login** | Fleet client | `fleet_manager` | `/dashboard` |

- **Admin account:** `automotiveebookph@gmail.com` (the only `admin` role). It's the **same
  login** for both `admin` and `fleetadmin` — the subdomain just decides which panel opens.
- Sessions are **per-subdomain** (per-origin), so each door is signed into independently.
- Forgot password → **"Forgot password?"** on any door (reset link returns to that same
  subdomain; each must be in Supabase's redirect allowlist — see §6).
- New public sign-ups (via **Request access**, shown only on the client doors) default to
  the **customer** role.

---

## 3. Booking / appointment approvals

- Customers reserve a slot on the landing page's estimate tool.
- Each reservation becomes a **pending appointment** in the portal.
- **Approve here:** https://admin.ctechautomotiveph.com/admin/appointments
  (sidebar → **Appointments**; badge shows the pending count).
- Confirm / Cancel there. Cancelling frees the slot again.
- Walk-in contact details are in the appointment's **Notes** field
  (`Landing reservation · Name … · Contact … · Email … · Vehicle …`).
- **Slot capacity / open days:** managed at **/admin/schedules**. Default is
  **2 slots per time block**. Sundays and any dates in `blocked_dates` are closed.
- Time blocks: `8:00 AM–10:00 AM`, `10:00 AM–12:00 PM`, `1:00 PM–3:00 PM`, `3:00 PM–5:00 PM`.

### How it works under the hood
- Supabase project **`azcrctokesvpwxdptatl`** ("C-Tech Fleet Portal") is the live DB.
- Landing calls two `SECURITY DEFINER` RPCs (no direct table access):
  - `landing_slot_availability(date)` → remaining slots per time.
  - `landing_book_slot(...)` → inserts a `pending` row into `appointments`.
- The `notify_new_appointment` trigger sends the normal new-appointment alert.

---

## 4. Notifications — Telegram vs Email

The shop is notified on two different events, through two different channels:

| Customer action | Shop notified via | Customer gets |
|---|---|---|
| **Generates an estimate** (lead) | **Telegram only** (`/api/notify-telegram`) | nothing yet |
| **Books a slot** ("Reserve my Slot") | **Email** (`/api/send-email` → Resend) + the pending appointment | their estimate/confirmation email |

- No email is sent to the shop just for generating an estimate — only a Telegram ping.
- The customer receives their estimate email at **booking** time (not while tweaking options).
- Shop booking emails go to **`ctechautomotive.ph@gmail.com`** (the `ADMIN` address in
  `send-email.js`) — note this differs from the admin *login* `automotiveebookph@gmail.com`.

### Email (Resend)
- All landing emails go through **Resend** via the serverless function
  `/api/send-email` (Formspree has been removed).
- **Verified sender:** `noreply@ctechautomotiveph.com`.
  ⚠️ Do **not** use `@ctechportal.com` — it is unverified and Resend silently drops it.
- Customer activation invites are sent by the `activate-customer` edge function,
  also from the verified sender.

---

## 5. Deploying

- **Landing site:** from the repo root, run:
  ```bash
  bash landing/deploy.sh
  ```
  This syncs `ctech-landing.html` → `landing/index.html`, copies `services.html`
  and assets, then `vercel deploy --prod`. Aliased to ctechautomotiveph.com.
- **Portal app (`ctech-portal`):** deploys from the `src/` app (TanStack Start).
- **Supabase functions / RPCs:** deployed to project `azcrctokesvpwxdptatl`
  (edge functions + SQL migrations).

---

## 6. Password-reset / activation link routing (why it "just works")

Supabase's **Site URL** points at the landing domain, so reset & activation links
land there first. The landing page has a small script that detects
`type=recovery|invite` and forwards to `admin.ctechautomotiveph.com/reset-password`
with the tokens intact — so the user ends up on the portal's reset page.

*Optional cleanup:* in Supabase → Authentication → URL Configuration, set
**Site URL** to `https://admin.ctechautomotiveph.com` and add redirect URL
`https://admin.ctechautomotiveph.com/**`. Then the forwarding script becomes a
harmless no-op.

⚠️ **Now that there are four login doors (§2), each subdomain must be in the Supabase
redirect allowlist** for its "Forgot password?" link to return correctly. Add:
`https://fleetadmin.ctechautomotiveph.com/**`, `https://portal.ctechautomotiveph.com/**`,
`https://fleet.ctechautomotiveph.com/**` (admin.* already covered). Login itself works
without this — it only affects the reset flow.

---

## 7. This session's changes (2026-07-12)

- **Services page** (`services.html`) added and linked from the header nav.
- **Reviews carousel** — swipeable, auto-scrolling (arrows + drag + touch).
- **Odometer slider** — replaced preset chips with a 1k-step "loading bar" slider + swipe hint.
- **Formspree → Resend** — all landing emails now go through Resend.
- **Slot booking** — live availability + pending reservations into `appointments`; Sundays blocked.
- **Portal on `admin.ctechautomotiveph.com`** — new subdomain (auto DNS + SSL).
- **Auth bridge** — landing forwards Supabase reset/invite links to the portal.
- **`activate-customer`** — fixed invite redirect to the admin subdomain + verified sender.

---

## 8. Changes (2026-07-13)

- **`www.ctechautomotiveph.com` → landing** — moved from `ctech-portal` to `ctech-landing`,
  so `www` now shows the public site (matches the apex).
- **Edit / Reactivate appointments** — admin → Appointments now has an Edit button on every
  row (cancelled rows can be rescheduled + reactivated), backed by the admin-only
  `admin_edit_appointment` RPC.
- **Four login doors** — the portal now has separate, subdomain-scoped logins
  (`admin` / `fleetadmin` / `portal` / `fleet`); see §2. Wrong-door sign-ins are rejected
  with a hint. Deployed to prod via `vercel deploy --prod`.
- **Still pending:** add the three new subdomains to the Supabase reset-URL allowlist (§6).
