import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, Payment, DeliveryType, OrderStatus, PaymentMethod, PaymentStatus } from '@/types/database';
import { toast } from 'sonner';
import { useDeliverToCustomer, useReturnFromCustomer, useReturnFullFromCustomer } from '@/hooks/useBarrelInventory';
import { useDeliverCylinderToCustomer, useReturnCylinderFromCustomer } from '@/hooks/useCylinderInventory';
import { assertTapAvailableForPeriod } from '@/lib/tapAvailability';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(*), taps(*, tap_types(*)), cylinders(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useActiveOrders() {
  return useQuery({
    queryKey: ['orders', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(*), taps(*, tap_types(*)), cylinders(*)')
        .in('status', ['agendado', 'em_andamento'])
        .order('delivery_date', { ascending: true });
      
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(*), taps(*, tap_types(*)), cylinders(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Order;
    },
    enabled: !!id,
  });
}

export function useOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ['order_items', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*, beer_types(*), barrel_models(*)')
        .eq('order_id', orderId);
      
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orderId,
  });
}

export function useOrderPayments(orderId: string | null) {
  return useQuery({
    queryKey: ['payments', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId);
      
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!orderId,
  });
}

interface CreateOrderData {
  customer_id: string;
  delivery_type: DeliveryType;
  delivery_date: string;
  delivery_time?: string;
  tap_id?: string;
  cylinder_model_id?: string;
  cylinder_quantity?: number;
  expected_return_date?: string;
  notes?: string;
  delivery_address_street?: string;
  delivery_address_number?: string;
  delivery_address_complement?: string;
  delivery_address_neighborhood?: string;
  delivery_address_city?: string;
  delivery_address_state?: string;
  delivery_address_zip_code?: string;
  items: {
    beer_type_id: string;
    barrel_model_id?: string;
    quantity_liters: number;
    unit_price: number;
    total_price?: number;
    barrel_quantity?: number;
    sold_barrel_quantity?: number;
    consigned_barrel_quantity?: number;
  }[];
}

function calculateOrderTotal(subtotal: number, deliveryFee?: number | null, discount?: number | null) {
  return Number(subtotal || 0) + Number(deliveryFee || 0) - Number(discount || 0);
}

function getSoldBarrelQuantity(item: Partial<OrderItem> & { barrel_quantity?: number | null }) {
  if (typeof item.sold_barrel_quantity === 'number') return item.sold_barrel_quantity;
  return item.barrel_quantity || 1;
}

function getConsignedBarrelQuantity(item: Partial<OrderItem>) {
  return item.consigned_barrel_quantity || 0;
}

function getTotalBarrelQuantity(item: Partial<OrderItem> & { barrel_quantity?: number | null }) {
  return getSoldBarrelQuantity(item) + getConsignedBarrelQuantity(item);
}

function getUnitVolume(item: Pick<OrderItem, 'quantity_liters' | 'barrel_quantity'> & Partial<OrderItem>) {
  const totalBarrels = getTotalBarrelQuantity(item);
  return totalBarrels > 0 ? Number(item.quantity_liters) / totalBarrels : Number(item.quantity_liters);
}

function calculateItemCost(
  item: Partial<OrderItem> & {
    quantity_liters: number;
    barrel_quantity?: number | null;
    unit_cost_at_sale?: number | null;
  },
  consumedConsigned = 0,
) {
  const unitVolume = getUnitVolume(item as OrderItem);
  const soldBarrels = getSoldBarrelQuantity(item);
  return unitVolume * (soldBarrels + consumedConsigned) * Number(item.unit_cost_at_sale || 0);
}

async function getCostByBeerType(items: { beer_type_id: string }[], deliveryDate: string) {
  const beerIds = [...new Set(items.map((item) => item.beer_type_id).filter(Boolean))];
  const costByBeerType = new Map<string, number>();

  if (beerIds.length === 0) return costByBeerType;

  const [{ data: beerTypes, error: beerError }, { data: costHistory, error: costError }] = await Promise.all([
    supabase.from('beer_types').select('id, cost_per_liter').in('id', beerIds),
    supabase
      .from('beer_cost_history')
      .select('beer_type_id, cost_per_liter, valid_from, valid_to')
      .in('beer_type_id', beerIds)
      .lte('valid_from', deliveryDate)
      .or(`valid_to.is.null,valid_to.gte.${deliveryDate}`)
      .order('valid_from', { ascending: false }),
  ]);

  if (beerError) throw beerError;
  if (costError) throw costError;

  beerTypes?.forEach((beer) => {
    costByBeerType.set(beer.id, Number(beer.cost_per_liter || 0));
  });

  const historyApplied = new Set<string>();
  costHistory?.forEach((cost) => {
    if (!historyApplied.has(cost.beer_type_id)) {
      costByBeerType.set(cost.beer_type_id, Number(cost.cost_per_liter || 0));
      historyApplied.add(cost.beer_type_id);
    }
  });

  return costByBeerType;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      const { items, cylinder_model_id, cylinder_quantity, ...order } = orderData;

      if (order.expected_return_date && order.expected_return_date < order.delivery_date) {
        throw new Error('A data prevista de retorno nao pode ser anterior a data de saida.');
      }

      await assertTapAvailableForPeriod({
        tapId: order.tap_id,
        startDate: order.delivery_date,
        endDate: order.expected_return_date,
      });
      
      // Always derive total from subtotal + delivery fee - discount
      const subtotal = (order as any).subtotal ?? items.reduce((sum, item) => {
        const totalBarrels = item.barrel_quantity || 1;
        const soldBarrels = item.sold_barrel_quantity ?? totalBarrels;
        const unitVolume = item.quantity_liters / totalBarrels;
        return sum + (unitVolume * soldBarrels * item.unit_price);
      }, 0);
      const deliveryFee = (order as any).delivery_fee ?? 0;
      const discount = (order as any).discount ?? 0;
      const total = calculateOrderTotal(subtotal, deliveryFee, discount);
      
      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert({
          ...order,
          subtotal,
          total,
          status: 'agendado' as OrderStatus,
        })
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      const costByBeerType = await getCostByBeerType(items, order.delivery_date);

      // Create order items
      const orderItems = items.map(item => ({
        order_id: orderResult.id,
        beer_type_id: item.beer_type_id,
        barrel_model_id: item.barrel_model_id,
        quantity_liters: item.quantity_liters,
        unit_price: item.unit_price,
        total_price: item.total_price ?? (() => {
          const totalBarrels = item.barrel_quantity || 1;
          const soldBarrels = item.sold_barrel_quantity ?? totalBarrels;
          return (item.quantity_liters / totalBarrels) * soldBarrels * item.unit_price;
        })(),
        barrel_quantity: item.barrel_quantity || 1,
        sold_barrel_quantity: item.sold_barrel_quantity ?? item.barrel_quantity ?? 1,
        consigned_barrel_quantity: item.consigned_barrel_quantity || 0,
        unit_cost_at_sale: costByBeerType.get(item.beer_type_id) || 0,
        total_cost_at_sale: calculateItemCost({
          ...item,
          unit_cost_at_sale: costByBeerType.get(item.beer_type_id) || 0,
        }),
      }));
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;
      
      // Save cylinder info on the order if provided
      if (cylinder_model_id) {
        await supabase
          .from('orders')
          .update({ 
            cylinder_model_id: cylinder_model_id, 
            cylinder_quantity: cylinder_quantity || 1 
          })
          .eq('id', orderResult.id);
      }
      
      return orderResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar pedido: ' + error.message);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const deliverToCustomer = useDeliverToCustomer();
  const deliverCylinderToCustomer = useDeliverCylinderToCustomer();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      // If changing to em_andamento, we need to deduct from inventory
      if (status === 'em_andamento') {
        // Get order items
        const { data: items } = await supabase
          .from('order_items')
          .select('*, barrel_models(*)')
          .eq('order_id', id);
        
        // Get all barrel models to resolve by volume when barrel_model_id is null
        const { data: allBarrelModels } = await supabase
          .from('barrel_models')
          .select('*');
        
        // Deduct from barrel inventory
        if (items) {
          for (const item of items) {
            let barrelModelId = item.barrel_model_id;
            
            // If barrel_model_id is null, find it by matching unit volume
            if (!barrelModelId && allBarrelModels) {
              const barrelQty = getTotalBarrelQuantity(item);
              const unitVolume = item.quantity_liters / barrelQty;
              const matchingModel = allBarrelModels.find(m => m.volume === unitVolume);
              if (matchingModel) {
                barrelModelId = matchingModel.id;
                // Also update the order_item with the correct barrel_model_id
                await supabase
                  .from('order_items')
                  .update({ barrel_model_id: matchingModel.id })
                  .eq('id', item.id);
              }
            }
            
            if (barrelModelId && item.beer_type_id) {
              await deliverToCustomer.mutateAsync({
                barrelModelId,
                beerTypeId: item.beer_type_id,
                quantity: getTotalBarrelQuantity(item),
              });
            }
          }
        }

        // Also handle cylinder inventory when starting order
        const { data: orderData } = await supabase
          .from('orders')
          .select('tap_id, cylinder_model_id, cylinder_quantity')
          .eq('id', id)
          .single();

        if (orderData?.tap_id) {
          await supabase
            .from('taps')
            .update({ status: 'em_uso' })
            .eq('id', orderData.tap_id);
        }
        
        if (orderData?.cylinder_model_id) {
          await deliverCylinderToCustomer.mutateAsync({
            cylinderModelId: orderData.cylinder_model_id,
            quantity: orderData.cylinder_quantity || 1,
          });
        }
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useReturnEquipment() {
  const queryClient = useQueryClient();
  const returnFromCustomer = useReturnFromCustomer();
  const returnFullFromCustomer = useReturnFullFromCustomer();
  const returnCylinderFromCustomer = useReturnCylinderFromCustomer();
  
  return useMutation({
    mutationFn: async (input: string | {
      orderId: string;
      consignedResolutions?: { orderItemId: string; consumedQuantity: number }[];
    }) => {
      const orderId = typeof input === 'string' ? input : input.orderId;
      const consignedResolutions = typeof input === 'string' ? [] : input.consignedResolutions || [];
      const resolutionByItemId = new Map(
        consignedResolutions.map((resolution) => [resolution.orderItemId, resolution.consumedQuantity]),
      );

      // Get order details including cylinder model info
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, taps(*)')
        .eq('id', orderId)
        .single();
      
      if (orderError) throw orderError;
      
      // Return tap
      if (order.tap_id) {
        await supabase
          .from('taps')
          .update({ status: 'disponivel' })
          .eq('id', order.tap_id);
      }
      
      // Return barrels as empty (vazio_loja)
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      // Get all barrel models to resolve by volume when barrel_model_id is null
      const { data: allBarrelModels } = await supabase
        .from('barrel_models')
        .select('*');
      
      if (items) {
        for (const item of items) {
          let barrelModelId = item.barrel_model_id;
          const soldBarrels = getSoldBarrelQuantity(item);
          const consignedBarrels = getConsignedBarrelQuantity(item);
          const hasConsigned = consignedBarrels > 0;
          const consumedConsignedInput = hasConsigned
            ? resolutionByItemId.get(item.id)
            : 0;

          if (hasConsigned && consumedConsignedInput === undefined) {
            throw new Error('Informe se cada barril consignado foi consumido ou retornou cheio.');
          }

          const consumedConsigned = consumedConsignedInput || 0;

          if (hasConsigned && (consumedConsigned < 0 || consumedConsigned > consignedBarrels)) {
            throw new Error('Quantidade consumida do consignado invalida.');
          }

          const returnedFullConsigned = hasConsigned ? consignedBarrels - consumedConsigned : 0;
          const emptyReturnedQuantity = soldBarrels + (consumedConsigned || 0);
          
          // If barrel_model_id is null, find it by matching unit volume
          if (!barrelModelId && allBarrelModels) {
            const barrelQty = getTotalBarrelQuantity(item);
            const unitVolume = item.quantity_liters / barrelQty;
            const matchingModel = allBarrelModels.find(m => m.volume === unitVolume);
            if (matchingModel) {
              barrelModelId = matchingModel.id;
            }
          }
          
          if (barrelModelId && emptyReturnedQuantity > 0) {
            await returnFromCustomer.mutateAsync({
              barrelModelId,
              beerTypeId: item.beer_type_id,
              quantity: emptyReturnedQuantity,
            });
          }

          if (barrelModelId && item.beer_type_id && returnedFullConsigned > 0) {
            await returnFullFromCustomer.mutateAsync({
              barrelModelId,
              beerTypeId: item.beer_type_id,
              quantity: returnedFullConsigned,
            });
          }

          if (hasConsigned) {
            const unitVolume = getUnitVolume(item);
            await supabase
              .from('order_items')
              .update({
                consigned_consumed_quantity: consumedConsigned,
                consigned_returned_quantity: returnedFullConsigned,
                consigned_resolved_at: new Date().toISOString(),
                total_price: (soldBarrels + consumedConsigned) * unitVolume * Number(item.unit_price),
                total_cost_at_sale: calculateItemCost(item, consumedConsigned),
              })
              .eq('id', item.id);
          }
        }
      }

      // Return cylinders
      if (order.cylinder_id) {
        await supabase
          .from('cylinders')
          .update({ status: 'cheio' })
          .eq('id', order.cylinder_id);
      }
      
      // Return cylinder inventory using model-based tracking
      if (order.cylinder_model_id) {
        await returnCylinderFromCustomer.mutateAsync({
          cylinderModelId: order.cylinder_model_id,
          quantity: order.cylinder_quantity || 1,
        });
      }

      const { data: updatedItems } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId);

      const subtotal = (updatedItems || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
      const total = calculateOrderTotal(subtotal, order.delivery_fee, order.discount);

      // Update order status after all equipment and consigned decisions are resolved
      await supabase
        .from('orders')
        .update({
          status: 'finalizado' as OrderStatus,
          actual_return_date: new Date().toISOString().split('T')[0],
          subtotal,
          total,
        })
        .eq('id', orderId);
      
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      queryClient.invalidateQueries({ queryKey: ['barrel_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cylinder_inventory'] });
      toast.success('Equipamentos devolvidos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao devolver equipamentos: ' + error.message);
    },
  });
}

export function useAddPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payment: {
      order_id: string;
      payment_method: PaymentMethod;
      amount: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...payment,
          status: 'pago' as PaymentStatus,
          payment_date: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });
}

interface UpdateOrderData {
  id: string;
  delivery_type?: DeliveryType;
  delivery_date?: string;
  delivery_time?: string | null;
  tap_id?: string | null;
  cylinder_id?: string | null;
  expected_return_date?: string | null;
  notes?: string | null;
  delivery_address_street?: string | null;
  delivery_address_number?: string | null;
  delivery_address_complement?: string | null;
  delivery_address_neighborhood?: string | null;
  delivery_address_city?: string | null;
  delivery_address_state?: string | null;
  delivery_address_zip_code?: string | null;
  delivery_fee?: number;
  discount?: number;
  subtotal?: number;
  total?: number;
  items?: {
    beer_type_id: string;
    barrel_model_id?: string;
    quantity_liters: number;
    unit_price: number;
    total_price?: number;
    barrel_quantity?: number;
    sold_barrel_quantity?: number;
    consigned_barrel_quantity?: number;
  }[];
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, items, ...orderData }: UpdateOrderData) => {
      // Get current order to check equipment changes
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('status, tap_id, cylinder_id, delivery_date, subtotal, delivery_fee, discount')
        .eq('id', id)
        .single();

      const deliveryFee = Number(orderData.delivery_fee ?? currentOrder?.delivery_fee ?? 0);
      const discount = Number(orderData.discount ?? currentOrder?.discount ?? 0);

      if (orderData.expected_return_date && orderData.delivery_date && orderData.expected_return_date < orderData.delivery_date) {
        throw new Error('A data prevista de retorno nao pode ser anterior a data de saida.');
      }

      await assertTapAvailableForPeriod({
        tapId: orderData.tap_id,
        startDate: orderData.delivery_date,
        endDate: orderData.expected_return_date,
        excludeOrderId: id,
      });

      // Scheduled orders only reserve taps by date. Physical status changes on equipment checkout.
      if (currentOrder?.status === 'em_andamento' && currentOrder?.tap_id && currentOrder.tap_id !== orderData.tap_id) {
        await supabase
          .from('taps')
          .update({ status: 'disponivel' })
          .eq('id', currentOrder.tap_id);
      }

      if (currentOrder?.status === 'em_andamento' && orderData.tap_id && orderData.tap_id !== currentOrder?.tap_id) {
        await supabase
          .from('taps')
          .update({ status: 'em_uso' })
          .eq('id', orderData.tap_id);
      }

      // If cylinder changed, update old cylinder status
      if (currentOrder?.cylinder_id && currentOrder.cylinder_id !== orderData.cylinder_id) {
        await supabase
          .from('cylinders')
          .update({ status: 'cheio' })
          .eq('id', currentOrder.cylinder_id);
      }

      // If new cylinder assigned, update its status
      if (orderData.cylinder_id && orderData.cylinder_id !== currentOrder?.cylinder_id) {
        await supabase
          .from('cylinders')
          .update({ status: 'com_cliente' })
          .eq('id', orderData.cylinder_id);
      }

      // Update order items if provided
      if (items && items.length > 0) {
        const snapshotDate = orderData.delivery_date || currentOrder?.delivery_date || new Date().toISOString().split('T')[0];
        const costByBeerType = await getCostByBeerType(items, snapshotDate);

        // Delete existing items
        await supabase
          .from('order_items')
          .delete()
          .eq('order_id', id);

        // Insert new items
        const orderItems = items.map(item => ({
          order_id: id,
          beer_type_id: item.beer_type_id,
          barrel_model_id: item.barrel_model_id || null,
          quantity_liters: item.quantity_liters,
          unit_price: item.unit_price,
          total_price: item.total_price ?? (() => {
            const totalBarrels = item.barrel_quantity || 1;
            const soldBarrels = item.sold_barrel_quantity ?? totalBarrels;
            return (item.quantity_liters / totalBarrels) * soldBarrels * item.unit_price;
          })(),
          barrel_quantity: item.barrel_quantity || 1,
          sold_barrel_quantity: item.sold_barrel_quantity ?? item.barrel_quantity ?? 1,
          consigned_barrel_quantity: item.consigned_barrel_quantity || 0,
          unit_cost_at_sale: costByBeerType.get(item.beer_type_id) || 0,
          total_cost_at_sale: calculateItemCost({
            ...item,
            unit_cost_at_sale: costByBeerType.get(item.beer_type_id) || 0,
          }),
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        const subtotal = orderItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        orderData.subtotal = subtotal;
        orderData.total = calculateOrderTotal(subtotal, deliveryFee, discount);
      } else if (
        orderData.subtotal !== undefined ||
        orderData.delivery_fee !== undefined ||
        orderData.discount !== undefined
      ) {
        const subtotal = Number(orderData.subtotal ?? currentOrder?.subtotal ?? 0);
        orderData.subtotal = subtotal;
        orderData.total = calculateOrderTotal(subtotal, deliveryFee, discount);
      }

      const { data, error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_items'] });
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      toast.success('Pedido atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pedido: ' + error.message);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      // First check status - only allow deleting 'agendado' orders
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;
      if (order.status !== 'agendado') {
        throw new Error('Apenas pedidos agendados podem ser excluídos.');
      }

      // Delete payments first (FK constraint)
      await supabase.from('payments').delete().eq('order_id', orderId);

      // Delete order items (FK constraint)
      await supabase.from('order_items').delete().eq('order_id', orderId);

      // Delete the order
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['taps'] });
      queryClient.invalidateQueries({ queryKey: ['cylinders'] });
      toast.success('Pedido excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
