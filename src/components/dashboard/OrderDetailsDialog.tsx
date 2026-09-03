import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarOrder } from '@/hooks/useCalendarOrders';
import { OrderEditDialog } from '@/components/orders/OrderEditDialog';
import { EmitNFeButton } from '@/components/orders/EmitNFeButton';
import { OrderStatusActions } from '@/components/orders/OrderStatusActions';
import { PrintContract } from '@/components/orders/PrintContract';
import { PrintReceipt } from '@/components/orders/PrintReceipt';
import { useOrderPayments } from '@/hooks/useOrders';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Phone,
  MapPin,
  Package,
  Beer,
  Truck,
  Store,
  User,
  Settings,
  Printer,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface OrderDetailsDialogProps {
  order: CalendarOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsDialog({ order, open, onOpenChange }: OrderDetailsDialogProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { data: payments = [] } = useOrderPayments(order?.id || null);

  if (!order) return null;

  const orderItems = order.order_items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'agendado':
        return <Badge variant="secondary">Agendado</Badge>;
      case 'em_andamento':
        return <Badge>Em andamento</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Group items by barrel volume
  const barrelSummary = orderItems.reduce((acc, item) => {
    const volume = item.barrel_models?.volume || 0;
    const quantity = item.barrel_quantity || 1;
    if (!acc[volume]) {
      acc[volume] = { quantity: 0, liters: 0, beers: [] as string[] };
    }
    acc[volume].quantity += quantity;
    acc[volume].liters += item.quantity_liters;
    if (item.beer_types?.name && !acc[volume].beers.includes(item.beer_types.name)) {
      acc[volume].beers.push(item.beer_types.name);
    }
    return acc;
  }, {} as Record<number, { quantity: number; liters: number; beers: string[] }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Pedido #{order.order_number}</span>
            {getStatusBadge(order.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{order.customers?.full_name}</p>
              {order.customers?.phone && (
                <a 
                  href={`tel:${order.customers.phone}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  {order.customers.phone}
                </a>
              )}
            </div>
          </div>

          {/* Data e hora */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {format(parseISO(order.delivery_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
              {order.delivery_time && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {order.delivery_time.slice(0, 5)}
                </p>
              )}
            </div>
          </div>

          {/* Tipo de entrega */}
          <div className="flex items-start gap-3">
            {order.delivery_type === 'entrega' ? (
              <>
                <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Entrega</p>
                  {order.delivery_address_street && (
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        {order.delivery_address_street}, {order.delivery_address_number}
                        {order.delivery_address_complement && ` - ${order.delivery_address_complement}`}
                      </p>
                      <p>
                        {order.delivery_address_neighborhood && `${order.delivery_address_neighborhood}`}
                        {order.delivery_address_city && ` - ${order.delivery_address_city}`}
                        {order.delivery_address_state && `/${order.delivery_address_state}`}
                      </p>
                      {order.delivery_address_zip_code && (
                        <p>CEP: {order.delivery_address_zip_code}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Store className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium">Retirada na loja</p>
              </>
            )}
          </div>

          {/* Equipamentos */}
          <div className="flex items-start gap-3">
            <Beer className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Equipamentos</p>
              {order.taps && (
                <p className="text-sm text-muted-foreground">
                  Chopeira: {order.taps.code} 
                  {order.taps.tap_types?.name && ` (${order.taps.tap_types.name})`}
                </p>
              )}
              {order.cylinders && (
                <p className="text-sm text-muted-foreground">
                  Cilindro: {order.cylinders.code}
                </p>
              )}
            </div>
          </div>

          {/* Barris/Chopp */}
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Chopp</p>
              {barrelSummary && Object.entries(barrelSummary)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([volume, data]) => (
                  <div key={volume} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{data.quantity}x</span> Barril {volume}L
                    <span className="text-xs ml-1">({data.beers.join(', ')})</span>
                  </div>
                ))}
              <div className="mt-1 text-sm font-medium">
                Total: {orderItems.reduce((sum, item) => sum + item.quantity_liters, 0)}L
              </div>
            </div>
          </div>

          {/* Valores */}
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span>R$ {Number(order.delivery_fee).toFixed(2)}</span>
              </div>
            )}
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>- R$ {Number(order.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold mt-2">
              <span>Total</span>
              <span>R$ {Number(order.total || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Ações */}
          <div className="pt-2 grid gap-2 sm:grid-cols-2">
            <Button className="w-full" onClick={() => setEditOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Editar pedido
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const { handlePrint } = PrintReceipt({
                  order,
                  items: orderItems,
                  payments,
                });
                handlePrint();
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir recibo
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const { handlePrint } = PrintContract({
                  order,
                  items: orderItems,
                });
                handlePrint();
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Imprimir contrato
            </Button>
            <OrderStatusActions order={order} className="w-full" />
            <Button asChild variant="outline" className="w-full">
              <Link to="/orders">Ver todos os pedidos</Link>
            </Button>
          </div>
          <div className="pt-1">
            <EmitNFeButton order={order} />
          </div>
        </div>
      </DialogContent>

      <OrderEditDialog
        order={order}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Dialog>
  );
}
