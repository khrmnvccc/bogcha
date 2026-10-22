-- =====================================================================
-- Telegram ulash, bildirishnomalarni Telegram'ga yo'naltirish va
-- avtomatik eslatmalar (to'lov muddati, xodimlar, davomat, kunlik hisobot)
-- =====================================================================

-- Har bir foydalanuvchi o'z Telegram chatini bot orqali ulaydi
alter table public.profiles
  add column telegram_chat_id text unique check (telegram_chat_id is null or telegram_chat_id ~ '^-?[0-9]{1,20}$'),
  add column telegram_linked_at timestamptz;

create table public.telegram_link_codes (
  code text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index telegram_link_codes_profile_idx on public.telegram_link_codes (profile_id);
alter table public.telegram_link_codes enable row level security;

-- Bir eslatma bir marta yuborilishi uchun
create table public.reminder_log (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.reminder_log enable row level security;

revoke all on public.telegram_link_codes, public.reminder_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- Ulash RPC'lari
-- ---------------------------------------------------------------------
create or replace function public.create_telegram_link_code()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null or (select private.current_app_role()) is null then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  -- Eski havolalar bekor qilinadi (yozuvlar o'chirilmaydi, faqat muddati tugaydi)
  update public.telegram_link_codes set expires_at = now()
   where profile_id = v_uid and used_at is null and expires_at > now();
  v_code := encode(extensions.gen_random_bytes(12), 'hex');
  insert into public.telegram_link_codes (code, profile_id) values (v_code, v_uid);
  return v_code;
end;
$$;

-- Faqat server (Telegram webhook) chaqiradi
create or replace function public.link_telegram(p_code text, p_chat_id text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_name text;
begin
  if p_chat_id !~ '^-?[0-9]{1,20}$' then
    raise exception 'Noto''g''ri chat' using errcode = '22023';
  end if;
  update public.telegram_link_codes set used_at = now()
   where code = p_code and used_at is null and expires_at >= now()
  returning profile_id into v_profile;
  if v_profile is null then
    return null;
  end if;
  perform set_config('app.audit_reason', 'Telegram ulandi', true);
  update public.profiles set telegram_chat_id = null, telegram_linked_at = null
   where telegram_chat_id = p_chat_id and id <> v_profile;
  update public.profiles set telegram_chat_id = p_chat_id, telegram_linked_at = now()
   where id = v_profile and is_active
  returning full_name into v_name;
  return v_name;
end;
$$;

create or replace function public.unlink_telegram_chat(p_chat_id text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  perform set_config('app.audit_reason', 'Telegram uzildi (bot orqali)', true);
  update public.profiles set telegram_chat_id = null, telegram_linked_at = null where telegram_chat_id = p_chat_id;
  return found;
end;
$$;

create or replace function public.unlink_my_telegram()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.audit_reason', 'Telegram uzildi', true);
  update public.profiles set telegram_chat_id = null, telegram_linked_at = null where id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- Har bir ilova bildirishnomasi Telegram navbatiga ham tushadi.
-- Profilga ulangan chat bo'lmasa, ota-ona kartasidagi chat ID ishlatiladi.
-- ---------------------------------------------------------------------
create or replace function private.on_notification_telegram()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_chat text;
begin
  select coalesce(p.telegram_chat_id,
                  (select g.telegram_chat_id from public.guardians g
                    where g.profile_id = p.id and g.telegram_chat_id is not null limit 1))
    into v_chat
  from public.profiles p
  where p.id = new.user_id and p.is_active;

  if v_chat is not null then
    insert into public.outbound_messages (channel, recipient, body, related_entity, related_id)
    values ('telegram', v_chat, new.title || coalesce(E'\n\n' || new.body, ''), 'notification', new.id);
  end if;
  return null;
end;
$$;

create trigger notifications_telegram after insert on public.notifications
  for each row execute function private.on_notification_telegram();

-- To'lov va e'lon triggerlari endi Telegram'ga to'g'ridan-to'g'ri yozmaydi
-- (bildirishnoma orqali boradi, takrorlanmasin).
create or replace function private.on_payment_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_period date;
  v_name text;
begin
  select i.period, c.full_name into v_period, v_name
  from public.invoices i join public.children c on c.id = i.child_id
  where i.id = new.invoice_id;

  if tg_op = 'INSERT' then
    perform private.notify_child_guardians(new.child_id, 'payment',
      'To''lov qabul qilindi',
      v_name || ' uchun ' || private.fmt_month(v_period) || ' oyiga ' || private.fmt_som(new.amount)
        || ' qabul qilindi. Kvitansiya: ' || new.receipt_number,
      '/ota-ona/tolovlar');
  elsif new.is_void and not old.is_void then
    perform private.notify_child_guardians(new.child_id, 'payment',
      'To''lov bekor qilindi',
      new.receipt_number || ' raqamli ' || private.fmt_som(new.amount) || ' to''lov bekor qilindi. Sabab: ' || new.void_reason,
      '/ota-ona/tolovlar');
  end if;
  return null;
end;
$$;

create or replace function private.on_announcement_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  with recipients as (
    select p.id from public.profiles p
    where p.is_active and (
      new.audience = 'everyone'
      or (new.audience = 'all_parents' and p.role = 'parent')
      or (new.audience = 'all_staff' and p.role <> 'parent')
    )
    union
    select g.profile_id from public.children c
    join public.child_guardians cg on cg.child_id = c.id
    join public.guardians g on g.id = cg.guardian_id
    where new.audience = 'group' and c.group_id = new.group_id and c.status = 'active' and g.profile_id is not null
    union
    select e.profile_id from public.group_teachers gt
    join public.employees e on e.id = gt.employee_id
    where new.audience = 'group' and gt.group_id = new.group_id and e.profile_id is not null
    union
    select g.profile_id from public.guardians g
    where new.audience = 'guardian' and g.id = new.guardian_id and g.profile_id is not null
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select r.id, 'announcement', '📢 ' || new.title, left(new.body, 3000), '/elonlar'
  from recipients r
  where r.id is distinct from new.created_by;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Avtomatik eslatmalar. Har 5 daqiqada chaqiriladi, har bir eslatma
-- reminder_log orqali faqat bir marta yuboriladi.
-- ---------------------------------------------------------------------
create or replace function private.claim_reminder(p_key text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.reminder_log (key) values (p_key) on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

create or replace function public.run_scheduled_reminders()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.settings;
  v_local timestamp := now() at time zone 'Asia/Tashkent';
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_time time := (now() at time zone 'Asia/Tashkent')::time;
  v_dow smallint := extract(isodow from (now() at time zone 'Asia/Tashkent'))::smallint;
  v_workday boolean;
  r record;
  v_count jsonb := '{}'::jsonb;
  n_pay integer := 0;
  n_in integer := 0;
  n_out integer := 0;
  n_att integer := 0;
  n_sum integer := 0;
  v_body text;
begin
  select * into s from public.settings where id = 1;
  v_workday := v_dow = any (s.work_days);

  -- 1) To'lov eslatmalari (soat 09:00 dan keyin, kuniga bir marta)
  if v_time >= time '09:00' and v_time < time '21:00' then
    for r in
      select i.id, i.child_id, i.period, i.due_date, i.balance, c.full_name,
             case
               when i.due_date - v_today = 3 then 'due3'
               when i.due_date = v_today then 'due0'
               when v_today > i.due_date and (v_today - i.due_date) % 7 = 1 then 'late'
             end as kind
      from public.invoices i
      join public.children c on c.id = i.child_id and c.status = 'active'
      where i.balance > 0
        and i.due_date between v_today - 120 and v_today + 3
    loop
      continue when r.kind is null;
      continue when not private.claim_reminder(r.kind || ':' || r.id || ':' || v_today);
      v_body := case r.kind
        when 'due3' then r.full_name || ' uchun ' || private.fmt_month(r.period) || ' oyi to''lovi muddatiga 3 kun qoldi ('
                         || to_char(r.due_date, 'DD.MM.YYYY') || '). To''lanishi kerak: ' || private.fmt_som(r.balance) || '.'
        when 'due0' then 'Bugun ' || r.full_name || ' uchun ' || private.fmt_month(r.period) || ' oyi to''lovining oxirgi kuni. To''lanishi kerak: '
                         || private.fmt_som(r.balance) || '.'
        else r.full_name || ' uchun ' || private.fmt_month(r.period) || ' oyi to''lovi muddati o''tdi ('
             || to_char(r.due_date, 'DD.MM.YYYY') || '). Qarzdorlik: ' || private.fmt_som(r.balance) || '.'
      end;
      perform private.notify_child_guardians(r.child_id, 'reminder',
        case r.kind when 'late' then '⚠️ To''lov muddati o''tdi' else '💳 Oylik to''lov eslatmasi' end,
        v_body || ' To''lovni bog''cha kassasida amalga oshirishingiz mumkin.',
        '/ota-ona/tolovlar');
      n_pay := n_pay + 1;
    end loop;
  end if;

  if v_workday then
    -- 2) Xodim ishga kelganini belgilamagan (ish boshlanganidan 30 daqiqa o'tib)
    for r in
      select e.id, e.profile_id, coalesce(e.schedule_start, s.work_start) as st, coalesce(e.schedule_end, s.work_end) as en
      from public.employees e
      join public.profiles p on p.id = e.profile_id and p.is_active
      where e.status = 'active'
        and v_dow = any (coalesce(e.work_days, s.work_days))
        and not exists (select 1 from public.employee_attendance a where a.employee_id = e.id and a.work_date = v_today)
    loop
      continue when not (v_time >= r.st + interval '30 minutes' and v_time < r.en);
      continue when not private.claim_reminder('checkin:' || r.id || ':' || v_today);
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.profile_id, 'reminder', '⏰ Ishga kelganingizni belgilang',
        'Bugun ishga kelganingiz hali tizimda qayd etilmagan. Ish boshlanishi: ' || to_char(r.st, 'HH24:MI') || '.',
        '/mening-kunim');
      n_in := n_in + 1;
    end loop;

    -- 3) Xodim ishdan ketganini belgilamagan (ish tugaganidan 60 daqiqa o'tib)
    for r in
      select a.id, e.profile_id, coalesce(e.schedule_end, s.work_end) as en
      from public.employee_attendance a
      join public.employees e on e.id = a.employee_id
      join public.profiles p on p.id = e.profile_id and p.is_active
      where a.work_date = v_today and a.check_out_at is null
    loop
      continue when v_time < r.en + interval '60 minutes';
      continue when not private.claim_reminder('checkout:' || r.id);
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.profile_id, 'reminder', '🏁 Ishdan ketganingizni belgilang',
        'Ish vaqti ' || to_char(r.en, 'HH24:MI') || ' da tugagan, lekin ketish vaqti qayd etilmagan.',
        '/mening-kunim');
      n_out := n_out + 1;
    end loop;

    -- 4) Ustozlarga: guruh davomati to'ldirilmagan
    if s.child_attendance_cutoff is not null and v_time >= s.child_attendance_cutoff and v_time < s.work_end then
      for r in
        select g.id, g.name,
               count(*) filter (where ca.id is null) as missing
        from public.kg_groups g
        join public.children c on c.group_id = g.id and c.status = 'active'
        left join public.child_attendance ca on ca.child_id = c.id and ca.date = v_today
        where g.is_active
        group by g.id, g.name
        having count(*) filter (where ca.id is null) > 0
      loop
        continue when not private.claim_reminder('att:' || r.id || ':' || v_today);
        insert into public.notifications (user_id, kind, title, body, link)
        select e.profile_id, 'reminder', '📝 Davomatni to''ldiring',
          r.name || ' guruhida ' || r.missing || ' ta bolaning bugungi davomati belgilanmagan.', '/davomat'
        from public.group_teachers gt
        join public.employees e on e.id = gt.employee_id and e.status = 'active'
        join public.profiles p on p.id = e.profile_id and p.is_active
        where gt.group_id = r.id;
        n_att := n_att + 1;
      end loop;
    end if;

    -- 5) Rahbariyatga kunlik hisobot (ish kuni tugagach)
    if v_time >= s.work_end then
     if private.claim_reminder('summary:' || v_today) then
      select
        'Bolalar: ' || count(*) filter (where ca.status in ('present', 'late')) || ' ta keldi, '
          || count(*) filter (where ca.status in ('absent', 'excused')) || ' ta kelmadi, '
          || count(*) filter (where ca.id is null) || ' ta belgilanmagan.'
        into v_body
      from public.children c
      left join public.child_attendance ca on ca.child_id = c.id and ca.date = v_today
      where c.status = 'active';

      v_body := v_body || E'\nXodimlar: '
        || (select count(*) from public.employee_attendance a where a.work_date = v_today) || ' ta ishga keldi, '
        || (select count(*) from public.employee_attendance a where a.work_date = v_today and a.late_minutes > 0) || ' ta kechikdi.'
        || E'\nBugun yig''ilgan to''lovlar: '
        || private.fmt_som(coalesce((select sum(p.amount) from public.payments p where p.paid_on = v_today and not p.is_void), 0)::bigint)
        || E'\nUmumiy qarzdorlik: '
        || private.fmt_som(coalesce((select sum(greatest(i.balance, 0)) from public.invoices i
                                      join public.children c on c.id = i.child_id and c.status = 'active'
                                      where i.due_date < v_today), 0)::bigint) || '.';

      insert into public.notifications (user_id, kind, title, body, link)
      select p.id, 'summary', '📊 Kunlik hisobot, ' || to_char(v_today, 'DD.MM.YYYY'), v_body, '/panel'
      from public.profiles p
      where p.is_active and p.role in ('director', 'admin');
      n_sum := 1;
     end if;
    end if;
  end if;

  return jsonb_build_object('payment', n_pay, 'check_in', n_in, 'check_out', n_out, 'attendance', n_att, 'summary', n_sum);
end;
$$;

-- Huquqlar
revoke execute on function public.link_telegram(text, text) from public, anon, authenticated;
revoke execute on function public.unlink_telegram_chat(text) from public, anon, authenticated;
revoke execute on function public.run_scheduled_reminders() from public, anon, authenticated;
grant execute on function public.link_telegram(text, text) to service_role;
grant execute on function public.unlink_telegram_chat(text) to service_role;
grant execute on function public.run_scheduled_reminders() to service_role;
revoke execute on function public.create_telegram_link_code() from public, anon;
revoke execute on function public.unlink_my_telegram() from public, anon;
grant execute on function public.create_telegram_link_code() to authenticated;
grant execute on function public.unlink_my_telegram() to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
