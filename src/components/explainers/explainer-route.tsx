import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExplainerView } from "@/components/explainers/explainer-view";
import {
  getPublishedExplainer,
  getPublishedExplainers,
  getPublishedLevySlugs,
} from "@/lib/queries/explainers";
import { explainerPath, type Template } from "@/lib/explainer-types";

type Params = { params: Promise<{ slug: string }> };

/**
 * /ballot/[slug], /levy/[slug] and /contract/[slug] differ only in which
 * template they read, so each route file is a few lines that name it.
 *
 * Pages are built for every published explainer and rebuilt on publish by
 * revalidatePath. One published after the last build renders on first
 * request, since dynamicParams is left on.
 */
export function explainerRoute(template: Template) {
  async function generateStaticParams() {
    return (await getPublishedExplainers())
      .filter((e) => e.template === template)
      .map((e) => ({ slug: e.slug }));
  }

  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { slug } = await params;
    const explainer = await getPublishedExplainer(template, slug);
    if (!explainer) return { title: "Explainer not found" };

    const description = (explainer.oneSentence ?? explainer.summary).slice(0, 160);
    return {
      title: explainer.title,
      description,
      alternates: { canonical: explainerPath(template, slug) },
      openGraph: { title: explainer.title, description, type: "article" },
    };
  }

  async function Page({ params }: Params) {
    const { slug } = await params;
    const [explainer, levySlugs] = await Promise.all([
      getPublishedExplainer(template, slug),
      template === "ballot" ? getPublishedLevySlugs() : Promise.resolve(new Set<string>()),
    ]);
    if (!explainer) notFound();

    return <ExplainerView explainer={explainer} publishedLevySlugs={levySlugs} />;
  }

  return { generateStaticParams, generateMetadata, Page };
}
