import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem } from '@/types/database';

export interface CalendarOrder extends Order {
  order_items?: OrderItem[];
}

export function useCalendarOrders(month: Date) {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  return useQuery({
    queryKey: ['calendar_orders', startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      // Get orders for the month
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, customers(*), taps(*, tap_types(*)), cylinders(*)')
        .gte('delivery_date', startOfMonth.toISOString().split('T')[0])
        .lte('delivery_date', endOfMonth.toISOString().split('T')[0])
        .neq('status', 'cancelado')
        .order('delivery_date', { ascending: true });
      
      if (ordersError) throw ordersError;
      
      // Get order items for all orders
      const orderIds = orders?.map(o => o.id) || [];
      if (orderIds.length === 0) return [];
      
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*, beer_types(*), barrel_models(*)')
        .in('order_id', orderIds);
      
      if (itemsError) throw itemsError;
      
      // Group items by order_id
      const itemsByOrder: Record<string, OrderItem[]> = {};
      items?.forEach(item => {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item as OrderItem);
      });
      
      // Merge items into orders
      return orders?.map(order => ({
        ...order,
        order_items: itemsByOrder[order.id] || [],
      })) as CalendarOrder[];
    },
  });
}
