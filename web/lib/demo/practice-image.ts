export function practiceImage(): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <rect width="960" height="640" fill="#f3efe6"/>
  <rect x="48" y="48" width="864" height="544" fill="#fffdf8" stroke="#1e4d5c" stroke-width="3"/>
  <text x="80" y="130" fill="#1c2430" font-family="Georgia, serif" font-size="42">Fictional practice photo</text>
  <text x="80" y="180" fill="#5e6772" font-family="Segoe UI, sans-serif" font-size="24">Not a real patient. Illustration only.</text>
  <ellipse cx="680" cy="390" rx="140" ry="90" fill="#ead8c8" stroke="#8d4330" stroke-width="4"/>
  <text x="80" y="520" fill="#1c2430" font-family="Segoe UI, sans-serif" font-size="22">Use this when you want to try Check a Health Concern.</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}
