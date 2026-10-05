import Link from "next/link";
import { SourcedFigure } from "@/components/explainers/explainer-page";
import { explainerPath, type Explainer } from "@/lib/explainer-types";

/**
 * One card per issue, in ballot order. Yes and no are given equal weight and
 * equal space: same heading level, same type, side by side on a wide screen.
 */
export function BallotBody({
  explainer,
  publishedLevySlugs,
}: {
  explainer: Explainer;
  /** A card links to its levy page only when that page is live. */
  publishedLevySlugs: Set<string>;
}) {
  const issues = explainer.ballotIssues;

  return (
    <>
      <h2>
        {issues.length === 1 ? "One issue" : `${issues.length} issues`} on this ballot
      </h2>
      <ol className="explainer-issues">
        {issues.map((issue) => (
          <li className="civic-card explainer-issue" key={issue.id}>
            <p className="tag">
              {[issue.issueNumber, issue.jurisdiction].filter(Boolean).join(", ") || "Ballot issue"}
            </p>
            <h3>{issue.title}</h3>

            <dl className="explainer-yes-no">
              <div>
                <dt>What a yes vote does</dt>
                <dd>{issue.whatYesMeans}</dd>
              </div>
              <div>
                <dt>What a no vote does</dt>
                <dd>{issue.whatNoMeans}</dd>
              </div>
            </dl>

            {issue.costNote ? (
              <p className="explainer-cost">
                <strong>Cost: </strong>
                <SourcedFigure explainer={explainer} sourceId={issue.costSourceId}>
                  {issue.costNote}
                </SourcedFigure>
              </p>
            ) : null}

            {issue.linkedLevySlug && publishedLevySlugs.has(issue.linkedLevySlug) ? (
              <div className="civic-card-foot">
                <Link className="more" href={explainerPath("levy", issue.linkedLevySlug)}>
                  Read the full levy explainer &rarr;
                </Link>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}
