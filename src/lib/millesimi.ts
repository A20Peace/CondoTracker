/**
 * Distributes an expense across units proportionally to their millesimi,
 * reconciling rounding so the per-unit cents sum back EXACTLY to the total.
 *
 * Largest-remainder method on integer cents: floor every share, then hand the
 * leftover cents (one each) to the units with the largest fractional part.
 */
export interface MillesimiItem {
  id: string;
  millesimi: number;
}

/** Returns a map unitId → quota (EUR, 2 decimals) summing exactly to `amount`. */
export function distribute(
  amount: number,
  items: MillesimiItem[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (items.length === 0) return result;

  const totalCents = Math.round(amount * 100);
  const totalM = items.reduce((s, it) => s + Math.max(0, it.millesimi), 0);

  // No millesimi to weight by → split evenly.
  const weights = totalM > 0 ? items.map((it) => Math.max(0, it.millesimi)) : items.map(() => 1);
  const weightSum = totalM > 0 ? totalM : items.length;

  const provisional = items.map((it, i) => {
    const exact = (totalCents * weights[i]!) / weightSum;
    const floor = Math.floor(exact);
    return { id: it.id, floor, frac: exact - floor };
  });

  const allocated = provisional.reduce((s, p) => s + p.floor, 0);
  let remainder = totalCents - allocated; // extra cents to hand out

  // Distribute the leftover cents to the largest fractional remainders.
  const order = [...provisional].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < order.length && remainder > 0; i++) {
    order[i]!.floor += 1;
    remainder -= 1;
  }

  for (const p of provisional) result.set(p.id, p.floor / 100);
  return result;
}
