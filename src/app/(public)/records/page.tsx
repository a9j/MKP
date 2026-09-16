import type { Metadata } from "next";
import { getRecordsRequests, getAgencies, documentUrl } from "@/lib/queries/records";
import { getSiteSettings } from "@/lib/queries/settings";
import { ScrollableTable } from "@/components/public/scrollable-table";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Records Desk",
  description:
    "Every public records request The Mona K Project has filed, with responses and documents. Plus a plain guide to filing your own.",
};

/** The "File your own" steps, verbatim from the copy doc. */
const STEPS = [
  "Figure out which office holds the record. (TPS, the City of Toledo, and Lucas County each have their own.)",
  "Write one clear sentence describing what you want. Be specific about dates.",
  "Send it by email to the records officer. We list the addresses below.",
  "Public offices must respond in a reasonable time. If they deny, they must tell you why in writing.",
  "If you get stuck, write to us. We will help.",
];

export default async function RecordsPage() {
  const [requests, agencies, settings] = await Promise.all([
    getRecordsRequests(),
    getAgencies(),
    getSiteSettings(),
  ]);

  const templatePath = settings.request_template_path;

  return (
    <>
      <header className="wrap page-head">
        <h1>Everything we build starts with a public records request.</h1>
        <p className="lede">
          This is every request we have filed, when we filed it, what came back, and
          the document itself. If a request was denied, you will see why.
        </p>
      </header>

      <section className="wrap vote-section">
        {requests.length === 0 ? (
          <p className="sub">No requests have been filed yet.</p>
        ) : (
          <ScrollableTable label="Public records request log">
          <table className="data-table records-table">
            <caption>
              {requests.length} request{requests.length === 1 ? "" : "s"}. Response time
              counts business days, weekends excluded.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date filed</th>
                <th scope="col">Agency</th>
                <th scope="col">What we asked for</th>
                <th scope="col">Status</th>
                <th scope="col">Response time</th>
                <th scope="col">Documents</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.dateFiledLabel}</td>
                  <td>{request.agencyName}</td>
                  <th scope="row" className="request-text">
                    {request.requestText}
                    {request.denialReason ? (
                      <small>Reason given: {request.denialReason}</small>
                    ) : null}
                  </th>
                  <td>{request.statusLabel}</td>
                  <td>
                    {request.responseBusinessDays !== null
                      ? `${request.responseBusinessDays} business day${request.responseBusinessDays === 1 ? "" : "s"}`
                      : `No response yet, ${request.openBusinessDays ?? 0} business days open`}
                  </td>
                  <td>
                    {request.documents.length === 0 ? (
                      <span className="unavailable">None yet</span>
                    ) : (
                      request.documents.map((doc) => (
                        <a
                          key={doc.url}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-link"
                        >
                          {doc.fileName}
                        </a>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollableTable>
        )}
      </section>

      <section className="band">
        <div className="wrap">
          <h2>You can do this too.</h2>
          <p className="sub">
            Ohio&rsquo;s Public Records Act gives every person the right to request public
            records from any public office. You do not have to say who you are or why
            you want them. Here is how it works in Toledo.
          </p>

          <ol className="steps-list">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h3 className="officers-head">Records officer addresses</h3>
          <ul className="officers">
            {agencies.map((agency) => (
              <li key={agency.id}>
                <span>{agency.name}</span>
                {agency.records_officer_email ? (
                  <a href={`mailto:${agency.records_officer_email}`}>
                    {agency.records_officer_email}
                  </a>
                ) : (
                  <span className="unavailable">[Address not yet published]</span>
                )}
              </li>
            ))}
          </ul>

          <div className="actions">
            {templatePath ? (
              <a className="btn" href={documentUrl(templatePath)} download>
                Download our request template
              </a>
            ) : (
              <span className="unavailable">
                The request template has not been uploaded yet.
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
