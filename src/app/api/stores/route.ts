import { NextResponse } from "next/server";
import { listStores } from "@/db/queries/stores";

export async function GET() {
  const stores = await listStores();
  return NextResponse.json({ stores });
}
