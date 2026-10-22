-- =====================================================================
-- Bog'cha boshqaruv tizimi: asosiy sxema
-- Jadvallar, cheklovlar, indekslar va vaqt belgilari.
-- Barcha summalar butun so'mda (bigint) saqlanadi.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Enum turlari
-- ---------------------------------------------------------------------
create type public.app_role as enum ('director', 'admin', 'teacher', 'accountant', 'parent');
create type public.employment_status as enum ('active', 'on_leave', 'terminated');
create type public.child_status as enum ('active', 'paused', 'left', 'graduated');
create type public.child_attendance_status as enum ('present', 'absent', 'late', 'excused');
create type public.attendance_source as enum ('self', 'location', 'biometric', 'admin');
create type public.review_status as enum ('ok', 'needs_review', 'reviewed');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'other');
create type public.adjustment_kind as enum ('discount', 'surcharge', 'correction');
create type public.announcement_audience as enum ('everyone', 'all_parents', 'all_staff', 'group', 'guardian');
create type public.outbound_channel as enum ('telegram', 'sms');
create type public.outbound_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------
-- Umumiy yordamchi: updated_at
-- ---------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Toshkent vaqti bo'yicha bugungi sana
create or replace function public.tashkent_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tashkent')::date;
$$;

-- ---------------------------------------------------------------------
-- Sozlamalar (yagona qator)
-- ---------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  kindergarten_name text not null default 'Bog''cha',
  address text,
  phone text,
  phone2 text,
  email text,
  telegram text,
  working_hours_text text default 'Dushanba - Juma, 08:00 - 18:00',
  default_monthly_fee bigint not null default 0 check (default_monthly_fee >= 0),
  billing_due_day smallint not null default 10 check (billing_due_day between 1 and 28),
  work_start time not null default '08:00',
  work_end time not null default '18:00',
  work_days smallint[] not null default '{1,2,3,4,5}',
  late_grace_minutes smallint not null default 10 check (late_grace_minutes between 0 and 240),
  early_leave_grace_minutes smallint not null default 10 check (early_leave_grace_minutes between 0 and 240),
  min_shift_minutes smallint not null default 60 check (min_shift_minutes >= 0),
  max_shift_minutes smallint not null default 720 check (max_shift_minutes > 0),
  location_lat double precision,
  location_lng double precision,
  location_radius_m integer not null default 150 check (location_radius_m between 10 and 5000),
  child_attendance_cutoff time default '11:00',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

create trigger settings_touch before update on public.settings
  for each row execute function private.touch_updated_at();

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create unique index academic_periods_one_current on public.academic_periods (is_current) where is_current;

-- ---------------------------------------------------------------------
-- Profillar va rollar (auth.users bilan 1:1)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'parent',
  full_name text not null default '' check (length(full_name) <= 150),
  username text unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  phone text check (phone is null or length(phone) <= 30),
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  last_password_change_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_known_permissions check (
    permissions <@ array['attendance.correct', 'children.view_notes', 'announcements.publish', 'finance.adjust', 'finance.view']::text[]
  )
);
create index profiles_role_idx on public.profiles (role) where is_active;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Xodimlar
-- ---------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 3 and 150),
  phone text check (phone is null or length(phone) <= 30),
  position text not null check (length(trim(position)) between 2 and 100),
  start_date date not null default public.tashkent_today(),
  end_date date,
  status public.employment_status not null default 'active',
  schedule_start time,
  schedule_end time,
  work_days smallint[],
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index employees_status_idx on public.employees (status);
create trigger employees_touch before update on public.employees
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Guruhlar va o'qituvchilar biriktirilishi
-- ---------------------------------------------------------------------
create table public.kg_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  age_range text check (age_range is null or length(age_range) <= 40),
  room text check (room is null or length(room) <= 80),
  capacity integer check (capacity is null or capacity between 1 and 200),
  monthly_fee bigint check (monthly_fee is null or monthly_fee >= 0),
  academic_period_id uuid references public.academic_periods (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index kg_groups_name_active on public.kg_groups (lower(name)) where is_active;
create trigger kg_groups_touch before update on public.kg_groups
  for each row execute function private.touch_updated_at();

create table public.group_teachers (
  group_id uuid not null references public.kg_groups (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  is_lead boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (group_id, employee_id)
);
create index group_teachers_employee_idx on public.group_teachers (employee_id);

-- ---------------------------------------------------------------------
-- Bolalar, ota-onalar va bog'lanishlar
-- ---------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 3 and 150),
  birth_date date not null,
  gender text check (gender in ('male', 'female')),
  group_id uuid references public.kg_groups (id) on delete set null,
  enrollment_date date not null default public.tashkent_today(),
  leave_date date,
  status public.child_status not null default 'active',
  monthly_fee bigint check (monthly_fee is null or monthly_fee >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (birth_date <= enrollment_date),
  check (leave_date is null or leave_date >= enrollment_date)
);
create index children_group_idx on public.children (group_id) where status = 'active';
create index children_status_idx on public.children (status);
create trigger children_touch before update on public.children
  for each row execute function private.touch_updated_at();

-- Cheklangan ma'lumotlar (sog'liq, allergiya va h.k.) alohida jadvalda
create table public.child_notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'medical', 'allergy', 'behavior', 'family')),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index child_notes_child_idx on public.child_notes (child_id);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 3 and 150),
  phone text not null check (length(phone) between 7 and 30),
  phone2 text check (phone2 is null or length(phone2) <= 30),
  address text check (address is null or length(address) <= 300),
  workplace text check (workplace is null or length(workplace) <= 200),
  telegram_chat_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_phone_idx on public.guardians (phone);
create trigger guardians_touch before update on public.guardians
  for each row execute function private.touch_updated_at();

create table public.child_guardians (
  child_id uuid not null references public.children (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  relationship text not null default 'ota-ona' check (length(relationship) <= 40),
  is_primary boolean not null default false,
  can_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (child_id, guardian_id)
);
create index child_guardians_guardian_idx on public.child_guardians (guardian_id);

create table public.pickup_contacts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 3 and 150),
  relationship text not null check (length(relationship) <= 40),
  phone text not null check (length(phone) between 7 and 30),
  created_at timestamptz not null default now()
);
create index pickup_contacts_child_idx on public.pickup_contacts (child_id);

-- ---------------------------------------------------------------------
-- Xodimlar davomati (ishga kelish-ketish)
-- ---------------------------------------------------------------------
create table public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  check_in_source public.attendance_source not null default 'self',
  check_out_source public.attendance_source,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_distance_m integer,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_distance_m integer,
  late_minutes integer not null default 0 check (late_minutes >= 0),
  early_leave_minutes integer not null default 0 check (early_leave_minutes >= 0),
  worked_minutes integer generated always as (
    case when check_out_at is null then null
         else (extract(epoch from (check_out_at - check_in_at)) / 60)::integer end
  ) stored,
  review_status public.review_status not null default 'ok',
  review_reasons text[] not null default '{}',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  is_corrected boolean not null default false,
  note text check (note is null or length(note) <= 1000),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (check_out_at is null or check_out_at > check_in_at)
);
create index employee_attendance_date_idx on public.employee_attendance (work_date desc);
create index employee_attendance_review_idx on public.employee_attendance (review_status) where review_status = 'needs_review';
create trigger employee_attendance_touch before update on public.employee_attendance
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Bolalar davomati
-- ---------------------------------------------------------------------
create table public.child_attendance (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  date date not null,
  status public.child_attendance_status not null,
  note text check (note is null or length(note) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (child_id, date)
);
create index child_attendance_date_idx on public.child_attendance (date desc, status);

-- ---------------------------------------------------------------------
-- Oylik hisoblar (invoice), chegirmalar va to'lovlar
-- ---------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete restrict,
  period date not null check (extract(day from period) = 1),
  base_amount bigint not null check (base_amount >= 0),
  adjustments_total bigint not null default 0,
  paid_total bigint not null default 0 check (paid_total >= 0),
  amount_due bigint generated always as (greatest(base_amount + adjustments_total, 0)) stored,
  balance bigint generated always as (greatest(base_amount + adjustments_total, 0) - paid_total) stored,
  status text generated always as (
    case
      when paid_total >= greatest(base_amount + adjustments_total, 0) then 'paid'
      when paid_total > 0 then 'partial'
      else 'unpaid'
    end
  ) stored,
  due_date date not null,
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, period)
);
create index invoices_period_idx on public.invoices (period desc, status);
create index invoices_child_idx on public.invoices (child_id, period desc);
create trigger invoices_touch before update on public.invoices
  for each row execute function private.touch_updated_at();

create table public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind public.adjustment_kind not null,
  -- Ishorali summa: chegirma manfiy, qo'shimcha musbat
  amount bigint not null check (amount <> 0),
  reason text not null check (length(trim(reason)) between 5 and 500),
  approved_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check ((kind = 'discount' and amount < 0) or (kind = 'surcharge' and amount > 0) or kind = 'correction')
);
create index invoice_adjustments_invoice_idx on public.invoice_adjustments (invoice_id);

create sequence public.receipt_number_seq;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  child_id uuid not null references public.children (id) on delete restrict,
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  method public.payment_method not null,
  paid_on date not null,
  receipt_number text not null unique
    default ('K-' || to_char(now() at time zone 'Asia/Tashkent', 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0')),
  note text check (note is null or length(note) <= 500),
  -- Ikki marta yuborilgan formalarni bloklash uchun
  client_token uuid unique,
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  is_void boolean not null default false,
  void_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  check (not is_void or (void_reason is not null and length(trim(void_reason)) >= 5 and voided_by is not null))
);
create index payments_invoice_idx on public.payments (invoice_id) where not is_void;
create index payments_child_idx on public.payments (child_id, paid_on desc);
create index payments_paid_on_idx on public.payments (paid_on desc) where not is_void;

-- ---------------------------------------------------------------------
-- E'lonlar va bildirishnomalar
-- ---------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 200),
  body text not null check (length(trim(body)) between 1 and 5000),
  audience public.announcement_audience not null,
  group_id uuid references public.kg_groups (id) on delete cascade,
  guardian_id uuid references public.guardians (id) on delete cascade,
  is_pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((audience = 'group') = (group_id is not null)),
  check ((audience = 'guardian') = (guardian_id is not null))
);
create index announcements_created_idx on public.announcements (created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

-- Telegram / SMS uchun navbat. Haqiqiy yuborish faqat kalitlar sozlanganda.
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel public.outbound_channel not null,
  recipient text not null,
  body text not null,
  status public.outbound_status not null default 'pending',
  attempts smallint not null default 0,
  last_error text,
  related_entity text,
  related_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbound_messages_pending_idx on public.outbound_messages (created_at) where status = 'pending';

-- ---------------------------------------------------------------------
-- Audit jurnali
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
