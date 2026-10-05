import { ExplainerPage, explainerDate } from "@/components/explainers/explainer-page";
import { BallotBody } from "@/components/explainers/ballot-body";
import { LevyBody } from "@/components/explainers/levy-body";
import { ContractBody, contractStatusLine } from "@/components/explainers/contract-body";
import type { Explainer } from "@/lib/explainer-types";

/**
 * A whole explainer page for any template. The public routes and the admin
 * preview both render this, so the two cannot drift apart.
 */
export function ExplainerView({
  explainer,
  publishedLevySlugs,
}: {
  explainer: Explainer;
  publishedLevySlugs: Set<string>;
}) {
  switch (explainer.template) {
    case "ballot":
      return (
        <ExplainerPage
          explainer={explainer}
          dateLine={explainer.decisionDate ? `Election day: ${explainerDate(explainer.decisionDate)}` : null}
        >
          <BallotBody explainer={explainer} publishedLevySlugs={publishedLevySlugs} />
        </ExplainerPage>
      );
    case "levy":
      return (
        <ExplainerPage
          explainer={explainer}
          dateLine={explainer.decisionDate ? `On the ballot ${explainerDate(explainer.decisionDate)}` : null}
        >
          <LevyBody explainer={explainer} />
        </ExplainerPage>
      );
    case "contract":
      return (
        <ExplainerPage explainer={explainer} dateLine={contractStatusLine(explainer)}>
          <ContractBody explainer={explainer} />
        </ExplainerPage>
      );
  }
}
