"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sourced } from "@/components/sourced";
import { usd, usdDelta } from "@/lib/format";
import type { ExplorerData } from "@/lib/queries/explorer";

// Recharts is a large dependency and only the full variant draws a chart.
// Loading it lazily keeps it out of the home page bundle entirely.
const StepChart = dynamic(
  () => import("@/components/explorer/step-chart").then((m) => m.StepChart),
  { ssr: false, loading: () => <div className="chart-loading">Loading the chart</div> },
);

const DURATION_MS = 400;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Props = {
  data: ExplorerData;
  /** "preview" is the hero widget. "full" adds the chart from the copy doc. */
  variant?: "preview" | "full";
  id?: string;
};

export function PayExplorer({ data, variant = "preview", id }: Props) {
  const [lane, setLane] = useState(() => data.lanes[Math.min(1, data.lanes.length - 1)]);
  const [step, setStep] = useState(() => data.steps[Math.min(2, data.steps.length - 1)]);
  const [district, setDistrict] = useState(() => data.districts[0] ?? "");

  const home = data.byDistrict[data.homeDistrict];
  const cell = home?.[lane]?.[step];
  const salary = cell?.value ?? 0;

  // Only the headline figure is in motion. Everything below is derived from the
  // real value, so nothing else lags behind the inputs.
  const [shown, setShown] = useState(salary);
  const shownRef = useRef(salary);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    const from = shownRef.current;
    if (from === salary) return;
    if (prefersReducedMotion()) {
      setShown(salary);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const linear = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - linear, 3);
      setShown(from + (salary - from) * eased);
      if (linear < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [salary]);

  // A district that publishes different lane names has no row at this lane and
  // step. Saying so is the only honest answer: the nearest lane is a guess.
  const comparison = district ? data.byDistrict[district]?.[lane]?.[step] : undefined;
  const comparisonMissing = Boolean(district) && !comparison;

  const inflationCell = data.inflation?.salaries?.[lane]?.[step];
  const inflationValue =
    data.inflation && inflationCell ? inflationCell.value * data.inflation.factor : null;

  const chartRows = useMemo(() => {
    if (!data.inflation) return [];
    return data.steps.map((s) => {
      const now = home?.[lane]?.[s];
      const then = data.inflation?.salaries?.[lane]?.[s];
      return {
        step: s,
        current: now?.value ?? null,
        currentSource: now?.sourceUrl ?? null,
        adjusted: then && data.inflation ? Math.round(then.value * data.inflation.factor) : null,
        adjustedSource: then?.sourceUrl ?? null,
      };
    });
  }, [data.inflation, data.steps, home, lane]);

  return (
    <div className="explorer" id={id} aria-label="Toledo Teacher Pay Explorer">
      <div className="ex-head">
        <strong>Toledo Teacher Pay Explorer</strong>
        <span>{data.schoolYear}</span>
      </div>

      <div className="fields">
        <div className="field">
          <label htmlFor={`${id ?? "ex"}-step`}>Step</label>
          <select
            id={`${id ?? "ex"}-step`}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          >
            {data.steps.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id ?? "ex"}-lane`}>Lane</label>
          <select
            id={`${id ?? "ex"}-lane`}
            value={lane}
            onChange={(e) => setLane(e.target.value)}
          >
            {data.lanes.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id ?? "ex"}-district`}>Compare to</label>
          <select
            id={`${id ?? "ex"}-district`}
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {data.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="result">
        <div className="lab">You make</div>
        <div className="big">
          {cell ? (
            <Sourced href={cell.sourceUrl} large>
              <span aria-live="polite">{usd(shown)}</span>
            </Sourced>
          ) : (
            <span className="unavailable">Not published for this step and lane</span>
          )}
        </div>

        <div className="rows">
          <div className="row">
            <span>Same step and lane in {district || "another district"}</span>
            <b>
              {comparison ? (
                <Sourced href={comparison.sourceUrl}>{usd(comparison.value)}</Sourced>
              ) : comparisonMissing ? (
                <span className="unavailable">Not directly comparable</span>
              ) : (
                <span className="unavailable">No district data</span>
              )}
            </b>
          </div>

          <div className="row">
            <span>Scenario A: {data.scenarioAPct}% across the board</span>
            <b className="up">
              {cell ? (
                <Sourced href={cell.sourceUrl}>
                  {usdDelta(salary * (data.scenarioAPct / 100))}
                </Sourced>
              ) : (
                <span className="unavailable">Not available</span>
              )}
            </b>
          </div>

          <div className="row">
            <span>Scenario B: {usd(data.scenarioBFlat)} flat</span>
            {/* No gold here on purpose. This figure is the scenario's own
                definition, not a number read off a public record, and the gold
                underline promises a source document. */}
            <b className="up">{usdDelta(data.scenarioBFlat)}</b>
          </div>

          {inflationValue !== null && inflationCell ? (
            <div className="row">
              <span>Your {data.inflation?.baseSchoolYear.slice(0, 4)} step, in today&rsquo;s dollars</span>
              <b>
                <Sourced href={inflationCell.sourceUrl}>{usd(inflationValue)}</Sourced>
              </b>
            </div>
          ) : null}
        </div>
      </div>

      {variant === "full" && data.inflation && chartRows.length > 0 ? (
        <StepChart
          rows={chartRows}
          lane={lane}
          currentYear={data.schoolYear}
          baseYear={data.inflation.baseSchoolYear}
          cpiSourceUrl={data.inflation.cpiSourceUrl}
          baseCpiYear={data.inflation.baseCpiYear}
          latestCpiYear={data.inflation.latestCpiYear}
        />
      ) : null}

      <div className="ex-foot">
        <span className="dot" aria-hidden="true" />
        Gold underline means it links to the source document.
      </div>
    </div>
  );
}
