// Rendering-independent world rules, copied from the current game.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rawHeight = (x, z) =>
  0.68 * Math.sin(x * 0.042) * Math.cos(z * 0.038) +
  0.4 * Math.sin(x * 0.083 + z * 0.035) +
  0.2 * Math.cos(z * 0.107 - x * 0.031);
export function terrainHeight(x, z) {
  const d = Math.max(Math.abs(x + 185), Math.abs(z + 270)),
    t = clamp((d - 34) / 5, 0, 1);
  return (
    0.18 * (1 - t * t * (3 - 2 * t)) + rawHeight(x, z) * t * t * (3 - 2 * t)
  );
}
export const shed = {
  x: 134,
  z: -43,
  y:
    Math.max(
      ...[-3, 3].flatMap((x) =>
        [-2.8, 2.8].map((z) => terrainHeight(134 + x, -43 + z)),
      ),
    ) + 0.02,
};
export const walls = [
  [-3.08, -2.85, -2.8, 2.8],
  [2.85, 3.08, -2.8, 2.8],
  [-3.08, 3.08, -2.8, -2.52],
  [-3.08, -0.9, 2.52, 2.8],
  [0.9, 3.08, 2.52, 2.8],
  [-2.5, -0.44, -0.19, 0.79],
  [1.36, 2.6, -2.45, -1.32],
  [1.13, 1.92, 3.06, 4.25],
];
export function collideShed(p) {
  const r = 0.29;
  for (const a of walls) {
    const b = [a[0] + shed.x, a[1] + shed.x, a[2] + shed.z, a[3] + shed.z],
      nx = clamp(p.x, b[0], b[1]),
      nz = clamp(p.z, b[2], b[3]),
      dx = p.x - nx,
      dz = p.z - nz,
      d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d > 0.0001) {
      p.x = nx + (dx / d) * r;
      p.z = nz + (dz / d) * r;
    } else {
      const ds = [p.x - b[0], b[1] - p.x, p.z - b[2], b[3] - p.z],
        s = ds.indexOf(Math.min(...ds));
      if (s === 0) p.x = b[0] - r;
      else if (s === 1) p.x = b[1] + r;
      else if (s === 2) p.z = b[2] - r;
      else p.z = b[3] + r;
    }
  }
}
export function floorHeight(x, z) {
  return Math.abs(x - shed.x) < 3.05 && Math.abs(z - shed.z) < 2.8
    ? Math.max(terrainHeight(x, z), shed.y + 0.2)
    : terrainHeight(x, z);
}
export function blocked(a, b) {
  for (const w of walls.slice(0, 5)) {
    let lo = 0,
      hi = 1;
    const min = [shed.x + w[0], shed.y, shed.z + w[2]],
      max = [shed.x + w[1], shed.y + 3.2, shed.z + w[3]];
    for (let i = 0; i < 3; i++) {
      const d = b[i] - a[i];
      if (Math.abs(d) < 1e-6) {
        if (a[i] < min[i] || a[i] > max[i]) {
          hi = -1;
          break;
        }
      } else {
        let x = (min[i] - a[i]) / d,
          y = (max[i] - a[i]) / d;
        if (x > y) [x, y] = [y, x];
        lo = Math.max(lo, x);
        hi = Math.min(hi, y);
      }
    }
    if (hi >= lo && hi > 0.001 && lo < 0.999) return true;
  }
  return false;
}
export function movePlayer(p, input, dt, obstacles = []) {
  const oldX = p.x,
    oldZ = p.z;
  let x = clamp(input.x || 0, -1, 1),
    z = clamp(input.z || 0, -1, 1),
    l = Math.hypot(x, z);
  if (l > 1) {
    x /= l;
    z /= l;
  }
  p.crouching = !!input.crouch;
  p.sprinting = !!input.sprint && !p.crouching && l > 0.05;
  p.yaw = input.yaw;
  p.pitch = input.pitch;
  const speed =
    (p.crouching ? 1.35 : p.sprinting ? 6.6 : 3) * (p.boost > 0 ? 1.4 : 1);
  p.x += (x * Math.cos(p.yaw) - z * Math.sin(p.yaw)) * speed * dt;
  p.z += (-x * Math.sin(p.yaw) - z * Math.cos(p.yaw)) * speed * dt;
  collideShed(p);
  for (const o of obstacles) {
    const dx = p.x - o.x,
      dz = p.z - o.z,
      d = Math.hypot(dx, dz);
    if (d < o.r) {
      p.x = o.x + (d > 0.001 ? dx / d : 1) * o.r;
      p.z = o.z + (d > 0.001 ? dz / d : 0) * o.r;
    }
  }
  p.x = clamp(p.x, -1500, 1500);
  p.z = clamp(p.z, -1500, 1500);
  p.y = floorHeight(p.x, p.z) + (p.crouching ? 0.72 : 1.7);
  p.vx = (p.x - oldX) / dt;
  p.vz = (p.z - oldZ) / dt;
  return Math.hypot(p.x - oldX, p.z - oldZ);
}
export const roadX = (z) =>
  119 + 12 * Math.sin((z + 42) * 0.007) + 4 * Math.sin((z + 42) * 0.018);
export function roadOffset(x, z) {
  const s =
    0.084 * Math.cos((z + 42) * 0.007) + 0.072 * Math.cos((z + 42) * 0.018);
  return (x - roadX(z)) / Math.sqrt(1 + s * s);
}
export function grassCover(x, z) {
  const ax = roadX(-110),
    dx = -185 - ax,
    dz = -160,
    t = clamp(((x - ax) * dx + (z + 110) * dz) / (dx * dx + dz * dz), 0, 1);
  return (
    Math.abs(roadOffset(x, z)) >= 4.8 &&
    Math.hypot(x - ax - dx * t, z + 110 - dz * t) >= 5.1 &&
    Math.max(Math.abs(x + 185), Math.abs(z + 270)) >= 39 &&
    Math.hypot(x - 95, z + 250) >= 11.2 &&
    !(Math.abs(x - shed.x) < 4.1 && Math.abs(z - shed.z) < 4)
  );
}
export const footstepRadius = (p) =>
  p.crouching
    ? grassCover(p.x, p.z)
      ? 4.5
      : Math.abs(roadOffset(p.x, p.z)) < 3.2
        ? 16
        : 9
    : (p.sprinting ? 104 : 43) *
      (Math.abs(roadOffset(p.x, p.z)) < 3.2 ? 1.35 : 1);
