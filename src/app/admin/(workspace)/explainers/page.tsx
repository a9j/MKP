import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { NotSignedIn } from "@/components/admin/not-signed-in";
import { ExplainerNewForm } from "@/components/admin/explainer-new-form";
import { ExplainerDeleteButton } from "@/components/admin/explainer-delete-button";
import { listAdminExplainers } from "@/lib/queries/admin-explainers";
import { TEMPLATE_LABEL, explainerDate, explainerPath } from "@/lib/explainer-types";

export const dynamic = "force-dynamic";

export default async function AdminExplainersPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Explainers" />;

  const explainers = await listAdminExplainers();

  return (
    <>
      <h1>Explainers</h1>
      <p className="admin-help">
        Ballot, levy and contract pages. A draft stays off the public site. Publishing
        checks the page against the MKP Standard and puts it live straight away.
      </p>

      <section className="uploader">
        <h3>New explainer</h3>
        <ExplainerNewForm />
      </section>

      <section className="uploader">
        <h3>All explainers</h3>
        {explainers.length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table explainer-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {explainers.map((e) => {
                  const unpublishedChanges =
                    e.status === "published" &&
                    e.lastPublishedAt !== null &&
                    new Date(e.updatedAt).getTime() - new Date(e.lastPublishedAt).getTime() > 2000;
                  return (
                    <tr key={e.id}>
                      <th scope="row">
                        <Link href={`/admin/explainers/${e.id}`}>{e.title}</Link>
                      </th>
                      <td>{TEMPLATE_LABEL[e.template]}</td>
                      <td>
                        <span className="explainer-badges">
                          {e.status === "published" ? (
                            <span className="badge-draft">Published, v{e.version}</span>
                          ) : (
                            <span className="badge-draft">Draft</span>
                          )}
                          {e.isSample ? <span className="badge-draft">Sample</span> : null}
                          {e.aiDraft ? <span className="badge-ai">AI draft, unreviewed</span> : null}
                          {unpublishedChanges ? <span className="badge-ai">Unpublished changes</span> : null}
                        </span>
                      </td>
                      <td>{explainerDate(e.updatedAt)}</td>
                      <td>
                        <span className="explainer-actions">
                          <Link href={`/admin/explainers/${e.id}`}>Edit</Link>
                          <a href={`/explainers/preview/${e.id}`} target="_blank" rel="noopener noreferrer">
                            Preview
                          </a>
                          {e.status === "published" ? (
                            <a href={explainerPath(e.template, e.slug)} target="_blank" rel="noopener noreferrer">
                              View live
                            </a>
                          ) : null}
                          {e.version === 0 ? <ExplainerDeleteButton id={e.id} title={e.title} /> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
