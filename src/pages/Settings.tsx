import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTapTypes, useBeerTypes, useCreateBeerType } from '@/hooks/useEquipment';
import { Landmark, Plus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserManagement } from '@/components/settings/UserManagement';
import { usePermissions } from '@/hooks/usePermissions';
import { FinancialSettings } from '@/components/settings/FinancialSettings';

export default function Settings() {
  const [tapTypeOpen, setTapTypeOpen] = useState(false);
  const [beerTypeOpen, setBeerTypeOpen] = useState(false);
  
  const { data: tapTypes } = useTapTypes();
  const { data: beerTypes } = useBeerTypes();
  const createBeerType = useCreateBeerType();
  const { profile, can } = usePermissions();
  const canManageSettings = can('settings', 'manage');

  const handleCreateTapType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const { error } = await supabase
      .from('tap_types')
      .insert({
        name: formData.get('name') as string,
        description: formData.get('description') as string || null,
      });

    if (error) {
      toast.error('Erro ao cadastrar tipo: ' + error.message);
    } else {
      toast.success('Tipo de chopeira cadastrado!');
      setTapTypeOpen(false);
    }
  };

  const handleCreateBeerType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await createBeerType.mutateAsync({
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      price_per_liter: Number(formData.get('price_per_liter')) || undefined,
      cost_per_liter: Number(formData.get('cost_per_liter')) || undefined,
      supplier: (formData.get('supplier') as string)?.trim() || undefined,
      code: (formData.get('code') as string)?.trim() || undefined,
    });
    
    setBeerTypeOpen(false);
  };

  const handleUpdateBeerType = async (id: string, field: 'code' | 'cost_per_liter' | 'supplier', rawValue: string) => {
    const value = field === 'cost_per_liter' ? (rawValue === '' ? null : Number(rawValue)) : (rawValue.trim() || null);
    const { error } = await supabase.from('beer_types').update({ [field]: value }).eq('id', id);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Tipo de chopp atualizado');
  };

  const handleUpdateBeerCode = async (id: string, code: string) => {
    const value = code.trim() || null;
    const { error } = await supabase.from('beer_types').update({ code: value }).eq('id', id);
    if (error) toast.error('Erro ao salvar código: ' + error.message);
    else toast.success('Código atualizado');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        <Tabs defaultValue="beer-types">
          <TabsList>
            <TabsTrigger value="beer-types">Tipos de Chopp</TabsTrigger>
            <TabsTrigger value="tap-types">Tipos de Chopeira</TabsTrigger>
            <TabsTrigger value="financial"><Landmark className="mr-2 h-4 w-4" />Financeiro</TabsTrigger>
            {profile?.role === 'admin' && <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Funcionários e Acessos</TabsTrigger>}
          </TabsList>

          <TabsContent value="beer-types" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tipos de Chopp</CardTitle>
                    <CardDescription>Configure os tipos de chopp e preços</CardDescription>
                  </div>
                  <Dialog open={beerTypeOpen} onOpenChange={setBeerTypeOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={!canManageSettings}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Tipo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Tipo de Chopp</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateBeerType} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Nome *</Label>
                          <Input id="name" name="name" required placeholder="Ex: Pilsen" />
                        </div>
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Input id="description" name="description" />
                        </div>
                        <div>
                          <Label htmlFor="price_per_liter">Preço por Litro (R$)</Label>
                          <Input 
                            id="price_per_liter" 
                            name="price_per_liter" 
                            type="number" 
                            step="0.01"
                            placeholder="12.00"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="cost_per_liter">Custo por Litro (R$)</Label>
                            <Input id="cost_per_liter" name="cost_per_liter" type="number" min="0" step="0.01" placeholder="8.00" />
                          </div>
                          <div>
                            <Label htmlFor="supplier">Fornecedor</Label>
                            <Input id="supplier" name="supplier" placeholder="Ex: Cervejaria X" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="code">Código do produto (NFe)</Label>
                          <Input id="code" name="code" placeholder="Ex: CHP001" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Código usado na emissão da NFe. Único quando preenchido.
                          </p>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setBeerTypeOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit">Cadastrar</Button>
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Preço/L</TableHead>
                      <TableHead>Custo/L</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Código (NFe)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {beerTypes?.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.description || '-'}</TableCell>
                        <TableCell>
                          {type.price_per_liter 
                            ? `R$ ${Number(type.price_per_liter).toFixed(2)}` 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" defaultValue={type.cost_per_liter ?? ''} placeholder="—" className="h-8 w-28" disabled={!canManageSettings} onBlur={(e) => {
                            if (e.target.value !== String(type.cost_per_liter ?? '')) handleUpdateBeerType(type.id, 'cost_per_liter', e.target.value);
                          }} />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={type.supplier || ''} placeholder="—" className="h-8 min-w-36" disabled={!canManageSettings} onBlur={(e) => {
                            if (e.target.value !== (type.supplier || '')) handleUpdateBeerType(type.id, 'supplier', e.target.value);
                          }} />
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={type.code || ''}
                            placeholder="—"
                            className="h-8 max-w-[140px]"
                            disabled={!canManageSettings}
                            onBlur={(e) => {
                              if ((e.target.value || '') !== (type.code || '')) {
                                handleUpdateBeerCode(type.id, e.target.value);
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tap-types" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tipos de Chopeira</CardTitle>
                    <CardDescription>Configure os tipos de chopeira disponíveis</CardDescription>
                  </div>
                  <Dialog open={tapTypeOpen} onOpenChange={setTapTypeOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={!canManageSettings}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Tipo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Tipo de Chopeira</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateTapType} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Nome *</Label>
                          <Input id="name" name="name" required placeholder="Ex: Chopeira Elétrica" />
                        </div>
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Input id="description" name="description" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setTapTypeOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit">Cadastrar</Button>
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tapTypes?.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <FinancialSettings canManage={canManageSettings} />
          </TabsContent>

          {profile?.role === 'admin' && <TabsContent value="users" className="space-y-4"><UserManagement /></TabsContent>}
        </Tabs>
      </div>
    </MainLayout>
  );
}
