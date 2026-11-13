import type { NextRequest } from "next/server";
import { act, page } from "../handler";

export function GET(request: NextRequest) {
  return page(request, "digest");
}

export async function POST(request: NextRequest) {
  return act(request, "digest");
}
