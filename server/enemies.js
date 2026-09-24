// Reuses the current game's awakening, pathfinding, hearing, and foot planting.
import { terrainHeight, shed, clamp } from "../shared/physics.js";
export function createEnemySimulation(world) {
  const lerp = (a, b, t) => a + (b - a) * t,
    ease = (t) => t * t * (3 - 2 * t);
  const POWER_ZONE = { x: -185, z: -270 },
    powerCreature = {},
    enemy = {},
    turbine = { x: 95, z: -250, y: terrainHeight(95, -250) };
  const player = { x: 128, z: -34, y: 1.7 },
    game = { mode: "playing", shake: 0 },
    isMenuScene = () => false;
  const identity = () =>
      new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    pylonBones = new Float32Array(144),
    updatePylonRig = () => {};
  const events = [],
    event = (kind, p) => events.push({ kind, x: p.x, z: p.z });
  const sound = {
    awaken: () => event("awaken", turbine),
    enemyStep: () => event("enemyStep", turbine),
    powerWake: () => event("powerWake", powerCreature),
    powerStep: () => event("powerStep", powerCreature),
  };
  const POWER_RIG = {
    feet: [
      [-15.008241653442383, 0.0, -13.531598567962646],
      [16.8116512298584, 0.0, -12.085808753967285],
      [-15.29408073425293, 0.0, 18.465094566345215],
      [15.616836547851562, 0.0, 19.969297409057617],
    ],
    hips: [
      [-10.21045970916748, 33.0, -7.294733285903931],
      [9.826166152954102, 33.0, -5.4003448486328125],
      [-8.394546031951904, 33.0, 10.25119161605835],
      [8.402820587158203, 33.0, 10.678690910339355],
    ],
    knees: [
      [-12.70530632019043, 15.84, -10.537903232574463],
      [13.458618392944336, 15.84, -8.876786079406738],
      [-11.982304077148438, 15.84, 14.522421150207519],
      [12.15410888671875, 15.84, 15.509806289672852],
    ],
    bottoms: [
      0.0174331646412611, 0.049592941999435425, 0.0, 0.053768374025821686,
    ],
    height: 124.75720977783203,
  };
  function resetPowerCreature() {
    const y = terrainHeight(POWER_ZONE.x, POWER_ZONE.z);
    Object.assign(powerCreature, {
      x: POWER_ZONE.x,
      z: POWER_ZONE.z,
      y,
      heading: 0,
      state: "dormant",
      clock: 0,
      wake: 0,
      rigBlend: 0,
      bodyDrop: 0,
      bodyBob: 0,
      vx: 0,
      vz: 0,
      noise: null,
      lastKnown: [POWER_ZONE.x, POWER_ZONE.z],
      memoryAge: 99,
      navAge: 0,
      navTarget: null,
      stepIndex: 0,
      impact: 0,
      stepRest: 0,
      discovered: false,
    });
    powerCreature.feet = POWER_RIG.feet.map((p) => {
      const at = [
        POWER_ZONE.x + p[0],
        terrainHeight(POWER_ZONE.x + p[0], POWER_ZONE.z + p[2]) + 0.06,
        POWER_ZONE.z + p[2],
      ];
      return {
        position: at.slice(),
        start: at.slice(),
        target: at.slice(),
        progress: 1,
        duration: 0.62,
        lift: 5,
      };
    });
    for (let i = 0; i < 9; i++) pylonBones.set(identity(), i * 16);
  }
  function enterPowerState(state) {
    powerCreature.state = state;
    powerCreature.clock = 0;
    powerCreature.navAge = 0;
  }
  function powerWorldPoint(local) {
    const p = powerCreature,
      c = Math.cos(p.heading),
      s = Math.sin(p.heading);
    return [
      p.x + local[0] * c + local[2] * s,
      p.y + local[1],
      p.z - local[0] * s + local[2] * c,
    ];
  }
  function powerFootTarget(i) {
    const p = powerCreature,
      at = powerWorldPoint(POWER_RIG.feet[i]);
    at[0] += p.vx * 0.62;
    at[2] += p.vz * 0.62;
    const dx = at[0] - shed.x,
      dz = at[2] - shed.z,
      d = Math.hypot(dx, dz);
    if (d < 7) {
      at[0] = shed.x + (d > 0.01 ? dx / d : 1) * 7;
      at[2] = shed.z + (d > 0.01 ? dz / d : 0) * 7;
    }
    at[1] = terrainHeight(at[0], at[2]) + 0.06;
    return at;
  }
  function liftPowerFoot(i, target, duration, lift) {
    const f = powerCreature.feet[i];
    f.start = f.position.slice();
    f.target = target;
    f.progress = 0;
    f.duration = duration;
    f.lift = lift;
  }
  function animatePowerFeet(dt) {
    const p = powerCreature;
    p.stepRest = Math.max(0, p.stepRest - dt);
    p.impact *= Math.exp(-7 * dt);
    let moving = 0;
    for (let i = 0; i < 4; i++) {
      const f = p.feet[i];
      if (f.progress >= 1) continue;
      moving++;
      f.progress = Math.min(1, f.progress + dt / f.duration);
      const t = f.progress,
        s = t * t * t * (t * (t * 6 - 15) + 10);
      f.position = f.start.map((v, k) => lerp(v, f.target[k], s));
      f.position[1] += Math.pow(Math.sin(t * Math.PI), 1.2) * f.lift;
      if (t === 1) {
        const d = Math.hypot(
          player.x - f.position[0],
          player.z - f.position[2],
        );
        sound.powerStep(d);
        p.impact = 1;
        p.stepRest = 0.035;
        game.shake = Math.max(game.shake, 1.4 / (1 + d * 0.035));
      }
    }
    if (p.state === "waking" || moving || p.stepRest > 0) return;
    const order = [0, 3, 1, 2];
    let selected = -1,
      largest = 3.4;
    for (let n = 0; n < 4; n++) {
      const i = order[(p.stepIndex + n) % 4],
        target = powerFootTarget(i),
        f = p.feet[i],
        error = Math.hypot(
          f.position[0] - target[0],
          f.position[2] - target[2],
        );
      if (error > largest) {
        selected = i;
        largest = error;
      }
    }
    if (selected < 0) return;
    const fast = p.state === "running";
    liftPowerFoot(
      selected,
      powerFootTarget(selected),
      fast ? 0.4 : 0.78,
      fast ? 7.0 : 3.8,
    );
    p.stepIndex = (order.indexOf(selected) + 1) % 4;
  }
  function updatePowerCreature(dt) {
    if (game.mode !== "playing" || isMenuScene() || world.powerStopped) return;
    const p = powerCreature,
      distance = Math.hypot(player.x - p.x, player.z - p.z);
    p.memoryAge += dt;
    if (
      !p.discovered &&
      Math.hypot(player.x - POWER_ZONE.x, player.z - POWER_ZONE.z) < 95
    ) {
      p.discovered = true;
      game.notice = "POWER CORRIDOR / KEEP QUIET";
      game.noticeTime = 4;
    }
    if (p.noise) {
      p.lastKnown = p.noise.slice();
      p.noise = null;
      p.memoryAge = 0;
      p.navAge = 0;
      if (p.state === "dormant") {
        enterPowerState("waking");
        p.wake = 0;
        sound.powerWake(distance);
      } else if (p.state !== "waking" && p.state !== "running")
        enterPowerState("running");
    }
    if (p.state === "dormant") return;
    p.clock += dt;
    p.navAge -= dt;
    if (p.state === "waking") {
      const previous = p.wake;
      p.wake += dt;
      p.rigBlend = ease(clamp(p.wake / 1.2, 0, 1));
      p.bodyDrop = -4.2 * ease(clamp(p.wake / 1.6, 0, 1));
      const order = [0, 3, 1, 2];
      for (let n = 0; n < 4; n++) {
        const moment = 0.25 + n * 0.75;
        if (previous < moment && p.wake >= moment) {
          const i = order[n];
          liftPowerFoot(i, p.feet[i].position.slice(), 0.7, 4.5);
        }
      }
      p.y = terrainHeight(p.x, p.z) + p.bodyDrop;
      animatePowerFeet(dt);
      updatePylonRig();
      game.shake = Math.max(game.shake, 0.32 / (1 + distance * 0.02));
      if (p.wake > 3.6) enterPowerState("running");
      return;
    }
    const oldX = p.x,
      oldZ = p.z,
      remaining = Math.hypot(p.x - p.lastKnown[0], p.z - p.lastKnown[1]);
    if (
      p.state === "running" &&
      p.memoryAge > 0.8 &&
      (remaining < 7 || p.clock > 15)
    )
      enterPowerState("searching");
    if (p.state === "searching" && p.clock > 23) enterPowerState("patrolling");
    let goal = p.lastKnown.slice();
    if (p.state === "searching") {
      const n = Math.floor(p.clock / 4.6),
        a = n * 2.4 + 0.7,
        r = 12 + n * 5;
      goal = [
        p.lastKnown[0] + Math.sin(a) * r,
        p.lastKnown[1] + Math.cos(a) * r,
      ];
    }
    if (p.state === "patrolling") {
      const a = Math.floor(p.clock / 16) * 2.4;
      goal = [POWER_ZONE.x + Math.sin(a) * 40, POWER_ZONE.z + Math.cos(a) * 40];
    }
    if (p.navAge <= 0 || !p.navTarget) {
      p.navTarget = routeAroundShed(goal, [p.x, p.z]);
      p.navAge = 0.18;
    }
    const dx = p.navTarget[0] - p.x,
      dz = p.navTarget[1] - p.z,
      navDistance = Math.hypot(dx, dz),
      desired = Math.atan2(dx, dz),
      turn = Math.atan2(
        Math.sin(desired - p.heading),
        Math.cos(desired - p.heading),
      );
    const fast = p.state === "running";
    p.heading += clamp(
      turn,
      -dt * (fast ? 0.74 : 0.42),
      dt * (fast ? 0.74 : 0.42),
    );
    const speed =
        (fast ? 10.7 : p.state === "searching" ? 3.4 : 2.5) *
        Math.max(0.1, Math.cos(turn)) *
        clamp(navDistance / 7, 0, 1),
      accel = 1 - Math.exp(-(fast ? 7 : 4) * dt);
    p.vx += (Math.sin(p.heading) * speed - p.vx) * accel;
    p.vz += (Math.cos(p.heading) * speed - p.vz) * accel;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    // Respect the shed and the other giant, without knowing a silent player's position.
    for (const obstacle of [
      [shed.x, shed.z, 15],
      [turbine.x, turbine.z, enemy.state === "dormant" ? 13 : 25],
    ]) {
      const ox = p.x - obstacle[0],
        oz = p.z - obstacle[1],
        od = Math.hypot(ox, oz);
      if (od < obstacle[2]) {
        p.x = obstacle[0] + (od > 0.01 ? ox / od : 1) * obstacle[2];
        p.z = obstacle[1] + (od > 0.01 ? oz / od : 0) * obstacle[2];
      }
    }
    const travel = Math.hypot(p.x - oldX, p.z - oldZ);
    p.bodyBob += travel * 0.2;
    p.bodyDrop += ((fast ? -4.8 : -3.5) - p.bodyDrop) * (1 - Math.exp(-3 * dt));
    p.y =
      terrainHeight(p.x, p.z) +
      p.bodyDrop +
      Math.sin(p.bodyBob * 2) * 0.38 -
      p.impact * 0.28;
    p.rigBlend = 1;
    animatePowerFeet(dt);
    updatePylonRig();
    if (fast) game.shake = Math.max(game.shake, 0.32 / (1 + distance * 0.023));
  }
  function resetEnemy() {
    Object.assign(enemy, {
      state: "dormant",
      angle: 0.22,
      awake: 0,
      emerged: [false, false, false],
      lift: 0,
      vx: 0,
      vz: 0,
      heading: 0,
      gait: 0,
      feet: [],
      clock: 0,
      crouch: 0,
      lean: 0,
      bank: 0,
      anchor: [turbine.x, turbine.y, turbine.z],
      lastKnown: [turbine.x, turbine.z],
      memoryAge: 99,
      noise: null,
      heardRecently: false,
      searchIndex: 0,
      navAge: 0,
      navTarget: null,
      stepRest: 0,
      stepIndex: 0,
      impact: 0,
    });
  }
  function enterEnemyState(state) {
    enemy.state = state;
    enemy.clock = 0;
    enemy.navAge = 0;
  }
  function segmentBox(a, b, min, max) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 3; i++) {
      const d = b[i] - a[i];
      if (Math.abs(d) < 1e-6) {
        if (a[i] < min[i] || a[i] > max[i]) return false;
        continue;
      }
      let t0 = (min[i] - a[i]) / d,
        t1 = (max[i] - a[i]) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return false;
    }
    return hi > 0.001 && lo < 0.999;
  }
  function shedBlocksSight(a, b) {
    const walls = [
      [-3.1, -2.85, -2.8, 2.8],
      [2.85, 3.1, -2.8, 2.8],
      [-3.1, 3.1, -2.8, -2.52],
      [-3.1, -0.9, 2.52, 2.8],
      [0.9, 3.1, 2.52, 2.8],
    ];
    for (const w of walls)
      if (
        segmentBox(
          a,
          b,
          [shed.x + w[0], shed.y, shed.z + w[2]],
          [shed.x + w[1], shed.y + 3.2, shed.z + w[3]],
        )
      )
        return true;
    return segmentBox(
      a,
      b,
      [shed.x - 3.35, shed.y + 3.2, shed.z - 2.95],
      [shed.x + 3.35, shed.y + 4.15, shed.z + 2.95],
    );
  }
  function emitNoise(radius) {
    if (game.mode !== "playing") return;
    game.noisePulse = 1;
    game.lastNoiseRadius = radius;
    if (!world.powerStopped) {
      const p = powerCreature,
        d = Math.hypot(player.x - p.x, player.z - p.z),
        blocked = shedBlocksSight(
          [p.x, terrainHeight(p.x, p.z) + 1.6, p.z],
          [player.x, player.y, player.z],
        );
      if (d < radius * (blocked ? 0.6 : 1) * (p.state === "dormant" ? 1.5 : 1))
        p.noise = [player.x, player.z];
    }
    if (world.turbineStopped) return;
    const origin = [player.x, player.z],
      d = Math.hypot(origin[0] - turbine.x, origin[1] - turbine.z);
    // Walls soften sound. Light, camera direction and player visibility are never queried.
    const blocked = shedBlocksSight(
      [turbine.x, terrainHeight(turbine.x, turbine.z) + 1.6, turbine.z],
      [player.x, player.y, player.z],
    );
    const audibleRange =
      radius * (blocked ? 0.6 : 1) * (enemy.state === "dormant" ? 1.8 : 1);
    if (d < audibleRange) enemy.noise = { position: origin, life: 0.3 };
  }
  function sensePlayer(dt) {
    enemy.memoryAge += dt;
    enemy.heardRecently = enemy.memoryAge < 0.9;
    if (!enemy.noise) return;
    const noise = enemy.noise;
    enemy.noise = null;
    if (noise.life <= 0) return;
    enemy.lastKnown = noise.position.slice();
    enemy.memoryAge = 0;
    enemy.heardRecently = true;
    enemy.navAge = 0;
    if (enemy.state === "dormant") {
      enterEnemyState("awakening");
      enemy.awake = 0;
      enemy.heading = Math.atan2(
        noise.position[0] - turbine.x,
        noise.position[1] - turbine.z,
      );
      sound.awaken();
      game.shake = 0.85;
    } else if (enemy.state !== "awakening" && enemy.state !== "running")
      enterEnemyState("running");
  }
  function circleBlocks(a, b, radius = 13.4) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = dx * dx + dz * dz;
    const t = clamp(
      ((shed.x - a[0]) * dx + (shed.z - a[1]) * dz) / (l || 1),
      0,
      1,
    );
    return Math.hypot(a[0] + dx * t - shed.x, a[1] + dz * t - shed.z) < radius;
  }
  function routeAroundShed(target, start = [turbine.x, turbine.z]) {
    const goal = target.slice(),
      gd = Math.hypot(goal[0] - shed.x, goal[1] - shed.z);
    if (gd < 14.4) {
      const a = gd > 0.1 ? Math.atan2(goal[0] - shed.x, goal[1] - shed.z) : 0;
      goal[0] = shed.x + Math.sin(a) * 14.4;
      goal[1] = shed.z + Math.cos(a) * 14.4;
    }
    if (!circleBlocks(start, goal)) return goal;
    // Visibility graph around the shed. A short route avoids wall-pushing and orbit jitter.
    const nodes = [start, goal];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      nodes.push([shed.x + Math.sin(a) * 16, shed.z + Math.cos(a) * 16]);
    }
    const costs = nodes.map(() => Infinity),
      previous = nodes.map(() => -1),
      done = new Set();
    costs[0] = 0;
    for (let step = 0; step < nodes.length; step++) {
      let n = -1;
      for (let i = 0; i < nodes.length; i++)
        if (!done.has(i) && (n < 0 || costs[i] < costs[n])) n = i;
      if (n < 0 || !Number.isFinite(costs[n]) || n === 1) break;
      done.add(n);
      for (let i = 1; i < nodes.length; i++)
        if (!done.has(i) && !circleBlocks(nodes[n], nodes[i])) {
          const cost =
            costs[n] +
            Math.hypot(nodes[i][0] - nodes[n][0], nodes[i][1] - nodes[n][1]);
          if (cost < costs[i]) {
            costs[i] = cost;
            previous[i] = n;
          }
        }
    }
    if (previous[1] < 0) return start;
    let n = 1;
    while (previous[n] > 0) n = previous[n];
    return nodes[n];
  }
  function idealFoot(index, lead = 0) {
    const a = enemy.heading + (index * Math.PI * 2) / 3,
      radius = 53 + enemy.crouch * 9;
    let x = turbine.x + Math.sin(a) * radius + enemy.vx * lead,
      z = turbine.z + Math.cos(a) * radius + enemy.vz * lead;
    const dx = x - shed.x,
      dz = z - shed.z,
      d = Math.hypot(dx, dz);
    if (d < 8) {
      x = shed.x + (d > 0.01 ? dx / d : 1) * 8;
      z = shed.z + (d > 0.01 ? dz / d : 0) * 8;
    }
    return [x, terrainHeight(x, z) + 0.1, z];
  }
  function plantFeet() {
    enemy.feet = [0, 1, 2].map((i) => {
      const p = idealFoot(i);
      return {
        position: p.slice(),
        start: p.slice(),
        target: p.slice(),
        progress: 1,
        duration: 0.76,
        height: 7,
      };
    });
  }
  function animateFeet(dt) {
    enemy.stepRest = Math.max(0, enemy.stepRest - dt);
    enemy.impact *= Math.exp(-6 * dt);
    let swinging = false;
    for (const foot of enemy.feet) {
      if (foot.progress >= 1) continue;
      swinging = true;
      foot.progress = Math.min(1, foot.progress + dt / foot.duration);
      const t = foot.progress,
        s = t * t * t * (t * (t * 6 - 15) + 10);
      foot.position = foot.start.map((v, i) => lerp(v, foot.target[i], s));
      foot.position[1] += Math.pow(Math.sin(t * Math.PI), 1.35) * foot.height;
      if (t === 1) {
        const d = Math.hypot(
          foot.position[0] - player.x,
          foot.position[2] - player.z,
        );
        sound.enemyStep(d * 0.42);
        game.shake = Math.max(game.shake, 1.55 / (1 + d * 0.022));
        enemy.impact = 1;
        enemy.stepRest = enemy.state === "running" ? 0.025 : 0.12;
      }
    }
    if (swinging || enemy.stepRest > 0) return;
    let selected = -1,
      error = 3.6;
    for (let n = 0; n < 3; n++) {
      const i = (enemy.stepIndex + n) % 3,
        target = idealFoot(i, enemy.state === "running" ? 0.56 : 0.72),
        foot = enemy.feet[i];
      const drift = Math.hypot(
        foot.position[0] - target[0],
        foot.position[2] - target[2],
      );
      if (drift > error) {
        error = drift;
        selected = i;
      }
    }
    if (selected < 0) return;
    const foot = enemy.feet[selected];
    foot.start = foot.position.slice();
    foot.target = idealFoot(selected, enemy.state === "running" ? 0.56 : 0.72);
    foot.duration = enemy.state === "running" ? 0.43 : 0.76;
    foot.height = enemy.state === "running" ? 12 : 7;
    foot.progress = 0;
    enemy.stepIndex = (selected + 1) % 3;
  }
  function updateEnemy(dt) {
    if (world.turbineStopped) return;
    if (isMenuScene()) {
      enemy.angle += dt * 0.24;
      return;
    }
    if (game.mode !== "playing") return;
    const distance = Math.hypot(player.x - turbine.x, player.z - turbine.z);
    sensePlayer(dt);
    if (enemy.state === "dormant") {
      enemy.angle += dt * 0.26;
      return;
    }
    if (enemy.state === "awakening") {
      enemy.awake += dt;
      for (let i = 0; i < 3; i++)
        if (emergenceProgress(i) >= 1 && !enemy.emerged[i]) {
          enemy.emerged[i] = true;
          const foot = idealFoot(i),
            d = Math.hypot(foot[0] - player.x, foot[2] - player.z);
          sound.enemyStep(d * 0.35);
          game.shake = Math.max(game.shake, 1.1 / (1 + d * 0.014));
        }
      const rise = ease(clamp((enemy.awake - 4.4) / 3.4, 0, 1));
      enemy.lift = 38 * rise;
      turbine.y = terrainHeight(turbine.x, turbine.z) + enemy.lift;
      const rumble = enemy.awake < 4.4 ? 0.32 : 0.55 * Math.sin(rise * Math.PI);
      game.shake = Math.max(game.shake, rumble / (1 + distance * 0.007));
      if (enemy.awake >= 7.8) {
        enterEnemyState("running");
        enemy.gait = 0;
        plantFeet();
      } else return;
    }
    enemy.clock += dt;
    enemy.navAge -= dt;
    const memoryDistance = Math.hypot(
      turbine.x - enemy.lastKnown[0],
      turbine.z - enemy.lastKnown[1],
    );
    // It runs directly to the last sound, then searches that area. Silence never updates its target.
    if (
      enemy.state === "running" &&
      enemy.memoryAge > 0.7 &&
      (memoryDistance < 7.5 || enemy.clock > 13)
    ) {
      enterEnemyState("searching");
      enemy.searchIndex = 0;
    }
    if (enemy.state === "searching" && enemy.clock > 21)
      enterEnemyState("patrolling");
    let goal = enemy.lastKnown.slice();
    if (enemy.state === "searching") {
      const phase = Math.floor(enemy.clock / 4.2),
        a = phase * 2.399 + 1.2,
        r = 9 + phase * 4;
      goal = [
        enemy.lastKnown[0] + Math.sin(a) * r,
        enemy.lastKnown[1] + Math.cos(a) * r,
      ];
    } else if (enemy.state === "patrolling") {
      const phase = Math.floor(enemy.clock / 15),
        a = phase * 2.399,
        r = 32;
      goal = [
        enemy.anchor[0] + Math.sin(a) * r,
        enemy.anchor[2] + Math.cos(a) * r,
      ];
    }
    // A shallow running posture starts while moving; there is no charge preparation state.
    const runningNow = enemy.state === "running";
    enemy.crouch +=
      ((runningNow ? 0.12 : enemy.state === "searching" ? 0.2 : 0) -
        enemy.crouch) *
      (1 - Math.exp(-3.4 * dt));
    if (enemy.navAge <= 0 || !enemy.navTarget) {
      enemy.navTarget = routeAroundShed(goal);
      enemy.navAge = 0.18;
    }
    const desired = Math.atan2(
      enemy.navTarget[0] - turbine.x,
      enemy.navTarget[1] - turbine.z,
    );
    const turn = Math.atan2(
      Math.sin(desired - enemy.heading),
      Math.cos(desired - enemy.heading),
    );
    const rotation = clamp(
      turn,
      -(runningNow ? 0.95 : 0.48) * dt,
      (runningNow ? 0.95 : 0.48) * dt,
    );
    enemy.heading += rotation;
    const navDistance = Math.hypot(
      enemy.navTarget[0] - turbine.x,
      enemy.navTarget[1] - turbine.z,
    );
    const speed = runningNow ? 11.4 : enemy.state === "searching" ? 3.6 : 2.4;
    const alignment = Math.max(0.08, Math.cos(turn)),
      stop = clamp(navDistance / (runningNow ? 6 : 4), 0, 1),
      acceleration = runningNow ? 9 : 4.5;
    enemy.vx +=
      (Math.sin(enemy.heading) * speed * alignment * stop - enemy.vx) *
      (1 - Math.exp(-acceleration * dt));
    enemy.vz +=
      (Math.cos(enemy.heading) * speed * alignment * stop - enemy.vz) *
      (1 - Math.exp(-acceleration * dt));
    turbine.x += enemy.vx * dt;
    turbine.z += enemy.vz * dt;
    const sx = turbine.x - shed.x,
      sz = turbine.z - shed.z,
      sd = Math.hypot(sx, sz);
    if (sd < 13.5) {
      turbine.x = shed.x + (sd > 0.01 ? sx / sd : 1) * 13.5;
      turbine.z = shed.z + (sd > 0.01 ? sz / sd : 0) * 13.5;
    }
    const actualSpeed = Math.hypot(enemy.vx, enemy.vz);
    enemy.gait += dt * actualSpeed * 0.14;
    animateFeet(dt);
    enemy.lean +=
      ((runningNow ? 0.105 : 0.012) - enemy.lean) * (1 - Math.exp(-4 * dt));
    enemy.bank +=
      ((-rotation / Math.max(dt, 0.001)) * 0.065 - enemy.bank) *
      (1 - Math.exp(-2 * dt));
    const lift =
      38 -
      enemy.crouch * 21 +
      Math.sin(enemy.gait * 2) * 0.5 -
      enemy.impact * 0.38;
    enemy.lift += (lift - enemy.lift) * (1 - Math.exp(-5 * dt));
    turbine.y = terrainHeight(turbine.x, turbine.z) + enemy.lift;
    if (actualSpeed > 6)
      game.shake = Math.max(game.shake, 0.27 / (1 + distance * 0.025));
  }
  function emergenceProgress(index) {
    return clamp((enemy.awake - (0.65 + index * 0.55)) / 2.6, 0, 1);
  }
  resetEnemy();
  resetPowerCreature();
  return {
    enemy,
    turbine,
    powerCreature,
    events,
    noise(p, radius) {
      Object.assign(player, p);
      emitNoise(radius);
    },
    step(dt, players) {
      const alive = players.filter((p) => p.alive);
      if (alive.length) Object.assign(player, alive[0]);
      else Object.assign(player, { x: 9999, y: 0, z: 9999 });
      updateEnemy(dt);
      updatePowerCreature(dt);
      for (const p of alive)
        for (const a of [{ ...turbine, state: enemy.state }, powerCreature])
          if (
            ["running", "searching", "patrolling"].includes(a.state) &&
            Math.hypot(p.x - a.x, p.z - a.z) < 7.2 &&
            !shedBlocksSight(
              [a.x, terrainHeight(a.x, a.z) + 2, a.z],
              [p.x, p.y, p.z],
            )
          ) {
            p.alive = false;
            p.health = 0;
            p.input.x = p.input.z = 0;
            events.push({ kind: "caught", id: p.id, x: p.x, z: p.z });
          }
    },
    snapshot() {
      const select = (o, keys) =>
        Object.fromEntries(keys.map((k) => [k, o[k]]));
      return {
        turbine: {
          ...select(turbine, ["x", "y", "z"]),
          ...select(enemy, [
            "state",
            "angle",
            "awake",
            "lift",
            "heading",
            "gait",
            "crouch",
            "lean",
            "bank",
            "anchor",
            "vx",
            "vz",
          ]),
          feet: enemy.feet.map((f) => ({
            position: f.position,
            progress: f.progress,
          })),
        },
        power: {
          ...select(powerCreature, [
            "x",
            "y",
            "z",
            "heading",
            "state",
            "clock",
            "wake",
            "rigBlend",
            "bodyDrop",
            "bodyBob",
            "vx",
            "vz",
          ]),
          feet: powerCreature.feet.map((f) => ({
            position: f.position,
            progress: f.progress,
          })),
        },
      };
    },
  };
}
