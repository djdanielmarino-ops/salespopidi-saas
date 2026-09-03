import { describe, expect, it } from 'vitest';
import { calculateCustomerPendingOrders } from './customerFinancialPending';

describe('calculateCustomerPendingOrders', () => {
  it('returns only orders that still have a balance', () => {
    const result = calculateCustomerPendingOrders([
      { id: 'open', order_number: 10, created_at: '2026-08-01T12:00:00Z', total: 500, payments: [{ amount: 200, status: 'pago' }] },
      { id: 'paid', order_number: 11, created_at: '2026-08-02T12:00:00Z', total: 300, payments: [{ amount: 300, status: 'pago' }] },
    ]);

    expect(result).toEqual([
      { id: 'open', orderNumber: 10, purchaseDate: '2026-08-01T12:00:00Z', total: 500, paid: 200, pending: 300 },
    ]);
  });

  it('does not count cancelled or pending payment records as paid', () => {
    const [result] = calculateCustomerPendingOrders([
      {
        id: 'open',
        order_number: 12,
        created_at: '2026-08-03T12:00:00Z',
        total: 500,
        payments: [
          { amount: 100, status: 'pago' },
          { amount: 150, status: 'cancelado' },
          { amount: 50, status: 'pendente' },
        ],
      },
    ]);

    expect(result.pending).toBe(400);
  });
});

