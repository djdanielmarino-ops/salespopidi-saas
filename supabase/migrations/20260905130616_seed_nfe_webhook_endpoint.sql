insert into public.webhook_endpoints (
  organization_id, name, endpoint_key, url, event_types, environment,
  is_active, timeout_ms, max_attempts
)
select
  id, 'Emissão de NFe - legado', 'nfe_issue',
  'https://n8n.popidichopp.online/webhook/d3ba41e0-7d59-4fb5-9085-db9c9761b5a2',
  array['invoice.requested'], 'production', true, 15000, 5
from public.organizations
where slug = 'popidi'
on conflict (organization_id, endpoint_key, environment) do nothing;
