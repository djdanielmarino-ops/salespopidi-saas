import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FlaskConical, Link2, Pencil, Plus, Power, Send, Trash2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

type Organization = { id: string; legal_name: string; trade_name: string | null; status: string };
type Environment = 'test' | 'production';
type Endpoint = {
  id: string; name: string; endpoint_key: string; url: string; event_types: string[];
  is_active: boolean; environment: Environment; timeout_ms: number; max_attempts: number;
  last_tested_at: string | null; last_success_at: string | null;
  last_error_at: string | null; last_error_message: string | null;
};
type Delivery = {
  id: string; endpoint_id: string; attempt_number: number; status: string;
  response_status: number | null; error_message: string | null;
  started_at: string | null; finished_at: string | null;
};
type IntegrationEvent = {
  id: string; event_id: string; event_type: string; aggregate_type: string | null;
  status: string; error_message: string | null; occurred_at: string;
  webhook_deliveries: Delivery[];
};

const endpointOptions = [
  ['barrels_daily_summary', '1. Controle de barris'],
  ['orders_automation', '2. Automação de mensagens'],
  ['nfe_issue', '3. Emissão de NFe'],
  ['daily_orders', '4. Pedidos diários'],
  ['brewery_orders_send', '5. Compras / Fornecedor'],
] as const;

const integrationCatalog = [
  { number: 1, name: 'Controle de barris', direction: 'Saída', key: 'barrels_daily_summary', description: 'Envia ao n8n a atualização e o resumo do estoque de barris.', available: true },
  { number: 2, name: 'Automação de mensagens', direction: 'Saída', key: 'orders_automation', description: 'Dispara no status de saída e entrada dos equipamentos.', available: true },
  { number: 3, name: 'Emissão de NFe', direction: 'Saída', key: 'nfe_issue', description: 'Envia cliente, itens e valores para emissão fiscal.', available: false },
  { number: 4, name: 'Pedidos diários', direction: 'Saída', key: 'daily_orders', description: 'Envia o resumo dos pedidos da empresa no dia.', available: false },
  { number: 5, name: 'Compras / Fornecedor', direction: 'Saída', key: 'brewery_orders_send', description: 'Envia à cervejaria o pedido solicitado pela loja.', available: true },
  { number: 6, name: 'Recebimento de pedido', direction: 'Entrada', key: 'brewery_order_receive', description: 'Recebe aceite, faturamento e expedição; a loja confirma a entrega física.', available: false },
  { number: 7, name: 'Formulário', direction: 'Entrada', key: 'order_form_receive', description: 'Recebe do n8n um novo pedido originado pelo formulário.', available: false },
] as const;

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('master-integrations', { body });
  if (!error) return data;
  let message = error.message;
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null) as { error?: string } | null;
    if (payload?.error) message = payload.error;
  }
  throw new Error(message);
}

const emptyForm = {
  id: '', name: '', endpoint_key: 'orders_automation', url: '', environment: 'production' as Environment,
  timeout_ms: 15000, max_attempts: 5, is_active: true,
};

export default function MasterIntegrations() {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // Generated types predate the control-plane migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const organizationsQuery = useQuery({
    queryKey: ['master-organizations'],
    queryFn: async () => {
      const { data, error } = await db.from('organizations')
        .select('id,legal_name,trade_name,status').order('trade_name');
      if (error) throw error;
      return data as Organization[];
    },
  });

  useEffect(() => {
    if (!organizationId && organizationsQuery.data?.[0]) setOrganizationId(organizationsQuery.data[0].id);
  }, [organizationId, organizationsQuery.data]);

  const endpointsQuery = useQuery({
    queryKey: ['master-webhooks', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => (await invoke({ action: 'list', organization_id: organizationId })).endpoints as Endpoint[],
  });

  const activityQuery = useQuery({
    queryKey: ['master-webhook-activity', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => (await invoke({ action: 'list_activity', organization_id: organizationId })).events as IntegrationEvent[],
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['master-webhooks', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['master-webhook-activity', organizationId] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => invoke({ action: 'upsert', organization_id: organizationId, ...form, id: form.id || undefined }),
    onSuccess: async () => { await refresh(); setDialogOpen(false); setForm(emptyForm); toast.success('Webhook salvo.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => invoke({ action: 'delete', organization_id: organizationId, id }),
    onSuccess: async () => { await refresh(); toast.success('Webhook removido.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: (id: string) => invoke({ action: 'test', organization_id: organizationId, id }),
    onSuccess: async () => { await refresh(); toast.success('Conexão testada com sucesso.'); },
    onError: async (error: Error) => { await refresh(); toast.error(`Falha no teste: ${error.message}`); },
  });
  const retry = useMutation({
    mutationFn: (deliveryId: string) => invoke({ action: 'retry', organization_id: organizationId, delivery_id: deliveryId }),
    onSuccess: async () => { await refresh(); toast.success('Evento reenviado com sucesso.'); },
    onError: async (error: Error) => { await refresh(); toast.error(`Falha no reenvio: ${error.message}`); },
  });
  const sendDaily = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-daily-orders', { body: { organization_id: organizationId } });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => { await refresh(); toast.success(`Resumo de ${data.count} pedido(s) enviado.`); },
    onError: (error: Error) => toast.error(`Falha no resumo diário: ${error.message}`),
  });

  const openCreate = () => { setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (endpoint: Endpoint) => {
    setForm({
      id: endpoint.id, name: endpoint.name, endpoint_key: endpoint.endpoint_key, url: endpoint.url,
      environment: endpoint.environment, timeout_ms: endpoint.timeout_ms,
      max_attempts: endpoint.max_attempts, is_active: endpoint.is_active,
    });
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Button asChild variant="ghost" className="-ml-3 mb-2"><Link to="/master"><ArrowLeft className="mr-2 h-4 w-4" />Painel Master</Link></Button>
            <div className="flex items-center gap-2 text-sm font-medium text-primary"><Link2 className="h-4 w-4" /> Plataforma</div>
            <h1 className="text-3xl font-bold">APIs e Webhooks</h1>
            <p className="text-muted-foreground">Endpoints do n8n separados por empresa e ambiente.</p>
          </div>
          <Button onClick={openCreate} disabled={!organizationId}><Plus className="mr-2 h-4 w-4" />Novo webhook</Button>
        </header>

        <Card>
          <CardHeader><CardTitle>Empresa</CardTitle><CardDescription>Escolha a organização cujas conexões deseja administrar.</CardDescription></CardHeader>
          <CardContent>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger className="max-w-xl"><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
              <SelectContent>{organizationsQuery.data?.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.trade_name || organization.legal_name} — {organization.status}
                </SelectItem>
              ))}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Webhooks configurados</CardTitle><CardDescription>URLs de saída usadas pelo sistema para acionar os fluxos do n8n.</CardDescription></CardHeader>
          <CardContent>
            {endpointsQuery.isLoading ? <p className="text-muted-foreground">Carregando...</p> :
              endpointsQuery.isError ? <p className="text-destructive">Não foi possível carregar os webhooks.</p> :
              !endpointsQuery.data?.length ? <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nenhum webhook configurado para esta empresa.</div> : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow><TableHead>Integração</TableHead><TableHead>Ambiente</TableHead><TableHead>URL</TableHead><TableHead>Situação</TableHead><TableHead>Último teste</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>{endpointsQuery.data.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell><div className="font-medium">{endpoint.name}</div><div className="font-mono text-xs text-muted-foreground">{endpoint.endpoint_key}</div></TableCell>
                      <TableCell><Badge variant={endpoint.environment === 'production' ? 'default' : 'secondary'}>{endpoint.environment === 'production' ? 'Produção' : 'Teste'}</Badge></TableCell>
                      <TableCell><div className="max-w-xs truncate font-mono text-xs" title={endpoint.url}>{endpoint.url}</div></TableCell>
                      <TableCell>{endpoint.is_active ? <Badge variant="outline"><Power className="mr-1 h-3 w-3 text-green-600" />Ativo</Badge> : <Badge variant="secondary">Pausado</Badge>}</TableCell>
                      <TableCell>
                        {!endpoint.last_tested_at ? <span className="text-sm text-muted-foreground">Não testado</span> :
                          endpoint.last_success_at && endpoint.last_success_at === endpoint.last_tested_at
                            ? <span className="flex items-center text-sm text-green-700"><CheckCircle2 className="mr-1 h-4 w-4" />Sucesso</span>
                            : <span className="flex items-center text-sm text-destructive" title={endpoint.last_error_message || ''}><XCircle className="mr-1 h-4 w-4" />Falhou</span>}
                      </TableCell>
                      <TableCell><div className="flex justify-end gap-1">
                        {endpoint.endpoint_key === 'daily_orders' && <Button size="icon" variant="ghost" title="Enviar pedidos de hoje" onClick={() => sendDaily.mutate()} disabled={sendDaily.isPending}><Send className="h-4 w-4" /></Button>}
                        <Button size="icon" variant="ghost" title="Testar" onClick={() => test.mutate(endpoint.id)} disabled={test.isPending}><FlaskConical className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(endpoint)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Excluir" onClick={() => { if (confirm(`Excluir o webhook “${endpoint.name}”?`)) remove.mutate(endpoint.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table></div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Catálogo de integrações</CardTitle><CardDescription>Os sete fluxos oficiais previstos para todas as categorias de empresa.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {integrationCatalog.map((item) => {
              const configured = endpointsQuery.data?.some((endpoint) => endpoint.endpoint_key === item.key && endpoint.is_active);
              return <div key={item.number} className="rounded-lg border p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="font-medium">{item.number}. {item.name}</div>
                  <Badge variant={item.direction === 'Entrada' ? 'secondary' : 'outline'}>{item.direction}</Badge>
                </div>
                <p className="min-h-10 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-3">
                  {configured ? <Badge><CheckCircle2 className="mr-1 h-3 w-3" />Configurado</Badge> :
                    item.available ? <Badge variant="outline">Aguardando URL</Badge> :
                      <Badge variant="secondary">Próxima etapa</Badge>}
                </div>
              </div>;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico de eventos</CardTitle><CardDescription>Últimos 50 eventos enviados pelos webhooks desta empresa.</CardDescription></CardHeader>
          <CardContent>
            {activityQuery.isLoading ? <p className="text-muted-foreground">Carregando histórico...</p> :
              activityQuery.isError ? <p className="text-destructive">Não foi possível carregar o histórico.</p> :
              !activityQuery.data?.length ? <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nenhum evento registrado.</div> : (
                <div className="overflow-x-auto"><Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Situação</TableHead><TableHead>Tentativa</TableHead><TableHead>Resposta</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                  <TableBody>{activityQuery.data.map((event) => {
                    const deliveries = [...(event.webhook_deliveries || [])].sort((a, b) => b.attempt_number - a.attempt_number);
                    const latest = deliveries[0];
                    const canRetry = latest && latest.status === 'failed';
                    return <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(event.occurred_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell><div className="font-medium">{event.event_type}</div><div className="font-mono text-xs text-muted-foreground">{event.event_id}</div></TableCell>
                      <TableCell><Badge variant={event.status === 'processed' ? 'default' : event.status === 'failed' || event.status === 'dead_letter' ? 'destructive' : 'secondary'}>{event.status}</Badge></TableCell>
                      <TableCell>{latest ? `#${latest.attempt_number}` : '—'}</TableCell>
                      <TableCell><div className="max-w-xs truncate text-sm" title={latest?.error_message || event.error_message || ''}>{latest?.response_status ? `HTTP ${latest.response_status}` : latest?.error_message || event.error_message || '—'}</div></TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" disabled={!canRetry || retry.isPending} onClick={() => latest && retry.mutate(latest.id)}>Reenviar</Button></TableCell>
                    </TableRow>;
                  })}</TableBody>
                </Table></div>
              )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? 'Editar webhook' : 'Novo webhook'}</DialogTitle><DialogDescription>Cole a URL fornecida pelo n8n. Use uma URL de teste antes de ativar a produção.</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Tipo</Label><Select value={form.endpoint_key} onValueChange={(value) => setForm({ ...form, endpoint_key: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{endpointOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Ambiente</Label><Select value={form.environment} onValueChange={(value: Environment) => setForm({ ...form, environment: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="test">Teste</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="webhook_name">Nome</Label><Input id="webhook_name" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Pedidos diários - n8n" /></div>
              <div className="space-y-2"><Label htmlFor="webhook_url">URL do webhook</Label><Input id="webhook_url" required type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://n8n.exemplo.com/webhook/..." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="timeout">Timeout (ms)</Label><Input id="timeout" type="number" min={1000} max={60000} value={form.timeout_ms} onChange={(event) => setForm({ ...form, timeout_ms: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label htmlFor="attempts">Máximo de tentativas</Label><Input id="attempts" type="number" min={1} max={20} value={form.max_attempts} onChange={(event) => setForm({ ...form, max_attempts: Number(event.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="active">Webhook ativo</Label><p className="text-xs text-muted-foreground">Endpoints pausados não recebem eventos.</p></div><Switch id="active" checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar webhook'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
