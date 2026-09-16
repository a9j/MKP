/** Whole dollars, no cents. Figures on this site are never more precise. */
export function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** Same as usd, with a leading plus for a gain. */
export function usdDelta(amount: number): string {
  return `${amount >= 0 ? "+" : "-"}${usd(Math.abs(amount))}`;
}
