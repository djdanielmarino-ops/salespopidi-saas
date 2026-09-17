-- Imported history is analytical only: no stock, invoice, receivable or order triggers.
create table public.customer_legacy_ids (
  organization_id uuid not null references public.organizations(id),
  source_namespace text not null,
  external_id text not null,
  customer_id uuid not null,
  source_batch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, source_namespace, external_id),
  foreign key (organization_id, customer_id) references public.customers(organization_id,id),
  foreign key (organization_id, source_batch_id) references public.import_batches(organization_id,id)
);
create index customer_legacy_ids_customer_idx on public.customer_legacy_ids(organization_id,customer_id);
create index customer_legacy_ids_batch_idx on public.customer_legacy_ids(organization_id,source_batch_id);

create table public.historical_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  import_batch_id uuid not null,
  source_file_hash text not null check (source_file_hash ~ '^[0-9a-f]{64}$'),
  source_row integer not null check (source_row > 1),
  record_kind text not null check (record_kind in ('sale','expense','unclassified')),
  sale_date date,
  external_customer_id text,
  customer_id uuid,
  customer_match_status text not null check (customer_match_status in ('matched_id','missing_id','unmatched_id','not_applicable')),
  customer_name text,
  product_name text,
  quantity numeric(16,3),
  quoted_amount numeric(16,2),
  paid_amount numeric(16,2),
  reported_outstanding numeric(16,2),
  product_cost numeric(16,2),
  sale_cost numeric(16,2),
  reported_profit numeric(16,2),
  reported_margin_percent numeric(16,4),
  payment_method text,
  seller text,
  duplicate_of_row integer,
  quality_flags text[] not null default '{}',
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (organization_id,source_file_hash,source_row),
  foreign key (organization_id,import_batch_id) references public.import_batches(organization_id,id),
  foreign key (organization_id,customer_id) references public.customers(organization_id,id),
  check ((customer_match_status='matched_id') = (customer_id is not null)),
  check (record_kind='sale' or customer_id is null)
);
create index historical_transactions_date_idx on public.historical_transactions(organization_id,sale_date);
create index historical_transactions_customer_idx on public.historical_transactions(organization_id,customer_id,sale_date);
create index historical_transactions_batch_idx on public.historical_transactions(organization_id,import_batch_id);

alter table public.customer_legacy_ids enable row level security;
alter table public.historical_transactions enable row level security;
revoke all on public.customer_legacy_ids, public.historical_transactions from anon, authenticated;
grant select on public.customer_legacy_ids, public.historical_transactions to authenticated;
grant all on public.customer_legacy_ids, public.historical_transactions to service_role;
create policy customer_legacy_ids_read on public.customer_legacy_ids for select to authenticated
using (private.is_organization_member(organization_id));
create policy historical_transactions_read on public.historical_transactions for select to authenticated
using (private.is_organization_member(organization_id));

-- Invoker views preserve tenant RLS. Null amounts remain missing, never fabricated zeroes.
create view public.historical_sales_monthly with (security_invoker=true) as
select h.organization_id,date_trunc('month',h.sale_date)::date as month,
  count(*) filter(where h.record_kind='sale') as sales_rows,
  count(*) filter(where h.record_kind='expense') as expense_rows,
  sum(h.quoted_amount) filter(where h.record_kind='sale') as quoted_sales,
  sum(h.paid_amount) filter(where h.record_kind='sale') as reported_paid_sales,
  sum(h.product_cost+h.sale_cost) filter(where h.record_kind='sale') as recorded_sales_cost,
  sum(h.paid_amount-h.product_cost-h.sale_cost) filter(where h.record_kind='sale') as result_on_reported_paid,
  sum(h.product_cost+h.sale_cost) filter(where h.record_kind='expense') as recorded_expense_cost,
  count(*) filter(where h.record_kind='sale' and h.paid_amount is null) as sales_missing_paid,
  count(*) filter(where h.duplicate_of_row is not null) as possible_duplicate_rows,
  count(*) filter(where h.record_kind='sale' and h.customer_id is null) as unlinked_sales
from public.historical_transactions h
join public.import_batches b on b.id=h.import_batch_id and b.organization_id=h.organization_id and b.status='completed'
group by h.organization_id,date_trunc('month',h.sale_date)::date;

create view public.historical_customer_activity with (security_invoker=true) as
select h.organization_id,h.customer_id,min(h.sale_date) as first_sale,max(h.sale_date) as last_sale,
count(*) as sales_rows,sum(h.paid_amount) as reported_paid,sum(h.quoted_amount) as quoted_amount,
count(*) filter(where h.paid_amount is null) as missing_paid_rows,
count(*) filter(where h.duplicate_of_row is not null) as possible_duplicate_rows
from public.historical_transactions h
join public.import_batches b on b.id=h.import_batch_id and b.organization_id=h.organization_id and b.status='completed'
where h.record_kind='sale' and h.customer_id is not null
group by h.organization_id,h.customer_id;
revoke all on public.historical_sales_monthly, public.historical_customer_activity from anon, authenticated;
grant select on public.historical_sales_monthly, public.historical_customer_activity to authenticated, service_role;

comment on table public.historical_transactions is 'Immutable source snapshot for historical analysis. Rows are source records, not necessarily unique orders. Currency-formatted quantity has no asserted unit. Outstanding is historical and must not create a current receivable.';
