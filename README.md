## Version 11.1: grips, camera and bodycam censor

- Camera, soda and flashlight attach to a shared palm frame with individual physical grip anchors. Wrist rotation and aiming are carried through idle, walk, sprint and crouch.
- A textured CC0 camera discovered on Sketchfab replaces the box camera in first person and multiplayer. Asset and original creator credits are in ASSET_CREDITS.md.
- Mobile toggle sprint is above the right-hand action buttons.
- Whole-head censor rectangles are applied in screen space after VHS processing, including saved photos. The scene depth texture prevents the censor from drawing through nearer objects.
- Android 11.1 / versionCode 14 retains the existing package and signing identity; protocol 1 and the account database are unchanged.
- Added grip-contact and real skinned-head coverage checks, plus native GLES pixel checks for censorship, foreground occlusion and flash. Physical Android device testing is still required.

## Version 11.0: equipment and hazmat update

This release keeps the existing WebGL2 game, mobile controls and authoritative room server.

- Neutral transparent controls and a dedicated toggle sprint button. The movement stick no longer enables sprint. Mobile keyboard hints and the menu logo are removed.
- One equipped hand, a backpack grid, drag/tap equipment selection, bigger held flashlight and a neutral aluminum soda can.
- Uploaded Class A NBC hazmat player model, Mixamo walk/run/idle poses and a crouch walk derived from Mixamo's sneak pose plus walk cycle. Equipped items attach to the right hand. An opaque black censor bar follows each head.
- Turbine legs stay inside separate angular sectors; stomps predict motion from successive audible positions, then lock their aim. Both giants use a telegraphed body drop when they hear a player beneath their center.
- Equipped items are checked and synchronized by the server. Only the world owner sees and can use world controls in multiplayer.
- Android 11.0 / versionCode 13 uses the existing package and signing identity. No database migration is required. Protocol 1 remains supported.

Validation includes the full game harness, native ANGLE shader compile/link, real HTTP/WebSocket device tests, attack reach/prediction/drop tests and avatar geometry/hand checks. A physical Android device was not available in this environment.

## Version 10.2 startup fix

Renamed a reserved GLSL word in the concrete shader that prevented version 10 from starting on real graphics drivers. Startup errors now report the shader stage. The game preserves the Field Kit, power corridor fixes, leg collisions and multiplayer targeting.

A new native ANGLE GLES test compiles and links all six shipped shader programs. To run this gate, set `ANGLE_LIB_DIR` to an ANGLE/SwiftShader directory containing `libEGL.so`, `libGLESv2.so`, `libvk_swiftshader.so` and `vk_swiftshader_icd.json`, then run `npm test`. Without the directory, the graphics test is explicitly skipped; the game integration and networking tests still run. This compiler test does not replace physical-phone rendering tests.

# TOWER OF POWER Server

The existing TOWER OF POWER browser game and its authoritative multiplayer
backend, shared by desktop browsers, mobile browsers, Chromebooks, and the
Android APK. The game, imported models, touch controls, enemies, graphics,
audio, and singleplayer mode are preserved.

## Version 10: Field Kit and leg attacks

Touch play uses an outer-edge sprint joystick, a context-only pickup button,
and one large Use button. Open KIT to equip the camera, flashlight or stacked
sodas. The smaller buttons crouch and cycle zoom; world controls are in Pause.
Desktop keeps its existing shortcuts and adds I/Tab for the kit and R to use
its selected tool. Android Back closes the kit before returning to the menu.

The power corridor has six grounded background towers and conductors attached
to crossarm insulators. The moving tower releases its conductors as it wakes.
Warning signs read correctly on both sides; the concrete yard has larger bays,
narrow expansion joints and drainage channels. Leg concrete collars are gone.

Both giants use solid leg segments and a telegraphed, aimed foot stomp. The
landing point locks before impact; proximity to the torso alone does not cause
a catch. Online damage and collisions are resolved by the server. Sound target
tracking commits to one player, forgets silent targets, and can switch away
from unreachable shelter targets after a commitment period. Crouching in grass
still reduces noise. Each room owns its own target memory.

Shared combat rules are in `shared/enemy-combat.js`, corridor layout in
`shared/power-layout.js`, and equipment UI in `client/equipment.*`. The new
modules are embedded into the standalone HTML, with no new runtime download.

## Run locally

Requires Node.js 24 or newer for built-in SQLite.

```sh
npm ci
npm start
```

Open `http://localhost:8080`. Accounts are stored in `data/accounts.sqlite` by
default. For local configuration, use `.env.example` as a template and run
`node --env-file=.env server/server.js`. Never commit your actual `.env`,
account databases, passwords, tokens, or signing keys.

## Deploy on Railway

1. Connect this repository to the existing Railway service and deploy `main`.
   Select the Dockerfile builder with path `Dockerfile` (Node 24). Set the
   healthcheck to `/health`, timeout to 60 seconds, and restart policy to
   On Failure with 5 retries in the service settings. New Railway services
   no longer accept `railway.json`; that file is retained as a legacy reference.
   The live service uses these settings directly in Railway.
2. Attach a persistent volume to the service at `/data`. Accounts must be on
   this volume so deployments and container replacements do not erase them.
3. Set the following service variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `DATABASE_PATH` | `/data/accounts.sqlite` |
   | `TRUST_PROXY` | `true` |
   | `ALLOWED_ORIGINS` | `https://appassets.androidplatform.net` |
   | `ALLOW_FILE_ORIGIN` | `true` when using the downloaded HTML file |
   | `RAILWAY_RUN_UID` | `0` for Railway's root-owned volume |

   `TRUST_PROXY=true` requires Railway's trusted HTTPS proxy. Do not expose the
   container's HTTP port directly to the public internet. The Docker image runs
   as `node` by default; Railway's volume permissions require the documented
   UID override or an administrator-managed writable volume.
4. Keep **one replica**, disable sleeping for active play, and generate an
   HTTPS domain routing to port 8080. WebSocket upgrades use the same domain.
5. Verify `/health`, account creation, and two clients joining the same room.
   Set up database backups before distributing the server broadly.

The APK and downloaded HTML now default to the live server at
`https://tower-of-power-server-live-production.up.railway.app`. Open MULTIPLAYER
and choose PLAY AS GUEST or sign in; no server address is required. The hosted
browser game uses its own origin. Advanced SERVER SETTINGS still allow a custom
HTTPS origin, and USE DEFAULT restores the live server. Entered addresses are
applied automatically by guest, login, create, host and join actions. A GitHub
repository URL is not a game server address.

## Play together

Connect, then log in, create an account, or play as a guest. Choose CREATE WORLD
/ HOST and share the five-character room code. Other players choose JOIN WORLD.
Start the round after everyone has joined. The server scales starter flashlights
and sodas to the lobby player count, using configurable formulas.

## Structure

| Path | Responsibility |
| --- | --- |
| `server/server.js` | HTTP, authentication routes, CORS, and startup |
| `server/auth.js` | Scrypt password hashing, sessions, and guests |
| `server/database.js` | Persistent accounts and schema boundaries |
| `server/rooms.js` | Room codes, ownership, membership, and reconnection |
| `server/players.js` | Player input validation and character state |
| `server/networking.js` | WebSockets and fixed-rate networking |
| `server/worlds.js` | Authoritative simulation and future world-save boundary |
| `server/enemies.js` | Shared turbine and power-line enemy simulation |
| `server/items.js` | Starter equipment and validated pickups |
| `server/config.js` | Limits, network rates, and equipment formulas |
| `shared/physics.js` | Shared movement, terrain, collision, and sound rules |
| `client/` | Original game source and separate multiplayer client modules |
| `public/index.html` | Complete, prebuilt browser game with embedded assets |
| `scripts/build_client.py` | Rebuilds the standalone HTML from client sources |
| `test/` | HTTP/WebSocket integration tests and browser checks |

The simulation runs at 20 Hz and snapshots at 10 Hz. Remote players interpolate
between updates. The server validates movement, pickups, inventory, damage,
deaths, enemy interactions, and world-owner controls. Rooms support eight
players and a 90-second reconnect window. The host's device does not run the
authoritative simulation.

Registered accounts have permanent UUIDs, case-insensitive unique usernames,
salted scrypt password hashes, and hashed opaque session tokens. Accounts survive
server restarts when the SQLite database is on durable storage. Guest accounts
are temporary. Active rooms are in memory and end when the server restarts.

Saved multiplayer worlds, cloud saves, friends, achievements, cosmetics, and
statistics have extension boundaries; their complete features are future work.
There is currently no account recovery workflow. The Android wrapper and APK
are separate deliverables and use this same HTTPS/WebSocket backend.

## Validate and rebuild

```sh
npm test
npm run build
```

The build requires Python 3. It also produces a standalone HTML beside this
project and an `android/assets/index.html` copy for the Android packaging
workflow. The prebuilt `public/index.html` is already included, so production
deployments do not need to rebuild it.

Integration tests cover accounts, incorrect credentials, duplicate names,
guest multiplayer, separate devices, room codes, starter-item scaling,
movement validation, reconnects, independent rooms, shared enemies, and account
persistence. `test/browser.mjs` additionally checks the actual game UI and
singleplayer; provide `CHROMIUM_PATH` for a compatible Chromium installation.

The version 10 automated suite has 33 passing checks. It includes the complete
compiled game script with a DOM and recording graphics adapter, plus real
HTTP/WebSocket multiplayer tests. That adapter checks geometry and integration,
not actual GPU rendering. Final appearance and performance still require a
WebGL 2 device; the available cloud browser does not support WebGL 2.
