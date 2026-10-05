import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { NotSignedIn } from "@/components/admin/not-signed-in";
import { ExplainerEditor } from "@/components/admin/explainer-editor";
import { ContractQuickUpdate } from "@/components/admin/contract-quick-update";
import { getAdminExplainer } from "@/lib/queries/admin-explainers";
import { TEMPLATE_LABEL, explainerDate, explainerPath, type Template } from "@/lib/explainer-types";

export const dynamic = "force-dynamic";

export default async function EditExplainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Edit explainer" />;

  const data = await getAdminExplainer(id);
  if (!data) notFound();

  const e = data.explainer;
  const template = e.template as Template;
  const unpublishedChanges =
    e.status === "published" &&
    e.last_published_at !== null &&
    new Date(e.updated_at).getTime() - new Date(e.last_published_at).getTime() > 2000;

  return (
    <>
      <p className="admin-help">
        <Link href="/admin/explainers">All explainers</Link>
      </p>
      <h1>{e.title}</h1>

      <div className="explainer-status">
        <span className="explainer-badges">
          <span className="badge-draft">{TEMPLATE_LABEL[template]}</span>
          {e.status === "published" ? (
            <span className="badge-draft">
              Published, version {e.version}
              {e.last_published_at ? `, ${explainerDate(e.last_published_at)}` : ""}
            </span>
          ) : (
            <span className="badge-draft">Draft, not public</span>
          )}
          {e.is_sample ? <span className="badge-draft">Sample</span> : null}
          {e.ai_draft ? <span className="badge-ai">AI draft, unreviewed</span> : null}
          {unpublishedChanges ? <span className="badge-ai">Saved changes not yet published</span> : null}
        </span>
        <span className="explainer-actions">
          <a href={`/explainers/preview/${e.id}`} target="_blank" rel="noopener noreferrer">
            Preview the page
          </a>
          {e.status === "published" ? (
            <a href={explainerPath(template, e.slug)} target="_blank" rel="noopener noreferrer">
              View live
            </a>
          ) : null}
        </span>
      </div>

      <section className="review-gate explainer-checklist" aria-live="polite">
        {data.problems.length === 0 ? (
          <>
            <h4>Ready to publish</h4>
            <p className="admin-help">
              Everything the MKP Standard checks is in place.
              {e.reading_grade !== null ? ` Reading grade ${e.reading_grade}.` : ""}
            </p>
          </>
        ) : (
          <>
            <h4>Before this can be published</h4>
            <ul>
              {data.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            {e.reading_grade !== null ? (
              <p className="admin-help">Reading grade as of the last save: {e.reading_grade}.</p>
            ) : null}
          </>
        )}
      </section>

      {template === "contract" ? (
        <ContractQuickUpdate
          explainerId={e.id}
          sources={data.sources.map((s) => ({ id: s.id, label: s.label }))}
          canPublish={!e.is_sample}
        />
      ) : null}

      <section className="uploader">
        <h3>Edit</h3>
        <ExplainerEditor data={data} problems={data.problems} />
      </section>
    </>
  );
}
