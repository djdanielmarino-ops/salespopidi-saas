import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const reasons = new Set([
  'physical_count', 'partial_return', 'entry_error', 'damage_or_loss',
  'acquisition', 'write_off', 'other',
])

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
    const actorId = String(claims?.claims?.sub || '')
    if (claimError || !actorId) return json(401, { error: 'Sessão inválida.' })

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await req.json()
    const reason = String(body.reason || '').trim()
    if (reason.length < 5 || reason.length > 500) {
      return json(400, { error: 'Informe uma justificativa entre 5 e 500 caracteres.' })
    }

    if (body.action === 'set_target') {
      const modelId = String(body.barrel_model_id || '')
      const expectedQuantity = Number(body.expected_quantity)
      if (!Number.isInteger(expectedQuantity) || expectedQuantity < 0) {
        return json(400, { error: 'Quantidade patrimonial inválida.' })
      }
      const { data, error } = await admin.rpc('set_barrel_patrimony_target', {
        p_actor_user_id: actorId,
        p_barrel_model_id: modelId,
        p_expected_quantity: expectedQuantity,
        p_reason: reason,
      })
      if (error) throw error
      return json(200, { target: data })
    }

    if (body.action === 'adjust') {
      const inventoryId = String(body.inventory_id || '')
      const quantityAfter = Number(body.quantity_after)
      const reasonCode = String(body.reason_code || '')
      if (!Number.isInteger(quantityAfter) || quantityAfter < 0) {
        return json(400, { error: 'Quantidade final inválida.' })
      }
      if (!reasons.has(reasonCode)) return json(400, { error: 'Motivo de ajuste inválido.' })
      const { data, error } = await admin.rpc('adjust_barrel_inventory', {
        p_actor_user_id: actorId,
        p_inventory_id: inventoryId,
        p_quantity_after: quantityAfter,
        p_reason_code: reasonCode,
        p_reason: reason,
      })
      if (error) throw error
      return json(200, { adjustment: data })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao controlar inventário de barris.'
    return json(message.includes('permissão') ? 403 : 400, { error: message })
  }
})
