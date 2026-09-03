import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, Truck, Store } from 'lucide-react';
import type { CustomerOrder } from '@/hooks/useCustomerHistory';
import { paidForOrder } from '@/hooks/useCustomerHistory';
import { CustomerOrderDetailsDialog } from './CustomerOrderDetailsDialog';

const PAGE_SIZE = 10;

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<string, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};
const statusColor: Record<string, string> = {
  agendado: 'bg-blue-500',
  em_andamento: 'bg-amber-500',
  finalizado: 'bg-green-500',
  cancelado: 'bg-red-500',
};

function totalLitersOf(o: CustomerOrder): number {
  return (o.order_items ?? []).reduce(
    (s, it) => s + Number(it.quantity_liters || 0),
    0,
  );
}

export function CustomerOrders({ orders }: { orders: CustomerOrder[] }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerOrder | null>(null);

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [orders, page],
  );

  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Este cliente ainda não possui compras vinculadas.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Litros</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead className="w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  {new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="font-medium">#{o.order_number}</TableCell>
                <TableCell>{totalLitersOf(o)} L</TableCell>
                <TableCell>{brl(Number(o.total || 0))}</TableCell>
                <TableCell>
                  <Badge className={statusColor[o.status]}>{statusLabel[o.status]}</Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {o.delivery_type === 'entrega' ? (
                      <>
                        <Truck className="h-4 w-4 text-muted-foreground" /> Entrega
                      </>
                    ) : (
                      <>
                        <Store className="h-4 w-4 text-muted-foreground" /> Retirada
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(o)}>
                    <Eye className="mr-1 h-4 w-4" /> Detalhes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {pageItems.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSelected(o)}
            className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">#{o.order_number}</span>
              <Badge className={statusColor[o.status]}>{statusLabel[o.status]}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
              <div>
                {new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </div>
              <div>{totalLitersOf(o)} L</div>
              <div>{brl(Number(o.total || 0))}</div>
              <div>{o.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}</div>
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} — {orders.length} pedidos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <CustomerOrderDetailsDialog
        order={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        paidAmount={selected ? paidForOrder(selected) : 0}
      />
    </>
  );
}
