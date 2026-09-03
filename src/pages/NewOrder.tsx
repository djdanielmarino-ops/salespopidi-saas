import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useCustomers } from '@/hooks/useCustomers';
import { useAvailableTapsForPeriod, useTapTypes, useBeerTypes } from '@/hooks/useEquipment';
import { useCylinderModels, useCylinderSummary } from '@/hooks/useCylinderInventory';
import { useBarrelModels } from '@/hooks/useBarrelInventory';
import { useCreateOrder } from '@/hooks/useOrders';
import { DeliveryType, Customer } from '@/types/database';
import { Plus, Trash2, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog';
import { CustomerSearchCombobox } from '@/components/orders/CustomerSearchCombobox';
import { fetchAddressByCep } from '@/lib/viacep';
import { toast } from 'sonner';
import { useProductReservations, useProducts } from '@/hooks/useProducts';
import { CustomerFinancialPendingDialog } from '@/components/orders/CustomerFinancialPendingDialog';
import { CustomerPendingOrder, fetchCustomerPendingOrders } from '@/lib/customerFinancialPending';

interface OrderItemForm {
  beer_type_id: string;
  barrel_model_id: string;
  barrel_volume: number;
  sold_barrel_quantity: number;
  consigned_barrel_quantity: number;
  unit_price: number;
}

interface ProductItemForm { product_id: string; quantity: number; unit_price: number; }

const BARREL_VOLUMES = [10, 15, 20, 30, 50] as const;

export default function NewOrder() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('entrega');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [tapId, setTapId] = useState('');
  const [selectedTapTypeId, setSelectedTapTypeId] = useState<string>('');
  const [cylinderModelId, setCylinderModelId] = useState('');
  const [cylinderQuantity, setCylinderQuantity] = useState(1);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItemForm[]>([{ beer_type_id: '', barrel_model_id: '', barrel_volume: 30, sold_barrel_quantity: 1, consigned_barrel_quantity: 0, unit_price: 0 }]);
  const [productItems, setProductItems] = useState<ProductItemForm[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [loadingCep, setLoadingCep] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<CustomerPendingOrder[]>([]);
  
  // Delivery address
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [deliveryComplement, setDeliveryComplement] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryZipCode, setDeliveryZipCode] = useState('');

  const { data: customers } = useCustomers();
  const { data: taps } = useAvailableTapsForPeriod(deliveryDate, expectedReturnDate);
  const { data: tapTypes } = useTapTypes();
  const { data: cylinderModels } = useCylinderModels();
  const { data: cylinderSummary } = useCylinderSummary();
  const { data: beerTypes } = useBeerTypes();
  const { data: barrelModels } = useBarrelModels();
  const { data: products } = useProducts(true);
  const { data: productReservations = {} } = useProductReservations();
  const createOrder = useCreateOrder();

  const selectedCustomer = customers?.find(c => c.id === customerId);
  const filteredTaps = selectedTapTypeId 
    ? taps?.filter(t => t.tap_type_id === selectedTapTypeId) 
    : taps;

  useEffect(() => {
    if (tapId && deliveryDate && taps && !taps.some((tap) => tap.id === tapId)) {
      setTapId('');
    }
  }, [deliveryDate, expectedReturnDate, tapId, taps]);

  const addItem = () => {
    setItems([...items, { beer_type_id: '', barrel_model_id: '', barrel_volume: 30, sold_barrel_quantity: 1, consigned_barrel_quantity: 0, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItemForm, value: string | number) => {
    const newItems = [...items];
    if (field === 'beer_type_id') {
      newItems[index][field] = value as string;
      const beerType = beerTypes?.find(b => b.id === value);
      if (beerType?.price_per_liter) {
        newItems[index].unit_price = beerType.price_per_liter;
      }
    } else {
      (newItems[index] as any)[field] = Number(value);
    }
    setItems(newItems);
  };

  const getItemTotal = (item: OrderItemForm) => {
    return item.barrel_volume * item.sold_barrel_quantity * item.unit_price;
  };

  const getItemConsignedTotal = (item: OrderItemForm) => {
    return item.barrel_volume * item.consigned_barrel_quantity * item.unit_price;
  };

  const subtotalValue = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const productsSubtotal = productItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const consignedPendingValue = items.reduce((sum, item) => sum + getItemConsignedTotal(item), 0);
  const totalValue = subtotalValue + productsSubtotal + deliveryFee - discount;

  const handleCustomerCreated = (customer: Customer) => {
    setCustomerId(customer.id);
  };

  const copyCustomerAddress = () => {
    if (selectedCustomer) {
      setDeliveryStreet(selectedCustomer.street || '');
      setDeliveryNumber(selectedCustomer.number || '');
      setDeliveryComplement(selectedCustomer.complement || '');
      setDeliveryNeighborhood(selectedCustomer.neighborhood || '');
      setDeliveryCity(selectedCustomer.city || '');
      setDeliveryState(selectedCustomer.state || '');
      setDeliveryZipCode(selectedCustomer.zip_code || '');
    }
  };

  const createCurrentOrder = async () => {
    await createOrder.mutateAsync({
      customer_id: customerId,
      delivery_type: deliveryType,
      delivery_date: deliveryDate,
      delivery_time: deliveryTime || undefined,
      tap_id: tapId || undefined,
      cylinder_model_id: cylinderModelId || undefined,
      cylinder_quantity: cylinderQuantity || undefined,
      expected_return_date: expectedReturnDate || undefined,
      notes: notes || undefined,
      subtotal: subtotalValue + productsSubtotal,
      delivery_fee: deliveryFee,
      discount: discount,
      total: totalValue,
      delivery_address_street: deliveryType === 'entrega' ? deliveryStreet : undefined,
      delivery_address_number: deliveryType === 'entrega' ? deliveryNumber : undefined,
      delivery_address_complement: deliveryType === 'entrega' ? deliveryComplement : undefined,
      delivery_address_neighborhood: deliveryType === 'entrega' ? deliveryNeighborhood : undefined,
      delivery_address_city: deliveryType === 'entrega' ? deliveryCity : undefined,
      delivery_address_state: deliveryType === 'entrega' ? deliveryState : undefined,
      delivery_address_zip_code: deliveryType === 'entrega' ? deliveryZipCode : undefined,
      items: items.filter(i => i.beer_type_id && (i.sold_barrel_quantity + i.consigned_barrel_quantity) > 0).map(i => {
        // Resolve barrel_model_id from volume
        const matchingModel = barrelModels?.find(m => m.volume === i.barrel_volume);
        const totalBarrels = i.sold_barrel_quantity + i.consigned_barrel_quantity;
        return {
          beer_type_id: i.beer_type_id,
          barrel_model_id: matchingModel?.id,
          quantity_liters: i.barrel_volume * totalBarrels,
          unit_price: i.unit_price,
          total_price: i.barrel_volume * i.sold_barrel_quantity * i.unit_price,
          barrel_quantity: totalBarrels,
          sold_barrel_quantity: i.sold_barrel_quantity,
          consigned_barrel_quantity: i.consigned_barrel_quantity,
        };
      }),
      product_items: productItems.map(item => {
        const product = products!.find(p => p.id === item.product_id)!;
        return { product_id: product.id, product_name: product.name, unit: product.unit, quantity: item.quantity, unit_price: item.unit_price, total_price: item.quantity * item.unit_price };
      }),
    } as any);

    setPendingDialogOpen(false);
    navigate('/orders');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !deliveryDate || (items.length === 0 && productItems.length === 0) || items.some(i => !i.beer_type_id || (i.sold_barrel_quantity + i.consigned_barrel_quantity) <= 0) || productItems.some(i => !i.product_id || i.quantity <= 0)) {
      toast.error('Informe cliente, data e ao menos um item válido.');
      return;
    }

    const requestedByProduct = productItems.reduce((result, item) => ({ ...result, [item.product_id]: (result[item.product_id] || 0) + item.quantity }), {} as Record<string, number>);
    for (const [productId, requested] of Object.entries(requestedByProduct)) {
      const product = products?.find(p => p.id === productId);
      const available = Number(product?.stock_quantity || 0) - Number(productReservations[productId] || 0);
      if (product?.track_stock && requested > available) {
        toast.error(`Estoque disponível insuficiente para ${product.name}: ${available} ${product.unit}.`);
        return;
      }
    }

    if (expectedReturnDate && expectedReturnDate < deliveryDate) {
      toast.error('A data prevista de retorno nao pode ser anterior a data de saida.');
      return;
    }

    if (tapId && !filteredTaps?.some((tap) => tap.id === tapId)) {
      toast.error('Esta chopeira ja esta reservada para o periodo selecionado.');
      setTapId('');
      return;
    }

    try {
      const pending = await fetchCustomerPendingOrders(customerId);
      if (pending.length > 0) {
        setPendingOrders(pending);
        setPendingDialogOpen(true);
        return;
      }
    } catch {
      toast.warning('Não foi possível verificar as pendências financeiras do cliente.');
    }

    await createCurrentOrder();
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Novo Pedido</h1>
            <p className="text-muted-foreground">Registre uma nova venda de chopp</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Cliente
                <CustomerFormDialog 
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Novo Cliente
                    </Button>
                  }
                  onSuccess={handleCustomerCreated}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="customer">Selecione o Cliente *</Label>
                  <CustomerSearchCombobox 
                    customers={customers}
                    value={customerId}
                    onValueChange={setCustomerId}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle>Entrega/Retirada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Tipo *</Label>
                  <RadioGroup 
                    value={deliveryType} 
                    onValueChange={(v) => setDeliveryType(v as DeliveryType)}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="entrega" id="entrega" />
                      <Label htmlFor="entrega">Entrega</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="retirada" id="retirada" />
                      <Label htmlFor="retirada">Retirada na Loja</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <Label htmlFor="delivery_date">Data *</Label>
                  <Input 
                    id="delivery_date" 
                    type="date" 
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="delivery_time">Horário</Label>
                  <Input 
                    id="delivery_time" 
                    type="time" 
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="expected_return">Data Prevista de Retorno</Label>
                  <Input 
                    id="expected_return" 
                    type="date" 
                    value={expectedReturnDate}
                    min={deliveryDate || undefined}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Delivery Address */}
              {deliveryType === 'entrega' && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Endereço de Entrega</Label>
                    {selectedCustomer && (
                      <Button type="button" variant="outline" size="sm" onClick={copyCustomerAddress}>
                        Copiar endereço do cliente
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <Label>Rua</Label>
                      <Input value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input value={deliveryNumber} onChange={(e) => setDeliveryNumber(e.target.value)} />
                    </div>
                    <div>
                      <Label>Complemento</Label>
                      <Input value={deliveryComplement} onChange={(e) => setDeliveryComplement(e.target.value)} />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input value={deliveryNeighborhood} onChange={(e) => setDeliveryNeighborhood(e.target.value)} />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input value={deliveryZipCode} onChange={(e) => setDeliveryZipCode(e.target.value)} />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} />
                    </div>
                    <div>
                      <Label>Estado</Label>
                      <Input value={deliveryState} onChange={(e) => setDeliveryState(e.target.value)} maxLength={2} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Tipo de Chopeira</Label>
                  <Select value={selectedTapTypeId} onValueChange={(value) => {
                    setSelectedTapTypeId(value);
                    setTapId(''); // Reset tap selection when type changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tapTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tap">Chopeira</Label>
                  <Select value={tapId} onValueChange={setTapId}>
                    <SelectTrigger disabled={!deliveryDate}>
                      <SelectValue placeholder={deliveryDate ? 'Selecione a chopeira...' : 'Informe a data primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTaps?.map((tap) => (
                        <SelectItem key={tap.id} value={tap.id}>
                          {tap.code} - {tap.tap_types?.name} {tap.voltage ? `(${tap.voltage})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cylinder_model">Capacidade do Cilindro</Label>
                  <Select value={cylinderModelId} onValueChange={setCylinderModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a capacidade..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cylinderModels?.map((model) => {
                        const summary = cylinderSummary?.find(s => s.model.id === model.id);
                        const available = summary?.cheio || 0;
                        return (
                          <SelectItem 
                            key={model.id} 
                            value={model.id}
                            disabled={available === 0}
                          >
                            {model.capacity}kg {model.description ? `- ${model.description}` : ''} ({available} disponíveis)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cylinder_quantity">Quantidade</Label>
                  <Input 
                    id="cylinder_quantity"
                    type="number" 
                    min="1"
                    value={cylinderQuantity || ''}
                    onChange={(e) => setCylinderQuantity(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chopp Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Chopp
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid gap-4 md:grid-cols-6 items-end border-b pb-4 last:border-0">
                    <div>
                      <Label>Tipo de Chopp *</Label>
                      <Select 
                        value={item.beer_type_id} 
                        onValueChange={(v) => updateItem(index, 'beer_type_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {beerTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Volume do Barril *</Label>
                      <Select 
                        value={item.barrel_volume.toString()} 
                        onValueChange={(v) => updateItem(index, 'barrel_volume', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BARREL_VOLUMES.map((vol) => (
                            <SelectItem key={vol} value={vol.toString()}>
                              {vol}L
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Comprado *</Label>
                      <Input 
                        type="number" 
                        min="0"
                        value={item.sold_barrel_quantity || ''}
                        onChange={(e) => updateItem(index, 'sold_barrel_quantity', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Consignado</Label>
                      <Input 
                        type="number" 
                        min="0"
                        value={item.consigned_barrel_quantity || ''}
                        onChange={(e) => updateItem(index, 'consigned_barrel_quantity', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Preço/L (R$)</Label>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={item.unit_price || ''}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-right font-medium">
                        R$ {getItemTotal(item).toFixed(2)}
                        {item.consigned_barrel_quantity > 0 && (
                          <div className="text-xs text-amber-600">
                            Consig.: R$ {getItemConsignedTotal(item).toFixed(2)}
                          </div>
                        )}
                      </div>
                      {(
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Subtotal cobrado agora:</span>
                    <span>R$ {(subtotalValue + productsSubtotal).toFixed(2)}</span>
                  </div>
                  {consignedPendingValue > 0 && (
                    <div className="flex justify-between items-center text-amber-600">
                      <span>Consignado pendente:</span>
                      <span>R$ {consignedPendingValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-4">
                    <Label className="whitespace-nowrap">Taxa de Entrega:</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={deliveryFee || ''}
                        onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                        className="w-28 text-right"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <Label className="whitespace-nowrap">Desconto:</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">- R$</span>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={discount || ''}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        className="w-28 text-right"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xl font-bold">Total:</span>
                    <span className="text-xl font-bold">R$ {totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center justify-between">Produtos adicionais<Button type="button" variant="outline" size="sm" onClick={() => setProductItems([...productItems, { product_id: '', quantity: 1, unit_price: 0 }])}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {productItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto avulso neste pedido.</p>}
              {productItems.map((item, index) => {
                const product = products?.find(p => p.id === item.product_id);
                const available = product?.track_stock ? Number(product.stock_quantity) - Number(productReservations[product.id] || 0) : null;
                return <div key={index} className="grid items-end gap-4 border-b pb-4 md:grid-cols-5">
                  <div className="md:col-span-2"><Label>Produto *</Label><Select value={item.product_id} onValueChange={value => { const selected = products?.find(p => p.id === value); const next = [...productItems]; next[index] = { ...next[index], product_id: value, unit_price: Number(selected?.sale_price || 0) }; setProductItems(next); }}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{products?.map(product => <SelectItem key={product.id} value={product.id} disabled={product.track_stock && Number(product.stock_quantity) - Number(productReservations[product.id] || 0) <= 0}>{product.name}</SelectItem>)}</SelectContent></Select>{product && <p className="mt-1 text-xs text-muted-foreground">{available === null ? 'Sem controle de estoque' : `${available} ${product.unit} disponíveis`}</p>}</div>
                  <div><Label>Quantidade *</Label><Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => { const next = [...productItems]; next[index].quantity = Number(e.target.value); setProductItems(next); }} /></div>
                  <div><Label>Preço unitário</Label><Input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const next = [...productItems]; next[index].unit_price = Number(e.target.value); setProductItems(next); }} /></div>
                  <div className="flex items-center justify-end gap-2"><span className="font-medium">R$ {(item.quantity * item.unit_price).toFixed(2)}</span><Button type="button" variant="ghost" size="icon" onClick={() => setProductItems(productItems.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>;
              })}
              {productItems.length > 0 && <div className="text-right font-medium">Subtotal dos produtos: R$ {productsSubtotal.toFixed(2)}</div>}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre o pedido..."
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link to="/">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? 'Salvando...' : 'Criar Pedido'}
            </Button>
          </div>
        </form>
      </div>

      <CustomerFinancialPendingDialog
        open={pendingDialogOpen}
        customerName={selectedCustomer?.full_name}
        orders={pendingOrders}
        isContinuing={createOrder.isPending}
        onOpenChange={setPendingDialogOpen}
        onContinue={createCurrentOrder}
      />
    </MainLayout>
  );
}
