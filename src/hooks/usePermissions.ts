import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const ACCESS_MODULES = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'orders', label: 'Pedidos', path: '/orders' },
  { key: 'customers', label: 'Clientes', path: '/customers' },
  { key: 'inventory', label: 'Estoque', path: '/inventory' },
  { key: 'taps', label: 'Chopeiras', path: '/taps' },
  { key: 'barrels', label: 'Barris', path: '/barrels' },
  { key: 'cylinders', label: 'Cilindros', path: '/cylinders' },
  { key: 'financial', label: 'Financeiro', path: '/financial' },
  { key: 'costs', label: 'Custos', path: '/costs' },
  { key: 'crm', label: 'CRM Inteligente', path: '/crm' },
  { key: 'settings', label: 'Configurações', path: '/settings' },
] as const;

export type AccessLevel = 'none' | 'view' | 'manage';
export type UserPermissions = Record<string, AccessLevel>;

export interface UserProfile {
  user_id: string;
  name: string | null;
  email: string;
  role: 'admin' | 'employee';
  is_active: boolean;
  permissions: UserPermissions;
}

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ['user-profile', user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UserProfile) ?? null;
    },
  });


  const can = (module: string, action: 'view' | 'manage' = 'view') => {
    if (query.data?.role === 'admin') return true;
    const level = query.data?.permissions?.[module] || 'none';
    return action === 'view' ? level === 'view' || level === 'manage' : level === 'manage';
  };

  return { ...query, profile: query.data, can, loading: authLoading || query.isLoading };
}

