-- Technician phone app for home service: technicians get their own login
-- (role 'technician', linked to their staff row) and can read/complete
-- home-service bookings and create bills from the field.

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role = any (array['admin', 'fleet_manager', 'customer', 'technician']));

alter table public.bills add column if not exists home_service_booking_id uuid
  references public.home_service_bookings(id) on delete set null;

drop policy if exists hs_staff_select on public.home_service_bookings;
create policy hs_staff_select on public.home_service_bookings for select using (public.is_shop_staff());
drop policy if exists hs_staff_update on public.home_service_bookings;
create policy hs_staff_update on public.home_service_bookings for update using (public.is_shop_staff()) with check (public.is_shop_staff());
