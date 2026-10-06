import {createForestLevel,tickForestLevel,biomeOf,forestTerrainHeight} from '../shared/forest-level.js';
import {MimicMemory,ForestMimic} from '../shared/forest-haunts.js';
import { advanceFlares } from '../shared/survival.js';
import { floorHeight,blocked } from '../shared/physics.js';
import { randomUUID,randomInt } from "node:crypto";
import { makeLayout } from '../shared/world-layout.js';
import { createEnemySimulation } from "./enemies.js";
import { scaleItems } from "./items.js";
import { tickPlayer } from "./players.js";
import { pylonCountForPlayers } from '../shared/silent-search.js';
export function makeWorld(rules,seed=randomInt(0,0x7fffffff)) {
  const w = {
    id: randomUUID(),
    schemaVersion: 1,
    seed,forestLevel:createForestLevel(seed),meadowLoaded:true,
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
  w.voiceMemory=new MimicMemory();w.mimic=new ForestMimic(w.layout);w.mimicFrames=[];
  w.sim = createEnemySimulation(w,{turbineSpawn:w.layout.turbines[0],powerSpawn:w.layout.pylons[0]});
  w.extraTurbines=w.layout.turbines.slice(1).map(t=>createEnemySimulation(w,{turbineOnly:true,turbineSpawn:t}));
  return w;
}
export function startWorld(w, count) {
  scaleItems(w, count, w.rules.starterItems);
  growPylons(w,count);
  w.started = true;
}
export function growPylons(w,count){
  const wanted=Math.min(w.layout.pylons.length-1,pylonCountForPlayers(count,w.rules.pylons)-1);
  while(w.extraPylons.length<wanted)w.extraPylons.push(createEnemySimulation(w,{powerOnly:true,powerSpawn:w.layout.pylons[w.extraPylons.length+1]}));
}
export function tickWorld(w, players, dt, now) {
  if (!w.started) return;
  w.elapsed += dt;

  for (const p of players) tickPlayer(p, dt, w, now);
  const meadow=players.filter(p=>p.alive&&p.connected&&biomeOf(p)==='meadow');w.meadowLoaded=meadow.length>0;
  if(w.meadowLoaded&&w.cycle)w.phase=(w.phase+dt/720)%1;
  tickForestLevel(w.forestLevel,players,dt);
  w.flares=[...advanceFlares(w.flares.filter(f=>biomeOf(f)==='meadow'),dt,floorHeight,blocked),...advanceFlares(w.flares.filter(f=>biomeOf(f)==='forest'),dt,forestTerrainHeight,()=>false)];
  if(w.meadowLoaded)w.sim.step(dt,meadow);
  for(const p of players)if(!p.alive||!p.connected){w.voiceMemory.forget(p.id);w.mimic.forget(p.id);}
  const alive=new Set(players.filter(p=>p.alive).map(p=>p.id));
  w.mimicFrames.push(...w.mimic.step(dt,players,w.voiceMemory));
  for(const p of players)if(alive.has(p.id)&&!p.alive)w.sim.events.push({kind:"caught",id:p.id,x:p.x,z:p.z,biome:biomeOf(p)});
  if(w.mimicFrames.length>5)w.mimicFrames.splice(0,w.mimicFrames.length-5);
  if (
    players.some(
      (p) => p.alive && p.connected && biomeOf(p)==='meadow' && Math.hypot(p.x-w.layout.power.x,p.z-w.layout.power.z) < 95,
    )
  )
    w.objectives.powerCorridor = true;
}
export function serializeWorld(w) {
  return {
    schemaVersion: w.schemaVersion,
    id: w.id,
    seed: w.seed,forestLevel:w.forestLevel,
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
