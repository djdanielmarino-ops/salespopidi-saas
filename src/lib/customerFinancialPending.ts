import { supabase } from '@/integrations/supabase/client';

export interface CustomerPendingOrder {
  id: string;
  orderNumber: number;
  purchaseDate: string;
  total: number;
  paid: number;
  pending: number;
}

interface PendingOrderRow {
  id: string;
  order_number: number;
  created_at: string;
  total: number | string | null;
  payments?: Array<{ amount: number | string | null; status: string }> | null;
}

export function calculateCustomerPendingOrders(rows: PendingOrderRow[]): CustomerPendingOrder[] {
  return rows
    .map((order) => {
      const total = Number(order.total || 0);
      const paid = (order.payments || [])
        .filter((payment) => payment.status === 'pago')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      return {
        id: order.id,
        orderNumber: order.order_number,
        purchaseDate: order.created_at,
        total,
        paid,
        pending: Math.max(0, total - paid),
      };
    })
    .filter((order) => order.pending > 0.009)
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
}

export async function fetchCustomerPendingOrders(
  customerId: string,
  excludedOrderId?: string,
): Promise<CustomerPendingOrder[]> {
  let query = supabase
    .from('orders')
    .select('id, order_number, created_at, total, payments(amount, status)')
    .eq('customer_id', customerId)
    .neq('status', 'cancelado');

  if (excludedOrderId) query = query.neq('id', excludedOrderId);

  const { data, error } = await query;
  if (error) throw error;

  return calculateCustomerPendingOrders((data || []) as PendingOrderRow[]);
}
