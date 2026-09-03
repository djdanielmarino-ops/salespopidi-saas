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
    if (claimError || !claims?.claims?.sub) return json(401, { error: 'Sessão inválida.' })

    const admin = createClient(url, serviceKey)
    const requesterId = String(claims.claims.sub)
    const { data: requester } = await admin.from('user_profiles').select('role,is_active').eq('user_id', requesterId).single()
    if (!requester?.is_active || requester.role !== 'admin') return json(403, { error: 'Apenas administradores podem gerenciar funcionários.' })

    const body = await req.json()
    if (body.action === 'list') {
      const { data, error } = await admin.from('user_profiles').select('*').order('name')
      if (error) throw error
      return json(200, { users: data })
    }

    if (body.action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase()
      const name = String(body.name || '').trim()
      if (!email || !name) return json(400, { error: 'Nome e e-mail são obrigatórios.' })
      let userId: string | null = null
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name } })
      if (error) {
        // Usuário já existe no login: apenas vincula/atualiza o perfil de acesso
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = list?.users?.find((u) => (u.email || '').toLowerCase() === email)
        if (!existing) return json(400, { error: 'Não foi possível convidar este e-mail. Tente novamente.' })
        userId = existing.id
      } else {
        userId = data.user.id
      }
      const { error: upsertError } = await admin.from('user_profiles').upsert({
        user_id: userId,
        email,
        name,
        role: body.role === 'admin' ? 'admin' : 'employee',
        permissions: body.permissions || {},
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (upsertError) throw upsertError
      return json(200, { user_id: userId })
    }


    if (body.action === 'update') {
      const userId = String(body.user_id || '')
      if (!userId) return json(400, { error: 'Funcionário inválido.' })
      if (userId === requesterId && body.is_active === false) return json(400, { error: 'Você não pode desativar seu próprio acesso.' })
      const { error } = await admin.from('user_profiles').update({
        name: String(body.name || '').trim(),
        role: body.role === 'admin' ? 'admin' : 'employee',
        permissions: body.permissions || {},
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      if (error) throw error
      return json(200, { ok: true })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Erro ao gerenciar funcionários.' })
  }
})

