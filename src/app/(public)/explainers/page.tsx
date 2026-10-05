import type { Metadata } from "next";
import { ExplainerList } from "@/components/explainers/explainer-list";
import { getPublishedExplainers } from "@/lib/queries/explainers";
import { EXPLAINER_NEUTRALITY } from "@/lib/explainer-types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explainers",
  description:
    "Plain-language explainers for Toledo ballot issues, levies, and teacher contract talks. Every figure links to its public source.",
};

export default async function ExplainersPage() {
  const explainers = await getPublishedExplainers();

  return (
    <>
      <header className="civic-page-hero">
        <div className="wrap">
          <div className="civic-page-hero-inner">
            <p className="civic-kicker">Explainers</p>
            <h1>What is on the ballot, and what is on the table.</h1>
            <p className="lede">
              Ballot issues, levies, and contract talks, explained from the public record.
              Every figure links to the document it came from.
            </p>
          </div>
        </div>
      </header>

      <div className="wrap">
        <section className="civic-section">
          <h2>All explainers</h2>
          <ExplainerList explainers={explainers} />
          <p className="civic-note">{EXPLAINER_NEUTRALITY}</p>
        </section>
      </div>
    </>
  );
}
