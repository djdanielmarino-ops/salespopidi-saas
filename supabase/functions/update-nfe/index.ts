import { createClient } from 'npm:@supabase/supabase-js@2'
import { authenticateInbound } from '../_shared/inbound-auth.ts'

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
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
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
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const auth = await authenticateInbound(req, sb, 'nfe_issue', body.organization_id)
    if ('error' in auth) return json(auth.status, { error: auth.error })

    const nfeStatusRaw: string | null = body.nfe_status ?? body.status ?? null
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

    const query = sb.from('orders').update(update)
    const { data, error } = orderId
      ? await query.eq('organization_id', auth.organizationId).eq('id', orderId).select('id, order_number, nfe_status, nfe_number, nfe_key, nfe_issued_at').single()
      : await query.eq('organization_id', auth.organizationId).eq('order_number', orderNumber!).select('id, order_number, nfe_status, nfe_number, nfe_key, nfe_issued_at').single()

    if (error) {
      console.error('[update-nfe] update error', error)
      return json(404, { error: 'Pedido não encontrado ou falha ao atualizar', detail: error.message })
    }

    const suppliedEventId = String(body.event_id || '')
    const eventId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedEventId)
      ? suppliedEventId
      : crypto.randomUUID()
    await sb.from('integration_events').upsert({
      organization_id: auth.organizationId,
      event_id: eventId,
      direction: 'inbound',
      event_type: 'invoice.updated',
      aggregate_type: 'order',
      aggregate_id: data.id,
      source: 'n8n',
      status: 'processed',
      processed_at: new Date().toISOString(),
      payload: body,
    }, { onConflict: 'event_id' })

    return json(200, { success: true, event_id: eventId, order: data })
  } catch (e) {
    console.error('[update-nfe] error', e)
    return json(500, { error: 'Internal error' })
  }
})
