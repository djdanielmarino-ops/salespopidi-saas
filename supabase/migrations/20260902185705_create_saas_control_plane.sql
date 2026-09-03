-- Sales Popidi SaaS control plane.
-- This migration is intentionally additive: operational tables are migrated later.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  slug text not null unique,
  document text,
  organization_type text not null check (organization_type in ('store', 'distributor', 'brewery', 'hybrid')),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'security_blocked')),
  timezone text not null default 'America/Sao_Paulo',
  settings jsonb not null default '{}'::jsonb,
  trial_ends_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index organizations_document_uidx
  on public.organizations (document)
  where document is not null;

create table public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  unit_type text not null check (unit_type in ('store', 'distribution_center', 'brewery', 'warehouse', 'office')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  document text,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_owner', 'platform_support', 'platform_finance', 'platform_viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organization_owner', 'organization_admin', 'manager', 'operator', 'sales', 'finance', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'revoked')),
  permissions jsonb not null default '{}'::jsonb,
  unit_ids uuid[] not null default '{}'::uuid[],
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_active_idx
  on public.organization_members (user_id, organization_id)
  where status = 'active';

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  price_yearly numeric(12,2) check (price_yearly is null or price_yearly >= 0),
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly', 'custom')),
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organization_active_subscription_uidx
  on public.organization_subscriptions (organization_id)
  where status in ('trial', 'active', 'past_due', 'suspended');

create table public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  is_enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key),
  constraint organization_modules_key_format check (module_key ~ '^[a-z][a-z0-9_]*$')
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.organization_units(id) on delete cascade,
  capability text not null check (capability in ('whatsapp', 'n8n', 'nfe', 'payments', 'email', 'erp')),
  provider text not null,
  name text not null,
  environment text not null default 'production' check (environment in ('test', 'production')),
  status text not null default 'pending' check (status in ('pending', 'connected', 'degraded', 'disconnected', 'revoked')),
  external_account_id text,
  verified_identifier text,
  secret_ref text,
  config jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capability, name, environment)
);

create index integration_connections_org_capability_idx
  on public.integration_connections (organization_id, capability, status);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  name text not null,
  url text not null,
  event_types text[] not null default '{}'::text[],
  secret_ref text,
  is_active boolean not null default true,
  timeout_ms integer not null default 15000 check (timeout_ms between 1000 and 60000),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  source text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'unmatched', 'dead_letter')),
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, event_id)
);

create index integration_events_processing_idx
  on public.integration_events (status, occurred_at)
  where status in ('pending', 'failed');

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.integration_events(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  status text not null default 'queued' check (status in ('queued', 'sending', 'delivered', 'failed', 'dead_letter')),
  response_status integer,
  response_body_excerpt text,
  error_message text,
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, endpoint_id, attempt_number)
);

create table public.message_automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.organization_units(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  name text not null,
  trigger_event text not null,
  template_key text not null,
  template_version integer not null default 1 check (template_version > 0),
  delay_seconds integer not null default 0 check (delay_seconds >= 0),
  schedule_config jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid references public.message_automations(id) on delete set null,
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  event_id uuid references public.integration_events(id) on delete set null,
  idempotency_key text not null,
  recipient_masked text not null,
  related_type text,
  related_id uuid,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'platform', 'system', 'integration')),
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text,
  ip_address inet,
  user_agent text,
  changes jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_platform_admin(required_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.is_active
      and (required_roles is null or pa.role = any(required_roles))
  );
$$;

create or replace function private.is_organization_member(target_organization_id uuid)
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
      and o.status not in ('cancelled', 'security_blocked')
  );
$$;

create or replace function private.has_organization_role(target_organization_id uuid, allowed_roles text[])
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
      and o.status not in ('cancelled', 'security_blocked')
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_platform_admin(text[]) from public, anon;
revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.has_organization_role(uuid, text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin(text[]) to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'organization_units', 'platform_admins', 'organization_members',
    'plans', 'organization_subscriptions', 'organization_modules', 'integration_connections',
    'webhook_endpoints', 'integration_events', 'webhook_deliveries', 'message_automations',
    'message_deliveries'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_units enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_modules enable row level security;
alter table public.integration_connections enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.integration_events enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.message_automations enable row level security;
alter table public.message_deliveries enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations, public.organization_units, public.platform_admins, public.organization_members,
  public.plans, public.organization_subscriptions, public.organization_modules,
  public.integration_connections, public.webhook_endpoints, public.integration_events,
  public.webhook_deliveries, public.message_automations, public.message_deliveries,
  public.audit_logs to authenticated;
grant insert, update, delete on public.organization_units, public.organization_members,
  public.integration_connections, public.webhook_endpoints, public.message_automations
  to authenticated;
grant insert, update on public.organizations to authenticated;

create policy organizations_select on public.organizations for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(id));
create policy organizations_platform_insert on public.organizations for insert to authenticated
  with check (private.is_platform_admin(array['platform_owner']));
create policy organizations_platform_update on public.organizations for update to authenticated
  using (private.is_platform_admin(array['platform_owner']))
  with check (private.is_platform_admin(array['platform_owner']));

create policy units_select on public.organization_units for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy units_insert on public.organization_units for insert to authenticated
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy units_update on public.organization_units for update to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy units_delete on public.organization_units for delete to authenticated
  using (private.is_platform_admin(array['platform_owner']) or private.has_organization_role(organization_id, array['organization_owner']));

create policy platform_admins_self_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin(array['platform_owner']));

create policy members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy members_insert on public.organization_members for insert to authenticated
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy members_update on public.organization_members for update to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy members_delete on public.organization_members for delete to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner']));

create policy plans_select on public.plans for select to authenticated using (is_active or private.is_platform_admin());
create policy subscriptions_select on public.organization_subscriptions for select to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy modules_select on public.organization_modules for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(organization_id));

create policy connections_select on public.integration_connections for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy connections_insert on public.integration_connections for insert to authenticated
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy connections_update on public.integration_connections for update to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy connections_delete on public.integration_connections for delete to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner']));

create policy endpoints_select on public.webhook_endpoints for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy endpoints_insert on public.webhook_endpoints for insert to authenticated
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy endpoints_update on public.webhook_endpoints for update to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));
create policy endpoints_delete on public.webhook_endpoints for delete to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner']));

create policy integration_events_select on public.integration_events for select to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager']));
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager']));

create policy automations_select on public.message_automations for select to authenticated
  using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy automations_insert on public.message_automations for insert to authenticated
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager']));
create policy automations_update on public.message_automations for update to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager']))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager']));
create policy automations_delete on public.message_automations for delete to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));

create policy message_deliveries_select on public.message_deliveries for select to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin', 'manager', 'sales']));
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin']));

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
