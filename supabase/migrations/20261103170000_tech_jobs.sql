-- Dispatch: the office creates job orders (from an online booking, a quote,
-- or from scratch) and assigns them to a technician, who works them in the
-- Home Service phone app. Finishing the job links the bill back.

create table if not exists public.job_no_counters (
  business_date date primary key,
  next_value int not null default 1
);

create table if not exists public.tech_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text unique,
  status text not null default 'assigned'
    check (status in ('unassigned', 'assigned', 'accepted', 'on_the_way', 'in_progress', 'done', 'cancelled')),
  assigned_to uuid references public.staff(id) on delete set null,
  scheduled_date date,
  time_slot text,
  client_name text not null,
  client_contact text,
  vehicle_description text,
  plate_number text,
  address text,
  maps_link text,
  instructions text,
  planned_items jsonb not null default '[]'::jsonb,
  home_service_booking_id uuid references public.home_service_bookings(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  bill_id uuid references public.bills(id) on delete set null,
  created_by uuid references public.staff(id) on delete set null,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tech_jobs_assigned on public.tech_jobs(assigned_to, status);
create index if not exists idx_tech_jobs_booking on public.tech_jobs(home_service_booking_id);

alter table public.bills add column if not exists tech_job_id uuid references public.tech_jobs(id) on delete set null;

-- job_no: JO-YYYYMMDD-NNN; also keeps updated_at fresh
create or replace function public.set_tech_job_defaults()
returns trigger language plpgsql set search_path = public as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v_seq int;
begin
  if tg_op = 'INSERT' and new.job_no is null then
    insert into public.job_no_counters(business_date, next_value) values (v_date, 2)
    on conflict (business_date) do update set next_value = job_no_counters.next_value + 1
    returning next_value - 1 into v_seq;
    new.job_no := 'JO-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
  end if;
  if new.assigned_to is null and new.status = 'assigned' then new.status := 'unassigned'; end if;
  if new.assigned_to is not null and new.status = 'unassigned' then new.status := 'assigned'; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_tech_job_defaults on public.tech_jobs;
create trigger trg_tech_job_defaults before insert or update on public.tech_jobs
  for each row execute function public.set_tech_job_defaults();

alter table public.tech_jobs enable row level security;
alter table public.job_no_counters enable row level security;
drop policy if exists tech_jobs_staff_all on public.tech_jobs;
create policy tech_jobs_staff_all on public.tech_jobs for all using (public.is_shop_staff()) with check (public.is_shop_staff());
drop policy if exists job_no_counters_staff on public.job_no_counters;
create policy job_no_counters_staff on public.job_no_counters for all using (public.is_shop_staff()) with check (public.is_shop_staff());
grant select, insert, update, delete on public.tech_jobs, public.job_no_counters to authenticated;
grant all on public.tech_jobs, public.job_no_counters to service_role;
