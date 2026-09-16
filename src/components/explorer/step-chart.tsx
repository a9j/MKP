"use client";

import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sourced } from "@/components/sourced";
import { usd } from "@/lib/format";

export type StepRow = {
  step: number;
  current: number | null;
  currentSource: string | null;
  adjusted: number | null;
  adjustedSource: string | null;
};

type Props = {
  rows: StepRow[];
  lane: string;
  currentYear: string;
  baseYear: string;
  cpiSourceUrl: string;
  baseCpiYear: number;
  latestCpiYear: number;
};

/**
 * Every step on the schedule, now against the base year carried forward by CPI.
 *
 * Both series are dollars on one axis. The site palette is deliberately muted,
 * so the two brand colors clear the separation checks that decide whether the
 * series can be told apart, but read as low chroma. Identity therefore never
 * rests on color: the base year line is dashed, both lines are labelled at
 * their last point, a legend is always present, and the table below carries
 * every plotted figure with its source link.
 */
export function StepChart({
  rows,
  lane,
  currentYear,
  baseYear,
  cpiSourceUrl,
  baseCpiYear,
  latestCpiYear,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const plotted = rows.filter((r) => r.current !== null || r.adjusted !== null);
  if (plotted.length === 0) return null;

  const currentLabel = `${currentYear} schedule`;
  const baseLabel = `${baseYear.slice(0, 4)} schedule, in today's dollars`;

  return (
    <figure className="chart">
      <figcaption>
        <strong>Every step since {baseYear.slice(0, 4)}, adjusted for inflation</strong>
        <span>
          Lane {lane}. The {baseYear.slice(0, 4)} schedule carried forward by CPI from{" "}
          {baseCpiYear} to {latestCpiYear}.
        </span>
      </figcaption>

      <div className="legend">
        <span className="legend-item">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" className="mark-current" strokeWidth="2" />
          </svg>
          {currentLabel}
        </span>
        <span className="legend-item">
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              className="mark-base"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          {baseLabel}
        </span>
      </div>

      <div className="chart-plot" role="img" aria-label={`${currentLabel} against ${baseLabel}, by step`}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={plotted} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} className="grid" />
            <XAxis
              dataKey="step"
              tickLine={false}
              axisLine={false}
              className="axis"
              tickMargin={8}
              label={{ value: "Step", position: "insideBottom", offset: -2, className: "axis-title" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              className="axis"
              width={64}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip
              cursor={{ strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="tip">
                    <div className="tip-head">Step {label}</div>
                    {payload.map((p) => (
                      <div className="tip-row" key={String(p.dataKey)}>
                        <span>{p.dataKey === "current" ? currentLabel : baseLabel}</span>
                        <b>{usd(Number(p.value))}</b>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="adjusted"
              className="mark-base"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              className="mark-current"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        className="chart-toggle"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? "Hide the numbers" : "Show the numbers"}
      </button>

      {/* The chart cannot carry a gold underline per point, so the table is
          where every plotted figure links to the document it came from. */}
      <div id={tableId} hidden={!showTable}>
        <table className="data-table">
          <caption>
            Every figure below links to the document it came from. Inflation uses CPI{" "}
            <Sourced href={cpiSourceUrl}>
              {baseCpiYear} to {latestCpiYear}
            </Sourced>
            .
          </caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">{currentLabel}</th>
              <th scope="col">{baseLabel}</th>
            </tr>
          </thead>
          <tbody>
            {plotted.map((row) => (
              <tr key={row.step}>
                <th scope="row">{row.step}</th>
                <td>
                  {row.current !== null && row.currentSource ? (
                    <Sourced href={row.currentSource}>{usd(row.current)}</Sourced>
                  ) : (
                    <span className="unavailable">Not published</span>
                  )}
                </td>
                <td>
                  {row.adjusted !== null && row.adjustedSource ? (
                    <Sourced href={row.adjustedSource}>{usd(row.adjusted)}</Sourced>
                  ) : (
                    <span className="unavailable">Not published</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
