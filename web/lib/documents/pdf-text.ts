import zlib from "node:zlib";

function unescapePdf(value: string): string {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_match, seq: string) => {
    if (seq === "n") return "\n";
    if (seq === "r") return "\r";
    if (seq === "t") return "\t";
    if (seq === "b" || seq === "f") return "";
    if (seq === "(" || seq === ")" || seq === "\\") return seq;
    return String.fromCharCode(Number.parseInt(seq, 8));
  });
}

function stringsFrom(content: string): string[] {
  const found: string[] = [];
  for (const match of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) found.push(unescapePdf(match[1]));
  for (const match of content.matchAll(/\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*\.?\d*\s*)+)\]\s*TJ/g)) {
    const parts = [...match[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((item) => unescapePdf(item[1]));
    if (parts.length) found.push(parts.join(""));
  }
  return found;
}

function inflate(body: Buffer): Buffer[] {
  const out: Buffer[] = [];
  for (const attempt of [() => zlib.inflateSync(body), () => zlib.inflateRawSync(body)]) {
    try {
      out.push(attempt());
    } catch {
      // The stream is not a matching deflate payload.
    }
  }
  return out;
}

export function extractPdfText(data: Buffer): string {
  const raw = data.toString("latin1");
  const pieces = stringsFrom(raw);
  const marker = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const body = Buffer.from(raw.slice(start, end).replace(/\r?\n$/, ""), "latin1");
    pieces.push(...stringsFrom(body.toString("latin1")));
    for (const inflated of inflate(body)) pieces.push(...stringsFrom(inflated.toString("latin1")));
  }
  return pieces
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 1)
    .join("\n")
    .slice(0, 12000);
}
