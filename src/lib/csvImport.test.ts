import { describe, expect, it } from 'vitest';
import { customerRowForInsert, decodeCsv, normalizeCustomerRow, parseCsv } from './csvImport';

describe('customer CSV import', () => {
  it('parses Excel semicolon CSV and accepts incomplete legacy rows', () => {
    const [row] = parseCsv('full_name;phone;email;birth_date;street\r\nMarcelo Marutti;;;;VISEP\r\n');
    expect(normalizeCustomerRow(row)).toMatchObject({
      full_name: 'Marcelo Marutti',
      phone: '',
      email: '',
      birth_date: '',
      street: 'VISEP',
    });
  });

  it('handles quoted separators and Brazilian dates', () => {
    const [row] = parseCsv('nome;telefone;data_nascimento;observacoes\n"Ana; Maria";(19) 99999-0000;08/04/1988;"Cliente, antiga"');
    expect(normalizeCustomerRow(row)).toMatchObject({
      full_name: 'Ana; Maria',
      phone: '(19) 99999-0000',
      birth_date: '1988-04-08',
      notes: 'Cliente, antiga',
    });
  });

  it('falls back to Windows-1252 when UTF-8 decoding is invalid', () => {
    const bytes = Uint8Array.from([0x41, 0x6e, 0x64, 0x72, 0xe9]).buffer;
    expect(decodeCsv(bytes)).toBe('André');
  });

  it('writes empty optional database fields as null', () => {
    expect(customerRowForInsert({ full_name: 'Waldir', phone: '', cpf: '', birth_date: '' })).toEqual({
      full_name: 'Waldir',
      phone: '',
      cpf: null,
      birth_date: null,
    });
  });
});
