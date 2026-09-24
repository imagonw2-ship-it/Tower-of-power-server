# TOWER OF POWER Server

The existing TOWER OF POWER browser game and its authoritative multiplayer
backend, shared by desktop browsers, mobile browsers, Chromebooks, and the
Android APK. The game, imported models, touch controls, enemies, graphics,
audio, and singleplayer mode are preserved.

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

In the APK or downloaded HTML, enter the generated **HTTPS origin** in
MULTIPLAYER > SERVER ADDRESS. A GitHub repository URL is not a game server
address. The browser game served by this server automatically uses its own
origin. No public server address is hardcoded into the client.

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
