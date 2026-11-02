-- Tag where a bill came from so the owner can monitor technician home-service
-- jobs separately from shop bills.
alter table public.bills add column if not exists source text not null default 'shop'
  check (source in ('shop', 'home_service'));
update public.bills set source = 'home_service' where source = 'shop' and notes like 'Home service%';
create index if not exists idx_bills_source_created on public.bills(source, created_at desc);
