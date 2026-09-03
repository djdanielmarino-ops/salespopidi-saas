import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CylinderStatus } from '@/types/database';
import { toast } from 'sonner';

export interface CylinderModel {
  id: string;
  capacity: number;
  description: string | null;
  created_at: string;
}

export interface CylinderInventory {
  id: string;
  cylinder_model_id: string;
  status: CylinderStatus;
  quantity: number;
  created_at: string;
  updated_at: string;
  cylinder_models?: CylinderModel;
}

// Fetch cylinder models
export function useCylinderModels() {
  return useQuery({
    queryKey: ['cylinder_models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cylinder_models')
        .select('*')
        .order('capacity');
      
      if (error) throw error;
      return data as CylinderModel[];
    },
  });
}

// Fetch all cylinder inventory
export function useCylinderInventory() {
  return useQuery({
    queryKey: ['cylinder_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cylinder_inventory')
        .select('*, cylinder_models(*)')
        .order('cylinder_model_id');
      
      if (error) throw error;
      return data as CylinderInventory[];
    },
  });
}

// Get inventory summary by capacity and status
export function useCylinderSummary() {
  const { data: inventory, ...rest } = useCylinderInventory();
  const { data: models } = useCylinderModels();

  const summary = models?.map(model => {
    const modelInventory = inventory?.filter(i => i.cylinder_model_id === model.id) || [];
    return {
      model,
      cheio: modelInventory.filter(i => i.status === 'cheio').reduce((sum, i) => sum + i.quantity, 0),
      com_cliente: modelInventory.filter(i => i.status === 'com_cliente').reduce((sum, i) => sum + i.quantity, 0),
      vazio: modelInventory.filter(i => i.status === 'vazio').reduce((sum, i) => sum + i.quantity, 0),
    };
  });

  return { data: summary, ...rest };
}

// Update inventory quantity
export function useUpdateCylinderInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cylinderModelId, 
      status, 
      quantityChange 
    }: { 
      cylinderModelId: string; 
      status: CylinderStatus; 
      quantityChange: number;
    }) => {
      // First, try to find existing inventory record
      const { data: existing } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', status)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const newQuantity = Math.max(0, existing.quantity + quantityChange);
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: newQuantity })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else if (quantityChange > 0) {
        // Create new record
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status,
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
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
    },
  });
}

// Add cylinders to stock (cheio increases)
export function useAddCylinders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cylinderModelId, 
      quantity 
    }: { 
      cylinderModelId: string; 
      quantity: number;
    }) => {
      const { data: existing } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'cheio')
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status: 'cheio',
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
      toast.success('Entrada de cilindros registrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar entrada: ' + error.message);
    },
  });
}

// Add empty cylinders directly to stock (vazio increases) — manual entry only
export function useAddEmptyCylinders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cylinderModelId,
      quantity,
    }: {
      cylinderModelId: string;
      quantity: number;
    }) => {
      const { data: existing } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'vazio')
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status: 'vazio',
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
      toast.success('Entrada de cilindros vazios registrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar entrada: ' + error.message);
    },
  });
}

// Refill cylinders (vazio -> cheio)
export function useRefillCylinders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cylinderModelId, 
      quantity 
    }: { 
      cylinderModelId: string; 
      quantity: number;
    }) => {
      // Decrease vazio
      const { data: empty } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'vazio')
        .maybeSingle();

      if (empty) {
        await supabase
          .from('cylinder_inventory')
          .update({ quantity: Math.max(0, empty.quantity - quantity) })
          .eq('id', empty.id);
      }

      // Increase cheio
      const { data: full } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'cheio')
        .maybeSingle();

      if (full) {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: full.quantity + quantity })
          .eq('id', full.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status: 'cheio',
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
      toast.success('Cilindros recarregados!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao recarregar cilindros: ' + error.message);
    },
  });
}

// Deliver cylinders to customer (cheio -1, com_cliente +1)
export function useDeliverCylinderToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cylinderModelId, 
      quantity 
    }: { 
      cylinderModelId: string;
      quantity: number;
    }) => {
      // Decrease cheio (disponível)
      const { data: full } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'cheio')
        .maybeSingle();

      if (full) {
        await supabase
          .from('cylinder_inventory')
          .update({ quantity: Math.max(0, full.quantity - quantity) })
          .eq('id', full.id);
      }

      // Increase com_cliente
      const { data: withCustomer } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'com_cliente')
        .maybeSingle();

      if (withCustomer) {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: withCustomer.quantity + quantity })
          .eq('id', withCustomer.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status: 'com_cliente',
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
    },
  });
}

// Return cylinders from customer (com_cliente -1, cheio +1)
export function useReturnCylinderFromCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      cylinderModelId, 
      quantity 
    }: { 
      cylinderModelId: string;
      quantity: number;
    }) => {
      // Decrease com_cliente
      const { data: withCustomer } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'com_cliente')
        .maybeSingle();

      if (withCustomer) {
        await supabase
          .from('cylinder_inventory')
          .update({ quantity: Math.max(0, withCustomer.quantity - quantity) })
          .eq('id', withCustomer.id);
      }

      // Increase cheio (disponível)
      const { data: full } = await supabase
        .from('cylinder_inventory')
        .select('*')
        .eq('cylinder_model_id', cylinderModelId)
        .eq('status', 'cheio')
        .maybeSingle();

      if (full) {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .update({ quantity: full.quantity + quantity })
          .eq('id', full.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('cylinder_inventory')
          .insert({
            cylinder_model_id: cylinderModelId,
            status: 'cheio',
            quantity,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
    },
  });
}

// Check available stock for a specific capacity
export function useCheckAvailableCylinderStock() {
  const { data: inventory } = useCylinderInventory();
  
  const checkStock = (cylinderModelId: string, quantity: number): boolean => {
    const stock = inventory?.find(
      i => i.cylinder_model_id === cylinderModelId && i.status === 'cheio'
    );
    return (stock?.quantity || 0) >= quantity;
  };

  const getAvailableQuantity = (cylinderModelId: string): number => {
    const stock = inventory?.find(
      i => i.cylinder_model_id === cylinderModelId && i.status === 'cheio'
    );
    return stock?.quantity || 0;
  };

  return { checkStock, getAvailableQuantity };
}
