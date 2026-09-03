import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tap, TapType, Cylinder, BeerType } from '@/types/database';
import { toast } from 'sonner';
import { filterTapsAvailableForPeriod } from '@/lib/tapAvailability';

// Tap Types
export function useTapTypes() {
  return useQuery({
    queryKey: ['tap_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tap_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as TapType[];
    },
  });
}

// Taps
export function useTaps() {
  return useQuery({
    queryKey: ['taps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taps')
        .select('*, tap_types(*)')
        .order('code');
      
      if (error) throw error;
      return data as Tap[];
    },
  });
}

export function useAvailableTaps() {
  return useQuery({
    queryKey: ['taps', 'available'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taps')
        .select('*, tap_types(*)')
        .eq('status', 'disponivel')
        .order('code');
      
      if (error) throw error;
      return data as Tap[];
    },
  });
}

export function useAvailableTapsForPeriod(
  startDate?: string,
  endDate?: string | null,
  excludeOrderId?: string,
) {
  return useQuery({
    queryKey: ['taps', 'available-for-period', startDate, endDate, excludeOrderId],
    queryFn: async () => {
      const [{ data: taps, error: tapsError }, { data: reservations, error: reservationsError }] = await Promise.all([
        supabase
          .from('taps')
          .select('*, tap_types(*)')
          .neq('status', 'manutencao')
          .order('code'),
        supabase
          .from('orders')
          .select('id, tap_id, delivery_date, expected_return_date, status')
          .not('tap_id', 'is', null)
          .in('status', ['agendado', 'em_andamento']),
      ]);

      if (tapsError) throw tapsError;
      if (reservationsError) throw reservationsError;

      return filterTapsAvailableForPeriod(
        (taps || []) as Tap[],
        reservations || [],
        startDate,
        endDate,
        excludeOrderId,
      );
    },
  });
}

export function useCreateTap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tap: { code: string; tap_type_id: string | null; notes?: string }) => {
      const { data, error } = await supabase
        .from('taps')
        .insert(tap)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      toast.success('Chopeira cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar chopeira: ' + error.message);
    },
  });
}

export function useUpdateTap() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...tap }: Partial<Tap> & { id: string }) => {
      const { data, error } = await supabase
        .from('taps')
        .update(tap)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      toast.success('Chopeira atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar chopeira: ' + error.message);
    },
  });
}

// Beer Types
export function useBeerTypes() {
  return useQuery({
    queryKey: ['beer_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beer_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as BeerType[];
    },
  });
}

export function useCreateBeerType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (beerType: { name: string; description?: string; price_per_liter?: number; code?: string }) => {
      const { data, error } = await supabase
        .from('beer_types')
        .insert(beerType)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beer_types'] });
      toast.success('Tipo de chopp cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar tipo de chopp: ' + error.message);
    },
  });
}

// Cylinders
export function useCylinders() {
  return useQuery({
    queryKey: ['cylinders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cylinders')
        .select('*')
        .order('code');
      
      if (error) throw error;
      return data as Cylinder[];
    },
  });
}

export function useAvailableCylinders() {
  return useQuery({
    queryKey: ['cylinders', 'available'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cylinders')
        .select('*')
        .eq('status', 'cheio')
        .order('code');
      
      if (error) throw error;
      return data as Cylinder[];
    },
  });
}

export function useCreateCylinder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cylinder: { code: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('cylinders')
        .insert(cylinder)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      toast.success('Cilindro cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar cilindro: ' + error.message);
    },
  });
}

export function useUpdateCylinder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...cylinder }: Partial<Cylinder> & { id: string }) => {
      const { data, error } = await supabase
        .from('cylinders')
        .update(cylinder)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      toast.success('Cilindro atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar cilindro: ' + error.message);
    },
  });
}
