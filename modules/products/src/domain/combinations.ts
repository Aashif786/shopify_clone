export interface OptionDefinition {
  name: string;
  values: string[];
}

export interface GeneratedVariantCombination {
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

/**
 * Generates Cartesian product combinations for product options.
 * Max 3 options are supported (matching standard multi-tier commerce models).
 * If no options are supplied, returns a single default variant combination.
 */
export function generateVariantCombinations(
  options: OptionDefinition[],
): GeneratedVariantCombination[] {
  const activeOptions = options
    .slice(0, 3)
    .map((opt) => ({
      name: opt.name.trim(),
      values: Array.from(new Set(opt.values.map((v) => v.trim()).filter(Boolean))),
    }))
    .filter((opt) => opt.name.length > 0 && opt.values.length > 0);

  if (activeOptions.length === 0) {
    return [
      {
        title: "Default Title",
        option1: null,
        option2: null,
        option3: null,
      },
    ];
  }

  let combinations: Array<string[]> = [[]];
  for (const opt of activeOptions) {
    const next: Array<string[]> = [];
    for (const prefix of combinations) {
      for (const val of opt.values) {
        next.push([...prefix, val]);
      }
    }
    combinations = next;
  }

  return combinations.map((combo) => ({
    title: combo.join(" / "),
    option1: combo[0] ?? null,
    option2: combo[1] ?? null,
    option3: combo[2] ?? null,
  }));
}
