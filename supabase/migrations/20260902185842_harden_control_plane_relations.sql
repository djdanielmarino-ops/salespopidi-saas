-- Cover foreign keys used by joins/deletes and enforce same-organization references.

create index audit_logs_actor_user_idx on public.audit_logs (actor_user_id);
create index integration_connections_created_by_idx on public.integration_connections (created_by);
create index integration_connections_unit_idx on public.integration_connections (unit_id);
create index organization_members_invited_by_idx on public.organization_members (invited_by);
create index organization_subscriptions_plan_idx on public.organization_subscriptions (plan_id);
create index webhook_endpoints_connection_idx on public.webhook_endpoints (integration_connection_id);
create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id);
create index webhook_deliveries_organization_idx on public.webhook_deliveries (organization_id);
create index message_automations_connection_idx on public.message_automations (connection_id);
create index message_automations_unit_idx on public.message_automations (unit_id);
create index message_deliveries_automation_idx on public.message_deliveries (automation_id);
create index message_deliveries_connection_idx on public.message_deliveries (connection_id);
create index message_deliveries_event_idx on public.message_deliveries (event_id);

alter table public.organization_units
  add constraint organization_units_org_id_id_unique unique (organization_id, id);
alter table public.integration_connections
  add constraint integration_connections_org_id_id_unique unique (organization_id, id);
alter table public.integration_events
  add constraint integration_events_org_id_id_unique unique (organization_id, id);
alter table public.webhook_endpoints
  add constraint webhook_endpoints_org_id_id_unique unique (organization_id, id);
alter table public.message_automations
  add constraint message_automations_org_id_id_unique unique (organization_id, id);

alter table public.integration_connections
  add constraint integration_connections_unit_same_org_fkey
  foreign key (organization_id, unit_id)
  references public.organization_units (organization_id, id);

alter table public.webhook_endpoints
  add constraint webhook_endpoints_connection_same_org_fkey
  foreign key (organization_id, integration_connection_id)
  references public.integration_connections (organization_id, id);

alter table public.webhook_deliveries
  add constraint webhook_deliveries_event_same_org_fkey
  foreign key (organization_id, event_id)
  references public.integration_events (organization_id, id),
  add constraint webhook_deliveries_endpoint_same_org_fkey
  foreign key (organization_id, endpoint_id)
  references public.webhook_endpoints (organization_id, id);

alter table public.message_automations
  add constraint message_automations_unit_same_org_fkey
  foreign key (organization_id, unit_id)
  references public.organization_units (organization_id, id),
  add constraint message_automations_connection_same_org_fkey
  foreign key (organization_id, connection_id)
  references public.integration_connections (organization_id, id);

alter table public.message_deliveries
  add constraint message_deliveries_automation_same_org_fkey
  foreign key (organization_id, automation_id)
  references public.message_automations (organization_id, id),
  add constraint message_deliveries_connection_same_org_fkey
  foreign key (organization_id, connection_id)
  references public.integration_connections (organization_id, id),
  add constraint message_deliveries_event_same_org_fkey
  foreign key (organization_id, event_id)
  references public.integration_events (organization_id, id);
