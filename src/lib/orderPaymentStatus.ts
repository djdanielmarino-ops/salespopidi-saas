import type { Order, Payment } from '@/types/database';

export type OrderPaymentStatus = 'pending' | 'partial' | 'paid';

export function getOrderPaidAmount(payments: Payment[] | undefined) {
  return (payments ?? [])
    .filter((payment) => payment.status !== 'cancelado')
    .reduce((total, payment) => total + Number(payment.amount), 0);
}

export function getOrderPaymentStatus(order: Pick<Order, 'total' | 'payments'>): OrderPaymentStatus {
  const total = Number(order.total);
  const paid = getOrderPaidAmount(order.payments);
  if (paid <= 0) return 'pending';
  return paid + 0.005 >= total ? 'paid' : 'partial';
}

export const orderPaymentStatusLabels: Record<OrderPaymentStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
};
