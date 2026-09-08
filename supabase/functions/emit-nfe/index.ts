import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  dinheiro: '01',
  cartao_credito: '03',
  cartao_debito: '04',
  pix: '17',
  transferencia: '99',
}

function unmask(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '')
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[emit-nfe] Iniciando execução', { method: req.method })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(401, { success: false, error: 'Missing authorization' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) return jsonResponse(401, { success: false, error: 'Unauthorized' })

    // Service-role client for atomic update + bypass RLS for sensitive fields
    const sb = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => null)
    const orderId = body?.order_id
    if (!orderId || typeof orderId !== 'string') {
      return jsonResponse(400, { success: false, error: 'order_id obrigatório' })
    }

    // Load order + relations
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .select('*, customers(*)')
      .eq('id', orderId)
      .single()
    if (orderErr || !order) return jsonResponse(404, { success: false, error: 'Pedido não encontrado' })

    const [{ data: membership }, { data: platformAccess }] = await Promise.all([
      sb.from('organization_members').select('role,status,permissions')
        .eq('organization_id', order.organization_id).eq('user_id', user.id).maybeSingle(),
      sb.from('platform_admins').select('is_active').eq('user_id', user.id).maybeSingle(),
    ])
    const canEmit = platformAccess?.is_active || (
      membership?.status === 'active' && (
        ['organization_owner', 'organization_admin', 'manager', 'finance'].includes(membership.role) ||
        membership.permissions?.financial === 'manage'
      )
    )
    if (!canEmit) return jsonResponse(403, { success: false, error: 'Sem permissão para emitir NFe nesta empresa' })

    const { data: endpoint, error: endpointError } = await sb.from('webhook_endpoints')
      .select('id,url,timeout_ms,max_attempts')
      .eq('organization_id', order.organization_id)
      .eq('endpoint_key', 'nfe_issue')
      .eq('environment', 'production')
      .eq('is_active', true)
      .maybeSingle()
    if (endpointError) throw endpointError
    if (!endpoint) return jsonResponse(404, { success: false, error: 'Webhook de emissão de NFe não configurado para esta empresa' })

    const { data: items } = await sb
      .from('order_items')
      .select('*, beer_types(*)')
      .eq('order_id', orderId)
    const { data: payments } = await sb
      .from('payments')
      .select('*')
      .eq('order_id', orderId)

    const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount), 0)

    // Eligibility — apenas financeiro (independente de logística/equipamentos)
    console.log('[emit-nfe] Verificando elegibilidade', {
      orderId, status: order.status, total: order.total, totalPaid, nfe_status: order.nfe_status,
    })
    if (order.status === 'cancelado') {
      return jsonResponse(400, { success: false, error: 'Pedido está cancelado' })
    }
    if (!(Number(order.total) > 0) || totalPaid < Number(order.total)) {
      return jsonResponse(400, { success: false, error: 'Pagamento não está quitado' })
    }
    if (order.nfe_status === 'emitida') {
      return jsonResponse(409, { success: false, error: 'NFe já emitida' })
    }
    if (order.nfe_status === 'emitindo') {
      return jsonResponse(409, { success: false, error: 'NFe já está em processamento' })
    }

    const customer = order.customers
    if (!customer) return jsonResponse(400, { success: false, error: 'Cliente não encontrado' })

    // Required field validation
    const missing: string[] = []
    const isCompany = customer.person_type === 'PJ' || customer.person_type === 'company'
    if (isCompany) {
      if (!customer.cnpj) missing.push('CNPJ')
      if (!customer.company_name) missing.push('Razão social')
    } else {
      if (!customer.cpf) missing.push('CPF')
      if (!customer.full_name) missing.push('Nome completo')
    }

    const useDelivery = order.delivery_type === 'entrega'
    const addr = useDelivery ? {
      street: order.delivery_address_street,
      number: order.delivery_address_number,
      complement: order.delivery_address_complement,
      neighborhood: order.delivery_address_neighborhood,
      city: order.delivery_address_city,
      state: order.delivery_address_state,
      zip: order.delivery_address_zip_code,
    } : {
      street: customer.street, number: customer.number, complement: customer.complement,
      neighborhood: customer.neighborhood, city: customer.city, state: customer.state, zip: customer.zip_code,
    }
    const addrPrefix = useDelivery ? 'Endereço entrega' : 'Endereço cliente'
    for (const [k, label] of [['street','logradouro'],['number','número'],['neighborhood','bairro'],['city','cidade'],['state','UF'],['zip','CEP']] as const) {
      if (!addr[k]) missing.push(`${addrPrefix}: ${label}`)
    }

    if (!items || items.length === 0) missing.push('Itens do pedido')
    else {
      for (const it of items) {
        if (!it.beer_types?.code) missing.push(`Código produto: ${it.beer_types?.name || '?'}`)
      }
    }

    if (missing.length > 0) {
      return jsonResponse(400, { success: false, error: 'Campos obrigatórios faltando', missing })
    }

    // Atomic lock — only allow when current status is null or 'erro'
    console.log('[emit-nfe] Tentando reservar emissão (lock)', { orderId, currentStatus: order.nfe_status })
    const lockQuery = sb
      .from('orders')
      .update({
        nfe_status: 'emitindo',
        nfe_last_attempt_at: new Date().toISOString(),
        nfe_issued_by: user.id,
        nfe_error_message: null,
      })
      .eq('id', orderId)

    const { data: locked, error: lockErr } = order.nfe_status === 'erro'
      ? await lockQuery.eq('nfe_status', 'erro').select('id')
      : await lockQuery.is('nfe_status', null).select('id')

    if (lockErr) {
      console.error('[emit-nfe] Erro no lock', lockErr)
      return jsonResponse(500, { success: false, error: 'Erro ao reservar emissão', detail: lockErr.message })
    }
    if (!locked || locked.length === 0) {
      console.warn('[emit-nfe] Lock não aplicou — possivelmente já em processamento', { orderId })
      return jsonResponse(409, { success: false, error: 'NFe já emitida ou em processamento' })
    }
    console.log('[emit-nfe] Lock aplicado com sucesso', { orderId })

    // Predominant payment method
    const byMethod: Record<string, number> = {}
    for (const p of (payments || [])) {
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount)
    }
    const predominant = Object.entries(byMethod).sort((a,b) => b[1]-a[1])[0]?.[0] || 'dinheiro'

    const eventId = crypto.randomUUID()
    const idempotencyKey = `${order.organization_id}:${order.order_number}`
    const payload = {
      event_id: eventId,
      event_type: 'invoice.requested',
      schema_version: 1,
      organization_id: order.organization_id,
      unit_id: order.unit_id || null,
      occurred_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      pedido: {
        numero: String(order.order_number),
        data_emissao: new Date().toISOString().slice(0, 19),
      },
      cliente: {
        tipo: isCompany ? 'PJ' : 'PF',
        cpf_cnpj: isCompany ? unmask(customer.cnpj) : unmask(customer.cpf),
        razao_social: isCompany ? customer.company_name : customer.full_name,
        nome_fantasia: customer.trade_name || undefined,
        inscricao_estadual: customer.state_registration || undefined,
        email: customer.email || undefined,
        telefone: unmask(customer.phone) || undefined,
        endereco: {
          logradouro: addr.street,
          numero: addr.number,
          complemento: addr.complement || undefined,
          bairro: addr.neighborhood,
          municipio: addr.city,
          uf: addr.state,
          cep: unmask(addr.zip),
        },
      },
      produtos: items!.map((it) => ({
        codigo: it.beer_types!.code,
        quantidade: Number(it.quantity_liters),
        valor_unitario: Number(it.unit_price),
      })),
      frete: { modalidade: '9', valor: Number(order.delivery_fee || 0) },
      pagamento: {
        forma: PAYMENT_METHOD_MAP[predominant] || '99',
        parcelas: 1,
        valor_total: Number(order.total),
      },
    }

    // POST with timeout
    const { data: integrationEvent, error: integrationEventError } = await sb.from('integration_events').insert({
      organization_id: order.organization_id,
      event_id: eventId,
      direction: 'outbound',
      event_type: 'invoice.requested',
      aggregate_type: 'order',
      aggregate_id: order.id,
      source: 'salespopidi',
      status: 'processing',
      payload,
    }).select('id').single()
    if (integrationEventError) throw integrationEventError

    const startedAt = new Date().toISOString()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), endpoint.timeout_ms)

    let webhookStatus = 0
    let webhookJson: Record<string, unknown> | null = null
    let webhookText = ''
    let networkError: string | null = null

    console.log('[emit-nfe] Enviando evento', { endpointId: endpoint.id, orderId, eventId })

    try {
      const r = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
      webhookStatus = r.status
      webhookText = await r.text()
      console.log('[emit-nfe] Webhook respondeu', { status: webhookStatus, body: webhookText.slice(0, 1000) })
      try { webhookJson = JSON.parse(webhookText) } catch { /* not json */ }
    } catch (e) {
      networkError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      console.error('[emit-nfe] Falha de rede/timeout no fetch', networkError)
    } finally {
      clearTimeout(timer)
    }

    const delivered = webhookStatus >= 200 && webhookStatus < 300
    await sb.from('webhook_deliveries').insert({
      organization_id: order.organization_id,
      event_id: integrationEvent.id,
      endpoint_id: endpoint.id,
      attempt_number: 1,
      status: delivered ? 'delivered' : 'failed',
      response_status: webhookStatus || null,
      response_body_excerpt: webhookText.slice(0, 1000),
      error_message: delivered ? null : networkError || `HTTP ${webhookStatus}`,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    })
    await sb.from('integration_events').update({
      status: delivered ? 'processed' : 'failed',
      processed_at: delivered ? new Date().toISOString() : null,
      error_message: delivered ? null : networkError || `HTTP ${webhookStatus}`,
    }).eq('id', integrationEvent.id)

    // 202: keep 'emitindo'
    if (webhookStatus === 202) {
      return jsonResponse(202, {
        success: true,
        async: true,
        message: 'NFe em processamento. Aguarde a confirmação.',
      })
    }

    // Success sync
    if (webhookStatus >= 200 && webhookStatus < 300) {
      const nfeNumber = webhookJson?.nfe_number ?? webhookJson?.numero ?? null
      const nfeKey = webhookJson?.nfe_key ?? webhookJson?.chave ?? null
      await sb
        .from('orders')
        .update({
          nfe_status: 'emitida',
          nfe_issued_at: new Date().toISOString(),
          nfe_number: nfeNumber,
          nfe_key: nfeKey,
        })
        .eq('id', orderId)
      return jsonResponse(200, { success: true, nfe_number: nfeNumber, nfe_key: nfeKey })
    }

    // Error: do NOT revert to null — keep as 'erro'
    const errMsg = networkError
      ? `Falha de rede/timeout: ${networkError}`
      : `HTTP ${webhookStatus}: ${webhookText.slice(0, 300)}`
    await sb
      .from('orders')
      .update({
        nfe_status: 'erro',
        nfe_error_message: errMsg.slice(0, 500),
      })
      .eq('id', orderId)
    return jsonResponse(502, {
      success: false,
      error: 'Falha ao emitir NFe. Verifique no sistema fiscal antes de tentar novamente.',
      detail: errMsg,
    })
  } catch (error) {
    console.error('emit-nfe error', error)
    return jsonResponse(500, { success: false, error: 'Erro interno' })
  }
})
