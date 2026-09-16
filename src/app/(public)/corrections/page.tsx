import type { Metadata } from "next";
import Link from "next/link";
import { getCorrections } from "@/lib/queries/site";
import { ScrollableTable } from "@/components/public/scrollable-table";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Corrections",
  description:
    "Every correction The Mona K Project has made, with the date, the page, what changed and why.",
};

export default async function CorrectionsPage() {
  const corrections = await getCorrections();

  return (
    <>
      <header className="wrap page-head">
        <h1>Every correction we have made.</h1>
        <p className="lede">
          If we got a number wrong, we fix it and say so here. Nothing is quietly
          edited. If you think something is still wrong,{" "}
          <Link href="/contact">tell us</Link>.
        </p>
      </header>

      <section className="wrap vote-section">
        {corrections.length === 0 ? (
          <p className="sub">
            We have not had to correct anything yet. When we do, it will be listed here.
          </p>
        ) : (
          <ScrollableTable label="Corrections log">
            <table className="data-table">
              <caption>
                {corrections.length} correction{corrections.length === 1 ? "" : "s"}, newest
                first.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Page</th>
                  <th scope="col">What changed</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((correction) => (
                  <tr key={correction.id}>
                    <td>{correction.correctionDateLabel}</td>
                    <td>
                      <Link href={correction.pagePath}>{correction.pagePath}</Link>
                    </td>
                    <th scope="row">{correction.whatChanged}</th>
                    <td>{correction.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </section>
    </>
  );
}
