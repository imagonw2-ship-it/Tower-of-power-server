import {sameBiome,biomeOf,forestTerrainHeight} from '../shared/forest-level.js';
import { shed, blocked, floorHeight, terrainHeight } from "../shared/physics.js";
import { droppedItemPose } from '../shared/dropped-items.js';
export const starterCount = (rule, count) =>
  Math.max(
    rule.minimum || 0,
    Math.ceil((rule.base || 0) + (rule.perPlayer || 0) * count),
  );
export function scaleItems(world, count, rules) {
  world.items = [];
  for (const [kind, rule] of Object.entries(rules))
    for (let i = 0; i < starterCount(rule, count); i++) {
      const x = shed.x - 2.28 + (i % 4) * 0.43,
        z =
          shed.z + 0.02 + Math.floor(i / 4) * 0.3 + (kind === "soda" ? 0.1 : 0),
        y = shed.y + 1.06 + (kind === "flashlight" ? 0.0542 : kind === "flare" ? .031 : 0);
      world.items.push({
        id: `starter-${kind}-${i}`,
        kind,
        x: kind === "flare" ? shed.x+1.8+(i%2)*.38 : kind === "soda" ? x + 0.17 : x,
        y,
        z: kind === "flare" ? shed.z-.85+Math.floor(i/2)*.2 : z,
        holder: null,
      });
    }
  world.itemRevision++;
}
export function takeItem(world, p, id) {
  if (!p.alive) return false;
  const item = world.items.find((i) => i.id === id && !i.holder);
  if (!item || !sameBiome(item,p) || item.consumed || ((item.kind === "camera" && p.inventory.camera!==false)||(item.kind === "flashlight" && p.inventory.flashlight)||(item.kind === "flare"&&p.inventory.flare)))
    return false;
  const eye = [p.x, p.y, p.z],
    target = [item.x, item.y + (item.kind === "soda" ? 0.1 : 0), item.z],
    d = Math.hypot(...target.map((v, i) => v - eye[i])),
    dir = [
      -Math.sin(p.yaw) * Math.cos(p.pitch),
      Math.sin(p.pitch),
      -Math.cos(p.yaw) * Math.cos(p.pitch),
    ];
  if (
    d > 2.35 ||
    target.reduce(
      (s, v, i) => s + ((v - eye[i]) * dir[i]) / Math.max(d, 0.001),
      0,
    ) < 0.82 ||
    biomeOf(p)==='meadow'&&blocked(eye, target)
  )
    return false;
  item.holder = p.id;
  if(item.kind==='camera')p.inventory.camera=true;
  else if (item.kind === "flashlight") {
    p.inventory.flashlight = true;
    p.torch = true;
  } else if(item.kind === "flare"){p.inventory.flare=true;p.inventory.flares=item.ammo??3;} else p.inventory.sodas++;
  world.itemRevision++;
  return true;
}
export function dropItem(world,p,kind){
  if(!p.alive||p.drinking>0||kind!==p.heldItem||!['camera','flashlight','soda','flare'].includes(kind))return false;
  const owns=kind==='camera'?p.inventory.camera!==false:kind==='soda'?p.inventory.sodas>0:p.inventory[kind];if(!owns)return false;
  let item=world.items.find(i=>i.kind===kind&&i.holder===p.id&&!i.consumed);
  if(!item&&kind==='camera'){if(world.items.length>=512)return false;world.itemSerial=(world.itemSerial||0)+1;item={id:'camera-'+world.itemSerial,kind,holder:p.id};world.items.push(item);}
  if(!item)return false;
  if(kind==='flare'){item.ammo=p.inventory.flares;p.inventory.flares=0;}if(kind==='soda')p.inventory.sodas--;else p.inventory[kind]=false;
  Object.assign(item,droppedItemPose(p,kind,world.elapsed,biomeOf(p)==='forest'?forestTerrainHeight:floorHeight,biomeOf(p)==='forest'?()=>false:blocked,biomeOf(p)==='forest'?null:shed,terrainHeight),{holder:null,biome:biomeOf(p)});p.heldItem='none';p.torch=false;world.itemRevision++;return true;
}
export function releaseItems(world, p) {
  for (const i of world.items)
    if (i.holder === p.id && !i.consumed) {
      Object.assign(i,droppedItemPose(p,i.kind,world.elapsed,biomeOf(p)==='forest'?forestTerrainHeight:floorHeight,biomeOf(p)==='forest'?()=>false:blocked,biomeOf(p)==='forest'?null:shed,terrainHeight),{holder:null,biome:biomeOf(p)});
      world.itemRevision++;
    }
  p.inventory = { camera:false, flashlight: false, sodas: 0, flare: false, flares: 0 };
}
