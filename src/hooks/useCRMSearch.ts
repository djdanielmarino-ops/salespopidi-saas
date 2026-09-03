import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/database';

const RESULT_LIMIT = 20;

/** Debounce genérico. */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Mantém apenas dígitos. */
const onlyDigits = (s: string) => s.replace(/\D+/g, '');

/**
 * Decide se um termo tem o mínimo necessário para disparar busca.
 * - CPF/telefone (>=4 dígitos) já busca; caso contrário exige 3+ chars.
 */
export function shouldSearch(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const digits = onlyDigits(trimmed);
  if (digits.length >= 4) return true;
  return trimmed.length >= 3;
}

/**
 * Busca clientes por nome, email, CPF, CNPJ ou telefone.
 * Normaliza dígitos para CPF/CNPJ/telefone, mas não altera dados armazenados.
 */
export function useCRMCustomerSearch(term: string) {
  const debounced = useDebouncedValue(term, 400);
  const enabled = shouldSearch(debounced);

  return useQuery({
    queryKey: ['crm-search', debounced],
    enabled,
    queryFn: async () => {
      const raw = debounced.trim();
      const digits = onlyDigits(raw);
      const likeText = `%${raw}%`;
      const likeDigits = digits ? `%${digits}%` : null;

      const orParts: string[] = [
        `full_name.ilike.${likeText}`,
        `email.ilike.${likeText}`,
        `company_name.ilike.${likeText}`,
        `trade_name.ilike.${likeText}`,
      ];
      if (likeDigits) {
        orParts.push(`cpf.ilike.${likeDigits}`);
        orParts.push(`cnpj.ilike.${likeDigits}`);
        orParts.push(`phone.ilike.${likeDigits}`);
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(orParts.join(','))
        .order('full_name')
        .limit(RESULT_LIMIT);

      if (error) {
        if (import.meta.env.DEV) console.error('[CRM] search error', error);
        throw new Error('Não foi possível buscar clientes agora.');
      }
      return (data ?? []) as Customer[];
    },
  });
}
