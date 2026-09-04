export type CsvRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string> = {
  nome: 'full_name',
  telefone: 'phone',
  celular: 'phone',
  cpf_cnpj: 'cpf',
  data_nascimento: 'birth_date',
  nascimento: 'birth_date',
  cep: 'zip_code',
  endereco: 'street',
  numero: 'number',
  bairro: 'neighborhood',
  cidade: 'city',
  estado: 'state',
  observacoes: 'notes',
};

function sanitizeCell(value: string): string {
  const trimmed = value.trim();
  return /^[=+@\t\r]/.test(trimmed) ? trimmed.replace(/^[=+@\t\r]+/, '') : trimmed;
}

function normalizeHeader(value: string): string {
  const header = value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return HEADER_ALIASES[header] ?? header;
}

export function decodeCsv(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
}

export function parseCsv(source: string): CsvRow[] {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      record.push(sanitizeCell(field));
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      record.push(sanitizeCell(field));
      field = '';
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('Há aspas abertas no arquivo CSV.');
  record.push(sanitizeCell(field));
  if (record.some(Boolean)) records.push(record);

  const headers = (records.shift() ?? []).map(normalizeHeader);
  if (!headers.length) return [];
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function normalizeCustomerRow(row: CsvRow): CsvRow {
  const birthDate = row.birth_date?.trim() ?? '';
  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthDate);
  const normalizedDate = brDate ? `${brDate[3]}-${brDate[2]}-${brDate[1]}` : birthDate;

  return {
    ...row,
    full_name: row.full_name?.trim() ?? '',
    phone: row.phone?.trim() ?? '',
    email: row.email?.trim().toLowerCase() ?? '',
    cpf: row.cpf?.replace(/\D/g, '') ?? '',
    rg: row.rg?.replace(/[^0-9xX]/g, '') ?? '',
    birth_date: normalizedDate,
    zip_code: row.zip_code?.replace(/\D/g, '') ?? '',
    state: row.state?.trim().toUpperCase() ?? '',
  };
}

export function customerRowForInsert(row: CsvRow): Record<string, string | null> {
  const nullableFields = new Set([
    'email', 'cpf', 'rg', 'birth_date', 'zip_code', 'street', 'number',
    'complement', 'neighborhood', 'city', 'state', 'notes',
  ]);
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, nullableFields.has(key) && value === '' ? null : value]),
  );
}
