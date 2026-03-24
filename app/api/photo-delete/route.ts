import { NextResponse } from "next/server";
import { deleteObjectByKey, getR2KeyFromPublicUrl, r2Configured } from "@/lib/r2";

export async function POST(request: Request) {
  if (!r2Configured()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = (await request.json()) as {
      photoUrl?: string;
    };

    const photoUrl = body.photoUrl?.trim();
    if (!photoUrl) {
      return NextResponse.json({ error: "photoUrl is required." }, { status: 400 });
    }

    const key = getR2KeyFromPublicUrl(photoUrl);
    if (!key) {
      return NextResponse.json({ ok: true });
    }

    await deleteObjectByKey(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete cloud photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
