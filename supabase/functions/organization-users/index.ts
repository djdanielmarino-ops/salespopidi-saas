import { createClient, type User } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

type AdminClient = ReturnType<typeof createClient>

async function findUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 100) return null
  }
  throw new Error('Limite de usuários excedido durante a busca.')
}

async function listAuthUsers(admin: AdminClient) {
  const users: User[] = []
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 100) break
  }
  return users
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
    const [{ data: membership }, { data: platformAccess }] = await Promise.all([
      admin.from('organization_members').select('role,status').eq('organization_id', organizationId).eq('user_id', requesterId).maybeSingle(),
      admin.from('platform_admins').select('role,is_active').eq('user_id', requesterId).maybeSingle(),
    ])
    const canManage = membership?.status === 'active' && ['organization_owner', 'organization_admin'].includes(membership.role)
    const isPlatformOwner = platformAccess?.is_active && platformAccess.role === 'platform_owner'
    if (!canManage && !isPlatformOwner) return json(403, { error: 'Sem permissão para gerenciar funcionários.' })

    if (body.action === 'list') {
      const { data: members, error } = await admin
        .from('organization_members')
        .select('user_id,role,status,permissions')
        .eq('organization_id', organizationId)
        .order('created_at')
      if (error) throw error
      const authUsers = await listAuthUsers(admin)
      const byId = new Map(authUsers.map((user) => [user.id, user]))
      return json(200, { users: members.map((member) => {
        const user = byId.get(member.user_id)
        return {
          user_id: member.user_id,
          name: typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : null,
          email: user?.email || 'E-mail indisponível',
          role: ['organization_owner', 'organization_admin'].includes(member.role) ? 'admin' : 'employee',
          organization_role: member.role,
          is_active: member.status === 'active',
          permissions: member.permissions || {},
        }
      }) })
    }

    if (body.action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase()
      const name = String(body.name || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) {
        return json(400, { error: 'Nome e e-mail válidos são obrigatórios.' })
      }
      let user = await findUserByEmail(admin, email)
      let invited = false
      if (!user) {
        const { data: organization } = await admin.from('organizations').select('slug').eq('id', organizationId).single()
        const baseDomain = Deno.env.get('APP_BASE_DOMAIN') || 'app.popidichopp.online'
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `https://${organization?.slug}.${baseDomain}/reset-password`,
          data: { name },
        })
        if (error) throw error
        user = data.user
        invited = true
      }
      const { error } = await admin.from('organization_members').upsert({
        organization_id: organizationId,
        user_id: user.id,
        role: body.role === 'admin' ? 'organization_admin' : 'operator',
        status: 'active',
        permissions: body.permissions || {},
        invited_by: requesterId,
        joined_at: invited ? null : new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' })
      if (error) {
        if (invited) await admin.auth.admin.deleteUser(user.id)
        throw error
      }
      return json(200, { user_id: user.id, invited })
    }

    if (body.action === 'update') {
      const userId = String(body.user_id || '')
      if (userId === requesterId && body.is_active === false) return json(400, { error: 'Você não pode desativar seu próprio acesso.' })
      const { data: target } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle()
      if (!target) return json(404, { error: 'Funcionário não encontrado.' })
      if (target.role === 'organization_owner' && !isPlatformOwner) return json(403, { error: 'O proprietário da organização não pode ser alterado aqui.' })
      const { error } = await admin.from('organization_members').update({
        role: body.role === 'admin' ? 'organization_admin' : 'operator',
        status: body.is_active === false ? 'suspended' : 'active',
        permissions: body.permissions || {},
      }).eq('organization_id', organizationId).eq('user_id', userId)
      if (error) throw error
      return json(200, { ok: true })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Erro ao gerenciar funcionários.' })
  }
})
