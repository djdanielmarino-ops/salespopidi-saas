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
  useReceiveChoppFromBrewery, 
  useSendToBrewery,
  useSendDailyBarrelSummary,
} from '@/hooks/useBarrelInventory';
import { useBeerTypes } from '@/hooks/useEquipment';
import { Package, ArrowDownToLine, ArrowUpFromLine, Beer, Send } from 'lucide-react';
import { BarrelStatus } from '@/types/database';

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

export default function Barrels() {
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  
  const { data: models } = useBarrelModels();
  const { data: summary, isLoading } = useBarrelSummary();
  const { data: inventory } = useBarrelInventory();
  const { data: beerTypes } = useBeerTypes();
  
  const receiveChopp = useReceiveChoppFromBrewery();
  const sendToBrewery = useSendToBrewery();
  const sendDailySummary = useSendDailyBarrelSummary();

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
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary?.map((item) => {
                        const total = item.cheio_loja + item.com_cliente + item.vazio_loja + item.na_cervejaria;
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
