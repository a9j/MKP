/**
 * What a levy costs a homeowner, for the calculator on /levy/[slug].
 *
 * Two methods, in order of preference:
 *
 * 1. The county auditor's certified figure, an annual cost per $100,000 of
 *    market value. When the explainer has it, it is the number to use, since
 *    it already reflects the rollbacks and reductions the auditor applies.
 * 2. Ohio's standard formula: tax is levied on assessed value, which is 35
 *    percent of market value, at one tenth of a cent per mill.
 *    cost = market value x 0.35 x mills / 1000.
 */

export type LevyCostMethod = "auditor" | "formula";

export type LevyCost = {
  perYear: number;
  perMonth: number;
  method: LevyCostMethod;
};

export const ASSESSMENT_RATIO = 0.35;

export function levyCost(
  homeValue: number,
  { mills, costPer100k }: { mills: number | null; costPer100k: number | null },
): LevyCost | null {
  if (!Number.isFinite(homeValue) || homeValue < 0) return null;

  let perYear: number;
  let method: LevyCostMethod;

  if (costPer100k !== null && Number.isFinite(costPer100k)) {
    perYear = (homeValue / 100_000) * costPer100k;
    method = "auditor";
  } else if (mills !== null && Number.isFinite(mills)) {
    perYear = (homeValue * ASSESSMENT_RATIO * mills) / 1000;
    method = "formula";
  } else {
    return null;
  }

  return { perYear, perMonth: perYear / 12, method };
}

export const LEVY_METHOD_NOTE: Record<LevyCostMethod, string> = {
  auditor: "Estimate based on the county auditor's figure.",
  formula:
    "Estimate based on Ohio's standard formula (35% of market value). Your actual bill may differ.",
};

export const RENEWAL_NOTE =
  "A renewal continues an existing tax. It does not add a new cost unless it includes an increase.";

/** Dollars and cents, for a monthly figure that would round to nothing. */
export function usdCents(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "$250,000" or "250000" or "250k" to a number. Null when it is not one. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const match = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(cleaned);
  if (!match) return null;
  const base = Number(match[1]);
  const scale = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  return base * scale;
}
