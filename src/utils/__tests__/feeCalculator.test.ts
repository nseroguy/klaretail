import { calculateOrderFees } from '../feeCalculator';

describe('v11.4 Fee Calculator Engine', () => {
  const ntindaZone = { floorFee: 5000, ceilingFee: 8000 };
  
  // Coordinates approximately 3 km apart in Ntinda / Ministers Village
  const vendorLoc = { latitude: 0.3541, longitude: 32.6183 };
  const deliveryLoc = { latitude: 0.3750, longitude: 32.6350 };

  it('calculates exact figures for an order <= 25,000 UGX with service fee & rounding (COD)', () => {
    const result = calculateOrderFees({
      productSubtotal: 15000,
      vendorLocation: vendorLoc,
      deliveryLocation: deliveryLoc,
      zone: ntindaZone,
      paymentMethod: 'cod',
    });

    const { receipt, ledger } = result;

    // D_rider = clamp(5000, 1500 + 1500 * ~2.97, 8000) = ~5955 -> clamped
    expect(receipt.riderDeliveryComponent).toBeGreaterThanOrEqual(ntindaZone.floorFee);
    expect(receipt.riderDeliveryComponent).toBeLessThanOrEqual(ntindaZone.ceilingFee);
    
    // Service fee should NOT be waived
    expect(receipt.serviceFee).toBe(1500);

    // Convenience fee is 0 for COD
    expect(receipt.convenienceFee).toBe(0);

    // Rounding should produce multiple of 100
    expect(receipt.finalPayable % 100).toBe(0);
    expect(receipt.codRoundingSurplus).toBeGreaterThanOrEqual(0);
    expect(receipt.codRoundingSurplus).toBeLessThan(100);

    // Sum of splits must match final unrounded total exactly
    const accountedTotal =
      ledger.riderPayout +
      ledger.platformDeliveryShare +
      ledger.platformServiceFee +
      ledger.platformCommission +
      ledger.vendorPayout +
      ledger.damageReserveCredit +
      ledger.paymentGatewayFee;

    expect(accountedTotal).toBe(receipt.totalUnrounded);
  });

  it('waives service fee when subtotal > 25,000 UGX', () => {
    const result = calculateOrderFees({
      productSubtotal: 30000,
      vendorLocation: vendorLoc,
      deliveryLocation: deliveryLoc,
      zone: ntindaZone,
      paymentMethod: 'pesapal',
    });

    expect(result.receipt.serviceFee).toBe(0);
    expect(result.ledger.platformServiceFee).toBe(0);
    expect(result.receipt.convenienceFee).toBeGreaterThan(0); // 3.5% applied
  });
});