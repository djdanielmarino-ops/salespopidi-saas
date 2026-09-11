import { describe, expect, it } from 'vitest';
import { validateCustomer } from '../../supabase/functions/onboarding-imports/customer';

const base = { nome: 'Cliente Exemplo', telefone: '(11) 99999-9999' };

describe('validação de clientes na importação inicial', () => {
  it('preserva os dados completos e normaliza data, CEP e UF', () => {
    const result = validateCustomer({ ...base, rg: '12.345.678-X', data_nascimento: '29/02/2000', cep: '01310-100', endereco: 'Av. Paulista', numero: '1000', complemento: 'Apto 101', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'sp' });
    expect(result.errors).toEqual([]);
    expect(result.normalized).toMatchObject({ rg: '12.345.678-X', birth_date: '2000-02-29', zip_code: '01310100', street: 'Av. Paulista', number: '1000', complement: 'Apto 101', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
  });

  it('continua aceitando arquivos antigos sem os campos opcionais', () => {
    const result = validateCustomer(base);
    expect(result.errors).toEqual([]);
    expect(result.normalized.birth_date).toBe('');
    expect(result.normalized.street).toBe('');
  });

  it.each(['31/02/2000', '29/02/2001', '2000-13-01', '15-01-1990'])('rejeita nascimento inválido: %s', (data_nascimento) => {
    expect(validateCustomer({ ...base, data_nascimento }).errors).toContain('Data de nascimento inválida. Use DD/MM/AAAA ou AAAA-MM-DD.');
  });

  it('aceita data ISO e rejeita CEP e UF inválidos', () => {
    expect(validateCustomer({ ...base, data_nascimento: '1990-01-15' }).errors).toEqual([]);
    expect(validateCustomer({ ...base, cep: '123', estado: 'XX' }).errors).toHaveLength(2);
  });
});
