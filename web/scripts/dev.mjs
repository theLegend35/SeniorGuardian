import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ca = path.join(process.env.LOCALAPPDATA ?? "", "mkcert", "rootCA.pem");
const args = [
  path.join(webRoot, "node_modules", "next", "dist", "bin", "next"),
  "dev",
  "--experimental-https",
  "--experimental-https-key",
  "./certificates/localhost-key.pem",
  "--experimental-https-cert",
  "./certificates/localhost.pem",
];

if (existsSync(ca)) {
  args.push("--experimental-https-ca", ca);
} else {
  console.warn("mkcert root CA was not found. Server actions over local HTTPS can fail until Node trusts that certificate.");
}

const child = spawn(process.execPath, args, { cwd: webRoot, env: process.env, stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
