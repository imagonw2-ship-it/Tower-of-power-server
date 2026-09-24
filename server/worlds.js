import { randomUUID } from "node:crypto";
import { createEnemySimulation } from "./enemies.js";
import { scaleItems } from "./items.js";
import { tickPlayer } from "./players.js";
export function makeWorld(rules) {
  const w = {
    id: randomUUID(),
    schemaVersion: 1,
    seed: 1,
    phase: 0.43,
    cycle: true,
    turbineStopped: false,
    powerStopped: false,
    elapsed: 0,
    items: [],
    itemRevision: 0,
    objectives: { powerCorridor: false },
    rules,
  };
  w.sim = createEnemySimulation(w);
  return w;
}
export function startWorld(w, count) {
  scaleItems(w, count, w.rules.starterItems);
  w.started = true;
}
export function tickWorld(w, players, dt, now) {
  if (!w.started) return;
  w.elapsed += dt;
  if (w.cycle) w.phase = (w.phase + dt / 720) % 1;
  for (const p of players) tickPlayer(p, dt, w, now);
  w.sim.step(dt, players);
  if (
    players.some(
      (p) => p.alive && p.connected && Math.hypot(p.x + 185, p.z + 270) < 95,
    )
  )
    w.objectives.powerCorridor = true;
}
export function serializeWorld(w) {
  return {
    schemaVersion: w.schemaVersion,
    id: w.id,
    seed: w.seed,
    phase: w.phase,
    cycle: w.cycle,
    turbineStopped: w.turbineStopped,
    powerStopped: w.powerStopped,
    elapsed: w.elapsed,
    items: w.items,
    objectives: w.objectives,
    enemies: {
      turbine: w.sim.turbine,
      enemy: w.sim.enemy,
      powerCreature: w.sim.powerCreature,
    },
  };
}
// Explicit extension boundary; automatic world saving/loading is a later feature.
export class WorldRepository {
  constructor(db) {
    this.db = db;
  }
  save(w, owner) {
    this.db
      .prepare("INSERT OR REPLACE INTO world_saves VALUES(?,?,?,?,?)")
      .run(
        w.id,
        owner,
        w.schemaVersion,
        Date.now(),
        JSON.stringify(serializeWorld(w)),
      );
  }
  load(id) {
    const r = this.db
      .prepare("SELECT state FROM world_saves WHERE id=?")
      .get(id);
    return r ? JSON.parse(r.state) : null;
  }
}
