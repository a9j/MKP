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

export type TrendRow = {
  fiscalYear: number;
  amount: number;
  sourceUrl: string;
};

/**
 * One department across the years that have been loaded.
 *
 * Drawn only when there are at least two years, because a line through one
 * point is a claim about a trend that the data does not make. Nothing on the
 * chart animates: the site has one animation and it is not this.
 */
export function BudgetTrend({
  department,
  fund,
  rows,
}: {
  department: string;
  fund: string;
  rows: TrendRow[];
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  if (rows.length < 2) return null;

  return (
    <figure className="chart">
      <figcaption>
        <strong>
          {department}, {rows[0].fiscalYear} to {rows[rows.length - 1].fiscalYear}
        </strong>
        <span>{fund}. Only the years loaded into the site are plotted.</span>
      </figcaption>

      <div
        className="chart-plot"
        role="img"
        aria-label={`${department} in the ${fund}, by fiscal year`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} className="grid" />
            <XAxis
              dataKey="fiscalYear"
              tickLine={false}
              axisLine={false}
              className="axis"
              tickMargin={8}
              label={{
                value: "Fiscal year",
                position: "insideBottom",
                offset: -2,
                className: "axis-title",
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              className="axis"
              width={64}
              tickFormatter={(value: number) => `$${Math.round(value / 1_000_000)}m`}
            />
            <Tooltip
              cursor={{ strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="tip">
                    <div className="tip-head">Fiscal year {label}</div>
                    <div className="tip-row">
                      <span>{department}</span>
                      <b>{usd(Number(payload[0].value))}</b>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              className="mark-current"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
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
        onClick={() => setShowTable((open) => !open)}
      >
        {showTable ? "Hide the numbers" : "Show the numbers"}
      </button>

      {/* A chart cannot carry a gold underline per point, so the table is where
          every plotted figure links to the page it came from. */}
      <div id={tableId} hidden={!showTable}>
        <table className="data-table">
          <caption>Every figure below links to the document it came from.</caption>
          <thead>
            <tr>
              <th scope="col">Fiscal year</th>
              <th scope="col">{department}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.fiscalYear}>
                <th scope="row">{row.fiscalYear}</th>
                <td>
                  <Sourced href={row.sourceUrl}>{usd(row.amount)}</Sourced>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
