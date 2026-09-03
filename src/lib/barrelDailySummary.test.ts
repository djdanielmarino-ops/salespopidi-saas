import { describe, expect, it } from 'vitest';
import { buildBarrelDailySummary } from './barrelDailySummary';

describe('buildBarrelDailySummary', () => {
  it('reconstructs the opening brewery stock from daily movements', () => {
    const result = buildBarrelDailySummary(
      [{ id: '30', volume: 30, currentBreweryStock: 58 }],
      [
        { barrel_model_id: '30', movement_type: 'received', quantity: 10 },
        { barrel_model_id: '30', movement_type: 'sent', quantity: 8 },
      ],
    );
    expect(result[0]).toEqual({
      volume: 30,
      initialBreweryStock: 60,
      receivedFromBrewery: 10,
      sentToBrewery: 8,
      currentBreweryStock: 58,
    });
  });
});
