import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import prisma from "@calcom/prisma";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { subyStatusResponse } from "@calcom/lib/server/subyAccess";

async function getHandler() {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, trialEndsAt: true, metadata: true } });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
  return NextResponse.json(subyStatusResponse(user));
}

export const GET = defaultResponderForAppDir(getHandler);
