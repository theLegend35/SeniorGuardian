import { currentActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const dynamic = "force-dynamic";

/** Headers can only carry Latin-1, so the real name goes in filename* (RFC 6266) beside a plain fallback. */
function disposition(fileName: string): string {
  const name = fileName.replace(/[\r\n"\\]/g, "").trim() || "file";
  const plain = name.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${plain}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  try {
    const file = await (await getStore()).readUpload(actor, id);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition(file.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("That file is not available.", { status: 404 });
  }
}
