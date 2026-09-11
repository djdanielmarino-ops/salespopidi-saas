import { validateCustomer } from './customer.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

type ImportKind = 'customers' | 'equipment' | 'sales_history'
type Row = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()
const digits = (value: unknown) => text(value).replace(/\D/g, '')
const decimal = (value: unknown) => {
  const raw = text(value).replace(/\s/g, '').replace(/^R\$/i, '')
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  return Number(normalized)
}
const isoDate = (value: unknown) => {
  const raw = text(value)
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}


function validateEquipment(row: Row) {
  const errors: string[] = []
  const aliases: Record<string, string> = { barril: 'barrel', barrel: 'barrel', chopeira: 'tap', tap: 'tap', cilindro: 'cylinder', cylinder: 'cylinder' }
  const equipmentType = aliases[text(row.tipo).toLowerCase()]
  const code = text(row.codigo)
  if (!equipmentType) errors.push('Tipo deve ser barril, chopeira ou cilindro.')
  if (!code) errors.push('Código é obrigatório.')
  const statusInput = text(row.status).toLowerCase().replace(/\s+/g, '_')
  const defaults: Record<string, string> = { barrel: 'cheio_loja', tap: 'disponivel', cylinder: 'cheio' }
  const allowed: Record<string, string[]> = {
    barrel: ['cheio_loja', 'com_cliente', 'vazio_loja', 'na_cervejaria'],
    tap: ['disponivel', 'em_uso', 'manutencao'], cylinder: ['cheio', 'com_cliente', 'vazio'],
  }
  const status = statusInput || defaults[equipmentType]
  if (equipmentType && !allowed[equipmentType].includes(status)) errors.push(`Status inválido para ${text(row.tipo)}.`)
  const capacity = decimal(row.capacidade_litros)
  if (equipmentType === 'barrel' && (!Number.isFinite(capacity) || capacity <= 0)) errors.push('Capacidade em litros é obrigatória para barril.')
  return { errors, normalized: {
    equipment_type: equipmentType, code, status, capacity_liters: equipmentType === 'barrel' ? capacity : '',
    voltage: text(row.voltagem), notes: text(row.observacoes),
  } }
}

function validateSale(row: Row) {
  const errors: string[] = []
  const saleDate = isoDate(row.data)
  const customerName = text(row.cliente)
  const total = decimal(row.total)
  if (!saleDate) errors.push('Data deve estar em DD/MM/AAAA ou AAAA-MM-DD.')
  if (!customerName) errors.push('Cliente é obrigatório.')
  if (!Number.isFinite(total) || total < 0) errors.push('Total inválido.')
  return { errors, normalized: {
    external_number: text(row.numero), sale_date: saleDate, customer_name: customerName,
    customer_document: digits(row.cpf_cnpj), description: text(row.descricao), total,
    payment_method: text(row.forma_pagamento), notes: text(row.observacoes),
  } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const scoped = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: claims, error: claimError } = await scoped.auth.getClaims(token)
    const requesterId = String(claims?.claims?.sub || '')
    if (claimError || !requesterId) return json(401, { error: 'Sessão inválida.' })

    const body = await req.json()
    const organizationId = String(body.organization_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return json(400, { error: 'Organização inválida.' })
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const [{ data: membership }, { data: platform }] = await Promise.all([
      admin.from('organization_members').select('role,status').eq('organization_id', organizationId).eq('user_id', requesterId).maybeSingle(),
      admin.from('platform_admins').select('role,is_active').eq('user_id', requesterId).maybeSingle(),
    ])
    const allowed = membership?.status === 'active' && ['organization_owner', 'organization_admin'].includes(membership.role)
    const platformOwner = platform?.is_active && platform.role === 'platform_owner'
    if (!allowed && !platformOwner) return json(403, { error: 'Somente administradores podem realizar importações.' })

    if (body.action === 'list') {
      const { data, error } = await admin.from('import_batches').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return json(200, { batches: data })
    }

    if (body.action === 'commit') {
      const batchId = String(body.batch_id || '')
      const { data: batch } = await admin.from('import_batches').select('id').eq('id', batchId).eq('organization_id', organizationId).maybeSingle()
      if (!batch) return json(404, { error: 'Lote não encontrado.' })
      const { data, error } = await admin.rpc('commit_onboarding_import', { target_batch_id: batchId })
      if (error) throw error
      return json(200, { imported_rows: data })
    }

    if (body.action !== 'validate') return json(400, { error: 'Ação inválida.' })
    const kind = String(body.kind || '') as ImportKind
    if (!['customers', 'equipment', 'sales_history'].includes(kind)) return json(400, { error: 'Tipo de importação inválido.' })
    const rows = Array.isArray(body.rows) ? body.rows as Row[] : []
    if (!rows.length || rows.length > 2000) return json(400, { error: 'Envie entre 1 e 2.000 linhas por lote.' })

    const seen = new Set<string>()
    const staged = rows.map((row, index) => {
      const result = kind === 'customers' ? validateCustomer(row) : kind === 'equipment' ? validateEquipment(row) : validateSale(row)
      const uniqueKey = kind === 'customers'
        ? String(result.normalized.cpf || result.normalized.cnpj || `${result.normalized.phone}:${result.normalized.full_name}`)
        : kind === 'equipment' ? String(result.normalized.code).toLowerCase() : ''
      if (uniqueKey && seen.has(uniqueKey)) result.errors.push('Registro duplicado no arquivo.')
      if (uniqueKey) seen.add(uniqueKey)
      return { organization_id: organizationId, row_number: index + 2, raw_data: row, normalized_data: result.normalized, validation_errors: result.errors, status: result.errors.length ? 'invalid' : 'valid' }
    })
    const validRows = staged.filter((row) => row.status === 'valid').length
    const { data: batch, error: batchError } = await admin.from('import_batches').insert({
      organization_id: organizationId, kind, status: 'validated', file_name: text(body.file_name) || 'importacao.csv',
      total_rows: staged.length, valid_rows: validRows, invalid_rows: staged.length - validRows, created_by: requesterId,
    }).select('id').single()
    if (batchError) throw batchError
    const { error: rowsError } = await admin.from('import_rows').insert(staged.map((row) => ({ ...row, batch_id: batch.id })))
    if (rowsError) {
      await admin.from('import_batches').delete().eq('id', batch.id)
      throw rowsError
    }
    return json(200, { batch_id: batch.id, total_rows: staged.length, valid_rows: validRows, invalid_rows: staged.length - validRows, rows: staged.slice(0, 100) })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Erro ao processar importação.' })
  }
})
