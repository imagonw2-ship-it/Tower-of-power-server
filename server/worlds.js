import { advanceFlares } from '../shared/survival.js';
import { floorHeight,blocked } from '../shared/physics.js';
import { randomUUID,randomInt } from "node:crypto";
import { makeLayout } from '../shared/world-layout.js';
import { createEnemySimulation } from "./enemies.js";
import { scaleItems } from "./items.js";
import { tickPlayer } from "./players.js";
import { pylonCountForPlayers, EXTRA_PYLON_SPAWNS } from '../shared/silent-search.js';
export function makeWorld(rules,seed=randomInt(0,0x7fffffff)) {
  const w = {
    id: randomUUID(),
    schemaVersion: 1,
    seed,
    layout:makeLayout(seed),
    phase: 0.43,
    cycle: true,
    turbineStopped: false,
    powerStopped: false,
    elapsed: 0,
    items: [], flares: [], flareSerial:0, itemSerial:0,
    itemRevision: 0,
    extraPylons: [], extraTurbines: [],
    objectives: { powerCorridor: false },
    rules,
  };
  w.sim = createEnemySimulation(w);
  w.extraTurbines=w.layout.turbines.slice(1).map(t=>createEnemySimulation(w,{turbineOnly:true,turbineSpawn:t}));
  return w;
}
export function startWorld(w, count) {
  scaleItems(w, count, w.rules.starterItems);
  growPylons(w,count);
  w.started = true;
}
export function growPylons(w,count){
  const wanted=Math.min(EXTRA_PYLON_SPAWNS.length,pylonCountForPlayers(count,w.rules.pylons)-1);
  while(w.extraPylons.length<wanted)w.extraPylons.push(createEnemySimulation(w,{powerOnly:true,powerSpawn:EXTRA_PYLON_SPAWNS[w.extraPylons.length]}));
}
export function tickWorld(w, players, dt, now) {
  if (!w.started) return;
  w.elapsed += dt;
  if (w.cycle) w.phase = (w.phase + dt / 720) % 1;
  for (const p of players) tickPlayer(p, dt, w, now);
  w.flares=advanceFlares(w.flares,dt,floorHeight,blocked);
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
    items: w.items, flares:w.flares,
    objectives: w.objectives,
    enemies: {
      turbine: w.sim.turbine,
      enemy: w.sim.enemy,
      powerCreature: w.sim.powerCreature,
      extraPylons: w.extraPylons.map(s=>s.powerCreature),
      extraTurbines:w.extraTurbines.map(s=>({turbine:s.turbine,enemy:s.enemy})),
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
