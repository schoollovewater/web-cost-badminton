/**
 * Calculates shuttle cost from quantity and tube price.
 * Defaults: 340,000 VND per tube of 12 shuttles.
 */
export function calculateShuttleAmount(
  quantity: number,
  tubePrice: number = 340000,
  shuttlesPerTube: number = 12
): number {
  if (quantity <= 0 || tubePrice <= 0 || shuttlesPerTube <= 0) {
    return 0;
  }
  // Math.round performs round-half-up for positive numbers
  return Math.round((quantity * tubePrice) / shuttlesPerTube);
}
