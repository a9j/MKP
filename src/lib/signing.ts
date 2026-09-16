import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Signed, expiring links for subscriber confirmation.
 *
 * Nothing is stored for the token: the address and expiry travel in the link
 * and the signature proves this site issued it. That means a confirmation link
 * cannot be guessed, and an old one stops working on its own.
 *
 * The key is the service role key unless SUBSCRIBE_TOKEN_SECRET is set. It is
 * server side only and already required, so there is one fewer secret to lose.
 */
function secret(): string {
  return process.env.SUBSCRIBE_TOKEN_SECRET ?? env.supabaseServiceRoleKey;
}

const DAYS = 7;

export function signSubscribeToken(email: string): string {
  const expires = Date.now() + DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(`${email.toLowerCase()}:${expires}`).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export type TokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: "malformed" | "tampered" | "expired" };

export function readSubscribeToken(token: string): TokenResult {
  const [payload, signature] = String(token ?? "").split(".");
  if (!payload || !signature) return { ok: false, reason: "malformed" };

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Constant time, so a near miss cannot be narrowed down by timing it.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "tampered" };

  const decoded = Buffer.from(payload, "base64url").toString();
  const separator = decoded.lastIndexOf(":");
  if (separator < 0) return { ok: false, reason: "malformed" };

  const email = decoded.slice(0, separator);
  const expires = Number(decoded.slice(separator + 1));
  if (!Number.isFinite(expires)) return { ok: false, reason: "malformed" };
  if (Date.now() > expires) return { ok: false, reason: "expired" };

  return { ok: true, email };
}

export const SUBSCRIBE_TOKEN_DAYS = DAYS;
