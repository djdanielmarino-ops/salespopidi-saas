import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Auth via API key (x-api-key header or ?api_key= query param)
    const expected = Deno.env.get('N8N_API_KEY')
    if (!expected) return json(500, { error: 'API key not configured' })

    const url = new URL(req.url)
    const provided =
      req.headers.get('x-api-key') ||
      req.headers.get('X-API-Key') ||
      url.searchParams.get('api_key') ||
      (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

    if (!provided || provided !== expected) {
      return json(401, { error: 'Unauthorized' })
    }

    // Date filter — default = today (America/Sao_Paulo)
    const dateParam = url.searchParams.get('date')
    let targetDate: string
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = dateParam
    } else {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      })
      targetDate = fmt.format(new Date()) // YYYY-MM-DD
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: orders, error } = await sb
      .from('orders')
      .select(`
        id, order_number, status, delivery_type, delivery_date, delivery_time,
        subtotal, delivery_fee, discount, total, notes,
        delivery_address_street, delivery_address_number, delivery_address_complement,
        delivery_address_neighborhood, delivery_address_city, delivery_address_state, delivery_address_zip_code,
        customers:customer_id ( id, full_name, phone, email, person_type, cpf, cnpj, company_name,
          street, number, complement, neighborhood, city, state, zip_code ),
        taps:tap_id ( id, code, voltage, tap_types ( name ) ),
        cylinders:cylinder_id ( id, code ),
        order_items ( id, quantity_liters, barrel_quantity, unit_price, total_price,
          beer_types ( id, name, code ),
          barrel_models ( id, volume )
        )
      `)
      .eq('delivery_date', targetDate)
      .neq('status', 'cancelado')
      .order('delivery_time', { ascending: true, nullsFirst: true })

    if (error) {
      console.error('[n8n-daily-orders] query error', error)
      return json(500, { error: 'Query failed' })
    }

    return json(200, { date: targetDate, count: orders?.length ?? 0, orders: orders ?? [] })
  } catch (e) {
    console.error('[n8n-daily-orders] error', e)
    return json(500, { error: 'Internal error' })
  }
})
