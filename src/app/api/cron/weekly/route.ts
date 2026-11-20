import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser, isStaff } from "@/lib/auth";
import { runWeekly } from "@/lib/pipeline";
import { sameOrigin } from "@/lib/request-guard";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function bearerOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const header = req.headers.get("authorization") ?? "";
  if (secret.length < 16 || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The weekly run. Vercel cron calls it with the CRON_SECRET bearer; TIA staff can also
 * trigger it while signed in (POST from the dashboard). `?dry=1` only lists candidates.
 */
async function handle(req: NextRequest) {
  const fromCron = bearerOk(req);
  if (!fromCron) {
    const user = await currentUser();
    if (!user || !isStaff(user) || req.method !== "POST" || !sameOrigin(req))
      return NextResponse.json({ error: "Not allowed" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  try {
    const result = await runWeekly({ dryRun, limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 25) : undefined });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[weekly] run failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Run failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = handle;
export const POST = handle;
