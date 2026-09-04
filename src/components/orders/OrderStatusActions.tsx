import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useReturnEquipment, useUpdateOrderStatus } from '@/hooks/useOrders';
import { OrderItem, OrderStatus } from '@/types/database';
import { CustomerFinancialPendingDialog } from '@/components/orders/CustomerFinancialPendingDialog';
import { CustomerPendingOrder, fetchCustomerPendingOrders } from '@/lib/customerFinancialPending';
import { toast } from 'sonner';
import { useTenant } from '@/contexts/TenantContext';

interface OrderStatusActionsOrder {
  id: string;
  customer_id: string;
  status: string;
  order_number?: number;
  delivery_date?: string;
  delivery_type?: string;
  total?: number | string | null;
  customers?: { full_name?: string; phone?: string | null } | null;
  taps?: { code?: string } | null;
  cylinders?: { code?: string } | null;
}

interface OrderStatusActionsProps {
  order: OrderStatusActionsOrder;
  className?: string;
}

export function OrderStatusActions({ order, className }: OrderStatusActionsProps) {
  const { organization } = useTenant();
  const isBrewery = organization?.organization_type === 'brewery';
  const [consignedDialogOpen, setConsignedDialogOpen] = useState(false);
  const [consignedItems, setConsignedItems] = useState<OrderItem[]>([]);
  const [consumedByItem, setConsumedByItem] = useState<Record<string, number>>({});
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<CustomerPendingOrder[]>([]);

  const returnEquipment = useReturnEquipment();
  const updateOrderStatus = useUpdateOrderStatus();

  const sendWebhook = async (action: 'saida' | 'entrada') => {
    try {
      await supabase.functions.invoke('send-webhook', {
        body: {
          action,
          order_id: order.id,
          order_number: order.order_number,
          customer: order.customers?.full_name,
          customer_phone: order.customers?.phone,
          delivery_date: order.delivery_date,
          delivery_type: order.delivery_type,
          tap: order.taps?.code || null,
          cylinder: order.cylinders?.code || null,
          total: order.total,
          status: action === 'saida' && !isBrewery ? 'em_andamento' : 'finalizado',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      console.error('Erro ao enviar webhook');
    }
  };

  const confirmEquipmentOut = async () => {
    await updateOrderStatus.mutateAsync({
      id: order.id,
      status: 'em_andamento' as OrderStatus,
      finalizeOnDispatch: isBrewery,
    });
    await sendWebhook('saida');
    setPendingDialogOpen(false);
  };

  const handleEquipmentOut = async () => {
    try {
      const pending = await fetchCustomerPendingOrders(order.customer_id, order.id);
      if (pending.length > 0) {
        setPendingOrders(pending);
        setPendingDialogOpen(true);
        return;
      }
    } catch {
      toast.warning('Não foi possível verificar as pendências financeiras do cliente.');
    }

    const confirmation = isBrewery
      ? 'Confirmar expedição e concluir esta venda? O retorno dos barris será controlado separadamente pelo estoque.'
      : 'Confirmar saída dos equipamentos?';
    if (!confirm(confirmation)) return;
    await confirmEquipmentOut();
  };

  const handleReturn = async () => {
    const { data: items } = await supabase
      .from('order_items')
      .select('*, beer_types(*), barrel_models(*)')
      .eq('order_id', order.id);

    const pendingConsigned = ((items || []) as OrderItem[]).filter((item) =>
      (item.consigned_barrel_quantity || 0) > 0 &&
      item.consigned_consumed_quantity === null &&
      item.consigned_returned_quantity === null
    );

    if (pendingConsigned.length > 0) {
      setConsignedItems(pendingConsigned);
      setConsumedByItem(
        Object.fromEntries(
          pendingConsigned.map((item) => [item.id, item.consigned_barrel_quantity || 0]),
        ),
      );
      setConsignedDialogOpen(true);
      return;
    }

    if (confirm('Confirmar devolução dos equipamentos?')) {
      await returnEquipment.mutateAsync(order.id);
      await sendWebhook('entrada');
    }
  };

  const handleConfirmConsignedReturn = async () => {
    const consignedResolutions = consignedItems.map((item) => ({
      orderItemId: item.id,
      consumedQuantity: Math.max(
        0,
        Math.min(consumedByItem[item.id] ?? 0, item.consigned_barrel_quantity || 0),
      ),
    }));

    await returnEquipment.mutateAsync({ orderId: order.id, consignedResolutions });
    await sendWebhook('entrada');
    setConsignedDialogOpen(false);
    setConsignedItems([]);
    setConsumedByItem({});
  };

  if (order.status !== 'agendado' && order.status !== 'em_andamento') return null;

  return (
    <>
      {order.status === 'agendado' ? (
        <Button
          variant="outline"
          className={className}
          onClick={handleEquipmentOut}
          disabled={updateOrderStatus.isPending}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isBrewery ? 'Expedir e concluir venda' : 'Saída do equipamento'}
        </Button>
      ) : !isBrewery ? (
        <Button
          variant="outline"
          className={className}
          onClick={handleReturn}
          disabled={returnEquipment.isPending}
        >
          <LogIn className="h-4 w-4 mr-2" />
          Entrada do equipamento
        </Button>
      ) : null}

      <Dialog open={consignedDialogOpen} onOpenChange={setConsignedDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entrada de Consignado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe quantos barris consignados foram consumidos. O restante volta para o estoque como cheio.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chopp</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Consignado</TableHead>
                    <TableHead>Consumido</TableHead>
                    <TableHead>Volta cheio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consignedItems.map((item) => {
                    const consignedQuantity = item.consigned_barrel_quantity || 0;
                    const consumedQuantity = consumedByItem[item.id] ?? 0;
                    const returnedFull = Math.max(0, consignedQuantity - consumedQuantity);
                    const totalBarrels = item.barrel_quantity || consignedQuantity || 1;
                    const volume = item.barrel_models?.volume || Math.round(Number(item.quantity_liters) / totalBarrels);

                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.beer_types?.name}</TableCell>
                        <TableCell>{volume}L</TableCell>
                        <TableCell>{consignedQuantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={consignedQuantity}
                            value={consumedQuantity}
                            onChange={(e) => setConsumedByItem((current) => ({
                              ...current,
                              [item.id]: Number(e.target.value) || 0,
                            }))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>{returnedFull}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConsignedDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirmConsignedReturn} disabled={returnEquipment.isPending}>
                Confirmar Entrada
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerFinancialPendingDialog
        open={pendingDialogOpen}
        customerName={order.customers?.full_name}
        orders={pendingOrders}
        isContinuing={updateOrderStatus.isPending}
        onOpenChange={setPendingDialogOpen}
        onContinue={confirmEquipmentOut}
      />
    </>
  );
}
