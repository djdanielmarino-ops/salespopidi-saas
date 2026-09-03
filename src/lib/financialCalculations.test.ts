import { describe, expect, it } from 'vitest';
import { calculatePaymentAmounts } from '@/hooks/useFinancialAccounts';

describe('calculatePaymentAmounts', () => {
  it('desconta a taxa somente quando a empresa paga', () => {
    expect(calculatePaymentAmounts(1000, { fee_percentage: 3, fee_fixed: 2, fee_payer: 'company' })).toEqual({
      calculatedFee: 32, deductedFee: 32, netAmount: 968,
    });
  });

  it('mantém venda e líquido integrais quando o cliente paga', () => {
    expect(calculatePaymentAmounts(1000, { fee_percentage: 3, fee_fixed: 2, fee_payer: 'customer' })).toEqual({
      calculatedFee: 32, deductedFee: 0, netAmount: 1000,
    });
  });
});
