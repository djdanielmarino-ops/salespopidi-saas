alter table public.historical_transactions add column beverage_liters numeric(16,3);
comment on column public.historical_transactions.beverage_liters is 'Owner-confirmed liters for beverage sale rows; null for services, expenses, heaters and unknown quantities.';
create view public.historical_products_monthly with (security_invoker=true) as
select h.organization_id,date_trunc('month',h.sale_date)::date as month,h.product_name,
count(*) as sales_rows,sum(h.paid_amount) as received,sum(h.beverage_liters) as liters,
count(*) filter(where h.paid_amount is null) as missing_paid_rows,
count(*) filter(where h.duplicate_of_row is not null) as possible_duplicate_rows
from public.historical_transactions h
join public.import_batches b on b.id=h.import_batch_id and b.organization_id=h.organization_id and b.status='completed'
where h.record_kind='sale'
group by h.organization_id,date_trunc('month',h.sale_date)::date,h.product_name;
revoke all on public.historical_products_monthly from anon, authenticated;
grant select on public.historical_products_monthly to authenticated, service_role;
