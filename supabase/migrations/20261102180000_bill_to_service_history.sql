-- Quote → Bill → Service history → Reminder.
-- "Save to service history" on a bill finds or creates the customer + vehicle,
-- writes one service_history entry from the bill's lines (parts / labor split),
-- and resets the vehicle's PMS clock — replacing the manual retyping of job
-- orders into service history.

alter table public.bills add column if not exists service_history_id uuid references public.service_history(id) on delete set null;

create or replace function public.log_bill_to_history(
  p_bill_id uuid,
  p_odometer integer default null,
  p_job_order_no text default null,
  p_technician text default null,
  p_plate text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b public.bills%rowtype;
  v_plate text;
  v_vehicle uuid;
  v_vehicle_customer uuid;
  v_customer uuid;
  v_name text;
  v_desc text;
  v_year int;
  v_make text;
  v_model text;
  v_unit text;
  v_sh uuid;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_new_customer boolean := false;
  v_new_vehicle boolean := false;
  v_km int := nullif(p_odometer, 0);
begin
  if not public.is_shop_staff() then
    raise exception 'Not allowed';
  end if;
  select * into b from public.bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if b.status = 'void' then raise exception 'This bill is void'; end if;
  if b.service_history_id is not null and exists (select 1 from public.service_history where id = b.service_history_id) then
    return jsonb_build_object('service_history_id', b.service_history_id, 'vehicle_id', b.vehicle_id, 'customer_id', b.customer_id, 'already', true);
  end if;

  v_plate := upper(trim(regexp_replace(coalesce(nullif(trim(p_plate), ''), b.plate_number, ''), '\s+', ' ', 'g')));
  v_vehicle := b.vehicle_id;

  -- 1. Vehicle: the bill's own, else an existing one with the same plate.
  if v_vehicle is null then
    if v_plate = '' then
      raise exception 'Add the plate number first';
    end if;
    select id, customer_id into v_vehicle, v_vehicle_customer
      from public.vehicles
     where upper(replace(plate_number, ' ', '')) = replace(v_plate, ' ', '')
     order by created_at limit 1;
  else
    select customer_id into v_vehicle_customer from public.vehicles where id = v_vehicle;
  end if;

  -- 2. Customer: the bill's own, the vehicle's owner, a same-name (+ same phone) match, else new.
  v_customer := coalesce(b.customer_id, v_vehicle_customer);
  v_name := trim(regexp_replace(coalesce(b.client_name, ''), '^(sir|ma''?am|maam|mr\.?|mrs\.?|ms\.?|dr\.?|engr\.?|atty\.?)\s+', '', 'i'));
  if v_customer is null then
    select id into v_customer
      from public.customers
     where v_name <> '' and lower(full_name) = lower(v_name)
       and (coalesce(b.client_contact, '') = '' or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(b.client_contact, '\D', '', 'g'))
     order by created_at limit 1;
  end if;
  if v_customer is null then
    insert into public.customers (full_name, phone, notes)
    values (coalesce(nullif(v_name, ''), 'Walk-in customer'), nullif(b.client_contact, ''), 'Created from bill ' || b.bill_no)
    returning id into v_customer;
    v_new_customer := true;
  end if;

  -- 3. New vehicle from the free-text description, e.g. "Toyota Vios 2019, 1.3 Gas".
  if v_vehicle is null then
    v_desc := trim(coalesce(b.vehicle_description, ''));
    v_year := nullif(substring(v_desc from '((?:19|20)\d{2})'), '')::int;
    v_desc := trim(regexp_replace(split_part(v_desc, ',', 1), '(19|20)\d{2}', '', 'g'));
    -- "Toyota Vios" → make Toyota / model Vios; a single word ("Montero") is the model.
    if position(' ' in v_desc) > 0 then
      v_make := split_part(v_desc, ' ', 1);
      v_model := trim(substring(v_desc from length(v_make) + 1));
    else
      v_make := '—';
      v_model := coalesce(nullif(v_desc, ''), '—');
    end if;
    v_unit := v_plate;
    if exists (select 1 from public.vehicles where unit_id = v_unit) then
      v_unit := v_plate || '-' || upper(substr(md5(random()::text), 1, 4));
    end if;
    insert into public.vehicles (unit_id, plate_number, make, model, year, customer_id, current_km, last_service_km, last_service_date, notes)
    values (v_unit, v_plate, v_make, v_model, v_year, v_customer, coalesce(v_km, 0), coalesce(v_km, 0), v_today, 'Created from bill ' || b.bill_no)
    returning id into v_vehicle;
    v_new_vehicle := true;
  elsif v_vehicle_customer is null then
    update public.vehicles set customer_id = v_customer where id = v_vehicle;
  end if;

  -- 4. The service history entry: line titles, parts vs labor (net of discounts).
  insert into public.service_history (vehicle_id, job_order_number, service_date, odometer_km, service_performed,
    parts_cost, labor_cost, technician, notes)
  select v_vehicle,
         coalesce(nullif(trim(p_job_order_no), ''), b.bill_no),
         v_today,
         coalesce(v_km, 0),
         coalesce(string_agg(split_part(description, E'\n', 1), E'\n' order by created_at), '—'),
         greatest(coalesce(sum(amount) filter (where category = 'part'), 0), 0),
         greatest(coalesce(sum(amount) filter (where category = 'service'), 0), 0),
         nullif(trim(p_technician), ''),
         'From bill ' || b.bill_no
    from public.bill_line_items where bill_id = b.id
  returning id into v_sh;

  -- 5. Reset the PMS / reminder clock (km only when a reading was given).
  update public.vehicles
     set last_service_date = v_today,
         current_km = case when v_km is not null then greatest(coalesce(current_km, 0), v_km) else current_km end,
         last_service_km = coalesce(v_km, last_service_km)
   where id = v_vehicle;

  update public.bills
     set service_history_id = v_sh, vehicle_id = v_vehicle, customer_id = v_customer,
         plate_number = coalesce(nullif(v_plate, ''), plate_number), odometer_km = coalesce(v_km, odometer_km)
   where id = b.id;
  if b.quote_id is not null then
    update public.quotes set vehicle_id = coalesce(vehicle_id, v_vehicle), customer_id = coalesce(customer_id, v_customer)
     where id = b.quote_id;
  end if;

  return jsonb_build_object('service_history_id', v_sh, 'vehicle_id', v_vehicle, 'customer_id', v_customer,
    'new_customer', v_new_customer, 'new_vehicle', v_new_vehicle, 'already', false);
end;
$$;
revoke all on function public.log_bill_to_history(uuid, integer, text, text, text) from public, anon;
grant execute on function public.log_bill_to_history(uuid, integer, text, text, text) to authenticated;
