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
import { useTaps, useTapTypes, useCreateTap, useUpdateTap } from '@/hooks/useEquipment';
import { Tap, EquipmentStatus } from '@/types/database';
import { Plus, Pencil, Beer } from 'lucide-react';

const statusLabels: Record<EquipmentStatus, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em Uso',
  manutencao: 'Manutenção',
};

const statusColors: Record<EquipmentStatus, string> = {
  disponivel: 'bg-green-500',
  em_uso: 'bg-amber-500',
  manutencao: 'bg-red-500',
};

export default function Taps() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTap, setEditingTap] = useState<Tap | null>(null);
  
  const { data: taps, isLoading } = useTaps();
  const { data: tapTypes } = useTapTypes();
  const createTap = useCreateTap();
  const updateTap = useUpdateTap();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const tapData = {
      code: formData.get('code') as string,
      tap_type_id: formData.get('tap_type_id') as string || null,
      notes: formData.get('notes') as string || undefined,
    };

    if (editingTap) {
      await updateTap.mutateAsync({ 
        id: editingTap.id, 
        ...tapData,
        status: formData.get('status') as EquipmentStatus,
      });
    } else {
      await createTap.mutateAsync(tapData);
    }
    
    setIsOpen(false);
    setEditingTap(null);
  };

  const openEdit = (tap: Tap) => {
    setEditingTap(tap);
    setIsOpen(true);
  };

  const openNew = () => {
    setEditingTap(null);
    setIsOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Chopeiras</h1>
            <p className="text-muted-foreground">Gerencie suas chopeiras</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Chopeira
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTap ? 'Editar Chopeira' : 'Nova Chopeira'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código *</Label>
                  <Input 
                    id="code" 
                    name="code" 
                    required 
                    defaultValue={editingTap?.code}
                    placeholder="Ex: CHOP-001"
                  />
                </div>
                
                <div>
                  <Label htmlFor="tap_type_id">Tipo</Label>
                  <Select name="tap_type_id" defaultValue={editingTap?.tap_type_id || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tapTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingTap && (
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={editingTap.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponivel">Disponível</SelectItem>
                        <SelectItem value="em_uso">Em Uso</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input 
                    id="notes" 
                    name="notes" 
                    defaultValue={editingTap?.notes || ''}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTap ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-500/10 p-3">
                  <Beer className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taps?.filter(t => t.status === 'disponivel').length || 0}</p>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-amber-500/10 p-3">
                  <Beer className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taps?.filter(t => t.status === 'em_uso').length || 0}</p>
                  <p className="text-sm text-muted-foreground">Em Uso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-red-500/10 p-3">
                  <Beer className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taps?.filter(t => t.status === 'manutencao').length || 0}</p>
                  <p className="text-sm text-muted-foreground">Manutenção</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taps?.map((tap) => (
                    <TableRow key={tap.id}>
                      <TableCell className="font-medium">{tap.code}</TableCell>
                      <TableCell>{tap.tap_types?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[tap.status]}>
                          {statusLabels[tap.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{tap.notes || '-'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tap)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
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
