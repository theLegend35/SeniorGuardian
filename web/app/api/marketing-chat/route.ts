import { z } from "zod";

import { answerMarketingChat, marketingChatLimited } from "@/lib/ai/marketing";

export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1200),
      }),
    )
    .min(1)
    .max(12),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request) {
  if (marketingChatLimited(clientIp(request))) {
    return Response.json({ error: "Please wait a few minutes before sending more questions." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Send a short question about the product." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  const latest = parsed.success ? parsed.data.messages.at(-1) : undefined;
  const userTooLong = parsed.success && parsed.data.messages.some((message) => message.role === "user" && message.content.length > 500);
  if (!parsed.success || latest?.role !== "user" || userTooLong) {
    return Response.json({ error: "Send a short question about the product." }, { status: 400 });
  }

  const reply = await answerMarketingChat(parsed.data.messages);
  return Response.json({ reply }, { headers: { "Cache-Control": "private, no-store" } });
}
