import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mapStatus(s: string | null | undefined): 'emitida' | 'erro' | null {
  if (!s) return null
  const v = String(s).toLowerCase().trim()
  if (['autorizada', 'autorizado', 'emitida', 'emitido', 'aprovada', 'aprovado', 'authorized', '100'].includes(v)) return 'emitida'
  if (['rejeitada', 'rejeitado', 'erro', 'error', 'denegada', 'cancelada'].includes(v)) return 'erro'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const expected = Deno.env.get('N8N_API_KEY')
    if (!expected) return json(500, { error: 'API key not configured' })

    const provided =
      req.headers.get('x-api-key') ||
      req.headers.get('X-API-Key') ||
      (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

    if (!provided || provided !== expected) {
      return json(401, { error: 'Unauthorized' })
    }

    const body = await req.json().catch(() => null) as any
    if (!body || typeof body !== 'object') {
      return json(400, { error: 'Invalid JSON body' })
    }

    const orderId: string | undefined = body.order_id
    const orderNumberRaw = body.order_number
    const orderNumber = orderNumberRaw != null ? Number(orderNumberRaw) : undefined

    if (!orderId && !orderNumber) {
      return json(400, { error: 'order_id ou order_number obrigatório' })
    }

    const nfeChave: string | null = body.nfe_chave_acesso ?? body.nfe_key ?? null
    const nfeNumero: string | null = body.nfe_numero != null ? String(body.nfe_numero) : (body.nfe_number != null ? String(body.nfe_number) : null)
    const nfeStatusRaw: string | null = body.nfe_status ?? null
    const nfeDataEmissao: string | null = body.nfe_data_emissao ?? body.nfe_issued_at ?? null
    const nfeErro: string | null = body.nfe_error_message ?? body.error_message ?? null

    const mapped = mapStatus(nfeStatusRaw)

    const update: Record<string, unknown> = {}
    if (nfeChave) update.nfe_key = String(nfeChave)
    if (nfeNumero) update.nfe_number = nfeNumero
    if (nfeDataEmissao) update.nfe_issued_at = nfeDataEmissao
    if (mapped) update.nfe_status = mapped
    if (mapped === 'emitida') {
      update.nfe_error_message = null
      if (!nfeDataEmissao) update.nfe_issued_at = new Date().toISOString()
    }
    if (mapped === 'erro' && nfeErro) update.nfe_error_message = String(nfeErro).slice(0, 500)

    if (Object.keys(update).length === 0) {
      return json(400, { error: 'Nenhum campo de NFe informado', hint: 'Envie nfe_chave_acesso, nfe_numero, nfe_status ou nfe_data_emissao' })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const query = sb.from('orders').update(update)
    const { data, error } = orderId
      ? await query.eq('id', orderId).select('id, order_number, nfe_status, nfe_number, nfe_key, nfe_issued_at').single()
      : await query.eq('order_number', orderNumber!).select('id, order_number, nfe_status, nfe_number, nfe_key, nfe_issued_at').single()

    if (error) {
      console.error('[update-nfe] update error', error)
      return json(404, { error: 'Pedido não encontrado ou falha ao atualizar', detail: error.message })
    }

    return json(200, { success: true, order: data })
  } catch (e) {
    console.error('[update-nfe] error', e)
    return json(500, { error: 'Internal error' })
  }
})
