import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAdjustProductStock, useCreateProduct, useProductReservations, useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { usePermissions } from '@/hooks/usePermissions';
import { PackagePlus, Plus } from 'lucide-react';

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const { data: reservations = {} } = useProductReservations();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const adjustStock = useAdjustProductStock();
  const { can } = usePermissions();
  const canManage = can('inventory', 'manage');
  const [createOpen, setCreateOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createProduct.mutateAsync({
      sku: String(form.get('sku') || '').trim() || null,
      name: String(form.get('name') || '').trim(),
      category: String(form.get('category') || '').trim() || null,
      unit: String(form.get('unit') || 'un').trim(),
      sale_price: Number(form.get('sale_price')) || 0,
      current_cost: Number(form.get('current_cost')) || 0,
      minimum_stock: Number(form.get('minimum_stock')) || 0,
      initial_stock: Number(form.get('initial_stock')) || 0,
      track_stock: form.get('track_stock') === 'on',
      is_active: true,
      notes: null,
    });
    setCreateOpen(false);
  };

  const handleStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adjustStock.mutateAsync({
      productId: stockProductId!,
      quantity: Number(form.get('quantity')),
      notes: String(form.get('notes') || '').trim() || undefined,
    });
    setStockProductId(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-3xl font-bold">Produtos</h1><p className="text-muted-foreground">Produtos avulsos, saldos e reservas de pedidos.</p></div>
          {canManage && <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo produto</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Cadastrar produto</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Nome *</Label><Input name="name" required /></div>
                <div><Label>SKU</Label><Input name="sku" /></div><div><Label>Categoria</Label><Input name="category" /></div>
                <div><Label>Unidade *</Label><Input name="unit" defaultValue="un" required /></div>
                <div><Label>Preço de venda</Label><Input name="sale_price" type="number" min="0" step="0.01" /></div>
                <div><Label>Custo atual</Label><Input name="current_cost" type="number" min="0" step="0.01" /></div>
                <div><Label>Estoque inicial</Label><Input name="initial_stock" type="number" min="0" step="0.001" /></div>
                <div><Label>Estoque mínimo</Label><Input name="minimum_stock" type="number" min="0" step="0.001" /></div>
                <label className="flex items-center gap-2 pt-6"><Switch name="track_stock" defaultChecked />Controlar estoque</label>
                <div className="sm:col-span-2 flex justify-end"><Button disabled={createProduct.isPending}>Salvar</Button></div>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <Card><CardHeader><CardTitle>Estoque de produtos</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Reservado</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{isLoading ? <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow> : products?.map(product => {
              const reserved = Number(reservations[product.id] || 0);
              const available = product.track_stock ? Number(product.stock_quantity) - reserved : 0;
              const low = product.track_stock && available <= Number(product.minimum_stock);
              return <TableRow key={product.id}>
                <TableCell><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.sku || 'Sem SKU'} · {product.unit}</div></TableCell>
                <TableCell>{product.category || '—'}</TableCell><TableCell className="text-right">R$ {Number(product.sale_price).toFixed(2)}</TableCell>
                <TableCell className="text-right">{product.track_stock ? Number(product.stock_quantity) : '—'}</TableCell><TableCell className="text-right">{product.track_stock ? reserved : '—'}</TableCell><TableCell className="text-right font-medium">{product.track_stock ? available : '—'}</TableCell>
                <TableCell>{!product.is_active ? <Badge variant="secondary">Inativo</Badge> : low ? <Badge variant="destructive">Estoque baixo</Badge> : <Badge>Ativo</Badge>}</TableCell>
                <TableCell className="text-right">{canManage && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setStockProductId(product.id)}><PackagePlus className="mr-2 h-4 w-4" />Ajustar</Button><Button size="sm" variant="ghost" onClick={() => updateProduct.mutate({ id: product.id, is_active: !product.is_active })}>{product.is_active ? 'Inativar' : 'Ativar'}</Button></div>}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </CardContent></Card>

        <Dialog open={!!stockProductId} onOpenChange={open => !open && setStockProductId(null)}><DialogContent><DialogHeader><DialogTitle>Ajustar estoque</DialogTitle></DialogHeader>
          <form onSubmit={handleStock} className="space-y-4"><div><Label>Quantidade</Label><Input name="quantity" type="number" step="0.001" required /><p className="text-xs text-muted-foreground">Use valor positivo para entrada e negativo para saída.</p></div><div><Label>Motivo</Label><Input name="notes" required /></div><div className="flex justify-end"><Button disabled={adjustStock.isPending}>Confirmar ajuste</Button></div></form>
        </DialogContent></Dialog>
      </div>
    </MainLayout>
  );
}
