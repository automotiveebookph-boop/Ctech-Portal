-- Billing statements: an editable copy of a quotation that is sent to the
-- client as a bill and tracks payments (cash / GCash / bank / card, partial OK).

create table if not exists public.bill_no_counters (
  business_date date primary key,
  next_value int not null default 1
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_no text unique,
  quote_id uuid references public.quotes(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  client_name text,
  client_contact text,
  vehicle_description text,
  plate_number text,
  odometer_km integer,
  due_date date not null default ((now() at time zone 'Asia/Manila')::date),
  prepared_by uuid references public.staff(id) on delete set null,
  notes text,
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'void')),
  subtotal_services numeric not null default 0,
  subtotal_parts numeric not null default 0,
  total_amount numeric generated always as (subtotal_services + subtotal_parts) stored,
  amount_paid numeric not null default 0,
  balance numeric generated always as (subtotal_services + subtotal_parts - amount_paid) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_client_identity_chk check (customer_id is not null or client_name is not null),
  constraint bills_vehicle_identity_chk check (vehicle_id is not null or vehicle_description is not null)
);

create table if not exists public.bill_line_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  category text not null check (category in ('service', 'part')),
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric generated always as (qty * unit_price) stored,
  service_pricing_id uuid references public.service_pricing(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_bill_line_items_bill on public.bill_line_items(bill_id);

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('cash', 'gcash', 'bank', 'card')),
  reference text,
  notes text,
  received_by uuid references public.staff(id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_bill_payments_bill on public.bill_payments(bill_id);

alter table public.quotes add column if not exists converted_bill_id uuid references public.bills(id) on delete set null;

-- bill_no: CTB-YYYYMMDD-NNN, per-day sequence (mirrors set_quote_no)
create or replace function public.set_bill_no()
returns trigger language plpgsql set search_path = public as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v_seq int;
begin
  if new.bill_no is null then
    insert into public.bill_no_counters(business_date, next_value)
    values (v_date, 2)
    on conflict (business_date) do update set next_value = bill_no_counters.next_value + 1
    returning next_value - 1 into v_seq;
    new.bill_no := 'CTB-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 3, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bill_no on public.bills;
create trigger trg_bill_no before insert on public.bills for each row execute function public.set_bill_no();

-- Keeps subtotals, amount_paid and status in sync with line items + payments.
create or replace function public.refresh_bill(p_bill_id uuid)
returns void language plpgsql set search_path = public as $$
declare
  v_svc numeric;
  v_parts numeric;
  v_paid numeric;
begin
  select coalesce(sum(amount) filter (where category = 'service'), 0),
         coalesce(sum(amount) filter (where category = 'part'), 0)
    into v_svc, v_parts
    from public.bill_line_items where bill_id = p_bill_id;
  select coalesce(sum(amount), 0) into v_paid from public.bill_payments where bill_id = p_bill_id;

  update public.bills b
     set subtotal_services = v_svc,
         subtotal_parts = v_parts,
         amount_paid = v_paid,
         status = case
           when b.status = 'void' then 'void'
           when v_paid <= 0 then 'unpaid'
           when v_paid >= v_svc + v_parts then 'paid'
           else 'partial'
         end,
         updated_at = now()
   where b.id = p_bill_id;
end;
$$;

create or replace function public.trg_refresh_bill()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.refresh_bill(coalesce(new.bill_id, old.bill_id));
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_refresh_bill_lines on public.bill_line_items;
create trigger trg_refresh_bill_lines after insert or update or delete on public.bill_line_items
  for each row execute function public.trg_refresh_bill();
drop trigger if exists trg_refresh_bill_payments on public.bill_payments;
create trigger trg_refresh_bill_payments after insert or update or delete on public.bill_payments
  for each row execute function public.trg_refresh_bill();

-- Copies a quote (header + lines) into a new bill. Idempotent: returns the
-- existing bill if the quote was already converted.
create or replace function public.convert_quote_to_bill(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotes%rowtype;
  v_bill_id uuid;
begin
  if not public.is_shop_staff() then
    raise exception 'Not allowed';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Quote % not found', p_quote_id;
  end if;
  if v_quote.converted_bill_id is not null and exists (select 1 from public.bills where id = v_quote.converted_bill_id) then
    return v_quote.converted_bill_id;
  end if;

  insert into public.bills (quote_id, customer_id, vehicle_id, client_name, client_contact,
    vehicle_description, plate_number, odometer_km, prepared_by, notes)
  values (v_quote.id, v_quote.customer_id, v_quote.vehicle_id, v_quote.client_name, v_quote.client_contact,
    v_quote.vehicle_description, v_quote.plate_number, v_quote.odometer_km, v_quote.prepared_by, v_quote.notes)
  returning id into v_bill_id;

  insert into public.bill_line_items (bill_id, category, description, qty, unit_price, service_pricing_id, created_at)
  select v_bill_id, category, description, qty, unit_price, service_pricing_id, created_at
    from public.quote_line_items where quote_id = p_quote_id;

  update public.quotes set converted_bill_id = v_bill_id where id = p_quote_id;
  return v_bill_id;
end;
$$;
revoke all on function public.convert_quote_to_bill(uuid) from public, anon;
grant execute on function public.convert_quote_to_bill(uuid) to authenticated;

-- Public read for the /bill/$id link sent to the client (unguessable uuid).
create or replace function public.get_public_bill(p_bill_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_bill public.bills;
  v_lines jsonb;
  v_preparer text;
begin
  select * into v_bill from public.bills where id = p_bill_id;
  if v_bill.id is null or v_bill.status = 'void' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'category', category, 'description', description, 'qty', qty, 'unit_price', unit_price
  ) order by created_at), '[]'::jsonb)
  into v_lines
  from public.bill_line_items where bill_id = p_bill_id;

  select full_name into v_preparer from public.staff where id = v_bill.prepared_by;

  return jsonb_build_object(
    'ok', true,
    'bill', jsonb_build_object(
      'id', v_bill.id,
      'bill_no', v_bill.bill_no,
      'client_name', v_bill.client_name,
      'client_contact', v_bill.client_contact,
      'vehicle_description', v_bill.vehicle_description,
      'plate_number', v_bill.plate_number,
      'odometer_km', v_bill.odometer_km,
      'status', v_bill.status,
      'due_date', v_bill.due_date,
      'created_at', v_bill.created_at,
      'total_amount', v_bill.total_amount,
      'amount_paid', v_bill.amount_paid,
      'balance', v_bill.balance,
      'notes', v_bill.notes
    ),
    'lines', v_lines,
    'preparer_name', coalesce(v_preparer, '—')
  );
end;
$$;
grant execute on function public.get_public_bill(uuid) to anon, authenticated;

-- RLS: shop staff manage everything; only owner/admin can delete a bill.
alter table public.bills enable row level security;
alter table public.bill_line_items enable row level security;
alter table public.bill_payments enable row level security;
alter table public.bill_no_counters enable row level security;

drop policy if exists bills_staff_select on public.bills;
create policy bills_staff_select on public.bills for select using (public.is_shop_staff());
drop policy if exists bills_staff_insert on public.bills;
create policy bills_staff_insert on public.bills for insert with check (public.is_shop_staff());
drop policy if exists bills_staff_update on public.bills;
create policy bills_staff_update on public.bills for update using (public.is_shop_staff()) with check (public.is_shop_staff());
drop policy if exists bills_owner_admin_delete on public.bills;
create policy bills_owner_admin_delete on public.bills for delete using (public.current_shop_role() = any (array['owner', 'admin']));

drop policy if exists bli_staff_all on public.bill_line_items;
create policy bli_staff_all on public.bill_line_items for all using (public.is_shop_staff()) with check (public.is_shop_staff());

drop policy if exists bp_staff_select on public.bill_payments;
create policy bp_staff_select on public.bill_payments for select using (public.is_shop_staff());
drop policy if exists bp_staff_insert on public.bill_payments;
create policy bp_staff_insert on public.bill_payments for insert with check (public.is_shop_staff());
drop policy if exists bp_owner_admin_delete on public.bill_payments;
create policy bp_owner_admin_delete on public.bill_payments for delete using (public.current_shop_role() = any (array['owner', 'admin']));

drop policy if exists bill_no_counters_staff on public.bill_no_counters;
create policy bill_no_counters_staff on public.bill_no_counters for all using (public.is_shop_staff()) with check (public.is_shop_staff());

grant select, insert, update, delete on public.bills, public.bill_line_items, public.bill_payments, public.bill_no_counters to authenticated;
grant all on public.bills, public.bill_line_items, public.bill_payments, public.bill_no_counters to service_role;
