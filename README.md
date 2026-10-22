# Bog'cha boshqaruv tizimi

A management system for a kindergarten in Uzbekistan. It covers staff, staff check-in/out, children and groups, daily attendance, monthly fees, a parent portal, announcements and reports. The whole interface is in Uzbek (Latin script). It uses the Asia/Tashkent timezone, Uzbek date formats and amounts in so'm.

**Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Row Level Security), ExcelJS, jsPDF and Recharts.

---

## 1. Features

| Module | Page | What it does |
|---|---|---|
| Boshqaruv paneli | `/panel` | Today's child and staff attendance, monthly expected vs. collected revenue, debtors, a 6-month revenue chart and a 14-day attendance trend |
| Xodimlar | `/xodimlar` | Staff records (position, salary, schedule, hire date), create a login with a temporary password, deactivate an employee |
| Ishga kelish-ketish | `/ishga-kelish`, `/mening-kunim` | Staff tap "Ishga keldim" / "Ishdan ketdim". The **server time** is recorded. A second check-in on the same day is blocked and staff cannot edit their own records. Late, early-leave and outside-location flags are set automatically. Each record shows its source: self-reported, location-verified or biometric. Admins correct records only with a reason, and every correction is audited |
| Bolalar | `/bolalar` | Child profile with guardians, people allowed to pick up, medical/allergy notes, fee and discount. A parent login is created together with the guardian |
| Guruhlar | `/guruhlar` | Groups with age range, capacity, teachers and monthly fee |
| Bolalar davomati | `/davomat` | Mobile-first quick sheet with Keldi / Kelmagan / Kechikdi / Sababli kelmadi and a "mark everyone else present" button. Teachers see only their own groups. Edits to past days need a permission and a reason |
| Oylik to'lovlar | `/tolovlar` | Generates monthly invoices from group fee and child discount. Records partial and advance payments, adjustments with a reason (discount/charge) and payment reminders. Overpayment is blocked and duplicate payments are detected |
| To'lovlar tarixi | `/tolovlar-tarixi` | Every payment has a receipt number (`K-2026-000001`) and a PDF receipt. A payment is never deleted, only voided with a reason, and voids appear in the audit log |
| Hisobotlar | `/hisobotlar` | 6 reports (payments, payment history, debtors, child attendance, staff attendance, children), each exportable to Excel and PDF |
| E'lonlar | `/elonlar` | Announcements to everyone, all parents, all staff, one group or one guardian. Teachers can post to their own groups |
| Bildirishnomalar | `/bildirishnomalar` | In-app notifications for payments, new invoices, announcements and reminders |
| Ota-ona portali | `/ota-ona` | Parents see **only their own children**: today's attendance, a monthly calendar, payments and receipts, announcements and contacts |
| Foydalanuvchilar | `/foydalanuvchilar` | Roles, extra permissions, password reset (new temporary password), block/unblock |
| Sozlamalar | `/sozlamalar` | Kindergarten details, work hours, grace minutes, payment due day, GPS coordinates and radius, integration status |
| Audit jurnali | `/audit` | Who changed what, when and why (old/new values) |

**Roles:** `director` (super admin), `admin`, `accountant` (cashier), `teacher` (employee) and `parent`. Extra permissions can be granted per user, for example correcting past attendance, viewing private notes or publishing announcements.

### Security
- RLS is enabled on **every** table, and the `anon` role has no access at all.
- Sensitive writes (attendance, payments, invoices, voids) go only through `SECURITY DEFINER` RPC functions that check the role, validate the data and record a reason. Direct `INSERT/UPDATE/DELETE` on these tables is revoked.
- Pages and server actions check the role on the server (`requireUser`, `authorize`). The UI is never the only protection.
- The `SUPABASE_SERVICE_ROLE_KEY` is used only on the server, to create accounts and reset passwords. It never reaches the browser.
- Passwords are never stored in plain text. Temporary passwords are shown once and must be changed at first login.
- Users cannot raise their own role or permissions, which a trigger enforces.
- 64 automated SQL tests check the access rules (`supabase/tests/rls_test.sql`).

---

## 2. Database (migrations)

`supabase/migrations/` holds three files. Apply them **in this order**:

1. `20261022000001_schema.sql`: enums and 20 tables. The main ones are `settings`, `profiles`, `employees`, `kg_groups`, `group_teachers`, `children`, `child_notes`, `guardians`, `child_guardians`, `pickup_contacts`, `employee_attendance`, `child_attendance`, `invoices`, `invoice_adjustments`, `payments`, `announcements`, `notifications`, `outbound_messages` and `audit_logs`.
2. `20261022000002_functions.sql`:
   - helpers in the `private` schema (role and group checks)
   - the trigger that provisions an `auth.users` user into `profiles`
   - audit triggers
   - payment validation
   - automatic invoice totals
   - notification fan-out
   - all RPCs (`employee_check_in`, `save_child_attendance`, `generate_monthly_invoices`, `void_payment`, `add_invoice_adjustment`, …)
3. `20261022000003_rls.sql`: all RLS policies and grants.

Key data rules:
- `invoices.amount_due`, `balance` and `status` are generated columns, so totals can never drift.
- There is one invoice per child per month, one attendance row per child per day and one check-in row per employee per day (unique constraints).
- Payment amounts are stored as whole so'm (`bigint`).

---

## 3. Supabase setup

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to Uzbekistan, for example Frankfurt (`eu-central-1`).
2. **Apply the migrations.** Do one of the following:
   - In the **SQL Editor**, paste and run the 3 files one by one, in the order above.
   - Or use the CLI: `supabase link --project-ref <ref>` then `supabase db push`.
3. **Authentication → Sign In / Providers:**
   - Turn **off** "Allow new users to sign up". Only the director creates accounts.
   - Under Email, turn **off** "Confirm email". Logins use internal addresses such as `ali@users.bogcha.app`.
4. **Project Settings → API:** copy the Project URL, the anon (publishable) key and the service_role (secret) key.
5. Create `.env.local` from `.env.example` and fill in the values.
6. Create the first director:
   ```bash
   node --env-file=.env.local scripts/create-director.mjs direktor "Karimova Malika Rustamovna"
   ```
   The command prints a temporary password once. Log in with it and you will be asked to set a new password.
7. Fill in the kindergarten details in **Sozlamalar**, then create groups, staff and children.

---

## 4. Running locally

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

Checks:
```bash
npx tsc --noEmit      # types
npm run lint          # ESLint
npm run build         # production build
supabase/tests/run.sh # RLS/SQL tests (needs a local PostgreSQL)
```

---

## 5. Deploying to Vercel

1. Push the code to GitHub and import it in Vercel. The framework is detected automatically.
2. In **Environment Variables**, add everything from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the real domain.
3. `vercel.json` defines a cron job that runs `/api/integrations/dispatch` once a day at 09:00 Tashkent time (04:00 UTC), which sends queued Telegram/SMS messages. If you set `CRON_SECRET`, Vercel sends it automatically. On the Hobby plan, cron jobs run at most once a day. On Pro you can run it more often, for example `*/10 * * * *`.
4. In Supabase, under **Authentication → URL Configuration**, set the Site URL to your domain.

Any Node.js host works as well: `npm run build && npm start`.

---

## 6. Integrations and what still needs configuring

These parts are built but **only work once configured**. Until then the app says so and does not pretend to send anything.

| Feature | What's needed | Status |
|---|---|---|
| **Telegram notifications** | Create a bot with @BotFather and set `TELEGRAM_BOT_TOKEN`. Each parent needs a `telegram_chat_id` on their guardian record | Messages are queued in `outbound_messages`. Without a token they stay `pending`. Not tested against the live Telegram API |
| **SMS (Eskiz.uz)** | `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM` and an Eskiz contract | Code is ready but not tested against the live API |
| **Biometric / Face ID terminal** | Set `BIOMETRIC_DEVICE_TOKEN`. The device sends `POST /api/integrations/biometric` with `Authorization: Bearer <token>` and `{"employee_id":"…","kind":"in"\|"out"}` | The endpoint works. It must be adapted to the specific device model |
| **Location-based check-in** | Set the kindergarten's latitude, longitude and radius in Sozlamalar | Without them, check-ins are marked "self-reported". The browser location is a check, not proof |
| **Online payment (Click, Payme, Uzum)** | Not available | Payments are recorded by a staff member (cash or bank transfer). The app does not claim to accept online payments |
| **Password reset** | No email or SMS reset | An admin resets the password from Foydalanuvchilar and gives the user a new temporary password |
| **Backups** | Supabase Pro has daily backups. On the Free plan, make your own backups | Use the Supabase dashboard |

Recommended checks before launch:
- Run the SQL tests against your own Supabase project.
- Do a trial run with real data: one group, a few children, one month of billing.
- Read the generated PDFs on a phone. PDFs do not support Uzbek special characters such as `oʻ`, so they print `o'`.

---

## 7. Project structure

```
src/
  app/(auth)/        login and password pages
  app/(app)/         all role-protected pages (sidebar + mobile menu)
  app/api/           report export, PDF receipt, integration endpoints
  components/        UI components (ui/), app shell, charts
  lib/               auth, Supabase clients, format (so'm, dates), reports, integrations
  proxy.ts           session refresh and redirect to login
supabase/migrations/ database
supabase/tests/      RLS tests
scripts/             create the first director
```
