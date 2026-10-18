// R39.1 tester play pass + "What's new". Per-browser flags in their own localStorage keys (like Dev Mode):
// never in saves or exports. The pass is NOT Dev Mode: it only unlocks content (no cheats).
import { D } from "./state.js";

export const PASS_KEY = "fl-pass"; // tester token
export const BADGE_KEY = "fl-pass-badge"; // "0" = badge hidden
export const SEEN_KEY = "fl-whatsnew"; // last build whose notes were shown

let PASS = null; // { token, name } while active
export const playPass = () => PASS;
export const hasPlayPass = () => !!PASS;
// Future DLC / cosmetics ask this: free content is always open; paid content opens with a play pass.
export const contentUnlocked = (def = {}) => !def.paid || hasPlayPass();

const tokens = () => ((D.testers || {}).tokens || []).filter(t => t && t.token);
export const testerFor = tok => (tok ? tokens().find(t => t.token.toLowerCase() === String(tok).trim().toLowerCase()) || null : null);

// Run once at launch. query = the ?tester= value (or null). A valid link stores the token; a retired stored
// token (removed from testers.json) is cleared. Returns { on, name, changed: "on"|"off"|"bad"|null }.
export function initPlayPass(store, query) {
  let changed = null;
  if (query != null && query !== "") {
    const t = testerFor(query);
    if (t) {
      if (store.getItem(PASS_KEY) !== t.token) changed = "on";
      store.setItem(PASS_KEY, t.token);
      store.removeItem(BADGE_KEY);
    } else changed = "bad";
  }
  const saved = store.getItem(PASS_KEY);
  const t = testerFor(saved);
  if (saved && !t) {
    store.removeItem(PASS_KEY);
    changed = "off";
  }
  PASS = t ? { token: t.token, name: t.name || t.token } : null;
  return { on: !!PASS, name: PASS && PASS.name, changed };
}
export const clearPlayPass = store => (store.removeItem(PASS_KEY), (PASS = null));
export const badgeShown = store => hasPlayPass() && store.getItem(BADGE_KEY) !== "0";
export const setBadge = (store, on) => (on ? store.removeItem(BADGE_KEY) : store.setItem(BADGE_KEY, "0"));

// What's new: entries newest first; shown once per build. Brand-new players skip it (nothing is "new" to them).
export const changelog = () => (D.changelog || {}).entries || [];
export function whatsNewDue(store, build, freshPlayer) {
  const seen = store.getItem(SEEN_KEY);
  if (seen === build) return false;
  if (!seen && freshPlayer) return void store.setItem(SEEN_KEY, build), false;
  return changelog().length > 0;
}
export const markWhatsNewSeen = (store, build) => store.setItem(SEEN_KEY, build);
// entries newer than the last seen build (all of them if unknown), at least the newest one
export function whatsNewEntries(store, all = false) {
  const L = changelog(), seen = store.getItem(SEEN_KEY);
  if (all || !seen) return L;
  const i = L.findIndex(e => e.build === seen);
  return i > 0 ? L.slice(0, i) : L.slice(0, 1);
}
