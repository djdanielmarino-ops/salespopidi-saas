import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderItem, Payment } from '@/types/database';

export type CustomerOrder = Omit<Order, 'taps' | 'cylinders'> & {
  order_items?: (OrderItem & { barrel_models?: { volume: number } | null })[];
  payments?: Payment[];
  taps?: {
    code: string;
    voltage: string | null;
    tap_types?: { name: string } | null;
  } | null;
  cylinders?: { code: string } | null;
};

const sel = (s: string): string => s;

const SELECT = sel(`
  *,
  order_items(*, barrel_models(volume), beer_types(name)),
  payments(*),
  taps(code, voltage, tap_types(name)),
  cylinders(code)
`);

export function useCustomerHistory(customerId: string | null) {
  return useQuery({
    queryKey: ['crm-customer-history', customerId],
    enabled: !!customerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(SELECT)
        .eq('customer_id', customerId!)
        .order('delivery_date', { ascending: false })
        .order('created_at', { ascending: false })
        .returns<CustomerOrder[]>();
      if (error) {
        if (import.meta.env.DEV) console.error('[CRM] history error', error);
        throw new Error('Não foi possível carregar o histórico agora.');
      }
      return data ?? [];
    },
  });
}

export interface CustomerMetrics {
  totalOrders: number;
  cancelledOrders: number;
  totalPaid: number;
  totalContracted: number;
  totalPending: number;
  totalLiters: number;
  averageTicket: number;
  lastPurchaseDate: string | null;
  largestOrderValue: number;
}

const isValid = (o: CustomerOrder) => o.status !== 'cancelado';
const paidSum = (o: CustomerOrder) =>
  (o.payments ?? [])
    .filter((p) => p.status === 'pago')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

export function useCustomerAggregates(orders: CustomerOrder[]) {
  return useMemo(() => {
    const valid = orders.filter(isValid);
    const cancelled = orders.length - valid.length;

    let totalPaid = 0;
    let totalContracted = 0;
    let totalLiters = 0;
    let largest = 0;
    let lastDate: string | null = null;

    for (const o of valid) {
      const paid = paidSum(o);
      totalPaid += paid;
      totalContracted += Number(o.total || 0);
      largest = Math.max(largest, Number(o.total || 0));
      if (!lastDate || o.delivery_date > lastDate) lastDate = o.delivery_date;
      for (const it of o.order_items ?? []) {
        totalLiters += Number(it.quantity_liters || 0);
      }
    }

    const metrics: CustomerMetrics = {
      totalOrders: valid.length,
      cancelledOrders: cancelled,
      totalPaid,
      totalContracted,
      totalPending: Math.max(0, totalContracted - totalPaid),
      totalLiters,
      averageTicket: valid.length > 0 ? totalPaid / valid.length : 0,
      lastPurchaseDate: lastDate,
      largestOrderValue: largest,
    };

    // Endereços (só entrega)
    const addressMap = new Map<
      string,
      { display: string; count: number; last: string }
    >();
    for (const o of valid) {
      if (o.delivery_type !== 'entrega') continue;
      const parts = [
        o.delivery_address_street,
        o.delivery_address_number,
        o.delivery_address_complement,
        o.delivery_address_neighborhood,
        o.delivery_address_city,
        o.delivery_address_state,
      ].filter(Boolean);
      if (parts.length === 0) continue;
      const display = parts.join(', ');
      const key = display.toLowerCase().replace(/\s+/g, ' ').trim();
      const cur = addressMap.get(key);
      if (cur) {
        cur.count += 1;
        if (o.delivery_date > cur.last) cur.last = o.delivery_date;
      } else {
        addressMap.set(key, { display, count: 1, last: o.delivery_date });
      }
    }
    const addresses = Array.from(addressMap.values()).sort(
      (a, b) => b.count - a.count || b.last.localeCompare(a.last),
    );

    // Equipamentos (chopeiras)
    const equipMap = new Map<
      string,
      { type: string; voltage: string | null; count: number; last: string }
    >();
    for (const o of valid) {
      if (!o.taps) continue;
      const type = o.taps.tap_types?.name || 'Chopeira';
      const voltage = o.taps.voltage;
      const key = `${type}||${voltage ?? ''}`;
      const cur = equipMap.get(key);
      if (cur) {
        cur.count += 1;
        if (o.delivery_date > cur.last) cur.last = o.delivery_date;
      } else {
        equipMap.set(key, { type, voltage, count: 1, last: o.delivery_date });
      }
    }
    const equipment = Array.from(equipMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    // Consumo por tamanho de barril
    const barrelMap = new Map<number, number>();
    for (const o of valid) {
      for (const it of o.order_items ?? []) {
        const vol = it.barrel_models?.volume;
        if (!vol) continue;
        const qty = Number(it.barrel_quantity ?? 1) || 1;
        barrelMap.set(vol, (barrelMap.get(vol) ?? 0) + qty);
      }
    }
    const barrels = Array.from(barrelMap.entries())
      .map(([volume, count]) => ({ volume, count }))
      .sort((a, b) => b.count - a.count);
    const topBarrel = barrels[0] ?? null;
    const avgLitersPerOrder =
      valid.length > 0 ? totalLiters / valid.length : 0;

    return {
      metrics,
      addresses,
      equipment,
      consumption: { barrels, topBarrel, avgLitersPerOrder, totalLiters },
    };
  }, [orders]);
}

export function paidForOrder(o: CustomerOrder): number {
  return paidSum(o);
}
