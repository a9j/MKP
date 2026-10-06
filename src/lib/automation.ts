/**
 * The switches that decide whether anything runs on a schedule, and which
 * bodies the collectors are allowed to touch.
 *
 * No "server-only" guard here, deliberately: nothing in this module returns a
 * secret, and the switches have to be readable by the tests that pin down what
 * "off" means. One rule governs all of it: software may collect and draft,
 * only a person may publish. These switches decide whether the collecting happens at all. They do
 * not, and cannot, let anything publish: that is refused by a trigger in the
 * database for every writer, the service role included.
 */

/** The bodies a collector may be switched on for, one at a time. */
export const AUTOMATION_BODY_SLUGS = {
  tps: "tps-board",
  council: "toledo-city-council",
  county: "lucas-county-commissioners",
} as const;

export type AutomationBody = keyof typeof AUTOMATION_BODY_SLUGS;

/**
 * The master switch, off unless it is explicitly on.
 *
 * It gates the scheduled routes and every model call together, deliberately:
 * the two are the same decision. Anything other than "true" is off, so a
 * variable left as "1" or "yes" by mistake does not quietly start fetching.
 */
export function automationEnabled(): boolean {
  return (process.env.AUTOMATION_ENABLED ?? "").trim().toLowerCase() === "true";
}

/**
 * Which bodies the watchers may run for, from AUTOMATION_BODIES.
 *
 * Defaults to the school board alone, so switching the master on does not also
 * start fetching a body nobody has checked the output for. An unrecognised name
 * is dropped rather than guessed at, since the cost of guessing is a collector
 * reading the wrong agenda.
 */
export function automationBodies(): AutomationBody[] {
  const raw = (process.env.AUTOMATION_BODIES ?? "tps").trim();
  const names = raw
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  const allowed = names.filter((name): name is AutomationBody => name in AUTOMATION_BODY_SLUGS);

  for (const name of names) {
    if (!(name in AUTOMATION_BODY_SLUGS)) {
      console.warn(
        `[automation] AUTOMATION_BODIES lists "${name}", which is not one of ` +
          `${Object.keys(AUTOMATION_BODY_SLUGS).join(", ")}. It is ignored.`,
      );
    }
  }

  return allowed;
}

export function automationEnabledFor(body: AutomationBody): boolean {
  return automationEnabled() && automationBodies().includes(body);
}

/**
 * Checks the shared secret on a scheduled route.
 *
 * Vercel sends it as a bearer token. A route with no secret configured is
 * refused rather than left open: an unauthenticated endpoint that writes to the
 * database is worse than one nobody can reach.
 */
export function cronRequestAuthorised(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length === 0) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.replace(/^Bearer\s+/i, "").trim();
  if (presented.length !== secret.length) return false;

  // Constant time over equal lengths, so a wrong secret cannot be found one
  // character at a time by timing the refusal.
  let difference = 0;
  for (let i = 0; i < secret.length; i += 1) {
    difference |= secret.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return difference === 0;
}
