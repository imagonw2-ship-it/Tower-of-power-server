import { movePlayer, floorHeight, footstepRadius } from "../shared/physics.js";
export function makePlayer(account, index) {
  const x = 128 + (index % 4) * 0.75,
    z = -34 + Math.floor(index / 4) * 1.1;
  return {
    ...account,
    x,
    z,
    y: floorHeight(x, z) + 1.7,
    yaw: 0,
    pitch: 0,
    vx: 0,
    vz: 0,
    crouching: false,
    sprinting: false,
    alive: true,
    health: 1,
    inventory: { flashlight: false, sodas: 0 },
    torch: false,
    boost: 0,
    drinking: 0,
    photo: 0,
    cooldown: 0,
    steps: 0,
    seq: 0,
    lastInput: 0,
    actionSeq: 0,
    connected: true,
    disconnectedAt: 0,
    input: { x: 0, z: 0, yaw: 0, pitch: 0, crouch: false, sprint: false },
  };
}
export function acceptInput(p, m, now) {
  if (!Number.isSafeInteger(m.seq) || m.seq <= p.seq || m.seq > p.seq + 100000)
    return false;
  if (
    ![m.x, m.z, m.yaw, m.pitch].every(Number.isFinite) ||
    Math.abs(m.x) > 1 ||
    Math.abs(m.z) > 1 ||
    Math.abs(m.yaw) > 1e6 ||
    Math.abs(m.pitch) > 1.49
  )
    return false;
  p.seq = m.seq;
  p.lastInput = now;
  p.input = {
    x: m.x,
    z: m.z,
    yaw: m.yaw,
    pitch: m.pitch,
    crouch: !!m.crouch,
    sprint: !!m.sprint,
  };
  return true;
}
export function tickPlayer(p, dt, world, now) {
  p.boost = Math.max(0, p.boost - dt);
  p.drinking = Math.max(0, p.drinking - dt);
  p.photo = Math.max(0, p.photo - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (!p.alive || !p.connected || now - p.lastInput > 350) {
    p.input.x = p.input.z = 0;
    p.sprinting = false;
    p.vx = p.vz = 0;
    return;
  }
  const obstacles = [];
  if (world.sim.enemy.state === "dormant")
    obstacles.push({ x: world.sim.turbine.x, z: world.sim.turbine.z, r: 8.1 });
  if (world.sim.powerCreature.state === "dormant")
    for (const f of world.sim.powerCreature.feet)
      obstacles.push({ x: f.position[0], z: f.position[2], r: 1.4 });
  const distance = movePlayer(p, p.input, dt, obstacles);
  if (distance > 0.001) {
    if (p.steps <= 0) world.sim.noise(p, footstepRadius(p));
    p.steps += distance;
    if (p.steps > (p.sprinting ? 2.05 : 1.45)) p.steps = 0;
  } else p.steps = 0;
}
export function wirePlayer(p) {
  return {
    id: p.id,
    username: p.username,
    guest: p.guest || false,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    vx: p.vx,
    vz: p.vz,
    crouching: p.crouching,
    sprinting: p.sprinting,
    alive: p.alive,
    connected: p.connected,
    inventory: p.inventory,
    torch: p.torch,
    boost: p.boost,
    drinking: p.drinking,
    photo: p.photo,
    seq: p.seq,
    actionSeq: p.actionSeq,
  };
}
