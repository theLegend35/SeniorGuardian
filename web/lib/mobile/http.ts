export const mobileCors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "private, no-store",
};

export function mobileJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: mobileCors });
}

export function mobileOptions() {
  return new Response(null, { status: 204, headers: mobileCors });
}
