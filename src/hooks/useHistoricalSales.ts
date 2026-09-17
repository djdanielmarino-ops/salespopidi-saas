import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type HistoricalMonth = {
  month: string;
  sales_rows: number;
  expense_rows: number;
  reported_paid_sales: number | null;
  recorded_sales_cost: number | null;
  result_on_reported_paid: number | null;
  recorded_expense_cost: number | null;
  sales_missing_paid: number;
  possible_duplicate_rows: number;
  unlinked_sales: number;
};

export type HistoricalProductMonth = {
  month: string;
  product_name: string;
  sales_rows: number;
  received: number | null;
  liters: number | null;
  missing_paid_rows: number;
  possible_duplicate_rows: number;
};

// The generated Supabase types predate the historical-import migrations.
// Keep the untyped boundary here rather than spreading casts across pages.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const historicalDb = supabase as any;

const numberOrNull = (value: unknown) => value == null ? null : Number(value);

export function useHistoricalSales() {
  return useQuery({
    queryKey: ['historical-sales'],
    queryFn: async () => {
      const [monthlyResult, productsResult] = await Promise.all([
        historicalDb.from('historical_sales_monthly').select('*').order('month'),
        historicalDb.from('historical_products_monthly').select('*').order('month'),
      ]);
      if (monthlyResult.error) throw monthlyResult.error;
      if (productsResult.error) throw productsResult.error;

      return {
        monthly: (monthlyResult.data ?? []).map((row: Record<string, unknown>): HistoricalMonth => ({
          month: String(row.month),
          sales_rows: Number(row.sales_rows),
          expense_rows: Number(row.expense_rows),
          reported_paid_sales: numberOrNull(row.reported_paid_sales),
          recorded_sales_cost: numberOrNull(row.recorded_sales_cost),
          result_on_reported_paid: numberOrNull(row.result_on_reported_paid),
          recorded_expense_cost: numberOrNull(row.recorded_expense_cost),
          sales_missing_paid: Number(row.sales_missing_paid),
          possible_duplicate_rows: Number(row.possible_duplicate_rows),
          unlinked_sales: Number(row.unlinked_sales),
        })),
        products: (productsResult.data ?? []).map((row: Record<string, unknown>): HistoricalProductMonth => ({
          month: String(row.month),
          product_name: String(row.product_name ?? 'Sem produto'),
          sales_rows: Number(row.sales_rows),
          received: numberOrNull(row.received),
          liters: numberOrNull(row.liters),
          missing_paid_rows: Number(row.missing_paid_rows),
          possible_duplicate_rows: Number(row.possible_duplicate_rows),
        })),
      };
    },
  });
}
