import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Public routes affected by each kind of admin save.
 *
 * Public pages are statically rendered with a long revalidate window, so a save
 * only shows up if the routes it touches are revalidated explicitly. Anything
 * that appears in the Latest feed also refreshes the home page.
 */
const ROUTES = {
  vote: ["/", "/votes", "/votes/members"],
  record: ["/", "/records"],
  report: ["/", "/reports"],
  listening: ["/", "/listening"],
  person: ["/about", "/votes/members"],
  correction: ["/corrections"],
  settings: ["/", "/explorer", "/records", "/get-involved", "/about", "/contact"],
  explorerData: ["/", "/explorer"],
  cityBudget: ["/", "/budget"],
  explainer: ["/", "/explainers"],
} as const;

export type SaveKind = keyof typeof ROUTES;

/**
 * A setting can appear anywhere, because the public layout puts the EIN and the
 * mailing address in the footer of every page. Listing routes one by one was
 * always going to miss some: the EIN went in and showed up on six pages while
 * /corrections, /reports, /votes, /budget, /listening and /explainers kept the
 * placeholder. Revalidating the root layout covers every page under it, which
 * is the only honest answer for something the whole site renders.
 */
const LAYOUT_WIDE: ReadonlySet<SaveKind> = new Set(["settings"]);

/** Refreshes every public route affected by a save. */
export function revalidateFor(kind: SaveKind, extraPaths: string[] = []) {
  if (LAYOUT_WIDE.has(kind)) {
    revalidatePath("/", "layout");
  }
  for (const path of [...ROUTES[kind], ...extraPaths]) {
    revalidatePath(path);
  }
}
