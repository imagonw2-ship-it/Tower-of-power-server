// Adapter into the current game. Offline mechanics remain in game.base.html.
const netUI = {};
for (const id of [
  "multiplayerPanel",
  "serverAddress",
  "saveServer",
  "accountForm",
  "accountUsername",
  "accountPassword",
  "accountCreate",
  "accountLogin",
  "accountGuest",
  "accountLogout",
  "netIdentity",
  "worldMenu",
  "worldLobby",
  "worldHost",
  "worldJoin",
  "joinCode",
  "roomCodeLabel",
  "lobbyPlayers",
  "lobbyEquipment",
  "roundStart",
  "roundResume",
  "worldLeave",
  "multiplayerBack",
  "netMessage",
  "networkStatus",
  "onlineRoster",
  "serverSettings",
  "serverState", "defaultServer", "loginTab", "registerTab",
  "accountFields", "accountHelp", "accountCredentials", "joinForm",
])
  netUI[id] = document.getElementById(id);
let networkBusy = false, accountMode = "login";
let networkPanelOpen = false,
  remoteMesh = null,
  remoteHead = null,
  remoteLimb = null;
const net = new TowerNetwork({
  status: (s) => {
    netUI.networkStatus.textContent = s;
    netUI.networkStatus.hidden = networkPanelOpen || !net.active;
    netUI.serverState.textContent = s;
    netUI.serverState.dataset.state = ["CONNECTED", "SERVER READY"].includes(s)
      ? "ready" : /OFFLINE|LOST/.test(s) ? "offline" : "waiting";
    refreshNetworkButtons();
  },
  identity: () => refreshNetworkUI(),
  error: (message) => (netUI.netMessage.textContent = message),
  joined: () => {
    netUI.netMessage.textContent = "";
    refreshNetworkUI();
  },
  snapshot: (m) => {
    if (m.phase === "playing" && !net.roundStarted) {
      net.roundStarted = true;
      networkPanelOpen = false;
      netUI.multiplayerPanel.hidden = true;
      startGame();
    }
    refreshNetworkUI();
  },
  action: (m, request) => {
    if (!m.ok) {
      game.notice = "ACTION UNAVAILABLE";
      game.noticeTime = 1.4;
      return;
    }
    if (m.action === "photo") takePhoto(true);
    if (m.action === "pickup") {
      const i = net.items.find((i) => i.id === request?.itemId);
      game.notice =
        i?.kind === "flashlight" ? "FLASHLIGHT ACQUIRED" : "SODA ACQUIRED";
      game.noticeTime = 3;
      sound.noise(0.08, 0.3, 1400);
    }
    if (m.action === "soda") {
      game.drinking = 1.1;
      game.notice = "SPEED BOOST / 15 SECONDS";
      game.noticeTime = 2.5;
      sound.noise(0.25, 0.23, 3600, "highpass");
      sound.tone(680, 240, 0.12, 0.06, "triangle");
    }
  },
  events: (events) => {
    for (const e of events) {
      const d = Math.hypot(player.x - e.x, player.z - e.z);
      if (e.kind === "caught") {
        if (e.id === net.player?.id && game.mode !== "lost") {
          sound.caught();
          setMode("lost");
          if (document.pointerLockElement === canvas)
            document.exitPointerLock();
        }
        continue;
      }
      if (d > 250) continue;
      if (e.kind === "powerStep") sound.powerStep(d);
      if (e.kind === "enemyStep") sound.enemyStep(d * 0.42);
      if (e.kind === "powerWake") sound.powerWake(d);
      if (e.kind === "awaken") sound.awaken();
      game.shake = Math.max(game.shake, 0.7 / (1 + d * 0.03));
    }
  },
});
netUI.serverAddress.value = net.url;
function refreshNetworkButtons() {
  const connecting = !!net.socket && !net.connected;
  for (const button of netUI.multiplayerPanel.querySelectorAll("[data-net-action]"))
    button.disabled = networkBusy || connecting;
  for (const id of ["serverAddress", "saveServer", "defaultServer"])
    netUI[id].disabled = networkBusy || net.active || !!net.socket;
}
function applyServerInput() {
  net.setServer(netUI.serverAddress.value);
  netUI.serverAddress.value = net.url;
}
function refreshNetworkUI() {
  netUI.netIdentity.textContent = net.player
    ? net.player.username + (net.player.guest ? " / GUEST" : " / ACCOUNT")
    : "Choose how you want to play.";
  netUI.accountForm.hidden = !!net.player;
  netUI.worldMenu.hidden = !net.player || net.active;
  netUI.worldLobby.hidden = !net.active;
  refreshNetworkButtons();
  const s = net.snapshots.at(-1);
  if (net.active) {
    netUI.roomCodeLabel.textContent = net.code;
    netUI.lobbyPlayers.textContent = (s?.players || [])
      .map(
        (p) =>
          p.username +
          (p.id === s.ownerId ? " · OWNER" : "") +
          (p.connected ? "" : " · RECONNECTING") +
          (p.alive ? "" : " · SIGNAL LOST"),
      )
      .join("\n");
    const c = net.items.reduce(
      (a, i) => ((a[i.kind] = (a[i.kind] || 0) + 1), a),
      {},
    );
    netUI.lobbyEquipment.textContent =
      s?.phase === "lobby"
        ? `${s.players.length}/8 PLAYERS\n${c.flashlight || 0} FLASHLIGHTS · ${c.soda || 0} SODAS\nEquipment scales until the owner starts.`
        : "ROUND IN PROGRESS";
    netUI.roundStart.hidden = s?.phase !== "lobby";
    netUI.roundStart.disabled = s?.ownerId !== net.player?.id;
    netUI.roundResume.hidden = s?.phase !== "playing";
    netUI.onlineRoster.textContent =
      "ROOM " +
      net.code +
      "\n" +
      (s?.players || [])
        .filter((p) => p.id !== net.player?.id)
        .map(
          (p) =>
            p.username +
            (!p.connected ? " · RECONNECTING" : !p.alive ? " · LOST" : ""),
        )
        .join("\n");
  }
  netUI.onlineRoster.hidden =
    !net.active ||
    !["playing", "paused", "fieldPanel", "lost"].includes(game.mode);
  netUI.networkStatus.hidden = networkPanelOpen || !net.active;
}
function openMultiplayer() {
  sound.start();
  networkPanelOpen = true;
  if (game.mode === "playing") setMode("paused");
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  netUI.multiplayerPanel.hidden = false;
  ui.menu.hidden = true;
  ui.pausePanel.hidden = true;
  refreshNetworkUI();
  net.verify().catch((e) => (netUI.netMessage.textContent = e.message));
}
function closeMultiplayer() {
  networkPanelOpen = false;
  netUI.multiplayerPanel.hidden = true;
  syncUI();
  refreshNetworkUI();
}
function leaveMultiplayer() {
  net.leave();
  netUI.onlineRoster.hidden = true;
  closeMultiplayer();
  mainMenu();
}
function guarded(fn) {
  return async (event) => {
    event?.preventDefault();
    if (networkBusy) return;
    networkBusy = true;
    refreshNetworkButtons();
    netUI.netMessage.textContent = "";
    try {
      await fn();
      refreshNetworkUI();
    } catch (e) {
      netUI.netMessage.textContent = e.message;
    } finally {
      networkBusy = false;
      refreshNetworkUI();
    }
  };
}
document
  .getElementById("multiplayerOpen")
  .addEventListener("click", openMultiplayer);
netUI.saveServer.addEventListener(
  "click",
  guarded(async () => {
    applyServerInput();
    await net.checkServer();
    netUI.netMessage.textContent = "Server ready. Choose guest or sign in to play.";
  }),
);
netUI.defaultServer.addEventListener("click", guarded(async () => {
  netUI.serverAddress.value = TowerNetwork.DEFAULT_SERVER;
  applyServerInput();
  await net.checkServer();
  netUI.netMessage.textContent = "Default server ready.";
}));
function selectAccountMode(mode) {
  accountMode = mode;
  const register = mode === "register";
  netUI.loginTab.setAttribute("aria-selected", String(!register));
  netUI.registerTab.setAttribute("aria-selected", String(register));
  netUI.accountFields.setAttribute("aria-labelledby", register ? "registerTab" : "loginTab");
  netUI.accountCreate.hidden = !register;
  netUI.accountLogin.hidden = register;
  netUI.accountPassword.autocomplete = register ? "new-password" : "current-password";
  netUI.accountPassword.placeholder = register ? "At least 12 characters" : "Your password";
  netUI.accountHelp.textContent = register ? "Username: 3–20 letters, numbers or _. Password: 12+ characters." : "Your account works on every device.";
}
netUI.loginTab.addEventListener("click", () => selectAccountMode("login"));
netUI.registerTab.addEventListener("click", () => selectAccountMode("register"));
netUI.accountCredentials.addEventListener("submit", event => {
  event.preventDefault();
  netUI[accountMode === "register" ? "accountCreate" : "accountLogin"].click();
});
netUI.accountCredentials.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.tagName === "INPUT") {
    event.preventDefault();
    netUI[accountMode === "register" ? "accountCreate" : "accountLogin"].click();
  }
});
for (const [kind, id] of [
  ["register", "accountCreate"],
  ["login", "accountLogin"],
  ["guest", "accountGuest"],
])
  netUI[id].addEventListener(
    "click",
    guarded(async () => {
      applyServerInput();
      if (kind !== "guest" && (!netUI.accountUsername.value.trim() || !netUI.accountPassword.value))
        throw Error("Enter your username and password.");
      const password = netUI.accountPassword.value;
      netUI.accountPassword.value = "";
      await net.authenticate(
        kind,
        netUI.accountUsername.value.trim(),
        password,
      );
    }),
  );
netUI.accountLogout.addEventListener(
  "click",
  guarded(() => net.logout()),
);
netUI.worldHost.addEventListener(
  "click",
  guarded(() => { applyServerInput(); net.host(); }),
);
netUI.joinForm.addEventListener(
  "submit",
  guarded(() => { applyServerInput(); net.join(netUI.joinCode.value.trim().toUpperCase()); }),
);
netUI.roundStart.addEventListener("click", () => net.send({ type: "start" }));
netUI.roundResume.addEventListener("click", () => {
  closeMultiplayer();
  if (game.mode === "paused") captureMouse();
});
netUI.worldLeave.addEventListener("click", leaveMultiplayer);
netUI.multiplayerBack.addEventListener("click", closeMultiplayer);
const onlineButton = document.createElement("button");
onlineButton.textContent = "MULTIPLAYER / ROOM";
onlineButton.addEventListener("click", openMultiplayer);
ui.pausePanel.appendChild(onlineButton);
function networkInput() {
  const e =
    game.mode === "playing" &&
    locked &&
    net.connected &&
    !document.hidden &&
    !networkPanelOpen;
  return {
    x: e
      ? clamp(
          (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
            mobileInput.x,
          -1,
          1,
        )
      : 0,
    z: e
      ? clamp(
          (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
            (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
            mobileInput.y,
          -1,
          1,
        )
      : 0,
    yaw: Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)),
    pitch: player.pitch,
    sprint:
      e &&
      (keys.has("ShiftLeft") || keys.has("ShiftRight") || mobileInput.sprint),
    crouch: game.crouching,
  };
}
setInterval(() => {
  if (net.active && net.connected) {
    if (performance.now() - net.lastReceive > 6000) {
      net.socket.close();
      return;
    }
    net.input(networkInput());
  }
}, 50);
function netNearestItem() {
  const items = [];
  for (const i of net.items) {
    if (i.holder || (i.kind === "flashlight" && game.hasFlashlight)) continue;
    const p = [i.x, i.y + (i.kind === "soda" ? 0.1 : 0), i.z],
      delta = p.map((v, k) => v - [player.x, player.y, player.z][k]),
      d = Math.hypot(...delta),
      f = dot(norm(delta), Array.from(forward));
    if (
      d < 2.35 &&
      f > 0.88 &&
      !shedBlocksSight([player.x, player.y, player.z], p)
    )
      items.push({ ...i, p, score: d * 0.015 + (1 - f) * 12 });
  }
  return items.sort((a, b) => a.score - b.score)[0] || null;
}
function snapshotPair() {
  const ss = net.snapshots;
  if (!ss.length) return null;
  const target = performance.now() - 110;
  let a = ss[0],
    b = ss.at(-1);
  for (let i = 1; i < ss.length; i++)
    if (ss[i].received >= target) {
      a = ss[i - 1];
      b = ss[i];
      break;
    } else a = ss[i];
  return {
    a,
    b,
    t: clamp(
      (target - a.received) / Math.max(1, b.received - a.received),
      0,
      1,
    ),
  };
}
function poseBetween(a, b, t) {
  const o = { ...b };
  for (const k of [
    "x",
    "y",
    "z",
    "gait",
    "awake",
    "lift",
    "crouch",
    "lean",
    "bank",
    "bodyDrop",
    "bodyBob",
    "wake",
    "clock",
    "rigBlend",
  ])
    if (Number.isFinite(a[k]) && Number.isFinite(b[k]))
      o[k] = lerp(a[k], b[k], t);
  for (const k of ["heading", "yaw", "angle"])
    if (Number.isFinite(a[k]) && Number.isFinite(b[k]))
      o[k] =
        a[k] + Math.atan2(Math.sin(b[k] - a[k]), Math.cos(b[k] - a[k])) * t;
  if (b.feet)
    o.feet = b.feet.map((f, i) => ({
      ...f,
      position: f.position.map((v, k) =>
        lerp(a.feet?.[i]?.position[k] ?? v, v, t),
      ),
    }));
  return o;
}
function updateNetworkFrame(dt) {
  if (
    !net.active ||
    !net.snapshots.length ||
    isMenuScene() ||
    game.mode === "loading"
  )
    return;
  const latest = net.snapshots.at(-1),
    p = latest.players.find((p) => p.id === net.player.id);
  if (!p) return;
  if (net.connected) {
    const age = clamp((performance.now() - latest.received) / 1000, 0, 0.1),
      x = p.x + p.vx * age,
      z = p.z + p.vz * age,
      d = Math.hypot(player.x - x, player.z - z),
      blend = d > 3 ? 1 : 1 - Math.exp(-12 * dt);
    player.x = lerp(player.x, x, blend);
    player.z = lerp(player.z, z, blend);
  }
  game.hasFlashlight = p.inventory.flashlight;
  game.sodas = p.inventory.sodas;
  game.boostTime = p.boost;
  game.torchOn = p.torch;
  if(p.heldItem&&p.actionSeq>=net.actionSeq)equippedTool=p.heldItem;
  game.sodaTaken = true;
  if (!p.alive && !["lost", "transition"].includes(game.mode)) {
    sound.caught();
    setMode("lost");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  Object.assign(world, {
    phase: latest.world.phase,
    cycle: latest.world.cycle,
    turbineStopped: latest.world.turbineStopped,
    powerStopped: latest.world.powerStopped,
  });
  const q = snapshotPair(),
    e = poseBetween(q.a.enemies.turbine, q.b.enemies.turbine, q.t),
    pw = poseBetween(q.a.enemies.power, q.b.enemies.power, q.t);
  Object.assign(turbine, { x: e.x, y: e.y, z: e.z });
  Object.assign(enemy, e);
  Object.assign(powerCreature, pw);
  updatePylonRig();
  if (enemy.state === "running" || powerCreature.state === "running") {
    const d = Math.min(
      Math.hypot(player.x - turbine.x, player.z - turbine.z),
      Math.hypot(player.x - powerCreature.x, player.z - powerCreature.z),
    );
    game.shake = Math.max(game.shake, 0.25 / (1 + d * 0.025));
  }
  ui.torchControls.hidden = game.mode !== "playing" || !game.hasFlashlight;
  document.getElementById("touchLight").hidden = !game.hasFlashlight;
  if (game.mode === "fieldPanel") syncFieldPanel();
}
function appendNetworkObjects() {
  if (!net.active || isMenuScene()) return;
  for (const i of net.items)
    if (!i.holder)
      objectDraws.push({
        mesh: i.kind === "flashlight" ? flashlightMesh : sodaMesh,
        model:
          i.kind === "flashlight"
            ? multiply(transform(i.x, i.y, i.z), rotateY(-0.35))
            : transform(i.x, i.y, i.z),
        material: 5,
        assetKind: i.kind === "flashlight" ? 1 : 2,
      });
  const q = snapshotPair();
  if (!q) return;
  const present=new Set(q.b.players.map(p=>p.id));for(const id of avatarCache.keys())if(!present.has(id))avatarCache.delete(id);
  for(const cur of q.b.players){
    if(cur.id===net.player.id||!cur.alive)continue;
    const prev=q.a.players.find(p=>p.id===cur.id)||cur,p=poseBetween(prev,cur,q.t);
    appendHazmat(p,net.snapshots.at(-1).world.elapsed);
    if (p.photo > 0 && Math.hypot(p.x - player.x, p.z - player.z) < 35)
      game.flash = Math.max(game.flash, (0.15 * p.photo) / 0.22);
  }
}
refreshNetworkUI();
