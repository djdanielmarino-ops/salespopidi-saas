import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/database';
import { toast } from 'sonner';

const db = supabase as any;

export function useProducts(activeOnly = false) {
  return useQuery({
    queryKey: ['products', activeOnly],
    queryFn: async () => {
      let query = db.from('products').select('*').order('name');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProductReservations() {
  return useQuery({
    queryKey: ['product-reservations'],
    queryFn: async () => {
      const { data, error } = await db
        .from('order_product_items')
        .select('product_id, quantity, orders!inner(status)')
        .is('stock_moved_at', null)
        .eq('orders.status', 'agendado');
      if (error) throw error;
      return (data || []).reduce((result: Record<string, number>, item: any) => {
        result[item.product_id] = (result[item.product_id] || 0) + Number(item.quantity);
        return result;
      }, {});
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'stock_quantity'> & { initial_stock: number }) => {
      const { initial_stock, ...values } = product;
      const { data, error } = await db.from('products').insert({ ...values, stock_quantity: 0 }).select('*').single();
      if (error) throw error;
      if (values.track_stock && initial_stock > 0) {
        const { error: stockError } = await db.rpc('adjust_product_stock', { p_product_id: data.id, p_quantity: initial_stock, p_notes: 'Estoque inicial' });
        if (stockError) throw stockError;
      }
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast.success('Produto cadastrado.'); },
    onError: (error: Error) => toast.error(`Erro ao cadastrar produto: ${error.message}`),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Product> & { id: string }) => {
      const { data, error } = await db.from('products').update(values).eq('id', id).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast.success('Produto atualizado.'); },
    onError: (error: Error) => toast.error(`Erro ao atualizar produto: ${error.message}`),
  });
}

export function useAdjustProductStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, quantity, notes }: { productId: string; quantity: number; notes?: string }) => {
      const { error } = await db.rpc('adjust_product_stock', { p_product_id: productId, p_quantity: quantity, p_notes: notes || null });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast.success('Estoque atualizado.'); },
    onError: (error: Error) => toast.error(`Erro no ajuste: ${error.message}`),
  });
}
