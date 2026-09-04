alter table public.webhook_endpoints
  add column endpoint_key text,
  add column environment text not null default 'production'
    check (environment in ('test', 'production')),
  add column last_tested_at timestamptz,
  add column last_success_at timestamptz,
  add column last_error_at timestamptz,
  add column last_error_message text;

update public.webhook_endpoints
set endpoint_key = 'legacy-' || replace(id::text, '-', '')
where endpoint_key is null;

alter table public.webhook_endpoints
  alter column endpoint_key set not null,
  add constraint webhook_endpoints_key_format
    check (endpoint_key ~ '^[a-z][a-z0-9_]*$'),
  add constraint webhook_endpoints_org_key_environment_unique
    unique (organization_id, endpoint_key, environment);

create index webhook_endpoints_dispatch_idx
  on public.webhook_endpoints (organization_id, endpoint_key, environment)
  where is_active;

comment on column public.webhook_endpoints.endpoint_key is
  'Stable application key used to resolve the endpoint for an event.';
comment on column public.webhook_endpoints.secret_ref is
  'Opaque backend-only reference. Never store or return a raw secret here.';

revoke select, insert, update, delete on public.integration_connections,
  public.webhook_endpoints from authenticated;

drop policy if exists connections_select on public.integration_connections;
drop policy if exists connections_insert on public.integration_connections;
drop policy if exists connections_update on public.integration_connections;
drop policy if exists connections_delete on public.integration_connections;
drop policy if exists endpoints_select on public.webhook_endpoints;
drop policy if exists endpoints_insert on public.webhook_endpoints;
drop policy if exists endpoints_update on public.webhook_endpoints;
drop policy if exists endpoints_delete on public.webhook_endpoints;

create policy connections_platform_select on public.integration_connections
  for select to authenticated
  using (private.is_platform_admin(array['platform_owner']));
create policy endpoints_platform_select on public.webhook_endpoints
  for select to authenticated
  using (private.is_platform_admin(array['platform_owner']));

grant select on public.integration_connections, public.webhook_endpoints
  to authenticated;

insert into public.webhook_endpoints (
  organization_id, name, endpoint_key, url, event_types, environment,
  is_active, timeout_ms, max_attempts
)
select
  id, 'Automação de pedidos - legado', 'orders_automation',
  'https://n8n.popidichopp.online/webhook/28ebd702-74bc-462d-ba87-02089e4d3dbb',
  array['order.dispatched', 'order.completed'], 'production', true, 15000, 5
from public.organizations
where slug = 'popidi'
on conflict (organization_id, endpoint_key, environment) do nothing;

insert into public.webhook_endpoints (
  organization_id, name, endpoint_key, url, event_types, environment,
  is_active, timeout_ms, max_attempts
)
select
  id, 'Resumo diário de barris - legado', 'barrels_daily_summary',
  'https://n8n.popidichopp.online/webhook/controlebarrischopp',
  array['barrel_brewery_daily_summary'], 'production', true, 15000, 5
from public.organizations
where slug = 'popidi'
on conflict (organization_id, endpoint_key, environment) do nothing;
