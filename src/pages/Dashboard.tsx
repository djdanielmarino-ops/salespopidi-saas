import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveOrders } from '@/hooks/useOrders';
import { useTaps } from '@/hooks/useEquipment';
import { useBarrelSummary } from '@/hooks/useBarrelInventory';
import { useCylinderSummary } from '@/hooks/useCylinderInventory';
import { supabase } from '@/integrations/supabase/client';
import { Payment } from '@/types/database';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import { OrderDetailsDialog } from '@/components/dashboard/OrderDetailsDialog';
import { 
  Beer, 
  Package, 
  Cylinder as CylinderIcon, 
  ShoppingCart,
  Phone,
  Calendar,
  Clock,
  ArrowRight,
  AlertCircle,
  Truck,
  Store,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { data: activeOrders, isLoading: loadingOrders } = useActiveOrders();
  const { data: taps } = useTaps();
  const { data: barrelSummary } = useBarrelSummary();
  const { data: cylinderSummary } = useCylinderSummary();
  const [orderPayments, setOrderPayments] = useState<Record<string, Payment[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  // Fetch payments for all active orders
  useEffect(() => {
    const fetchPayments = async () => {
      if (!activeOrders?.length) return;
      
      const { data } = await supabase
        .from('payments')
        .select('*')
        .in('order_id', activeOrders.map(o => o.id));
      
      if (data) {
        const grouped: Record<string, Payment[]> = {};
        data.forEach(payment => {
          if (!grouped[payment.order_id]) grouped[payment.order_id] = [];
          grouped[payment.order_id].push(payment as Payment);
        });
        setOrderPayments(grouped);
      }
    };
    
    fetchPayments();
  }, [activeOrders]);

  const tapsInUse = taps?.filter(t => t.status === 'em_uso').length || 0;
  const tapsAvailable = taps?.filter(t => t.status === 'disponivel').length || 0;
  
  // Barrel totals from summary
  const barrelTotals = barrelSummary?.reduce((acc, s) => ({
    cheio_loja: acc.cheio_loja + s.cheio_loja,
    com_cliente: acc.com_cliente + s.com_cliente,
    vazio_loja: acc.vazio_loja + s.vazio_loja,
    na_cervejaria: acc.na_cervejaria + s.na_cervejaria,
  }), { cheio_loja: 0, com_cliente: 0, vazio_loja: 0, na_cervejaria: 0 });
  
  // Cylinder totals from summary
  const cylinderTotals = cylinderSummary?.reduce((acc, s) => ({
    cheio: acc.cheio + s.cheio,
    com_cliente: acc.com_cliente + s.com_cliente,
    vazio: acc.vazio + s.vazio,
  }), { cheio: 0, com_cliente: 0, vazio: 0 });

  const cylindersFull = cylinderTotals?.cheio || 0;
  const cylindersWithClient = cylinderTotals?.com_cliente || 0;
  const cylindersEmpty = cylinderTotals?.vazio || 0;

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const scheduledOrdersThisWeek = (activeOrders || [])
    .filter((order) => order.status === 'agendado')
    .filter((order) => isWithinInterval(parseISO(order.delivery_date), {
      start: currentWeekStart,
      end: currentWeekEnd,
    }))
    .sort((a, b) => {
      const dateA = `${a.delivery_date} ${a.delivery_time || '00:00'}`;
      const dateB = `${b.delivery_date} ${b.delivery_time || '00:00'}`;
      return dateA.localeCompare(dateB);
    });

  const openOrderDialog = (order: any) => {
    setSelectedOrder(order);
    setOrderDialogOpen(true);
  };

  // Get payment status for an order
  const getPaymentStatus = (orderId: string, total: number) => {
    const payments = orderPayments[orderId] || [];
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      isPaid: totalPaid >= total,
      hasPartial: totalPaid > 0 && totalPaid < total,
      remaining: total - totalPaid
    };
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do seu negócio</p>
          </div>
          <Button asChild>
            <Link to="/orders/new">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Novo Pedido
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chopeiras</CardTitle>
              <Beer className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tapsInUse} em uso</div>
              <p className="text-xs text-muted-foreground">
                {tapsAvailable} disponíveis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Barris</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(barrelTotals?.cheio_loja || 0) + (barrelTotals?.com_cliente || 0) + (barrelTotals?.vazio_loja || 0) + (barrelTotals?.na_cervejaria || 0)} total</div>
              <p className="text-xs text-muted-foreground">
                {barrelTotals?.cheio_loja || 0} cheios | {barrelTotals?.vazio_loja || 0} vazios | {barrelTotals?.com_cliente || 0} c/ cliente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cilindros</CardTitle>
              <CylinderIcon className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cylindersFull + cylindersWithClient + cylindersEmpty} total</div>
              <p className="text-xs text-muted-foreground">
                {cylindersFull} disponíveis | {cylindersWithClient} c/ cliente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Ativos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scheduledOrdersThisWeek.length}</div>
              <p className="text-xs text-muted-foreground">
                agendados nesta semana
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Orders */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Próximas encomendas</CardTitle>
              <Link to="/orders">
                <Button variant="ghost" size="sm">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : scheduledOrdersThisWeek.length > 0 ? (
                <div className="space-y-4">
                  {scheduledOrdersThisWeek.map((order) => {
                    const paymentStatus = getPaymentStatus(order.id, Number(order.total));
                    
                    return (
                      <div key={order.id} className="flex items-start justify-between gap-4 border-b pb-4 last:border-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{order.customers?.full_name}</span>
                            <Badge variant={order.status === 'agendado' ? 'secondary' : 'default'}>
                              {order.status === 'agendado' ? 'Agendado' : 'Em andamento'}
                            </Badge>
                            
                            {/* Payment Status */}
                            {paymentStatus.isPaid ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Pago
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-destructive border-destructive">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Pendente
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Falta: R$ {paymentStatus.remaining.toFixed(2)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Delivery Type */}
                            <Badge variant="outline" className="text-muted-foreground">
                              {order.delivery_type === 'entrega' ? (
                                <><Truck className="h-3 w-3 mr-1" /> Entrega</>
                              ) : (
                                <><Store className="h-3 w-3 mr-1" /> Retirada</>
                              )}
                            </Badge>

                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            {order.delivery_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {order.delivery_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.taps && <span>Chopeira: {order.taps.code}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {order.customers?.phone && (
                            <a 
                              href={`tel:${order.customers.phone}`}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {order.customers.phone}
                            </a>
                          )}
                          {order.expected_return_date && (
                            <span className="text-xs text-muted-foreground">
                              Retorno: {format(parseISO(order.expected_return_date), 'dd/MM', { locale: ptBR })}
                            </span>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openOrderDialog(order)}>
                            Acessar pedido
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhuma encomenda agendada para esta semana</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Beer className="h-4 w-4" /> Chopeiras
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg bg-green-500/10 p-2 text-center">
                      <div className="font-bold text-green-600">{tapsAvailable}</div>
                      <div className="text-muted-foreground">Disponível</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                      <div className="font-bold text-amber-600">{tapsInUse}</div>
                      <div className="text-muted-foreground">Em uso</div>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-2 text-center">
                      <div className="font-bold text-red-600">{taps?.filter(t => t.status === 'manutencao').length || 0}</div>
                      <div className="text-muted-foreground">Manutenção</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Barris
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-green-500/10 p-2 text-center">
                      <div className="font-bold text-green-600">{barrelTotals?.cheio_loja || 0}</div>
                      <div className="text-muted-foreground">Cheios na loja</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                      <div className="font-bold text-amber-600">{barrelTotals?.com_cliente || 0}</div>
                      <div className="text-muted-foreground">Com cliente</div>
                    </div>
                    <div className="rounded-lg bg-gray-500/10 p-2 text-center">
                      <div className="font-bold text-gray-600">{barrelTotals?.vazio_loja || 0}</div>
                      <div className="text-muted-foreground">Vazios na loja</div>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                      <div className="font-bold text-blue-600">{barrelTotals?.na_cervejaria || 0}</div>
                      <div className="text-muted-foreground">Na cervejaria</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CylinderIcon className="h-4 w-4" /> Cilindros
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg bg-green-500/10 p-2 text-center">
                      <div className="font-bold text-green-600">{cylindersFull}</div>
                      <div className="text-muted-foreground">Disponíveis</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                      <div className="font-bold text-amber-600">{cylindersWithClient}</div>
                      <div className="text-muted-foreground">Com cliente</div>
                    </div>
                    <div className="rounded-lg bg-gray-500/10 p-2 text-center">
                      <div className="font-bold text-gray-600">{cylindersEmpty}</div>
                      <div className="text-muted-foreground">Vazios</div>
                    </div>
                  </div>
                </div>

                {/* Barrels by volume */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Barris Cheios por Volume
                  </h4>
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {barrelSummary?.map(item => (
                      <div key={item.model.id} className="rounded-lg bg-primary/10 p-2 text-center">
                        <div className="font-bold text-primary">{item.cheio_loja}</div>
                        <div className="text-muted-foreground text-xs">{item.model.volume}L</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <DashboardCalendar />

        <OrderDetailsDialog
          order={selectedOrder}
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
