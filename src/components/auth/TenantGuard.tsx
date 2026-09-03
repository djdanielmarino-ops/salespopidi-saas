import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export function TenantGuard({ children }: { children: ReactNode }) {
  const { organization, loading, error } = useTenant();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!organization) {
    const message = error === 'not_found_or_forbidden'
      ? 'Esta empresa não existe ou seu usuário não possui acesso a ela.'
      : error === 'load_failed'
        ? 'Não foi possível confirmar a empresa. Tente novamente em instantes.'
        : 'Acesse o endereço da sua empresa para continuar.';
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section className="max-w-lg rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Empresa não identificada</h1>
          <p className="mt-3 text-muted-foreground">{message}</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

