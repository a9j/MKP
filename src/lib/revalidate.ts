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
} as const;

export type SaveKind = keyof typeof ROUTES;

/** Refreshes every public route affected by a save. */
export function revalidateFor(kind: SaveKind, extraPaths: string[] = []) {
  for (const path of [...ROUTES[kind], ...extraPaths]) {
    revalidatePath(path);
  }
}
