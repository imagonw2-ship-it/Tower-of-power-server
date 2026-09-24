import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { openDatabase } from "./database.js";
import { Auth, HttpError } from "./auth.js";
import { Rooms } from "./rooms.js";
import { attachNetworking } from "./networking.js";
export function createApp(options = {}) {
  const db = openDatabase(
      options.dbPath || process.env.DATABASE_PATH || "data/accounts.sqlite",
    ),
    auth = new Auth(db),
    rooms = new Rooms(options.roomConfig);
  const allowed = (
      options.origins ||
      process.env.ALLOWED_ORIGINS ||
      "https://appassets.androidplatform.net"
    )
      .split(",")
      .map((x) => x.trim()),
    allowFile = options.allowFile ?? process.env.ALLOW_FILE_ORIGIN === "true",
    trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "true";
  const secure = (req) =>
    process.env.NODE_ENV !== "production" ||
    req.socket.encrypted ||
    (trustProxy && req.headers["x-forwarded-proto"] === "https");
  const originAllowed = (origin, req) =>
    !origin ||
    allowed.includes(origin) ||
    (origin === "null" && allowFile) ||
    origin ===
      `${trustProxy ? "https" : req.socket.encrypted ? "https" : "http"}://${req.headers.host}`;
  const limits = new Map();
  function rate(key, max, ms) {
    const now = Date.now();
    let r = limits.get(key);
    if (!r || r.until < now) {
      r = { count: 0, until: now + ms };
      limits.set(key, r);
    }
    if (++r.count > max)
      throw new HttpError(429, "Too many requests. Try again later.");
    if (limits.size > 5000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  }
  const root = fileURLToPath(new URL("../public/", import.meta.url));
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    const reply = (code, data) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    try {
      if (!originAllowed(origin, req))
        throw new HttpError(403, "Origin not allowed.");
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.url === "/health") {
        reply(200, { ok: true, protocol: 1, rooms: rooms.rooms.size });
        return;
      }
      if (
        req.method === "GET" &&
        (req.url === "/" || req.url === "/index.html")
      ) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(readFileSync(resolve(root, "index.html")));
        return;
      }
      if (!req.url?.startsWith("/api/")) throw new HttpError(404, "Not found.");
      if (!secure(req)) throw new HttpError(400, "HTTPS required.");
      const ip = trustProxy
        ? String(req.headers["x-forwarded-for"] || req.socket.remoteAddress)
            .split(",")
            .at(-1)
            .trim()
        : req.socket.remoteAddress;
      rate("api:" + ip, 180, 60000);
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      if (req.url === "/api/me" && req.method === "GET") {
        const a = auth.verify(token);
        if (!a) throw new HttpError(401, "Login expired.");
        reply(200, { player: a });
        return;
      }
      if (req.method !== "POST") throw new HttpError(405, "POST required.");
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new HttpError(415, "JSON required.");
      let size = 0,
        chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) throw new HttpError(413, "Request too large.");
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (!body || typeof body !== "object") throw Error();
      } catch {
        throw new HttpError(400, "Invalid JSON.");
      }
      if (req.url === "/api/logout") {
        auth.logout(token);
        for (const ws of network.wss.clients)
          if (ws.token === token) ws.close(4003, "Logged out");
        reply(200, { ok: true });
        return;
      }
      rate("auth:" + ip, options.authRate || 20, 60000);
      if (["/api/register", "/api/login"].includes(req.url))
        rate("username:" + String(body.username).toLowerCase(), 10, 60000);
      if (req.url === "/api/register")
        reply(201, await auth.register(body.username, body.password));
      else if (req.url === "/api/login")
        reply(200, await auth.login(body.username, body.password));
      else if (req.url === "/api/guest") reply(201, auth.guest());
      else throw new HttpError(404, "Not found.");
    } catch (e) {
      if (!res.headersSent)
        reply(e.status || 500, {
          error: e.status ? e.message : "Server error. Please try again.",
        });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const network = attachNetworking(server, {
    auth,
    rooms,
    originAllowed,
    secureUpgrade: secure,
  });
  return {
    server,
    auth,
    rooms,
    db,
    network,
    listen: (port = Number(process.env.PORT) || 8080, host = "0.0.0.0") =>
      new Promise((r) => server.listen(port, host, () => r(server.address()))),
    close: async () => {
      await network.close();
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = createApp();
  const a = await app.listen();
  console.log("TOWER OF POWER server listening on " + a.port);
  for (const sig of ["SIGTERM", "SIGINT"])
    process.on(sig, async () => {
      await app.close();
      process.exit(0);
    });
}
