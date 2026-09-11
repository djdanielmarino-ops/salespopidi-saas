type Row = Record<string, unknown>
const text = (value: unknown) => String(value ?? '').trim()
const digits = (value: unknown) => text(value).replace(/\D/g, '')
const isoDate = (value: unknown) => {
  const raw = text(value)
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  return br ? br[3] + '-' + br[2] + '-' + br[1] : /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

export function validateCustomer(row: Row) {
  const errors: string[] = []
  const document = digits(row.cpf_cnpj)
  const kind = text(row.tipo_pessoa).toUpperCase()
  const personType = kind === 'PJ' || document.length === 14 ? 'company' : 'individual'
  const fullName = text(row.nome)
  const phone = digits(row.telefone)
  if (!fullName) errors.push('Nome é obrigatório.')
  if (phone.length < 10) errors.push('Telefone deve conter DDD.')
  if (document && ![11, 14].includes(document.length)) errors.push('CPF/CNPJ inválido.')
  const email = text(row.email).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('E-mail inválido.')
  const birthInput = text(row.data_nascimento)
  const birthDate = birthInput ? isoDate(birthInput) : ''
  const parsedBirth = new Date(`${birthDate}T00:00:00Z`)
  if (birthInput && (!birthDate || !Number.isFinite(parsedBirth.getTime()) || parsedBirth.toISOString().slice(0, 10) !== birthDate)) errors.push('Data de nascimento inválida. Use DD/MM/AAAA ou AAAA-MM-DD.')
  const zipCode = digits(row.cep)
  if (text(row.cep) && zipCode.length !== 8) errors.push('CEP deve conter 8 dígitos.')
  const state = text(row.estado).toUpperCase()
  if (state && !['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].includes(state)) errors.push('Estado deve ser uma sigla de UF válida, como SP.')
  return { errors, normalized: {
    person_type: personType, full_name: fullName, phone, email,
    cpf: document.length === 11 ? document : '', cnpj: document.length === 14 ? document : '',
    company_name: text(row.razao_social), trade_name: text(row.nome_fantasia), notes: text(row.observacoes),
    rg: text(row.rg), birth_date: birthDate, zip_code: zipCode,
    street: text(row.endereco), number: text(row.numero), complement: text(row.complemento),
    neighborhood: text(row.bairro), city: text(row.cidade), state,
  } }
}

