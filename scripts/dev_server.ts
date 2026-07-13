#!/usr/bin/env bun
/**
 * BotwaveBomba local dev server.
 *
 * Serves files from the repo root at http://localhost:8080/botwavebomba/
 * to match the GitHub Pages project-site path. Falls back to .html for
 * extensionless URLs.
 */
import { serve } from "bun";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/var/home/gringo/botwave-bomba";
const BASE = "/botwavebomba";

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function resolvePath(urlPath: string): string | null {
  if (!urlPath.startsWith(BASE)) return null;
  let rel = urlPath.slice(BASE.length).replace(/^\/+/, "");
  if (!rel) rel = "index.html";
  let filePath = join(ROOT, rel);
  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;
  const htmlPath = filePath + ".html";
  if (existsSync(htmlPath) && statSync(htmlPath).isFile()) return htmlPath;
  return null;
}

serve({
  port: 8080,
  fetch(req) {
    const url = new URL(req.url);
    const filePath = resolvePath(url.pathname);
    if (!filePath) {
      return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }
    try {
      const body = readFileSync(filePath);
      return new Response(body, { headers: { "Content-Type": contentType(filePath) } });
    } catch (e) {
      return new Response(String(e), { status: 500, headers: { "Content-Type": "text/plain" } });
    }
  },
});

console.log("Serving BotwaveBomba at http://localhost:8080/botwavebomba/");
