-- Quote outcomes + follow-ups: "Waiting / Pushed through / Didn't push through"
-- (draft|sent / approved / declined) with a reason, and when the client was
-- last followed up.

alter table public.quotes add column if not exists outcome_reason text;
alter table public.quotes add column if not exists followed_up_at timestamptz;

create or replace view public.quotes_with_effective_status with (security_invoker = true) as
select id, quote_no, customer_id, vehicle_id, client_name, client_contact, vehicle_description,
  plate_number, odometer_km, status, valid_until, prepared_by, subtotal_services, subtotal_parts,
  total_amount, notes, converted_job_order_id, created_at, updated_at,
  case
    when status = any (array['draft', 'sent']) and valid_until < (now() at time zone 'Asia/Manila')::date then 'expired'
    else status
  end as effective_status,
  converted_bill_id, outcome_reason, followed_up_at
from public.quotes q;

-- Staff can now set an approved quote back to waiting (job orders are no
-- longer used; line items of approved quotes stay locked by their own policies).
drop policy if exists quotes_staff_update on public.quotes;
create policy quotes_staff_update on public.quotes for update using (public.is_shop_staff()) with check (public.is_shop_staff());

-- Converting to a bill means the client pushed through.
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

  update public.quotes
     set converted_bill_id = v_bill_id,
         status = case when status in ('draft', 'sent', 'declined') then 'approved' else status end,
         outcome_reason = null
   where id = p_quote_id;
  return v_bill_id;
end;
$$;

-- The one quote already billed today counts as pushed through.
update public.quotes set status = 'approved' where converted_bill_id is not null and status in ('draft', 'sent');
