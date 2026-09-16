"use client";

import { useState } from "react";

/**
 * A list of short lines that grows as you fill it in. Used for the two
 * listening lists, where the number of points is not known in advance.
 */
export function RepeatingRows({
  name,
  legend,
  initial,
  placeholder,
  error,
}: {
  name: string;
  legend: string;
  initial?: string[];
  placeholder?: string;
  error?: string;
}) {
  const [rows, setRows] = useState<string[]>(initial?.length ? initial : [""]);

  return (
    <fieldset className="field-wide rollcall">
      <legend>{legend}</legend>
      {error ? <p className="field-error">{error}</p> : null}
      {rows.map((row, i) => (
        <div className="bullet-row" key={i}>
          <div className="field">
            <label htmlFor={`${name}-${i}`} className="visually-hidden">
              {legend}, line {i + 1}
            </label>
            <input
              id={`${name}-${i}`}
              name={name}
              value={row}
              placeholder={placeholder}
              onChange={(e) =>
                setRows((current) => current.map((r, j) => (i === j ? e.target.value : r)))
              }
            />
          </div>
          <button
            type="button"
            className="inline-add"
            onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
            disabled={rows.length === 1}
            aria-label={`Remove line ${i + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-add"
        onClick={() => setRows((current) => [...current, ""])}
      >
        Add another line
      </button>
    </fieldset>
  );
}
