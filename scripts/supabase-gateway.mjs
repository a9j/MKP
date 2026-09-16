/**
 * Development only. Stands in for the parts of Supabase the app talks to, so
 * the real client, the real policies and the real session handling can be
 * exercised against a local Postgres.
 *
 *   /rest/v1     forwarded to a bare postgrest process, which serves at the root
 *   /auth/v1     a minimal stand in for the auth server
 *   /storage/v1  files written under .local-storage
 *
 * The auth part issues genuine JWTs signed with the same secret PostgREST
 * verifies, so an admin request really does arrive as the authenticated role
 * and really is filtered by RLS. What is faked is the auth server's own
 * internals, not any of this project's code. Magic links are written to
 * .local-storage/magic-links.json instead of being emailed.
 *
 * Started by scripts/local-supabase.sh. Never used in production.
 */
import { createServer } from "node:http";
import { createHmac, randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? "http://127.0.0.1:3001";
const JWT_SECRET =
  process.env.JWT_SECRET ?? "mona-k-project-local-development-jwt-secret-value";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORE = join(ROOT, ".local-storage");
const LINKS = join(STORE, "magic-links.json");
mkdirSync(STORE, { recursive: true });

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  const [header, body, signature] = String(token ?? "").split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Same email always maps to the same user id, the way a real account would. */
function userIdFor(email) {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex");
  return [
    hash.slice(0, 8), hash.slice(8, 12), `4${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`, hash.slice(20, 32),
  ].join("-");
}

function userFor(email) {
  const now = new Date().toISOString();
  return {
    id: userIdFor(email),
    aud: "authenticated",
    role: "authenticated",
    email: email.toLowerCase(),
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

function sessionFor(email) {
  const user = userFor(email);
  const issued = Math.floor(Date.now() / 1000);
  const expires = issued + 3600;
  return {
    access_token: signJwt({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      iss: "http://127.0.0.1:" + PORT + "/auth/v1",
      iat: issued,
      exp: expires,
      session_id: randomUUID(),
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expires,
    refresh_token: `local-${b64url(user.email)}`,
    user,
  };
}

function readLinks() {
  if (!existsSync(LINKS)) return {};
  try {
    return JSON.parse(readFileSync(LINKS, "utf8"));
  } catch {
    return {};
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleAuth(req, res, url) {
  const path = url.pathname.slice("/auth/v1".length);
  const raw = await readBody(req);
  let body = {};
  try {
    body = raw.length ? JSON.parse(raw.toString()) : {};
  } catch {
    body = {};
  }

  // Request a magic link. A real deployment emails it; here it is written to
  // .local-storage/magic-links.json so a test can pick it up.
  if (path === "/otp" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if (!email.includes("@")) return json(res, 400, { error: "invalid email" });

    const tokenHash = createHash("sha256")
      .update(`${email}:${Date.now()}:${randomUUID()}`)
      .digest("hex");
    // supabase-js puts emailRedirectTo on the query string as redirect_to,
    // which is what the real auth server reads. The body is only a fallback.
    const redirect =
      url.searchParams.get("redirect_to") ?? body.options?.emailRedirectTo ?? "";
    const links = readLinks();
    links[email] = {
      token_hash: tokenHash,
      created_at: new Date().toISOString(),
      link: `${redirect}${redirect.includes("?") ? "&" : "?"}token_hash=${tokenHash}&type=email`,
    };
    writeFileSync(LINKS, JSON.stringify(links, null, 2));
    console.log(`[auth stub] magic link for ${email}: ${links[email].link}`);
    return json(res, 200, {});
  }

  // Exchange the token hash for a session.
  if (path === "/verify" && req.method === "POST") {
    const tokenHash = String(body.token_hash ?? body.token ?? "");
    const links = readLinks();
    const match = Object.entries(links).find(([, v]) => v.token_hash === tokenHash);
    if (!match) {
      return json(res, 403, {
        error: "access_denied",
        error_description: "Email link is invalid or has expired",
      });
    }
    const [email] = match;
    delete links[email];
    writeFileSync(LINKS, JSON.stringify(links, null, 2));
    return json(res, 200, sessionFor(email));
  }

  if (path === "/token" && req.method === "POST") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const token = String(body.refresh_token ?? "");
      if (!token.startsWith("local-")) return json(res, 400, { error: "invalid_grant" });
      const email = Buffer.from(token.slice("local-".length), "base64url").toString();
      return json(res, 200, sessionFor(email));
    }
    return json(res, 400, { error: "unsupported_grant_type" });
  }

  if (path === "/user" && req.method === "GET") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const claims = verifyJwt(token);
    if (!claims?.email || claims.role !== "authenticated") {
      return json(res, 401, { message: "invalid claim: missing sub claim" });
    }
    return json(res, 200, userFor(claims.email));
  }

  if (path === "/logout" && req.method === "POST") {
    res.writeHead(204);
    return res.end();
  }

  return json(res, 404, { message: `auth stub has no handler for ${req.method} ${path}` });
}

const CONTENT_TYPES = {
  pdf: "application/pdf",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

async function handleStorage(req, res, url) {
  // Uploads go to /storage/v1/object/<bucket>/<path...>, while a public read
  // is /storage/v1/object/public/<bucket>/<path...>, which is the URL the app
  // builds for a document link.
  const parts = url.pathname.split("/").filter(Boolean).slice(3);
  if (parts[0] === "public" || parts[0] === "authenticated") parts.shift();
  const bucket = parts.shift();
  const key = parts.join("/");
  if (!bucket || !key) return json(res, 400, { message: "bucket and key are required" });

  const target = join(STORE, bucket, key);

  if (req.method === "POST" || req.method === "PUT") {
    const data = await readBody(req);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    return json(res, 200, { Key: `${bucket}/${key}`, Id: randomUUID() });
  }

  if (req.method === "GET") {
    if (!existsSync(target)) return json(res, 404, { message: "not found" });
    const data = readFileSync(target);
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "content-length": data.length,
    });
    return res.end(data);
  }

  return json(res, 405, { message: "method not allowed" });
}

/**
 * Supabase serves these headers, and the browser client calls this origin from
 * the app's own origin, so without them every sign in fails silently in the
 * browser while curl keeps working.
 */
function cors(req, res) {
  res.setHeader("access-control-allow-origin", req.headers.origin ?? "*");
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader(
    "access-control-allow-headers",
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept-profile, content-profile, prefer, range",
  );
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("access-control-expose-headers", "content-range, x-supabase-api-version");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  cors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await handleStorage(req, res, url);

    if (!url.pathname.startsWith("/rest/v1")) {
      return json(res, 404, { message: `No local handler for ${url.pathname}` });
    }

    const target = POSTGREST + url.pathname.slice("/rest/v1".length) + url.search;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (["host", "connection", "content-length"].includes(k)) continue;
      headers[k] = Array.isArray(v) ? v.join(",") : v;
    }
    const raw = await readBody(req);
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: raw.length ? raw : undefined,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (k !== "content-encoding" && k !== "transfer-encoding") out[k] = v;
    });
    res.writeHead(upstream.status, out);
    res.end(buf);
  } catch (error) {
    json(res, 502, { message: `Local gateway error: ${error.message}` });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Supabase stand in on http://127.0.0.1:${PORT}`);
  console.log(`  /rest/v1    -> ${POSTGREST}`);
  console.log(`  /auth/v1    -> local stub, magic links written to ${LINKS}`);
  console.log(`  /storage/v1 -> ${STORE}`);
});
