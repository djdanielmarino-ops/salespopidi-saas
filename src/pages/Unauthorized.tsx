import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Unauthorized() {
  return <div className="flex min-h-screen items-center justify-center p-6">
    <div className="max-w-md space-y-4 text-center">
      <ShieldX className="mx-auto h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Acesso não autorizado</h1>
      <p className="text-muted-foreground">Seu perfil não possui permissão para acessar esta área. Fale com um administrador.</p>
      <Button asChild><Link to="/">Voltar ao início</Link></Button>
    </div>
  </div>;
}
