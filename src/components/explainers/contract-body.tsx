import { Sourced } from "@/components/sourced";
import { explainerDate } from "@/components/explainers/explainer-page";
import { CONTRACT_EVENT_LABEL, type Explainer } from "@/lib/explainer-types";

/** The status line for the top of the page: "Talks ongoing. Last update Oct 2, 2026." */
export function contractStatusLine(explainer: Explainer): string | null {
  const latest = explainer.contractEvents[0];
  const parts = [
    explainer.currentStatus,
    latest ? `Last update ${explainerDate(latest.eventDate)}` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(". ")}.` : null;
}

/** Newest first. Each event carries its own source link. */
export function ContractBody({ explainer }: { explainer: Explainer }) {
  return (
    <>
      <h2>What has happened so far</h2>
      <ol className="explainer-timeline">
        {explainer.contractEvents.map((event) => {
          const source = event.sourceId
            ? explainer.sources.find((s) => s.id === event.sourceId)
            : undefined;
          return (
            <li key={event.id}>
              <p className="explainer-timeline-meta">
                <time dateTime={event.eventDate}>{explainerDate(event.eventDate)}</time>
                <span>{CONTRACT_EVENT_LABEL[event.eventType]}</span>
              </p>
              <h3>{event.headline}</h3>
              {event.description ? <p>{event.description}</p> : null}
              {source ? (
                <p className="explainer-timeline-source">
                  Source: <Sourced href={source.url}>{source.label}</Sourced>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
