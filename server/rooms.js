import { randomInt } from "node:crypto";
import { config } from "./config.js";
import { HttpError } from "./auth.js";
import { makePlayer, wirePlayer } from "./players.js";
import { makeWorld, startWorld, tickWorld } from "./worlds.js";
import { scaleItems, releaseItems } from "./items.js";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export class Rooms {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.rooms = new Map();
    this.membership = new Map();
  }
  create(account) {
    if (this.rooms.size >= this.config.maxRooms)
      throw new HttpError(503, "World limit reached. Try later.");
    if (this.membership.has(account.id))
      throw new HttpError(409, "Leave your current world first.");
    let code;
    do {
      code = Array.from(
        { length: 5 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
    } while (this.rooms.has(code));
    const r = {
      code,
      ownerId: account.id,
      players: new Map(),
      phase: "lobby",
      world: makeWorld(this.config),
      lastOccupied: Date.now(),
      created: Date.now(),
    };
    this.rooms.set(code, r);
    return r;
  }
  join(account, code) {
    if (typeof code !== "string" || !/^[A-Z2-9]{5}$/.test(code))
      throw new HttpError(400, "Enter the five-character room code.");
    const r = this.rooms.get(code);
    if (!r) throw new HttpError(404, "World not found.");
    const existing = this.membership.get(account.id);
    if (existing && existing !== code)
      throw new HttpError(409, "Leave your current world first.");
    let p = r.players.get(account.id);
    if (
      p &&
      p.disconnectedAt &&
      Date.now() - p.disconnectedAt > this.config.reconnectMs
    ) {
      this.leave(account.id);
      p = null;
    }
    if (!p) {
      if (r.players.size >= this.config.maxPlayers)
        throw new HttpError(409, "World is full.");
      p = makePlayer(account, r.players.size);
      r.players.set(p.id, p);
      this.membership.set(p.id, code);
      if (r.phase === "lobby")
        scaleItems(r.world, r.players.size, this.config.starterItems);
    }
    p.connected = true;
    p.disconnectedAt = 0;
    p.lastInput = 0;
    p.input.x = p.input.z = 0;
    r.lastOccupied = Date.now();
    return { room: r, player: p };
  }
  disconnect(id) {
    const r = this.rooms.get(this.membership.get(id)),
      p = r?.players.get(id);
    if (p) {
      p.connected = false;
      p.disconnectedAt = Date.now();
      p.input.x = p.input.z = 0;
      p.vx = p.vz = 0;
    }
  }
  leave(id) {
    const r = this.rooms.get(this.membership.get(id));
    if (!r) return;
    const p = r.players.get(id);
    if (p) releaseItems(r.world, p);
    r.players.delete(id);
    this.membership.delete(id);
    if (r.ownerId === id) r.ownerId = [...r.players.keys()][0] || null;
    if (r.phase === "lobby")
      scaleItems(r.world, r.players.size, this.config.starterItems);
  }
  start(r, id) {
    if (r.ownerId !== id)
      throw new HttpError(403, "Only the world owner can start the round.");
    if (r.phase !== "lobby")
      throw new HttpError(409, "The round has already started.");
    startWorld(r.world, r.players.size);
    r.phase = "playing";
  }
  tick(dt, now = Date.now()) {
    for (const [code, r] of this.rooms) {
      for (const p of r.players.values())
        if (!p.connected && now - p.disconnectedAt > this.config.reconnectMs)
          this.leave(p.id);
      if ([...r.players.values()].some((p) => p.connected))
        r.lastOccupied = now;
      tickWorld(r.world, [...r.players.values()], dt, now);
      if (!r.players.size && now - r.lastOccupied > this.config.emptyRoomMs)
        this.rooms.delete(code);
    }
  }
  snapshot(r, includeItems = true) {
    const w = r.world;
    return {
      type: "snapshot",
      protocol: 1,
      time: Date.now(),
      code: r.code,
      ownerId: r.ownerId,
      phase: r.phase,
      players: [...r.players.values()].map(wirePlayer),
      world: {
        id: w.id,
        phase: w.phase,
        cycle: w.cycle,
        turbineStopped: w.turbineStopped,
        powerStopped: w.powerStopped,
        elapsed: w.elapsed,
        objectives: w.objectives,
        itemRevision: w.itemRevision,
        ...(includeItems ? { items: w.items } : {}),
      },
      enemies: w.sim.snapshot(),
    };
  }
}
