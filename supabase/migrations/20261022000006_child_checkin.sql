-- =====================================================================
-- Bolaning kelish-ketish vaqti (yuz orqali yoki qo'lda) va ota-ona roziligi
-- Yuzni solishtirish faqat tarbiyachi telefonida bajariladi: bazaga
-- biometrik shablon yoki kamera tasviri yozilmaydi.
-- =====================================================================

alter table public.child_attendance
  add column arrived_at timestamptz,
  add column left_at timestamptz,
  add column check_method text check (check_method in ('face', 'manual'));

alter table public.children
  add column face_consent boolean not null default false,
  add column face_consent_at timestamptz,
  add column face_consent_by uuid references public.profiles (id) on delete set null;

-- Ota-ona (o'z farzandi uchun) yoki administrator rozilikni yoqadi/o'chiradi
create or replace function public.set_face_consent(p_child uuid, p_value boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_child is null or p_value is null then
    raise exception 'Noto''g''ri ma''lumot' using errcode = '22023';
  end if;
  if not ((select private.is_admin()) or p_child in (select private.parent_child_ids())) then
    raise exception 'Bu amalni bajarishga ruxsatingiz yo''q' using errcode = '42501';
  end if;
  update public.children
     set face_consent = p_value,
         face_consent_at = case when p_value then now() else null end,
         face_consent_by = case when p_value then (select auth.uid()) else null end
   where id = p_child;
end;
$$;

-- Tarbiyachi (o'z guruhidagi bola) yoki administrator bugungi kelish/ketishni belgilaydi
create or replace function public.child_check(p_child uuid, p_action text, p_method text default 'manual')
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := public.tashkent_today();
  v_now timestamptz := now();
  v_row public.child_attendance;
  v_name text;
  v_consent boolean;
  v_time text;
begin
  if p_child is null or p_action not in ('in', 'out') or p_method not in ('face', 'manual') then
    raise exception 'Noto''g''ri ma''lumot' using errcode = '22023';
  end if;
  if not ((select private.is_admin()) or p_child in (select private.teacher_child_ids())) then
    raise exception 'Bu bola sizning guruhingizda emas' using errcode = '42501';
  end if;
  select full_name, face_consent into v_name, v_consent from public.children where id = p_child and status = 'active';
  if v_name is null then
    raise exception 'Bola topilmadi' using errcode = '23503';
  end if;
  if p_method = 'face' and not v_consent then
    raise exception 'Ota-ona yuz orqali tekshirishga rozilik bermagan' using errcode = '42501';
  end if;

  select * into v_row from public.child_attendance where child_id = p_child and date = v_today for update;
  v_time := to_char(v_now at time zone 'Asia/Tashkent', 'HH24:MI');

  if p_action = 'in' then
    if found and v_row.arrived_at is not null then
      raise exception 'Bola bugun allaqachon kelgan deb belgilangan (%)', to_char(v_row.arrived_at at time zone 'Asia/Tashkent', 'HH24:MI') using errcode = '22023';
    end if;
    if found then
      update public.child_attendance
         set status = case when status in ('present', 'late') then status else 'present' end,
             arrived_at = v_now, check_method = p_method
       where id = v_row.id;
    else
      insert into public.child_attendance (child_id, date, status, arrived_at, check_method)
      values (p_child, v_today, 'present', v_now, p_method);
    end if;
    perform private.notify_child_guardians(p_child, 'attendance', 'Farzandingiz keldi',
      v_name || ' bog''chaga keldi: ' || v_time, '/ota-ona/davomat');
  else
    if not found or v_row.arrived_at is null then
      raise exception 'Avval bolaning kelganini belgilang' using errcode = '22023';
    end if;
    if v_row.left_at is not null then
      raise exception 'Bola bugun allaqachon ketgan deb belgilangan (%)', to_char(v_row.left_at at time zone 'Asia/Tashkent', 'HH24:MI') using errcode = '22023';
    end if;
    update public.child_attendance set left_at = v_now where id = v_row.id;
    perform private.notify_child_guardians(p_child, 'attendance', 'Farzandingiz olib ketildi',
      v_name || ' bog''chadan olib ketildi: ' || v_time, '/ota-ona/davomat');
  end if;
  return v_now;
end;
$$;

revoke execute on function public.set_face_consent(uuid, boolean) from public, anon;
revoke execute on function public.child_check(uuid, text, text) from public, anon;
grant execute on function public.set_face_consent(uuid, boolean) to authenticated;
grant execute on function public.child_check(uuid, text, text) to authenticated;
