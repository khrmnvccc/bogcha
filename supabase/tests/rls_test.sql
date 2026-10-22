-- RLS and business-rule tests. Run via supabase/tests/run.sh.
-- Each check raises an exception on failure; ON_ERROR_STOP aborts the run.
\set QUIET on

-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'director@t', '{"role":"director","full_name":"Direktor","username":"direktor"}'),
  ('00000000-0000-0000-0000-000000000002', 'teacher1@t', '{"role":"teacher","full_name":"Ustoz Bir","username":"ustoz1"}'),
  ('00000000-0000-0000-0000-000000000003', 'teacher2@t', '{"role":"teacher","full_name":"Ustoz Ikki","username":"ustoz2"}'),
  ('00000000-0000-0000-0000-000000000004', 'parentA@t', '{"role":"parent","full_name":"Ota A","username":"ota.a"}'),
  ('00000000-0000-0000-0000-000000000005', 'parentB@t', '{"role":"parent","full_name":"Ona B","username":"ona.b"}'),
  ('00000000-0000-0000-0000-000000000006', 'cash@t', '{"role":"accountant","full_name":"Kassir","username":"kassir"}'),
  ('00000000-0000-0000-0000-000000000007', 'rogue@t', '{}');

insert into public.employees (id, profile_id, full_name, position) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Ustoz Bir', 'Tarbiyachi'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Ustoz Ikki', 'Tarbiyachi'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'Kassir', 'Hisobchi');
insert into public.kg_groups (id, name, monthly_fee) values
  ('20000000-0000-0000-0000-000000000001', 'Quyoshcha', 1200000),
  ('20000000-0000-0000-0000-000000000002', 'Yulduzcha', null);
insert into public.group_teachers values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', true, now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', true, now());
update public.settings set default_monthly_fee = 900000;
insert into public.children (id, full_name, birth_date, group_id, enrollment_date) values
  ('30000000-0000-0000-0000-00000000000a', 'Bola A', '2021-03-01', '20000000-0000-0000-0000-000000000001', '2024-09-01'),
  ('30000000-0000-0000-0000-00000000000b', 'Bola B', '2021-05-01', '20000000-0000-0000-0000-000000000002', '2024-09-01');
insert into public.guardians (id, profile_id, full_name, phone) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', 'Ota A', '+998901112233'),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000005', 'Ona B', '+998901112244');
insert into public.child_guardians (child_id, guardian_id, is_primary) values
  ('30000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', true),
  ('30000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-00000000000b', true);
insert into public.child_notes (child_id, category, body, created_by) values
  ('30000000-0000-0000-0000-00000000000a', 'allergy', 'Yong''oqqa allergiya', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-00000000000a', 'family', 'Oilaviy holat haqida maxfiy izoh', '00000000-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, false);
$$;
create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'ok  %', p_msg;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- user inserted without a role and provisioned afterwards (how Supabase Auth admin.createUser behaves)
insert into auth.users (id, email, raw_app_meta_data) values ('00000000-0000-0000-0000-000000000008', 'late@t', '{"provider":"email"}');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"teacher","full_name":"Kech Ustoz","username":"kech"}' where id = '00000000-0000-0000-0000-000000000008';
select pg_temp.check((select is_active and role = 'teacher' and username = 'kech' from public.profiles where id = '00000000-0000-0000-0000-000000000008'), 'late provisioning activates profile');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"director"}' where id = '00000000-0000-0000-0000-000000000008';
select pg_temp.check((select role = 'teacher' from public.profiles where id = '00000000-0000-0000-0000-000000000008'), 'later metadata change does not escalate profile role');
delete from auth.users where id = '00000000-0000-0000-0000-000000000008';

-- profile created by trigger, rogue user inactive
select pg_temp.check((select count(*) from public.profiles) = 7, 'profiles auto-created');
select pg_temp.check((select not is_active from public.profiles where id = '00000000-0000-0000-0000-000000000007'), 'user without role is inactive');

set role authenticated;

-- ---------- anonymous ----------
select pg_temp.as_user(null);
select pg_temp.check((select count(*) from public.children) = 0, 'no session sees no children');

-- ---------- rogue (no role) ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select pg_temp.check((select count(*) from public.children) = 0, 'rogue sees no children');
select pg_temp.check((select count(*) from public.settings) = 0, 'rogue sees no settings');

-- ---------- director ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.children) = 2, 'director sees all children');
select pg_temp.check((select public.generate_monthly_invoices(date_trunc('month', public.tashkent_today())::date)) = 2, 'invoices generated');
select pg_temp.check((select public.generate_monthly_invoices(date_trunc('month', public.tashkent_today())::date)) = 0, 'invoice generation idempotent');
select pg_temp.check((select base_amount from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 1200000, 'group fee used');
select pg_temp.check((select base_amount from public.invoices where child_id = '30000000-0000-0000-0000-00000000000b') = 900000, 'default fee used');
select pg_temp.check((select status from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 'unpaid', 'new invoice unpaid');

-- ---------- accountant records payments ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.employee_attendance) = 0 and (select count(*) from public.employees where profile_id <> '00000000-0000-0000-0000-000000000006') = 0, 'accountant cannot see other employees');
select pg_temp.check((select count(*) from public.child_notes) = 0, 'accountant cannot see child notes');
insert into public.payments (invoice_id, amount, method, paid_on, recorded_by)
  select id, 500000, 'cash', public.tashkent_today(), '00000000-0000-0000-0000-000000000006'
  from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check((select status from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 'partial', 'partial status');
select pg_temp.check((select balance from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 700000, 'balance after partial');

do $$ begin
  insert into public.payments (invoice_id, amount, method, paid_on, recorded_by)
    select id, 800000, 'cash', public.tashkent_today(), '00000000-0000-0000-0000-000000000006'
    from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a';
  raise exception 'FAIL: overpayment allowed';
exception when sqlstate '22023' then raise notice 'ok  overpayment rejected';
end $$;

do $$ begin
  update public.payments set amount = 1 where true;
  raise exception 'FAIL: payment update allowed';
exception when insufficient_privilege then raise notice 'ok  direct payment edit rejected';
end $$;

insert into public.payments (invoice_id, amount, method, paid_on, recorded_by, receipt_number)
  select id, 700000, 'bank_transfer', public.tashkent_today(), '00000000-0000-0000-0000-000000000006', 'BANK-1'
  from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check((select status from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 'paid', 'paid status');

select public.void_payment((select id from public.payments where receipt_number = 'BANK-1'), 'Xato kiritilgan summa');
select pg_temp.check((select status from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 'partial', 'void restores balance');

do $$ begin
  perform public.add_invoice_adjustment((select id from public.invoices limit 1), 'discount', 100000, 'Aka-uka chegirmasi');
  raise exception 'FAIL: accountant adjusted without permission';
exception when insufficient_privilege then raise notice 'ok  adjustment needs permission';
end $$;

-- advance payment for next month
select pg_temp.check((select public.ensure_invoice('30000000-0000-0000-0000-00000000000b', (date_trunc('month', public.tashkent_today()) + interval '1 month')::date)) is not null, 'advance invoice created');

-- ---------- director: adjustments and audit ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.add_invoice_adjustment((select id from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a'), 'discount', 200000, 'Aka-uka chegirmasi');
select pg_temp.check((select amount_due from public.invoices where child_id = '30000000-0000-0000-0000-00000000000a') = 1000000, 'discount applied');
select pg_temp.check((select count(*) from public.audit_logs where entity = 'payments' and action = 'update' and reason = 'Xato kiritilgan summa') = 1, 'void audited with reason');
select pg_temp.check((select count(*) from public.audit_logs where entity = 'invoice_adjustments') = 1, 'adjustment audited');

-- ---------- teacher 1 ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.children) = 1, 'teacher sees only own group children');
select pg_temp.check((select count(*) from public.invoices) = 0, 'teacher sees no invoices');
select pg_temp.check((select count(*) from public.child_notes) = 1, 'teacher sees allergy note only');
select pg_temp.check((select count(*) from public.guardians) = 1, 'teacher sees own group guardians');
select pg_temp.check((select public.save_child_attendance(public.tashkent_today(),
  '[{"child_id":"30000000-0000-0000-0000-00000000000a","status":"present"}]'::jsonb)) = 1, 'teacher marks today');
select pg_temp.check((select recorded_by from public.child_attendance limit 1) = '00000000-0000-0000-0000-000000000002', 'recorded_by stamped');
do $$ begin
  perform public.save_child_attendance(public.tashkent_today(), '[{"child_id":"30000000-0000-0000-0000-00000000000b","status":"present"}]'::jsonb);
  raise exception 'FAIL: teacher marked other group';
exception when insufficient_privilege then raise notice 'ok  teacher blocked on other group';
end $$;
do $$ begin
  perform public.save_child_attendance(public.tashkent_today() - 1, '[{"child_id":"30000000-0000-0000-0000-00000000000a","status":"absent"}]'::jsonb, 'Xato belgilangan edi');
  raise exception 'FAIL: teacher edited history';
exception when insufficient_privilege then raise notice 'ok  teacher blocked on past date';
end $$;
do $$ begin
  insert into public.child_attendance (child_id, date, status) values ('30000000-0000-0000-0000-00000000000a', public.tashkent_today() - 2, 'present');
  raise exception 'FAIL: direct insert allowed';
exception when insufficient_privilege then raise notice 'ok  direct attendance insert blocked';
end $$;

-- employee check in/out
select pg_temp.check((select (public.employee_check_in()).check_in_source) = 'self', 'teacher self check-in');
do $$ begin
  perform public.employee_check_in();
  raise exception 'FAIL: duplicate check-in';
exception when unique_violation then raise notice 'ok  duplicate check-in rejected';
end $$;
do $$ begin
  update public.employee_attendance set check_in_at = now() - interval '2 hours';
  raise exception 'FAIL: employee edited own timestamp';
exception when insufficient_privilege then raise notice 'ok  employee cannot edit own timestamps';
end $$;
select pg_temp.check((select count(*) from public.employee_attendance) = 1, 'teacher sees own attendance');
do $$ begin
  perform public.admin_set_employee_attendance('10000000-0000-0000-0000-000000000002', public.tashkent_today(), now() - interval '1 hour', null, 'Tuzatish uchun');
  raise exception 'FAIL: teacher used admin correction';
exception when insufficient_privilege then raise notice 'ok  teacher cannot correct';
end $$;
do $$ begin
  update public.profiles set role = 'director' where id = '00000000-0000-0000-0000-000000000002';
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000002' and role = 'director') then
    raise exception 'FAIL: privilege escalation';
  end if;
  raise notice 'ok  no self role escalation (0 rows)';
exception when insufficient_privilege then raise notice 'ok  no self role escalation';
end $$;

-- ---------- parent A ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.children) = 1 and (select full_name from public.children) = 'Bola A', 'parent sees only own child');
select pg_temp.check((select count(*) from public.invoices) = 1, 'parent sees only own invoices');
select pg_temp.check((select count(*) from public.payments) = 2, 'parent sees own payments');
select pg_temp.check((select count(*) from public.guardians) = 1, 'parent sees only self guardian');
select pg_temp.check((select count(*) from public.child_notes) = 0, 'parent cannot read notes');
select pg_temp.check((select count(*) from public.child_attendance) = 1, 'parent sees own child attendance');
select pg_temp.check((select count(*) from public.employees) = 0, 'parent sees no employees');
select pg_temp.check((select count(*) from public.profiles) = 1, 'parent sees only own profile');
select pg_temp.check((select count(*) from public.notifications) >= 2, 'parent got invoice/payment notifications');
select pg_temp.check((select count(*) from public.audit_logs) = 0, 'parent cannot read audit log');
do $$ begin
  perform public.employee_check_in();
  raise exception 'FAIL: parent check-in';
exception when insufficient_privilege then raise notice 'ok  parent cannot check in';
end $$;
select public.update_my_contact('+998 90 999 88 77', null, 'Toshkent', null);
select pg_temp.check((select phone from public.guardians) = '+998 90 999 88 77', 'parent updates own contact');

-- ---------- parent B ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.payments) = 0, 'parent B sees no payments of A');
select pg_temp.check((select count(*) from public.child_attendance) = 0, 'parent B sees no attendance of A');
select pg_temp.check((select count(*) from public.children where full_name = 'Bola A') = 0, 'parent B cannot see Bola A');

-- ---------- announcements ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into public.announcements (title, body, audience, group_id, created_by)
  values ('Guruh yig''ilishi', 'Ertaga soat 17:00 da', 'group', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.announcements) = 1, 'parent A sees group announcement');
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.announcements) = 0, 'parent B does not see other group announcement');
do $$ begin
  insert into public.announcements (title, body, audience, created_by) values ('Soxta', 'Soxta e''lon', 'all_parents', '00000000-0000-0000-0000-000000000005');
  raise exception 'FAIL: parent published';
exception when insufficient_privilege then raise notice 'ok  parent cannot publish';
end $$;

-- ---------- director correction ----------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select public.save_child_attendance(public.tashkent_today() - 1,
  '[{"child_id":"30000000-0000-0000-0000-00000000000b","status":"excused","note":"Kasal"}]'::jsonb, 'Kechagi davomat kiritilmagan edi')) = 1, 'director corrects history');
select pg_temp.check((select (public.admin_set_employee_attendance('10000000-0000-0000-0000-000000000003',
  public.tashkent_today() - 1,
  ((public.tashkent_today() - 1)::timestamp + time '08:30') at time zone 'Asia/Tashkent',
  ((public.tashkent_today() - 1)::timestamp + time '17:00') at time zone 'Asia/Tashkent',
  'Xodim telefonini unutgan')).worked_minutes) = 510, 'admin correction computes hours');
select pg_temp.check((select late_minutes from public.employee_attendance where employee_id = '10000000-0000-0000-0000-000000000003') = 30, 'late minutes computed');
do $$ begin
  update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001';
  raise exception 'FAIL: self deactivation';
exception when insufficient_privilege then raise notice 'ok  cannot deactivate self';
end $$;

reset role;
select pg_temp.check((select count(*) from public.outbound_messages) = 0, 'no telegram queued without chat ids');
\echo ALL RLS TESTS PASSED
