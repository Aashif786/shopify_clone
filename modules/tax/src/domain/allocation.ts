/**
 * Splits `total` across `weights` proportionally using the largest-remainder
 * method, so the parts always sum to exactly `total` with no minor unit lost
 * or invented.
 *
 * Used to spread a checkout-level discount across order lines. Intermediate
 * products use BigInt: `total * weight` can exceed 2^53 on large orders, and a
 * silently imprecise allocation would make line amounts disagree with totals.
 *
 * Ties on the remainder go to the earlier line, so the result is deterministic.
 */
export function allocateByWeight(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("Allocation total must be a non-negative integer");
  }
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new Error("Allocation weights must be non-negative integers");
    }
  }

  const parts = weights.map(() => 0);
  if (total === 0 || weights.length === 0) {
    return parts;
  }

  const weightSum = weights.reduce((sum, weight) => sum + BigInt(weight), 0n);
  if (weightSum === 0n) {
    throw new Error("Cannot allocate a non-zero total across zero total weight");
  }

  const bigTotal = BigInt(total);
  const remainders: Array<{ index: number; remainder: bigint }> = [];
  let allocated = 0n;

  weights.forEach((weight, index) => {
    const product = bigTotal * BigInt(weight);
    const share = product / weightSum;
    parts[index] = Number(share);
    allocated += share;
    remainders.push({ index, remainder: product % weightSum });
  });

  let leftover = Number(bigTotal - allocated);
  remainders.sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });

  for (const entry of remainders) {
    if (leftover <= 0) break;
    // A zero-weight line must never absorb a unit.
    if (weights[entry.index] === 0) continue;
    parts[entry.index] = (parts[entry.index] ?? 0) + 1;
    leftover -= 1;
  }

  return parts;
}
