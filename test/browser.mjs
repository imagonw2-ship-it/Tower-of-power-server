// Two isolated browser devices against a real local server. For slow software
// GPUs only, render on demand and run the game at a controlled 20 Hz.
import { chromium as playwright } from "playwright";
import chromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../server/server.js";
const dir = mkdtempSync(join(tmpdir(), "tower-browser-"));
const app = createApp({ dbPath: join(dir, "accounts.sqlite"), authRate: 100 });
const a = await app.listen(0, "127.0.0.1"),
  origin = `http://127.0.0.1:${a.port}`;
const browser = await playwright.launch({
  executablePath:
    process.env.CHROMIUM_PATH || resolve("../qa/browser/chromium"),
  headless: true,
  args: [
    ...chromium.args.filter((s) => !s.startsWith("--use-")),
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
  ],
});
const errors = [];
mkdirSync("test/results", { recursive: true });
async function openDevice(userAgent) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem(
      "tower-of-power-settings",
      JSON.stringify({
        quality: "low",
        shadows: "off",
        vhs: 0.5,
        bloom: false,
      }),
    );
  });
  await page.goto(origin, { waitUntil: "load" });
  assert.equal(await page.evaluate(() => running), true);
  await page.evaluate(() => {
    settings.shadows = "off";
    resolutionScale = 0.6;
    grassRings = [[0.55, 30, 0, 20, 0]];
    resize();
    frame(16);
    window.qaClock = setInterval(() => {
      updateGame(0.05);
      updateNetworkFrame(0.05);
      updateEnvironment(0.05);
      updateSurvival(0.05);
      updateCamera(0.05);
      updateEnemy(0.05);
      updatePowerCreature(0.05);
      updateEquipment(0.05);
    }, 50);
  });
  return page;
}
const wait = (page, fn, arg) =>
  page.waitForFunction(fn, arg, { polling: 50, timeout: 15000 });
try {
  const phone = await openDevice(
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36",
  );
  await phone.screenshot({ path: "test/results/menu.png" });
  await phone.locator("#play").click();
  await wait(phone, () => game.mode === "playing");
  assert.equal(await phone.evaluate(() => touchMode && locked), true);
  assert.equal(await phone.locator("#touchControls").isVisible(), true);
  await phone.evaluate(() => {
    keys.add("KeyW");
  });
  const z = await phone.evaluate(() => player.z);
  await phone.waitForTimeout(250);
  await phone.evaluate(() => keys.clear());
  assert.ok(await phone.evaluate((z) => player.z < z - 0.25, z));
  console.log("PASS singleplayer starts; touch UI and movement work");
  // Keep gameplay fixtures separate from the networking checks below.
  const offline = await phone.evaluate(() => {
    const before = world.phase;
    world.cycle = true;
    updateSurvival(1);
    updateEnvironment(1);
    game.hasFlashlight = true;
    game.torchOn = true;
    takePhoto();
    const photo = game.flash > 0 || game.photoPending || game.photoCooldown > 0;
    game.sodas = 1;
    drinkSoda();
    const soda = game.boostTime > 0 || game.drinking > 0;
    game.crouching = true;
    updateCamera(0.1);
    const models =
      !!flashlightMesh && !!sodaMesh && powerCreature.feet.length === 4;
    return { photo, soda, models, day: world.phase !== before };
  });
  assert.equal(offline.photo, true);
  assert.equal(offline.soda, true);
  assert.equal(offline.models, true);
  assert.equal(offline.day, true);
  await phone.evaluate(() => mainMenu());
  await phone.locator("#multiplayerOpen").click();
  await phone.locator("#accountGuest").click();
  await wait(phone, () => !!net.player);
  await phone.locator("#worldHost").click();
  await wait(phone, () => !!net.code);
  const code = await phone.evaluate(() => net.code);
  const tablet = await openDevice(
    "Mozilla/5.0 (X11; CrOS x86_64 15662.0.0) AppleWebKit/537.36 Chrome/143.0 Safari/537.36",
  );
  await tablet.locator("#multiplayerOpen").click();
  await tablet.locator("#accountGuest").click();
  await wait(tablet, () => !!net.player);
  await tablet.locator("#joinCode").fill(code);
  await tablet.locator("#worldJoin").click();
  await wait(tablet, () => net.snapshots.at(-1)?.players.length === 2);
  await wait(phone, () => net.snapshots.at(-1)?.players.length === 2);
  assert.match(
    await phone.locator("#lobbyEquipment").innerText(),
    /2 FLASHLIGHTS/,
  );
  await phone.screenshot({ path: "test/results/lobby.png" });
  await phone.locator("#roundStart").click();
  await wait(phone, () => game.mode === "playing");
  await wait(tablet, () => game.mode === "playing");
  const id = await phone.evaluate(() => net.player.id),
    before = app.rooms.rooms.get(code).players.get(id).z;
  await phone.evaluate(() => {
    mobileInput.y = -1;
    mobileInput.sprint = true;
  });
  await phone.waitForTimeout(650);
  await phone.evaluate(() => {
    mobileInput.y = 0;
    mobileInput.sprint = false;
  });
  await wait(
    tablet,
    ({ id, before }) =>
      net.snapshots.at(-1)?.players.find((p) => p.id === id)?.z < before - 1,
    { id, before },
  );
  assert.ok(app.rooms.rooms.get(code).players.get(id).z < before - 1);
  const interpolation = await tablet.evaluate((id) => {
    const q = snapshotPair(),
      p = q.b.players.find((p) => p.id === id),
      old = q.a.players.find((p) => p.id === id);
    return { t: q.t, x: poseBetween(old, p, q.t).x };
  }, id);
  assert.ok(
    interpolation.t >= 0 &&
      interpolation.t <= 1 &&
      Number.isFinite(interpolation.x),
  );
  console.log(
    "PASS two isolated browser devices host/join, scale equipment and synchronize movement",
  );
  app.network.sockets.get(id).terminate();
  await wait(phone, () => net.status !== "CONNECTED");
  await wait(phone, () => net.connected);
  assert.equal(await phone.evaluate(() => net.player.id), id);
  assert.equal(app.rooms.rooms.get(code).players.size, 2);
  console.log("PASS browser automatically reconnects to the same character");
  await phone.evaluate(() => leaveMultiplayer());
  await phone.locator("#play").click();
  await wait(phone, () => game.mode === "playing");
  assert.equal(await phone.evaluate(() => net.active), false);
  await phone.evaluate(() => {
    game.fadeIn = 0;
    world.phase = 0.44;
    world.cycle = false;
    player.x = -155;
    player.z = -243;
    player.y = terrainHeight(player.x, player.z) + 1.7;
    player.yaw = 0.72;
    player.pitch = 0.14;
    updateCamera(0);
    frame(50);
  });
  await phone.screenshot({ path: "test/results/concrete.png" });
  await phone.evaluate(() => {
    powerCreature.state = "waking";
    powerCreature.wake = 3.9;
    powerCreature.rigBlend = 0.65;
    frame(100);
  });
  await phone.screenshot({ path: "test/results/breakaway.png" });
  assert.deepEqual(errors, []);
  await app.close();
  await phone.evaluate(() => mainMenu());
  await phone.locator("#multiplayerOpen").click();
  await phone.locator("#worldHost").click();
  await wait(phone, () => net.status === "SERVER OFFLINE");
  await phone.locator("#multiplayerBack").click();
  await phone.locator("#play").click();
  await wait(phone, () => game.mode === "playing");
  console.log("PASS singleplayer remains available with the server offline");
  console.log("BROWSER CHECKS PASS", JSON.stringify(offline));
} finally {
  await browser.close();
  if (app.server.listening) await app.close();
  rmSync(dir, { recursive: true, force: true });
}
