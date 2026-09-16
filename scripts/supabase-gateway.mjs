/**
 * Development only. Supabase serves PostgREST under /rest/v1, while a bare
 * postgrest process serves it at the root. This forwards one to the other so
 * supabase-js can be pointed at a local Postgres and exercised for real,
 * including RLS, rather than against a mock.
 *
 * Started by scripts/local-supabase.sh. Not used in production.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? "http://127.0.0.1:3001";

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!url.pathname.startsWith("/rest/v1")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `No local handler for ${url.pathname}` }));
    return;
  }

  const target = POSTGREST + url.pathname.slice("/rest/v1".length) + url.search;

  // PostgREST reads the role from the JWT in Authorization. supabase-js sends
  // the key in both apikey and Authorization, so passing them through is enough.
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length"].includes(k)) continue;
    headers[k] = Array.isArray(v) ? v.join(",") : v;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  try {
    const upstream = await fetch(target, { method: req.method, headers, body });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (k !== "content-encoding" && k !== "transfer-encoding") out[k] = v;
    });
    res.writeHead(upstream.status, out);
    res.end(buf);
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `Local gateway could not reach PostgREST: ${error.message}` }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Supabase gateway on http://127.0.0.1:${PORT} forwarding /rest/v1 to ${POSTGREST}`);
});
