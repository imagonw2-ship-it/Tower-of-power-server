import { shed, blocked } from "../shared/physics.js";
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
        y = shed.y + 1.06 + (kind === "flashlight" ? 0.325 : 0);
      world.items.push({
        id: `starter-${kind}-${i}`,
        kind,
        x: kind === "soda" ? x + 0.17 : x,
        y,
        z,
        holder: null,
      });
    }
  world.itemRevision++;
}
export function takeItem(world, p, id) {
  if (!p.alive) return false;
  const item = world.items.find((i) => i.id === id && !i.holder);
  if (!item || (item.kind === "flashlight" && p.inventory.flashlight))
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
    blocked(eye, target)
  )
    return false;
  item.holder = p.id;
  if (item.kind === "flashlight") {
    p.inventory.flashlight = true;
    p.torch = true;
  } else p.inventory.sodas++;
  world.itemRevision++;
  return true;
}
export function releaseItems(world, p) {
  for (const i of world.items)
    if (i.holder === p.id && !i.consumed) {
      i.holder = null;
      world.itemRevision++;
    }
  p.inventory = { flashlight: false, sodas: 0 };
}
