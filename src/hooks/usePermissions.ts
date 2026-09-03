import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { usePlatformAccess } from '@/hooks/usePlatformAccess';

export const ACCESS_MODULES = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'orders', label: 'Pedidos', path: '/orders' },
  { key: 'customers', label: 'Clientes', path: '/customers' },
  { key: 'inventory', label: 'Estoque', path: '/inventory' },
  { key: 'taps', label: 'Chopeiras', path: '/taps' },
  { key: 'barrels', label: 'Barris', path: '/barrels' },
  { key: 'barrel_adjustments', label: 'Ajustes sensíveis de barris', path: '/barrels' },
  { key: 'purchases', label: 'Compras / Fornecedores', path: '/brewery-orders' },
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

type OrganizationMembership = {
  role: 'organization_owner' | 'organization_admin' | 'manager' | 'operator' | 'sales' | 'finance' | 'viewer';
  status: 'invited' | 'active' | 'suspended' | 'revoked';
  permissions: UserPermissions | null;
};

const FULL_ACCESS_ORGANIZATION_ROLES = new Set(['organization_owner', 'organization_admin']);

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const { organization } = useTenant();
  const { access: platformAccess, loading: platformLoading } = usePlatformAccess();
  const query = useQuery({
    queryKey: ['user-access', user?.id, organization?.id],
    enabled: !!user && !!organization,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      // The generated client types predate the SaaS control-plane migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [legacyResult, membershipResult] = await Promise.all([
        db.from('user_profiles').select('*').eq('user_id', user!.id).maybeSingle(),
        db
          .from('organization_members')
          .select('role, status, permissions')
          .eq('user_id', user!.id)
          .eq('organization_id', organization!.id)
          .maybeSingle(),
      ]);

      if (membershipResult.error) throw membershipResult.error;

      return {
        legacyProfile: legacyResult.error ? null : (legacyResult.data as UserProfile | null),
        membership: membershipResult.data as OrganizationMembership | null,
      };
    },
  });

  const membership = query.data?.membership;
  const hasPlatformAccess = platformAccess?.is_active === true;
  const hasOrganizationFullAccess = membership?.status === 'active'
    && FULL_ACCESS_ORGANIZATION_ROLES.has(membership.role);
  const hasFullAccess = hasPlatformAccess || hasOrganizationFullAccess;
  const membershipPermissions = membership?.permissions ?? {};
  const legacyProfile = query.data?.legacyProfile ?? null;
  const profile: UserProfile | null = legacyProfile ?? (membership || platformAccess ? {
    user_id: user?.id ?? '',
    name: null,
    email: user?.email ?? '',
    role: hasFullAccess ? 'admin' : 'employee',
    is_active: hasPlatformAccess || membership?.status === 'active',
    permissions: membershipPermissions,
  } : null);

  const can = (module: string, action: 'view' | 'manage' = 'view') => {
    if (hasFullAccess || legacyProfile?.role === 'admin') return true;
    const level = membershipPermissions[module] || legacyProfile?.permissions?.[module] || 'none';
    return action === 'view' ? level === 'view' || level === 'manage' : level === 'manage';
  };

  return {
    ...query,
    profile,
    can,
    platformAccess,
    isPlatformOwner: platformAccess?.is_active === true && platformAccess.role === 'platform_owner',
    loading: authLoading || platformLoading || query.isLoading,
  };
}

