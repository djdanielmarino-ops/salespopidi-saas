import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type PlatformRole = 'platform_owner' | 'platform_support' | 'platform_finance' | 'platform_viewer';

export function usePlatformAccess() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ['platform-access', user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      // The generated types predate the SaaS control-plane migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('platform_admins')
        .select('role, is_active')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { role: PlatformRole; is_active: boolean } | null;
    },
  });

  return {
    ...query,
    access: query.data ?? null,
    isPlatformOwner: query.data?.is_active === true && query.data.role === 'platform_owner',
    loading: authLoading || query.isLoading,
  };
}

