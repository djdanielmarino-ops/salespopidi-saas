import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarrelStatus } from '@/types/database';
import { toast } from 'sonner';
import { buildBarrelDailySummary, formatBarrelSummaryMessage } from '@/lib/barrelDailySummary';

export interface BarrelModel {
  id: string;
  volume: number;
  description: string | null;
  created_at: string;
}

export interface BarrelInventory {
  id: string;
  barrel_model_id: string;
  status: BarrelStatus;
  beer_type_id: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
  barrel_models?: BarrelModel;
  beer_types?: {
    id: string;
    name: string;
    price_per_liter: number | null;
  };
}

export interface BarrelPatrimonyTarget {
  id: string;
  barrel_model_id: string;
  expected_quantity: number;
  updated_at: string;
}

export interface BarrelInventoryAdjustment {
  id: number;
  barrel_inventory_id: string;
  barrel_model_id: string;
  status: BarrelStatus;
  beer_type_id: string | null;
  quantity_before: number;
  quantity_after: number;
  quantity_delta: number;
  reason_code: string;
  reason: string;
  created_at: string;
  barrel_models?: { volume: number };
  beer_types?: { name: string } | null;
}

async function controlBarrelInventory(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('barrel-inventory-control', { body });
  if (!error) return data;
  let message = error.message;
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: string } | null;
    if (payload?.error) message = payload.error;
  }
  throw new Error(message);
}

// Fetch barrel models
export function useBarrelModels() {
  return useQuery({
    queryKey: ['barrel_models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('barrel_models')
        .select('*')
        .order('volume');
      
      if (error) throw error;
      return data as BarrelModel[];
    },
  });
}

// Fetch all barrel inventory
export function useBarrelInventory() {
  return useQuery({
    queryKey: ['barrel_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('barrel_inventory')
        .select('*, barrel_models(*), beer_types(id, name, price_per_liter)')
        .order('barrel_model_id');
      
      if (error) throw error;
      return data as BarrelInventory[];
    },
  });
}

// Get inventory summary by volume and status
export function useBarrelSummary() {
  const { data: inventory, ...rest } = useBarrelInventory();
  const { data: models } = useBarrelModels();

  const summary = models?.map(model => {
    const modelInventory = inventory?.filter(i => i.barrel_model_id === model.id) || [];
    return {
      model,
      cheio_loja: modelInventory.filter(i => i.status === 'cheio_loja').reduce((sum, i) => sum + i.quantity, 0),
      com_cliente: modelInventory.filter(i => i.status === 'com_cliente').reduce((sum, i) => sum + i.quantity, 0),
      vazio_loja: modelInventory.filter(i => i.status === 'vazio_loja').reduce((sum, i) => sum + i.quantity, 0),
      na_cervejaria: modelInventory.filter(i => i.status === 'na_cervejaria').reduce((sum, i) => sum + i.quantity, 0),
    };
  });

  return { data: summary, ...rest };
}

export function useBarrelPatrimonyTargets() {
  return useQuery({
    queryKey: ['barrel_patrimony_targets'],
    queryFn: async () => {
      // Generated types predate the SaaS inventory-control migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('barrel_patrimony_targets')
        .select('id, barrel_model_id, expected_quantity, updated_at');
      if (error) throw error;
      return data as BarrelPatrimonyTarget[];
    },
  });
}

export function useBarrelInventoryAdjustments() {
  return useQuery({
    queryKey: ['barrel_inventory_adjustments'],
    queryFn: async () => {
      // Generated types predate the SaaS inventory-control migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('barrel_inventory_adjustments')
        .select('*, barrel_models(volume), beer_types(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as BarrelInventoryAdjustment[];
    },
  });
}

export function useSetBarrelPatrimonyTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: { barrelModelId: string; expectedQuantity: number; reason: string }) =>
      controlBarrelInventory({
        action: 'set_target',
        barrel_model_id: values.barrelModelId,
        expected_quantity: values.expectedQuantity,
        reason: values.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_patrimony_targets'] });
      toast.success('Patrimônio de barris atualizado.');
    },
    onError: (error: Error) => toast.error(`Erro ao atualizar patrimônio: ${error.message}`),
  });
}

export function useAdjustBarrelInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: { inventoryId: string; quantityAfter: number; reasonCode: string; reason: string }) =>
      controlBarrelInventory({
        action: 'adjust',
        inventory_id: values.inventoryId,
        quantity_after: values.quantityAfter,
        reason_code: values.reasonCode,
        reason: values.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory_adjustments'] });
      toast.success('Contagem ajustada e registrada no histórico.');
    },
    onError: (error: Error) => toast.error(`Erro ao ajustar contagem: ${error.message}`),
  });
}

// Update inventory quantity
export function useUpdateBarrelInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      barrelModelId, 
      status, 
      beerTypeId, 
      quantityChange 
    }: { 
      barrelModelId: string; 
      status: BarrelStatus; 
      beerTypeId?: string | null; 
      quantityChange: number;
    }) => {
      // First, try to find existing inventory record
      const query = supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', status);
      
      if (beerTypeId) {
        query.eq('beer_type_id', beerTypeId);
      } else {
        query.is('beer_type_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update existing record
        const newQuantity = Math.max(0, existing.quantity + quantityChange);
        const { data, error } = await supabase
          .from('barrel_inventory')
          .update({ quantity: newQuantity })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else if (quantityChange > 0) {
        // Create new record
        const { data, error } = await supabase
          .from('barrel_inventory')
          .insert({
            barrel_model_id: barrelModelId,
            status,
            beer_type_id: beerTypeId || null,
            quantity: quantityChange,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
    },
  });
}

// Receive chopp from brewery (cheio_loja increases, na_cervejaria decreases)
export function useReceiveChoppFromBrewery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      barrelModelId, 
      beerTypeId, 
      quantity 
    }: { 
      barrelModelId: string; 
      beerTypeId: string; 
      quantity: number;
    }) => {
      const { error } = await supabase.rpc('receive_barrels_from_brewery', {
        p_barrel_model_id: barrelModelId,
        p_beer_type_id: beerTypeId,
        p_quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      toast.success('Entrada de chopp registrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar entrada: ' + error.message);
    },
  });
}

// Send empty barrels to brewery
export function useSendToBrewery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      barrelModelId, 
      quantity 
    }: { 
      barrelModelId: string; 
      quantity: number;
    }) => {
      const { error } = await supabase.rpc('send_barrels_to_brewery', {
        p_barrel_model_id: barrelModelId,
        p_quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      toast.success('Barris enviados para cervejaria!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar barris: ' + error.message);
    },
  });
}

// Deliver barrels to customer (cheio_loja -1, com_cliente +1)
export function useDeliverToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      barrelModelId, 
      beerTypeId,
      quantity 
    }: { 
      barrelModelId: string;
      beerTypeId: string;
      quantity: number;
    }) => {
      // Decrease cheio_loja
      const { data: fullInStore, error: fullInStoreError } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'cheio_loja')
        .eq('beer_type_id', beerTypeId)
        .maybeSingle();
      if (fullInStoreError) throw fullInStoreError;
      if (!fullInStore || fullInStore.quantity < quantity) {
        throw new Error(`Estoque insuficiente: existem ${fullInStore?.quantity || 0} barris cheios e a saida solicita ${quantity}.`);
      }

      const { error: deductError } = await supabase
        .from('barrel_inventory')
        .update({ quantity: fullInStore.quantity - quantity })
        .eq('id', fullInStore.id);
      if (deductError) throw deductError;

      // Increase com_cliente
      const { data: withCustomer } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'com_cliente')
        .eq('beer_type_id', beerTypeId)
        .maybeSingle();

      if (withCustomer) {
        const { data, error } = await supabase
          .from('barrel_inventory')
          .update({ quantity: withCustomer.quantity + quantity })
          .eq('id', withCustomer.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('barrel_inventory')
          .insert({
            barrel_model_id: barrelModelId,
            status: 'com_cliente',
            beer_type_id: beerTypeId,
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
    },
  });
}

// Return barrels from customer (com_cliente -1, vazio_loja +1)
export function useReturnFromCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      barrelModelId, 
      beerTypeId,
      quantity 
    }: { 
      barrelModelId: string;
      beerTypeId?: string;
      quantity: number;
    }) => {
      // Decrease com_cliente — fetch ALL matching records (handles duplicates)
      // and deduct across them. If beerTypeId is provided, prefer matching records first,
      // then fall back to other com_cliente records of the same model.
      const { data: withCustomerRecords } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'com_cliente')
        .gt('quantity', 0);

      const sorted = (withCustomerRecords || []).sort((a, b) => {
        if (beerTypeId) {
          const aMatch = a.beer_type_id === beerTypeId ? 0 : 1;
          const bMatch = b.beer_type_id === beerTypeId ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return b.quantity - a.quantity;
      });

      let remainingToDeduct = quantity;
      for (const record of sorted) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(record.quantity, remainingToDeduct);
        await supabase
          .from('barrel_inventory')
          .update({ quantity: Math.max(0, record.quantity - deduct) })
          .eq('id', record.id);
        remainingToDeduct -= deduct;
      }

      // Increase vazio_loja (barrels always return empty, no beer_type)
      const { data: emptyInStore } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'vazio_loja')
        .is('beer_type_id', null)
        .maybeSingle();

      if (emptyInStore) {
        const { data, error } = await supabase
          .from('barrel_inventory')
          .update({ quantity: emptyInStore.quantity + quantity })
          .eq('id', emptyInStore.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('barrel_inventory')
          .insert({
            barrel_model_id: barrelModelId,
            status: 'vazio_loja',
            beer_type_id: null,
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
    },
  });
}

export function useSendDailyBarrelSummary() {
  return useMutation({
    mutationFn: async () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [{ data: movements, error: movementsError }, { data: inventory, error: inventoryError }, { data: models, error: modelsError }] = await Promise.all([
        supabase.from('barrel_brewery_movements').select('barrel_model_id, movement_type, quantity').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('barrel_inventory').select('barrel_model_id, status, quantity').eq('status', 'na_cervejaria'),
        supabase.from('barrel_models').select('id, volume').order('volume'),
      ]);
      if (movementsError) throw movementsError;
      if (inventoryError) throw inventoryError;
      if (modelsError) throw modelsError;

      const rows = buildBarrelDailySummary((models || []).map((model) => ({
        ...model,
        currentBreweryStock: (inventory || [])
          .filter((item) => item.barrel_model_id === model.id)
          .reduce((total, item) => total + item.quantity, 0),
      })), movements || []);
      const payload = {
        event: 'barrel_brewery_daily_summary',
        date: now.toLocaleDateString('en-CA'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        barrels: rows,
        message: formatBarrelSummaryMessage(now, rows),
      };
      const { data, error } = await supabase.functions.invoke('send-barrel-summary', { body: payload });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'O webhook não confirmou o recebimento.');
      return payload;
    },
    onSuccess: () => toast.success('Resumo diário enviado ao WhatsApp!'),
    onError: (error: Error) => toast.error('Erro ao enviar resumo: ' + error.message),
  });
}

// Return consigned full barrels from customer (com_cliente -1, cheio_loja +1)
export function useReturnFullFromCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      barrelModelId,
      beerTypeId,
      quantity,
    }: {
      barrelModelId: string;
      beerTypeId: string;
      quantity: number;
    }) => {
      const { data: withCustomerRecords } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'com_cliente')
        .eq('beer_type_id', beerTypeId)
        .gt('quantity', 0);

      let remainingToDeduct = quantity;
      for (const record of (withCustomerRecords || [])) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(record.quantity, remainingToDeduct);
        await supabase
          .from('barrel_inventory')
          .update({ quantity: Math.max(0, record.quantity - deduct) })
          .eq('id', record.id);
        remainingToDeduct -= deduct;
      }

      const { data: fullInStore, error: fullInStoreError } = await supabase
        .from('barrel_inventory')
        .select('*')
        .eq('barrel_model_id', barrelModelId)
        .eq('status', 'cheio_loja')
        .eq('beer_type_id', beerTypeId)
        .maybeSingle();
      if (fullInStoreError) throw fullInStoreError;

      if (fullInStore) {
        const { data, error } = await supabase
          .from('barrel_inventory')
          .update({ quantity: fullInStore.quantity + quantity })
          .eq('id', fullInStore.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('barrel_inventory')
        .insert({
          barrel_model_id: barrelModelId,
          status: 'cheio_loja',
          beer_type_id: beerTypeId,
          quantity,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
    },
  });
}

// Check available stock for a specific volume and beer type
export function useCheckAvailableStock() {
  const { data: inventory } = useBarrelInventory();
  
  const checkStock = (barrelModelId: string, beerTypeId: string, quantity: number): boolean => {
    const stock = inventory?.find(
      i => i.barrel_model_id === barrelModelId && 
           i.status === 'cheio_loja' && 
           i.beer_type_id === beerTypeId
    );
    return (stock?.quantity || 0) >= quantity;
  };

  const getAvailableQuantity = (barrelModelId: string, beerTypeId: string): number => {
    const stock = inventory?.find(
      i => i.barrel_model_id === barrelModelId && 
           i.status === 'cheio_loja' && 
           i.beer_type_id === beerTypeId
    );
    return stock?.quantity || 0;
  };

  return { checkStock, getAvailableQuantity };
}
