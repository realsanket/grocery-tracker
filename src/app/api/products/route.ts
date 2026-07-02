import { NextResponse } from "next/server";
import { z } from "zod";
import { listProducts } from "@/db/queries/products";

const querySchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const { rows, total } = await listProducts(parsed.data);
  return NextResponse.json({
    products: rows,
    total,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });
}
