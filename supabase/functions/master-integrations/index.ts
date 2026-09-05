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

const endpointKeys = new Set([
  'orders_automation',
  'daily_orders',
  'barrels_send',
  'barrels_receive',
  'barrels_daily_summary',
  'brewery_orders_send',
  'nfe_issue',
  'brewery_order_receive',
  'order_form_receive',
  'messages_automation',
  'custom',
])

const environments = new Set(['test', 'production'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    const { data: access } = await admin.from('platform_admins').select('role,is_active').eq('user_id', actorId).maybeSingle()
    if (!access?.is_active || access.role !== 'platform_owner') {
      return json(403, { error: 'Apenas o proprietário da plataforma pode gerenciar integrações.' })
    }

    const body = await req.json()
    const action = String(body.action || '')
    const organizationId = String(body.organization_id || '')
    if (!uuid.test(organizationId)) return json(400, { error: 'Organização inválida.' })

    if (action === 'list') {
      const { data, error } = await admin
        .from('webhook_endpoints')
        .select('id,organization_id,name,endpoint_key,url,event_types,is_active,environment,timeout_ms,max_attempts,last_tested_at,last_success_at,last_error_at,last_error_message,created_at,updated_at')
        .eq('organization_id', organizationId)
        .order('endpoint_key')
        .order('environment')
      if (error) throw error
      return json(200, { endpoints: data || [] })
    }

    if (action === 'upsert') {
      const id = body.id ? String(body.id) : null
      const name = String(body.name || '').trim()
      const endpointKey = String(body.endpoint_key || '')
      const environment = String(body.environment || '')
      const targetUrl = String(body.url || '').trim()
      const timeoutMs = Number(body.timeout_ms || 15000)
      const maxAttempts = Number(body.max_attempts || 5)
      if (id && !uuid.test(id)) return json(400, { error: 'Webhook inválido.' })
      if (name.length < 2 || name.length > 100) return json(400, { error: 'Nome inválido.' })
      if (!endpointKeys.has(endpointKey)) return json(400, { error: 'Tipo de webhook inválido.' })
      if (!environments.has(environment)) return json(400, { error: 'Ambiente inválido.' })
      let parsed: URL
      try { parsed = new URL(targetUrl) } catch { return json(400, { error: 'URL inválida.' }) }
      if (parsed.protocol !== 'https:' && !(environment === 'test' && parsed.protocol === 'http:')) {
        return json(400, { error: 'Use HTTPS. HTTP é permitido somente em ambiente de teste.' })
      }
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) return json(400, { error: 'Timeout inválido.' })
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) return json(400, { error: 'Número de tentativas inválido.' })

      const values = {
        organization_id: organizationId,
        name,
        endpoint_key: endpointKey,
        url: targetUrl,
        event_types: Array.isArray(body.event_types) ? body.event_types.map(String).slice(0, 30) : [],
        is_active: body.is_active !== false,
        environment,
        timeout_ms: timeoutMs,
        max_attempts: maxAttempts,
      }
      const query = id
        ? admin.from('webhook_endpoints').update(values).eq('id', id).eq('organization_id', organizationId)
        : admin.from('webhook_endpoints').insert(values)
      const { data, error } = await query.select('id,name,endpoint_key,url,event_types,is_active,environment,timeout_ms,max_attempts,last_tested_at,last_success_at,last_error_at,last_error_message').single()
      if (error) throw error
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_user_id: actorId,
        action: id ? 'webhook.updated' : 'webhook.created',
        resource_type: 'webhook_endpoint', resource_id: data.id,
        metadata: { endpoint_key: endpointKey, environment, name },
      })
      return json(200, { endpoint: data })
    }

    if (action === 'delete') {
      const id = String(body.id || '')
      if (!uuid.test(id)) return json(400, { error: 'Webhook inválido.' })
      const { data, error } = await admin.from('webhook_endpoints').delete().eq('id', id).eq('organization_id', organizationId).select('id,endpoint_key').maybeSingle()
      if (error) throw error
      if (!data) return json(404, { error: 'Webhook não encontrado.' })
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_user_id: actorId, action: 'webhook.deleted',
        resource_type: 'webhook_endpoint', resource_id: data.id, metadata: { endpoint_key: data.endpoint_key },
      })
      return json(200, { success: true })
    }

    if (action === 'test') {
      const id = String(body.id || '')
      if (!uuid.test(id)) return json(400, { error: 'Webhook inválido.' })
      const { data: endpoint, error } = await admin.from('webhook_endpoints')
        .select('id,name,endpoint_key,url,timeout_ms').eq('id', id).eq('organization_id', organizationId).maybeSingle()
      if (error) throw error
      if (!endpoint) return json(404, { error: 'Webhook não encontrado.' })
      const testedAt = new Date().toISOString()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), endpoint.timeout_ms)
      let ok = false
      let responseStatus: number | null = null
      let errorMessage: string | null = null
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Sales-Popidi-Test': 'true' },
          body: JSON.stringify({
            event_id: crypto.randomUUID(), event_type: 'webhook.test', test: true,
            organization_id: organizationId, endpoint_key: endpoint.endpoint_key, occurred_at: testedAt,
          }),
          signal: controller.signal,
        })
        responseStatus = response.status
        ok = response.ok
        if (!ok) errorMessage = `HTTP ${response.status}`
      } catch (testError) {
        errorMessage = testError instanceof Error ? testError.message : 'Falha de conexão.'
      } finally {
        clearTimeout(timeout)
      }
      await admin.from('webhook_endpoints').update({
        last_tested_at: testedAt,
        last_success_at: ok ? testedAt : undefined,
        last_error_at: ok ? null : testedAt,
        last_error_message: ok ? null : errorMessage,
      }).eq('id', id).eq('organization_id', organizationId)
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_user_id: actorId, action: 'webhook.tested',
        resource_type: 'webhook_endpoint', resource_id: id,
        metadata: { ok, response_status: responseStatus, error: errorMessage },
      })
      return json(ok ? 200 : 502, { success: ok, status: responseStatus, error: errorMessage })
    }

    if (action === 'list_activity') {
      const { data, error } = await admin.from('integration_events')
        .select('id,event_id,event_type,aggregate_type,aggregate_id,status,error_message,occurred_at,processed_at,webhook_deliveries(id,endpoint_id,attempt_number,status,response_status,error_message,started_at,finished_at)')
        .eq('organization_id', organizationId).order('occurred_at', { ascending: false }).limit(50)
      if (error) throw error
      return json(200, { events: data || [] })
    }

    if (action === 'retry') {
      const deliveryId = String(body.delivery_id || '')
      if (!uuid.test(deliveryId)) return json(400, { error: 'Tentativa inválida.' })
      const { data: previous, error: deliveryError } = await admin.from('webhook_deliveries')
        .select('id,event_id,endpoint_id,attempt_number').eq('id', deliveryId)
        .eq('organization_id', organizationId).maybeSingle()
      if (deliveryError) throw deliveryError
      if (!previous) return json(404, { error: 'Tentativa não encontrada.' })
      const [{ data: event, error: eventError }, { data: endpoint, error: endpointError }] = await Promise.all([
        admin.from('integration_events').select('id,event_id,event_type,payload').eq('id', previous.event_id).eq('organization_id', organizationId).maybeSingle(),
        admin.from('webhook_endpoints').select('id,url,timeout_ms,max_attempts,is_active').eq('id', previous.endpoint_id).eq('organization_id', organizationId).maybeSingle(),
      ])
      if (eventError) throw eventError
      if (endpointError) throw endpointError
      if (!event || !endpoint) return json(404, { error: 'Evento ou endpoint não encontrado.' })
      if (!endpoint.is_active) return json(409, { error: 'Ative o webhook antes de reenviar.' })
      const { data: attempts, error: attemptsError } = await admin.from('webhook_deliveries')
        .select('attempt_number').eq('event_id', event.id).eq('endpoint_id', endpoint.id)
        .order('attempt_number', { ascending: false }).limit(1)
      if (attemptsError) throw attemptsError
      const attemptNumber = Number(attempts?.[0]?.attempt_number || 0) + 1
      if (attemptNumber > endpoint.max_attempts) return json(409, { error: 'Limite de tentativas atingido.' })
      const startedAt = new Date().toISOString()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), endpoint.timeout_ms)
      let success = false
      let responseStatus: number | null = null
      let responseExcerpt = ''
      let errorMessage: string | null = null
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event.payload), signal: controller.signal,
        })
        responseStatus = response.status
        responseExcerpt = (await response.text()).slice(0, 1000)
        success = response.ok
        if (!success) errorMessage = `HTTP ${response.status}`
      } catch (retryError) {
        errorMessage = retryError instanceof Error ? retryError.message : 'Falha de conexão.'
      } finally {
        clearTimeout(timeout)
      }
      const { data: delivery, error: insertError } = await admin.from('webhook_deliveries').insert({
        organization_id: organizationId, event_id: event.id, endpoint_id: endpoint.id,
        attempt_number: attemptNumber, status: success ? 'delivered' : 'failed',
        response_status: responseStatus, response_body_excerpt: responseExcerpt,
        error_message: errorMessage, started_at: startedAt, finished_at: new Date().toISOString(),
      }).select('id').single()
      if (insertError) throw insertError
      await admin.from('integration_events').update({
        status: success ? 'processed' : (attemptNumber >= endpoint.max_attempts ? 'dead_letter' : 'failed'),
        processed_at: success ? new Date().toISOString() : null,
        error_message: success ? null : errorMessage,
      }).eq('id', event.id).eq('organization_id', organizationId)
      await admin.from('audit_logs').insert({
        organization_id: organizationId, actor_user_id: actorId, action: 'webhook.retried',
        resource_type: 'webhook_delivery', resource_id: delivery.id,
        metadata: { event_id: event.event_id, attempt_number: attemptNumber, success },
      })
      return json(success ? 200 : 502, { success, status: responseStatus, error: errorMessage })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerenciar integrações.'
    return json(message.includes('duplicate key') ? 409 : 400, { error: message })
  }
})
