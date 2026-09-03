create index integration_connections_org_unit_idx
  on public.integration_connections (organization_id, unit_id);
create index webhook_endpoints_org_connection_idx
  on public.webhook_endpoints (organization_id, integration_connection_id);
create index webhook_deliveries_org_event_idx
  on public.webhook_deliveries (organization_id, event_id);
create index webhook_deliveries_org_endpoint_idx
  on public.webhook_deliveries (organization_id, endpoint_id);
create index message_automations_org_unit_idx
  on public.message_automations (organization_id, unit_id);
create index message_automations_org_connection_idx
  on public.message_automations (organization_id, connection_id);
create index message_deliveries_org_automation_idx
  on public.message_deliveries (organization_id, automation_id);
create index message_deliveries_org_connection_idx
  on public.message_deliveries (organization_id, connection_id);
create index message_deliveries_org_event_idx
  on public.message_deliveries (organization_id, event_id);
