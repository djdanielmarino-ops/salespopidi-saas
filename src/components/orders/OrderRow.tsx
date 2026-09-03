import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Order, Payment, OrderItem } from '@/types/database';
import { Phone, CreditCard, Eye, AlertCircle, Truck, Store, LogOut, LogIn } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';


const statusLabels: Record<string, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const statusColors: Record<string, string> = {
  agendado: 'bg-blue-500',
  em_andamento: 'bg-amber-500',
  finalizado: 'bg-green-500',
  cancelado: 'bg-red-500',
};

interface OrderRowProps {
  order: Order;
  onViewDetails: (order: Order) => void;
  onAddPayment: (order: Order) => void;
  onEdit: (order: Order) => void;
  onEquipmentOut: (orderId: string) => void;
  onReturn: (orderId: string) => void;
  onDelete: (orderId: string) => void;
}

export function OrderRow({ order, onViewDetails, onAddPayment, onEdit, onEquipmentOut, onReturn, onDelete }: OrderRowProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentsAndItems = async () => {
      const [paymentsResult, itemsResult] = await Promise.all([
        supabase.from('payments').select('*').eq('order_id', order.id),
        supabase.from('order_items').select('*, beer_types(*), barrel_models(*)').eq('order_id', order.id)
      ]);
      
      if (paymentsResult.data) setPayments(paymentsResult.data as Payment[]);
      if (itemsResult.data) setItems(itemsResult.data as OrderItem[]);
      setIsLoading(false);
    };

    fetchPaymentsAndItems();
  }, [order.id]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const isPaid = totalPaid >= Number(order.total);
  const hasPartialPayment = totalPaid > 0 && totalPaid < Number(order.total);




  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          #{order.order_number}
          {!isPaid && order.status !== 'cancelado' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pagamento pendente: R$ {(Number(order.total) - totalPaid).toFixed(2)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div>{order.customers?.full_name}</div>
          {order.customers?.phone && (
            <a href={`tel:${order.customers.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Phone className="h-3 w-3" />
              {order.customers.phone}
            </a>
          )}
        </div>
      </TableCell>
      <TableCell>
        {format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
        {order.delivery_time && ` ${order.delivery_time.slice(0, 5)}`}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {order.delivery_type === 'entrega' ? (
            <>
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>Entrega</span>
            </>
          ) : (
            <>
              <Store className="h-4 w-4 text-muted-foreground" />
              <span>Retirada</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>{order.taps?.code || '-'}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>R$ {Number(order.total).toFixed(2)}</span>
          {isPaid ? (
            <Badge variant="outline" className="text-xs text-green-600 border-green-600 w-fit">
              Pago
            </Badge>
          ) : hasPartialPayment ? (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600 w-fit">
              Parcial
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-destructive border-destructive w-fit">
              Pendente
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={statusColors[order.status]}>
          {statusLabels[order.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => onViewDetails(order)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => onAddPayment(order)}
                >
                  <CreditCard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adicionar pagamento</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {order.status === 'agendado' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-green-600 hover:text-green-700"
                    onClick={() => onEquipmentOut(order.id)}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Saída do equipamento</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {order.status === 'em_andamento' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => onReturn(order.id)}
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Entrada do equipamento</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}


        </div>
      </TableCell>
    </TableRow>
  );
}
