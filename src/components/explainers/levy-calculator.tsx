"use client";

import { useId, useState } from "react";
import { usd } from "@/lib/format";
import {
  levyCost,
  parseMoney,
  usdCents,
  LEVY_METHOD_NOTE,
  RENEWAL_NOTE,
} from "@/lib/levy-math";
import type { LevyKind } from "@/lib/explainer-types";

/**
 * What the levy would cost a home of a given value. The math lives in
 * levy-math.ts, where it is tested; this is only the input and the result.
 */
export function LevyCalculator({
  mills,
  costPer100k,
  levyKind,
}: {
  mills: number | null;
  costPer100k: number | null;
  levyKind: LevyKind;
}) {
  const id = useId();
  const [text, setText] = useState(usd(100_000));
  const value = parseMoney(text);
  const cost = value === null ? null : levyCost(value, { mills, costPer100k });

  if (levyCost(100_000, { mills, costPer100k }) === null) return null;

  return (
    <section className="levy-calc" aria-labelledby={`${id}-head`}>
      <h2 id={`${id}-head`}>What would it cost you?</h2>
      <div className="field">
        <label htmlFor={`${id}-value`}>Your home&rsquo;s market value</label>
        <input
          id={`${id}-value`}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (value !== null) setText(usd(value));
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={value === null}
        />
        <p className="counter" id={`${id}-hint`}>
          {value === null
            ? "Enter a dollar amount, like $150,000."
            : "Find it on the county auditor's website or your tax bill."}
        </p>
      </div>

      <div className="levy-calc-result" aria-live="polite">
        {cost ? (
          <>
            <p>
              <span className="levy-calc-figure">{usdCents(cost.perYear)}</span> a year
            </p>
            <p>
              <span className="levy-calc-figure">{usdCents(cost.perMonth)}</span> a month
            </p>
          </>
        ) : (
          <p>Enter your home&rsquo;s value to see an estimate.</p>
        )}
      </div>

      {cost ? <p className="note">{LEVY_METHOD_NOTE[cost.method]}</p> : null}
      {levyKind === "renewal" || levyKind === "renewal_with_increase" ? (
        <p className="note">{RENEWAL_NOTE}</p>
      ) : null}
    </section>
  );
}
