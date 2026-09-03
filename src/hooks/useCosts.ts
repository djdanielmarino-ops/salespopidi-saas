import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BeerCostHistory, CostCategory, CostEntry } from '@/types/database';
import { toast } from 'sonner';

export function useCostCategories() {
  return useQuery({
    queryKey: ['cost_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as CostCategory[];
    },
  });
}

export function useCostEntries(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['cost_entries', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('cost_entries')
        .select('*, cost_categories(*)')
        .order('cost_date', { ascending: false })
        .limit(200);

      if (startDate) query = query.gte('cost_date', startDate);
      if (endDate) query = query.lte('cost_date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as CostEntry[];
    },
  });
}

export function useCreateCostEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: {
      category_id?: string | null;
      cost_date: string;
      description: string;
      supplier?: string | null;
      amount: number;
      notes?: string | null;
      is_recurring?: boolean;
      payment_status: 'pending' | 'paid';
      due_date?: string | null;
      paid_date?: string | null;
      account_id?: string | null;
      payment_method_config_id?: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('create_cost_entry_with_payment', {
        p_category_id: entry.category_id || null, p_cost_date: entry.cost_date,
        p_description: entry.description, p_supplier: entry.supplier || null, p_amount: entry.amount,
        p_notes: entry.notes || null, p_is_recurring: entry.is_recurring || false,
        p_payment_status: entry.payment_status, p_due_date: entry.due_date || null,
        p_paid_date: entry.paid_date || null, p_account_id: entry.account_id || null,
        p_method_config_id: entry.payment_method_config_id || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      queryClient.invalidateQueries({ queryKey: ['financial-ledger'] });
      toast.success('Custo registrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar custo: ' + error.message);
    },
  });
}

export function useDeleteCostEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_entries'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      toast.success('Custo removido.');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover custo: ' + error.message);
    },
  });
}

export function useBeerCostHistory() {
  return useQuery({
    queryKey: ['beer_cost_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beer_cost_history')
        .select('*, beer_types(*)')
        .order('valid_from', { ascending: false });

      if (error) throw error;
      return data as BeerCostHistory[];
    },
  });
}

export function useCreateBeerCostHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cost: {
      beer_type_id: string;
      cost_per_liter: number;
      valid_from: string;
      valid_to?: string | null;
      supplier?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('beer_cost_history')
        .insert(cost)
        .select()
        .single();

      if (error) throw error;

      const { error: beerError } = await supabase
        .from('beer_types')
        .update({ cost_per_liter: cost.cost_per_liter })
        .eq('id', cost.beer_type_id);

      if (beerError) throw beerError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beer_cost_history'] });
      queryClient.invalidateQueries({ queryKey: ['beer_types'] });
      toast.success('Histórico de custo salvo!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar custo do chopp: ' + error.message);
    },
  });
}
