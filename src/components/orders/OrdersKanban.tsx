import { CalendarDays, CreditCard, Eye, LogIn, LogOut, Phone, Store, Truck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Order, OrderStatus } from '@/types/database';
import { getOrderPaymentStatus, orderPaymentStatusLabels } from '@/lib/orderPaymentStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const columns: { status: OrderStatus; label: string; accent: string }[] = [
  { status: 'agendado', label: 'Agendados', accent: 'border-t-blue-500' },
  { status: 'em_andamento', label: 'Em andamento', accent: 'border-t-amber-500' },
  { status: 'finalizado', label: 'Finalizados', accent: 'border-t-green-500' },
  { status: 'cancelado', label: 'Cancelados', accent: 'border-t-red-500' },
];

const paymentStyles = {
  pending: 'border-destructive text-destructive',
  partial: 'border-amber-600 text-amber-600',
  paid: 'border-green-600 text-green-600',
};

type Props = {
  orders: Order[];
  onView: (order: Order) => void;
  onPayment: (order: Order) => void;
  onEquipmentOut: (orderId: string) => void;
  onReturn: (orderId: string) => void;
};

export function OrdersKanban({ orders, onView, onPayment, onEquipmentOut, onReturn }: Props) {
  return <div className="grid min-w-[1050px] grid-cols-4 gap-4 overflow-x-auto pb-2">
    {columns.map((column) => {
      const columnOrders = orders.filter((order) => order.status === column.status);
      return <section key={column.status} className="rounded-lg bg-muted/35 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{column.label}</h3>
          <Badge variant="secondary">{columnOrders.length}</Badge>
        </div>
        <div className="space-y-3">
          {columnOrders.map((order) => {
            const paymentStatus = getOrderPaymentStatus(order);
            return <Card key={order.id} className={`border-t-4 ${column.accent}`}>
              <CardHeader className="space-y-2 p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Pedido #{order.order_number}</CardTitle>
                  <Badge variant="outline" className={paymentStyles[paymentStatus]}>{orderPaymentStatusLabels[paymentStatus]}</Badge>
                </div>
                <p className="line-clamp-2 font-medium">{order.customers?.full_name}</p>
                {order.customers?.phone && <a href={`tel:${order.customers.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" />{order.customers.phone}</a>}
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />{format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}{order.delivery_time ? ` às ${order.delivery_time.slice(0, 5)}` : ''}</div>
                <div className="flex items-center gap-2 text-muted-foreground">{order.delivery_type === 'entrega' ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}{order.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}</div>
                <div className="text-lg font-bold">R$ {Number(order.total).toFixed(2)}</div>
                <div className="flex flex-wrap gap-1 border-t pt-3">
                  <Button size="sm" variant="ghost" onClick={() => onView(order)}><Eye className="mr-1 h-4 w-4" />Detalhes</Button>
                  {order.status !== 'cancelado' && <Button size="sm" variant="ghost" onClick={() => onPayment(order)}><CreditCard className="mr-1 h-4 w-4" />Pagamento</Button>}
                  {order.status === 'agendado' && <Button size="sm" variant="ghost" className="text-green-700" onClick={() => onEquipmentOut(order.id)}><LogOut className="mr-1 h-4 w-4" />Saída</Button>}
                  {order.status === 'em_andamento' && <Button size="sm" variant="ghost" className="text-blue-700" onClick={() => onReturn(order.id)}><LogIn className="mr-1 h-4 w-4" />Entrada</Button>}
                </div>
              </CardContent>
            </Card>;
          })}
          {!columnOrders.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum pedido</div>}
        </div>
      </section>;
    })}
  </div>;
}
