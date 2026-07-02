import { timingSafeEqual, createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

function passwordsMatch(candidate: string, actual: string): boolean {
  // Hash both sides so timingSafeEqual gets equal-length buffers.
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(actual).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (!passwordsMatch(parsed.data.password, adminPassword)) {
    // Small fixed delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 750));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
