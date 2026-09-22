import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { subyCheckoutRedirect } from "@calcom/lib/server/subyAccess";
import prisma from "@calcom/prisma";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

async function getHandler() {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
  const checkoutUrl = subyCheckoutRedirect(user);
  if (!checkoutUrl)
    return NextResponse.json({ message: "Suby.fi checkout is not configured" }, { status: 503 });
  return NextResponse.redirect(checkoutUrl);
}

export const GET = defaultResponderForAppDir(getHandler);
