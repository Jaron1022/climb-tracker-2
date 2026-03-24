import { NextResponse } from "next/server";
import { createUploadUrl, getPublicPhotoUrl, r2Configured } from "@/lib/r2";

export async function POST(request: Request) {
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "R2 is not configured yet." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as {
      fileName?: string;
      contentType?: string;
    };

    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "fileName and contentType are required." },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = `climb-photos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
    const uploadUrl = await createUploadUrl(key, contentType);
    const publicUrl = getPublicPhotoUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare photo upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
