import { usd } from "@/lib/format";
import { usdCents } from "@/lib/levy-math";
import { SourcedFigure } from "@/components/explainers/explainer-page";
import { LevyCalculator } from "@/components/explainers/levy-calculator";
import { LEVY_KIND_LABEL, type Explainer } from "@/lib/explainer-types";

/** Mills as printed on a ballot: "2.5 mills", "1 mill". */
function millsLabel(mills: number): string {
  const n = Number(mills.toFixed(3));
  return `${n} ${n === 1 ? "mill" : "mills"}`;
}

export function LevyBody({ explainer }: { explainer: Explainer }) {
  const levy = explainer.levy;
  if (!levy) return null;

  return (
    <>
      <h2>The levy at a glance</h2>
      <dl className="explainer-facts">
        {levy.mills !== null ? (
          <div>
            <dt>Rate</dt>
            <dd>
              <SourcedFigure explainer={explainer} sourceId={levy.millsSourceId}>
                {millsLabel(levy.mills)}
              </SourcedFigure>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Length</dt>
          <dd>{levy.years ? `${levy.years} ${levy.years === 1 ? "year" : "years"}` : "Continuing, no end date"}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{LEVY_KIND_LABEL[levy.levyKind]}</dd>
        </div>
        {levy.estimatedAnnualRevenue !== null ? (
          <div>
            <dt>Estimated to raise each year</dt>
            <dd>
              <SourcedFigure explainer={explainer} sourceId={levy.revenueSourceId}>
                {usd(levy.estimatedAnnualRevenue)}
              </SourcedFigure>
            </dd>
          </div>
        ) : null}
        {levy.costPer100k !== null ? (
          <div>
            <dt>Cost per $100,000 of home value</dt>
            <dd>
              <SourcedFigure explainer={explainer} sourceId={levy.costSourceId}>
                {Number.isInteger(levy.costPer100k) ? usd(levy.costPer100k) : usdCents(levy.costPer100k)} a year
              </SourcedFigure>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="explainer-prose">
        <h3>Who is asking</h3>
        <p>{levy.districtOrBody}</p>
        {levy.purpose ? (
          <>
            <h3>What it pays for</h3>
            <p>{levy.purpose}</p>
          </>
        ) : null}
      </div>

      <LevyCalculator mills={levy.mills} costPer100k={levy.costPer100k} levyKind={levy.levyKind} />
    </>
  );
}
