import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductDetail } from "@/db/queries/products";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const detail = await getProductDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
