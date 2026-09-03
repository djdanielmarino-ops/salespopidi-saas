import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinancialAccount, FinancialTransaction, PaymentMethodConfig } from '@/types/database';
import { toast } from 'sonner';

// Generated Supabase types are updated after the migration is applied remotely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function calculatePaymentAmounts(amount: number, method?: Pick<PaymentMethodConfig, 'fee_percentage' | 'fee_fixed' | 'fee_payer'>) {
  const calculatedFee = method ? Math.round((amount * Number(method.fee_percentage) / 100 + Number(method.fee_fixed)) * 100) / 100 : 0;
  const deductedFee = method?.fee_payer === 'company' ? Math.min(amount, calculatedFee) : 0;
  return { calculatedFee, deductedFee, netAmount: amount - deductedFee };
}

export function useFinancialAccounts(activeOnly = true) {
  return useQuery({
    queryKey: ['financial-accounts', activeOnly],
    queryFn: async () => {
      let query = db.from('financial_accounts').select('*').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialAccount[];
    },
  });
}

export function usePaymentMethodConfigs(activeOnly = true) {
  return useQuery({
    queryKey: ['payment-method-configs', activeOnly],
    queryFn: async () => {
      let query = db.from('payment_method_configs').select('*, financial_accounts(*)').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentMethodConfig[];
    },
  });
}

export function useCreateFinancialAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (account: Omit<FinancialAccount, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await db.from('financial_accounts').insert(account).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['financial-accounts'] }); toast.success('Conta financeira cadastrada!'); },
    onError: (e: Error) => toast.error(`Erro ao cadastrar conta: ${e.message}`),
  });
}

export function useCreatePaymentMethodConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (method: Omit<PaymentMethodConfig, 'id' | 'financial_accounts'>) => {
      const { data, error } = await db.from('payment_method_configs').insert(method).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['payment-method-configs'] }); toast.success('Forma de pagamento cadastrada!'); },
    onError: (e: Error) => toast.error(`Erro ao cadastrar forma: ${e.message}`),
  });
}

export function useAccountLedger(endDate?: string) {
  return useQuery({
    queryKey: ['financial-ledger', endDate],
    queryFn: async () => {
      let query = db.from('financial_transactions').select('*, financial_accounts(*)').neq('status', 'cancelled').order('effective_date', { ascending: false }).order('created_at', { ascending: false });
      if (endDate) query = query.lte('effective_date', endDate);
      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialTransaction[];
    },
  });
}

export function useTransferBetweenAccounts() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (params: { fromAccount: string; toAccount: string; amount: number; date: string; description: string }) => {
      const { error } = await db.rpc('transfer_between_accounts', {
        p_from_account: params.fromAccount, p_to_account: params.toAccount, p_amount: params.amount,
        p_date: params.date, p_description: params.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['financial-ledger'] }); toast.success('Transferência registrada!'); },
    onError: (e: Error) => toast.error(`Erro na transferência: ${e.message}`),
  });
}
