import { currentActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  try {
    const file = await (await getStore()).readUpload(actor, id);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("That file is not available.", { status: 404 });
  }
}
