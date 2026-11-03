export type VehicleTier = 'BODA' | 'CARGO_TUK_TUK' | 'VAN' | 'LIGHT_TRUCK';

export interface CargoItemSpec {
  unitWeightKg: number;
  unitVolumeCbm: number;
  quantity: number;
  isCrated?: boolean;
}

export interface CargoEvaluation {
  totalWeightKg: number;
  totalVolumeCbm: number;
  totalCrates: number;
  requiredTier: VehicleTier;
}

export function evaluateCargoRequirements(items: CargoItemSpec[]): CargoEvaluation {
  let totalWeightKg = 0;
  let totalVolumeCbm = 0;
  let totalCrates = 0;

  for (const item of items) {
    totalWeightKg += item.unitWeightKg * item.quantity;
    totalVolumeCbm += item.unitVolumeCbm * item.quantity;
    if (item.isCrated) {
      totalCrates += item.quantity;
    }
  }

  let requiredTier: VehicleTier = 'BODA';

  if (totalWeightKg > 850 || totalVolumeCbm > 3.5 || totalCrates > 35) {
    requiredTier = 'LIGHT_TRUCK';
  } else if (totalWeightKg > 350 || totalVolumeCbm > 1.2 || totalCrates > 15) {
    requiredTier = 'VAN';
  } else if (totalWeightKg > 65 || totalVolumeCbm > 0.2 || totalCrates > 3) {
    requiredTier = 'CARGO_TUK_TUK';
  }

  return {
    totalWeightKg: Number(totalWeightKg.toFixed(2)),
    totalVolumeCbm: Number(totalVolumeCbm.toFixed(3)),
    totalCrates,
    requiredTier,
  };
}
