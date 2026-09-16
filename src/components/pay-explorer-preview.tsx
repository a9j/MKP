"use client";

import { useEffect, useRef, useState } from "react";
import { Sourced } from "@/components/sourced";
import { usd, usdDelta } from "@/lib/format";

/**
 * Hero preview of the Toledo Teacher Pay Explorer.
 *
 * Phase 1 only. The figures below are the illustrative sample values from the
 * mockup. Phase 3 replaces them with the salary_schedule table, at which point
 * every figure carries its own row's source_url and a missing source_url is a
 * build time error.
 */

const SAMPLE_SALARIES: Record<string, Record<number, number>> = {
  BA: { 1: 42800, 3: 45100, 7: 49900, 10: 54200, 15: 60900, 20: 66400 },
  "BA+15": { 1: 44300, 3: 46700, 7: 52410, 10: 56900, 15: 63800, 20: 69500 },
  MA: { 1: 47100, 3: 49800, 7: 55600, 10: 60700, 15: 68200, 20: 74100 },
  "MA+30": { 1: 49400, 3: 52200, 7: 58300, 10: 63800, 15: 71600, 20: 77900 },
};

const SAMPLE_DISTRICT_RATIOS: Record<string, number> = {
  Sylvania: 1.124,
  Perrysburg: 1.091,
  "Washington Local": 1.038,
  Springfield: 1.012,
  Maumee: 1.067,
};

const STEPS = [1, 3, 7, 10, 15, 20];
const LANES = ["BA", "BA+15", "MA", "MA+30"];
const DISTRICTS = Object.keys(SAMPLE_DISTRICT_RATIOS);

const SAMPLE_SOURCE = "#";
const SCENARIO_A_PCT = 3;
const SCENARIO_B_FLAT = 2000;
const SAMPLE_INFLATION_FACTOR = 1.034;
const DURATION_MS = 400;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function PayExplorerPreview() {
  const [step, setStep] = useState(7);
  const [lane, setLane] = useState("BA+15");
  const [district, setDistrict] = useState("Sylvania");

  const salary = SAMPLE_SALARIES[lane][step];

  // The displayed figure animates toward the real one. Everything derived
  // from the salary uses the real value, so only this number is in motion.
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

  const comparison = salary * SAMPLE_DISTRICT_RATIOS[district];

  return (
    <div className="explorer" aria-label="Toledo Teacher Pay Explorer preview">
      <div className="ex-head">
        <strong>Toledo Teacher Pay Explorer</strong>
        <span>Sample data, 2026-27</span>
      </div>

      <div className="fields">
        <div className="field">
          <label htmlFor="ex-step">Step</label>
          <select
            id="ex-step"
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          >
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ex-lane">Lane</label>
          <select id="ex-lane" value={lane} onChange={(e) => setLane(e.target.value)}>
            {LANES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ex-district">Compare to</label>
          <select
            id="ex-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {DISTRICTS.map((d) => (
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
          <Sourced href={SAMPLE_SOURCE} large>
            <span aria-live="polite">{usd(shown)}</span>
          </Sourced>
        </div>

        <div className="rows">
          <div className="row">
            <span>Same step and lane in {district}</span>
            <b>{usd(comparison)}</b>
          </div>
          <div className="row">
            <span>Scenario A: {SCENARIO_A_PCT}% across the board</span>
            <b className="up">{usdDelta(salary * (SCENARIO_A_PCT / 100))}</b>
          </div>
          <div className="row">
            <span>Scenario B: {usd(SCENARIO_B_FLAT)} flat</span>
            <b className="up">{usdDelta(SCENARIO_B_FLAT)}</b>
          </div>
          <div className="row">
            <span>Your 2010 step, in today&rsquo;s dollars</span>
            <b>{usd(salary * SAMPLE_INFLATION_FACTOR)}</b>
          </div>
        </div>
      </div>

      <div className="ex-foot">
        <span className="dot" aria-hidden="true" />
        Gold underline means it links to the source document.
      </div>
    </div>
  );
}
