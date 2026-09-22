import crypto from "node:crypto";
import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@calcom/prisma";
import { subyEmailFromEvent, subyMetadataPatch, subyStatusFromEvent } from "@calcom/lib/server/subyAccess";

async function postHandler(request: NextRequest) {
  const rawBody = await request.text();
  const configuredSecret = process.env.SUBY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-suby-signature")?.replace(/^sha256=/, "");
  if (configuredSecret) {
    if (!signature) return NextResponse.json({ message: "Missing signature" }, { status: 401 });
    const expected = crypto.createHmac("sha256", configuredSecret).update(rawBody).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Webhook secret is not configured" }, { status: 503 });
  }
  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody) as Record<string, unknown>; } catch { return NextResponse.json({ message: "Invalid JSON" }, { status: 400 }); }
  const email = subyEmailFromEvent(event);
  const status = subyStatusFromEvent(event);
  if (!email || !status) return NextResponse.json({ message: "Missing email or status" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, metadata: true } });
  if (!user) return NextResponse.json({ message: "Accepted: user not found" }, { status: 202 });
  await prisma.user.update({ where: { id: user.id }, data: { metadata: subyMetadataPatch(user.metadata, event) } });
  return NextResponse.json({ ok: true, userId: user.id, status });
}

export const POST = defaultResponderForAppDir(postHandler);
