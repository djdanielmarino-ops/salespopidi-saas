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
  useCylinderModels, 
  useCylinderSummary, 
  useCylinderInventory,
  useAddCylinders,
  useAddEmptyCylinders,
} from '@/hooks/useCylinderInventory';
import { Cylinder as CylinderIcon, Plus, PackagePlus } from 'lucide-react';
import { CylinderStatus } from '@/types/database';

const statusLabels: Record<CylinderStatus, string> = {
  cheio: 'Cheio',
  com_cliente: 'Com Cliente',
  vazio: 'Vazio',
};

const statusColors: Record<CylinderStatus, string> = {
  cheio: 'bg-green-500',
  com_cliente: 'bg-amber-500',
  vazio: 'bg-gray-500',
};

export default function Cylinders() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addEmptyDialogOpen, setAddEmptyDialogOpen] = useState(false);
  
  const { data: models } = useCylinderModels();
  const { data: summary, isLoading } = useCylinderSummary();
  const { data: inventory } = useCylinderInventory();
  
  const addCylinders = useAddCylinders();
  const addEmptyCylinders = useAddEmptyCylinders();

  const handleAddCylinders = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await addCylinders.mutateAsync({
      cylinderModelId: formData.get('cylinder_model_id') as string,
      quantity: Number(formData.get('quantity')),
    });
    
    setAddDialogOpen(false);
  };

  const handleAddEmptyCylinders = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await addEmptyCylinders.mutateAsync({
      cylinderModelId: formData.get('cylinder_model_id') as string,
      quantity: Number(formData.get('quantity')),
    });
    
    setAddEmptyDialogOpen(false);
  };

  // Calculate totals
  const totals = summary?.reduce((acc, s) => ({
    cheio: acc.cheio + s.cheio,
    com_cliente: acc.com_cliente + s.com_cliente,
    vazio: acc.vazio + s.vazio,
  }), { cheio: 0, com_cliente: 0, vazio: 0 });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Cilindros</h1>
            <p className="text-muted-foreground">Controle de estoque de cilindros de gás por modelo</p>
          </div>
          <div className="flex gap-2">
            {/* Add Cylinders Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Entrada de Cilindros
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrada de Cilindros (Cheios)</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCylinders} className="space-y-4">
                  <div>
                    <Label htmlFor="cylinder_model_id">Capacidade *</Label>
                    <Select name="cylinder_model_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a capacidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models?.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.capacity}kg - {model.description}
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
                    <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={addCylinders.isPending}>
                      Registrar Entrada
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Add Empty Cylinders Dialog */}
            <Dialog open={addEmptyDialogOpen} onOpenChange={setAddEmptyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Entrada de Cilindros Vazios
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrada de Cilindros (Vazios)</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddEmptyCylinders} className="space-y-4">
                  <div>
                    <Label htmlFor="cylinder_model_id">Capacidade *</Label>
                    <Select name="cylinder_model_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a capacidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models?.map((model) => {
                          const modelSummary = summary?.find(s => s.model.id === model.id);
                          return (
                            <SelectItem key={model.id} value={model.id}>
                              {model.capacity}kg ({modelSummary?.vazio || 0} vazios em estoque)
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
                    <Button type="button" variant="outline" onClick={() => setAddEmptyDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={addEmptyCylinders.isPending}>
                      Registrar Entrada
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <CylinderIcon className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.cheio || 0}</p>
                  <p className="text-sm text-muted-foreground">Cheios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-amber-500/10 p-3">
                  <CylinderIcon className="h-6 w-6 text-amber-500" />
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
                  <CylinderIcon className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals?.vazio || 0}</p>
                  <p className="text-sm text-muted-foreground">Vazios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Resumo por Capacidade</TabsTrigger>
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
                        <TableHead>Capacidade</TableHead>
                        <TableHead className="text-center">Cheios</TableHead>
                        <TableHead className="text-center">Com Cliente</TableHead>
                        <TableHead className="text-center">Vazios</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary?.map((item) => {
                        const total = item.cheio + item.com_cliente + item.vazio;
                        return (
                          <TableRow key={item.model.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <CylinderIcon className="h-4 w-4" />
                                {item.model.capacity}kg
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.cheio}>{item.cheio}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.com_cliente}>{item.com_cliente}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={statusColors.vazio}>{item.vazio}</Badge>
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
                  <CylinderIcon className="h-5 w-5" />
                  Estoque Detalhado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capacidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory?.filter(i => i.quantity > 0).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.cylinder_models?.capacity}kg
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
