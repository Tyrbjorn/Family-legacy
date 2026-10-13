// Save export / import: base64 text code or JSON file, validated and migrated.
import { deserialize, normalize, serialize } from "./save.js";
import { SAVE_VERSION } from "./state.js";

const toB64 = str =>
  typeof btoa === "function" ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, "utf8").toString("base64");
const fromB64 = b64 =>
  typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");

export const exportCode = s => "FL1:" + toB64(serialize(s));

export function decodeSave(text) {
  let t = String(text || "").trim();
  if (!t) throw new Error("empty save");
  if (t.startsWith("FL1:")) t = t.slice(4);
  let json = t;
  if (!t.startsWith("{")) {
    try {
      json = fromB64(t.replace(/\s+/g, ""));
    } catch {
      throw new Error("not a valid save code");
    }
  }
  let o;
  try {
    o = JSON.parse(json);
  } catch {
    throw new Error("not a valid save code");
  }
  if (!o || typeof o !== "object" || !Array.isArray(o.members)) throw new Error("not a Family Legacy save");
  if (o.v !== SAVE_VERSION) throw new Error(`unsupported save version ${o.v} (expected ${SAVE_VERSION})`);
  return o;
}

export function importSave(text) {
  const o = decodeSave(text);
  const s = deserialize(JSON.stringify(o));
  normalize(s);
  return s;
}
