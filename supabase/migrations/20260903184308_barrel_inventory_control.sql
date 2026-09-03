-- Barrel patrimony, controlled stock adjustments and purchase-module rename.

insert into public.organization_modules (
  organization_id, module_key, is_enabled, limits, settings, enabled_at, updated_at
)
select organization_id, 'purchases', is_enabled, limits, settings, enabled_at, now()
from public.organization_modules
where module_key = 'brewery_orders'
on conflict (organization_id, module_key) do update
set is_enabled = excluded.is_enabled,
    limits = excluded.limits,
    settings = excluded.settings,
    updated_at = now();

delete from public.organization_modules where module_key = 'brewery_orders';

update public.organization_members
set permissions = permissions || jsonb_build_object(
  'purchases', coalesce(permissions -> 'purchases', permissions -> 'barrels', '"none"'::jsonb)
)
where not (permissions ? 'purchases');

-- Supabase Auth itself gates invited accounts. Keeping the membership active
-- lets the user resolve their tenant immediately after accepting the invite.
update public.organization_members
set status = 'active'
where status = 'invited';

create table public.barrel_patrimony_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  barrel_model_id uuid not null,
  expected_quantity integer not null default 0 check (expected_quantity >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, barrel_model_id),
  foreign key (organization_id, barrel_model_id)
    references public.barrel_models(organization_id, id) on delete cascade
);

create table public.barrel_inventory_adjustments (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  barrel_inventory_id uuid not null,
  barrel_model_id uuid not null,
  status public.barrel_status not null,
  beer_type_id uuid,
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  quantity_delta integer generated always as (quantity_after - quantity_before) stored,
  reason_code text not null check (reason_code in (
    'physical_count', 'partial_return', 'entry_error', 'damage_or_loss',
    'acquisition', 'write_off', 'other'
  )),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, barrel_inventory_id)
    references public.barrel_inventory(organization_id, id) on delete restrict,
  foreign key (organization_id, barrel_model_id)
    references public.barrel_models(organization_id, id) on delete restrict,
  foreign key (organization_id, beer_type_id)
    references public.beer_types(organization_id, id) on delete restrict
);

create index barrel_adjustments_org_created_idx
  on public.barrel_inventory_adjustments (organization_id, created_at desc);
create index barrel_adjustments_inventory_created_idx
  on public.barrel_inventory_adjustments (barrel_inventory_id, created_at desc);
create index barrel_patrimony_model_idx
  on public.barrel_patrimony_targets (barrel_model_id);

create trigger barrel_patrimony_targets_set_updated_at
before update on public.barrel_patrimony_targets
for each row execute function private.set_updated_at();

alter table public.barrel_patrimony_targets enable row level security;
alter table public.barrel_inventory_adjustments enable row level security;

revoke all on public.barrel_patrimony_targets from anon, authenticated;
revoke all on public.barrel_inventory_adjustments from anon, authenticated;
grant select on public.barrel_patrimony_targets, public.barrel_inventory_adjustments to authenticated;

create policy barrel_patrimony_targets_select
on public.barrel_patrimony_targets for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));

create policy barrel_inventory_adjustments_select
on public.barrel_inventory_adjustments for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_owner', 'organization_admin'])
  or exists (
    select 1 from public.organization_members member
    where member.organization_id = barrel_inventory_adjustments.organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.permissions ->> 'barrel_adjustments' in ('view', 'manage')
  )
);

create or replace function public.set_barrel_patrimony_target(
  p_actor_user_id uuid,
  p_barrel_model_id uuid,
  p_expected_quantity integer,
  p_reason text
)
returns public.barrel_patrimony_targets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_organization_id uuid;
  previous_quantity integer;
  saved_target public.barrel_patrimony_targets;
begin
  if p_expected_quantity < 0 then
    raise exception 'A quantidade patrimonial não pode ser negativa.' using errcode = '22023';
  end if;
  if char_length(trim(p_reason)) < 5 then
    raise exception 'Informe uma justificativa com ao menos 5 caracteres.' using errcode = '22023';
  end if;

  select organization_id into target_organization_id
  from public.barrel_models where id = p_barrel_model_id;
  if not found then raise exception 'Modelo de barril não encontrado.' using errcode = 'P0002'; end if;

  if not (
    exists (select 1 from public.platform_admins where user_id = p_actor_user_id and role = 'platform_owner' and is_active)
    or exists (
      select 1 from public.organization_members
      where organization_id = target_organization_id
        and user_id = p_actor_user_id
        and status = 'active'
        and (
          role in ('organization_owner', 'organization_admin')
          or permissions ->> 'barrel_adjustments' = 'manage'
        )
    )
  ) then
    raise exception 'Usuário sem permissão para alterar o patrimônio de barris.' using errcode = '42501';
  end if;

  select expected_quantity into previous_quantity
  from public.barrel_patrimony_targets
  where organization_id = target_organization_id and barrel_model_id = p_barrel_model_id
  for update;

  insert into public.barrel_patrimony_targets (
    organization_id, barrel_model_id, expected_quantity, updated_by
  ) values (
    target_organization_id, p_barrel_model_id, p_expected_quantity, p_actor_user_id
  )
  on conflict (organization_id, barrel_model_id) do update
  set expected_quantity = excluded.expected_quantity,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning * into saved_target;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, changes, metadata
  ) values (
    target_organization_id, p_actor_user_id, 'user', 'barrel.patrimony_changed',
    'barrel_model', p_barrel_model_id::text,
    jsonb_build_object('before', coalesce(previous_quantity, 0), 'after', p_expected_quantity),
    jsonb_build_object('reason', trim(p_reason))
  );

  return saved_target;
end;
$$;

create or replace function public.adjust_barrel_inventory(
  p_actor_user_id uuid,
  p_inventory_id uuid,
  p_quantity_after integer,
  p_reason_code text,
  p_reason text
)
returns public.barrel_inventory_adjustments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inventory_row public.barrel_inventory;
  created_adjustment public.barrel_inventory_adjustments;
begin
  if p_quantity_after < 0 then
    raise exception 'A quantidade final não pode ser negativa.' using errcode = '22023';
  end if;
  if p_reason_code not in (
    'physical_count', 'partial_return', 'entry_error', 'damage_or_loss',
    'acquisition', 'write_off', 'other'
  ) then
    raise exception 'Motivo de ajuste inválido.' using errcode = '22023';
  end if;
  if char_length(trim(p_reason)) < 5 then
    raise exception 'Informe uma justificativa com ao menos 5 caracteres.' using errcode = '22023';
  end if;

  select * into inventory_row
  from public.barrel_inventory
  where id = p_inventory_id
  for update;
  if not found then raise exception 'Linha de estoque não encontrada.' using errcode = 'P0002'; end if;

  if not (
    exists (select 1 from public.platform_admins where user_id = p_actor_user_id and role = 'platform_owner' and is_active)
    or exists (
      select 1 from public.organization_members
      where organization_id = inventory_row.organization_id
        and user_id = p_actor_user_id
        and status = 'active'
        and (
          role in ('organization_owner', 'organization_admin')
          or permissions ->> 'barrel_adjustments' = 'manage'
        )
    )
  ) then
    raise exception 'Usuário sem permissão para ajustar barris.' using errcode = '42501';
  end if;

  if inventory_row.quantity = p_quantity_after then
    raise exception 'A nova quantidade é igual à quantidade atual.' using errcode = '22023';
  end if;

  update public.barrel_inventory
  set quantity = p_quantity_after
  where id = inventory_row.id;

  insert into public.barrel_inventory_adjustments (
    organization_id, barrel_inventory_id, barrel_model_id, status, beer_type_id,
    quantity_before, quantity_after, reason_code, reason, created_by
  ) values (
    inventory_row.organization_id, inventory_row.id, inventory_row.barrel_model_id,
    inventory_row.status, inventory_row.beer_type_id, inventory_row.quantity,
    p_quantity_after, p_reason_code, trim(p_reason), p_actor_user_id
  ) returning * into created_adjustment;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, changes, metadata
  ) values (
    inventory_row.organization_id, p_actor_user_id, 'user', 'barrel.inventory_adjusted',
    'barrel_inventory', inventory_row.id::text,
    jsonb_build_object('before', inventory_row.quantity, 'after', p_quantity_after),
    jsonb_build_object('reason_code', p_reason_code, 'reason', trim(p_reason))
  );

  return created_adjustment;
end;
$$;

revoke all on function public.set_barrel_patrimony_target(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.adjust_barrel_inventory(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.set_barrel_patrimony_target(uuid, uuid, integer, text) to service_role;
grant execute on function public.adjust_barrel_inventory(uuid, uuid, integer, text, text) to service_role;
