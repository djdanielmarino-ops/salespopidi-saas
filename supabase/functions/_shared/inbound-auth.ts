type AdminClient = {
  from: (table: string) => any
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let value = 0
  for (let index = 0; index < a.length; index += 1) value |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return value === 0
}

export async function authenticateInbound(
  req: Request,
  admin: AdminClient,
  endpointKey: string,
  organizationId: unknown,
) {
  const orgId = String(organizationId || '')
  if (!uuid.test(orgId)) return { error: 'organization_id inválido.', status: 400 } as const

  const provided = req.headers.get('x-api-key') || req.headers.get('X-API-Key') || ''
  if (!provided) return { error: 'Chave de integração não informada.', status: 401 } as const

  const { data: endpoint, error } = await admin.from('webhook_endpoints')
    .select('secret_ref')
    .eq('organization_id', orgId)
    .eq('endpoint_key', endpointKey)
    .eq('environment', 'production')
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!endpoint?.secret_ref?.startsWith('sha256:')) {
    return { error: 'Integração de entrada não configurada para esta empresa.', status: 503 } as const
  }

  const actualHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(provided)))
  const expectedHash = endpoint.secret_ref.slice('sha256:'.length)
  if (!secureEqual(actualHash, expectedHash)) return { error: 'Chave de integração inválida.', status: 401 } as const
  return { organizationId: orgId } as const
}
