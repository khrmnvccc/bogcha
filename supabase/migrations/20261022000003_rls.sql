-- =====================================================================
-- Row Level Security siyosatlari va huquqlar
-- Qoida: hech bir jadval anon uchun ochiq emas. Yozish asosan
-- tekshiruvli RPC'lar orqali (SECURITY DEFINER) amalga oshiriladi.
-- =====================================================================

create or replace function private.is_cashier()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('director', 'admin', 'accountant'), false);
$$;

alter table public.settings enable row level security;
alter table public.academic_periods enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.kg_groups enable row level security;
alter table public.group_teachers enable row level security;
alter table public.children enable row level security;
alter table public.child_notes enable row level security;
alter table public.guardians enable row level security;
alter table public.child_guardians enable row level security;
alter table public.pickup_contacts enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.child_attendance enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_adjustments enable row level security;
alter table public.payments enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------
-- Sozlamalar
-- ---------------------------------------------------------------------
create policy settings_read on public.settings for select to authenticated
  using ((select private.current_app_role()) is not null);
create policy settings_admin_update on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy periods_read on public.academic_periods for select to authenticated
  using ((select private.is_staff()));
create policy periods_admin_all on public.academic_periods for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Profillar
-- ---------------------------------------------------------------------
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_staff_read on public.profiles for select to authenticated
  using ((select private.is_staff()) and role <> 'parent');
create policy profiles_admin_read on public.profiles for select to authenticated
  using ((select private.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Xodimlar
-- ---------------------------------------------------------------------
create policy employees_admin_all on public.employees for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy employees_self_read on public.employees for select to authenticated
  using (profile_id = (select auth.uid()));
create policy employees_coteacher_read on public.employees for select to authenticated
  using (id in (select gt.employee_id from public.group_teachers gt
                where gt.group_id in (select private.teacher_group_ids())));

-- ---------------------------------------------------------------------
-- Guruhlar
-- ---------------------------------------------------------------------
create policy groups_staff_read on public.kg_groups for select to authenticated
  using ((select private.is_staff()));
create policy groups_parent_read on public.kg_groups for select to authenticated
  using (id in (select c.group_id from public.children c where c.id in (select private.parent_child_ids())));
create policy groups_admin_all on public.kg_groups for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy group_teachers_staff_read on public.group_teachers for select to authenticated
  using ((select private.is_staff()));
create policy group_teachers_admin_all on public.group_teachers for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Bolalar
-- ---------------------------------------------------------------------
create policy children_admin_all on public.children for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy children_finance_read on public.children for select to authenticated
  using ((select private.is_finance()));
create policy children_teacher_read on public.children for select to authenticated
  using (id in (select private.teacher_child_ids()));
create policy children_parent_read on public.children for select to authenticated
  using (id in (select private.parent_child_ids()));

create policy child_notes_read on public.child_notes for select to authenticated
  using ((select private.is_admin())
         or (child_id in (select private.teacher_child_ids())
             and (category in ('medical', 'allergy') or (select private.has_perm('children.view_notes')))));
create policy child_notes_insert on public.child_notes for insert to authenticated
  with check (created_by = (select auth.uid())
              and ((select private.is_admin()) or child_id in (select private.teacher_child_ids())));
create policy child_notes_admin_delete on public.child_notes for delete to authenticated
  using ((select private.is_admin()));

create policy guardians_admin_all on public.guardians for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy guardians_finance_read on public.guardians for select to authenticated
  using ((select private.is_finance()));
create policy guardians_teacher_read on public.guardians for select to authenticated
  using (id in (select cg.guardian_id from public.child_guardians cg
                where cg.child_id in (select private.teacher_child_ids())));
create policy guardians_self_read on public.guardians for select to authenticated
  using (profile_id = (select auth.uid()));

create policy child_guardians_admin_all on public.child_guardians for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy child_guardians_finance_read on public.child_guardians for select to authenticated
  using ((select private.is_finance()));
create policy child_guardians_teacher_read on public.child_guardians for select to authenticated
  using (child_id in (select private.teacher_child_ids()));
create policy child_guardians_parent_read on public.child_guardians for select to authenticated
  using (guardian_id = (select private.current_guardian_id()));

create policy pickup_admin_all on public.pickup_contacts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy pickup_teacher_read on public.pickup_contacts for select to authenticated
  using (child_id in (select private.teacher_child_ids()));
create policy pickup_parent_read on public.pickup_contacts for select to authenticated
  using (child_id in (select private.parent_child_ids()));

-- ---------------------------------------------------------------------
-- Davomat (yozish faqat RPC orqali)
-- ---------------------------------------------------------------------
create policy emp_att_admin_read on public.employee_attendance for select to authenticated
  using ((select private.is_admin()));
create policy emp_att_self_read on public.employee_attendance for select to authenticated
  using (employee_id = (select private.current_employee_id()));

create policy child_att_admin_read on public.child_attendance for select to authenticated
  using ((select private.is_admin()));
create policy child_att_teacher_read on public.child_attendance for select to authenticated
  using (child_id in (select private.teacher_child_ids()));
create policy child_att_parent_read on public.child_attendance for select to authenticated
  using (child_id in (select private.parent_child_ids()));

-- ---------------------------------------------------------------------
-- Moliya
-- ---------------------------------------------------------------------
create policy invoices_finance_read on public.invoices for select to authenticated
  using ((select private.is_finance()));
create policy invoices_parent_read on public.invoices for select to authenticated
  using (child_id in (select private.parent_child_ids()));

create policy adjustments_finance_read on public.invoice_adjustments for select to authenticated
  using ((select private.is_finance()));
create policy adjustments_parent_read on public.invoice_adjustments for select to authenticated
  using (invoice_id in (select i.id from public.invoices i where i.child_id in (select private.parent_child_ids())));

create policy payments_finance_read on public.payments for select to authenticated
  using ((select private.is_finance()));
create policy payments_parent_read on public.payments for select to authenticated
  using (child_id in (select private.parent_child_ids()));
create policy payments_cashier_insert on public.payments for insert to authenticated
  with check ((select private.is_cashier()) and recorded_by = (select auth.uid()));

-- ---------------------------------------------------------------------
-- E'lonlar va bildirishnomalar
-- ---------------------------------------------------------------------
create policy announcements_read on public.announcements for select to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
    or (audience = 'everyone' and (select private.current_app_role()) is not null)
    or (audience = 'all_parents' and (select private.current_guardian_id()) is not null)
    or (audience = 'all_staff' and (select private.is_staff()))
    or (audience = 'group' and (
          group_id in (select private.teacher_group_ids())
          or group_id in (select c.group_id from public.children c where c.id in (select private.parent_child_ids()))))
    or (audience = 'guardian' and guardian_id = (select private.current_guardian_id()))
  );
create policy announcements_insert on public.announcements for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.has_perm('announcements.publish'))
    and ((select private.is_admin()) or (audience = 'group' and group_id in (select private.teacher_group_ids())))
  );
create policy announcements_update on public.announcements for update to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()))
  with check ((select private.is_admin()) or created_by = (select auth.uid()));
create policy announcements_delete on public.announcements for delete to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()));

create policy notifications_self_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_self_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy outbound_admin_read on public.outbound_messages for select to authenticated
  using ((select private.is_admin()));

create policy audit_admin_read on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Huquqlar: anon hech narsaga ega emas
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- Qurilma orqali belgilash faqat server (service_role) uchun
revoke execute on function public.device_check(uuid, text) from authenticated;
grant execute on function public.device_check(uuid, text) to service_role;

-- Audit va o'zgarmas jadvallar: to'g'ridan-to'g'ri o'zgartirish yo'q
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke update, delete, truncate on public.payments from authenticated;
revoke insert, update, delete, truncate on public.employee_attendance from authenticated;
revoke insert, update, delete, truncate on public.child_attendance from authenticated;
revoke insert, update, delete, truncate on public.invoices from authenticated;
revoke insert, update, delete, truncate on public.invoice_adjustments from authenticated;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant delete on public.notifications to authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke insert, update, delete, truncate on public.outbound_messages from authenticated;
-- Profilda faqat quyidagi ustunlarni admin yangilay oladi (RLS bilan birga)
revoke update on public.profiles from authenticated;
grant update (full_name, phone, role, permissions, is_active) on public.profiles to authenticated;

grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon;

alter default privileges in schema public revoke execute on functions from public, anon;
