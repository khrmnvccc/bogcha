-- =====================================================================
-- Yordamchi funksiyalar, triggerlar va RPC'lar
-- Barcha SECURITY DEFINER funksiyalar search_path = '' bilan va ichida
-- ruxsatni o'zi tekshiradi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ruxsat yordamchilari (private sxemada, API orqali chaqirib bo'lmaydi)
-- ---------------------------------------------------------------------
create or replace function private.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and is_active;
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('director', 'admin'), false);
$$;

create or replace function private.is_director()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) = 'director', false);
$$;

create or replace function private.has_perm(p_perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
      and (role in ('director', 'admin') or p_perm = any (permissions))
  );
$$;

create or replace function private.is_finance()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('director', 'admin', 'accountant'), false)
      or (select private.has_perm('finance.view'));
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('director', 'admin', 'teacher', 'accountant'), false);
$$;

create or replace function private.current_employee_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select e.id from public.employees e
  join public.profiles p on p.id = e.profile_id
  where e.profile_id = (select auth.uid()) and p.is_active and e.status <> 'terminated';
$$;

create or replace function private.current_guardian_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select g.id from public.guardians g
  join public.profiles p on p.id = g.profile_id
  where g.profile_id = (select auth.uid()) and p.is_active and p.role = 'parent';
$$;

create or replace function private.teacher_group_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select gt.group_id from public.group_teachers gt
  where gt.employee_id = (select private.current_employee_id())
    and (select private.current_app_role()) = 'teacher';
$$;

create or replace function private.parent_child_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select cg.child_id from public.child_guardians cg
  where cg.guardian_id = (select private.current_guardian_id());
$$;

create or replace function private.teacher_child_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id from public.children c
  where c.group_id in (select private.teacher_group_ids());
$$;

create or replace function private.can_edit_child_attendance(p_child_id uuid, p_date date)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_date <= public.tashkent_today()
    and (
      (select private.is_admin())
      or ((select private.has_perm('attendance.correct'))
          and p_child_id in (select private.teacher_child_ids()))
      or (p_date = public.tashkent_today()
          and p_child_id in (select private.teacher_child_ids()))
    );
$$;

-- ---------------------------------------------------------------------
-- Formatlash yordamchilari (bildirishnomalar uchun)
-- ---------------------------------------------------------------------
create or replace function private.fmt_som(p bigint)
returns text
language sql immutable
set search_path = ''
as $$
  select replace(to_char(p, 'FM999,999,999,999,990'), ',', ' ') || ' so''m';
$$;

create or replace function private.fmt_month(p date)
returns text
language sql immutable
set search_path = ''
as $$
  select (array['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'])[extract(month from p)::int]
         || ' ' || extract(year from p)::int;
$$;

-- ---------------------------------------------------------------------
-- Auth foydalanuvchi uchun profil
-- Rol faqat app_metadata dan olinadi (uni faqat server service-role
-- orqali o'rnatadi). Rol bo'lmasa profil faol emas.
-- Supabase Auth foydalanuvchini avval app_metadata'siz yaratib, keyin
-- yangilashi mumkin, shuning uchun UPDATE ham kuzatiladi.
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_role text := v_meta ->> 'role';
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, role, full_name, username, phone, is_active, must_change_password, created_by)
    values (
      new.id,
      coalesce(v_role, 'parent')::public.app_role,
      coalesce(v_meta ->> 'full_name', ''),
      v_meta ->> 'username',
      v_meta ->> 'phone',
      v_role is not null,
      coalesce((v_meta ->> 'must_change_password')::boolean, true),
      nullif(v_meta ->> 'created_by', '')::uuid
    )
    on conflict (id) do nothing;
  elsif (old.raw_app_meta_data ->> 'role') is null and v_role is not null then
    -- First provisioning of a user that was inserted without a role.
    update public.profiles set
      role = v_role::public.app_role,
      full_name = coalesce(v_meta ->> 'full_name', full_name),
      username = coalesce(v_meta ->> 'username', username),
      phone = coalesce(v_meta ->> 'phone', phone),
      is_active = true,
      must_change_password = coalesce((v_meta ->> 'must_change_password')::boolean, true),
      created_by = nullif(v_meta ->> 'created_by', '')::uuid
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_provisioned
  after update of raw_app_meta_data on auth.users
  for each row execute function private.handle_new_user();

-- Rolni oshirishdan himoya
create or replace function private.guard_profile_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- service_role (auth.uid() yo'q) server tomonda tekshirilgan
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.role is distinct from old.role or new.permissions is distinct from old.permissions then
    if not (select private.is_admin()) then
      raise exception 'Ruxsat yo''q' using errcode = '42501';
    end if;
    if (new.role in ('director', 'admin') or old.role in ('director', 'admin'))
       and not (select private.is_director()) then
      raise exception 'Faqat direktor rahbar rollarini o''zgartira oladi' using errcode = '42501';
    end if;
  end if;
  if new.id = (select auth.uid()) and new.is_active = false then
    raise exception 'O''zingizni faolsizlantira olmaysiz' using errcode = '42501';
  end if;
  if old.role = 'director' and new.is_active = false and not (select private.is_director()) then
    raise exception 'Direktorni faqat direktor faolsizlantira oladi' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------
-- Audit jurnali triggeri
-- TG_ARGV: e'tiborga olinmaydigan ustunlar (shovqinni kamaytirish uchun)
-- ---------------------------------------------------------------------
create or replace function private.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_ignore text[] := array['updated_at']::text[] || coalesce(tg_argv::text[], '{}');
  v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' and (v_old - v_ignore) = (v_new - v_ignore) then
    return null;
  end if;

  v_id := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    concat_ws(':',
      coalesce(v_new ->> 'child_id', v_old ->> 'child_id', v_new ->> 'group_id', v_old ->> 'group_id'),
      coalesce(v_new ->> 'guardian_id', v_old ->> 'guardian_id', v_new ->> 'employee_id', v_old ->> 'employee_id'))
  );

  insert into public.audit_logs (actor_id, action, entity, entity_id, old_data, new_data, reason)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_id,
    v_old,
    v_new,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return null;
end;
$$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_row('last_password_change_at');
create trigger audit_employees after insert or update or delete on public.employees
  for each row execute function private.audit_row();
create trigger audit_kg_groups after insert or update or delete on public.kg_groups
  for each row execute function private.audit_row();
create trigger audit_group_teachers after insert or update or delete on public.group_teachers
  for each row execute function private.audit_row();
create trigger audit_children after insert or update or delete on public.children
  for each row execute function private.audit_row();
create trigger audit_guardians after insert or update or delete on public.guardians
  for each row execute function private.audit_row();
create trigger audit_child_guardians after insert or update or delete on public.child_guardians
  for each row execute function private.audit_row();
create trigger audit_child_notes after insert or update or delete on public.child_notes
  for each row execute function private.audit_row();
create trigger audit_employee_attendance after update or delete on public.employee_attendance
  for each row execute function private.audit_row();
create trigger audit_child_attendance after update or delete on public.child_attendance
  for each row execute function private.audit_row();
create trigger audit_invoices after insert or update or delete on public.invoices
  for each row execute function private.audit_row('paid_total', 'adjustments_total', 'amount_due', 'balance', 'status');
create trigger audit_invoice_adjustments after insert or update or delete on public.invoice_adjustments
  for each row execute function private.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function private.audit_row();
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function private.audit_row();
create trigger audit_settings after update on public.settings
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------
-- Bolalar davomati: kim va qachon yozganini majburan o'rnatish
-- ---------------------------------------------------------------------
create or replace function private.stamp_child_attendance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date > public.tashkent_today() then
    raise exception 'Kelajakdagi sana uchun davomat belgilab bo''lmaydi' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
    new.recorded_at := now();
    new.updated_by := new.recorded_by;
    new.updated_at := now();
  else
    new.child_id := old.child_id;
    new.date := old.date;
    new.recorded_by := old.recorded_by;
    new.recorded_at := old.recorded_at;
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger child_attendance_stamp before insert or update on public.child_attendance
  for each row execute function private.stamp_child_attendance();

-- ---------------------------------------------------------------------
-- To'lovlar: tekshiruv va hisob summalarini yangilash
-- ---------------------------------------------------------------------
create or replace function private.validate_payment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
begin
  if tg_op = 'INSERT' then
    select * into v_inv from public.invoices where id = new.invoice_id for update;
    if not found then
      raise exception 'Hisob topilmadi' using errcode = '23503';
    end if;
    new.child_id := v_inv.child_id;
    new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
    new.is_void := false;
    new.void_reason := null;
    new.voided_by := null;
    new.voided_at := null;
    if new.paid_on > public.tashkent_today() then
      raise exception 'To''lov sanasi kelajakda bo''lishi mumkin emas' using errcode = '22023';
    end if;
    if new.amount > v_inv.balance then
      raise exception 'To''lov summasi qoldiqdan (%) oshib ketdi', private.fmt_som(greatest(v_inv.balance, 0))
        using errcode = '22023';
    end if;
    return new;
  end if;

  -- UPDATE: summa va bog'lanishlar o'zgarmas; faqat bekor qilish va izoh
  if new.invoice_id <> old.invoice_id or new.child_id <> old.child_id or new.amount <> old.amount
     or new.method <> old.method or new.paid_on <> old.paid_on or new.receipt_number <> old.receipt_number
     or new.recorded_by <> old.recorded_by or new.created_at <> old.created_at then
    raise exception 'To''lovni o''zgartirib bo''lmaydi. Uni bekor qilib, yangisini kiriting.' using errcode = '42501';
  end if;
  if old.is_void and not new.is_void then
    raise exception 'Bekor qilingan to''lovni tiklab bo''lmaydi' using errcode = '42501';
  end if;
  if new.is_void and not old.is_void then
    new.voided_by := coalesce((select auth.uid()), new.voided_by);
    new.voided_at := now();
  end if;
  return new;
end;
$$;

create trigger payments_validate before insert or update on public.payments
  for each row execute function private.validate_payment();

create or replace function private.refresh_invoice_paid()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  v_ids := array_remove(array[
    case when tg_op <> 'DELETE' then new.invoice_id end,
    case when tg_op <> 'INSERT' then old.invoice_id end
  ], null);
  foreach v_id in array v_ids loop
    update public.invoices i
       set paid_total = coalesce((select sum(p.amount) from public.payments p
                                  where p.invoice_id = v_id and not p.is_void), 0)
     where i.id = v_id;
  end loop;
  return null;
end;
$$;

create trigger payments_refresh_invoice after insert or update or delete on public.payments
  for each row execute function private.refresh_invoice_paid();

create or replace function private.refresh_invoice_adjustments()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
     set adjustments_total = coalesce((select sum(a.amount) from public.invoice_adjustments a
                                       where a.invoice_id = v_id), 0)
   where i.id = v_id;
  return null;
end;
$$;

create trigger adjustments_refresh_invoice after insert or update or delete on public.invoice_adjustments
  for each row execute function private.refresh_invoice_adjustments();

-- ---------------------------------------------------------------------
-- Bildirishnomalar
-- ---------------------------------------------------------------------
create or replace function private.notify_child_guardians(p_child_id uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select g.profile_id, p_kind, p_title, p_body, p_link
  from public.child_guardians cg
  join public.guardians g on g.id = cg.guardian_id
  join public.profiles p on p.id = g.profile_id and p.is_active
  where cg.child_id = p_child_id;
$$;

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
    insert into public.outbound_messages (channel, recipient, body, related_entity, related_id)
    select 'telegram', g.telegram_chat_id,
      'To''lov qabul qilindi: ' || v_name || ', ' || private.fmt_month(v_period) || ', ' || private.fmt_som(new.amount),
      'payment', new.id
    from public.child_guardians cg join public.guardians g on g.id = cg.guardian_id
    where cg.child_id = new.child_id and g.telegram_chat_id is not null;
  elsif new.is_void and not old.is_void then
    perform private.notify_child_guardians(new.child_id, 'payment',
      'To''lov bekor qilindi',
      new.receipt_number || ' raqamli ' || private.fmt_som(new.amount) || ' to''lov bekor qilindi. Sabab: ' || new.void_reason,
      '/ota-ona/tolovlar');
  end if;
  return null;
end;
$$;

create trigger payments_notify after insert or update on public.payments
  for each row execute function private.on_payment_notify();

create or replace function private.on_invoice_notify()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.notify_child_guardians(new.child_id, 'invoice',
    'Yangi oylik hisob',
    private.fmt_month(new.period) || ' oyi uchun to''lov: ' || private.fmt_som(new.amount_due)
      || '. To''lov muddati: ' || to_char(new.due_date, 'DD.MM.YYYY'),
    '/ota-ona/tolovlar');
  return null;
end;
$$;

create trigger invoices_notify after insert on public.invoices
  for each row execute function private.on_invoice_notify();

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
    -- guruh: shu guruhdagi bolalarning ota-onalari va guruh o'qituvchilari
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
  select r.id, 'announcement', new.title, left(new.body, 300), '/elonlar'
  from recipients r
  where r.id is distinct from new.created_by;

  -- Telegram navbati (faqat chat_id bor ota-onalar uchun)
  insert into public.outbound_messages (channel, recipient, body, related_entity, related_id)
  select distinct 'telegram'::public.outbound_channel, g.telegram_chat_id, new.title || E'\n\n' || new.body, 'announcement', new.id
  from public.guardians g
  where g.telegram_chat_id is not null and (
    new.audience in ('everyone', 'all_parents')
    or (new.audience = 'guardian' and g.id = new.guardian_id)
    or (new.audience = 'group' and exists (
      select 1 from public.child_guardians cg join public.children c on c.id = cg.child_id
      where cg.guardian_id = g.id and c.group_id = new.group_id and c.status = 'active'))
  );
  return null;
end;
$$;

create trigger announcements_notify after insert on public.announcements
  for each row execute function private.on_announcement_notify();

-- ---------------------------------------------------------------------
-- RPC: xodim ishga kelishi / ketishi
-- ---------------------------------------------------------------------
create or replace function private.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns integer
language sql immutable
set search_path = ''
as $$
  select round(6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::integer;
$$;

create or replace function private.do_check(
  p_employee_id uuid, p_kind text, p_source public.attendance_source,
  p_lat double precision, p_lng double precision, p_accuracy double precision
)
returns public.employee_attendance
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.settings;
  e public.employees;
  rec public.employee_attendance;
  v_now timestamptz := now();
  v_local timestamp := now() at time zone 'Asia/Tashkent';
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_start time;
  v_end time;
  v_days smallint[];
  v_dist integer;
  v_source public.attendance_source := p_source;
  v_reasons text[] := '{}';
  v_late integer := 0;
  v_early integer := 0;
  v_worked integer;
begin
  select * into s from public.settings where id = 1;
  select * into e from public.employees where id = p_employee_id;
  if not found or e.status <> 'active' then
    raise exception 'Faol xodim topilmadi' using errcode = '42501';
  end if;

  v_start := coalesce(e.schedule_start, s.work_start);
  v_end := coalesce(e.schedule_end, s.work_end);
  v_days := coalesce(e.work_days, s.work_days);

  -- Joylashuv: qurilma bergan koordinata bog'cha radiusida bo'lsa "location"
  if p_lat is not null and p_lng is not null and s.location_lat is not null and s.location_lng is not null then
    v_dist := private.distance_m(p_lat, p_lng, s.location_lat, s.location_lng);
    if p_source = 'self' then
      if v_dist <= s.location_radius_m and coalesce(p_accuracy, 0) <= greatest(s.location_radius_m, 100) then
        v_source := 'location';
      else
        v_reasons := v_reasons || 'Joylashuv bog''cha hududidan tashqarida'::text;
      end if;
    end if;
  end if;

  if not (extract(isodow from v_today)::smallint = any (v_days)) then
    v_reasons := v_reasons || 'Ish kuni emas'::text;
  end if;

  select * into rec from public.employee_attendance
  where employee_id = p_employee_id and work_date = v_today
  for update;

  if p_kind = 'in' then
    if found then
      raise exception 'Bugun allaqachon ishga kelganingiz qayd etilgan (%)',
        to_char(rec.check_in_at at time zone 'Asia/Tashkent', 'HH24:MI') using errcode = '23505';
    end if;
    v_late := greatest(0, (extract(epoch from (v_local::time - v_start)) / 60)::integer);
    if v_late <= s.late_grace_minutes then
      v_late := 0;
    end if;
    if v_local::time < v_start - interval '3 hours' then
      v_reasons := v_reasons || 'Juda erta kelish'::text;
    end if;
    insert into public.employee_attendance (
      employee_id, work_date, check_in_at, check_in_source, check_in_lat, check_in_lng, check_in_distance_m,
      late_minutes, review_status, review_reasons, recorded_by
    ) values (
      p_employee_id, v_today, v_now, v_source, p_lat, p_lng, v_dist,
      v_late, case when cardinality(v_reasons) > 0 then 'needs_review'::public.review_status else 'ok' end,
      v_reasons, (select auth.uid())
    ) returning * into rec;
    return rec;
  end if;

  -- p_kind = 'out'
  if not found then
    raise exception 'Avval ishga kelganingizni belgilang' using errcode = '22023';
  end if;
  if rec.check_out_at is not null then
    raise exception 'Bugun ishdan ketganingiz allaqachon qayd etilgan (%)',
      to_char(rec.check_out_at at time zone 'Asia/Tashkent', 'HH24:MI') using errcode = '23505';
  end if;
  if v_now - rec.check_in_at < interval '1 minute' then
    raise exception 'Ishga kelish va ketish orasida kamida 1 daqiqa bo''lishi kerak' using errcode = '22023';
  end if;
  v_early := greatest(0, (extract(epoch from (v_end - v_local::time)) / 60)::integer);
  if v_early <= s.early_leave_grace_minutes then
    v_early := 0;
  end if;
  v_worked := (extract(epoch from (v_now - rec.check_in_at)) / 60)::integer;
  if v_worked < s.min_shift_minutes then
    v_reasons := v_reasons || 'Ish vaqti juda qisqa'::text;
  elsif v_worked > s.max_shift_minutes then
    v_reasons := v_reasons || 'Ish vaqti juda uzun'::text;
  end if;

  update public.employee_attendance set
    check_out_at = v_now,
    check_out_source = v_source,
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_distance_m = v_dist,
    early_leave_minutes = v_early,
    review_reasons = rec.review_reasons || v_reasons,
    review_status = case when cardinality(rec.review_reasons || v_reasons) > 0 and rec.review_status <> 'reviewed'
                         then 'needs_review'::public.review_status else rec.review_status end
  where id = rec.id
  returning * into rec;
  return rec;
end;
$$;

create or replace function public.employee_check_in(p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null)
returns public.employee_attendance
language plpgsql security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
begin
  if v_emp is null or not (select private.is_staff()) then
    raise exception 'Hisobingiz xodimga bog''lanmagan' using errcode = '42501';
  end if;
  return private.do_check(v_emp, 'in', 'self', p_lat, p_lng, p_accuracy);
end;
$$;

create or replace function public.employee_check_out(p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null)
returns public.employee_attendance
language plpgsql security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
begin
  if v_emp is null or not (select private.is_staff()) then
    raise exception 'Hisobingiz xodimga bog''lanmagan' using errcode = '42501';
  end if;
  return private.do_check(v_emp, 'out', 'self', p_lat, p_lng, p_accuracy);
end;
$$;

-- Biometrik qurilma integratsiyasi uchun (faqat server service_role orqali)
create or replace function public.device_check(p_employee_id uuid, p_kind text)
returns public.employee_attendance
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_kind not in ('in', 'out') then
    raise exception 'Noto''g''ri tur' using errcode = '22023';
  end if;
  perform set_config('app.audit_reason', 'Biometrik qurilma', true);
  return private.do_check(p_employee_id, p_kind, 'biometric', null, null, null);
end;
$$;

-- Administrator tomonidan tuzatish (sabab majburiy, audit jurnaliga yoziladi)
create or replace function public.admin_set_employee_attendance(
  p_employee_id uuid, p_work_date date, p_check_in timestamptz, p_check_out timestamptz, p_reason text
)
returns public.employee_attendance
language plpgsql security definer
set search_path = ''
as $$
declare
  rec public.employee_attendance;
  s public.settings;
  e public.employees;
  v_late integer := 0;
  v_early integer := 0;
begin
  if not (select private.is_admin()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Tuzatish sababini yozing (kamida 5 belgi)' using errcode = '22023';
  end if;
  if p_work_date > public.tashkent_today() then
    raise exception 'Kelajakdagi sana uchun kiritib bo''lmaydi' using errcode = '22023';
  end if;
  if p_check_in is null or (p_check_in at time zone 'Asia/Tashkent')::date <> p_work_date then
    raise exception 'Kelish vaqti tanlangan sanaga mos emas' using errcode = '22023';
  end if;
  if p_check_out is not null and p_check_out <= p_check_in then
    raise exception 'Ketish vaqti kelish vaqtidan keyin bo''lishi kerak' using errcode = '22023';
  end if;

  select * into s from public.settings where id = 1;
  select * into e from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Xodim topilmadi' using errcode = '23503';
  end if;

  v_late := greatest(0, (extract(epoch from ((p_check_in at time zone 'Asia/Tashkent')::time - coalesce(e.schedule_start, s.work_start))) / 60)::integer);
  if v_late <= s.late_grace_minutes then v_late := 0; end if;
  if p_check_out is not null then
    v_early := greatest(0, (extract(epoch from (coalesce(e.schedule_end, s.work_end) - (p_check_out at time zone 'Asia/Tashkent')::time)) / 60)::integer);
    if v_early <= s.early_leave_grace_minutes then v_early := 0; end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);

  insert into public.employee_attendance as ea (
    employee_id, work_date, check_in_at, check_out_at, check_in_source, check_out_source,
    late_minutes, early_leave_minutes, review_status, is_corrected, note, recorded_by, reviewed_by, reviewed_at
  ) values (
    p_employee_id, p_work_date, p_check_in, p_check_out, 'admin',
    case when p_check_out is not null then 'admin'::public.attendance_source end,
    v_late, v_early, 'reviewed', true, trim(p_reason), (select auth.uid()), (select auth.uid()), now()
  )
  on conflict (employee_id, work_date) do update set
    check_in_at = excluded.check_in_at,
    check_out_at = excluded.check_out_at,
    check_in_source = case when ea.check_in_at = excluded.check_in_at then ea.check_in_source else 'admin' end,
    check_out_source = case when ea.check_out_at is not distinct from excluded.check_out_at then ea.check_out_source
                            when excluded.check_out_at is null then null else 'admin' end,
    late_minutes = excluded.late_minutes,
    early_leave_minutes = excluded.early_leave_minutes,
    review_status = 'reviewed',
    reviewed_by = excluded.reviewed_by,
    reviewed_at = now(),
    is_corrected = true,
    note = excluded.note
  returning * into rec;

  return rec;
end;
$$;

create or replace function public.review_employee_attendance(p_id uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.audit_reason', coalesce(nullif(trim(p_note), ''), 'Ko''rib chiqildi'), true);
  update public.employee_attendance
     set review_status = 'reviewed', reviewed_by = (select auth.uid()), reviewed_at = now(),
         note = coalesce(nullif(trim(p_note), ''), note)
   where id = p_id;
  if not found then
    raise exception 'Yozuv topilmadi' using errcode = '23503';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: bolalar davomatini bir martada saqlash
-- p_items: [{"child_id": "...", "status": "present", "note": "..."}]
-- ---------------------------------------------------------------------
create or replace function public.save_child_attendance(p_date date, p_items jsonb, p_reason text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_child uuid;
  v_status public.child_attendance_status;
  v_note text;
  v_count integer := 0;
begin
  if p_date is null or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Noto''g''ri ma''lumot' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Bir martada 500 tadan ortiq yozuv yuborib bo''lmaydi' using errcode = '22023';
  end if;
  if p_date < public.tashkent_today() then
    if p_reason is null or length(trim(p_reason)) < 5 then
      raise exception 'O''tgan kun davomatini tuzatish uchun sabab yozing' using errcode = '22023';
    end if;
    perform set_config('app.audit_reason', trim(p_reason), true);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_child := (v_item ->> 'child_id')::uuid;
    v_status := (v_item ->> 'status')::public.child_attendance_status;
    v_note := nullif(left(trim(coalesce(v_item ->> 'note', '')), 500), '');

    if not private.can_edit_child_attendance(v_child, p_date) then
      raise exception 'Bu bola uchun davomatni o''zgartirishga ruxsatingiz yo''q' using errcode = '42501';
    end if;

    insert into public.child_attendance as ca (child_id, date, status, note)
    values (v_child, p_date, v_status, v_note)
    on conflict (child_id, date) do update
      set status = excluded.status, note = excluded.note
      where ca.status is distinct from excluded.status or ca.note is distinct from excluded.note;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: hisob-kitob
-- ---------------------------------------------------------------------
create or replace function private.child_fee(p_child_id uuid)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select coalesce(c.monthly_fee, g.monthly_fee, s.default_monthly_fee)
  from public.children c
  left join public.kg_groups g on g.id = c.group_id
  cross join public.settings s
  where c.id = p_child_id;
$$;

create or replace function public.generate_monthly_invoices(p_period date)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_due date;
  v_count integer;
begin
  if not (select private.current_app_role()) in ('director', 'admin', 'accountant') then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if v_period > (date_trunc('month', public.tashkent_today()) + interval '12 months')::date then
    raise exception 'Juda uzoq kelajak oyi tanlandi' using errcode = '22023';
  end if;
  select v_period + (s.billing_due_day - 1) into v_due from public.settings s where id = 1;

  insert into public.invoices (child_id, period, base_amount, due_date, created_by)
  select c.id, v_period, private.child_fee(c.id), v_due, (select auth.uid())
  from public.children c
  where c.status = 'active'
    and c.enrollment_date <= (v_period + interval '1 month - 1 day')::date
  on conflict (child_id, period) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Avans to'lov uchun: kelgusi oy hisobini yaratish (yoki mavjudini qaytarish)
create or replace function public.ensure_invoice(p_child_id uuid, p_period date)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_id uuid;
  v_due date;
begin
  if not (select private.current_app_role()) in ('director', 'admin', 'accountant') then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if v_period > (date_trunc('month', public.tashkent_today()) + interval '12 months')::date then
    raise exception 'Juda uzoq kelajak oyi tanlandi' using errcode = '22023';
  end if;
  select id into v_id from public.invoices where child_id = p_child_id and period = v_period;
  if v_id is not null then
    return v_id;
  end if;
  if not exists (select 1 from public.children where id = p_child_id and status in ('active', 'paused')) then
    raise exception 'Faol bola topilmadi' using errcode = '23503';
  end if;
  select v_period + (s.billing_due_day - 1) into v_due from public.settings s where id = 1;
  insert into public.invoices (child_id, period, base_amount, due_date, created_by)
  values (p_child_id, v_period, private.child_fee(p_child_id), v_due, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.current_app_role()) in ('director', 'admin', 'accountant') then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Bekor qilish sababini yozing (kamida 5 belgi)' using errcode = '22023';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.payments set is_void = true, void_reason = trim(p_reason), voided_by = (select auth.uid())
   where id = p_payment_id and not is_void;
  if not found then
    raise exception 'To''lov topilmadi yoki allaqachon bekor qilingan' using errcode = '23503';
  end if;
end;
$$;

create or replace function public.add_invoice_adjustment(p_invoice_id uuid, p_kind public.adjustment_kind, p_amount bigint, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_amount bigint := p_amount;
begin
  if not (select private.has_perm('finance.adjust')) then
    raise exception 'Chegirma yoki tuzatish kiritishga ruxsatingiz yo''q' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Sababni yozing (kamida 5 belgi)' using errcode = '22023';
  end if;
  if p_kind = 'discount' then v_amount := -abs(p_amount);
  elsif p_kind = 'surcharge' then v_amount := abs(p_amount);
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  insert into public.invoice_adjustments (invoice_id, kind, amount, reason, approved_by)
  values (p_invoice_id, p_kind, v_amount, trim(p_reason), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_invoice_base(p_invoice_id uuid, p_amount bigint, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if p_amount < 0 then
    raise exception 'Summa manfiy bo''lishi mumkin emas' using errcode = '22023';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Sababni yozing (kamida 5 belgi)' using errcode = '22023';
  end if;
  perform set_config('app.audit_reason', trim(p_reason), true);
  update public.invoices set base_amount = p_amount where id = p_invoice_id;
  if not found then
    raise exception 'Hisob topilmadi' using errcode = '23503';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: o'z aloqa ma'lumotlarini yangilash
-- ---------------------------------------------------------------------
create or replace function public.update_my_contact(p_phone text, p_phone2 text default null, p_address text default null, p_workplace text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or (select private.current_app_role()) is null then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Telefon raqami noto''g''ri' using errcode = '22023';
  end if;
  if p_phone2 is not null and p_phone2 <> '' and p_phone2 !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Qo''shimcha telefon raqami noto''g''ri' using errcode = '22023';
  end if;
  update public.profiles set phone = p_phone where id = v_uid;
  update public.guardians set
    phone = p_phone,
    phone2 = nullif(trim(p_phone2), ''),
    address = left(nullif(trim(p_address), ''), 300),
    workplace = left(nullif(trim(p_workplace), ''), 200)
  where profile_id = v_uid;
  update public.employees set phone = p_phone where profile_id = v_uid;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql security definer
set search_path = ''
as $$
  update public.notifications set is_read = true
  where user_id = (select auth.uid()) and not is_read
    and (p_ids is null or id = any (p_ids));
$$;

-- ---------------------------------------------------------------------
-- Statistika (SECURITY INVOKER: RLS amal qiladi)
-- ---------------------------------------------------------------------
create or replace function public.stats_revenue_by_month(p_months integer default 12)
returns table (period date, expected bigint, collected bigint, outstanding bigint)
language sql stable security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', public.tashkent_today()) - make_interval(months => greatest(least(p_months, 36), 1) - 1),
      date_trunc('month', public.tashkent_today()),
      interval '1 month')::date as period
  )
  select m.period,
    coalesce((select sum(i.amount_due) from public.invoices i where i.period = m.period), 0)::bigint,
    coalesce((select sum(p.amount) from public.payments p
              where not p.is_void and date_trunc('month', p.paid_on) = m.period), 0)::bigint,
    coalesce((select sum(greatest(i.balance, 0)) from public.invoices i where i.period = m.period), 0)::bigint
  from months m
  order by m.period;
$$;

create or replace function public.stats_attendance_trend(p_days integer default 30)
returns table (day date, present bigint, late bigint, absent bigint, excused bigint)
language sql stable security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(public.tashkent_today() - (greatest(least(p_days, 120), 1) - 1), public.tashkent_today(), interval '1 day')::date as day
  )
  select d.day,
    count(*) filter (where a.status = 'present'),
    count(*) filter (where a.status = 'late'),
    count(*) filter (where a.status = 'absent'),
    count(*) filter (where a.status = 'excused')
  from days d
  left join public.child_attendance a on a.date = d.day
  group by d.day
  order by d.day;
$$;
