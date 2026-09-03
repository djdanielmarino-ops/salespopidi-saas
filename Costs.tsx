import { FormEvent, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useBeerTypes } from '@/hooks/useEquipment';
import {
  useBeerCostHistory,
  useCostCategories,
  useCostEntries,
  useCreateBeerCostHistory,
  useCreateCostEntry,
  useDeleteCostEntry,
} from '@/hooks/useCosts';
import { CalendarDays, DollarSign, Plus, Trash2 } from 'lucide-react';

const formatCurrency = (value: number | string | null | undefined) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const today = new Date().toISOString().split('T')[0];

export default function Costs() {
  const [manualOpen, setManualOpen] = useState(false);
  const [beerCostOpen, setBeerCostOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  const { data: categories } = useCostCategories();
  const { data: entries } = useCostEntries();
  const { data: beerTypes } = useBeerTypes();
  const { data: beerCostHistory } = useBeerCostHistory();
  const createCostEntry = useCreateCostEntry();
  const deleteCostEntry = useDeleteCostEntry();
  const createBeerCost = useCreateBeerCostHistory();

  const manualTotal = entries?.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) || 0;
  const currentBeerCosts = beerTypes?.map((beer) => {
    const latest = beerCostHistory?.find((cost) => cost.beer_type_id === beer.id);
    return {
      ...beer,
      currentCost: latest?.cost_per_liter ?? beer.cost_per_liter ?? 0,
      validFrom: latest?.valid_from,
      supplier: latest?.supplier,
    };
  }) || [];

  const handleCreateManualCost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await createCostEntry.mutateAsync({
      category_id: (formData.get('category_id') as string) || null,
      cost_date: formData.get('cost_date') as string,
      description: formData.get('description') as string,
      supplier: (formData.get('supplier') as string) || null,
      amount: Number(formData.get('amount')) || 0,
      notes: (formData.get('notes') as string) || null,
      is_recurring: isRecurring,
    });

    setIsRecurring(false);
    setManualOpen(false);
  };

  const handleCreateBeerCost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await createBeerCost.mutateAsync({
      beer_type_id: formData.get('beer_type_id') as string,
      cost_per_liter: Number(formData.get('cost_per_liter')) || 0,
      valid_from: formData.get('valid_from') as string,
      valid_to: (formData.get('valid_to') as string) || null,
      supplier: (formData.get('supplier') as string) || null,
      notes: (formData.get('notes') as string) || null,
    });

    setBeerCostOpen(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Custos</h1>
            <p className="text-muted-foreground">Registre despesas manuais e historico de custo do chopp</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custos Lancados</CardTitle>
              <DollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(manualTotal)}</div>
              <p className="text-xs text-muted-foreground">{entries?.length || 0} registros recentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tipos de Chopp</CardTitle>
              <CalendarDays className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{beerTypes?.length || 0}</div>
              <p className="text-xs text-muted-foreground">com custo atual ou historico</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Regra de Analise</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pedidos novos gravam o custo do chopp na data da venda. Alteracoes futuras nao mudam margens antigas.
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">Custos Manuais</TabsTrigger>
            <TabsTrigger value="beer-costs">Historico do Chopp</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Custos Manuais</CardTitle>
                    <CardDescription>Contas, impostos, combustivel, manutencao e outros custos operacionais</CardDescription>
                  </div>
                  <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Custo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Custo Manual</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateManualCost} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="cost_date">Data *</Label>
                            <Input id="cost_date" name="cost_date" type="date" defaultValue={today} required />
                          </div>
                          <div>
                            <Label>Categoria</Label>
                            <Select name="category_id">
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories?.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="description">Descricao *</Label>
                          <Input id="description" name="description" required placeholder="Ex: Conta de luz" />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="supplier">Fornecedor</Label>
                            <Input id="supplier" name="supplier" placeholder="Ex: CPFL" />
                          </div>
                          <div>
                            <Label htmlFor="amount">Valor (R$) *</Label>
                            <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                          <Label>Custo recorrente</Label>
                        </div>
                        <div>
                          <Label htmlFor="notes">Observacoes</Label>
                          <Textarea id="notes" name="notes" rows={3} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createCostEntry.isPending}>
                            Salvar
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(`${entry.cost_date}T00:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{entry.cost_categories?.name || '-'}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>{entry.supplier || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCostEntry.mutate(entry.id)}
                            disabled={deleteCostEntry.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!entries?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Nenhum custo manual registrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beer-costs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historico de Custo do Chopp</CardTitle>
                    <CardDescription>Controle o custo por litro com vigencia por data</CardDescription>
                  </div>
                  <Dialog open={beerCostOpen} onOpenChange={setBeerCostOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Custo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Custo do Chopp</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateBeerCost} className="space-y-4">
                        <div>
                          <Label>Tipo de Chopp *</Label>
                          <Select name="beer_type_id" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {beerTypes?.map((beer) => (
                                <SelectItem key={beer.id} value={beer.id}>
                                  {beer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="cost_per_liter">Custo/L (R$) *</Label>
                            <Input id="cost_per_liter" name="cost_per_liter" type="number" min="0" step="0.01" required />
                          </div>
                          <div>
                            <Label htmlFor="valid_from">Inicio da Vigencia *</Label>
                            <Input id="valid_from" name="valid_from" type="date" defaultValue={today} required />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label htmlFor="valid_to">Fim da Vigencia</Label>
                            <Input id="valid_to" name="valid_to" type="date" />
                          </div>
                          <div>
                            <Label htmlFor="supplier">Fornecedor</Label>
                            <Input id="supplier" name="supplier" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="notes">Observacoes</Label>
                          <Textarea id="notes" name="notes" rows={3} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setBeerCostOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createBeerCost.isPending}>
                            Salvar
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chopp</TableHead>
                      <TableHead>Custo Atual</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fornecedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBeerCosts.map((beer) => (
                      <TableRow key={beer.id}>
                        <TableCell className="font-medium">{beer.name}</TableCell>
                        <TableCell>{formatCurrency(beer.currentCost)}</TableCell>
                        <TableCell>{beer.validFrom ? new Date(`${beer.validFrom}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell>{beer.supplier || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div>
                  <h3 className="mb-3 text-sm font-medium">Lancamentos do Historico</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chopp</TableHead>
                        <TableHead>Custo/L</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Fornecedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {beerCostHistory?.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>{cost.beer_types?.name || '-'}</TableCell>
                          <TableCell>{formatCurrency(cost.cost_per_liter)}</TableCell>
                          <TableCell>{new Date(`${cost.valid_from}T00:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{cost.valid_to ? new Date(`${cost.valid_to}T00:00:00`).toLocaleDateString('pt-BR') : 'Atual'}</TableCell>
                          <TableCell>{cost.supplier || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {!beerCostHistory?.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            Nenhum historico de custo registrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
