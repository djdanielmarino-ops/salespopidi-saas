import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ success: false, error: 'Method not allowed' }, 405)
  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) return respond({ success: false, error: 'Missing authorization' }, 401)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return respond({ success: false, error: 'Unauthorized' }, 401)

    const payload = await req.json()
    if (!payload?.date || !Array.isArray(payload?.barrels) || !payload?.message) {
      return respond({ success: false, error: 'Invalid summary payload' }, 400)
    }

    const result = await fetch('https://n8n.popidichopp.online/webhook/controlebarrischopp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, sentBy: user.id }),
    })
    if (!result.ok) {
      return respond({ success: false, error: 'Webhook rejected the summary', status: result.status, detail: (await result.text()).slice(0, 500) }, 502)
    }
    return respond({ success: true, status: result.status }, 200)
  } catch (error) {
    return respond({ success: false, error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
