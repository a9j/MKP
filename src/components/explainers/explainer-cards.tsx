import Link from "next/link";
import { TEMPLATE_LABEL, explainerDate, explainerPath, type ExplainerCard } from "@/lib/explainer-types";

const TONE = { ballot: "teal", levy: "gold", contract: "navy" } as const;

/** The same card the Reports page uses, one per explainer. */
export function ExplainerCards({ explainers }: { explainers: ExplainerCard[] }) {
  return (
    <div className="civic-cards">
      {explainers.map((explainer) => (
        <article className={`civic-card tone-${TONE[explainer.template]}`} key={explainer.id}>
          <div className="tag">{TEMPLATE_LABEL[explainer.template]}</div>
          <h3>
            <Link className="explainer-card-link" href={explainerPath(explainer.template, explainer.slug)}>
              {explainer.title}
            </Link>
          </h3>
          {explainer.summary ? <p>{explainer.summary}</p> : null}
          <div className="civic-card-foot">
            <p className="explainer-card-date">
              {explainer.updatedAt ? `Updated ${explainerDate(explainer.updatedAt)}` : null}
            </p>
            <Link
              className="more"
              href={explainerPath(explainer.template, explainer.slug)}
              aria-hidden="true"
              tabIndex={-1}
            >
              Read the explainer &rarr;
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
