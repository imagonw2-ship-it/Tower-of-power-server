import { WebSocketServer, WebSocket } from "ws";
import { acceptInput } from "./players.js";
import { takeItem } from "./items.js";
export function attachNetworking(
  server,
  { auth, rooms, originAllowed, secureUpgrade },
) {
  const wss = new WebSocketServer({
      noServer: true,
      maxPayload: 4096,
      perMessageDeflate: false,
    }),
    sockets = new Map();
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 128 * 1024) {
        ws.close(1013, "Slow connection");
        return;
      }
      ws.send(
        JSON.stringify(data, (_, v) =>
          typeof v === "number" && !Number.isInteger(v)
            ? Math.round(v * 1000) / 1000
            : v,
        ),
      );
    }
  };
  server.on("upgrade", (req, socket, head) => {
    if (
      req.url !== "/ws" ||
      !originAllowed(req.headers.origin, req) ||
      !secureUpgrade(req)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    if (
      wss.clients.size >=
      rooms.config.maxRooms * rooms.config.maxPlayers + 32
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    ws.alive = true;
    ws.on("pong", () => (ws.alive = true));
    ws.bucket = 60;
    ws.bucketAt = Date.now();
    let account = null,
      room = null,
      p = null;
    const deadline = setTimeout(() => {
      if (!account) ws.close(1008, "Authenticate first");
    }, 5000);
    ws.on("error", () => {});
    ws.on("message", (bytes) => {
      const now = Date.now();
      ws.bucket = Math.min(60, ws.bucket + (now - ws.bucketAt) * 0.04);
      ws.bucketAt = now;
      if (--ws.bucket < 0) {
        ws.close(1008, "Rate limit");
        return;
      }
      let m;
      try {
        m = JSON.parse(bytes.toString());
        if (!m || typeof m !== "object" || Array.isArray(m)) throw Error();
      } catch {
        ws.close(1008, "Invalid message");
        return;
      }
      try {
        if (!account) {
          if (m.type !== "hello" || m.protocol !== 1)
            throw Error("Unsupported protocol.");
          account = auth.verify(m.token);
          if (!account) throw Error("Login expired.");
          ws.token = m.token;
          clearTimeout(deadline);
          send(ws, { type: "authenticated", player: account });
          return;
        }
        if (m.type === "ping") {
          send(ws, { type: "pong", echo: m.echo, time: now });
          return;
        }
        if (["host", "join", "resume"].includes(m.type)) {
          if (room) throw Error("Already in a world.");
          const target =
              m.type === "host"
                ? rooms.create(account).code
                : String(m.code || "").toUpperCase(),
            joined = rooms.join(account, target);
          room = joined.room;
          p = joined.player;
          const old = sockets.get(account.id);
          sockets.set(account.id, ws);
          if (old && old !== ws) old.close(4001, "Connected on another device");
          ws.room = room;
          ws.player = p;
          send(ws, {
            type: "joined",
            playerId: p.id,
            code: room.code,
            reconnectMs: rooms.config.reconnectMs,
            seq: p.seq,
            actionSeq: p.actionSeq,
          });
          send(ws, rooms.snapshot(room));
          return;
        }
        if (!room || !p) throw Error("Join a world first.");
        if (m.type === "leave") {
          rooms.leave(p.id);
          if (sockets.get(p.id) === ws) sockets.delete(p.id);
          room = null;
          p = null;
          ws.room = null;
          ws.player = null;
          send(ws, { type: "left" });
          return;
        }
        if (m.type === "start") {
          rooms.start(room, p.id);
          return;
        }
        if (m.type === "input") {
          if (room.phase === "playing" && p.alive) acceptInput(p, m, now);
          return;
        }
        if (m.type !== "action") throw Error("Unknown action.");
        if (
          !Number.isSafeInteger(m.id) ||
          m.id <= p.actionSeq ||
          m.id > p.actionSeq + 10000
        )
          return;
        p.actionSeq = m.id;
        let ok = false;
        const w = room.world;
        if (m.action === "world" && p.id === room.ownerId) {
          const a = m.value;
          if (a && typeof a === "object") {
            if (Number.isFinite(a.phase))
              w.phase = Math.max(0, Math.min(0.999, a.phase));
            for (const k of ["cycle", "turbineStopped", "powerStopped"])
              if (typeof a[k] === "boolean") w[k] = a[k];
            ok = true;
          }
        }
        if (room.phase === "playing" && p.alive) {
          if (m.action === "pickup") ok = takeItem(w, p, m.itemId);
          if (m.action === "torch" && p.inventory.flashlight) {
            p.torch = !!m.on;
            ok = true;
          }
          if (m.action === "photo" && p.cooldown <= 0) {
            p.cooldown = 0.9;
            p.photo = 0.22;
            w.sim.noise(p, 100);
            ok = true;
          }
          if (m.action === "soda" && p.inventory.sodas > 0 && p.drinking <= 0) {
            p.inventory.sodas--;
            const used = w.items.find(
              (i) => i.kind === "soda" && i.holder === p.id && !i.consumed,
            );
            if (used) {
              used.consumed = true;
              w.itemRevision++;
            }
            p.boost = 15;
            p.drinking = 1.1;
            w.sim.noise(p, 18);
            ok = true;
          }
        }
        send(ws, { type: "actionResult", id: m.id, action: m.action, ok });
      } catch (e) {
        send(ws, {
          type: "error",
          message: e.status
            ? e.message
            : (e.message || "Request rejected.").slice(0, 120),
        });
        if (!account) ws.close(1008, "Authentication failed");
      }
    });
    ws.on("close", () => {
      clearTimeout(deadline);
      if (p && sockets.get(p.id) === ws) {
        sockets.delete(p.id);
        rooms.disconnect(p.id);
      }
    });
  });
  let last = performance.now(),
    acc = 0,
    sendAcc = 0,
    maintenance = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= 1 / rooms.config.tickHz) {
      rooms.tick(1 / rooms.config.tickHz);
      acc -= 1 / rooms.config.tickHz;
      sendAcc += 1 / rooms.config.tickHz;
    }
    if (sendAcc >= 1 / rooms.config.snapshotHz) {
      sendAcc = 0;
      for (const ws of wss.clients)
        if (ws.room && ws.player) {
          const w = ws.room.world;
          send(ws, rooms.snapshot(ws.room, ws.itemRevision !== w.itemRevision));
          ws.itemRevision = w.itemRevision;
          if (w.sim.events.length)
            send(ws, { type: "events", events: w.sim.events });
        }
      for (const r of rooms.rooms.values()) r.world.sim.events.length = 0;
    }
    if (++maintenance >= 300) {
      maintenance = 0;
      auth.cleanup();
      for (const ws of wss.clients) {
        if (!ws.alive) {
          ws.terminate();
          continue;
        }
        if (ws.token && !auth.verify(ws.token)) {
          ws.close(4003, "Session expired");
          continue;
        }
        ws.alive = false;
        ws.ping();
      }
    }
  }, 25);
  timer.unref();
  return {
    wss,
    sockets,
    close: async () => {
      clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
    },
  };
}
