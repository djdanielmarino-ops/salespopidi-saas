import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  totalVolume: number;
  orderCount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentsByMethod: Record<string, number>;
}

export function useFinancialData(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['financial', startDate, endDate],
    queryFn: async (): Promise<FinancialSummary> => {
      // Fetch orders in the period
      const [{ data: orders, error: ordersError }, { data: operatingCosts, error: costsError }] = await Promise.all([
        supabase.from('orders').select('*, order_items(*, beer_types(*)), payments(*)').gte('delivery_date', startDate).lte('delivery_date', endDate).neq('status', 'cancelado'),
        supabase.from('cost_entries').select('amount').gte('cost_date', startDate).lte('cost_date', endDate),
      ]);

      if (ordersError) throw ordersError;
      if (costsError) throw costsError;

      let totalRevenue = 0;
      let totalCost = 0;
      let totalVolume = 0;
      let paidAmount = 0;
      const paymentsByMethod: Record<string, number> = {};

      orders?.forEach(order => {
        totalRevenue += Number(order.total) || 0;
        
        // Calculate volume and cost from items
        order.order_items?.forEach((item: any) => {
          totalVolume += Number(item.quantity_liters) || 0;
          // Snapshot saved at the sale keeps historical reports stable.
          totalCost += Number(item.total_cost_at_sale) || 0;
        });

        // Sum payments
        order.payments?.forEach((payment: any) => {
          if (payment.status === 'pago') {
            paidAmount += Number(payment.amount) || 0;
            const method = payment.payment_method;
            paymentsByMethod[method] = (paymentsByMethod[method] || 0) + Number(payment.amount);
            // Only the fee borne by the company affects its result.
            totalCost += Number(payment.deducted_fee) || 0;
          }
        });
      });

      totalCost += operatingCosts?.reduce((sum, cost) => sum + Number(cost.amount || 0), 0) || 0;

      return {
        totalRevenue,
        totalCost,
        profit: totalRevenue - totalCost,
        totalVolume,
        orderCount: orders?.length || 0,
        paidAmount,
        pendingAmount: totalRevenue - paidAmount,
        paymentsByMethod,
      };
    },
  });
}

export function useFinancialComparison(
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string
) {
  const period1 = useFinancialData(period1Start, period1End);
  const period2 = useFinancialData(period2Start, period2End);

  return {
    period1: period1.data,
    period2: period2.data,
    isLoading: period1.isLoading || period2.isLoading,
    error: period1.error || period2.error,
  };
}

export function useMonthlyRevenue(year: number) {
  return useQuery({
    queryKey: ['monthly-revenue', year],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('delivery_date, total')
        .gte('delivery_date', `${year}-01-01`)
        .lte('delivery_date', `${year}-12-31`)
        .neq('status', 'cancelado');

      if (error) throw error;

      const monthlyData: Record<number, number> = {};
      for (let i = 1; i <= 12; i++) {
        monthlyData[i] = 0;
      }

      orders?.forEach(order => {
        const month = new Date(order.delivery_date).getMonth() + 1;
        monthlyData[month] += Number(order.total) || 0;
      });

      return Object.entries(monthlyData).map(([month, revenue]) => ({
        month: Number(month),
        revenue,
      }));
    },
  });
}
