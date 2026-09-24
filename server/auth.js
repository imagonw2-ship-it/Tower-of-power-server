import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt),
  hash = (s) => createHash("sha256").update(s).digest("hex"),
  PARAMS = { N: 32768, r: 8, p: 3, maxmem: 128 * 1024 * 1024 };
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export class Auth {
  constructor(db) {
    this.db = db;
    this.guests = new Map();
    this.busy = 0;
    this.dummy =
      "scrypt$32768$8$3$" +
      Buffer.alloc(16).toString("hex") +
      "$" +
      Buffer.alloc(64).toString("hex");
  }
  public(a) {
    return { id: a.id, username: a.username, guest: !!a.guest };
  }
  async password(password, encoded) {
    if (this.busy >= 4)
      throw new HttpError(503, "Authentication is busy. Try again shortly.");
    this.busy++;
    try {
      const salt = encoded
          ? encoded.split("$")[4]
          : randomBytes(16).toString("hex"),
        key = await derive(password, salt, 64, PARAMS);
      if (encoded) {
        const expected = Buffer.from(encoded.split("$")[5], "hex");
        return expected.length === key.length && timingSafeEqual(expected, key);
      }
      return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
    } finally {
      this.busy--;
    }
  }
  async register(username, password) {
    if (typeof username !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(username))
      throw new HttpError(
        400,
        "Username: 3–20 letters, numbers or underscores.",
      );
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw new HttpError(400, "Use a password of 12–128 characters.");
    const key = username.toLowerCase();
    if (
      this.db.prepare("SELECT id FROM accounts WHERE username_key=?").get(key)
    )
      throw new HttpError(409, "Username is already taken.");
    const encoded = await this.password(password),
      a = { id: randomUUID(), username };
    try {
      this.db.exec("BEGIN");
      this.db
        .prepare(
          "INSERT INTO accounts(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,?)",
        )
        .run(a.id, username, key, encoded, Date.now());
      this.db.prepare("INSERT INTO profiles(account_id) VALUES(?)").run(a.id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      if (String(e).includes("UNIQUE"))
        throw new HttpError(409, "Username is already taken.");
      throw e;
    }
    return this.session(a);
  }
  async login(username, password) {
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 20 ||
      password.length > 128
    )
      throw new HttpError(401, "Incorrect username or password.");
    const a = this.db
        .prepare("SELECT * FROM accounts WHERE username_key=?")
        .get(username.toLowerCase()),
      valid = await this.password(password, a?.password_hash || this.dummy);
    if (!a || !valid)
      throw new HttpError(401, "Incorrect username or password.");
    if (a.banned_until > Date.now())
      throw new HttpError(403, "This account is unavailable.");
    return this.session(a);
  }
  session(a) {
    const token = randomBytes(32).toString("base64url"),
      expires = Date.now() + 7 * 86400000;
    this.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(hash(token), a.id, Date.now(), expires);
    return { token, expires, player: this.public(a) };
  }
  guest() {
    if (this.guests.size >= 2000) throw new HttpError(503, "Server is full.");
    const token = randomBytes(32).toString("base64url"),
      expires = Date.now() + 12 * 3600000,
      a = {
        id: "guest-" + randomUUID(),
        username: "Guest_" + randomBytes(3).toString("hex"),
        guest: true,
        expires,
      };
    this.guests.set(hash(token), a);
    return { token, expires, player: this.public(a) };
  }
  verify(token) {
    if (typeof token !== "string" || token.length > 100) return null;
    const digest = hash(token),
      g = this.guests.get(digest);
    if (g && g.expires > Date.now()) return this.public(g);
    const a = this.db
      .prepare(
        "SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.banned_until<=?",
      )
      .get(digest, Date.now(), Date.now());
    return a ? this.public(a) : null;
  }
  logout(token) {
    if (typeof token !== "string") return;
    this.guests.delete(hash(token));
    this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
  }
  cleanup() {
    for (const [k, v] of this.guests)
      if (v.expires < Date.now()) this.guests.delete(k);
    this.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
  }
}
