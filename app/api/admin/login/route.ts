import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
  createAdminSession,
} from "../../../../lib/auth/session";
import { getSupabaseAdmin } from "../../../../lib/auth/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "Admin login is not configured" },
      { status: 503 }
    );
  }

  // On Vercel, this header is supplied by the platform.
  // Reject requests without a trustworthy IP identifier.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();

  if (!ip) {
    return NextResponse.json(
      { error: "Unable to verify request" },
      { status: 503 }
    );
  }

  const ipHash = createHash("sha256")
    .update(`${sessionSecret}:${ip}`)
    .digest("hex");

  // Reserve an attempt before checking the password.
  // Database errors fail closed.
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc(
      "reserve_admin_login_attempt",
      { p_ip_hash: ipHash }
    );

    if (error) {
      console.error("Admin login rate-limit check failed");
      return NextResponse.json(
        { error: "Login temporarily unavailable" },
        { status: 503 }
      );
    }

    if (data !== true) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        {
          status: 429,
          headers: { "Retry-After": "900" },
        }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Login temporarily unavailable" },
      { status: 503 }
    );
  }

  let password: unknown;

  try {
    const body = await request.json();
    password = body?.password;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length > 1024) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const hash = (value: string) =>
    createHash("sha256").update(value).digest();

  if (!timingSafeEqual(hash(password), hash(expectedPassword))) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: createAdminSession(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}
