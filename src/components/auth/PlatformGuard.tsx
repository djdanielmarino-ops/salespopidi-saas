import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePlatformAccess } from '@/hooks/usePlatformAccess';

export function PlatformGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isPlatformOwner, loading } = usePlatformAccess();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!isPlatformOwner) {
    return <Navigate to="/unauthorized" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

