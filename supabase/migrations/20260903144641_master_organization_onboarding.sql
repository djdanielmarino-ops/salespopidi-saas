-- Atomic control-plane operations used by the master-organizations Edge Function.
-- These functions are SECURITY INVOKER and executable only by service_role. They
-- also verify the human actor, so possession of a user JWT alone is insufficient.

create or replace function public.master_onboard_organization(
  p_actor_user_id uuid,
  p_owner_user_id uuid,
  p_owner_status text,
  p_legal_name text,
  p_trade_name text,
  p_slug text,
  p_organization_type text,
  p_module_keys text[]
)
returns public.organizations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_organization public.organizations;
begin
  if not exists (
    select 1
    from public.platform_admins
    where user_id = p_actor_user_id
      and role = 'platform_owner'
      and is_active
  ) then
    raise exception 'Apenas o proprietário da plataforma pode criar organizações.'
      using errcode = '42501';
  end if;

  if p_owner_status not in ('invited', 'active') then
    raise exception 'Status inicial do proprietário inválido.' using errcode = '22023';
  end if;

  insert into public.organizations (
    legal_name, trade_name, slug, organization_type, status, trial_ends_at
  ) values (
    trim(p_legal_name), nullif(trim(p_trade_name), ''), lower(trim(p_slug)),
    p_organization_type, 'trial', now() + interval '14 days'
  )
  returning * into created_organization;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_by, joined_at
  ) values (
    created_organization.id,
    p_owner_user_id,
    'organization_owner',
    p_owner_status,
    p_actor_user_id,
    case when p_owner_status = 'active' then now() else null end
  );

  insert into public.organization_modules (organization_id, module_key)
  select created_organization.id, module_key
  from unnest(p_module_keys) as selected(module_key)
  where module_key ~ '^[a-z][a-z0-9_]*$'
  on conflict (organization_id, module_key) do nothing;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, changes, metadata
  ) values (
    created_organization.id,
    p_actor_user_id,
    'platform',
    'organization.onboarded',
    'organization',
    created_organization.id::text,
    jsonb_build_object(
      'after', to_jsonb(created_organization),
      'owner_user_id', p_owner_user_id,
      'owner_status', p_owner_status,
      'modules', to_jsonb(p_module_keys)
    ),
    jsonb_build_object('source', 'master-organizations-edge-function')
  );

  return created_organization;
end;
$$;

create or replace function public.master_update_organization_status(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_status text
)
returns public.organizations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_status text;
  updated_organization public.organizations;
begin
  if not exists (
    select 1
    from public.platform_admins
    where user_id = p_actor_user_id
      and role = 'platform_owner'
      and is_active
  ) then
    raise exception 'Apenas o proprietário da plataforma pode alterar organizações.'
      using errcode = '42501';
  end if;

  if p_status not in ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'security_blocked') then
    raise exception 'Status da organização inválido.' using errcode = '22023';
  end if;

  select status into previous_status
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'Organização não encontrada.' using errcode = 'P0002';
  end if;

  update public.organizations
  set
    status = p_status,
    suspended_at = case when p_status in ('suspended', 'security_blocked') then now() else null end
  where id = p_organization_id
  returning * into updated_organization;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, changes, metadata
  ) values (
    p_organization_id,
    p_actor_user_id,
    'platform',
    'organization.status_changed',
    'organization',
    p_organization_id::text,
    jsonb_build_object('before', previous_status, 'after', p_status),
    jsonb_build_object('source', 'master-organizations-edge-function')
  );

  return updated_organization;
end;
$$;

revoke all on function public.master_onboard_organization(uuid, uuid, text, text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.master_update_organization_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.master_onboard_organization(uuid, uuid, text, text, text, text, text, text[]) to service_role;
grant execute on function public.master_update_organization_status(uuid, uuid, text) to service_role;
