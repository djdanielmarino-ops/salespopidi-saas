import { createClient } from 'npm:@supabase/supabase-js@2'
import { authenticateInbound } from '../_shared/inbound-auth.ts'

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  try {
    const payload = await req.json().catch(() => null)
    if (!payload || !payload.event_id || !payload.event_type) return json(400, { error: 'event_id e event_type são obrigatórios.' })

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const auth = await authenticateInbound(req, db, 'brewery_order_receive', payload.organization_id)
    if ('error' in auth) return json(auth.status, { error: auth.error })

    const { data: existing } = await db.from('integration_events').select('status')
      .eq('organization_id', auth.organizationId).eq('event_id', payload.event_id).maybeSingle()
    if (existing) return json(200, { success: true, duplicate: true, status: existing.status })

    const localId = payload.order_id || payload.order?.id || null
    const externalId = payload.external_order_id || payload.order?.external_order_id || null
    let query = db.from('brewery_orders').select('id,status').eq('organization_id', auth.organizationId)
    query = localId ? query.eq('id', localId) : query.eq('external_order_id', externalId || '__missing__')
    const { data: order } = await query.maybeSingle()

    await db.from('integration_events').insert({
      organization_id: auth.organizationId,
      event_id: payload.event_id,
      direction: 'inbound',
      event_type: payload.event_type,
      aggregate_type: 'brewery_order',
      aggregate_id: order?.id || null,
      source: 'n8n',
      status: order ? 'processing' : 'unmatched',
      payload,
    })
    if (!order) return json(200, { success: true, matched: false })

    const statusMap: Record<string, string> = {
      'brewery_order.accepted': 'acknowledged',
      'brewery_order.confirmed': 'confirmed',
      'brewery_order.released': 'released',
      'brewery_order.invoice_issued': 'released',
      'brewery_order.shipped': 'in_transit',
      'brewery_order.rejected': 'rejected',
      'brewery_order.cancelled': 'cancelled',
    }
    const next = statusMap[payload.event_type]
    if (!next) {
      await db.from('integration_events').update({ status: 'unmatched', error_message: 'Tipo de evento não reconhecido.' })
        .eq('organization_id', auth.organizationId).eq('event_id', payload.event_id)
      return json(200, { success: true, matched: true, processed: false })
    }

    const changes: Record<string, unknown> = { status: next }
    if (externalId) changes.external_order_id = externalId
    if (payload.invoice?.number) changes.invoice_number = payload.invoice.number
    if (payload.invoice?.key) changes.invoice_key = payload.invoice.key
    if (payload.invoice?.issued_at) changes.invoice_issued_at = payload.invoice.issued_at
    if (payload.expected_delivery_date) changes.expected_delivery_date = payload.expected_delivery_date
    const { error } = await db.from('brewery_orders').update(changes)
      .eq('organization_id', auth.organizationId).eq('id', order.id)
    if (error) throw error

    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        if (item.item_id && Number.isFinite(Number(item.quantity_released))) {
          await db.from('brewery_order_items').update({ quantity_released: Number(item.quantity_released) })
            .eq('organization_id', auth.organizationId).eq('id', item.item_id).eq('brewery_order_id', order.id)
        }
      }
    }
    await db.from('integration_events').update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('organization_id', auth.organizationId).eq('event_id', payload.event_id)
    return json(200, { success: true, matched: true, processed: true })
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Erro interno.' })
  }
})
