import { Sourced } from "@/components/sourced";
import type { Vacancy } from "@/lib/queries/explorer";

type Props = {
  asOf: string | null;
  vacancies: Vacancy[];
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function VacanciesTable({ asOf, vacancies }: Props) {
  if (!asOf || vacancies.length === 0) {
    return <p className="sub">No vacancy data has been published yet.</p>;
  }

  const open = vacancies.filter((v) => v.open).length;

  return (
    <div>
      <table className="data-table">
        <caption>
          {open} of {vacancies.length} postings were still open as of {formatDate(asOf)}. Days open
          is counted to that date, not to today.
        </caption>
        <thead>
          <tr>
            <th scope="col">Position</th>
            <th scope="col">Building</th>
            <th scope="col">Posted</th>
            <th scope="col">Days open</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {vacancies.map((v) => (
            <tr key={`${v.position}-${v.building ?? ""}-${v.postedDate ?? ""}`}>
              <th scope="row">
                <Sourced href={v.sourceUrl}>{v.position}</Sourced>
              </th>
              <td>{v.building ?? "Not stated"}</td>
              <td>{v.postedDate ? formatDate(v.postedDate) : "Not stated"}</td>
              <td className="num">{v.daysOpen ?? "Not stated"}</td>
              <td>{v.open ? "Open" : `Filled ${v.filledDate ? formatDate(v.filledDate) : ""}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
