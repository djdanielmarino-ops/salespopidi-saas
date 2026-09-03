import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, Tap } from '@/types/database';

export type EquipmentMapMode = 'departures' | 'occupied';

export interface EquipmentMapOrder extends Order {
  order_items?: OrderItem[];
}

export interface EquipmentMapRow {
  tap: Tap;
  order: EquipmentMapOrder | null;
}

function isOrderActiveOnDate(order: Order, selectedDate: string) {
  const start = order.delivery_date;
  const end = order.expected_return_date || order.delivery_date;
  return start <= selectedDate && selectedDate <= end;
}

function summarizeOrderItems(items: OrderItem[] = []) {
  const byBeer = new Map<string, { liters: number; barrels: number; parts: string[] }>();

  items.forEach((item) => {
    const beerName = item.beer_types?.name || 'Chopp';
    const volume = item.barrel_models?.volume || (
      item.barrel_quantity && item.barrel_quantity > 0
        ? Math.round(Number(item.quantity_liters) / item.barrel_quantity)
        : Number(item.quantity_liters)
    );
    const barrels = item.barrel_quantity || 1;
    const current = byBeer.get(beerName) || { liters: 0, barrels: 0, parts: [] };
    current.liters += Number(item.quantity_liters || 0);
    current.barrels += barrels;
    current.parts.push(`${barrels}x ${volume}L`);
    byBeer.set(beerName, current);
  });

  return Array.from(byBeer.entries()).map(([beerName, data]) => ({
    beerName,
    liters: data.liters,
    barrels: data.barrels,
    label: `${beerName}: ${data.parts.join(' + ')} (${data.liters}L)`,
  }));
}

export function useEquipmentMap(selectedDate: string, mode: EquipmentMapMode) {
  return useQuery({
    queryKey: ['equipment-map', selectedDate, mode],
    queryFn: async () => {
      const { data: taps, error: tapsError } = await supabase
        .from('taps')
        .select('*, tap_types(*)')
        .order('code');

      if (tapsError) throw tapsError;

      let orderQuery = supabase
        .from('orders')
        .select('*, customers(*), taps(*, tap_types(*)), cylinders(*)')
        .neq('status', 'cancelado')
        .order('delivery_date', { ascending: true });

      if (mode === 'departures') {
        orderQuery = orderQuery.eq('delivery_date', selectedDate);
      } else {
        orderQuery = orderQuery
          .lte('delivery_date', selectedDate)
          .in('status', ['agendado', 'em_andamento']);
      }

      const { data: orders, error: ordersError } = await orderQuery;
      if (ordersError) throw ordersError;

      const filteredOrders = mode === 'occupied'
        ? (orders || []).filter((order) => isOrderActiveOnDate(order as Order, selectedDate))
        : (orders || []);

      const orderIds = filteredOrders.map((order) => order.id);
      const { data: items, error: itemsError } = orderIds.length > 0
        ? await supabase
          .from('order_items')
          .select('*, beer_types(*), barrel_models(*)')
          .in('order_id', orderIds)
        : { data: [], error: null };

      if (itemsError) throw itemsError;

      const itemsByOrder: Record<string, OrderItem[]> = {};
      (items || []).forEach((item) => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item as OrderItem);
      });

      const ordersWithItems = filteredOrders.map((order) => ({
        ...order,
        order_items: itemsByOrder[order.id] || [],
      })) as EquipmentMapOrder[];

      const orderByTapId = new Map<string, EquipmentMapOrder>();
      ordersWithItems.forEach((order) => {
        if (order.tap_id && !orderByTapId.has(order.tap_id)) {
          orderByTapId.set(order.tap_id, order);
        }
      });

      const rows: EquipmentMapRow[] = ((taps || []) as Tap[]).map((tap) => ({
        tap,
        order: orderByTapId.get(tap.id) || null,
      }));

      const ordersWithoutTap = ordersWithItems.filter((order) => !order.tap_id);

      return {
        rows,
        orders: ordersWithItems,
        ordersWithoutTap,
        summary: {
          tapsTotal: rows.length,
          tapsOccupied: rows.filter((row) => row.order).length,
          tapsAvailable: rows.filter((row) => !row.order && row.tap.status !== 'manutencao').length,
          tapsMaintenance: rows.filter((row) => row.tap.status === 'manutencao').length,
          litersByBeer: ordersWithItems.reduce<Record<string, number>>((acc, order) => {
            summarizeOrderItems(order.order_items).forEach((item) => {
              acc[item.beerName] = (acc[item.beerName] || 0) + item.liters;
            });
            return acc;
          }, {}),
        },
      };
    },
  });
}

export { summarizeOrderItems };
