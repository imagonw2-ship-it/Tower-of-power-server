import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";
import { createApp } from "../server/server.js";
import { starterCount } from "../server/items.js";
import { floorHeight } from "../shared/physics.js";

const directory = mkdtempSync(join(tmpdir(), "tower-online-"));
const database = join(directory, "accounts.sqlite");
let app, origin;
const clients = [];
async function boot() {
  app = createApp({ dbPath: database, authRate: 180, allowFile: true });
  const address = await app.listen(0, "127.0.0.1");
  origin = `http://127.0.0.1:${address.port}`;
}
async function api(path, body, token) {
  const r = await fetch(origin + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, ...(await r.json()) };
}
async function until(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = fn();
    if (value) return value;
    await delay(20);
  }
  throw Error("Timed out waiting for condition");
}
async function device(session, agent = "Desktop Chrome") {
  const ws = new WebSocket(origin.replace("http", "ws") + "/ws", {
      headers: { Origin: origin, "User-Agent": agent },
    }),
    c = { ws, session, messages: [], seq: 0, action: 0 };
  c.send = (m) => ws.send(JSON.stringify(m));
  ws.on("message", (b) => {
    const m = JSON.parse(b);
    c.messages.push(m);
    if (m.type === "snapshot") c.snapshot = m;
  });
  c.wait = (type, predicate = () => true) =>
    until(() => {
      const i = c.messages.findIndex((m) => m.type === type && predicate(m));
      return i < 0 ? null : c.messages.splice(i, 1)[0];
    });
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  c.send({ type: "hello", protocol: 1, token: session.token });
  await c.wait("authenticated");
  clients.push(c);
  return c;
}
async function joinRoom(c, type, code) {
  c.send({ type, code });
  const joined = await c.wait("joined");
  c.seq = joined.seq;
  c.action = joined.actionSeq;
  await c.wait("snapshot");
  return joined.code;
}
async function action(c, name, data = {}) {
  const id = ++c.action;
  c.send({ type: "action", id, action: name, ...data });
  return c.wait("actionResult", (m) => m.id === id);
}
function input(c, data = {}) {
  c.send({
    type: "input",
    seq: ++c.seq,
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    crouch: false,
    sprint: false,
    ...data,
  });
}
function aimAt(p, item) {
  const dx = item.x - p.x,
    dz = item.z - p.z,
    dy = item.y + (item.kind === "soda" ? 0.1 : 0) - p.y;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  p.input.yaw = p.yaw;
  p.input.pitch = p.pitch;
}

test("real HTTP/WebSocket cross-device multiplayer and durable accounts", async (t) => {
  await boot();
  t.after(async () => {
    for (const c of clients) c.ws.terminate();
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  let account, host, phone, tablet, chrome, code, room, hostPlayer;
  await t.test(
    "register, duplicate names, wrong login, unique IDs and password hashing",
    async () => {
      const password = "test-only long password 123";
      account = await api("register", { username: "FieldWalker", password });
      assert.equal(account.status, 201);
      assert.match(account.player.id, /^[a-f0-9-]{36}$/);
      assert.equal(
        (await api("register", { username: "fieldwalker", password })).status,
        409,
      );
      assert.equal(
        (
          await api("login", {
            username: "FieldWalker",
            password: "wrong-password",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await api("login", {
            username: "NoSuchUser",
            password: "wrong-password",
          })
        ).status,
        401,
      );
      const login = await api("login", { username: "FIELDWALKER", password });
      assert.equal(login.player.id, account.player.id);
      const row = app.db.prepare("SELECT * FROM accounts").get();
      assert.match(row.password_hash, /^scrypt\$32768\$8\$3\$/);
      assert.ok(!row.password_hash.includes(password));
      assert.ok(!readFileSync(database).includes(Buffer.from(password)));
      const stored = app.db.prepare("SELECT token_hash FROM sessions").all();
      assert.ok(
        stored.every(
          (r) => r.token_hash !== account.token && r.token_hash.length === 64,
        ),
      );
    },
  );
  await t.test(
    "guest devices host/join short room codes; equipment scales 1, 2, 4",
    async () => {
      host = await device(account);
      code = await joinRoom(host, "host");
      assert.match(code, /^[A-Z2-9]{5}$/);
      room = app.rooms.rooms.get(code);
      hostPlayer = room.players.get(account.player.id);
      assert.equal(
        room.world.items.filter((i) => i.kind === "flashlight").length,
        1,
      );
      phone = await device(await api("guest", {}), "Android Mobile Chrome");
      await joinRoom(phone, "join", code);
      assert.equal(room.players.size, 2);
      assert.equal(
        room.world.items.filter((i) => i.kind === "flashlight").length,
        2,
      );
      tablet = await device(await api("guest", {}), "iPad Safari");
      await joinRoom(tablet, "join", code);
      chrome = await device(await api("guest", {}), "ChromeOS Chromebook");
      await joinRoom(chrome, "join", code);
      assert.equal(
        room.world.items.filter((i) => i.kind === "flashlight").length,
        4,
      );
      assert.equal(room.world.items.filter((i) => i.kind === "soda").length, 4);
      assert.equal(starterCount({ base: 2, perPlayer: 0.5, minimum: 1 }, 3), 4);
      phone.send({ type: "start" });
      assert.match((await phone.wait("error")).message, /owner/);
      assert.equal(room.phase, "lobby");
      host.send({ type: "start" });
      await until(() => room.phase === "playing");
      assert.equal(room.world.items.length, 8);
    },
  );
  await t.test(
    "fixed-step movement appears on another device; impossible inputs ignored",
    async () => {
      const z = hostPlayer.z;
      input(host, { z: 1, sprint: true });
      await delay(220);
      input(host, { z: 1, sprint: true });
      await delay(220);
      input(host);
      await until(
        () =>
          phone.snapshot?.players.find((p) => p.id === hostPlayer.id)?.z <
          z - 0.8,
      );
      assert.ok(z - hostPlayer.z < 4);
      assert.ok(z - hostPlayer.z > 0.8);
      const before = hostPlayer.x;
      input(host, {
        x: 999,
        position: { x: 99999, z: 99999 },
        health: 999,
        inventory: { flashlight: true },
      });
      await delay(120);
      assert.ok(Math.abs(hostPlayer.x - before) < 0.1);
      assert.equal(hostPlayer.inventory.flashlight, false);
      assert.equal(hostPlayer.health, 1);
    },
  );
  await t.test(
    "server validates distance, walls, aim, inventory and repeated item actions",
    async () => {
      const torch = room.world.items.find((i) => i.kind === "flashlight");
      assert.equal(
        (await action(host, "pickup", { itemId: torch.id })).ok,
        false,
      );
      // Server fixture positions a player by the existing bench, never a client teleport message.
      hostPlayer.x = 130.4;
      hostPlayer.z = torch.z;
      hostPlayer.y = floorHeight(hostPlayer.x, hostPlayer.z) + 1.7;
      aimAt(hostPlayer, torch);
      assert.equal(
        (await action(host, "pickup", { itemId: torch.id })).ok,
        false,
        "wall blocks pickup",
      );
      hostPlayer.x = torch.x;
      hostPlayer.z = torch.z - 1.2;
      hostPlayer.y = floorHeight(hostPlayer.x, hostPlayer.z) + 1.7;
      hostPlayer.yaw = 0;
      hostPlayer.pitch = 0;
      assert.equal(
        (await action(host, "pickup", { itemId: torch.id })).ok,
        false,
        "must aim toward item",
      );
      aimAt(hostPlayer, torch);
      assert.equal(
        (await action(host, "pickup", { itemId: torch.id })).ok,
        true,
      );
      assert.equal(hostPlayer.inventory.flashlight, true);
      assert.equal(
        (await action(host, "pickup", { itemId: torch.id })).ok,
        false,
      );
      assert.equal((await action(phone, "soda")).ok, false);
      assert.equal((await action(phone, "torch", { on: true })).ok, false);
      const soda = room.world.items.find((i) => i.kind === "soda");
      aimAt(hostPlayer, soda);
      assert.equal(
        (await action(host, "pickup", { itemId: soda.id })).ok,
        true,
      );
      assert.equal((await action(host, "soda")).ok, true);
      assert.ok(hostPlayer.boost > 14);
      assert.equal(soda.consumed, true);
      assert.equal((await action(host, "soda")).ok, false);
    },
  );
  await t.test(
    "disconnect/reconnect preserves identity, items and owner-independent world",
    async () => {
      const elapsed = room.world.elapsed,
        old = hostPlayer;
      host.ws.terminate();
      await until(() => !hostPlayer.connected);
      await delay(200);
      assert.ok(room.world.elapsed > elapsed);
      host = await device(account);
      await joinRoom(host, "resume", code);
      assert.equal(room.players.get(account.player.id), old);
      assert.equal(hostPlayer.inventory.flashlight, true);
      assert.equal(room.ownerId, account.player.id);
      assert.equal(room.players.size, 4);
    },
  );
  await t.test(
    "rooms are independent; only owner can edit shared world settings",
    async () => {
      const another = await device(await api("guest", {}));
      const otherCode = await joinRoom(another, "host");
      assert.notEqual(otherCode, code);
      const other = app.rooms.rooms.get(otherCode);
      assert.equal(other.players.size, 1);
      assert.notEqual(other.world.id, room.world.id);
      assert.equal(
        (
          await action(phone, "world", {
            value: { phase: 0.8, turbineStopped: true },
          })
        ).ok,
        false,
      );
      assert.equal(
        (await action(host, "world", { value: { phase: 0.8, cycle: false } }))
          .ok,
        true,
      );
      await until(() => phone.snapshot?.world.phase === 0.8);
      assert.equal(other.world.phase, 0.43);
    },
  );
  await t.test(
    "hearing-driven enemies, shared objectives and server deaths synchronize",
    async () => {
      const sim = room.world.sim,
        p = room.players.get(phone.session.player.id);
      p.x = sim.powerCreature.x + 18;
      p.z = sim.powerCreature.z;
      p.y = floorHeight(p.x, p.z) + 1.7;
      sim.noise(p, 100);
      for (let i = 0; i < 160; i++) app.rooms.tick(0.05);
      assert.notEqual(sim.powerCreature.state, "dormant");
      assert.equal(room.world.objectives.powerCorridor, true);
      await until(
        () =>
          host.snapshot?.world.objectives.powerCorridor &&
          phone.snapshot?.enemies.power.state !== "dormant",
      );
      assert.ok(
        sim.powerCreature.feet.every((f) => f.position.every(Number.isFinite)),
      );
      assert.ok(
        sim
          .snapshot()
          .turbine.feet.every((f) => f.position.every(Number.isFinite)),
      );
      p.x = sim.powerCreature.x;
      p.z = sim.powerCreature.z;
      p.connected = false;
      sim.powerCreature.state = "running";
      p.alive = true;
      sim.noise(p, 70);
      sim.step(0.01, [p]);
      assert.equal(p.alive, true, "the center no longer causes an invisible instant catch");
      for(let i=0;i<70&&p.alive;i++)sim.step(.05,[p]);
      assert.equal(p.alive, false, "a committed foot impact still affects a disconnected character");
      assert.equal(p.health, 0);
    },
  );
  await t.test(
    "voluntary leave, grace cleanup and consumed items do not duplicate",
    async () => {
      host.send({ type: "leave" });
      await host.wait("left");
      assert.equal(room.players.has(account.player.id), false);
      const used = room.world.items.find((i) => i.consumed);
      assert.ok(used.holder, "consumed soda is not released");
      assert.notEqual(room.ownerId, account.player.id);
      chrome.ws.terminate();
      const p = room.players.get(chrome.session.player.id);
      await until(() => !p.connected);
      p.disconnectedAt = Date.now() - 91000;
      app.rooms.tick(0.05);
      assert.equal(room.players.has(p.id), false);
    },
  );
  await t.test(
    "logout revokes sessions; database restart keeps registered account and valid login",
    async () => {
      const session = await api("login", {
        username: "FieldWalker",
        password: "test-only long password 123",
      });
      assert.equal((await api("logout", {}, session.token)).status, 200);
      assert.equal((await api("me", undefined, session.token)).status, 401);
      for (const c of clients) c.ws.terminate();
      await app.close();
      await boot();
      const me = await api("me", undefined, account.token);
      assert.equal(me.player.id, account.player.id);
      const login = await api("login", {
        username: "FieldWalker",
        password: "test-only long password 123",
      });
      assert.equal(login.player.id, account.player.id);
      assert.equal(
        app.rooms.rooms.size,
        0,
        "ephemeral rooms are separate from persistent accounts",
      );
    },
  );
});
