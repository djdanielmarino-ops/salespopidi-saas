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

const organizationTypes = new Set(['store', 'distributor', 'brewery', 'hybrid'])
const organizationStatuses = new Set(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'security_blocked'])
const allowedModules = new Set([
  'customers', 'orders', 'inventory', 'products', 'taps', 'barrels', 'brewery_orders',
  'cylinders', 'financial', 'costs', 'crm', 'settings',
])

type AdminClient = ReturnType<typeof createClient>

async function findUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 100) return null
  }
  throw new Error('Limite de usuários excedido durante a busca do proprietário.')
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

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: access } = await admin
      .from('platform_admins')
      .select('role,is_active')
      .eq('user_id', requesterId)
      .maybeSingle()
    if (!access?.is_active || access.role !== 'platform_owner') {
      return json(403, { error: 'Apenas o proprietário da plataforma pode executar esta ação.' })
    }

    const body = await req.json()

    if (body.action === 'onboard') {
      const legalName = String(body.legal_name || '').trim()
      const tradeName = String(body.trade_name || '').trim()
      const slug = String(body.slug || '').trim().toLowerCase()
      const ownerEmail = String(body.owner_email || '').trim().toLowerCase()
      const organizationType = String(body.organization_type || '')
      const modules = Array.isArray(body.modules)
        ? [...new Set(body.modules.map(String).filter((module) => allowedModules.has(module)))]
        : []

      if (legalName.length < 2 || legalName.length > 160) return json(400, { error: 'Razão social inválida.' })
      if (tradeName.length > 160) return json(400, { error: 'Nome fantasia inválido.' })
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 63) return json(400, { error: 'Subdomínio inválido.' })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return json(400, { error: 'E-mail do proprietário inválido.' })
      if (!organizationTypes.has(organizationType)) return json(400, { error: 'Tipo de organização inválido.' })
      if (modules.length === 0) return json(400, { error: 'Selecione ao menos um módulo.' })

      const { data: existingOrganization, error: slugError } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (slugError) throw slugError
      if (existingOrganization) return json(409, { error: 'Este subdomínio já está em uso.' })

      let owner = await findUserByEmail(admin, ownerEmail)
      let invited = false
      if (!owner) {
        const baseDomain = Deno.env.get('APP_BASE_DOMAIN') || 'app.popidichopp.online'
        const { data, error } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
          redirectTo: `https://${slug}.${baseDomain}/reset-password`,
          data: { organization_slug: slug },
        })
        if (error) throw error
        owner = data.user
        invited = true
      }

      const { data, error } = await admin.rpc('master_onboard_organization', {
        p_actor_user_id: requesterId,
        p_owner_user_id: owner.id,
        p_owner_status: invited ? 'invited' : 'active',
        p_legal_name: legalName,
        p_trade_name: tradeName,
        p_slug: slug,
        p_organization_type: organizationType,
        p_module_keys: modules,
      })
      if (error) {
        if (invited) await admin.auth.admin.deleteUser(owner.id)
        throw error
      }
      return json(200, { organization: data, owner_invited: invited })
    }

    if (body.action === 'update_status') {
      const organizationId = String(body.organization_id || '')
      const status = String(body.status || '')
      if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return json(400, { error: 'Organização inválida.' })
      if (!organizationStatuses.has(status)) return json(400, { error: 'Status inválido.' })
      const { data, error } = await admin.rpc('master_update_organization_status', {
        p_actor_user_id: requesterId,
        p_organization_id: organizationId,
        p_status: status,
      })
      if (error) throw error
      return json(200, { organization: data })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerenciar organizações.'
    return json(message.includes('duplicate key') ? 409 : 400, { error: message })
  }
})
