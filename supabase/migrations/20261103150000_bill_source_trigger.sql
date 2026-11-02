-- Tag home-service bills in the database too, so phones still running an
-- older cached copy of the technician app (which doesn't send `source`)
-- still show up on the owner's Home Service jobs page.
create or replace function public.set_bill_source()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.notes like 'Home service%' then
    new.source := 'home_service';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bill_source on public.bills;
create trigger trg_bill_source before insert on public.bills for each row execute function public.set_bill_source();

update public.bills set source = 'home_service' where source = 'shop' and notes like 'Home service%';
