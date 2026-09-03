create type public.import_kind as enum ('customers', 'equipment', 'sales_history');
create type public.import_batch_status as enum ('validated', 'completed', 'failed');
create type public.import_row_status as enum ('valid', 'invalid', 'imported');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.import_kind not null,
  status public.import_batch_status not null default 'validated',
  file_name text not null,
  total_rows integer not null check (total_rows >= 0),
  valid_rows integer not null check (valid_rows >= 0),
  invalid_rows integer not null check (invalid_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  check (total_rows = valid_rows + invalid_rows),
  unique (organization_id, id)
);

create index import_batches_org_created_idx
  on public.import_batches (organization_id, created_at desc);

create table public.import_rows (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null,
  normalized_data jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  status public.import_row_status not null,
  target_table text,
  target_id uuid,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number),
  foreign key (organization_id, batch_id)
    references public.import_batches(organization_id, id) on delete cascade
);

create index import_rows_batch_status_idx on public.import_rows (batch_id, status);

-- Histórico importado é deliberadamente separado dos pedidos operacionais.
-- Assim, nenhuma trigger ou rotina de estoque é executada ao carregar vendas antigas.
create table public.imported_sales_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete restrict,
  external_number text,
  sale_date date not null,
  customer_name text not null,
  customer_document text,
  description text,
  total numeric(12,2) not null check (total >= 0),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, import_batch_id)
    references public.import_batches(organization_id, id) on delete restrict
);

create index imported_sales_history_org_date_idx
  on public.imported_sales_history (organization_id, sale_date desc);

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.imported_sales_history enable row level security;

revoke all on public.import_batches, public.import_rows, public.imported_sales_history from anon;
revoke all on public.import_batches, public.import_rows, public.imported_sales_history from authenticated;
grant select on public.import_batches, public.import_rows, public.imported_sales_history to authenticated;
grant all on public.import_batches, public.import_rows, public.imported_sales_history to service_role;
grant usage, select on sequence public.import_rows_id_seq to service_role;

create policy import_batches_select on public.import_batches for select to authenticated
using (private.can_write_organization(organization_id, array['organization_owner', 'organization_admin']));

create policy import_rows_select on public.import_rows for select to authenticated
using (private.can_write_organization(organization_id, array['organization_owner', 'organization_admin']));

create policy imported_sales_history_select on public.imported_sales_history for select to authenticated
using (private.is_organization_member(organization_id));

create or replace function public.commit_onboarding_import(target_batch_id uuid)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  batch_row public.import_batches%rowtype;
  staged public.import_rows%rowtype;
  created_id uuid;
  imported_count integer := 0;
  equipment_kind text;
begin
  select * into batch_row
  from public.import_batches
  where id = target_batch_id
  for update;

  if not found then raise exception 'Lote não encontrado'; end if;
  if batch_row.status <> 'validated' then raise exception 'Lote já processado'; end if;

  for staged in
    select * from public.import_rows
    where batch_id = target_batch_id and status = 'valid'
    order by row_number
  loop
    created_id := null;

    if batch_row.kind = 'customers' then
      insert into public.customers (
        organization_id, person_type, full_name, cpf, cnpj, email, phone, company_name, trade_name, notes
      ) values (
        batch_row.organization_id,
        staged.normalized_data->>'person_type',
        staged.normalized_data->>'full_name',
        nullif(staged.normalized_data->>'cpf', ''),
        nullif(staged.normalized_data->>'cnpj', ''),
        nullif(staged.normalized_data->>'email', ''),
        staged.normalized_data->>'phone',
        nullif(staged.normalized_data->>'company_name', ''),
        nullif(staged.normalized_data->>'trade_name', ''),
        nullif(staged.normalized_data->>'notes', '')
      ) returning id into created_id;
    elsif batch_row.kind = 'equipment' then
      equipment_kind := staged.normalized_data->>'equipment_type';
      if equipment_kind = 'barrel' then
        insert into public.barrels (organization_id, code, capacity_liters, status, notes)
        values (batch_row.organization_id, staged.normalized_data->>'code',
          (staged.normalized_data->>'capacity_liters')::numeric,
          (staged.normalized_data->>'status')::public.barrel_status,
          nullif(staged.normalized_data->>'notes', '')) returning id into created_id;
      elsif equipment_kind = 'tap' then
        insert into public.taps (organization_id, code, status, voltage, notes)
        values (batch_row.organization_id, staged.normalized_data->>'code',
          (staged.normalized_data->>'status')::public.equipment_status,
          nullif(staged.normalized_data->>'voltage', ''),
          nullif(staged.normalized_data->>'notes', '')) returning id into created_id;
      else
        insert into public.cylinders (organization_id, code, status, notes)
        values (batch_row.organization_id, staged.normalized_data->>'code',
          (staged.normalized_data->>'status')::public.cylinder_status,
          nullif(staged.normalized_data->>'notes', '')) returning id into created_id;
      end if;
    else
      insert into public.imported_sales_history (
        organization_id, import_batch_id, external_number, sale_date, customer_name,
        customer_document, description, total, payment_method, notes
      ) values (
        batch_row.organization_id, batch_row.id,
        nullif(staged.normalized_data->>'external_number', ''),
        (staged.normalized_data->>'sale_date')::date,
        staged.normalized_data->>'customer_name',
        nullif(staged.normalized_data->>'customer_document', ''),
        nullif(staged.normalized_data->>'description', ''),
        (staged.normalized_data->>'total')::numeric,
        nullif(staged.normalized_data->>'payment_method', ''),
        nullif(staged.normalized_data->>'notes', '')
      ) returning id into created_id;
    end if;

    update public.import_rows
    set status = 'imported',
        target_table = case batch_row.kind
          when 'customers' then 'customers'
          when 'sales_history' then 'imported_sales_history'
          else equipment_kind || 's'
        end,
        target_id = created_id
    where id = staged.id;
    imported_count := imported_count + 1;
  end loop;

  update public.import_batches
  set status = 'completed', imported_rows = imported_count, completed_at = now()
  where id = target_batch_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (batch_row.organization_id, batch_row.created_by, 'onboarding_import_completed',
    'import_batch', batch_row.id,
    jsonb_build_object('kind', batch_row.kind, 'imported_rows', imported_count));

  return imported_count;
end;
$$;

revoke all on function public.commit_onboarding_import(uuid) from public, anon, authenticated;
grant execute on function public.commit_onboarding_import(uuid) to service_role;
