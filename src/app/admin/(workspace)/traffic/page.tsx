import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { NotSignedIn } from "@/components/admin/not-signed-in";
import {
  RANGES,
  formatDuration,
  rangeFor,
  summarize,
  type PageViewRow,
  type Ranked,
} from "@/lib/traffic";

export const dynamic = "force-dynamic";

const COLUMNS =
  "id, visit_id, visitor_hash, path, referrer_host, utm_source, utm_campaign, device, city, region, country, started_at, last_seen_at, engaged_seconds";
const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Detroit",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));

const percent = (share: number) => `${Math.round(share * 100)}%`;

function RankedTable({ title, rows, empty }: { title: string; rows: Ranked[]; empty: string }) {
  return (
    <section className="uploader">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="admin-help">{empty}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{title.replace(/^Top /, "")}</th>
              <th scope="col">Visits</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.count}</td>
                <td>{percent(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function AdminTrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Traffic" />;

  const range = rangeFor((await searchParams).range);
  const since = new Date(Date.now() - range.hours * 3600 * 1000).toISOString();

  const supabase = await createServerSupabase();
  const rows: PageViewRow[] = [];
  let failed: string | null = null;
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("page_views")
      .select(COLUMNS)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      failed = error.message;
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const s = summarize(rows);

  return (
    <>
      <h1>Traffic</h1>
      <p className="admin-help">
        Who came to the public site, where they came from, and how long they stayed. Time
        only counts while the page is on screen. No cookies and no IP addresses are kept, so a
        reader is counted once a day and never followed from one day to the next.
      </p>

      <nav className="traffic-ranges" aria-label="Time range">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/traffic?range=${r.key}`}
            aria-current={r.key === range.key ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {failed ? (
        <p className="admin-help">
          Could not load traffic: {failed}. If this says the table does not exist, the
          <code> 0011_page_views.sql</code> migration has not been applied yet.
        </p>
      ) : null}

      <dl className="diff">
        <div>
          <dt>On the site now</dt>
          <dd>{s.onlineNow}</dd>
        </div>
        <div>
          <dt>Visitors</dt>
          <dd>{s.visitors}</dd>
        </div>
        <div>
          <dt>Visits</dt>
          <dd>{s.visits}</dd>
        </div>
        <div>
          <dt>Page views</dt>
          <dd>{s.pageViews}</dd>
        </div>
        <div>
          <dt>Average visit</dt>
          <dd>{formatDuration(s.avgVisitSeconds)}</dd>
        </div>
        <div>
          <dt>Average time on a page</dt>
          <dd>{formatDuration(s.avgPageSeconds)}</dd>
        </div>
        <div>
          <dt>Pages per visit</dt>
          <dd>{s.pagesPerVisit.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Left within 10 seconds</dt>
          <dd>{percent(s.quickExitShare)}</dd>
        </div>
      </dl>

      {s.visits === 0 && !failed ? (
        <p className="admin-help">
          No visits in this window yet. Visits start recording once this version is deployed.
        </p>
      ) : null}

      <section className="uploader">
        <h3>Recent visits</h3>
        {s.recentVisits.length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Arrived</th>
                  <th scope="col">Landed on</th>
                  <th scope="col">Pages</th>
                  <th scope="col">Stayed</th>
                  <th scope="col">Came from</th>
                  <th scope="col">Where</th>
                  <th scope="col">Device</th>
                </tr>
              </thead>
              <tbody>
                {s.recentVisits.map((v) => (
                  <tr key={v.visitId}>
                    <th scope="row">{time.format(new Date(v.startedAt))}</th>
                    <td>
                      <span title={v.pages.join("  >  ")}>{v.landingPage}</span>
                    </td>
                    <td>{v.pages.length}</td>
                    <td>{formatDuration(v.seconds)}</td>
                    <td>{v.source}</td>
                    <td>{v.place}</td>
                    <td>{v.device}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="uploader">
        <h3>Top pages</h3>
        {s.pages.length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Page</th>
                  <th scope="col">Views</th>
                  <th scope="col">Visitors</th>
                  <th scope="col">Average time</th>
                </tr>
              </thead>
              <tbody>
                {s.pages.map((p) => (
                  <tr key={p.path}>
                    <th scope="row">
                      <a href={p.path} target="_blank" rel="noreferrer">
                        {p.path}
                      </a>
                    </th>
                    <td>{p.views}</td>
                    <td>{p.visitors}</td>
                    <td>{formatDuration(p.avgSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RankedTable
        title="Top sources"
        rows={s.sources}
        empty="Nothing yet. Google, Facebook and other sites show up here when they send readers."
      />
      <RankedTable title="Top places" rows={s.places} empty="Nothing yet." />
      <RankedTable title="Devices" rows={s.devices} empty="Nothing yet." />
      {s.campaigns.length > 0 ? (
        <RankedTable title="Campaigns" rows={s.campaigns} empty="" />
      ) : null}

      <section className="uploader">
        <h3>By day</h3>
        {s.days.length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Visitors</th>
                <th scope="col">Visits</th>
                <th scope="col">Page views</th>
              </tr>
            </thead>
            <tbody>
              {s.days.map((d) => (
                <tr key={d.day}>
                  <th scope="row">{dayLabel(d.day)}</th>
                  <td>{d.visitors}</td>
                  <td>{d.visits}</td>
                  <td>{d.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="admin-help">
        Tip: add <code>?utm_source=facebook&amp;utm_campaign=levy-explainer</code> to a link
        you share, and that campaign gets its own row above.
      </p>
    </>
  );
}
