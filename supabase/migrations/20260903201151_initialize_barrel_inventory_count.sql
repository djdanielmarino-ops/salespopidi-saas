-- Permite registrar a primeira contagem de uma combinação que ainda não existe
-- e reutiliza a mesma trilha auditável dos ajustes posteriores.
create or replace function public.set_barrel_inventory_count(
  p_actor_user_id uuid,
  p_barrel_model_id uuid,
  p_status public.barrel_status,
  p_beer_type_id uuid,
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
  target_organization_id uuid;
  target_unit_id uuid;
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

  select organization_id into target_organization_id
  from public.barrel_models where id = p_barrel_model_id;
  if not found then raise exception 'Modelo de barril não encontrado.' using errcode = 'P0002'; end if;

  if p_beer_type_id is not null and not exists (
    select 1 from public.beer_types
    where id = p_beer_type_id and organization_id = target_organization_id
  ) then
    raise exception 'Tipo de chopp não pertence à organização.' using errcode = '22023';
  end if;

  if p_status in ('cheio_loja', 'com_cliente') and p_beer_type_id is null then
    raise exception 'Informe o tipo de chopp para barris cheios ou com cliente.' using errcode = '22023';
  end if;

  if not (
    exists (select 1 from public.platform_admins where user_id = p_actor_user_id and role = 'platform_owner' and is_active)
    or exists (
      select 1 from public.organization_members
      where organization_id = target_organization_id
        and user_id = p_actor_user_id
        and status = 'active'
        and (role in ('organization_owner', 'organization_admin') or permissions ->> 'barrel_adjustments' = 'manage')
    )
  ) then
    raise exception 'Usuário sem permissão para ajustar barris.' using errcode = '42501';
  end if;

  select id into target_unit_id
  from public.organization_units
  where organization_id = target_organization_id and status = 'active'
  order by created_at
  limit 1;

  if target_unit_id is null then
    insert into public.organization_units (organization_id, name, code, unit_type)
    values (target_organization_id, 'Unidade principal', 'principal', 'store')
    returning id into target_unit_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    target_organization_id::text || ':' || p_barrel_model_id::text || ':' || p_status::text || ':' || coalesce(p_beer_type_id::text, ''), 0
  ));

  select * into inventory_row
  from public.barrel_inventory
  where organization_id = target_organization_id
    and unit_id = target_unit_id
    and barrel_model_id = p_barrel_model_id
    and status = p_status
    and beer_type_id is not distinct from p_beer_type_id
  for update;

  if found then
    if inventory_row.quantity = p_quantity_after then
      raise exception 'A nova quantidade é igual à quantidade atual.' using errcode = '22023';
    end if;
    update public.barrel_inventory set quantity = p_quantity_after where id = inventory_row.id;
  else
    if p_quantity_after = 0 then
      raise exception 'Informe uma quantidade maior que zero para iniciar esta localização.' using errcode = '22023';
    end if;
    insert into public.barrel_inventory (
      organization_id, unit_id, barrel_model_id, beer_type_id, status, quantity
    ) values (
      target_organization_id, target_unit_id, p_barrel_model_id, p_beer_type_id, p_status, p_quantity_after
    ) returning * into inventory_row;
    inventory_row.quantity := 0;
  end if;

  insert into public.barrel_inventory_adjustments (
    organization_id, barrel_inventory_id, barrel_model_id, status, beer_type_id,
    quantity_before, quantity_after, reason_code, reason, created_by
  ) values (
    target_organization_id, inventory_row.id, p_barrel_model_id, p_status, p_beer_type_id,
    inventory_row.quantity, p_quantity_after, p_reason_code, trim(p_reason), p_actor_user_id
  ) returning * into created_adjustment;

  insert into public.audit_logs (
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, changes, metadata
  ) values (
    target_organization_id, p_actor_user_id, 'user', 'barrel.inventory_count_set',
    'barrel_inventory', inventory_row.id::text,
    jsonb_build_object('before', inventory_row.quantity, 'after', p_quantity_after),
    jsonb_build_object('status', p_status, 'beer_type_id', p_beer_type_id, 'reason_code', p_reason_code, 'reason', trim(p_reason))
  );

  return created_adjustment;
end;
$$;

revoke all on function public.set_barrel_inventory_count(uuid, uuid, public.barrel_status, uuid, integer, text, text)
from public, anon, authenticated;
grant execute on function public.set_barrel_inventory_count(uuid, uuid, public.barrel_status, uuid, integer, text, text)
to service_role;
