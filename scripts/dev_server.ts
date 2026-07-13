#!/usr/bin/env bun
// Minimal static dev server for BotwaveBomba, serving under /botwavebomba/
import { serve } from "bun";

const ROOT = `${import.meta.dir}/..`;
const PORT = Number(process.env.PORT || 8080);
const BASE = "/botwavebomba";

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (!pathname.startsWith(BASE)) {
      return new Response("Not Found", { status: 404 });
    }
    let filePath = pathname.slice(BASE.length) || "/index.html";
    if (filePath === "/") filePath = "/index.html";
    const fullPath = `${ROOT}${filePath}`;
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }
    return new Response(file, { headers: { "Content-Type": contentType(filePath) } });
  },
});

console.log(`[dev] serving BotwaveBomba at http://localhost:${PORT}${BASE}/`);
