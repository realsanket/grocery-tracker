import { NextResponse } from "next/server";
import { z } from "zod";
import { getStoreDetail } from "@/db/queries/stores";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid store id" }, { status: 400 });
  }
  const detail = await getStoreDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
