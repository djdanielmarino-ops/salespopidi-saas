import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/types/database';
import { toast } from 'sonner';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });
}

export function useCheckDuplicateCustomer() {
  return async (
    cpf: string | null,
    rg: string | null,
    email: string | null,
    phone: string,
    cnpj: string | null,
    excludeId?: string
  ): Promise<{ field: string; message: string } | null> => {
    if (cpf) {
      const { data: cpfData } = await supabase
        .from('customers')
        .select('id')
        .eq('cpf', cpf)
        .maybeSingle();
      if (cpfData && cpfData.id !== excludeId) {
        return { field: 'cpf', message: 'CPF já cadastrado no sistema' };
      }
    }

    if (cnpj) {
      const { data: cnpjData } = await supabase
        .from('customers')
        .select('id')
        .eq('cnpj', cnpj)
        .maybeSingle();
      if (cnpjData && cnpjData.id !== excludeId) {
        return { field: 'cnpj', message: 'CNPJ já cadastrado no sistema' };
      }
    }

    if (rg) {
      const { data: rgData } = await supabase
        .from('customers')
        .select('id')
        .eq('rg', rg)
        .maybeSingle();
      if (rgData && rgData.id !== excludeId) {
        return { field: 'rg', message: 'RG já cadastrado no sistema' };
      }
    }

    if (email) {
      const { data: emailData } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (emailData && emailData.id !== excludeId) {
        return { field: 'email', message: 'E-mail já cadastrado no sistema' };
      }
    }

    if (phone) {
      const { data: phoneData } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (phoneData && phoneData.id !== excludeId) {
        return { field: 'phone', message: 'Telefone já cadastrado no sistema' };
      }
    }

    return null;
  };
}

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar cliente: ' + error.message);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente removido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover cliente: ' + error.message);
    },
  });
}
