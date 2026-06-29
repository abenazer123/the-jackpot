/**
 * POST /api/booking/id-upload — stores a guest's photo ID for a booking.
 *
 * Multipart (token + file). Validates the token maps to a real inquiry,
 * checks type + size, and uploads to the PRIVATE `booking-ids` storage
 * bucket (never public). Returns only the storage path, which the client
 * then submits with the signature so it becomes part of the contract
 * package. Files are reachable only via the service role or a short-lived
 * signed URL generated in admin.
 */

import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const token = String(form.get("token") ?? "");
  const file = form.get("file");

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "bad_type" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Only accept uploads for a real booking.
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id")
    .eq("share_token", token)
    .maybeSingle();
  if (!inquiry) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 });
  }

  const path = `${token}/id-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("booking-ids")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[id-upload] failed", error.message);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, filename: file.name });
}
