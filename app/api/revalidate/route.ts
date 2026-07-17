import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paths = ["/", "/projects", "/area-guides", "/developers", "/blog"];
  for (const p of paths) revalidatePath(p);

  return NextResponse.json({ revalidated: true, paths });
}
