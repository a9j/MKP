"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, renderEmail } from "@/lib/email";
import { signSubscribeToken, SUBSCRIBE_TOKEN_DAYS } from "@/lib/signing";
import { env } from "@/lib/env";

export type FormResult = { ok: boolean; message: string; fieldErrors: Record<string, string> };

export type InquiryKind = "contact" | "council" | "volunteer" | "briefing";

const CONTACT_ADDRESS = "hello@monakproject.org";
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KIND_LABEL: Record<InquiryKind, string> = {
  contact: "Contact form",
  council: "Advisory council application",
  volunteer: "Volunteer offer",
  briefing: "Briefing request",
};

/**
 * Stores an inquiry and tells the office about it.
 *
 * The row is written first. If the mail fails the message is still recorded,
 * because losing what somebody took the trouble to write is worse than a
 * missed notification, and the admin can read the table.
 */
export async function submitInquiry(form: FormData): Promise<FormResult> {
  const kind = String(form.get("kind") ?? "contact") as InquiryKind;
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const audience = String(form.get("audience") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (name.length === 0) fieldErrors.name = "Give us a name to reply to.";
  if (!EMAIL_SHAPE.test(email)) fieldErrors.email = "Check the email address.";
  if (message.length === 0) fieldErrors.message = "Tell us what you would like to say.";
  if (message.length > 5000) fieldErrors.message = "That is longer than we can take. 5000 characters.";
  if (!(kind in KIND_LABEL)) fieldErrors.kind = "Unknown form.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was sent. Check the fields marked below.", fieldErrors };
  }

  // Anonymous insert is allowed by policy, and the row can never be read back
  // with the same key, so a submission cannot be used to read other people's.
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("inquiries")
    .insert({ kind, name, email, audience: audience || null, message });

  if (error) {
    return { ok: false, message: `Nothing was sent: ${error.message}`, fieldErrors: {} };
  }

  const { html, text } = renderEmail({
    title: KIND_LABEL[kind],
    body: [
      `From ${name}, ${email}${audience ? `, who is a ${audience.toLowerCase()}` : ""}.`,
      message,
    ],
  });
  await sendEmail({ to: [CONTACT_ADDRESS], subject: `${KIND_LABEL[kind]}: ${name}`, text, html });

  return {
    ok: true,
    message: "Thank you. We read everything that comes in and will reply.",
    fieldErrors: {},
  };
}

/**
 * Starts a subscription. Nothing is sent to an address that has not confirmed.
 *
 * The reply is the same whether or not the address is already on the list, so
 * the form cannot be used to find out who has subscribed.
 */
export async function subscribe(form: FormData): Promise<FormResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_SHAPE.test(email)) {
    return {
      ok: false,
      message: "Check the email address.",
      fieldErrors: { email: "That does not look like an email address." },
    };
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("subscribers")
    .select("id, confirmed")
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    const { error } = await service.from("subscribers").insert({ email, confirmed: false });
    if (error) {
      return { ok: false, message: `Something went wrong: ${error.message}`, fieldErrors: {} };
    }
  }

  // An address that already confirmed is not sent another link, but is told
  // the same thing, so the form gives nothing away.
  if (!existing?.confirmed) {
    const url = `${env.siteUrl}/subscribe/confirm?token=${encodeURIComponent(signSubscribeToken(email))}`;
    const { html, text } = renderEmail({
      title: "Confirm your email",
      body: [
        "You asked to hear when The Mona K Project publishes something. One click and that is set up.",
        `If this was not you, ignore this message and nothing happens. The link stops working after ${SUBSCRIBE_TOKEN_DAYS} days.`,
        "One email when we publish. That is the only time you will hear from us.",
      ],
      action: { label: "Confirm my email", url },
    });
    await sendEmail({ to: [email], subject: "Confirm your email", text, html });
  }

  return {
    ok: true,
    message: "Check your email for a link to confirm. Until you click it we will not write to you.",
    fieldErrors: {},
  };
}
