import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleDollarSign, Plus, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

type OrganizationStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'security_blocked';
type OrganizationType = 'store' | 'distributor' | 'brewery' | 'hybrid';

type Organization = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  slug: string;
  organization_type: OrganizationType;
  status: OrganizationStatus;
  created_at: string;
};

const statusLabels: Record<OrganizationStatus, string> = {
  trial: 'Teste', active: 'Ativa', past_due: 'Inadimplente', suspended: 'Suspensa',
  cancelled: 'Cancelada', security_blocked: 'Bloqueio de segurança',
};

const statusVariants: Record<OrganizationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trial: 'secondary', active: 'default', past_due: 'outline', suspended: 'destructive',
  cancelled: 'outline', security_blocked: 'destructive',
};

export default function Master() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  // The generated types predate the SaaS control-plane migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const organizationsQuery = useQuery({
    queryKey: ['master-organizations'],
    queryFn: async () => {
      const { data, error } = await db
        .from('organizations')
        .select('id, legal_name, trade_name, slug, organization_type, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Organization[];
    },
  });

  const createOrganization = useMutation({
    mutationFn: async (values: { legalName: string; tradeName: string; slug: string; type: OrganizationType }) => {
      const { error } = await db.from('organizations').insert({
        legal_name: values.legalName,
        trade_name: values.tradeName || null,
        slug: values.slug,
        organization_type: values.type,
        status: 'trial',
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['master-organizations'] });
      setDialogOpen(false);
      toast.success('Organização criada em período de teste');
    },
    onError: (error: Error) => toast.error(`Não foi possível criar a organização: ${error.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrganizationStatus }) => {
      const { error } = await db.from('organizations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['master-organizations'] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => toast.error(`Não foi possível atualizar: ${error.message}`),
  });

  const organizations = organizationsQuery.data ?? [];
  const activeCount = organizations.filter((item) => item.status === 'active').length;
  const attentionCount = organizations.filter((item) => ['past_due', 'suspended', 'security_blocked'].includes(item.status)).length;

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createOrganization.mutate({
      legalName: String(form.get('legal_name') ?? '').trim(),
      tradeName: String(form.get('trade_name') ?? '').trim(),
      slug: String(form.get('slug') ?? '').trim().toLowerCase(),
      type: String(form.get('organization_type')) as OrganizationType,
    });
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> Plataforma</div>
            <h1 className="text-3xl font-bold">Painel Master</h1>
            <p className="text-muted-foreground">Gestão global das organizações do Sales Popidi.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova organização</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar organização</DialogTitle>
                <DialogDescription>A empresa será criada em período de teste. O proprietário será vinculado em uma etapa separada.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2"><Label htmlFor="legal_name">Razão social</Label><Input id="legal_name" name="legal_name" required /></div>
                <div className="space-y-2"><Label htmlFor="trade_name">Nome fantasia</Label><Input id="trade_name" name="trade_name" /></div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Subdomínio</Label>
                  <div className="flex items-center gap-2"><Input id="slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="empresa" required /><span className="whitespace-nowrap text-sm text-muted-foreground">.app.popidichopp.online</span></div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select name="organization_type" defaultValue="store">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store">Loja</SelectItem><SelectItem value="distributor">Distribuidora</SelectItem>
                      <SelectItem value="brewery">Cervejaria</SelectItem><SelectItem value="hybrid">Híbrida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" type="submit" disabled={createOrganization.isPending}>Criar organização</Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Organizações</CardTitle><Building2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{organizations.length}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Ativas</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{activeCount}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Exigem atenção</CardTitle><CircleDollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{attentionCount}</div></CardContent></Card>
        </section>

        <Card>
          <CardHeader><CardTitle>Organizações</CardTitle></CardHeader>
          <CardContent>
            {organizationsQuery.isLoading ? <p className="text-muted-foreground">Carregando organizações...</p> : organizationsQuery.isError ? (
              <p className="text-destructive">Não foi possível carregar as organizações.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Subdomínio</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {organizations.map((organization) => (
                    <TableRow key={organization.id}>
                      <TableCell><div className="font-medium">{organization.trade_name || organization.legal_name}</div><div className="text-xs text-muted-foreground">{organization.legal_name}</div></TableCell>
                      <TableCell className="font-mono text-xs">{organization.slug}.app.popidichopp.online</TableCell>
                      <TableCell>{organization.organization_type}</TableCell>
                      <TableCell>
                        <Select value={organization.status} onValueChange={(status: OrganizationStatus) => updateStatus.mutate({ id: organization.id, status })}>
                          <SelectTrigger className="w-52"><SelectValue><Badge variant={statusVariants[organization.status]}>{statusLabels[organization.status]}</Badge></SelectValue></SelectTrigger>
                          <SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

