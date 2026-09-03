import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  productCost: number;
  manualCost: number;
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
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*, beer_types(*)), payments(*)')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate)
        .neq('status', 'cancelado');

      if (ordersError) throw ordersError;

      const { data: costEntries, error: costEntriesError } = await supabase
        .from('cost_entries')
        .select('amount')
        .gte('cost_date', startDate)
        .lte('cost_date', endDate);

      if (costEntriesError) throw costEntriesError;

      let totalRevenue = 0;
      let productCost = 0;
      let totalVolume = 0;
      let paidAmount = 0;
      const paymentsByMethod: Record<string, number> = {};

      orders?.forEach(order => {
        totalRevenue += Number(order.total) || 0;
        
        // Calculate volume and cost from items
        order.order_items?.forEach((item: any) => {
          const totalBarrels = Number(item.barrel_quantity) || 1;
          const soldBarrels = Number(item.sold_barrel_quantity ?? item.barrel_quantity ?? 1);
          const consumedConsigned = Number(item.consigned_consumed_quantity || 0);
          const unitVolume = totalBarrels > 0
            ? Number(item.quantity_liters || 0) / totalBarrels
            : Number(item.quantity_liters || 0);
          const soldVolume = unitVolume * (soldBarrels + consumedConsigned);
          totalVolume += soldVolume;

          if (item.total_cost_at_sale !== null && item.total_cost_at_sale !== undefined) {
            productCost += Number(item.total_cost_at_sale) || 0;
          } else {
            const costPerLiter = Number(item.unit_cost_at_sale ?? item.beer_types?.cost_per_liter) || 0;
            productCost += costPerLiter * soldVolume;
          }
        });

        // Sum payments
        order.payments?.forEach((payment: any) => {
          if (payment.status === 'pago') {
            paidAmount += Number(payment.amount) || 0;
            const method = payment.payment_method;
            paymentsByMethod[method] = (paymentsByMethod[method] || 0) + Number(payment.amount);
          }
        });
      });

      const manualCost = costEntries?.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) || 0;
      const totalCost = productCost + manualCost;

      return {
        totalRevenue,
        totalCost,
        productCost,
        manualCost,
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
