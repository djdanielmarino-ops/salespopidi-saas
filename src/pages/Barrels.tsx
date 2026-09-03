import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useBarrelModels, 
  useBarrelSummary, 
  useBarrelInventory,
  useBarrelInventoryAdjustments,
  useBarrelPatrimonyTargets,
  useAdjustBarrelInventory,
  useSetBarrelInventoryCount,
  useSetBarrelPatrimonyTarget,
  useReceiveChoppFromBrewery, 
  useSendToBrewery,
  useSendDailyBarrelSummary,
} from '@/hooks/useBarrelInventory';
import { useBeerTypes } from '@/hooks/useEquipment';
import { AlertTriangle, Package, ArrowDownToLine, ArrowUpFromLine, Beer, Send, Scale, Pencil } from 'lucide-react';
import { BarrelStatus } from '@/types/database';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import type { BarrelInventory } from '@/hooks/useBarrelInventory';

const statusLabels: Record<BarrelStatus, string> = {
  cheio_loja: 'Cheio na Loja',
  com_cliente: 'Com Cliente',
  vazio_loja: 'Vazio na Loja',
  na_cervejaria: 'Na Cervejaria',
};

const statusColors: Record<BarrelStatus, string> = {
  cheio_loja: 'bg-green-500',
  com_cliente: 'bg-amber-500',
  vazio_loja: 'bg-gray-500',
  na_cervejaria: 'bg-blue-500',
};

const adjustmentReasonLabels: Record<string, string> = {
  physical_count: 'Contagem física', partial_return: 'Devolução parcial',
  entry_error: 'Erro de lançamento', damage_or_loss: 'Avaria ou perda',
  acquisition: 'Aquisição', write_off: 'Baixa patrimonial', other: 'Outro',
};

export default function Barrels() {
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [targetModelId, setTargetModelId] = useState<string | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<BarrelInventory | null>(null);
  const [countDialogOpen, setCountDialogOpen] = useState(false);
  const [countStatus, setCountStatus] = useState<BarrelStatus>('cheio_loja');
  
  const { data: models } = useBarrelModels();
  const { data: summary, isLoading } = useBarrelSummary();
  const { data: inventory } = useBarrelInventory();
  const { data: patrimonyTargets } = useBarrelPatrimonyTargets();
  const { data: adjustments } = useBarrelInventoryAdjustments();
  const { data: beerTypes } = useBeerTypes();
  
  const receiveChopp = useReceiveChoppFromBrewery();
  const sendToBrewery = useSendToBrewery();
  const sendDailySummary = useSendDailyBarrelSummary();
  const setPatrimonyTarget = useSetBarrelPatrimonyTarget();
  const adjustInventory = useAdjustBarrelInventory();
  const setInventoryCount = useSetBarrelInventoryCount();
  const { can } = usePermissions();
  const canAdjustBarrels = can('barrel_adjustments', 'manage');

  const handleReceiveChopp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await receiveChopp.mutateAsync({
      barrelModelId: formData.get('barrel_model_id') as string,
      beerTypeId: formData.get('beer_type_id') as string,
      quantity: Number(formData.get('quantity')),
    });
    
    setReceiveDialogOpen(false);
  };

  const handleSendToBrewery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await sendToBrewery.mutateAsync({
      barrelModelId: formData.get('barrel_model_id') as string,
      quantity: Number(formData.get('quantity')),
    });
    
    setSendDialogOpen(false);
  };

  const handleSetTarget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetModelId) return;
    const form = new FormData(event.currentTarget);
    await setPatrimonyTarget.mutateAsync({
      barrelModelId: targetModelId,
      expectedQuantity: Number(form.get('expected_quantity')),
      reason: String(form.get('reason') || '').trim(),
    });
    setTargetModelId(null);
  };

  const handleAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustmentItem) return;
    const form = new FormData(event.currentTarget);
    await adjustInventory.mutateAsync({
      inventoryId: adjustmentItem.id,
      quantityAfter: Number(form.get('quantity_after')),
      reasonCode: String(form.get('reason_code')),
      reason: String(form.get('reason') || '').trim(),
    });
    setAdjustmentItem(null);
  };

  const handleSetCount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await setInventoryCount.mutateAsync({
      barrelModelId: String(form.get('barrel_model_id')),
      status: countStatus,
      beerTypeId: ['cheio_loja', 'com_cliente'].includes(countStatus) ? String(form.get('beer_type_id') || '') : null,
      quantityAfter: Number(form.get('quantity_after')),
      reasonCode: String(form.get('reason_code')),
      reason: String(form.get('reason') || '').trim(),
    });
    setCountDialogOpen(false);
  };

  // Calculate totals
  const totals = summary?.reduce((acc, s) => ({
    cheio_loja: acc.cheio_loja + s.cheio_loja,
    com_cliente: acc.com_cliente + s.com_cliente,
    vazio_loja: acc.vazio_loja + s.vazio_loja,
    na_cervejaria: acc.na_cervejaria + s.na_cervejaria,
  }), { cheio_loja: 0, com_cliente: 0, vazio_loja: 0, na_cervejaria: 0 });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Barris</h1>
            <p className="text-muted-foreground">Controle de estoque de barris por modelo</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAdjustBarrels && <Button variant="outline" onClick={() => setCountDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />Nova contagem / ajuste
            </Button>}
            <Button
              variant="secondary"
              onClick={() => sendDailySummary.mutate()}
              disabled={sendDailySummary.isPending || isLoading}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendDailySummary.isPending ? 'Enviando...' : 'Enviar resumo do dia'}
            </Button>
            {/* Receive Chopp Dialog */}
            <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Entrada de Chopp
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrada de Chopp da Cervejaria</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleReceiveChopp} className="space-y-4">
                  <div>
                    <Label htmlFor="barrel_model_id">Volume do Barril *</Label>
                    <Select name="barrel_model_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o volume..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models?.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.volume}L - {model.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="beer_type_id">Tipo de Chopp *</Label>
                    <Select name="beer_type_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {beerTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input 
                      id="quantity" 
                      name="quantity" 
                      type="number"
                      min="1"
                      required 
                      placeholder="Ex: 10"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={receiveChopp.isPending}>
                      Registrar Entrada
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Send to Brewery Dialog */}
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  Enviar para Cervejaria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Barris Vazios para Cervejaria</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSendToBrewery} className="space-y-4">
                  <div>
                    <Label htmlFor="barrel_model_id">Volume do Barril *</Label>
                    <Select name="barrel_model_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o volume..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models?.map((model) => {
                          const modelSummary = summary?.find(s => s.model.id === model.id);
                          return (
                            <SelectItem key={model.id} value={model.id}>
                              {model.volume}L ({modelSummary?.vazio_loja || 0} vazios disponíveis)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input 
                      id="quantity" 
                      name="quantity" 
                      type="number"
                      min="1"
                      required 
                      placeholder="Ex: 5"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setSendDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={sendToBrewery.isPending}>
                      Enviar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog open={countDialogOpen} onOpenChange={setCountDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar localização e contagem</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={handleSetCount}>
              <p className="text-sm text-muted-foreground">
                Use também para a primeira contagem. Se esta combinação já existir, a quantidade será ajustada e não duplicada.
              </p>
              <div className="space-y-2">
                <Label>Volume *</Label>
                <Select name="barrel_model_id" required><SelectTrigger><SelectValue placeholder="Selecione o volume" /></SelectTrigger><SelectContent>
                  {models?.map((model) => <SelectItem key={model.id} value={model.id}>{model.volume}L</SelectItem>)}
                </SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label>Onde estão os barris? *</Label>
                <Select value={countStatus} onValueChange={(value) => setCountStatus(value as BarrelStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {['cheio_loja', 'com_cliente'].includes(countStatus) && <div className="space-y-2">
                <Label>Tipo de Chopp *</Label>
                <Select name="beer_type_id" required><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent>
                  {beerTypes?.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                </SelectContent></Select>
              </div>}
              <div className="space-y-2">
                <Label htmlFor="new_quantity_after">Quantidade contada *</Label>
                <Input id="new_quantity_after" name="quantity_after" type="number" min="0" required placeholder="Ex.: 12" />
              </div>
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select name="reason_code" required><SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger><SelectContent>
                  {Object.entries(adjustmentReasonLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_adjustment_reason">Detalhes *</Label>
                <Textarea id="new_adjustment_reason" name="reason" minLength={5} maxLength={500} required placeholder="Ex.: contagem física inicial realizada no depósito" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCountDialogOpen(false)}>Cancelar</Button>
                <Button disabled={setInventoryCount.isPending}>Salvar contagem</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!targetModelId} onOpenChange={(open) => !open && setTargetModelId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir patrimônio de barris</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSetTarget}>
              <p className="text-sm text-muted-foreground">
                Informe quantos barris desta litragem pertencem à empresa, independentemente de onde estejam.
              </p>
              <div className="space-y-2">
                <Label htmlFor="expected_quantity">Quantidade patrimonial *</Label>
                <Input id="expected_quantity" name="expected_quantity" type="number" min="0" required
                  defaultValue={patrimonyTargets?.find((target) => target.barrel_model_id === targetModelId)?.expected_quantity ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_reason">Justificativa *</Label>
                <Textarea id="target_reason" name="reason" minLength={5} maxLength={500} required placeholder="Ex.: inventário patrimonial inicial" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTargetModelId(null)}>Cancelar</Button>
                <Button disabled={setPatrimonyTarget.isPending}>Salvar patrimônio</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!adjustmentItem} onOpenChange={(open) => !open && setAdjustmentItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajustar contagem de barris</DialogTitle>
            </DialogHeader>
            {adjustmentItem && <form className="space-y-4" onSubmit={handleAdjustment}>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <strong>{adjustmentItem.barrel_models?.volume}L</strong> · {statusLabels[adjustmentItem.status]} · atual: <strong>{adjustmentItem.quantity}</strong>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_after">Quantidade contada *</Label>
                <Input id="quantity_after" name="quantity_after" type="number" min="0" required defaultValue={adjustmentItem.quantity} />
              </div>
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select name="reason_code" required>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>{Object.entries(adjustmentReasonLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment_reason">Detalhes *</Label>
                <Textarea id="adjustment_reason" name="reason" minLength={5} maxLength={500} required placeholder="Explique o que foi conferido e por que houve diferença" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAdjustmentItem(null)}>Cancelar</Button>
                <Button disabled={adjustInventory.isPending}>Confirmar ajuste</Button>
              </div>
            </form>}
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <Package className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.cheio_loja || 0}</p>
                  <p className="text-sm text-muted-foreground">Cheios na Loja</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-amber-500/10 p-3">
                  <Package className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.com_cliente || 0}</p>
                  <p className="text-sm text-muted-foreground">Com Cliente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-gray-500/10 p-3">
                  <Package className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.vazio_loja || 0}</p>
                  <p className="text-sm text-muted-foreground">Vazios na Loja</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-500/10 p-3">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.na_cervejaria || 0}</p>
                  <p className="text-sm text-muted-foreground">Na Cervejaria</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Resumo por Volume</TabsTrigger>
            <TabsTrigger value="detail">Detalhamento</TabsTrigger>
            {canAdjustBarrels && <TabsTrigger value="adjustments">Histórico de ajustes</TabsTrigger>}
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Volume</TableHead>
                        <TableHead className="text-center">Cheios na Loja</TableHead>
                        <TableHead className="text-center">Com Cliente</TableHead>
                        <TableHead className="text-center">Vazios na Loja</TableHead>
                        <TableHead className="text-center">Na Cervejaria</TableHead>
                        <TableHead className="text-center">Localizados</TableHead>
                        <TableHead className="text-center">Patrimônio</TableHead>
                        <TableHead>Situação</TableHead>
                        {canAdjustBarrels && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary?.map((item) => {
                        const total = item.cheio_loja + item.com_cliente + item.vazio_loja + item.na_cervejaria;
                        const target = patrimonyTargets?.find((entry) => entry.barrel_model_id === item.model.id);
                        const variance = target ? total - target.expected_quantity : null;
                        return (
                          <TableRow key={item.model.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                {item.model.volume}L
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.cheio_loja}>{item.cheio_loja}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.com_cliente}>{item.com_cliente}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.vazio_loja}>{item.vazio_loja}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.na_cervejaria}>{item.na_cervejaria}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-bold">{total}</TableCell>
                            <TableCell className="text-center">{target?.expected_quantity ?? 'Não definido'}</TableCell>
                            <TableCell>
                              {variance === null ? <Badge variant="outline">Configurar</Badge>
                                : variance === 0 ? <Badge className="bg-green-600">Conferido</Badge>
                                : variance < 0 ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Faltam {Math.abs(variance)}</Badge>
                                : <Badge className="bg-amber-500"><AlertTriangle className="mr-1 h-3 w-3" />Sobram {variance}</Badge>}
                            </TableCell>
                            {canAdjustBarrels && <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => setTargetModelId(item.model.id)}>
                                <Scale className="mr-2 h-4 w-4" />Patrimônio
                              </Button>
                            </TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beer className="h-5 w-5" />
                  Estoque Detalhado por Tipo de Chopp
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Volume</TableHead>
                        <TableHead>Tipo de Chopp</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Quantidade</TableHead>
                        {canAdjustBarrels && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory?.filter(i => i.quantity > 0).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.barrel_models?.volume}L
                          </TableCell>
                          <TableCell>
                            {item.beer_types?.name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[item.status]}>
                              {statusLabels[item.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {item.quantity}
                          </TableCell>
                          {canAdjustBarrels && <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setAdjustmentItem(item)}>
                              <Pencil className="mr-2 h-4 w-4" />Ajustar
                            </Button>
                          </TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {!isLoading && !inventory?.some((item) => item.quantity > 0) && (
                  <div className="py-8 text-center">
                    <p className="font-medium">Nenhuma contagem registrada.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Use “Nova contagem / ajuste” para informar onde estão os barris.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canAdjustBarrels && <TabsContent value="adjustments">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de ajustes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Barril</TableHead><TableHead>Status</TableHead><TableHead>Motivo</TableHead><TableHead className="text-center">Antes</TableHead><TableHead className="text-center">Depois</TableHead><TableHead>Justificativa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {adjustments?.map((adjustment) => <TableRow key={adjustment.id}>
                      <TableCell className="whitespace-nowrap">{new Date(adjustment.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{adjustment.barrel_models?.volume}L{adjustment.beer_types?.name ? ` · ${adjustment.beer_types.name}` : ''}</TableCell>
                      <TableCell>{statusLabels[adjustment.status]}</TableCell>
                      <TableCell>{adjustmentReasonLabels[adjustment.reason_code] || adjustment.reason_code}</TableCell>
                      <TableCell className="text-center">{adjustment.quantity_before}</TableCell>
                      <TableCell className="text-center font-semibold">{adjustment.quantity_after}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{adjustment.reason}</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
                {!adjustments?.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ajuste manual registrado.</p>}
              </CardContent>
            </Card>
          </TabsContent>}
        </Tabs>
      </div>
    </MainLayout>
  );
}
