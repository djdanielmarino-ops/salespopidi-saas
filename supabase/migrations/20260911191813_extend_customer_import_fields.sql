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
        organization_id, person_type, full_name, cpf, cnpj, email, phone, company_name, trade_name, notes,
        rg, birth_date, zip_code, street, number, complement, neighborhood, city, state
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
        nullif(staged.normalized_data->>'notes', ''),
        nullif(staged.normalized_data->>'rg', ''),
        nullif(staged.normalized_data->>'birth_date', '')::date,
        nullif(staged.normalized_data->>'zip_code', ''),
        nullif(staged.normalized_data->>'street', ''),
        nullif(staged.normalized_data->>'number', ''),
        nullif(staged.normalized_data->>'complement', ''),
        nullif(staged.normalized_data->>'neighborhood', ''),
        nullif(staged.normalized_data->>'city', ''),
        nullif(staged.normalized_data->>'state', '')
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
