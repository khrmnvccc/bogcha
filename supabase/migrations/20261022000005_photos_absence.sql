-- =====================================================================
-- Bolalar va xodimlar rasmlari, ota-onaning "bugun kelmaydi" xabari
-- =====================================================================

-- ---------------------------------------------------------------------
-- Rasmlar: kichik (≈400px) JPEG/PNG/WebP fayllar bazada saqlanadi.
-- Ko'rish huquqi egasining (bola/xodim) ko'rish huquqidan olinadi.
-- ---------------------------------------------------------------------
alter table public.children add column photo_updated_at timestamptz;
alter table public.employees add column photo_updated_at timestamptz;

create table public.photos (
  kind text not null check (kind in ('child', 'employee')),
  owner_id uuid not null,
  data bytea not null check (octet_length(data) <= 1572864),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (kind, owner_id)
);
alter table public.photos enable row level security;

create policy photos_read on public.photos for select to authenticated
  using (
    (kind = 'child' and exists (select 1 from public.children c where c.id = owner_id))
    or (kind = 'employee' and exists (select 1 from public.employees e where e.id = owner_id))
  );
revoke all on public.photos from anon;
revoke insert, update, delete, truncate on public.photos from authenticated;
grant select on public.photos to authenticated;

create or replace function private.can_edit_photo(p_kind text, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select private.is_admin())
    or (p_kind = 'child' and p_owner in (select private.teacher_child_ids()))
    or (p_kind = 'employee' and p_owner = (select private.current_employee_id()));
$$;

-- p_data: base64; null bo'lsa rasm o'chiriladi
create or replace function public.set_photo(p_kind text, p_owner uuid, p_data text, p_mime text)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_now timestamptz := now();
begin
  if p_kind not in ('child', 'employee') or p_owner is null then
    raise exception 'Noto''g''ri ma''lumot' using errcode = '22023';
  end if;
  if not private.can_edit_photo(p_kind, p_owner) then
    raise exception 'Bu rasmni o''zgartirishga ruxsatingiz yo''q' using errcode = '42501';
  end if;
  if p_kind = 'child' and not exists (select 1 from public.children where id = p_owner)
     or p_kind = 'employee' and not exists (select 1 from public.employees where id = p_owner) then
    raise exception 'Topilmadi' using errcode = '23503';
  end if;

  if p_data is null then
    delete from public.photos where kind = p_kind and owner_id = p_owner;
    v_now := null;
  else
    if p_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Faqat JPG, PNG yoki WebP rasm' using errcode = '22023';
    end if;
    v_bytes := decode(p_data, 'base64');
    if octet_length(v_bytes) > 1572864 then
      raise exception 'Rasm juda katta (1,5 MB dan oshmasin)' using errcode = '22023';
    end if;
    insert into public.photos (kind, owner_id, data, mime, updated_at, updated_by)
    values (p_kind, p_owner, v_bytes, p_mime, v_now, (select auth.uid()))
    on conflict (kind, owner_id) do update
      set data = excluded.data, mime = excluded.mime, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;

  if p_kind = 'child' then
    update public.children set photo_updated_at = v_now where id = p_owner;
  else
    update public.employees set photo_updated_at = v_now where id = p_owner;
  end if;
  return v_now;
end;
$$;

-- ---------------------------------------------------------------------
-- Ota-ona: "Farzandim kelmaydi" xabari (bugundan 14 kungacha)
-- ---------------------------------------------------------------------
create table public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  date date not null,
  note text check (note is null or length(note) <= 300),
  reported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (child_id, date)
);
create index absence_reports_date_idx on public.absence_reports (date);
alter table public.absence_reports enable row level security;

create policy absence_admin_read on public.absence_reports for select to authenticated
  using ((select private.is_admin()));
create policy absence_teacher_read on public.absence_reports for select to authenticated
  using (child_id in (select private.teacher_child_ids()));
create policy absence_parent_read on public.absence_reports for select to authenticated
  using (child_id in (select private.parent_child_ids()));
revoke all on public.absence_reports from anon;
revoke insert, update, delete, truncate on public.absence_reports from authenticated;
grant select on public.absence_reports to authenticated;

create or replace function public.report_child_absence(p_child uuid, p_date date, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_child is null or p_child not in (select private.parent_child_ids()) then
    raise exception 'Bu bola uchun xabar yubora olmaysiz' using errcode = '42501';
  end if;
  if p_date is null or p_date < public.tashkent_today() or p_date > public.tashkent_today() + 14 then
    raise exception 'Sana bugundan 14 kungacha bo''lishi kerak' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 300 then
    raise exception 'Izoh 300 belgidan oshmasin' using errcode = '22023';
  end if;

  insert into public.absence_reports (child_id, date, note, reported_by)
  values (p_child, p_date, v_note, (select auth.uid()))
  on conflict (child_id, date) do update set note = excluded.note, reported_by = excluded.reported_by, created_at = now()
  returning id into v_id;

  -- Bugun uchun davomat hali belgilanmagan bo'lsa, "sababli" deb qo'yiladi
  if p_date = public.tashkent_today() then
    insert into public.child_attendance (child_id, date, status, note)
    values (p_child, p_date, 'excused', left('Ota-ona: ' || coalesce(v_note, 'kelmaydi'), 500))
    on conflict (child_id, date) do nothing;
  end if;

  select full_name into v_name from public.children where id = p_child;
  insert into public.notifications (user_id, kind, title, body, link)
  select distinct e.profile_id, 'attendance', 'Bola kelmaydi',
    v_name || ' ' || to_char(p_date, 'DD.MM.YYYY') || ' kuni kelmaydi (ota-ona xabari)'
      || coalesce('. Sabab: ' || v_note, ''),
    '/davomat'
  from public.children c
  join public.group_teachers gt on gt.group_id = c.group_id
  join public.employees e on e.id = gt.employee_id and e.status <> 'terminated'
  join public.profiles p on p.id = e.profile_id and p.is_active
  where c.id = p_child;

  return v_id;
end;
$$;

create or replace function public.cancel_child_absence(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.absence_reports
   where id = p_id
     and child_id in (select private.parent_child_ids())
     and date >= public.tashkent_today();
  if not found then
    raise exception 'Xabar topilmadi yoki bekor qilib bo''lmaydi' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.set_photo(text, uuid, text, text) from public, anon;
revoke execute on function public.report_child_absence(uuid, date, text) from public, anon;
revoke execute on function public.cancel_child_absence(uuid) from public, anon;
grant execute on function public.set_photo(text, uuid, text, text) to authenticated;
grant execute on function public.report_child_absence(uuid, date, text) to authenticated;
grant execute on function public.cancel_child_absence(uuid) to authenticated;
grant execute on function private.can_edit_photo(text, uuid) to authenticated, service_role;
