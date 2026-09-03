import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export function PermissionGuard({ module, action = 'view', children }: { module: string; action?: 'view' | 'manage'; children: React.ReactNode }) {
  const location = useLocation();
  const { can, loading, profile } = usePermissions();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!profile?.is_active) return <Navigate to="/unauthorized" state={{ from: location.pathname }} replace />;
  if (!can(module, action)) return <Navigate to="/unauthorized" state={{ from: location.pathname }} replace />;

  return <>{children}</>;
}
