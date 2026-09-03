create type public.delivery_type as enum ('entrega', 'retirada');
create type public.equipment_status as enum ('disponivel', 'em_uso', 'manutencao');
create type public.barrel_status as enum ('cheio_loja', 'com_cliente', 'vazio_loja', 'na_cervejaria');
create type public.cylinder_status as enum ('cheio', 'com_cliente', 'vazio');
create type public.payment_method as enum ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia');
create type public.payment_status as enum ('pendente', 'pago', 'cancelado');
create type public.order_status as enum ('agendado', 'em_andamento', 'finalizado', 'cancelado');
create type public.nfe_status as enum ('emitindo', 'emitida', 'erro');

create or replace function private.can_write_organization(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.role = any(allowed_roles)
      and o.status in ('trial', 'active', 'past_due')
  );
$$;

revoke all on function private.can_write_organization(uuid, text[]) from public, anon;
grant execute on function private.can_write_organization(uuid, text[]) to authenticated;

create table public.beer_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  description text,
  price_per_liter numeric(12,2) check (price_per_liter is null or price_per_liter >= 0),
  cost_per_liter numeric(12,2) check (cost_per_liter is null or cost_per_liter >= 0),
  supplier text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create unique index beer_types_org_code_uidx on public.beer_types (organization_id, code) where code is not null;

create table public.tap_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.barrel_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  volume integer not null check (volume > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, volume)
);

create table public.cylinder_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capacity integer not null check (capacity > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, capacity)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  person_type text not null default 'individual' check (person_type in ('individual', 'company')),
  full_name text not null,
  birth_date date,
  cpf text,
  rg text,
  company_name text,
  trade_name text,
  cnpj text,
  state_registration text,
  email text,
  phone text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id)
);

create unique index customers_org_cpf_uidx on public.customers (organization_id, cpf) where cpf is not null;
create unique index customers_org_cnpj_uidx on public.customers (organization_id, cnpj) where cnpj is not null;
create index customers_org_name_idx on public.customers (organization_id, full_name);

create table public.taps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  code text not null,
  tap_type_id uuid,
  status public.equipment_status not null default 'disponivel',
  voltage text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, tap_type_id) references public.tap_types(organization_id, id)
);

create table public.barrels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  code text not null,
  capacity_liters numeric(10,2) not null default 30 check (capacity_liters > 0),
  status public.barrel_status not null default 'cheio_loja',
  beer_type_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, beer_type_id) references public.beer_types(organization_id, id)
);

create table public.cylinders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  code text not null,
  status public.cylinder_status not null default 'cheio',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id)
);

create table public.barrel_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  barrel_model_id uuid not null,
  beer_type_id uuid,
  status public.barrel_status not null default 'cheio_loja',
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, barrel_model_id) references public.barrel_models(organization_id, id),
  foreign key (organization_id, beer_type_id) references public.beer_types(organization_id, id)
);

create unique index barrel_inventory_scope_uidx
  on public.barrel_inventory (organization_id, unit_id, barrel_model_id, status, coalesce(beer_type_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.cylinder_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  cylinder_model_id uuid not null,
  status public.cylinder_status not null default 'cheio',
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, unit_id, cylinder_model_id, status),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, cylinder_model_id) references public.cylinder_models(organization_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  name text not null,
  sku text,
  category text,
  unit text not null default 'un',
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  current_cost numeric(12,2) not null default 0 check (current_cost >= 0),
  stock_quantity numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  track_stock boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id)
);

create unique index products_org_sku_uidx on public.products (organization_id, sku) where sku is not null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  order_number bigint generated by default as identity,
  customer_id uuid not null,
  delivery_type public.delivery_type not null,
  delivery_date date not null,
  delivery_time time,
  tap_id uuid,
  cylinder_id uuid,
  cylinder_model_id uuid,
  cylinder_quantity integer check (cylinder_quantity is null or cylinder_quantity >= 0),
  expected_return_date date,
  actual_return_date date,
  status public.order_status not null default 'agendado',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  delivery_address_zip_code text,
  delivery_address_street text,
  delivery_address_number text,
  delivery_address_complement text,
  delivery_address_neighborhood text,
  delivery_address_city text,
  delivery_address_state text,
  notes text,
  nfe_status public.nfe_status,
  nfe_number text,
  nfe_key text,
  nfe_issued_at timestamptz,
  nfe_issued_by uuid references auth.users(id) on delete set null,
  nfe_last_attempt_at timestamptz,
  nfe_error_message text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, order_number),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id),
  foreign key (organization_id, tap_id) references public.taps(organization_id, id),
  foreign key (organization_id, cylinder_id) references public.cylinders(organization_id, id),
  foreign key (organization_id, cylinder_model_id) references public.cylinder_models(organization_id, id)
);

create index orders_org_delivery_idx on public.orders (organization_id, delivery_date, status);
create index orders_org_customer_idx on public.orders (organization_id, customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  barrel_model_id uuid,
  beer_type_id uuid not null,
  quantity_liters numeric(12,2) not null check (quantity_liters > 0),
  barrel_quantity integer default 1 check (barrel_quantity is null or barrel_quantity >= 0),
  sold_barrel_quantity integer not null default 0 check (sold_barrel_quantity >= 0),
  consigned_barrel_quantity integer not null default 0 check (consigned_barrel_quantity >= 0),
  consigned_returned_quantity integer check (consigned_returned_quantity is null or consigned_returned_quantity >= 0),
  consigned_consumed_quantity integer check (consigned_consumed_quantity is null or consigned_consumed_quantity >= 0),
  consigned_resolved_at timestamptz,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  unit_cost_at_sale numeric(12,2) not null default 0,
  total_cost_at_sale numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete cascade,
  foreign key (organization_id, barrel_model_id) references public.barrel_models(organization_id, id),
  foreign key (organization_id, beer_type_id) references public.beer_types(organization_id, id)
);

create table public.order_product_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  unit text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  stock_moved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  payment_method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  status public.payment_status not null default 'pendente',
  payment_date timestamptz,
  expected_at date,
  settled_at timestamptz,
  calculated_fee numeric(12,2) not null default 0,
  deducted_fee numeric(12,2) not null default 0,
  fee_fixed_snapshot numeric(12,2) not null default 0,
  fee_percentage_snapshot numeric(8,4) not null default 0,
  fee_payer_snapshot text,
  net_amount numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete cascade
);

create table public.product_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  product_id uuid not null,
  order_id uuid,
  movement_type text not null check (movement_type in ('initial', 'adjustment', 'sale', 'return', 'transfer_in', 'transfer_out')),
  quantity numeric(14,3) not null,
  stock_before numeric(14,3) not null,
  stock_after numeric(14,3) not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, unit_id) references public.organization_units(organization_id, id),
  foreign key (organization_id, product_id) references public.products(organization_id, id),
  foreign key (organization_id, order_id) references public.orders(organization_id, id)
);

create index product_movements_org_product_idx on public.product_inventory_movements (organization_id, product_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'beer_types', 'tap_types', 'barrel_models', 'cylinder_models', 'customers',
    'taps', 'barrels', 'cylinders', 'barrel_inventory', 'cylinder_inventory',
    'products', 'orders', 'payments'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'beer_types', 'tap_types', 'barrel_models', 'cylinder_models', 'customers',
    'taps', 'barrels', 'cylinders', 'barrel_inventory', 'cylinder_inventory',
    'products', 'orders', 'order_items', 'order_product_items', 'payments',
    'product_inventory_movements'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_platform_admin() or private.is_organization_member(organization_id))',
      table_name || '_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_platform_admin() or private.can_write_organization(organization_id, array[''organization_owner'', ''organization_admin'', ''manager'', ''operator'', ''sales'', ''finance'']))',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_platform_admin() or private.can_write_organization(organization_id, array[''organization_owner'', ''organization_admin'', ''manager'', ''operator'', ''sales'', ''finance''])) with check (private.is_platform_admin() or private.can_write_organization(organization_id, array[''organization_owner'', ''organization_admin'', ''manager'', ''operator'', ''sales'', ''finance'']))',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.is_platform_admin() or private.can_write_organization(organization_id, array[''organization_owner'', ''organization_admin'', ''manager'']))',
      table_name || '_delete', table_name
    );
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to authenticated;
