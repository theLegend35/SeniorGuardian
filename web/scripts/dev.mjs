import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const key = path.join(webRoot, "certificates", "localhost-key.pem");
const cert = path.join(webRoot, "certificates", "localhost.pem");
const ca = path.join(process.env.LOCALAPPDATA ?? "", "mkcert", "rootCA.pem");
const args = [path.join(webRoot, "node_modules", "next", "dist", "bin", "next"), "dev"];

// The certificates are made on each computer with mkcert and are not in git.
// Without them the site still starts, on plain http.
if (existsSync(key) && existsSync(cert)) {
  args.push(
    "--experimental-https",
    "--experimental-https-key",
    "./certificates/localhost-key.pem",
    "--experimental-https-cert",
    "./certificates/localhost.pem",
  );
  if (existsSync(ca)) {
    args.push("--experimental-https-ca", ca);
  } else {
    console.warn("mkcert root CA was not found. Server actions over local HTTPS can fail until Node trusts that certificate.");
  }
} else {
  console.log("No certificates in web/certificates, so the site starts on http://localhost:3000. The README explains how to add them for phone testing over Wi-Fi.");
}

// Extra options pass through, for example: npm run dev -- -p 3001
args.push(...process.argv.slice(2));

const child = spawn(process.execPath, args, { cwd: webRoot, env: process.env, stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
