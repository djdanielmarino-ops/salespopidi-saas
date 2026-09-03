import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { resolveTenantHost, TenantHostResolution } from '@/lib/tenantHost';

export type ActiveOrganization = {
  id: string;
  slug: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
  timezone: string;
};

type TenantError = 'missing_subdomain' | 'not_found_or_forbidden' | 'load_failed' | null;

type TenantContextValue = {
  organization: ActiveOrganization | null;
  resolution: TenantHostResolution;
  loading: boolean;
  error: TenantError;
};

type OrganizationLookup = {
  from: (table: 'organizations') => {
    select: (columns: string) => {
      eq: (column: 'slug', value: string) => {
        maybeSingle: () => PromiseLike<{ data: ActiveOrganization | null; error: unknown }>;
      };
    };
  };
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const resolution = useMemo(
    () => resolveTenantHost(
      window.location.hostname,
      import.meta.env.VITE_APP_BASE_DOMAIN,
      import.meta.env.DEV ? import.meta.env.VITE_DEV_TENANT_SLUG : undefined,
    ),
    [],
  );
  const [organization, setOrganization] = useState<ActiveOrganization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TenantError>(null);

  useEffect(() => {
    let active = true;

    if (authLoading || !session) {
      setOrganization(null);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }

    if (resolution.kind !== 'tenant') {
      setOrganization(null);
      setLoading(false);
      setError('missing_subdomain');
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);

    (supabase as unknown as OrganizationLookup)
      .from('organizations')
      .select('id, slug, legal_name, trade_name, status, timezone')
      .eq('slug', resolution.slug)
      .maybeSingle()
      .then(({ data, error: queryError }: { data: ActiveOrganization | null; error: unknown }) => {
        if (!active) return;
        setLoading(false);
        if (queryError) {
          setOrganization(null);
          setError('load_failed');
          return;
        }
        setOrganization(data);
        setError(data ? null : 'not_found_or_forbidden');
      });

    return () => { active = false; };
  }, [authLoading, session, resolution]);

  return (
    <TenantContext.Provider value={{ organization, resolution, loading: authLoading || loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant deve ser usado dentro de TenantProvider');
  return context;
}
