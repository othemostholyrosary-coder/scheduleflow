import crypto from "node:crypto";
import { SUBY_ACTIVE_STATUSES } from "@calcom/lib/constants";

type AccessUser = { role?: string | null; trialEndsAt?: Date | null; metadata?: unknown };

export function getSubyMetadata(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = metadata as Record<string, unknown>;
  return Object.fromEntries(
    ["subySubscriptionStatus", "subySubscriptionId", "subyCustomerId"].flatMap((key) =>
      typeof value[key] === "string" ? [[key, value[key] as string]] : []
    )
  );
}

export function hasScheduleAccess(user: AccessUser, now = new Date()) {
  if (user.role === "ADMIN") return true;
  const status = getSubyMetadata(user.metadata).subySubscriptionStatus;
  return Boolean(
    (status && SUBY_ACTIVE_STATUSES.includes(status as (typeof SUBY_ACTIVE_STATUSES)[number])) ||
      (user.trialEndsAt && user.trialEndsAt > now)
  );
}

export function trialStatus(user: AccessUser, now = new Date()) {
  const metadata = getSubyMetadata(user.metadata);
  const subscribed = Boolean(
    metadata.subySubscriptionStatus &&
      SUBY_ACTIVE_STATUSES.includes(metadata.subySubscriptionStatus as (typeof SUBY_ACTIVE_STATUSES)[number])
  );
  return {
    provider: "Suby.fi",
    subscribed,
    trialEndsAt: user.trialEndsAt ?? null,
    trialActive: Boolean(user.trialEndsAt && user.trialEndsAt > now && !subscribed),
    access: hasScheduleAccess(user, now),
  };
}

export function subyCheckoutRedirect(user: { email: string; id: number }) {
  if (!process.env.SUBY_CHECKOUT_URL) return null;
  const url = new URL(process.env.SUBY_CHECKOUT_URL);
  url.searchParams.set("email", user.email);
  url.searchParams.set("user_id", String(user.id));
  if (process.env.SUBY_PLAN_ID) url.searchParams.set("plan_id", process.env.SUBY_PLAN_ID);
  return url.toString();
}

export function subyStatusFromEvent(event: Record<string, unknown>) {
  const value = event.status ?? event.subscription_status ?? event.type;
  return typeof value === "string" ? value.toLowerCase().replace(/^subscription\./, "") : null;
}

export function subyEmailFromEvent(event: Record<string, unknown>) {
  const customer = event.customer;
  const nestedEmail = customer && typeof customer === "object" ? (customer as Record<string, unknown>).email : undefined;
  const value = event.email ?? nestedEmail;
  return typeof value === "string" ? value.toLowerCase() : null;
}

export function subyMetadataPatch(current: unknown, event: Record<string, unknown>) {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const status = subyStatusFromEvent(event);
  const patch: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (status) patch.subySubscriptionStatus = status;
  for (const key of ["subscription_id", "customer_id"] as const) {
    const value = event[key];
    if (typeof value === "string" || typeof value === "number") {
      patch[key === "subscription_id" ? "subySubscriptionId" : "subyCustomerId"] = String(value);
    }
  }
  return patch;
}

export function verifySubySignature(rawBody: string, signature: string | null) {
  const secret = process.env.SUBY_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalized = signature.replace(/^sha256=/, "");
  return normalized.length === expected.length && crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
}

export function subyTrialEndDate(from = new Date()) {
  return new Date(from.getTime() + 5 * 24 * 60 * 60 * 1000);
}
