// Transport/credentials/reconnect only. Rendering lives in multiplayer.js.
class TowerNetwork {
  static DEFAULT_SERVER = "https://tower-of-power-server-live-production.up.railway.app";
  static normalizeServer(value) {
    let address = String(value || "").trim();
    if (!address) return TowerNetwork.DEFAULT_SERVER;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(address)) address = "https://" + address;
    let u;
    try { u = new URL(address); } catch { throw Error("Enter a valid server address, or use the default server."); }
    if (u.protocol !== "https:" && !(u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
      throw Error("Use an HTTPS server address.");
    if (u.username || u.password || u.search || u.hash)
      throw Error("Enter only the server address, without login details or query parameters.");
    return u.origin;
  }
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.socket = null;
    this.code = null;
    this.seq = 0;
    this.actionSeq = 0;
    this.player = null;
    this.token = null;
    this.status = "READY TO CONNECT";
    this.snapshots = [];
    this.items = [];
    this.intent = null;
    this.retryTimer = null;
    this.lossAt = 0;
    this.manual = false;
    this.pending = new Map();
    this.lastReceive = 0;
    this.roundStarted = false;
    let stored = "";
    try {
      stored = localStorage.getItem("top-server") || "";
    } catch {}
    if (/your-server\.example|appassets\.androidplatform\.net/.test(stored)) stored = "";
    const fallback =
      ((location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1") &&
      location.hostname !== "appassets.androidplatform.net"
        ? location.origin
        : TowerNetwork.DEFAULT_SERVER);
    try { this.url = TowerNetwork.normalizeServer(stored || fallback); }
    catch { this.url = TowerNetwork.normalizeServer(fallback); }
    this.loadSession();
  }
  get active() {
    return !!this.code;
  }
  get connected() {
    return this.status === "CONNECTED" && this.socket?.readyState === 1;
  }
  setStatus(s) {
    this.status = s;
    this.hooks.status?.(s);
  }
  loadSession() {
    try {
      const s = JSON.parse(
        sessionStorage.getItem("top-auth:" + this.url) || "null",
      );
      if (s && s.expires > Date.now()) {
        this.token = s.token;
        this.player = s.player;
      }
    } catch {}
  }
  setServer(value) {
    const origin = TowerNetwork.normalizeServer(value);
    if (origin === this.url) return;
    if (this.active || this.socket)
      throw Error("Leave the world before changing servers.");
    this.leave();
    this.url = origin;
    this.token = null;
    this.player = null;
    try {
      localStorage.setItem("top-server", this.url);
    } catch {}
    this.loadSession();
    this.setStatus("READY TO CONNECT");
    this.hooks.identity?.();
  }
  async checkServer() {
    const origin = this.url;
    this.setStatus("CONNECTING...");
    let result;
    try { result = await this.request("/health"); }
    catch (error) { this.setStatus("SERVER OFFLINE"); throw error; }
    if (result.protocol !== 1) {
      this.setStatus("SERVER OFFLINE");
      throw Error("This address is not a compatible TOWER OF POWER server.");
    }
    if (this.url === origin && !this.socket) this.setStatus("SERVER READY");
    return result;
  }
  async request(path, body) {
    if (!this.url) throw Error("Enter your multiplayer server address first.");
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), 8000);
    try {
      const r = await fetch(this.url + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: abort.signal,
          credentials: "omit",
        }),
        result = await r.json();
      if (!r.ok) throw Error(result.error || "Request failed.");
      return result;
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.setStatus("SERVER OFFLINE");
        throw Error("That address did not return a game server response. Try Use default.");
      }
      if (e.name === "AbortError" || e instanceof TypeError) {
        this.setStatus("SERVER OFFLINE");
        throw Error("Server unavailable. Singleplayer is still available.");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  async authenticate(kind, username, password) {
    if (this.active) throw Error("Leave the world before changing accounts.");
    const s = await this.request(
      "/api/" + kind,
      kind === "guest" ? {} : { username, password },
    );
    this.token = s.token;
    this.player = s.player;
    this.setStatus("SERVER READY");
    try {
      sessionStorage.setItem("top-auth:" + this.url, JSON.stringify(s));
    } catch {}
    this.hooks.identity?.();
    return s;
  }
  async verify() {
    if (!this.token) return;
    try {
      const r = await this.request("/api/me");
      this.player = r.player;
      this.hooks.identity?.();
    } catch (e) {
      if (e.message === "Login expired.") {
        this.token = null;
        this.player = null;
        this.hooks.identity?.();
      }
      throw e;
    }
  }
  async logout() {
    this.leave();
    try {
      if (this.token) await this.request("/api/logout", {});
    } finally {
      try {
        sessionStorage.removeItem("top-auth:" + this.url);
      } catch {}
      this.token = null;
      this.player = null;
      this.hooks.identity?.();
    }
  }
  host() {
    this.connect({ type: "host" });
  }
  join(code) {
    if (!/^[A-Z2-9]{5}$/.test(code))
      throw Error("Enter the five-character room code.");
    this.connect({ type: "join", code });
  }
  connect(intent, retry = false) {
    if (!this.token) throw Error("Login or play as guest first.");
    if (!this.url) throw Error("Enter your multiplayer server address first.");
    if (this.socket && [0, 1].includes(this.socket.readyState))
      throw Error("A connection is already open.");
    this.intent = intent;
    this.manual = false;
    this.setStatus(retry ? "RECONNECTING..." : "CONNECTING...");
    const ws = new WebSocket(this.url.replace(/^http/, "ws") + "/ws");
    this.socket = ws;
    const timeout = setTimeout(() => ws.close(), 8000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({ type: "hello", protocol: 1, token: this.token }),
      );
    ws.onmessage = (e) => {
      if (this.socket !== ws) return;
      this.lastReceive = performance.now();
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "authenticated") {
        clearTimeout(timeout);
        ws.send(JSON.stringify(this.intent));
      } else if (m.type === "joined") {
        this.code = m.code;
        this.seq = Math.max(this.seq, m.seq);
        this.actionSeq = Math.max(this.actionSeq, m.actionSeq);
        this.lossAt = 0;
        this.setStatus("CONNECTED");
        this.hooks.joined?.(m);
      } else if (m.type === "snapshot") {
        m.received = performance.now();
        if (m.world.items) this.items = m.world.items;
        this.snapshots.push(m);
        if (this.snapshots.length > 8) this.snapshots.shift();
        this.hooks.snapshot?.(m);
      } else if (m.type === "actionResult") {
        const r = this.pending.get(m.id);
        this.pending.delete(m.id);
        this.hooks.action?.(m, r);
      } else if (m.type === "events") this.hooks.events?.(m.events);
      else if (m.type === "error") {
        this.hooks.error?.(m.message);
        if (!this.code) {
          this.manual = true;
          ws.close();
          this.setStatus("SERVER OFFLINE");
        }
      }
    };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      clearTimeout(timeout);
      if (this.socket !== ws) return;
      this.socket = null;
      if (this.manual) return;
      if ([4001, 4003, 1008].includes(e.code)) {
        this.setStatus("CONNECTION LOST");
        this.hooks.error?.(
          e.code === 4001
            ? "This account connected on another device."
            : "Session ended. Leave the world and log in again.",
        );
        return;
      }
      if (!this.code) {
        this.setStatus("SERVER OFFLINE");
        return;
      }
      this.setStatus("CONNECTION LOST");
      this.lossAt = this.lossAt || Date.now();
      this.retry();
    };
  }
  retry() {
    if (this.manual || !this.code) return;
    if (Date.now() - this.lossAt > 90000) {
      this.setStatus("SERVER OFFLINE");
      this.hooks.error?.(
        "Reconnect period ended. Leave this world and join again.",
      );
      return;
    }
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(
      () => {
        try {
          this.connect({ type: "resume", code: this.code }, true);
        } catch {
          this.retry();
        }
      },
      Math.min(6000, 700 + (Date.now() - this.lossAt) * 0.12) +
        Math.random() * 250,
    );
  }
  send(data) {
    if (!this.connected || this.socket.bufferedAmount > 16384) return false;
    this.socket.send(JSON.stringify(data));
    return true;
  }
  input(data) {
    this.send({ type: "input", seq: ++this.seq, ...data });
  }
  action(action, extra = {}) {
    if (!this.connected) return false;
    const id = ++this.actionSeq;
    this.pending.set(id, { action, ...extra });
    if (this.pending.size > 80)
      this.pending.delete(this.pending.keys().next().value);
    return this.send({ type: "action", id, action, ...extra });
  }
  leave() {
    this.manual = true;
    clearTimeout(this.retryTimer);
    if (this.socket) {
      if (this.connected) this.send({ type: "leave" });
      this.socket.close();
      this.socket = null;
    }
    this.code = null;
    this.snapshots = [];
    this.items = [];
    this.pending.clear();
    this.roundStarted = false;
    this.lossAt = 0;
    this.setStatus("READY TO CONNECT");
  }
}
