import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useOrders, useReturnEquipment, useAddPayment, useOrderItems, useOrderProductItems, useOrderPayments, useUpdateOrderStatus, useDeleteOrder } from '@/hooks/useOrders';
import { Order, OrderItem, OrderStatus } from '@/types/database';
import { Columns3, FileText, LayoutList, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrderRow } from '@/components/orders/OrderRow';
import { OrderEditDialog } from '@/components/orders/OrderEditDialog';
import { EmitNFeButton } from '@/components/orders/EmitNFeButton';
import { PrintReceipt } from '@/components/orders/PrintReceipt';
import { PrintContract } from '@/components/orders/PrintContract';
import { calculatePaymentAmounts, usePaymentMethodConfigs } from '@/hooks/useFinancialAccounts';
import { CustomerFinancialPendingDialog } from '@/components/orders/CustomerFinancialPendingDialog';
import { CustomerPendingOrder, fetchCustomerPendingOrders } from '@/lib/customerFinancialPending';
import { toast } from 'sonner';
import { getOrderPaidAmount, getOrderPaymentStatus, OrderPaymentStatus } from '@/lib/orderPaymentStatus';
import { OrdersKanban } from '@/components/orders/OrdersKanban';
import { useTenant } from '@/contexts/TenantContext';


export default function Orders() {
  const { organization } = useTenant();
  const isBrewery = organization?.organization_type === 'brewery';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | OrderPaymentStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [consignedDialogOpen, setConsignedDialogOpen] = useState(false);
  const [consignedReturnOrder, setConsignedReturnOrder] = useState<Order | null>(null);
  const [consignedReturnItems, setConsignedReturnItems] = useState<OrderItem[]>([]);
  const [consignedConsumedByItem, setConsignedConsumedByItem] = useState<Record<string, number>>({});
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<CustomerPendingOrder[]>([]);
  const [pendingEquipmentOutOrder, setPendingEquipmentOutOrder] = useState<Order | null>(null);
  
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useOrders();
  const { data: configuredMethods } = usePaymentMethodConfigs();

  // Realtime: refresh orders list when nfe_status (or other fields) change
  useEffect(() => {
    const channel = supabase
      .channel('orders-nfe-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const returnEquipment = useReturnEquipment();
  const addPayment = useAddPayment();
  const updateOrderStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();
  const { data: orderItems } = useOrderItems(selectedOrder?.id || null);
  const { data: orderProductItems } = useOrderProductItems(selectedOrder?.id || null);
  const { data: orderPayments } = useOrderPayments(selectedOrder?.id || null);

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.customers?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      order.order_number.toString().includes(search);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || getOrderPaymentStatus(order) === paymentFilter;
    const matchesDelivery = deliveryFilter === 'all' || order.delivery_type === deliveryFilter;
    return matchesSearch && matchesStatus && matchesPayment && matchesDelivery;
  });

  const openDetails = (order: Order) => { setSelectedOrder(order); setDetailsDialogOpen(true); };
  const openPayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentAmount(Math.max(0, Number(order.total) - getOrderPaidAmount(order.payments)));
    setSelectedMethodId('');
    setPaymentDialogOpen(true);
  };

  const sendWebhook = async (order: Order, action: 'saida' | 'entrada') => {
    try {
      const payload = {
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
      };
      await supabase.functions.invoke('send-webhook', { body: payload });
    } catch (error) {
      console.error('Erro ao enviar webhook');
    }
  };

  const handleReturn = async (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    const { data: items } = await supabase
      .from('order_items')
      .select('*, beer_types(*), barrel_models(*)')
      .eq('order_id', orderId);

    const pendingConsigned = ((items || []) as OrderItem[]).filter((item) =>
      (item.consigned_barrel_quantity || 0) > 0 &&
      item.consigned_consumed_quantity === null &&
      item.consigned_returned_quantity === null
    );

    if (pendingConsigned.length > 0) {
      setConsignedReturnOrder(order || null);
      setConsignedReturnItems(pendingConsigned);
      setConsignedConsumedByItem(
        Object.fromEntries(
          pendingConsigned.map((item) => [item.id, item.consigned_barrel_quantity || 0]),
        ),
      );
      setConsignedDialogOpen(true);
      return;
    }

    if (confirm('Confirmar devolução dos equipamentos?')) {
      await returnEquipment.mutateAsync(orderId);
      if (order) await sendWebhook(order, 'entrada');
    }
  };

  const handleConfirmConsignedReturn = async () => {
    if (!consignedReturnOrder) return;

    const consignedResolutions = consignedReturnItems.map((item) => ({
      orderItemId: item.id,
      consumedQuantity: Math.max(
        0,
        Math.min(consignedConsumedByItem[item.id] ?? 0, item.consigned_barrel_quantity || 0),
      ),
    }));

    await returnEquipment.mutateAsync({
      orderId: consignedReturnOrder.id,
      consignedResolutions,
    });
    await sendWebhook(consignedReturnOrder, 'entrada');
    setConsignedDialogOpen(false);
    setConsignedReturnOrder(null);
    setConsignedReturnItems([]);
    setConsignedConsumedByItem({});
  };

  const confirmEquipmentOut = async (order: Order) => {
    await updateOrderStatus.mutateAsync({
      id: order.id,
      status: 'em_andamento' as OrderStatus,
      finalizeOnDispatch: isBrewery,
    });
    await sendWebhook(order, 'saida');
    setPendingDialogOpen(false);
    setPendingEquipmentOutOrder(null);
  };

  const handleEquipmentOut = async (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    if (!order) return;

    try {
      const pending = await fetchCustomerPendingOrders(order.customer_id, order.id);
      if (pending.length > 0) {
        setPendingOrders(pending);
        setPendingEquipmentOutOrder(order);
        setPendingDialogOpen(true);
        return;
      }
    } catch {
      toast.warning('Não foi possível verificar as pendências financeiras do cliente.');
    }

    const confirmation = isBrewery
      ? 'Confirmar expedição e concluir esta venda? O retorno dos barris será controlado separadamente pelo estoque.'
      : 'Confirmar saída dos equipamentos?';
    if (confirm(confirmation)) await confirmEquipmentOut(order);
  };

  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const formData = new FormData(e.currentTarget);
    const method = configuredMethods?.find(item => item.id === selectedMethodId);
    if (!method) return;

    await addPayment.mutateAsync({
      order_id: selectedOrder.id,
      payment_method_config_id: method.id,
      account_id: method.default_account_id,
      amount: Number(formData.get('amount')),
      notes: formData.get('notes') as string || undefined,
    });

    setPaymentDialogOpen(false);
  };


  const totalPaid = orderPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingBalance = selectedOrder ? Number(selectedOrder.total) - totalPaid : 0;
  const selectedMethod = configuredMethods?.find(method => method.id === selectedMethodId);
  const paymentPreview = calculatePaymentAmounts(paymentAmount, selectedMethod);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Pedidos</h1>
            <p className="text-muted-foreground">Gerencie todos os seus pedidos</p>
          </div>
          <Button asChild>
            <Link to="/orders/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou número..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={(value) => setPaymentFilter(value as 'all' | OrderPaymentStatus)}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os pagamentos</SelectItem><SelectItem value="pending">Pagamento pendente</SelectItem><SelectItem value="partial">Pagamento parcial</SelectItem><SelectItem value="paid">Pagamento pago</SelectItem></SelectContent>
              </Select>
              <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                <SelectTrigger className="w-[165px]"><SelectValue placeholder="Atendimento" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Entrega e retirada</SelectItem><SelectItem value="entrega">Entrega</SelectItem><SelectItem value="retirada">Retirada</SelectItem></SelectContent>
              </Select>
              </div>
              <div className="flex rounded-md border p-1" aria-label="Formato de visualização">
                <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><LayoutList className="mr-2 h-4 w-4" />Lista</Button>
                <Button size="sm" variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} onClick={() => setViewMode('kanban')} aria-pressed={viewMode === 'kanban'}><Columns3 className="mr-2 h-4 w-4" />Kanban</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Chopeira</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.map((order) => (
                    <OrderRow 
                      key={order.id} 
                      order={order}
                      onViewDetails={openDetails}
                      onAddPayment={openPayment}
                      onEdit={(order) => {
                        setSelectedOrder(order);
                        setEditDialogOpen(true);
                      }}
                      onEquipmentOut={handleEquipmentOut}
                      onReturn={handleReturn}
                      onDelete={async (orderId) => {
                        if (confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
                          await deleteOrder.mutateAsync(orderId);
                        }
                      }}
                      isBrewery={isBrewery}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="overflow-x-auto">
                <OrdersKanban orders={filteredOrders ?? []} onView={openDetails} onPayment={openPayment} onEquipmentOut={handleEquipmentOut} onReturn={handleReturn} isBrewery={isBrewery} />
              </div>
            )}
            {!isLoading && !filteredOrders?.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado com os filtros selecionados.</p>}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Pedido #{selectedOrder.order_number} - {selectedOrder.customers?.full_name}
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total do pedido:</span>
                  <span className="font-medium">R$ {Number(selectedOrder.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Já pago:</span>
                  <span className="font-medium">R$ {totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Saldo restante:</span>
                  <span>R$ {remainingBalance.toFixed(2)}</span>
                </div>

                <form onSubmit={handlePayment} className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="payment_method_config_id">Forma de Pagamento</Label>
                    <Select name="payment_method_config_id" value={selectedMethodId} onValueChange={setSelectedMethodId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {configuredMethods?.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount">Valor</Label>
                    <Input 
                      name="amount" 
                      type="number" 
                      step="0.01" 
                      min="0"
                      defaultValue={remainingBalance > 0 ? remainingBalance.toFixed(2) : ''}
                      onChange={(event) => setPaymentAmount(Number(event.target.value) || 0)}
                      required
                    />
                  </div>

                  {selectedMethod && <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Valor da venda</span><strong>R$ {paymentAmount.toFixed(2)}</strong></div>
                    <div className="flex justify-between"><span>Taxa calculada ({selectedMethod.fee_payer === 'company' ? 'empresa' : 'cliente'})</span><span>R$ {paymentPreview.calculatedFee.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Taxa descontada da empresa</span><span>R$ {paymentPreview.deductedFee.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold"><span>Líquido previsto na conta</span><span>R$ {paymentPreview.netAmount.toFixed(2)}</span></div>
                  </div>}

                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Input name="notes" />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Registrar Pagamento</Button>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Pedido #{selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Cliente</h4>
                    <p>{selectedOrder.customers?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.customers?.phone}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.customers?.email}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Entrega</h4>
                    <p>{format(parseISO(selectedOrder.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}
                    </p>
                    {selectedOrder.expected_return_date && (
                      <p className="text-sm text-muted-foreground">
                        Retorno: {format(parseISO(selectedOrder.expected_return_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    )}
                    {/* Delivery Address */}
                    {selectedOrder.delivery_type === 'entrega' && selectedOrder.delivery_address_street && (
                      <div className="mt-2 pt-2 border-t text-sm text-muted-foreground space-y-0.5">
                        <p className="font-medium text-foreground">Endereço de entrega:</p>
                        <p>
                          {selectedOrder.delivery_address_street}, {selectedOrder.delivery_address_number}
                          {selectedOrder.delivery_address_complement && ` - ${selectedOrder.delivery_address_complement}`}
                        </p>
                        <p>
                          {selectedOrder.delivery_address_neighborhood && `${selectedOrder.delivery_address_neighborhood}`}
                          {selectedOrder.delivery_address_city && ` - ${selectedOrder.delivery_address_city}`}
                          {selectedOrder.delivery_address_state && `/${selectedOrder.delivery_address_state}`}
                        </p>
                        {selectedOrder.delivery_address_zip_code && (
                          <p>CEP: {selectedOrder.delivery_address_zip_code}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Equipamentos</h4>
                  <div className="text-sm space-y-1">
                    {selectedOrder.taps && <p>Chopeira: {selectedOrder.taps.code}</p>}
                    {selectedOrder.cylinders && <p>Cilindro: {selectedOrder.cylinders.code}</p>}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Itens</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chopp</TableHead>
                        <TableHead>Qtd (L)</TableHead>
                        <TableHead>Preço/L</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.beer_types?.name}</TableCell>
                          <TableCell>{item.quantity_liters}</TableCell>
                          <TableCell>R$ {Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {Number(item.total_price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {orderProductItems && orderProductItems.length > 0 && <Table className="mt-3">
                    <TableHeader><TableRow><TableHead>Produto adicional</TableHead><TableHead>Quantidade</TableHead><TableHead>Preço unit.</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>{orderProductItems.map(item => <TableRow key={item.id}><TableCell>{item.product_name}</TableCell><TableCell>{Number(item.quantity)} {item.unit}</TableCell><TableCell>R$ {Number(item.unit_price).toFixed(2)}</TableCell><TableCell className="text-right">R$ {Number(item.total_price).toFixed(2)}</TableCell></TableRow>)}</TableBody>
                  </Table>}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Pagamentos</h4>
                  {orderPayments && orderPayments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Forma</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {payment.payment_date && format(parseISO(payment.payment_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              {configuredMethods?.find(m => m.id === payment.payment_method_config_id)?.name || payment.payment_method}
                            </TableCell>
                            <TableCell className="text-right">R$ {Number(payment.amount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                  )}
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <span className="font-bold">Total do Pedido:</span>
                  <span className="font-bold">R$ {Number(selectedOrder.total).toFixed(2)}</span>
                </div>

                <DialogFooter className="flex flex-wrap gap-2 sm:justify-end pt-4 border-t">
                  {selectedOrder.status !== 'finalizado' && selectedOrder.status !== 'cancelado' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailsDialogOpen(false);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const { handlePrint } = PrintReceipt({
                        order: selectedOrder,
                        items: orderItems || [],
                        payments: orderPayments || [],
                      });
                      handlePrint();
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Recibo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const { handlePrint } = PrintContract({
                        order: selectedOrder,
                        items: orderItems || [],
                      });
                      handlePrint();
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Contrato
                  </Button>
                  {selectedOrder.status !== 'cancelado' && (
                    <EmitNFeButton order={selectedOrder} />
                  )}
                  {selectedOrder.status === 'agendado' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
                          await deleteOrder.mutateAsync(selectedOrder.id);
                          setDetailsDialogOpen(false);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Consigned Return Dialog */}
        <Dialog open={consignedDialogOpen} onOpenChange={setConsignedDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Entrada de Consignado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe quantos barris consignados foram consumidos. O restante volta para o estoque como cheio.
              </p>
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
                  {consignedReturnItems.map((item) => {
                    const consignedQuantity = item.consigned_barrel_quantity || 0;
                    const consumedQuantity = consignedConsumedByItem[item.id] ?? 0;
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
                            onChange={(e) => setConsignedConsumedByItem((current) => ({
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


        {/* Edit Dialog */}
        <OrderEditDialog 
          order={selectedOrder}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      </div>

      <CustomerFinancialPendingDialog
        open={pendingDialogOpen}
        customerName={pendingEquipmentOutOrder?.customers?.full_name}
        orders={pendingOrders}
        isContinuing={updateOrderStatus.isPending}
        onOpenChange={(open) => {
          setPendingDialogOpen(open);
          if (!open) setPendingEquipmentOutOrder(null);
        }}
        onContinue={() => pendingEquipmentOutOrder && confirmEquipmentOut(pendingEquipmentOutOrder)}
      />
    </MainLayout>
  );
}
