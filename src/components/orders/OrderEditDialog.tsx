import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateOrder, useOrderItems } from '@/hooks/useOrders';
import { useAvailableTapsForPeriod, useTapTypes, useBeerTypes } from '@/hooks/useEquipment';
import { useCylinderModels, useCylinderSummary } from '@/hooks/useCylinderInventory';
import { Order, DeliveryType } from '@/types/database';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrderEditDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditItemForm {
  beer_type_id: string;
  barrel_volume: number;
  sold_barrel_quantity: number;
  consigned_barrel_quantity: number;
  unit_price: number;
}

const BARREL_VOLUMES = [10, 15, 20, 30, 50] as const;

export function OrderEditDialog({ order, open, onOpenChange }: OrderEditDialogProps) {
  const updateOrder = useUpdateOrder();
  const { data: tapTypes } = useTapTypes();
  const { data: beerTypes } = useBeerTypes();
  const { data: cylinderModels } = useCylinderModels();
  const { data: cylinderSummary } = useCylinderSummary();
  const { data: existingItems } = useOrderItems(order?.id || null);

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('entrega');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [selectedTapTypeId, setSelectedTapTypeId] = useState<string>('');
  const [tapId, setTapId] = useState('');
  const [cylinderModelId, setCylinderModelId] = useState('');
  const [cylinderQuantity, setCylinderQuantity] = useState(1);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);

  // Order items
  const [items, setItems] = useState<EditItemForm[]>([]);

  // Delivery address
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [deliveryComplement, setDeliveryComplement] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryZipCode, setDeliveryZipCode] = useState('');

  const isEditable = order?.status === 'agendado';

  const { data: availableTaps } = useAvailableTapsForPeriod(
    deliveryDate,
    expectedReturnDate,
    order?.id,
  );

  const filteredTaps = selectedTapTypeId 
    ? availableTaps?.filter(t => t.tap_type_id === selectedTapTypeId) 
    : availableTaps;

  // Load order data when dialog opens
  useEffect(() => {
    if (order && open) {
      setDeliveryType(order.delivery_type);
      setDeliveryDate(order.delivery_date);
      setDeliveryTime(order.delivery_time?.slice(0, 5) || '');
      setTapId(order.tap_id || '');
      setCylinderModelId('');
      setCylinderQuantity(1);
      setExpectedReturnDate(order.expected_return_date || '');
      setNotes(order.notes || '');
      setDeliveryFee(Number(order.delivery_fee) || 0);
      setDiscount(Number(order.discount) || 0);
      setDeliveryStreet(order.delivery_address_street || '');
      setDeliveryNumber(order.delivery_address_number || '');
      setDeliveryComplement(order.delivery_address_complement || '');
      setDeliveryNeighborhood(order.delivery_address_neighborhood || '');
      setDeliveryCity(order.delivery_address_city || '');
      setDeliveryState(order.delivery_address_state || '');
      setDeliveryZipCode(order.delivery_address_zip_code || '');

      if (order.taps?.tap_type_id) {
        setSelectedTapTypeId(order.taps.tap_type_id);
      } else {
        setSelectedTapTypeId('');
      }
    }
  }, [order, open]);

  // Load existing items
  useEffect(() => {
    if (existingItems && existingItems.length > 0 && open) {
      setItems(existingItems.map(item => ({
        beer_type_id: item.beer_type_id,
        barrel_volume: item.barrel_quantity && item.barrel_quantity > 0
          ? Math.round(Number(item.quantity_liters) / item.barrel_quantity)
          : Number(item.quantity_liters),
        sold_barrel_quantity: item.sold_barrel_quantity ?? item.barrel_quantity ?? 1,
        consigned_barrel_quantity: item.consigned_barrel_quantity || 0,
        unit_price: Number(item.unit_price),
      })));
    }
  }, [existingItems, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTapTypeId('');
      setTapId('');
      setCylinderModelId('');
      setCylinderQuantity(1);
      setItems([]);
    }
  }, [open]);

  useEffect(() => {
    if (tapId && deliveryDate && availableTaps && !availableTaps.some((tap) => tap.id === tapId)) {
      setTapId('');
    }
  }, [availableTaps, deliveryDate, expectedReturnDate, tapId]);

  const getItemTotal = (item: EditItemForm) => {
    return item.barrel_volume * item.sold_barrel_quantity * item.unit_price;
  };

  const getItemConsignedTotal = (item: EditItemForm) => {
    return item.barrel_volume * item.consigned_barrel_quantity * item.unit_price;
  };

  const subtotalValue = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const consignedPendingValue = items.reduce((sum, item) => sum + getItemConsignedTotal(item), 0);
  const totalValue = subtotalValue + deliveryFee - discount;

  const addItem = () => {
    setItems([...items, { beer_type_id: '', barrel_volume: 30, sold_barrel_quantity: 1, consigned_barrel_quantity: 0, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof EditItemForm, value: string | number) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      if (expectedReturnDate && expectedReturnDate < deliveryDate) {
        toast.error('A data prevista de retorno nao pode ser anterior a data de saida.');
        return;
      }

      if (tapId && !filteredTaps?.some((tap) => tap.id === tapId)) {
        toast.error('Esta chopeira ja esta reservada para o periodo selecionado.');
        setTapId('');
        return;
      }

      const updateData: any = {
        id: order.id,
        delivery_type: deliveryType,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime || null,
        tap_id: tapId || null,
        cylinder_id: null,
        expected_return_date: expectedReturnDate || null,
        notes: notes || null,
        delivery_fee: deliveryFee,
        discount: discount,
        delivery_address_street: deliveryType === 'entrega' ? deliveryStreet : null,
        delivery_address_number: deliveryType === 'entrega' ? deliveryNumber : null,
        delivery_address_complement: deliveryType === 'entrega' ? deliveryComplement : null,
        delivery_address_neighborhood: deliveryType === 'entrega' ? deliveryNeighborhood : null,
        delivery_address_city: deliveryType === 'entrega' ? deliveryCity : null,
        delivery_address_state: deliveryType === 'entrega' ? deliveryState : null,
        delivery_address_zip_code: deliveryType === 'entrega' ? deliveryZipCode : null,
      };

      // If items are editable (agendado), include them and recalculate totals
      if (isEditable && items.length > 0) {
        updateData.subtotal = subtotalValue;
        updateData.total = totalValue;
        updateData.items = items
          .filter(i => i.beer_type_id && (i.sold_barrel_quantity + i.consigned_barrel_quantity) > 0)
          .map(i => {
            const totalBarrels = i.sold_barrel_quantity + i.consigned_barrel_quantity;
            return {
              beer_type_id: i.beer_type_id,
              quantity_liters: i.barrel_volume * totalBarrels,
              unit_price: i.unit_price,
              total_price: i.barrel_volume * i.sold_barrel_quantity * i.unit_price,
              barrel_quantity: totalBarrels,
              sold_barrel_quantity: i.sold_barrel_quantity,
              consigned_barrel_quantity: i.consigned_barrel_quantity,
            };
          });
      } else {
        // Keep existing subtotal, just recalculate total with fee/discount
        const existingSubtotal = Number(order.subtotal) || 0;
        updateData.subtotal = existingSubtotal;
        updateData.total = existingSubtotal + deliveryFee - discount;
      }

      await updateOrder.mutateAsync(updateData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar pedido');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{order?.order_number || ''}</DialogTitle>
        </DialogHeader>

        {!order ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Delivery Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Entrega/Retirada</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Tipo</Label>
                <RadioGroup 
                  value={deliveryType} 
                  onValueChange={(v) => setDeliveryType(v as DeliveryType)}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="entrega" id="edit-entrega" />
                    <Label htmlFor="edit-entrega">Entrega</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="retirada" id="edit-retirada" />
                    <Label htmlFor="edit-retirada">Retirada na Loja</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label>Data *</Label>
                <Input 
                  type="date" 
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label>Horário</Label>
                <Input 
                  type="time" 
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                />
              </div>

              <div>
                <Label>Data Prevista de Retorno</Label>
                <Input 
                  type="date" 
                  value={expectedReturnDate}
                  min={deliveryDate || undefined}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery Address */}
            {deliveryType === 'entrega' && (
              <div className="pt-4 border-t space-y-4">
                <Label className="text-base font-semibold">Endereço de Entrega</Label>
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
          </div>

          {/* Equipment */}
          <div className="space-y-4">
            <h3 className="font-medium">Equipamentos</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Tipo de Chopeira</Label>
                <Select value={selectedTapTypeId} onValueChange={(value) => {
                  setSelectedTapTypeId(value);
                  setTapId('');
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
                <Label>Chopeira</Label>
                <Select value={tapId || 'none'} onValueChange={(v) => setTapId(v === 'none' ? '' : v)}>
                  <SelectTrigger disabled={!deliveryDate}>
                    <SelectValue placeholder={deliveryDate ? 'Selecione a chopeira...' : 'Informe a data primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {filteredTaps?.map((tap) => (
                      <SelectItem key={tap.id} value={tap.id}>
                        {tap.code} - {tap.tap_types?.name} {tap.voltage ? `(${tap.voltage})` : ''}
                        {tap.id === order.tap_id ? ' (atual)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Capacidade do Cilindro</Label>
                <Select value={cylinderModelId || 'none'} onValueChange={(v) => setCylinderModelId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a capacidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
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
                <Label>Quantidade</Label>
                <Input 
                  type="number" 
                  min="1"
                  value={cylinderQuantity || ''}
                  onChange={(e) => setCylinderQuantity(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Itens do Pedido</h3>
              {isEditable && (
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              )}
            </div>

            {!isEditable && (
              <p className="text-sm text-muted-foreground">
                Itens bloqueados para edição (pedido já retirado/finalizado).
              </p>
            )}

            {items.map((item, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-6 items-end border-b pb-4 last:border-0">
                <div>
                  <Label>Tipo de Chopp</Label>
                  <Select 
                    value={item.beer_type_id} 
                    onValueChange={(v) => updateItem(index, 'beer_type_id', v)}
                    disabled={!isEditable}
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
                  <Label>Volume</Label>
                  <Select 
                    value={item.barrel_volume.toString()} 
                    onValueChange={(v) => updateItem(index, 'barrel_volume', v)}
                    disabled={!isEditable}
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
                  <Label>Comprado</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={item.sold_barrel_quantity || ''}
                    onChange={(e) => updateItem(index, 'sold_barrel_quantity', e.target.value)}
                    disabled={!isEditable}
                  />
                </div>

                <div>
                  <Label>Consignado</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={item.consigned_barrel_quantity || ''}
                    onChange={(e) => updateItem(index, 'consigned_barrel_quantity', e.target.value)}
                    disabled={!isEditable}
                  />
                </div>

                <div>
                  <Label>Preço/L</Label>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={item.unit_price || ''}
                    onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                    disabled={!isEditable}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 text-right font-medium text-sm">
                    R$ {getItemTotal(item).toFixed(2)}
                    {item.consigned_barrel_quantity > 0 && (
                      <div className="text-xs text-amber-600">
                        Consig.: R$ {getItemConsignedTotal(item).toFixed(2)}
                      </div>
                    )}
                  </div>
                  {isEditable && items.length > 1 && (
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
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium">Valores</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Subtotal cobrado agora</Label>
                <Input 
                  value={`R$ ${subtotalValue.toFixed(2)}`}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Consignado pendente</Label>
                <Input
                  value={`R$ ${consignedPendingValue.toFixed(2)}`}
                  disabled
                  className="bg-muted text-amber-700"
                />
              </div>
              <div>
                <Label>Taxa de Entrega</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={deliveryFee || ''}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Desconto</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold">Total:</span>
              <span className="font-bold">
                R$ {totalValue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Observações</Label>
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateOrder.isPending}>
              {updateOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
