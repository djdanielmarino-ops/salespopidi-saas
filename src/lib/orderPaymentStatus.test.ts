import { describe, expect, it } from 'vitest';
import type { Order, Payment } from '@/types/database';
import { getOrderPaidAmount, getOrderPaymentStatus } from './orderPaymentStatus';

const payment = (amount: number, status: Payment['status'] = 'pago') => ({ amount, status } as Payment);
const order = (total: number, payments: Payment[] = []) => ({ total, payments } as Order);

describe('order payment status', () => {
  it('classifies orders without payments as pending', () => {
    expect(getOrderPaymentStatus(order(100))).toBe('pending');
  });

  it('classifies an incomplete amount as partial', () => {
    expect(getOrderPaymentStatus(order(100, [payment(40)]))).toBe('partial');
  });

  it('classifies the full amount as paid', () => {
    expect(getOrderPaymentStatus(order(100, [payment(40), payment(60)]))).toBe('paid');
  });

  it('ignores cancelled payments', () => {
    const payments = [payment(100, 'cancelado'), payment(25)];
    expect(getOrderPaidAmount(payments)).toBe(25);
    expect(getOrderPaymentStatus(order(100, payments))).toBe('partial');
  });
});
