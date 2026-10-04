## Version 12.5.1: deep woods and clear suit IDs

- The three supplied tree packs replace the old pine meshes with seven textured trees, original foliage opacity and two detail levels. Seeded clusters, clearings and uneven edges create a denser forest. Roads stay clear and the forest compass marker remains available.
- Forest geometry is shared in at most 14 instanced batches, culled beyond the quality-dependent range. Detailed nearby trees cast cutout leaf shadows. Stationary players do not resend tree transforms. Server and client check an 8-metre collision grid around each player instead of scanning the forest.
- Suit cards are smaller, angled against the chest and attached to the animated chest bone. A larger print texture prioritizes the username, with the censored suit portrait retained. Cards render after VHS so text remains clear, while depth testing and back-face rejection keep them hidden behind walls and on the far side of a suit.
- Android versionCode 24 / versionName 12.5.1 preserves the existing package and signing certificate. The server uses layout capability 3 for matching tree placement and collisions. Older APKs receive an update message before joining; account data needs no migration.

Validation: all 84 automated checks passed, including account and WebSocket multiplayer flows, 2,000 connected road seeds, shared enemies, equipment, singleplayer, native GLES shader compilation, clustered-tree collision locality, instanced LOD upload bounds and animated card alignment. Real WebGL checks cover the forest, clear standing/crouched cards and wall occlusion. Physical Android performance and appearance still require device testing.

## Version 12.5: uncharted roads

- Replaces the three preset maps with a deterministic road graph. Each seed changes junction positions, branches, loops, access roads, 1–4 turbines, and a connected network of 6–11 pylons. The safe shed approach stays consistent; the explorable map is finite.
- Every turbine and pylon has an access road connected to the spawn network. Utility lines can fork, and every cable endpoint uses its tower’s rotated insulator socket. Additional multiplayer pylon enemies activate existing connected towers without leaving duplicate static meshes or collisions behind.
- Optional seed fields support numbers or phrases for singleplayer and hosted rooms. Blank creates a fresh seed. The lobby and host world panel display the numeric seed for replaying the same geography; multiplayer clients use the server’s seed and generator version.
- The forest varies in location and size and stays beyond the initial forest draw distance. Its own ▲ compass marker and distance remain visible alongside the ◆ power corridor marker. A connected road leads to the forest entrance, with tree trunks kept clear of the roads.
- Road rendering evaluates eight nearby segments from a compact GPU lookup, keeping shader work bounded as the road network grows. Existing batched forest culling, effects, item models, mobile controls, voice, authoritative gameplay and account storage remain in place.
- Android versionCode 23 / versionName 12.5 retains the existing package and signing identity. No account migration is required. Multiplayer requires layout capability 2, with an update message for older APKs before joining.

Validation: all 81 automated checks passed, including 2,000 distinct connected seeds, road access for every landmark, pylon spacing and cable sockets, exact GPU road lookup, cross-device seed synchronization, accounts, reconnects, independent rooms, item/enemy authority, proximity voice, singleplayer and native GLES shader compilation. Real WebGL screenshots cover multiple road junctions, the connected utility corridor and both compass destinations. Physical Android performance and appearance still require device testing.

## Version 12.0: beyond the field

- Sealed turbine belly and leg end caps fix the torn underside seen when looking up. The concrete foundation stays at its original ground position when the tower rises.
- Each room has one authoritative seed: Open Field, Crossroads or Twin Sentinels. The twin variant has two independent hearing, emergence, movement and attack simulations. Tower and pylon finishes vary with the seed. Offline worlds use the same layout rules.
- A distant pine forest starts outside the spawn render distance, uses three CC0 Kenney tree models, and fades in as players approach. Trees are batched and culled by distance; trunk collisions use the same deterministic placement on server and client. The compass points toward the forest when it is the nearer destination.
- Simpler monochrome controls, including a down-arrow crouch button. In-game player names move to printed suit ID cards with the existing hazmat suit portrait and blacked-out face; lobby account names remain available.
- Android versionCode 22 / versionName 12.0 retains the package and signing identity. Accounts need no migration. Multiplayer requires the 12.0 layout capability: older builds can still log in but receive an explicit update message before entering a world they cannot render.
- Voice-mimicking creatures and their combat are deferred to the later update. This release does not record or store voice clips. Existing proximity voice remains available.

Validation: full game harness, real HTTP/WebSocket devices, login and persistence, reconnects, room isolation, item authority, proximity voice, shared map seeds, independent second-turbine synchronization and native GLES shader tests. Rendered screenshots cover the closed underside, all three layouts, forest and animated suit cards. Physical Android appearance and performance still require device testing.

## Version 11.8: equipment and inventory fixes

- Tighter soda and launcher finger contact; the launcher grip stays in the first-person view. Existing flashlight and camera poses are preserved.
- Flares visibly leave the muzzle, with immediate local launch feedback reconciled to the server, a glowing flight trail, warm light and distant sparks. Transparent effects render after solid objects and grass, while retaining depth occlusion. Muzzle offsets cannot shoot through a nearby shed wall.
- Dropped props settle using their actual convex mesh support and the rendered triangular ground surface, including slopes. The server replicates resting orientation and keeps ownership and flare ammunition authoritative.
- Inventory cards use cached studio renders of the shipped 3D models. Unowned items are hidden; slots return after drinking or dropping an item. The Drop button fits the main-hand panel, and mobile action icons are simpler monochrome outlines.
- Android versionCode 21 / versionName 11.8 uses the same package and signing identity. Accounts require no migration. The matching server update enables launch reconciliation and the corrected shared drop placement.

Validation includes mobile WebGL screenshots, model/ground contact checks, responsive inventory bounds, real HTTP/WebSocket account and multiplayer tests, and native GLES shader/lighting checks. Physical Android performance and appearance still need device testing.

## Version 11.7: proximity voice and quiet searches

- Nearby voice uses the existing authenticated WebSocket connection. Tap the microphone to opt in; it starts muted and requests Android microphone permission only when enabled. Volume fades to silence at 42 metres, pans with the listener, and is muffled through the shed. Audible speech can alert the blind enemies. Voice is relayed live, never saved by the game server. Mute, pause, app background, death, disconnect and leaving the world stop microphone capture. Reconnecting remains muted.
- The server validates room membership, live characters, audio packet sizes, sequence numbers and a separate voice rate limit. 16 kHz mono IMA ADPCM uses 408 bytes per 50 ms frame, around 8.2 KB/s per active speaker before transport overhead. Silent frames are suppressed and playback has a bounded jitter queue. No TURN service, API key or secret in the APK is required.
- After 60 seconds without an audible player, each monster investigates a coarse nearby area. This hint has no attack target or player velocity, does not track a quiet player continuously, and cannot trigger a stomp or body drop. Fresh audible activity restores normal pursuit.
- Each room gets one moving pylon per two players, up to four. Late joins can add pylons; departures do not reset or remove active enemies. Configure `pylons.playersPerPylon` and `pylons.maximum` in `server/config.js`. All pylons have independent targeting, attacks, grounded feet, collision and interpolated client poses. Distant models use existing LOD meshes and limited shadows.
- Recalibrated flashlight and launcher grip anchors and fitted curled glove geometry to handle cross-sections, including the larger first-person flashlight. Updated monochrome control icons and softer transparent outlines. Flare signals now use circular additive particles with soft edges instead of opaque squares.
- Includes the previously prepared 11.6 changes: uploaded flare gun model, item-specific finger poses, shared item dropping and recovery, and the centered stamina bar. Android versionCode 20 / versionName 11.7 keeps the existing app package and signing certificate. Accounts need no migration.

Validation: real HTTP/WebSocket clients cover voice range, separate rooms, reconnect/mute and existing multiplayer/account flows. Audio codec/worklet tests cover packet validity, sound quality, resampling, stereo mixing and queue limits. Game integration covers singleplayer, touch, switching, hands and pickups; native GLES compiles the shaders and tests lighting. Physical Android microphone behavior, latency and appearance still need device testing.

## Version 11.5: signals, stamina and field controls

- Flare gun pickup with three signals, shared projectiles, warm light, sparks and sound. A signal distracts nearby enemies for 12 seconds. When it ends they become 25% faster for 18 seconds, but still need audible player activity to resume pursuit. Crouching silently in distant grass remains effective.
- Authoritative ammunition, action cooldowns, collision, room-local flares and stamina. Sprint lasts about eight seconds; stamina recovers after a short delay and exhaustion requires partial recovery.
- Horizontal flashlights rest on their actual mesh bounds; a supported supply table holds the signal equipment. Steel continuations ground background pylons, and moving feet have embedded base plates.
- Compact transparent monochrome mobile controls, stamina meter and bounded camera inertia/breathing; reduced-motion support is preserved.
- Android 11.5 / versionCode 18 retains the package and signing identity. No account database migration. New multiplayer features require this server update; singleplayer is self-contained.
- 58 automated checks passed, including real WebSocket devices and native GLES compilation. Physical Android appearance/performance remain unverified.

**Pending external assets:** Sketchfab requires a login before downloading the replacement shed, workbench and flare model. The existing shed/bench and an original temporary flare prop remain in this build. Higgsfield generation was attempted but rejected because the connected account requires Basic plan or higher; the controls were designed in native CSS/SVG, not generated by Higgsfield. See `PENDING_ASSETS.md`.

## Version 11.4: complete glove, shed lighting and smoother shadows

- Fixed the missing hand: first-person extraction now includes the uploaded hazmat gear mesh containing the rubber glove, as well as the suit sleeve. The flashlight and soda sit higher so the gripping hand remains visible.
- Shed light rays now intersect the actual board planes and respect the doorway, broken window and roof gaps. Removed oversized blockers that made visible walls black; added restrained daylight bounce inside.
- Added a player-centred 48 metre sun-shadow cascade with filtered comparison sampling, blended into the existing world shadows. Medium quality uses about 5 cm texels nearby instead of 45 cm; the map snaps to texels to reduce shimmer.
- Preserves item-anchored pickup buttons, equipment switching, distance-scaled face censorship, local/remote flashlights, mobile controls and authoritative multiplayer. This is filtered shadow mapping and limited analytic shed ray tests, not full hardware ray tracing.
- Android 11.4 / versionCode 17 uses the same app package and signing identity. Compatible with the existing protocol-1 server; no server restart, database change or account migration is required.
- All 51 automated checks passed, including accounts, separate devices, reconnects, rooms, enemy synchronization and singleplayer. Native GLES shader/pixel tests cover wall self-occlusion, doorway/window transmission and smooth shadow edges. Physical Android appearance and performance remain unverified.

## Version 11.3: first-person arms and shared lighting

- The flat censor covers the face and upper hood edge without gaps, follows VHS displacement and still shrinks with distance. Fully hidden players stay occluded.
- The uploaded hazmat sleeve and glove appear in first person, with grip-aligned holding, switching and drinking poses. The extra mesh reuses the existing texture.
- Up to three nearby multiplayer flashlights illuminate shared surfaces. Their beams follow the held lens; shed walls and the pitched roof block both local and remote lights.
- The shed has darker interior ambient light, doorway bounce and roof/wall shadows even at lower shadow settings.
- The contextual item pickup buttons, inventory, controls, enemy systems and networking remain in place. Android 11.3 / versionCode 16 retains the existing signing identity and protocol.
- Verification is limited to 15 focused checks, including native GLES shader and pixel checks. Physical Android testing remains unverified.

## Version 11.2: flashlight, face censor and item interactions

- The flat censor covers the visible face, leaves the hood visible, and shrinks with distance. Removed fixed screen padding; it follows the recorded image's VHS distortion and remains occluded by nearer objects.
- Flashlight energy is added in linear light, with a brighter hotspot, broader spill, gradual distance falloff, matching shadow coverage and a light source at the held model's lens. Equipping it restores the player's on/off preference.
- A glass pickup prompt follows the item under the player's aim. It sends the displayed item ID and retains server reach, sight and ownership validation. It disappears when out of reach, obscured, collected or disconnected.
- Equipment switches lower the old item, swap out of view and raise the new item. Remote hazmat hands animate the same transition. Rapid switches and inventory selection are supported.
- Android 11.2 / versionCode 15 keeps the existing app identity and signing key. No account, protocol or database migration is needed.
- 47 automated checks passed, including native graphics pixel tests for flashlight visibility/falloff/shadowing and full-client pickup/animation checks. Physical Android testing remains unverified.

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
