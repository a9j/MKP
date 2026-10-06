import { NextResponse } from "next/server";
import { automationEnabled, cronRequestAuthorised } from "@/lib/automation";
import { recordJob, JOB_NAMES } from "@/lib/jobs";
import { createServiceClient } from "@/lib/supabase/service";
import { getReviewQueue, groupForDigest } from "@/lib/queries/review-queue";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily note saying what is waiting on a person.
 *
 * It sends nothing on a day with nothing waiting. A message that arrives every
 * morning whether or not it matters is a message people stop opening, and the
 * whole value of this one is that its arrival means something.
 *
 * It reads the same queue the dashboard shows, so the two can never disagree
 * about what "waiting" means.
 */
export async function GET(request: Request) {
  const startedAt = new Date();

  if (!cronRequestAuthorised(request)) {
    // No job row: an unauthenticated caller is not a run of this job, and
    // letting one write to the log would be a way to fill it with noise.
    return NextResponse.json({ error: "not authorised" }, { status: 401 });
  }

  if (!automationEnabled()) {
    await recordJob(JOB_NAMES.digest, "skipped", { reason: "AUTOMATION_ENABLED is not true" }, startedAt);
    return NextResponse.json({ status: "skipped", reason: "automation is off" });
  }

  const service = createServiceClient();

  const { data: setting } = await service
    .from("site_settings")
    .select("value")
    .eq("key", "digest_enabled")
    .maybeSingle();
  if ((setting?.value ?? "true").trim().toLowerCase() === "false") {
    await recordJob(JOB_NAMES.digest, "skipped", { reason: "digest_enabled is false" }, startedAt);
    return NextResponse.json({ status: "skipped", reason: "the digest is switched off" });
  }

  try {
    const items = await getReviewQueue(service);

    if (items.length === 0) {
      await recordJob(JOB_NAMES.digest, "skipped", { reason: "nothing waiting", items: 0 }, startedAt);
      return NextResponse.json({ status: "skipped", reason: "nothing waiting", items: 0 });
    }

    const { data: admins } = await service.from("admins").select("email, digest_email");
    const recipients = (admins ?? [])
      .map((admin) => (admin.digest_email ?? admin.email).trim())
      .filter((address) => address.includes("@"));

    if (recipients.length === 0) {
      await recordJob(
        JOB_NAMES.digest,
        "error",
        { reason: "no administrator has a usable address", items: items.length },
        startedAt,
      );
      return NextResponse.json({ status: "error", reason: "nobody to send to" }, { status: 500 });
    }

    const groups = groupForDigest(items).map((group) => ({
      heading: group.label,
      items: group.items.map((item) => ({
        label: item.title,
        detail: item.aiDraft ? `${item.detail}. AI draft, unreviewed` : item.detail,
        // Absolute, because a link in an email has no page to be relative to.
        url: `${env.siteUrl}${item.href}`,
      })),
    }));

    const subject = `[${items.length}] item${items.length === 1 ? "" : "s"} waiting on you`;
    const { html, text } = renderEmail({
      title: subject,
      body: [
        items.length === 1
          ? "One thing is waiting for you to read it."
          : `${items.length} things are waiting for you to read them.`,
      ],
      groups,
      footer: "Nothing publishes until you approve it.",
    });

    const sent = await sendEmail({ to: recipients, subject, text, html });

    await recordJob(
      JOB_NAMES.digest,
      sent.ok ? "ok" : "error",
      {
        items: items.length,
        recipients: recipients.length,
        local: sent.local,
        message: sent.message,
      },
      startedAt,
    );

    return NextResponse.json({
      status: sent.ok ? "ok" : "error",
      items: items.length,
      recipients: recipients.length,
      message: sent.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJob(JOB_NAMES.digest, "error", { message }, startedAt);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
