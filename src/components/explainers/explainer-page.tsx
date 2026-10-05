import type { ReactNode } from "react";
import Link from "next/link";
import { Sourced } from "@/components/sourced";
import { EXPLAINER_NEUTRALITY, TEMPLATE_LABEL, explainerDate, type Explainer } from "@/lib/explainer-types";

export { explainerDate };

/** The figure, underlined in gold and linked to its source, when it has one. */
export function SourcedFigure({
  explainer,
  sourceId,
  children,
}: {
  explainer: Explainer;
  sourceId: string | null;
  children: ReactNode;
}) {
  const source = sourceId ? explainer.sources.find((s) => s.id === sourceId) : undefined;
  return source ? <Sourced href={source.url}>{children}</Sourced> : <>{children}</>;
}

/**
 * Everything a ballot, levy and contract page share: the page hero, the
 * optional photo and PDF, the sources, the last updated line and the
 * neutrality line. The template's own content goes in the middle.
 *
 * The preview in the admin renders this same component, so what is checked
 * there is what a reader gets.
 */
export function ExplainerPage({
  explainer,
  dateLine,
  children,
}: {
  explainer: Explainer;
  /** One line under the summary, for example the election date or the status. */
  dateLine?: ReactNode;
  children: ReactNode;
}) {
  const updated = explainer.updatedAt ? explainerDate(explainer.updatedAt) : null;

  return (
    <article className="explainer">
      <header className="civic-page-hero">
        {/* Nested rather than combined: civic-page-hero-inner and
            civic-section set their padding with a shorthand that would wipe
            out the side gutter .wrap gives on a phone. */}
        <div className="wrap">
          <div className="civic-page-hero-inner">
            <p className="civic-kicker">{TEMPLATE_LABEL[explainer.template]}</p>
            <h1>{explainer.title}</h1>
            <p className="lede">{explainer.summary}</p>
            <p className="explainer-dateline">
              {dateLine ? <span>{dateLine}</span> : null}
              <span>{updated ? `Last updated ${updated}` : "Not published yet"}</span>
            </p>
          </div>
        </div>
      </header>

      {explainer.heroImageUrl ? (
        <figure className="explainer-photo">
          {/* A file an admin uploaded to Supabase Storage. next/image would
              need the storage host allowed in next.config, for one image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={explainer.heroImageUrl} alt={explainer.heroImageAlt ?? ""} />
        </figure>
      ) : null}

      <div className="wrap">
        <div className="civic-section explainer-body">{children}</div>
      </div>

      <section className="civic-band civic-band-paper" aria-labelledby="explainer-sources">
        <div className="wrap">
          <h2 id="explainer-sources">Sources</h2>
          <p className="sub">
            Every figure on this page links to one of these public documents.
          </p>
          <ol className="sources-list explainer-sources">
            {explainer.sources.map((source) => (
              <li key={source.id} id={`source-${source.id}`}>
                <Sourced href={source.url}>{source.label}</Sourced>
                {source.documentDate ? (
                  <span className="explainer-source-date">
                    {" "}
                    Document dated {explainerDate(source.documentDate)}.
                  </span>
                ) : null}
                {source.note ? <span className="explainer-source-note"> {source.note}</span> : null}
              </li>
            ))}
          </ol>

          {explainer.pdfUrl ? (
            <p className="explainer-download">
              <a className="btn btn-outline-navy btn-large" href={explainer.pdfUrl} download>
                Download PDF
              </a>
            </p>
          ) : null}

          <p className="explainer-updated">
            {updated ? (
              <>
                Last updated {updated}.
                {explainer.version > 1 && explainer.changeNote ? ` ${explainer.changeNote}` : null}
              </>
            ) : (
              "This is a preview. It has not been published."
            )}
          </p>

          <p className="civic-note">
            {EXPLAINER_NEUTRALITY} Found a mistake?{" "}
            <Link href="/contact">Tell us</Link> and we will correct it in public.
          </p>
        </div>
      </section>
    </article>
  );
}
